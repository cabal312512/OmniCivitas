import copy
import importlib.util
from pathlib import Path
import sys
import unittest

spec = importlib.util.spec_from_file_location('phase14_ce3', Path(__file__).resolve().parents[2] / 'services/fastapi/desk/aaa.py')
ce3 = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = ce3
spec.loader.exec_module(ce3)


class Reference14(unittest.TestCase):
    def test_crc16_known_check(self):
        bits = ''.join(format(byte, '08b') for byte in b'123456789')
        self.assertEqual(ce3._communication.get(bits, 16, 0x1021, 0xffff), 0x29b1)

    def test_population_models_differ(self):
        self.assertAlmostEqual(ce3._communication.theory('BPSK', 0), .07864960352514257)
        self.assertAlmostEqual(ce3._communication.theory('QPSK', 0), .07864960352514257)
        self.assertAlmostEqual(ce3._communication.theory('BFSK', 0), .3032653298563167)

    def test_digital_simultaneous_sampling_and_tamper_detection(self):
        request = {'schema': 'ocv.signals/1', 'op': 'digital', 'inputs': {'one': True}, 'gates': [{'id': 'q', 'type': 'JKFF', 'inputs': ['one', 'one']}, {'id': 'd', 'type': 'DFF', 'inputs': ['q']}], 'ticks': 12, 'clockPeriodTicks': 4, 'tickS': .001}
        trace, events = ce3._digital.reference(request)
        self.assertEqual((trace[2]['values']['q'], trace[2]['values']['d']), (True, False))
        self.assertEqual((trace[6]['values']['q'], trace[6]['values']['d']), (False, True))
        native = {'ok': True, 'trace': trace, 'events': events, 'wires': sorted(trace[-1]['values'])}
        self.assertEqual(ce3.analyze('digital', request, native)['verification'], 'verified')
        bad = copy.deepcopy(native)
        bad['trace'][2]['values']['d'] = True
        self.assertEqual(ce3.analyze('digital', request, bad)['verification'], 'discrepancy')
        self.assertFalse(native['trace'][2]['values']['d'])

    def test_real_engine_result_inputs_are_readonly(self):
        request = {'schema': 'ocv.signals/1', 'op': 'communications', 'bits': '10101', 'modulation': 'QPSK', 'crc': 'CRC-16', 'lineCode': 'Manchester', 'seed': 17, 'ebN0Db': 8, 'samplesPerSymbol': 8, 'sampleRateHz': 8000, 'noiseless': True}
        frame = request['bits'] + format(ce3._communication.get(request['bits'], 16, 0x1021, 0xffff), '016b')
        native = {'ok': True, 'txBits': frame, 'rxBits': frame, 'decodedBits': request['bits'], 'crcValid': True, 'bitErrors': 0, 'frameBitErrors': 0, 'ber': 0}
        before = copy.deepcopy(native)
        report = ce3.analyze('communication', request, native)
        self.assertEqual(report['verification'], 'verified')
        self.assertFalse(report['reference']['idealTheoryApplicable'])
        self.assertIsNone(report['reference']['theoreticalBER'])
        self.assertEqual(native, before)

    def test_boundaries_and_cycles(self):
        with self.assertRaises(ce3.InvoiceError):
            ce3._digital.reference({'inputs': {}, 'gates': [{'id': 'x', 'type': 'NOT', 'inputs': ['x']}], 'ticks': 8})
        with self.assertRaises(ce3.InvoiceError):
            ce3._communication.record({'bits': '1' * 4096, 'lineCode': 'Manchester', 'samplesPerSymbol': 32})
        with self.assertRaises(ce3.InvoiceError):
            ce3._communication.record({'modulation': 'BFSK', 'samplesPerSymbol': 2})


if __name__ == '__main__':
    unittest.main()
