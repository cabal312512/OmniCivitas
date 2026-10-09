import heapq
import math


class Data:
    def __init__(self, tools):
        self.tools = tools

    def stock(self, request):
        nodes, links, flows = request.get('nodes'), request.get('links'), request.get('flows')
        if not isinstance(nodes, list) or not 1 <= len(nodes) <= 64:
            raise self.tools.InvoiceError('network requires 1..64 nodes')
        if not isinstance(links, list) or len(links) > 128:
            raise self.tools.InvoiceError('network links exceed 128')
        if not isinstance(flows, list) or not 1 <= len(flows) <= 16:
            raise self.tools.InvoiceError('network requires 1..16 flows')
        ids = set()
        for node in nodes:
            identity = str(node.get('id', ''))
            if not identity or len(identity) > 96 or identity in ids:
                raise self.tools.InvoiceError('duplicate or invalid network node')
            ids.add(identity)
        link_map, flow_map = {}, {}
        for link in links:
            identity = str(link.get('id', ''))
            a, b = str(link.get('a', '')), str(link.get('b', ''))
            if not identity or len(identity) > 96 or identity in link_map or a not in ids or b not in ids or a == b:
                raise self.tools.InvoiceError('invalid network link terminals or id')
            rate = self.tools.amount(link.get('rateMbps', 10), identity + '.rateMbps', .001, 100000)
            delay = self.tools.amount(link.get('delayMs', 5), identity + '.delayMs', 0, 100000)
            loss = self.tools.amount(link.get('loss', 0), identity + '.loss', 0, 1)
            link_map[identity] = {**link, 'id': identity, 'a': a, 'b': b, 'rateMbps': rate, 'delayMs': delay, 'loss': loss}
        duration = self.tools.amount(request.get('durationMs', 5000), 'durationMs', 1, 100000)
        for flow in flows:
            identity = str(flow.get('id', ''))
            source, target = str(flow.get('source', '')), str(flow.get('target', ''))
            if not identity or len(identity) > 96 or identity in flow_map or source not in ids or target not in ids:
                raise self.tools.InvoiceError('invalid network flow')
            packets = self.tools.amount(flow.get('packets', 12), identity + '.packets', 1, 512)
            size = self.tools.amount(flow.get('bytes', 1024), identity + '.bytes', 1, 65536)
            if int(packets) != packets or int(size) != size:
                raise self.tools.InvoiceError('packet count and size must be integers')
            start = self.tools.amount(flow.get('startMs', 0), identity + '.startMs', 0, duration)
            interval = self.tools.amount(flow.get('intervalMs', 60), identity + '.intervalMs', 0, 100000)
            flow_map[identity] = {**flow, 'id': identity, 'source': source, 'target': target, 'packets': int(packets),
                                  'bytes': int(size), 'startMs': start, 'intervalMs': interval}
        if sum(flow['packets'] for flow in flow_map.values()) > 512:
            raise self.tools.InvoiceError('network packet count exceeds 512 across all flows')
        return ids, link_map, flow_map, duration

    def path(self, flow, nodes, links):
        graph = {node: [] for node in nodes}
        for link in links.values():
            if not link.get('enabled', True):
                continue
            weight = link['delayMs'] + flow['bytes'] * 8 / (link['rateMbps'] * 1000)
            graph[link['a']].append((link['b'], weight, link['id']))
            graph[link['b']].append((link['a'], weight, link['id']))
        queue = [(0., flow['source'], [], [flow['source']])]
        best = {}
        while queue:
            cost, node, edges, chain = heapq.heappop(queue)
            if node in best:
                continue
            best[node] = cost
            if node == flow['target']:
                return {'nodes': chain, 'links': edges, 'minimumLatencyMs': cost}
            for child, weight, edge in graph[node]:
                if child not in best:
                    heapq.heappush(queue, (cost + weight, child, edges + [edge], chain + [child]))
        return {'nodes': [], 'links': [], 'minimumLatencyMs': None}

    def route_checks(self, routes, flow_map, link_map, references):
        if not isinstance(routes, list) or len(routes) > 16:
            raise self.tools.InvoiceError('native routes must be an array of at most 16 paths')
        invalid, tested = [], 0
        seen = set()
        for route in routes:
            fid = str(route.get('flow', ''))
            chain, edges = route.get('nodes', []), route.get('links', [])
            if fid not in flow_map or fid in seen:
                invalid.append({'flow': fid, 'reason': 'unknown or duplicate route'})
                continue
            seen.add(fid)
            flow, reference = flow_map[fid], references[fid]
            if not chain and not edges:
                if reference['minimumLatencyMs'] is not None:
                    invalid.append({'flow': fid, 'reason': 'reachable flow has an empty route'})
                tested += 1
                continue
            if not isinstance(chain, list) or not isinstance(edges, list) or len(chain) != len(edges) + 1 or len(edges) > 64:
                invalid.append({'flow': fid, 'reason': 'route node/edge lengths disagree'})
                continue
            if chain[0] != flow['source'] or chain[-1] != flow['target']:
                invalid.append({'flow': fid, 'reason': 'route endpoints disagree'})
                continue
            cost = 0.
            connected = True
            for index, edge in enumerate(edges):
                link = link_map.get(str(edge))
                if not link or not link.get('enabled', True) or {link['a'], link['b']} != {chain[index], chain[index + 1]}:
                    invalid.append({'flow': fid, 'reason': 'route uses missing, disabled or nonadjacent link'})
                    connected = False
                    break
                cost += link['delayMs'] + flow['bytes'] * 8 / (link['rateMbps'] * 1000)
            if connected:
                optimum = reference['minimumLatencyMs']
                if optimum is None or abs(cost - optimum) > 1e-7 + 1e-8 * max(cost, optimum):
                    invalid.append({'flow': fid, 'reason': 'route is not minimum delay-plus-serialization', 'costMs': cost, 'minimumMs': optimum})
                tested += 1
        if seen != set(flow_map):
            invalid.append({'reason': 'not every submitted flow has a route record'})
        return self.tools.receipt('NETWORK_ROUTES', 'fail' if invalid else 'pass',
                                 'An independent shortest-path search checks enabled edge continuity, endpoints and delay-plus-serialization cost.',
                                 checked=tested, issues=invalid[:32])

    def run(self, envelope):
        nodes, links, flows, duration = self.stock(envelope.request)
        result = envelope.result
        if result.get('ok') is not True:
            return {'checks': [self.tools.receipt('NATIVE_TERMINAL', 'not-run', 'The discrete-event engine failed; no network events are fabricated.', diagnostics=result.get('diagnostics', []))],
                    'reference': {'supported': False, 'rows': []}, 'support': {'nativeSucceeded': False}}
        events = result.get('events')
        if not isinstance(events, list) or len(events) > 65536:
            raise self.tools.InvoiceError('network native event count exceeds 65536')
        references = {fid: self.path(flow, nodes, links) for fid, flow in flows.items()}
        checks = [self.route_checks(result.get('routes', []), flows, links, references)]
        terminals = {fid: {'delivered': set(), 'drop': set()} for fid in flows}
        sends, issues, first_send, final_time, lane_free = {}, [], {}, {}, {}
        ordered = []
        for event in events:
            if not isinstance(event, dict):
                raise self.tools.InvoiceError('network event must be an object')
            time = self.tools.amount(event.get('tMs'), 'event.tMs', 0, duration + 1e-7)
            fid, kind = str(event.get('flow', '')), event.get('kind')
            packet = str(event.get('packet', ''))
            if fid not in flows or kind not in ('send', 'arrive', 'drop', 'delivered') or not packet or len(packet) > 128:
                raise self.tools.InvoiceError('network event has unknown flow/kind/packet')
            ordered.append((time, fid, packet, kind, event))
        ordered.sort(key=lambda item: item[0])
        for time, fid, packet, kind, event in ordered:
            flow = flows[fid]
            source, target, edge = str(event.get('from', '')), str(event.get('to', '')), str(event.get('link', ''))
            key = (fid, packet)
            prefix = fid + ':'
            if not packet.startswith(prefix) or not packet[len(prefix):].isdigit():
                issues.append({'packet': packet, 'reason': 'packet id does not identify its submitted flow and sequence'})
                continue
            sequence = int(packet[len(prefix):])
            birth = flow['startMs'] + sequence * flow['intervalMs']
            if sequence >= flow['packets'] or time + 1e-6 < birth:
                issues.append({'packet': packet, 'reason': 'packet sequence or birth time is inconsistent'})
            if kind == 'send':
                link = links.get(edge)
                if not link or not link.get('enabled', True) or {link['a'], link['b']} != {source, target}:
                    issues.append({'packet': packet, 'reason': 'send uses an invalid edge'})
                    continue
                hop = (fid, packet, edge)
                if hop in sends:
                    issues.append({'packet': packet, 'reason': 'packet repeats the same route edge'})
                sends[hop] = time
                lane = (edge, source, target)
                if time + 1e-6 < lane_free.get(lane, 0):
                    issues.append({'packet': packet, 'reason': 'same-direction packets overlap a serialized FIFO link'})
                lane_free[lane] = time + flow['bytes'] * 8 / (link['rateMbps'] * 1000)
                if source == flow['source']:
                    first_send.setdefault(key, time)
            elif kind == 'arrive':
                link, sent = links.get(edge), sends.get((fid, packet, edge))
                if not link or sent is None:
                    issues.append({'packet': packet, 'reason': 'arrival has no preceding send'})
                    continue
                if {link['a'], link['b']} != {source, target}:
                    issues.append({'packet': packet, 'reason': 'arrival endpoints do not match link'})
                earliest = sent + link['delayMs'] + flow['bytes'] * 8 / (link['rateMbps'] * 1000)
                if time + 1e-6 < earliest:
                    issues.append({'packet': packet, 'reason': 'arrival violates propagation-plus-serialization delay', 'earliestMs': earliest, 'actualMs': time})
            elif kind in ('drop', 'delivered'):
                if packet in terminals[fid]['drop'] or packet in terminals[fid]['delivered']:
                    issues.append({'packet': packet, 'reason': 'packet has multiple terminal events'})
                terminals[fid][kind].add(packet)
                if kind == 'delivered':
                    if target and target != flow['target']:
                        issues.append({'packet': packet, 'reason': 'delivered event does not reach target'})
                    final_time[key] = time
        checks.append(self.tools.receipt('NETWORK_CAUSALITY', 'fail' if issues else 'pass',
                         'Actual native events are checked for enabled links, nonnegative horizon times, send-before-arrive and minimum link latency.',
                         nativeEvents=len(events), checkedSends=len(sends), issues=issues[:32]))
        native_flows = result.get('flows')
        if not isinstance(native_flows, list) or len(native_flows) > 16:
            raise self.tools.InvoiceError('native flow metrics must be an array of at most 16 records')
        by_flow = {str(flow.get('id', '')): flow for flow in native_flows}
        metric_issues, rows = [], []
        if len(by_flow) != len(native_flows) or set(by_flow) != set(flows):
            metric_issues.append({'reason': 'native flow metrics omit, duplicate or invent flow ids'})
        for fid, flow in flows.items():
            transmitted = flow['packets']
            injected = sum(flow['startMs'] + index * flow['intervalMs'] <= duration for index in range(flow['packets']))
            delivered, dropped = len(terminals[fid]['delivered']), len(terminals[fid]['drop'])
            pending = transmitted - delivered - dropped
            throughput = delivered * flow['bytes'] * 8 / (duration * 1000)
            observed = by_flow.get(fid, {})
            for name, expected in (('sent', transmitted), ('delivered', delivered), ('dropped', dropped), ('pending', pending)):
                if observed.get(name) != expected:
                    metric_issues.append({'flow': fid, 'metric': name, 'expected': expected, 'native': observed.get(name)})
            native_throughput = self.tools.amount(observed.get('throughputMbps', 0), fid + '.throughputMbps', 0, 1e6)
            if abs(native_throughput - throughput) > 1e-9 + 1e-6 * throughput:
                metric_issues.append({'flow': fid, 'metric': 'throughputMbps', 'expected': throughput, 'native': native_throughput})
            if pending < 0:
                metric_issues.append({'flow': fid, 'metric': 'terminal packet conservation', 'pending': pending})
            path = references[fid]
            native_latency = observed.get('avgLatencyMs')
            latencies = []
            for packet in terminals[fid]['delivered']:
                suffix = packet[len(fid) + 1:]
                if suffix.isdigit():
                    birth = flow['startMs'] + int(suffix) * flow['intervalMs']
                    latencies.append(final_time[(fid, packet)] - birth)
            average_latency = sum(latencies) / len(latencies) if latencies else None
            if delivered and path['minimumLatencyMs'] is not None and native_latency is not None:
                latency = self.tools.amount(native_latency, fid + '.avgLatencyMs', 0, duration)
                if latency + 1e-6 < path['minimumLatencyMs']:
                    metric_issues.append({'flow': fid, 'metric': 'avgLatencyMs below no-queue path bound', 'native': latency, 'minimum': path['minimumLatencyMs']})
                if average_latency is not None and abs(latency - average_latency) > 1e-7 + 1e-7 * average_latency:
                    metric_issues.append({'flow': fid, 'metric': 'avgLatencyMs differs from terminal times minus birth times', 'native': latency, 'independent': average_latency})
            if 'injected' in observed and observed['injected'] != injected:
                metric_issues.append({'flow': fid, 'metric': 'injected', 'native': observed['injected'], 'independent': injected})
            probability = math.prod(1 - links[edge]['loss'] for edge in path['links']) if path['nodes'] else 0.
            rows.append({'flow': fid, 'sent': transmitted, 'delivered': delivered, 'dropped': dropped, 'pending': pending,
                         'injected': injected, 'averageLatencyMs': average_latency,
                         'deliveryRatio': delivered / transmitted if transmitted else None, 'throughputMbps': throughput,
                         'noHorizonDeliveryProbability': probability,
                         'noQueueLatencyMs': path['minimumLatencyMs'], 'route': path['nodes']})
        checks.append(self.tools.receipt('NETWORK_PACKET_ACCOUNTING', 'fail' if metric_issues else 'pass',
                         'Planned packets equal delivered plus dropped plus pending; injected packets, terminal latencies and payload throughput are independently recounted.', issues=metric_issues[:32]))
        timeline, counts = [], {'send': 0, 'arrive': 0, 'drop': 0, 'delivered': 0}
        for index, (time, fid, packet, kind, event) in enumerate(ordered):
            counts[kind] += 1
            if index == len(ordered) - 1 or index % max(1, math.ceil(len(ordered) / 256)) == 0:
                timeline.append({'tMs': time, **counts})
        return {'checks': checks, 'reference': {'supported': True, 'model': 'static shortest-path / full-duplex FIFO packet model',
                    'rows': rows, 'paths': references, 'timeline': timeline,
                    'scope': 'Abstract store-and-forward packets, independent routes/counts/delay bounds; not RF propagation, 5G stack or physical device simulation.'},
                'support': {'nativeSucceeded': True, 'nodes': len(nodes), 'links': len(links), 'flows': len(flows),
                            'durationMs': duration, 'nativeEvents': len(events), 'maximumEvents': 65536}}
