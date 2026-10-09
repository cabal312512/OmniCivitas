import csv
import io
import math


class InvoiceBuilder:
    def __init__(self, tools):
        self.tools = tools

    def choose(self, count, cells_per_sample, reserved=0):
        maximum = max(1, (self.tools.LIMITS['normalizedCells'] - reserved) // max(1, cells_per_sample))
        if count <= maximum:
            return list(range(count))
        if maximum == 1:
            return [0]
        return sorted({round(index * (count - 1) / (maximum - 1)) for index in range(maximum)})

    def delivery(self, kind, rows, count, indexes, **metadata):
        return self.tools.Common2().receipt(kind, rows, {
            'originalSamples': count,
            'selectedSamples': len(indexes),
            'sampled': len(indexes) < count,
            'samplingPolicy': 'deterministic evenly spaced source indices, including endpoints; no interpolation',
            'selectedIndices': indexes if len(indexes) <= 1024 else {'first': indexes[:8], 'last': indexes[-8:], 'count': len(indexes)},
            'numericalAuthority': 'the submitted source output; shared analysis is derived inspection',
            **metadata,
        })


class Config(InvoiceBuilder):
    def delete(self, source, options):
        kind = source['kind']
        match kind:
            case 'mechanical':
                return self.assembly(source)
            case 'circuit':
                return self.circuit(source)
            case 'network':
                return self.network(source)
            case 'communication':
                return self.communication(source)
            case 'digital':
                return self.digital(source)
            case 'music':
                return self.music(source)
            case 'table':
                return self.table(source, options)
        raise self.tools.StockError('The receipt contains an unsupported kind')

    def assembly(self, source):
        result = source['result']
        if result.get('schema') != 'ocv.workshop-result/1':
            raise self.tools.StockError('Mechanical analysis requires ocv.workshop-result/1')
        if isinstance(result.get('scan'), dict):
            return self.scan(source)
        frames = self.tools.array(result.get('frames'), 'mechanical frames', 256, 1)
        quantities = {'x': 'm', 'y': 'm', 'angle': 'rad', 'vx': 'm/s', 'vy': 'm/s', 'omega': 'rad/s'}
        bodies = sorted({self.tools.word(body.get('id'), 'body id') for frame in frames
                         for body in self.tools.array(frame.get('bodies'), 'frame bodies', 64)})
        indexes = self.choose(len(frames), max(1, len(bodies)) * (len(quantities) + 1))
        rows = []
        for index in indexes:
            frame = self.tools.dictionary(frames[index], 'frame')
            when = self.tools.amount(frame.get('t'), 'frame time', 0, 1e6)
            seen = set()
            for body in frame['bodies']:
                body = self.tools.dictionary(body, 'frame body')
                identity = self.tools.word(body.get('id'), 'body id')
                if identity in seen:
                    raise self.tools.StockError('A frame contains a duplicate body')
                seen.add(identity)
                for quantity, unit in quantities.items():
                    value = self.tools.amount(body.get(quantity), 'body ' + quantity)
                    rows.append((index, when, 's', identity, quantity, value, unit, ''))
                speed = math.hypot(body['vx'], body['vy'])
                rows.append((index, when, 's', identity, 'speed', speed, 'm/s', ''))
        return self.delivery('mechanical', rows, len(frames), indexes,
                             engine=result.get('engine'), version=result.get('version'),
                             sourceSchema=result['schema'], sourceSummary=result.get('summary', {}),
                             derivations={'speed': 'Euclidean norm of actual vx,vy; other channels are source cells'})

    def scan(self, source):
        result = source['result']
        outcomes = self.tools.scan_outcomes(source)
        runs = self.tools.array(result['scan'].get('runs'), 'mechanical scan runs', 96, 1)
        rows = []
        for index, run in enumerate(runs):
            run = self.tools.dictionary(run, 'scan run')
            axis = self.tools.amount(run.get('value'), 'scan value')
            entity = 'trial-' + str(self.tools.amount(run.get('trial'), 'scan trial', 0, 128, True))
            summary = self.tools.dictionary(run.get('summary'), 'scan summary')
            label = 'completed numerical trial' if run['ok'] else 'retained failed trial; diagnostic only'
            rows.append((index, axis, 'parameter', entity, 'numericalSuccess', int(run['ok']), 'boolean', label))
            for field, unit in [('maxSpeed', 'm/s'), ('durationS', 's'), ('collisions', 'count')]:
                if summary.get(field) is not None:
                    quantity = field if run['ok'] else 'diagnostic.' + field
                    rows.append((index, axis, 'parameter', entity, quantity, self.tools.amount(summary[field], field), unit, label))
            if run['ok']:
                rows.append((index, axis, 'parameter', entity, 'challengeComplete', int(summary['challengeComplete']), 'boolean', label))
        return self.delivery('mechanical', rows, len(runs), list(range(len(runs))),
                             operation='scan', parameter=result['scan'].get('parameter'),
                             sourceSummary=result.get('summary', {}),
                             **outcomes, valueSummary=result['scan']['valueSummary'],
                             sourceOutcomes=[{'index': run['index'], 'valueIndex': run['valueIndex'], 'trial': run['trial'],
                                              'ok': run['ok'], 'diagnostics': run['diagnostics'], 'traceBody': run['traceBody'],
                                              'retainedTracePoints': len(run['trace'])} for run in runs],
                             scope='complete indexed scan record; numericalSuccess is an outcome flag; diagnostic.* channels retain failed-trial observations and never certify a successful physical solution',
                             parameterUnit='not inferred from the numeric parameter')

    def circuit(self, source):
        result = source['result']
        if result.get('schema') != 'ocv.signals/1':
            raise self.tools.StockError('Circuit analysis requires ocv.signals/1')
        samples = self.tools.array(result.get('rows'), 'circuit rows', 262144, 1)
        first = self.tools.dictionary(samples[0], 'circuit sample')
        node_ids = sorted(self.tools.dictionary(first.get('values'), 'node values'))
        branch_ids = sorted(self.tools.dictionary(first.get('branches', {}), 'branch currents'))
        catalog = [('node:' + identity, 'values', identity, 'voltage', 'V') for identity in node_ids]
        catalog += [('branch:' + identity, 'branches', identity, 'current', 'A') for identity in branch_ids]
        selected = catalog[:self.tools.LIMITS['entities']]
        complex_values = any(isinstance(first[field].get(identity), dict) for _, field, identity, _, _ in selected)
        cells = max(1, len(selected)) * (4 if complex_values else 1)
        indexes = self.choose(len(samples), cells)
        rows = []
        axis_unit = 'Hz' if 'frequencyHz' in first else 's' if 't' in first else 'row'
        for index in indexes:
            sample = self.tools.dictionary(samples[index], 'circuit sample')
            axis = sample.get('frequencyHz', sample.get('t', index))
            axis = self.tools.amount(axis, 'circuit axis', 0, 1e15)
            for entity, field, identity, quantity, unit in selected:
                value = self.tools.dictionary(sample.get(field, {}), field).get(identity)
                if isinstance(value, dict):
                    for part, part_unit in [('re', unit), ('im', unit), ('magnitude', unit), ('phaseDeg', 'deg')]:
                        rows.append((index, axis, axis_unit, entity, quantity + '.' + part,
                                     self.tools.amount(value.get(part), 'phasor ' + part), part_unit, ''))
                else:
                    rows.append((index, axis, axis_unit, entity, quantity, self.tools.amount(value, quantity), unit, ''))
        return self.delivery('circuit', rows, len(samples), indexes,
                             engine=result.get('engine'), sourceSchema=result['schema'],
                             sourceSummary=result.get('summary', {}), originalEntities=len(catalog),
                             selectedEntities=len(selected), entitiesClipped=len(catalog) != len(selected),
                             entityPolicy='sorted node identifiers followed by sorted branch identifiers')

    def communication(self, source):
        result = source['result']
        waveform = self.tools.array(result.get('waveform'), 'communication waveform', 262144, 1)
        indexes = self.choose(len(waveform), 3)
        rows = []
        for index in indexes:
            point = self.tools.dictionary(waveform[index], 'waveform sample')
            axis = self.tools.amount(point.get('t'), 'sample time', 0, 1e15)
            for quantity in ('tx', 'rx', 'q'):
                rows.append((index, axis, 's', 'baseband', quantity,
                             self.tools.amount(point.get(quantity), quantity), 'normalized amplitude', ''))
        return self.delivery('communication', rows, len(waveform), indexes,
                             engine=result.get('engine'), sourceSummary=result.get('summary', {}),
                             bitErrors=result.get('bitErrors'), ber=result.get('ber'),
                             scope='inspection of existing sample cells; no new modulation, DSP or physical channel model')

    def digital(self, source):
        result, request = source['result'], source.get('request', {})
        if result.get('schema') != 'ocv.signals/1' or request.get('op') != 'digital':
            raise self.tools.StockError('Digital inspection requires the actual CE2 digital request/result')
        samples = self.tools.array(result.get('trace'), 'digital trace', 4096, 1)
        wires = self.tools.array(result.get('wires'), 'digital wires', 193, 1)
        wires = [self.tools.word(wire, 'digital wire', 96) for wire in wires]
        if len(set(wires)) != len(wires) or len(wires) * len(samples) > 32768:
            raise self.tools.StockError('Digital wire/tick cells exceed the source model limit')
        summary = self.tools.dictionary(result.get('summary'), 'digital summary')
        tick_s = self.tools.amount(summary.get('tickS'), 'digital tick duration', 1e-9, 1)
        ticks = self.tools.amount(summary.get('ticks'), 'digital ticks', 1, 4096, True)
        if ticks != len(samples):
            raise self.tools.StockError('Digital trace length differs from its source summary')
        selected = sorted(wires)[:self.tools.LIMITS['entities']]
        indexes = self.choose(len(samples), len(selected))
        rows, known, previous = [], set(wires), -1.
        for index, sample in enumerate(samples):
            sample = self.tools.dictionary(sample, 'digital sample')
            tick = self.tools.amount(sample.get('tick'), 'digital tick', 0, 4095, True)
            when = self.tools.amount(sample.get('t'), 'digital sample time', 0, 4096)
            values = self.tools.dictionary(sample.get('values'), 'digital values')
            if tick != index or when <= previous or abs(when - tick * tick_s) > max(1e-12, tick_s * 1e-7):
                raise self.tools.StockError('Digital trace does not preserve its actual ordered sample clock')
            if set(values) != known or any(not isinstance(value, bool) for value in values.values()):
                raise self.tools.StockError('Digital source cells must be complete JSON boolean wire states')
            previous = when
        for index in indexes:
            sample = samples[index]
            for wire in selected:
                rows.append((index, sample['t'], 's', wire, 'logicLevel', int(sample['values'][wire]), 'boolean', 'ideal sampled logic'))
        return self.delivery('digital', rows, len(samples), indexes,
                             engine=result.get('engine'), version=result.get('version'),
                             sourceSchema=result['schema'], sourceSummary=summary,
                             originalEntities=len(wires), selectedEntities=len(selected),
                             entitiesClipped=len(wires) != len(selected),
                             entityPolicy='sorted actual wire identifiers; any clipped wires remain in native data',
                             logicalValueEncoding='JSON false/true represented as numeric 0/1 solely for generic statistics',
                             axisMeaning='captured tick time in seconds; no interpolated or analog voltage samples',
                             scope='derived inspection of successful native boolean trace; no new logical simulation or electrical model')

    def network(self, source):
        result, request = source['result'], source.get('request', {})
        events = self.tools.array(result.get('events'), 'network events', 65536)
        flows = self.tools.array(result.get('flows'), 'network flow results', 16)
        request_flows = {row['id']: row for row in self.tools.array(request.get('flows', []), 'request flows', 16)
                         if isinstance(row, dict) and isinstance(row.get('id'), str)}
        indexes = self.choose(len(events), 2, 512)
        rows, known = [], set()
        for index in indexes:
            event = self.tools.dictionary(events[index], 'event')
            kind = self.tools.word(event.get('kind'), 'event kind', 32)
            if kind not in ('send', 'arrive', 'drop', 'delivered'):
                raise self.tools.StockError('Unsupported network event kind')
            when = self.tools.amount(event.get('tMs'), 'event time', 0, 1e15)
            flow = self.tools.word(event.get('flow'), 'flow id')
            rows.append((index, when, 'ms', flow, 'events.' + kind, 1, 'count', ''))
            packet = event.get('packet')
            spec = request_flows.get(flow)
            if kind == 'delivered' and isinstance(packet, str) and spec is not None:
                prefix, separator, suffix = packet.rpartition(':')
                if separator and prefix == flow and suffix.isdecimal() and packet not in known:
                    born = self.tools.amount(spec.get('startMs', 0), 'flow start')
                    born += int(suffix) * self.tools.amount(spec.get('intervalMs', 0), 'flow interval', 0, 1e15)
                    if when < born:
                        raise self.tools.StockError('A delivered event precedes configured packet injection')
                    rows.append((index, when, 'ms', flow, 'packetLatency', when - born, 'ms', ''))
                    known.add(packet)
        duration = self.tools.amount(result.get('summary', {}).get('durationMs', request.get('durationMs', 0)), 'observation horizon', 0, 1e15)
        for index, flow in enumerate(flows):
            flow = self.tools.dictionary(flow, 'flow result')
            identity = self.tools.word(flow.get('id'), 'flow id')
            for field in ('sent', 'injected', 'delivered', 'dropped', 'pending', 'avgLatencyMs', 'throughputMbps'):
                if flow.get(field) is not None:
                    unit = 'ms' if field == 'avgLatencyMs' else 'Mbps' if field == 'throughputMbps' else 'count'
                    rows.append((len(events) + index, duration, 'ms', identity, 'flow.' + field,
                                 self.tools.amount(flow[field], field, 0), unit, ''))
        return self.delivery('network', rows, len(events), indexes,
                             sourceSummary=result.get('summary', {}), reconstructedDeliveredLatencies=len(known),
                             latencyScope='only delivered packets with a matching frozen flow request; no pending/drop latency invented',
                             eventCountsSampled=len(indexes) < len(events))

    def music(self, source):
        notes = self.tools.array(source.get('notes'), 'submitted notes', 256, 1)
        rows, previous = [], None
        for index, note in enumerate(notes):
            note = self.tools.dictionary(note, 'note')
            axis = self.tools.amount(note.get('t'), 'note time', 0, 600000)
            pitch = self.tools.amount(note.get('n'), 'MIDI note', 48, 96, True)
            duration = self.tools.amount(note.get('d'), 'note duration', 40, 4000)
            velocity = self.tools.amount(note.get('v'), 'note velocity', .05, 1)
            for quantity, value, unit in [('pitch', pitch, 'MIDI note'), ('duration', duration, 'ms'), ('velocity', velocity, 'normalized')]:
                rows.append((index, axis, 'ms', 'take', quantity, value, unit, ''))
            if previous is not None:
                rows.append((index, axis, 'ms', 'take', 'onsetDifference', axis - previous, 'ms', ''))
            previous = axis
        return self.delivery('music', rows, len(notes), list(range(len(notes))), submitted=True,
                             scope='submitted MIDI-note parameters only; no audio synthesis, DSP or media collection',
                             onsetOrder='the submitted note order; negative differences are preserved')

    def table(self, source, options):
        columns = self.tools.array(source.get('columns'), 'table columns', 32, 1)
        specs, names = [], set()
        for column in columns:
            column = self.tools.dictionary(column, 'column')
            if set(column) - {'name', 'unit', 'numeric'}:
                raise self.tools.StockError('Unknown table column metadata')
            name = self.tools.word(column.get('name'), 'column name')
            if not self.tools.NAME.fullmatch(name) or name in names:
                raise self.tools.StockError('Table column identifiers must be unique supported names')
            names.add(name)
            numeric = column.get('numeric', True)
            if not isinstance(numeric, bool):
                raise self.tools.StockError('Column numeric flag must be boolean')
            specs.append((name, self.tools.word(column.get('unit', 'unspecified'), 'column unit'), numeric))
        format_name = source.get('format', 'json')
        if format_name == 'csv':
            if not isinstance(source.get('csv'), str) or len(source['csv'].encode('utf8')) > self.tools.LIMITS['envelopeBytes']:
                raise self.tools.StockError('Submitted CSV must be a bounded string')
            if 'rows' in source:
                raise self.tools.StockError('Submit CSV or JSON rows, not both')
            reader = csv.DictReader(io.StringIO(source['csv'], newline=''))
            if reader.fieldnames is None or set(reader.fieldnames) != names or len(reader.fieldnames) != len(names):
                raise self.tools.StockError('CSV header must match the explicit column metadata')
            records = []
            for row in reader:
                if len(records) == 32768:
                    raise self.tools.StockError('Submitted table exceeds 32768 source rows')
                if None in row or any(value is None for value in row.values()):
                    raise self.tools.StockError('CSV row width does not match its header')
                records.append(row)
        elif format_name == 'json':
            records = self.tools.array(source.get('rows'), 'table rows', 32768, 1)
        else:
            raise self.tools.StockError('Only explicit JSON-row and CSV table formats are supported')
        numeric_columns = [row for row in specs if row[2]]
        if not numeric_columns:
            raise self.tools.StockError('Table analysis requires a numeric column')
        for field in ('entityField', 'axisField'):
            if options.get(field) is not None and options[field] not in names:
                raise self.tools.StockError(field + ' is absent from the table metadata')
        if options.get('axisField') and options['axisField'] not in {row[0] for row in numeric_columns}:
            raise self.tools.StockError('axisField must be a numeric column')
        indexes = self.choose(len(records), len(numeric_columns))
        rows, missing = [], 0
        for index in indexes:
            record = self.tools.dictionary(records[index], 'table row')
            if set(record) - names:
                raise self.tools.StockError('A table row contains undeclared columns')
            entity = str(record.get(options['entityField'], 'table')) if options.get('entityField') else 'table'
            entity = self.tools.word(entity, 'row entity', 128)
            axis = index
            axis_unit = 'row'
            if options.get('axisField'):
                value = record.get(options['axisField'])
                try:
                    axis = float(value) if format_name == 'csv' else value
                except (ValueError, TypeError, OverflowError):
                    raise self.tools.StockError('CSV axis column must be numeric') from None
                axis_unit = next(unit for name, unit, _ in specs if name == options['axisField'])
            axis = self.tools.amount(axis, 'table axis', -1e15, 1e15)
            for quantity, unit, _ in numeric_columns:
                value = record.get(quantity)
                if value is None or value == '' and format_name == 'csv':
                    missing += 1
                    continue
                try:
                    value = float(value) if format_name == 'csv' else value
                except (ValueError, TypeError, OverflowError):
                    raise self.tools.StockError('CSV numeric column contains a non-number') from None
                rows.append((index, axis, axis_unit, entity, quantity,
                             self.tools.amount(value, 'table cell'), unit, ''))
        return self.delivery('table', rows, len(records), indexes, submitted=True,
                             sourceFormat=format_name, columns=columns, missingNumericCells=missing,
                             missingPolicy='null/empty CSV numeric cells are excluded; other invalid values reject the submission')
