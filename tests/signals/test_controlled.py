import copy
import importlib.util
import math
from pathlib import Path
import sys
import unittest


root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('ce3_controlled', root / 'services/fastapi/desk/aaa.py')
ce3 = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = ce3
spec.loader.exec_module(ce3)


def fixture(typ, gain):
    request = {'schema': 'ocv.signals/1', 'op': 'circuit', 'ground': '0', 'analysis': {'kind': 'dc'},
               'components': [{'id': 'v', 'type': 'V', 'a': 'in', 'b': '0', 'value': 3},
                              {'id': 'x', 'type': typ, 'a': 'out', 'b': '0', 'controlA': 'in', 'controlB': '0', 'value': gain},
                              {'id': 'r', 'type': 'R', 'a': 'out', 'b': '0', 'value': 1000}]}
    voltage = 3 * gain if typ == 'E' else -3 * gain * 1000
    current = -voltage / 1000 if typ == 'E' else gain * 3
    result = {'ok': True, 'rows': [{'values': {'0': 0, 'in': 3, 'out': voltage},
                                  'branches': {'v': 0, 'x': current, 'r': voltage / 1000}}]}
    return request, result


class ControlledSources(unittest.TestCase):
    def test_vcvs_gain_constitutive_kcl_kvl_without_invented_analytic_reference(self):
        request, result = fixture('E', 2)
        before = copy.deepcopy(result)
        analysis = ce3.analyze('circuit', request, result)
        self.assertEqual(analysis['verification'], 'verified')
        checks = {item['code']: item['status'] for item in analysis['checks']}
        self.assertEqual(checks['VCVS_CONSTITUTIVE'], 'pass')
        self.assertEqual(checks['KCL'], 'pass')
        self.assertEqual(checks['KVL_LOOPS'], 'pass')
        self.assertFalse(analysis['reference']['supported'])
        self.assertEqual(result, before)

    def test_vccs_ac_controls_complex_output_current_and_loaded_voltage(self):
        request, result = fixture('G', .001)
        request['analysis'] = {'kind': 'ac', 'frequencyHz': 1000}
        request['components'][0]['phaseDeg'] = 45
        row = result['rows'][0]
        row['frequencyHz'] = 1000
        row['values'] = {name: {'re': voltage / math.sqrt(2), 'im': voltage / math.sqrt(2)}
                         for name, voltage in row['values'].items()}
        row['branches'] = {name: {'re': current / math.sqrt(2), 'im': current / math.sqrt(2)}
                           for name, current in row['branches'].items()}
        analysis = ce3.analyze('circuit', request, result)
        self.assertEqual(analysis['verification'], 'verified')
        self.assertTrue(any(item['code'] == 'VCCS_CONSTITUTIVE' and item['status'] == 'pass' for item in analysis['checks']))

    def test_tampering_and_bad_controls_are_reported_without_replacing_result(self):
        for typ, gain, code in [('E', 2, 'VCVS_CONSTITUTIVE'), ('G', .001, 'VCCS_CONSTITUTIVE')]:
            request, result = fixture(typ, gain)
            if typ == 'E':
                result['rows'][0]['values']['out'] = 7
            else:
                result['rows'][0]['branches']['x'] = .005
            before = copy.deepcopy(result)
            analysis = ce3.analyze('circuit', request, result)
            self.assertEqual(analysis['verification'], 'discrepancy')
            self.assertFalse(analysis['nativeResultReplaced'])
            self.assertEqual(result, before)
            self.assertTrue(any(item['code'] == code and item['status'] == 'fail' for item in analysis['checks']))
        request, result = fixture('E', 2)
        del request['components'][1]['controlA']
        with self.assertRaises(ce3.InvoiceError):
            ce3.analyze('circuit', request, result)


if __name__ == '__main__':
    unittest.main()
