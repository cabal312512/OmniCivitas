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


tools = module('phase14_sh3_scan_tools', 'config/4/7.py')
stock = module('phase14_sh3_scan_stock', 'pinia/unused2/old.py')


def fixture():
    request = {'schema': 'ocv.workshop-run/1', 'op': 'scan',
               'scan': {'parameter': 'gravityY', 'targetId': '', 'values': [-9.81], 'trials': 2}}
    runs = []
    for index, ok in enumerate([True, False]):
        duration = .02 if ok else .01
        summary = {'complete': ok, 'maxSpeed': 2., 'durationS': duration, 'collisions': 0,
                   'challengeComplete': ok, 'completionTime': .02 if ok else None}
        runs.append({'index': index, 'valueIndex': 0, 'value': -9.8100004196167, 'trial': index, 'ok': ok,
                     'summary': summary, 'diagnostics': [] if ok else [{'code': 'STATE_LIMIT', 'message': 'Retained failure'}],
                     'traceBody': 'ball', 'trace': [{'t': 0., 'x': 0., 'y': 0., 'omega': 0.},
                                                  {'t': duration, 'x': 0., 'y': -.01, 'omega': 0.}]})
    result = {'schema': 'ocv.workshop-result/1', 'ok': False,
              'summary': {'complete': False, 'runCount': 2, 'successfulRuns': 1, 'failedRuns': 1,
                          'challengeCompletions': 1, 'successRate': .5},
              'scan': {'parameter': 'gravityY', 'targetId': '', 'complete': False, 'runs': runs,
                       'valueSummary': [{'valueIndex': 0, 'value': -9.8100004196167, 'trials': 2,
                                         'computed': 1, 'failed': 1, 'challengeCompletions': 1,
                                         'challengeSuccessRate': .5, 'meanCompletionTimeS': .02}]}}
    return {'kind': 'mechanical', 'request': request, 'result': result}


class PartialScanInspection(unittest.TestCase):
    def test_complete_partial_record_is_accepted_without_changing_native_failure(self):
        source = fixture()
        original = copy.deepcopy(source)
        self.assertEqual(tools.Common2().config(source), original)
        receipt = stock.Config(tools).delete(source, {})
        self.assertEqual(source, original)
        self.assertTrue(receipt.metadata['partial'])
        self.assertFalse(receipt.metadata['nativeSucceeded'])
        self.assertEqual(receipt.metadata['failedRuns'], 1)
        self.assertEqual(receipt.metadata['successfulRuns'], 1)
        self.assertEqual(receipt.metadata['sourceOutcomes'][1]['diagnostics'][0]['code'], 'STATE_LIMIT')

    def test_failed_channels_stay_diagnostic_not_successful_solution_or_challenge(self):
        receipt = stock.Config(tools).delete(fixture(), {})
        success = [row for row in receipt.rows if row[0] == 0]
        failed = [row for row in receipt.rows if row[0] == 1]
        self.assertTrue(any(row[4] == 'maxSpeed' for row in success))
        self.assertFalse(any(row[4] in ('maxSpeed', 'durationS', 'collisions', 'challengeComplete') for row in failed))
        self.assertTrue(any(row[4] == 'diagnostic.maxSpeed' and row[6] == 'm/s' for row in failed))
        self.assertTrue(all('diagnostic only' in row[7] for row in failed))
        self.assertEqual(next(row[5] for row in failed if row[4] == 'numericalSuccess'), 0)

    def test_all_failed_scan_still_has_explicit_observation_and_outcome_cells(self):
        source = fixture()
        good = source['result']['scan']['runs'][0]
        good['ok'] = good['summary']['complete'] = good['summary']['challengeComplete'] = False
        good['summary']['completionTime'] = None
        good['diagnostics'] = [{'code': 'STATE_LIMIT'}]
        source['result']['summary'].update(successfulRuns=0, failedRuns=2, challengeCompletions=0, successRate=0.)
        source['result']['scan']['valueSummary'][0].update(computed=0, failed=2, challengeCompletions=0,
                                                        challengeSuccessRate=0., meanCompletionTimeS=None)
        receipt = stock.Config(tools).delete(source, {})
        self.assertEqual(receipt.metadata['failedRuns'], 2)
        self.assertTrue(receipt.rows)
        self.assertTrue(all(row[4] == 'numericalSuccess' or row[4].startswith('diagnostic.') for row in receipt.rows))

    def test_truncated_rows_disguised_outcomes_and_fabricated_aggregates_are_rejected(self):
        mutations = [lambda s: s['result']['scan']['runs'].pop(),
                     lambda s: s['result']['scan']['runs'][1].update(ok=0),
                     lambda s: s['result']['scan']['runs'][1].update(index=0),
                     lambda s: s['result']['scan']['runs'][1].update(diagnostics=[]),
                     lambda s: s['result']['summary'].update(failedRuns=0),
                     lambda s: s['result']['scan']['valueSummary'][0].update(computed=2),
                     lambda s: s['result']['scan']['valueSummary'][0].update(meanCompletionTimeS=.01),
                     lambda s: s['result']['scan']['runs'][1]['trace'][1].update(t=.9)]
        for mutation in mutations:
            with self.subTest(mutation=mutation):
                source = fixture()
                mutation(source)
                with self.assertRaises(tools.StockError):
                    tools.Common2().config(source)

    def test_other_failed_native_models_are_not_admitted(self):
        for kind, op, schema in [('mechanical', 'simulate', 'ocv.workshop-result/1'),
                                 ('digital', 'digital', 'ocv.signals/1'), ('circuit', 'circuit', 'ocv.signals/1')]:
            source = fixture()
            source['kind'], source['request']['op'], source['result']['schema'] = kind, op, schema
            with self.assertRaises(tools.StockError):
                tools.Common2().config(source)


if __name__ == '__main__':
    unittest.main()
