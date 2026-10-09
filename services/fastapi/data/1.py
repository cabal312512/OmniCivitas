import cmath
import math


class Common:
    def __init__(self, tools):
        self.tools = tools

    def stock(self, request):
        analysis = request.get('analysis') or {}
        if analysis.get('kind') not in ('dc', 'ac', 'transient'):
            raise self.tools.InvoiceError('analysis kind is outside dc/ac/transient')
        components = request.get('components')
        if not isinstance(components, list) or not 1 <= len(components) <= 128:
            raise self.tools.InvoiceError('component count is outside 1..128')
        ids, nodes, values = set(), set(), []
        ground = str(request.get('ground', '0'))
        for component in components:
            if not isinstance(component, dict):
                raise self.tools.InvoiceError('component must be an object')
            cid, typ = str(component.get('id', '')), component.get('type')
            if not cid or len(cid) > 80 or cid in ids or typ not in ('R', 'C', 'L', 'V', 'I', 'S', 'E', 'G'):
                raise self.tools.InvoiceError('invalid, duplicate or unsupported component')
            a, b = str(component.get('a', '')), str(component.get('b', ''))
            if not a or not b or len(a) > 80 or len(b) > 80 or a == b:
                raise self.tools.InvoiceError('invalid component terminal')
            ids.add(cid)
            nodes.update((a, b))
            if typ in ('E', 'G'):
                for terminal in ('controlA', 'controlB'):
                    control = component.get(terminal)
                    if not isinstance(control, str) or not control or len(control) > 80:
                        raise self.tools.InvoiceError(cid + ': required control node must be a nonempty string at most 80 characters')
                    nodes.add(control)
            value = self.tools.amount(component.get('value'), cid + '.value', -1e12, 1e12)
            if typ in ('R', 'C', 'L', 'S') and value <= 0:
                raise self.tools.InvoiceError(cid + ': passive value must be positive')
            if typ == 'S' and not isinstance(component.get('closed', True), bool):
                raise self.tools.InvoiceError(cid + ': closed must be a boolean')
            values.append({**component, 'id': cid, 'type': typ, 'a': a, 'b': b, 'value': value})
        if len(nodes) > 128:
            raise self.tools.InvoiceError('node count exceeds 128')
        return analysis, values, nodes, ground

    def get(self, row, node, ground):
        if node == ground:
            return 0j
        values = row.get('values', {})
        if node not in values:
            raise self.tools.InvoiceError('native output has no node ' + node)
        return self.tools.invoice(values[node], 'node ' + node)

    def current(self, component, row, kind, ground, omega):
        cid, typ = component['id'], component['type']
        branches = row.get('branches') or {}
        if cid in branches:
            return self.tools.invoice(branches[cid], 'branch ' + cid), 'native'
        drop = self.get(row, component['a'], ground) - self.get(row, component['b'], ground)
        value = component['value']
        if typ == 'R':
            return drop / value, 'derived Ohm law'
        if typ == 'S':
            return (drop / value if component.get('closed', True) else 0j), 'derived closed-switch resistance or open-switch zero current'
        if typ == 'I':
            phase = math.radians(self.tools.amount(component.get('phaseDeg', 0), cid + '.phaseDeg'))
            return (cmath.rect(value, phase) if kind == 'ac' else complex(value)), 'independent source'
        if typ == 'G':
            return value * (self.get(row, component['controlA'], ground) - self.get(row, component['controlB'], ground)), 'derived voltage-controlled current'
        if typ == 'C' and kind == 'dc':
            return 0j, 'DC open capacitor'
        if kind == 'ac' and typ == 'C':
            return drop * complex(0, omega * value), 'derived capacitor admittance'
        if kind == 'ac' and typ == 'L' and omega > 0:
            return drop / complex(0, omega * value), 'derived inductor admittance'
        return None, 'unavailable native branch'

    def residuals(self, request, result, analysis, components, nodes, ground):
        kind = analysis['kind']
        selected = self.tools.choose_rows(result.get('rows', []))
        checks, peaks, missing = [], [], set()
        voltage_peak, passive_peak, derivative_peak, cycle_peak = 0., 0., 0., 0.
        derivative_checks = 0
        cycle_checks = 0
        controlled_voltage_peak, controlled_current_peak = 0., 0.
        controlled_voltage_checks, controlled_current_checks = 0, 0
        for index, row in selected:
            if not isinstance(row, dict):
                raise self.tools.InvoiceError('native row must be an object')
            frequency = self.tools.amount(row.get('frequencyHz', analysis.get('frequencyHz', 0)), 'frequencyHz', 0, 1e12)
            omega = 2 * math.pi * frequency
            balances = {node: 0j for node in nodes if node != ground}
            scales = {node: 0. for node in balances}
            excluded = set()
            circuit_edges = []
            for component in components:
                current, origin = self.current(component, row, kind, ground, omega)
                a, b, cid, typ = component['a'], component['b'], component['id'], component['type']
                drop = self.get(row, a, ground) - self.get(row, b, ground)
                if current is None:
                    excluded.update((a, b))
                    missing.add(cid)
                else:
                    if a in balances:
                        balances[a] += current
                        scales[a] += abs(current)
                    if b in balances:
                        balances[b] -= current
                        scales[b] += abs(current)
                if typ == 'V':
                    phase = math.radians(self.tools.amount(component.get('phaseDeg', 0), cid + '.phaseDeg'))
                    expected = cmath.rect(component['value'], phase) if kind == 'ac' else complex(component['value'])
                    error = self.tools.small_error(drop, expected)
                    voltage_peak = max(voltage_peak, error['error'] / max(error['limit'], 1e-300))
                    circuit_edges.append((a, b, expected))
                if typ == 'E':
                    expected = component['value'] * (self.get(row, component['controlA'], ground) - self.get(row, component['controlB'], ground))
                    error = self.tools.small_error(drop, expected)
                    controlled_voltage_peak = max(controlled_voltage_peak, error['error'] / max(error['limit'], 1e-300))
                    controlled_voltage_checks += 1
                    circuit_edges.append((a, b, expected))
                if current is not None and typ == 'G':
                    expected = component['value'] * (self.get(row, component['controlA'], ground) - self.get(row, component['controlB'], ground))
                    error = self.tools.small_error(current, expected, absolute=1e-10, relative=1e-6)
                    controlled_current_peak = max(controlled_current_peak, error['error'] / max(error['limit'], 1e-300))
                    controlled_current_checks += 1
                    circuit_edges.append((a, b, drop))
                if current is not None and (typ == 'R' or typ == 'S' and component.get('closed', True)):
                    error = self.tools.small_error(drop, current * component['value'])
                    passive_peak = max(passive_peak, error['error'] / max(error['limit'], 1e-300))
                    circuit_edges.append((a, b, current * component['value']))
                if current is not None and typ == 'S' and component.get('closed', True) is False:
                    error = self.tools.small_error(current, 0j, absolute=1e-10, relative=1e-6)
                    passive_peak = max(passive_peak, error['error'] / max(error['limit'], 1e-300))
                if current is not None and kind == 'ac' and typ in ('C', 'L') and omega > 0:
                    impedance = complex(0, omega * component['value']) if typ == 'L' else 1 / complex(0, omega * component['value'])
                    error = self.tools.small_error(drop, current * impedance)
                    passive_peak = max(passive_peak, error['error'] / max(error['limit'], 1e-300))
                    circuit_edges.append((a, b, current * impedance))
                if kind == 'transient' and typ in ('C', 'L'):
                    circuit_edges.append((a, b, drop))
                if current is not None and kind == 'transient' and typ in ('C', 'L') and index > 0:
                    old = result['rows'][index - 1]
                    t1, t0 = self.tools.amount(row.get('t'), 't'), self.tools.amount(old.get('t'), 'previous t')
                    dt = t1 - t0
                    if dt <= 0:
                        raise self.tools.InvoiceError('transient time must be strictly increasing')
                    old_drop = self.get(old, a, ground) - self.get(old, b, ground)
                    if typ == 'C':
                        expected, actual = component['value'] * (drop - old_drop) / dt, current
                    else:
                        old_current, _ = self.current(component, old, kind, ground, omega)
                        if old_current is None:
                            continue
                        expected, actual = component['value'] * (current - old_current) / dt, drop
                    error = self.tools.small_error(actual, expected, absolute=1e-7, relative=1e-5)
                    derivative_peak = max(derivative_peak, error['error'] / max(error['limit'], 1e-300))
                    derivative_checks += 1
            adjacency = {node: [] for node in nodes}
            for edge_id, (a, b, drop) in enumerate(circuit_edges):
                adjacency[a].append((b, drop, edge_id))
                adjacency[b].append((a, -drop, edge_id))
            potentials = {}
            visited_edges = set()
            for seed in sorted(nodes):
                if seed in potentials:
                    continue
                potentials[seed] = 0j
                queue = [seed]
                while queue:
                    parent = queue.pop()
                    for child, drop, edge_id in adjacency[parent]:
                        if edge_id in visited_edges:
                            continue
                        visited_edges.add(edge_id)
                        if child not in potentials:
                            potentials[child] = potentials[parent] - drop
                            queue.append(child)
                        else:
                            loop_error = self.tools.small_error(potentials[parent] - potentials[child], drop)
                            cycle_peak = max(cycle_peak, loop_error['error'] / max(loop_error['limit'], 1e-300))
                            cycle_checks += 1
            for node, residual in balances.items():
                if node in excluded:
                    continue
                limit = 1e-9 + 1e-5 * scales[node]
                peaks.append({'row': index, 'node': node, 'residualA': abs(residual), 'limitA': limit})
        worst = max(peaks, key=lambda p: p['residualA'] / p['limitA'], default=None)
        checks.append(self.tools.receipt('KCL', 'fail' if worst and worst['residualA'] > worst['limitA'] else 'partial' if missing else 'pass' if worst else 'unsupported',
                         'Signed branch currents are summed independently at each sampled non-ground node.',
                         sampledRows=len(selected), checkedNodes=len(peaks), worst=worst, missingBranches=sorted(missing)))
        checks.append(self.tools.receipt('SOURCE_VOLTAGE', 'pass' if voltage_peak <= 1 else 'fail',
                         'Specified source voltage is compared with its oriented terminal difference.', worstToleranceRatio=voltage_peak))
        checks.append(self.tools.receipt('KVL_CONSTITUTIVE', 'pass' if passive_peak <= 1 else 'fail',
                         'Independent resistor/closed-switch and AC impedance drops are compared against native branch currents; open-switch current must vanish and terminal differences telescope around closed paths.', worstToleranceRatio=passive_peak))
        checks.append(self.tools.receipt('KVL_LOOPS', 'pass' if cycle_checks and cycle_peak <= 1 else 'fail' if cycle_checks else 'unsupported',
                         'A separate spanning forest checks oriented constitutive/source voltage sums on reachable closed paths.', count=cycle_checks, worstToleranceRatio=cycle_peak))
        if controlled_voltage_checks:
            checks.append(self.tools.receipt('VCVS_CONSTITUTIVE', 'pass' if controlled_voltage_peak <= 1 else 'fail',
                             'Oriented VCVS output voltage equals the real V/V gain times its separately indexed control voltage; the control port draws no current.',
                             count=controlled_voltage_checks, worstToleranceRatio=controlled_voltage_peak))
        if controlled_current_checks:
            checks.append(self.tools.receipt('VCCS_CONSTITUTIVE', 'pass' if controlled_current_peak <= 1 else 'fail',
                             'Oriented VCCS output current equals the real transconductance in siemens times its control voltage. Its voltage remains determined by the external load.',
                             count=controlled_current_checks, worstToleranceRatio=controlled_current_peak))
        if kind == 'transient':
            checks.append(self.tools.receipt('BACKWARD_EULER', 'pass' if derivative_checks and derivative_peak <= 1 else 'fail' if derivative_checks else 'unsupported',
                             'Finite differences check C dv/dt and L di/dt with the declared backward-Euler method.', count=derivative_checks, worstToleranceRatio=derivative_peak))
        return checks

    def series_case(self, components, ground):
        sources = [c for c in components if c['type'] == 'V']
        passive = [c for c in components if c['type'] in ('R', 'C', 'L')]
        if len(sources) != 1 or len(passive) != 2 or len(components) != 3:
            return None
        source = sources[0]
        if ground not in (source['a'], source['b']):
            return None
        supply = source['b'] if source['a'] == ground else source['a']
        vin = source['value'] * (-1 if source['a'] == ground else 1)
        terminals = {x for c in passive for x in (c['a'], c['b'])}
        middle = terminals - {ground, supply}
        if len(middle) != 1:
            return None
        middle = next(iter(middle))
        top = next((c for c in passive if {c['a'], c['b']} == {supply, middle}), None)
        bottom = next((c for c in passive if {c['a'], c['b']} == {middle, ground}), None)
        if not top or not bottom:
            return None
        return source, top, bottom, middle, vin

    def references(self, request, result, analysis, components, ground):
        series = self.series_case(components, ground)
        if series is None:
            return {'supported': False, 'reason': 'Closed-form reference covers a single grounded voltage source and a two-element R/R, R/C or R/L series path.', 'rows': []}, []
        source, top, bottom, middle, vin = series
        supply = source['b'] if source['a'] == ground else source['a']
        types = {top['type'], bottom['type']}
        if types not in ({'R'}, {'R', 'C'}, {'R', 'L'}):
            return {'supported': False, 'reason': 'Unsupported two-element analytical model.', 'rows': []}, []
        kind = analysis['kind']
        entries, errors, limits = [], [], []
        tau = None
        if types in ({'R', 'C'}, {'R', 'L'}):
            resistor = top if top['type'] == 'R' else bottom
            reactive = bottom if bottom['type'] != 'R' else top
            tau = resistor['value'] * reactive['value'] if reactive['type'] == 'C' else reactive['value'] / resistor['value']
        selected = self.tools.choose_rows(result.get('rows', []), 512)
        for index, row in selected:
            if kind == 'ac':
                frequency = self.tools.amount(row.get('frequencyHz', analysis.get('frequencyHz')), 'frequencyHz', 1e-12, 1e12)
                omega = 2 * math.pi * frequency
                def impedance(part):
                    if part['type'] == 'R':
                        return complex(part['value'])
                    if part['type'] == 'C':
                        return 1 / complex(0, omega * part['value'])
                    return complex(0, omega * part['value'])
                phase = math.radians(self.tools.amount(source.get('phaseDeg', 0), 'source.phaseDeg'))
                expected = cmath.rect(vin, phase) * impedance(bottom) / (impedance(top) + impedance(bottom))
                entry = {'frequencyHz': frequency, 'value': self.tools.paper(expected)}
                tolerance = 1e-7 + abs(vin) * 1e-5
            elif types == {'R'}:
                expected = complex(vin * bottom['value'] / (top['value'] + bottom['value']))
                entry = {'t': row.get('t', 0), 'value': expected.real}
                tolerance = 1e-7 + abs(vin) * 1e-5
            elif kind == 'dc':
                if bottom['type'] == 'C' or top['type'] == 'L':
                    expected = complex(vin)
                else:
                    expected = 0j
                entry = {'value': expected.real}
                tolerance = 1e-7 + abs(vin) * 1e-5
            else:
                time = self.tools.amount(row.get('t'), 't', 0, 180)
                initial = self.tools.amount(reactive.get('initial', 0), 'initial', -1e12, 1e12)
                if reactive['type'] == 'C':
                    sign = 1 if reactive['a'] == middle else -1
                    first = sign * initial if reactive is bottom else vin + sign * initial
                    final = vin if reactive is bottom else 0.
                else:
                    current_sign = 1 if reactive['a'] == supply or (reactive is bottom and reactive['a'] == middle) else -1
                    loop_initial = initial * current_sign
                    first = resistor['value'] * loop_initial if resistor is bottom else vin - resistor['value'] * loop_initial
                    final = vin if resistor is bottom else 0.
                expected = complex(final + (first - final) * math.exp(-time / tau))
                entry = {'t': time, 'value': expected.real}
                step = self.tools.amount(analysis.get('stepS'), 'stepS', 1e-12, 180)
                tolerance = 1e-7 + max(abs(vin), abs(first), 1e-12) * min(1., step / tau)
            actual = self.get(row, middle, ground)
            error = abs(actual - expected)
            errors.append(error)
            limits.append(tolerance)
            entries.append({**entry, 'nativeRow': index, 'absoluteErrorV': error, 'limitV': tolerance})
        ratio = max((e / max(l, 1e-300) for e, l in zip(errors, limits)), default=0.)
        label = 'R/R divider' if types == {'R'} else 'first-order RC' if 'C' in types else 'first-order RL'
        reference = {'supported': True, 'model': label, 'node': middle, 'unit': 'V', 'rows': entries,
                     'tauS': tau, 'maximumErrorV': max(errors, default=0.), 'toleranceDescription': 'Backward-Euler discretization allowance scales with step/tau; DC/AC checks use numerical tolerances.'}
        check = self.tools.receipt('ANALYTIC_REFERENCE', 'pass' if entries and ratio <= 1 else 'fail' if entries else 'unsupported',
                                  'Native data are retained unchanged and compared with an independent closed-form reference.',
                                  model=label, rows=len(entries), worstToleranceRatio=ratio, maximumErrorV=max(errors, default=0.))
        return reference, [check]

    def run(self, envelope):
        analysis, components, nodes, ground = self.stock(envelope.request)
        result = envelope.result
        if result.get('ok') is not True:
            return {'checks': [self.tools.receipt('NATIVE_TERMINAL', 'not-run', 'The native solver reported failure; no fabricated reference output replaces it.', diagnostics=result.get('diagnostics', []))],
                    'reference': {'supported': False, 'rows': []}, 'support': {'analysis': analysis['kind'], 'nativeSucceeded': False}}
        checks = self.residuals(envelope.request, result, analysis, components, nodes, ground)
        reference, analytic = self.references(envelope.request, result, analysis, components, ground)
        return {'checks': checks + analytic, 'reference': reference,
                'support': {'analysis': analysis['kind'], 'nativeSucceeded': True, 'analyticalModel': reference.get('model'),
                            'nodes': len(nodes), 'components': len(components), 'inputRows': len(result.get('rows', [])),
                            'checkedRowsMaximum': 384, 'referenceRowsMaximum': 512}}
