import math


class Common:
    def __init__(self, tools):
        self.tools = tools

    def record(self, request):
        radio = request.get('rf')
        limits = {
            'frequencyMHz': (1, 1e6), 'distanceKm': (.001, 1e7),
            'txPowerDbm': (-100, 100), 'txGainDbi': (-50, 100), 'rxGainDbi': (-50, 100),
            'lossDb': (0, 200), 'bandwidthHz': (1, 1e12), 'bitRateBps': (1, 1e12),
            'noiseFigureDb': (0, 100), 'requiredEbN0Db': (-20, 60),
        }
        if not isinstance(radio, dict) or set(radio) != set(limits):
            raise self.tools.InvoiceError('rf requires exactly the ten documented link-budget fields')
        values = {}
        for name, (lower, upper) in limits.items():
            if isinstance(radio[name], bool) or not isinstance(radio[name], (int, float)):
                raise self.tools.InvoiceError('rf.' + name + ' must be a numeric JSON value')
            values[name] = self.tools.amount(radio[name], 'rf.' + name, lower, upper)
        return values

    def reference(self, radio):
        # Independent logarithmic-unit evaluation, rather than reading any engine intermediate.
        c, k, temperature = 299792458., 1.380649e-23, 290.
        free_space = (20 * math.log10(radio['frequencyMHz']) + 20 * math.log10(radio['distanceKm'])
                      + 20 * math.log10(4 * math.pi * 1e9 / c))
        eirp = radio['txPowerDbm'] + radio['txGainDbi']
        received = eirp + radio['rxGainDbi'] - free_space - radio['lossDb']
        density = 10 * math.log10(k) + 10 * math.log10(temperature) + 30
        thermal = density + 10 * math.log10(radio['bandwidthHz'])
        noise = thermal + radio['noiseFigureDb']
        snr = received - noise
        eb = snr + 10 * (math.log10(radio['bandwidthHz']) - math.log10(radio['bitRateBps']))
        wavelength = c / (radio['frequencyMHz'] * 1e6)
        return {
            'freeSpaceLossDb': free_space, 'eirpDbm': eirp, 'receivedDbm': received,
            'noiseDensityDbmHz': density, 'thermalNoiseDbm': thermal, 'noiseDbm': noise,
            'snrDb': snr, 'ebN0Db': eb, 'marginDb': eb - radio['requiredEbN0Db'],
            'capacityBps': radio['bandwidthHz'] * math.log1p(10 ** (snr / 10)) / math.log(2),
            'fresnelRadiusM': math.sqrt(wavelength * radio['distanceKm'] * 250),
            'wavelengthM': wavelength, 'temperatureK': temperature,
        }

    def run(self, envelope, calculation):
        radio = self.record(envelope.request)
        if envelope.result.get('ok') is not True:
            return
        expected = self.reference(radio)
        reported = envelope.result.get('linkBudget')
        if not isinstance(reported, dict):
            calculation['checks'].append(self.tools.receipt(
                'RF_BUDGET_PRESENT', 'fail', 'The requested optional native RF budget is absent.'))
        else:
            errors = {}
            for name, value in expected.items():
                actual = reported.get(name)
                if isinstance(actual, bool) or not isinstance(actual, (int, float)) or not math.isfinite(actual):
                    errors[name] = {'passed': False, 'reason': 'Missing/nonfinite numeric native budget field.'}
                else:
                    errors[name] = self.tools.small_error(actual, value, 1e-8, 1e-9)
            calculation['checks'].append(self.tools.receipt(
                'RF_LINK_BUDGET', 'pass' if all(row['passed'] for row in errors.values()) else 'fail',
                'Exact-c free-space loss, 290 K thermal noise, Eb/N0, Shannon upper capacity and midpoint Fresnel radius are independently recomputed.',
                fields=errors))
            scope = (reported.get('model') == 'free-space LOS / 290 K'
                     and reported.get('channelCoupled') is False and reported.get('geometryDerived') is False)
            calculation['checks'].append(self.tools.receipt(
                'RF_MODEL_SCOPE', 'pass' if scope else 'fail',
                'The optional ideal LOS budget does not derive distance from topology or replace the explicitly selected AWGN Eb/N0.'))
        calculation['reference']['linkBudget'] = {
            'model': 'free-space LOS / 290 K', **expected,
            'channelCoupled': False, 'geometryDerived': False,
            'warning': 'Ideal far-field LOS and paraxial midpoint Fresnel approximation; no terrain, obstruction, antenna-aperture, weather or automatic AWGN coupling.',
        }
