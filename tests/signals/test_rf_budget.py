import copy
import importlib.util
import math
from pathlib import Path
import sys
import unittest


root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('ce3_rf_acceptance', root / 'services/fastapi/desk/aaa.py')
ce3 = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = ce3
spec.loader.exec_module(ce3)


def radio():
    return {'frequencyMHz': 1000., 'distanceKm': 1., 'txPowerDbm': 30., 'txGainDbi': 12.,
            'rxGainDbi': 12., 'lossDb': 3., 'bandwidthHz': 1e6, 'bitRateBps': 250000.,
            'noiseFigureDb': 5., 'requiredEbN0Db': 10.}


def native_fixture():
    bits = '10100110'
    frame = bits + format(ce3._communication.get(bits), '08b')
    reference = ce3._radio.reference(radio())
    result = {'ok': True, 'txBits': frame, 'rxBits': frame, 'decodedBits': bits, 'crcValid': True,
              'bitErrors': 0, 'frameBitErrors': 0, 'ber': 0,
              'linkBudget': {'model': 'free-space LOS / 290 K', **reference,
                             'channelCoupled': False, 'geometryDerived': False}}
    return {'schema': 'ocv.signals/1', 'op': 'communications', 'bits': bits, 'noiseless': True, 'rf': radio()}, result


class LinkBudgetExperiments(unittest.TestCase):
    def test_published_scale_power_noise_and_fresnel(self):
        budget = ce3._radio.reference(radio())
        self.assertAlmostEqual(budget['freeSpaceLossDb'], 92.44778322188337, places=10)
        self.assertAlmostEqual(budget['noiseDensityDbmHz'], -173.97518719422808, places=10)
        self.assertEqual(budget['eirpDbm'], 42)
        self.assertAlmostEqual(budget['receivedDbm'], 51 - budget['freeSpaceLossDb'])
        self.assertAlmostEqual(budget['noiseDbm'] - budget['thermalNoiseDbm'], 5)
        self.assertAlmostEqual(budget['ebN0Db'] - budget['snrDb'], 10 * math.log10(4))
        self.assertAlmostEqual(budget['marginDb'], budget['ebN0Db'] - 10)
        self.assertAlmostEqual(budget['fresnelRadiusM'], math.sqrt(.299792458 * 1000 / 4))
        doubled = radio()
        doubled['distanceKm'] *= 2
        self.assertAlmostEqual(ce3._radio.reference(doubled)['freeSpaceLossDb'] - budget['freeSpaceLossDb'], 20 * math.log10(2))

    def test_independent_check_reports_tampering_without_replacing_native(self):
        request, result = native_fixture()
        original = copy.deepcopy(result)
        valid = ce3.analyze('communication', request, result)
        self.assertEqual(valid['verification'], 'verified')
        self.assertEqual(result, original)
        result['linkBudget']['capacityBps'] *= 2
        changed = ce3.analyze('communication', request, result)
        self.assertEqual(changed['verification'], 'discrepancy')
        self.assertFalse(changed['nativeResultReplaced'])
        self.assertEqual(result['linkBudget']['capacityBps'], original['linkBudget']['capacityBps'] * 2)
        self.assertTrue(any(row['code'] == 'RF_LINK_BUDGET' and row['status'] == 'fail' for row in changed['checks']))

    def test_required_numeric_bounded_fields_and_no_native_substitution(self):
        for key, value in [('distanceKm', 0), ('txPowerDbm', 101), ('frequencyMHz', float('inf')),
                           ('noiseFigureDb', True), ('bandwidthHz', '1000'), ('typo', 1)]:
            invalid = radio()
            invalid[key] = value
            with self.assertRaises(ce3.InvoiceError):
                ce3._radio.record({'rf': invalid})
        missing = radio()
        del missing['rxGainDbi']
        with self.assertRaises(ce3.InvoiceError):
            ce3._radio.record({'rf': missing})
        request, result = native_fixture()
        result = {'ok': False, 'diagnostics': [{'code': 'RF_LIMIT'}]}
        analysis = ce3.analyze('communication', request, result)
        self.assertFalse(analysis['reference']['supported'])
        self.assertNotIn('linkBudget', analysis['reference'])


if __name__ == '__main__':
    unittest.main()
