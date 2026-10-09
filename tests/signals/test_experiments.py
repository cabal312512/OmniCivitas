import cmath
import copy
import importlib.util
import math
from pathlib import Path
import sys
import unittest


_path = Path(__file__).resolve().parents[2] / 'services' / 'fastapi' / 'desk' / 'aaa.py'
_spec = importlib.util.spec_from_file_location('ce3_acceptance', _path)
ce3 = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = ce3
_spec.loader.exec_module(ce3)


def c(number):
    return {'re': number.real, 'im': number.imag, 'magnitude': abs(number), 'phaseDeg': math.degrees(cmath.phase(number))}


def request(parts, **analysis):
    return {'schema': 'ocv.signals/1', 'op': 'circuit', 'ground': '0',
            'analysis': analysis, 'components': [{'id': name, 'type': typ, 'a': a, 'b': b, 'value': value}
                                               for name, typ, a, b, value in parts]}


def statuses(analysis):
    return {check['code']: check['status'] for check in analysis['checks']}


def crc8(bits):
    register = 0
    for offset in range(0, len(bits), 8):
        part = bits[offset:offset + 8]
        for bit in part:
            high = (register & 128) != 0
            register = (register << 1) & 255
            if high ^ (bit == '1'):
                register ^= 7
    return format(register, '08b')


