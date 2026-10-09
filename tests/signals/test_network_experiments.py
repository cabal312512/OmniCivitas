import copy
import importlib.util
from pathlib import Path
import sys
import unittest


_file = Path(__file__).resolve().parents[2] / 'services' / 'fastapi' / 'desk' / 'aaa.py'
_spec = importlib.util.spec_from_file_location('network_ce3_acceptance', _file)
ce3 = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = ce3
_spec.loader.exec_module(ce3)


def fixture():
    request = {'schema': 'ocv.signals/1', 'op': 'network', 'nodes': [{'id': 'a'}, {'id': 'b'}],
               'links': [{'id': 'line', 'a': 'a', 'b': 'b', 'rateMbps': 1, 'delayMs': 10, 'loss': 0, 'enabled': True}],
               'flows': [{'id': 'f', 'source': 'a', 'target': 'b', 'packets': 2, 'bytes': 1000, 'startMs': 0, 'intervalMs': 0}],
               'seed': 7, 'durationMs': 100}
    events = []
    for sequence, start, arrival in [(0, 0, 18), (1, 8, 26)]:
        common = {'packet': 'f:' + str(sequence), 'flow': 'f', 'from': 'a', 'to': 'b', 'link': 'line'}
        events += [{**common, 'tMs': start, 'kind': 'send'}, {**common, 'tMs': arrival, 'kind': 'arrive'},
                   {**common, 'tMs': arrival, 'kind': 'delivered'}]
    result = {'ok': True, 'events': sorted(events, key=lambda e: e['tMs']), 'routes': [{'flow': 'f', 'nodes': ['a', 'b'], 'links': ['line']}],
              'flows': [{'id': 'f', 'sent': 2, 'injected': 2, 'delivered': 2, 'dropped': 0, 'pending': 0, 'late': 0,
                         'avgLatencyMs': 22, 'throughputMbps': .16}]}
    return request, result


class NetworkReferences(unittest.TestCase):
    def test_one_megabit_fifo_has_18_then_26_ms_arrivals(self):
        request, result = fixture()
        report = ce3.analyze('network', request, result)
        self.assertEqual(report['verification'], 'verified')
        reference = report['reference']['rows'][0]
        self.assertEqual(reference['noQueueLatencyMs'], 18)
        self.assertEqual(reference['averageLatencyMs'], 22)
        self.assertEqual(reference['throughputMbps'], .16)

    def test_simultaneous_same_direction_packets_violate_bandwidth(self):
        request, result = fixture()
        result['events'][1]['tMs'] = 0
        report = ce3.analyze('network', request, result)
        self.assertEqual(report['verification'], 'discrepancy')
        check = next(c for c in report['checks'] if c['code'] == 'NETWORK_CAUSALITY')
        self.assertEqual(check['status'], 'fail')

    def test_horizon_pending_includes_future_scheduled_packets(self):
        request, result = fixture()
        request['flows'][0]['intervalMs'] = 1000
        result['events'] = [event for event in result['events'] if event['packet'] == 'f:0']
        result['flows'][0].update({'injected': 1, 'delivered': 1, 'pending': 1, 'late': 1, 'avgLatencyMs': 18, 'throughputMbps': .08})
        report = ce3.analyze('network', request, result)
        self.assertEqual(report['verification'], 'verified')
        self.assertEqual(report['reference']['rows'][0]['pending'], 1)

    def test_disabled_link_is_an_honest_unreachable_route(self):
        request, result = fixture()
        request['links'][0]['enabled'] = False
        result['routes'][0].update({'nodes': [], 'links': []})
        result['events'] = [{'kind': 'drop', 'tMs': 0, 'flow': 'f', 'packet': 'f:' + str(i), 'from': 'a', 'to': '', 'link': '', 'reason': 'unreachable'} for i in range(2)]
        result['flows'][0].update({'delivered': 0, 'dropped': 2, 'avgLatencyMs': 0, 'throughputMbps': 0})
        report = ce3.analyze('network', request, result)
        self.assertEqual(report['verification'], 'verified')
        self.assertIsNone(report['reference']['rows'][0]['noQueueLatencyMs'])


if __name__ == '__main__':
    unittest.main()
