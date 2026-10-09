import math


class Config:
    def __init__(self, tools):
        self.tools = tools

    def get(self, bits, width=8, polynomial=0x07):
        state = 0
        for digit in bits:
            incoming = int(digit)
            feedback = ((state >> (width - 1)) & 1) ^ incoming
            state = (state << 1) & ((1 << width) - 1)
            if feedback:
                state ^= polynomial
        return state

    def stock(self, bits, label, maximum=65536):
        if not isinstance(bits, str) or not 1 <= len(bits) <= maximum or any(d not in '01' for d in bits):
            raise self.tools.InvoiceError(label + ' must be a nonempty binary string of at most ' + str(maximum) + ' bits')
        return bits

    def price(self, errors, samples, confidence_z=1.959963984540054):
        if samples <= 0:
            return [0., 1.]
        proportion = errors / samples
        z2 = confidence_z * confidence_z
        denominator = 1 + z2 / samples
        center = (proportion + z2 / (2 * samples)) / denominator
        radius = confidence_z * math.sqrt(proportion * (1 - proportion) / samples + z2 / (4 * samples * samples)) / denominator
        return [0. if errors == 0 else max(0., center - radius),
                1. if errors == samples else min(1., center + radius)]

    def record(self, request):
        bits = self.stock(request.get('bits', '1011001010110001'), 'bits', 32760)
        snr = self.tools.amount(request.get('ebN0Db', 8), 'ebN0Db', -30, 60)
        samples = self.tools.amount(request.get('samplesPerSymbol', 8), 'samplesPerSymbol', 2, 32)
        if int(samples) != samples:
            raise self.tools.InvoiceError('samplesPerSymbol must be an integer')
        seed = request.get('seed', 42)
        if isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 4294967295:
            raise self.tools.InvoiceError('seed must be an unsigned 32-bit integer')
        if request.get('crc', 'CRC-8') != 'CRC-8' or request.get('modulation', 'BPSK') != 'BPSK':
            raise self.tools.InvoiceError('CE3 first release supports CRC-8 and BPSK only')
        if (len(bits) + 8) * int(samples) > 262144:
            raise self.tools.InvoiceError('communication waveform would exceed 262144 samples')
        return bits, snr, int(samples), seed

    def run(self, envelope):
        request, result = envelope.request, envelope.result
        bits, snr, samples, seed = self.record(request)
        if result.get('ok') is not True:
            return {'checks': [self.tools.receipt('NATIVE_TERMINAL', 'not-run', 'The communication engine did not succeed; theoretical values do not substitute for native samples.', diagnostics=result.get('diagnostics', []))],
                    'reference': {'supported': False, 'rows': []}, 'support': {'nativeSucceeded': False, 'modulation': 'BPSK'}}
        expected_frame = bits + format(self.get(bits), '08b')
        tx = self.stock(result.get('txBits'), 'txBits', 65544)
        rx = self.stock(result.get('rxBits'), 'rxBits', 65544)
        if len(tx) != len(rx) or len(tx) != len(expected_frame):
            raise self.tools.InvoiceError('native transmit/receive frame lengths differ from payload plus CRC-8')
        decoded = rx[:len(bits)]
        errors = sum(a != b for a, b in zip(bits, decoded))
        frame_errors = sum(a != b for a, b in zip(tx, rx))
        crc_valid = int(rx[-8:], 2) == self.get(decoded)
        estimated = errors / len(bits)
        interval = self.price(errors, len(bits))
        linear = 10 ** (snr / 10)
        theoretical = 0.5 * math.erfc(math.sqrt(linear))
        sigma = 0. if request.get('noiseless') is True else math.sqrt(0.5 / linear)
        checks = [
            self.tools.receipt('CRC8_ENCODE', 'pass' if tx == expected_frame else 'fail',
                               'CRC-8/0x07, initial 0, no reflection/xorout, is independently recomputed from the submitted payload.', expectedFrame=expected_frame),
            self.tools.receipt('PAYLOAD_DECODE', 'pass' if result.get('decodedBits', decoded) == decoded else 'fail',
                               'Decoded payload must equal the received frame prefix.'),
            self.tools.receipt('CRC8_RECEIVE', 'pass' if result.get('crcValid') is crc_valid else 'fail',
                               'Reported CRC validity is checked against the received payload and trailer.', independentlyValid=crc_valid),
            self.tools.receipt('ERROR_COUNTS', 'pass' if result.get('bitErrors') == errors and abs(self.tools.amount(result.get('ber'), 'ber') - estimated) <= 1e-12 and result.get('frameBitErrors', frame_errors) == frame_errors else 'fail',
                               'Payload and whole-frame mismatches are independently counted.', payloadErrors=errors, frameErrors=frame_errors, samples=len(bits)),
        ]
        reported_interval = result.get('interval') or result.get('wilsonInterval') or result.get('wilson')
        if isinstance(reported_interval, dict):
            reported_interval = [reported_interval.get('low', reported_interval.get('lower')), reported_interval.get('high', reported_interval.get('upper'))]
        if reported_interval is not None:
            if not isinstance(reported_interval, list) or len(reported_interval) != 2:
                raise self.tools.InvoiceError('native BER interval must contain two bounds')
            difference = max(abs(self.tools.amount(a, 'interval') - b) for a, b in zip(reported_interval, interval))
            checks.append(self.tools.receipt('BER_INTERVAL', 'pass' if difference <= 1e-7 else 'fail',
                           'The 95% Wilson interval is independently recomputed for payload BER.', maximumDifference=difference))
        metadata = result.get('summary') or result.get('metadata') or {}
        if 'sigma' in metadata:
            tolerance = self.tools.small_error(self.tools.amount(metadata['sigma'], 'sigma'), sigma, 1e-12, 1e-9)
            checks.append(self.tools.receipt('BPSK_NOISE_MODEL', 'pass' if tolerance['passed'] else 'fail',
                           'Unit-energy BPSK uses matched-filter Gaussian standard deviation sqrt(N0/2).', expectedSigma=sigma, **tolerance))
        if request.get('noiseless') is True:
            checks.append(self.tools.receipt('NOISELESS_ROUNDTRIP', 'pass' if errors == 0 and crc_valid else 'fail',
                           'The explicit noiseless experiment must preserve every payload bit and CRC.'))
        else:
            expected_errors = len(bits) * theoretical
            variance = len(bits) * theoretical * (1 - theoretical)
            deviation = abs(errors - expected_errors)
            severe = deviation > max(8., 6 * math.sqrt(variance))
            checks.append(self.tools.receipt('BPSK_FINITE_SAMPLE', 'warning' if severe else 'consistent',
                           'A finite noisy realization is compared with coherent BPSK/AWGN theory; deviation is statistical evidence, not a solver failure.',
                           expectedErrors=expected_errors, standardDeviation=math.sqrt(variance), observedErrors=errors,
                           theoryInside95Interval=interval[0] <= theoretical <= interval[1]))
        theoretical_rows = []
        for value in (-8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12):
            theoretical_rows.append({'ebN0Db': value, 'ber': 0.5 * math.erfc(math.sqrt(10 ** (value / 10)))})
        return {'checks': checks,
                'reference': {'supported': True, 'model': 'coherent binary antipodal signaling in AWGN', 'formula': 'BER = 0.5 erfc(sqrt(Eb/N0))',
                              'theoreticalBER': theoretical, 'operativeTheoreticalBER': 0. if request.get('noiseless') is True else theoretical,
                              'noiseDisabled': request.get('noiseless') is True, 'empiricalBER': estimated, 'interval95': interval,
                              'sigma': sigma, 'payloadBits': len(bits), 'frameBits': len(expected_frame), 'rows': theoretical_rows,
                              'warning': 'The theoretical curve is a population model; empirical points and uncertainty require actual native runs.'},
                'support': {'nativeSucceeded': True, 'modulation': 'BPSK', 'crc': 'CRC-8', 'seed': seed,
                            'sampleRateHz': self.tools.amount(request.get('sampleRateHz', 8000), 'sampleRateHz', 1, 1e9),
                            'samplesPerSymbol': samples, 'ebN0Db': snr}}

    def plan(self, request, levels):
        self.record(request)
        if not isinstance(levels, list) or not 1 <= len(levels) <= 9:
            raise self.tools.InvoiceError('SNR sweep requires 1..9 levels')
        seed = request.get('seed', 42)
        jobs = []
        for index, level in enumerate(levels):
            snr = self.tools.amount(level, 'SNR level', -30, 60)
            jobs.append({**request, 'ebN0Db': snr, 'seed': (seed + index * 2654435761) & 0xffffffff})
        return {'schema': 'ocv.signals/sweep-plan/1', 'executed': False, 'requests': jobs,
                'limits': {'cases': 9, 'waveformSamplesPerCase': 262144, 'serialExecutionRequired': True},
                'message': 'These are requests for the native Rust worker, not simulated sweep results.'}
