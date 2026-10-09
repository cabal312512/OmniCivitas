import copy
import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]


def module(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    value = importlib.util.module_from_spec(spec)
    sys.modules[name] = value
    spec.loader.exec_module(value)
    return value


tools = module('phase14_sh3_digital_tools', 'config/4/7.py')
stock = module('phase14_sh3_digital_stock', 'pinia/unused2/old.py')
paper = module('phase14_sh3_digital_paper', 'config/4/old2.py')


def fixture():
    request = {'schema': 'ocv.signals/1', 'op': 'digital', 'inputs': {'d': False},
               'gates': [], 'ticks': 4, 'clockPeriodTicks': 2, 'tickS': .01}
    result = {'schema': 'ocv.signals/1', 'ok': True, 'engine': 'fixture/CE2', 'version': 'fixture',
              'wires': ['clock', 'd'], 'summary': {'ticks': 4, 'tickS': .01},
              'trace': [{'tick': index, 't': index * .01, 'values': {'clock': bool(index % 2), 'd': index >= 2}}
                        for index in range(4)]}
    return {'kind': 'digital', 'request': request, 'result': result}


class DigitalSharedInspection(unittest.TestCase):
    def test_config_accepts_distinct_digital_kind_not_circuit(self):
        accepted = tools.Common2().config(fixture())
        self.assertEqual(accepted['kind'], 'digital')
        self.assertIn('digital', tools.KINDS)

    def test_actual_boolean_trace_normalizes_as_seconds_and_boolean_without_mutation(self):
        source = fixture()
        before = copy.deepcopy(source)
        normalized = stock.Config(tools).delete(source, {})
        self.assertEqual(source, before)
        self.assertEqual(normalized.kind, 'digital')
        self.assertEqual(len(normalized.rows), 8)
        self.assertEqual(normalized.metadata['axisUnits'], ['s'])
        self.assertEqual(normalized.metadata['quantities'], ['logicLevel'])
        self.assertFalse(normalized.metadata['sampled'])
        cells = {(row[0], row[3]): row for row in normalized.rows}
        self.assertEqual(cells[(0, 'clock')][5:7], (0, 'boolean'))
        self.assertEqual(cells[(1, 'clock')][5:7], (1, 'boolean'))
        self.assertEqual(cells[(2, 'd')][1], .02)
        self.assertEqual(cells[(2, 'd')][5:7], (1, 'boolean'))
        self.assertNotIn('voltage', normalized.metadata['quantities'])

    def test_missing_nonboolean_or_inconsistent_clock_data_is_rejected(self):
        invalid = []
        numeric = fixture()
        numeric['result']['trace'][0]['values']['d'] = 0
        invalid.append(numeric)
        absent = fixture()
        del absent['result']['trace'][0]['values']['d']
        invalid.append(absent)
        clock = fixture()
        clock['result']['trace'][2]['t'] = .021
        invalid.append(clock)
        duplicate = fixture()
        duplicate['result']['wires'].append('d')
        invalid.append(duplicate)
        analog = fixture()
        analog['request']['op'] = 'circuit'
        invalid.append(analog)
        for source in invalid:
            with self.assertRaises(tools.StockError):
                stock.Config(tools).delete(source, {})

    def test_boolean_svg_uses_sample_hold_steps_and_explicit_boolean_units(self):
        lane = {'entity': 'clock', 'quantity': 'logicLevel', 'unit': 'boolean', 'axisUnit': 's',
                'points': [(0., 0., 0.), (.01, 1., 1.), (.02, 0., 0.)],
                'rollingSamples': 1, 'selectedPoints': 3, 'count': 3}
        svg = paper.Config(tools).line([lane])
        self.assertIn('[boolean]', svg)
        self.assertIn('H', svg)
        self.assertIn('V', svg)
        self.assertNotIn('L', svg.split('stroke="#3278cb"')[0].rsplit('<path d="', 1)[-1])

    def test_failed_native_result_does_not_become_a_successful_shared_dataset(self):
        source = fixture()
        source['result']['ok'] = False
        with self.assertRaises(tools.StockError):
            tools.Common2().config(source)


if __name__ == '__main__':
    unittest.main()