class IndependentExperiments(unittest.TestCase):
    def test_published_divider_voltage_and_conservation(self):
        req = request([('v', 'V', 'in', '0', 12), ('r1', 'R', 'in', 'mid', 1000), ('r2', 'R', 'mid', '0', 2000)], kind='dc')
        result = {'ok': True, 'rows': [{'values': {'in': 12, 'mid': 8}, 'branches': {'v': -.004, 'r1': .004, 'r2': .004}}]}
        before = copy.deepcopy(result)
        analysis = ce3.analyze('circuit', req, result)
        self.assertEqual(analysis['verification'], 'verified')
        self.assertEqual(analysis['reference']['rows'][0]['value'], 8)
        self.assertEqual(statuses(analysis)['KVL_LOOPS'], 'pass')
        self.assertEqual(result, before)

    def test_bad_native_solution_is_retained_and_reported(self):
        req = request([('v', 'V', 'in', '0', 12), ('r1', 'R', 'in', 'mid', 1000), ('r2', 'R', 'mid', '0', 2000)], kind='dc')
        result = {'ok': True, 'rows': [{'values': {'in': 12, 'mid': 9}, 'branches': {'v': -.004, 'r1': .003, 'r2': .0045}}]}
        analysis = ce3.analyze('circuit', req, result)
        self.assertEqual(analysis['verification'], 'discrepancy')
        self.assertEqual(statuses(analysis)['ANALYTIC_REFERENCE'], 'fail')
        self.assertEqual(statuses(analysis)['KCL'], 'fail')
        self.assertFalse(analysis['nativeResultReplaced'])
        self.assertEqual(result['rows'][0]['values']['mid'], 9)

    def test_rc_ac_corner_is_minus_45_degrees(self):
        frequency = 1 / (2 * math.pi * .001)
        req = request([('v', 'V', 'in', '0', 1), ('r', 'R', 'in', 'mid', 1000), ('cap', 'C', 'mid', '0', .000001)], kind='ac', frequencyHz=frequency)
        current = complex(.0005, .0005)
        result = {'ok': True, 'rows': [{'frequencyHz': frequency, 'values': {'in': c(1 + 0j), 'mid': c(.5 - .5j)},
                                       'branches': {'v': c(-current), 'r': c(current), 'cap': c(current)}}]}
        analysis = ce3.analyze('circuit', req, result)
        reference = analysis['reference']['rows'][0]['value']
        self.assertAlmostEqual(reference['phaseDeg'], -45)
        self.assertAlmostEqual(reference['magnitude'], 1 / math.sqrt(2))
        self.assertEqual(analysis['verification'], 'verified')

    def test_rc_backward_euler_matches_independent_exponential_with_discretization_allowance(self):
        dt, voltage, rows = .0001, 0., []
        req = request([('v', 'V', 'in', '0', 1), ('r', 'R', 'in', 'mid', 1000), ('cap', 'C', 'mid', '0', .000001)],
                      kind='transient', stepS=dt, durationS=.004, method='backward-euler')
        for index in range(41):
            old = voltage
            if index:
                voltage = (voltage + dt / .001) / (1 + dt / .001)
            current = (1 - voltage) / 1000
            rows.append({'t': index * dt, 'values': {'in': 1, 'mid': voltage}, 'branches': {'v': -current, 'r': current, 'cap': current}})
        analysis = ce3.analyze('circuit', req, {'ok': True, 'rows': rows})
        self.assertEqual(analysis['reference']['model'], 'first-order RC')
        self.assertAlmostEqual(analysis['reference']['rows'][10]['value'], 1 - math.exp(-1))
        self.assertEqual(analysis['verification'], 'verified')
        self.assertEqual(statuses(analysis)['BACKWARD_EULER'], 'pass')

    def test_rl_reversed_inductor_terminal_uses_correct_current_orientation(self):
        dt, current, rows = .0001, 0., []
        req = request([('v', 'V', 'in', '0', 1), ('coil', 'L', 'mid', 'in', 1), ('r', 'R', 'mid', '0', 1000)],
                      kind='transient', stepS=dt, durationS=.004, method='backward-euler')
        for index in range(41):
            if index:
                current = (current + dt) / (1 + 1000 * dt)
            rows.append({'t': index * dt, 'values': {'in': 1, 'mid': current * 1000},
                         'branches': {'v': -current, 'r': current, 'coil': -current}})
        analysis = ce3.analyze('circuit', req, {'ok': True, 'rows': rows})
        self.assertEqual(analysis['reference']['model'], 'first-order RL')
        self.assertEqual(analysis['verification'], 'verified')

    def test_failed_native_solver_has_no_fabricated_reference(self):
        req = request([('v', 'V', 'in', '0', 1), ('r', 'R', 'floating', 'x', 1000)], kind='dc')
        analysis = ce3.analyze('circuit', req, {'ok': False, 'diagnostics': [{'code': 'FLOATING_NODE'}]})
        self.assertEqual(analysis['verification'], 'limited')
        self.assertEqual(analysis['reference']['rows'], [])
        self.assertEqual(statuses(analysis)['NATIVE_TERMINAL'], 'not-run')

    def test_crc8_known_check_value_and_noiseless_communication(self):
        bits = ''.join(format(ord(letter), '08b') for letter in '123456789')
        self.assertEqual(crc8(bits), '11110100')
        req = {'schema': 'ocv.signals/1', 'op': 'communications', 'bits': bits, 'seed': 1, 'ebN0Db': 0,
               'samplesPerSymbol': 8, 'sampleRateHz': 8000, 'crc': 'CRC-8', 'modulation': 'BPSK', 'noiseless': True}
        frame = bits + '11110100'
        result = {'ok': True, 'txBits': frame, 'rxBits': frame, 'decodedBits': bits, 'crcValid': True,
                  'bitErrors': 0, 'frameBitErrors': 0, 'ber': 0, 'summary': {'sigma': 0}}
        analysis = ce3.analyze('communication', req, result)
        self.assertAlmostEqual(analysis['reference']['theoreticalBER'], .07864960352514257)
        self.assertEqual(statuses(analysis)['CRC8_ENCODE'], 'pass')
        self.assertEqual(statuses(analysis)['NOISELESS_ROUNDTRIP'], 'pass')
        self.assertEqual(analysis['verification'], 'verified')

    def test_lying_error_count_is_detected(self):
        req = {'schema': 'ocv.signals/1', 'op': 'communications', 'bits': '01010101', 'seed': 11, 'ebN0Db': 0, 'samplesPerSymbol': 8}
        frame = req['bits'] + crc8(req['bits'])
        received = '1' + frame[1:]
        result = {'ok': True, 'txBits': frame, 'rxBits': received, 'decodedBits': received[:8], 'crcValid': False,
                  'bitErrors': 0, 'ber': 0, 'frameBitErrors': 1}
        analysis = ce3.analyze('communication', req, result)
        self.assertEqual(statuses(analysis)['ERROR_COUNTS'], 'fail')
        self.assertEqual(analysis['verification'], 'discrepancy')
        self.assertEqual(analysis['reference']['empiricalBER'], .125)

    def test_zero_errors_still_have_nonzero_upper_uncertainty(self):
        interval = ce3._communication.price(0, 100)
        self.assertEqual(interval[0], 0)
        self.assertAlmostEqual(interval[1], .03699349820698568)

    def test_sweep_plans_are_bounded_and_never_claim_execution(self):
        req = {'schema': 'ocv.signals/1', 'op': 'communications', 'bits': '01010101', 'seed': 4, 'ebN0Db': 0}
        plan = ce3.sweep_plan(req, [-4, 0, 4])
        self.assertFalse(plan['executed'])
        self.assertEqual(len(plan['requests']), 3)
        self.assertEqual(len({r['seed'] for r in plan['requests']}), 3)
        self.assertEqual(req['ebN0Db'], 0)
        with self.assertRaises(ce3.InvoiceError):
            ce3.sweep_plan(req, list(range(10)))

    def test_nonfinite_values_are_not_accepted_as_successful_results(self):
        req = request([('v', 'V', 'in', '0', 1)], kind='dc')
        with self.assertRaises(ce3.InvoiceError):
            ce3.analyze('circuit', req, {'ok': True, 'rows': [{'values': {'in': float('nan')}}]})


if __name__ == '__main__':
    unittest.main()
