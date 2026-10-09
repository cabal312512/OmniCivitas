class Gate:
    def __init__(self, tools):
        self.tools = tools

    def reference(self, request):
        source, gates = request['inputs'], request['gates']
        if not isinstance(source, dict) or not isinstance(gates, list) or any(not isinstance(value, bool) or not isinstance(wire, str) or not wire or len(wire) > 96 or wire == 'clock' for wire, value in source.items()):
            raise self.tools.InvoiceError('Invalid digital source')
        names = set(source) | {'clock'}
        for gate in gates:
            if not isinstance(gate, dict) or not isinstance(gate.get('id'), str) or not gate['id'] or len(gate['id']) > 96 or gate['id'] in names or gate.get('type') not in ('AND', 'NAND', 'OR', 'NOR', 'XOR', 'NOT', 'BUFFER', 'DFF', 'JKFF') or not isinstance(gate.get('inputs'), list) or not 1 <= len(gate['inputs']) <= 8:
                raise self.tools.InvoiceError('Invalid digital gate')
            if gate['type'] in ('NOT', 'BUFFER', 'DFF') and len(gate['inputs']) != 1 or gate['type'] == 'JKFF' and len(gate['inputs']) != 2 or 'initial' in gate and not isinstance(gate['initial'], bool):
                raise self.tools.InvoiceError('Invalid gate pins or initial state')
            names.add(gate['id'])
        if any(not isinstance(pin, str) or pin not in names for gate in gates for pin in gate['inputs']):
            raise self.tools.InvoiceError('Unknown wire')
        patterns = request.get('patterns', {})
        if not isinstance(patterns, dict) or any(wire not in source or not isinstance(pattern, str) or not 1 <= len(pattern) <= 4096 or any(bit not in '01' for bit in pattern) for wire, pattern in patterns.items()):
            raise self.tools.InvoiceError('Invalid cyclic input pattern')
        ticks, period = request.get('ticks', 32), request.get('clockPeriodTicks', 8)
        dt = self.tools.amount(request.get('tickS', .001), 'tickS', 1e-9, 1)
        if isinstance(ticks, bool) or not isinstance(ticks, int) or not 1 <= ticks <= 4096 or isinstance(period, bool) or not isinstance(period, int) or not 2 <= period <= 4096 or len(source) > 64 or len(gates) > 128 or (len(source) + len(gates) + 1) * ticks > 32768:
            raise self.tools.InvoiceError('Digital resource limit')
        state = dict(source, clock=False)
        registers = [gate for gate in gates if gate['type'] in ('DFF', 'JKFF')]
        for gate in registers:
            state[gate['id']] = gate.get('initial', False)
        pending = [gate for gate in gates if gate not in registers]
        order, known = [], set(state)
        while pending:
            ready = [gate for gate in pending if all(pin in known for pin in gate['inputs'])]
            if not ready:
                raise self.tools.InvoiceError('Combinational cycle or unknown wire')
            for gate in ready:
                known.add(gate['id'])
                order.append(gate)
            pending = [gate for gate in pending if gate not in ready]

        def settle():
            for gate in order:
                v = [state[pin] for pin in gate['inputs']]
                kind = gate['type']
                operations = {'AND': lambda: all(v), 'NAND': lambda: not all(v), 'OR': lambda: any(v), 'NOR': lambda: not any(v), 'XOR': lambda: sum(v) % 2 == 1, 'NOT': lambda: not v[0], 'BUFFER': lambda: v[0]}
                state[gate['id']] = operations[kind]()

        trace, events, previous_clock = [], [], False
        for tick in range(ticks):
            before = dict(state)
            for wire, pattern in request.get('patterns', {}).items():
                state[wire] = pattern[tick % len(pattern)] == '1'
            clock = tick % period >= period // 2
            state['clock'] = clock
            settle()
            if clock and not previous_clock:
                sampled = {}
                for gate in registers:
                    pins, kind = gate['inputs'], gate['type']
                    if kind == 'DFF':
                        sampled[gate['id']] = state[pins[0]]
                    else:
                        j, k, old = state[pins[0]], state[pins[1]], state[gate['id']]
                        sampled[gate['id']] = not old if j and k else bool(j) if j or k else old
                state.update(sampled)
                settle()
            for wire in sorted(state):
                if before.get(wire) != state[wire]:
                    cause = 'clock' if wire == 'clock' else 'input' if wire in source else 'rising-edge register' if any(g['id'] == wire for g in registers) else 'combinational settle'
                    events.append({'tick': tick, 't': tick * dt, 'wire': wire, 'from': before.get(wire), 'to': state[wire], 'cause': cause})
            previous_clock = clock
            trace.append({'tick': tick, 't': tick * dt, 'values': dict(state)})
        return trace, events

    def run(self, envelope):
        if envelope.result.get('ok') is not True:
            return {'checks': [self.tools.receipt('NATIVE_TERMINAL', 'not-run', 'Digital native execution failed.')], 'reference': {'supported': False}}
        trace, events = self.reference(envelope.request)
        actual = envelope.result
        checks = [self.tools.receipt('DIGITAL_TRACE', 'pass' if actual.get('trace') == trace else 'fail', 'Independent simultaneous rising-edge register updates, sampled input schedules and topological settling.', checkedTicks=len(trace)),
                  self.tools.receipt('DIGITAL_EVENTS', 'pass' if actual.get('events') == events else 'fail', 'Independent change events including origin, time and cause.', checkedEvents=len(events)),
                  self.tools.receipt('DIGITAL_WIRES', 'pass' if actual.get('wires') == sorted(trace[-1]['values']) else 'fail', 'Wire inventory includes source, clock and all gate outputs.')]
        return {'checks': checks, 'reference': {'supported': True, 'rows': trace, 'events': events, 'model': 'ideal synchronous DFF/JKFF; no propagation delay, setup/hold or metastability'}, 'support': {'nativeSucceeded': True, 'traceCells': sum(len(row['values']) for row in trace)}}
