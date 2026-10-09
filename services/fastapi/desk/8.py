import math


class Config:
    def __init__(self, tools, inherited):
        self.tools, self.inherited = tools, inherited

    def price(self, errors, samples, confidence_z=1.959963984540054):
        return self.inherited.price(errors, samples, confidence_z)

    def stock(self, bits, label, maximum=65536):
        return self.inherited.stock(bits, label, maximum)

    def get(self, bits, width=8, polynomial=7, initial=0):
        register = initial
        for bit in bits:
            high = ((register >> (width - 1)) & 1) ^ int(bit)
            register = (register << 1) & ((1 << width) - 1)
            if high:
                register ^= polynomial
        return register

    def record(self, request):
        bits = self.inherited.stock(request.get('bits', '1011001010110001'), 'bits', 32760)
        mode, code, crc = request.get('modulation', 'BPSK'), request.get('lineCode', 'NRZ'), request.get('crc', 'CRC-8')
        if mode not in ('BPSK', 'QPSK', 'BFSK') or code not in ('NRZ', 'Manchester') or crc not in ('CRC-8', 'CRC-16'):
            raise self.tools.InvoiceError('Unsupported modulation, code or CRC')
        snr = self.tools.amount(request.get('ebN0Db', 8), 'Eb/N0', -30, 60)
        sps = self.tools.amount(request.get('samplesPerSymbol', 8), 'oversampling', 4 if mode == 'BFSK' else 2, 32)
        seed = request.get('seed', 42)
        if int(sps) != sps or isinstance(seed, bool) or not isinstance(seed, int) or not 0 <= seed <= 4294967295:
            raise self.tools.InvoiceError('Integer oversampling and uint32 seed required')
        fs = self.tools.amount(request.get('sampleRateHz', 8000), 'sample rate', 1, 1e9)
        timing = self.tools.amount(request.get('timingOffsetSymbols', 0), 'timing offset', -.45, .45)
        frequency = self.tools.amount(request.get('frequencyOffsetHz', 0), 'frequency offset', -.25 * fs / sps, .25 * fs / sps)
        width = 16 if crc == 'CRC-16' else 8
        chips = (len(bits) + width) * (2 if code == 'Manchester' else 1)
        symbols = math.ceil(chips / (2 if mode == 'QPSK' else 1))
        if symbols * sps > 32768:
            raise self.tools.InvoiceError('Complex waveform exceeds 32768 samples')
        if 'noiseless' in request and not isinstance(request['noiseless'], bool):
            raise self.tools.InvoiceError('noiseless must be boolean')
        return bits, snr, int(sps), seed, fs, timing, frequency, mode, code, crc, width, symbols

    def theory(self, mode, snr):
        eb = 10 ** (snr / 10)
        return .5 * math.exp(-eb / 2) if mode == 'BFSK' else .5 * math.erfc(math.sqrt(eb))

    def run(self, envelope):
        request, result = envelope.request, envelope.result
        bits, snr, sps, seed, fs, timing, frequency, mode, code, crc, width, symbols = self.record(request)
        if result.get('ok') is not True:
            return {'checks': [self.tools.receipt('NATIVE_TERMINAL', 'not-run', 'A theoretical curve cannot substitute for native execution.')], 'reference': {'supported': False, 'rows': []}, 'support': {'nativeSucceeded': False}}
        polynomial, initial = (0x1021, 0xffff) if width == 16 else (7, 0)
        expected = bits + format(self.get(bits, width, polynomial, initial), '0' + str(width) + 'b')
        tx = self.inherited.stock(result.get('txBits'), 'txBits')
        rx = self.inherited.stock(result.get('rxBits'), 'rxBits')
        if len(tx) != len(rx) or len(tx) != len(expected):
            raise self.tools.InvoiceError('Frame length differs from payload plus CRC')
        decoded = rx[:len(bits)]
        errors = sum(a != b for a, b in zip(bits, decoded))
        frame_errors = sum(a != b for a, b in zip(tx, rx))
        valid = int(rx[-width:], 2) == self.get(decoded, width, polynomial, initial)
        interval = self.inherited.price(errors, len(bits))
        sigma = 0. if request.get('noiseless') else math.sqrt(.5 / 10 ** (snr / 10))
        check = self.tools.receipt
        checks = [check('CRC' + str(width) + '_ENCODE', 'pass' if tx == expected else 'fail', 'Independent MSB-first polynomial division; no reflection or xorout.', polynomial=hex(polynomial), initial=initial),
                  check('PAYLOAD_DECODE', 'pass' if result.get('decodedBits', decoded) == decoded else 'fail', 'Decoded payload equals received prefix.'),
                  check('CRC' + str(width) + '_RECEIVE', 'pass' if result.get('crcValid') is valid else 'fail', 'Independent receive CRC.', independentlyValid=valid),
                  check('ERROR_COUNTS', 'pass' if result.get('bitErrors') == errors and abs(self.tools.amount(result.get('ber'), 'BER') - errors / len(bits)) < 1e-12 and result.get('frameBitErrors', frame_errors) == frame_errors else 'fail', 'Independent payload/frame mismatch counts.', payloadErrors=errors, frameErrors=frame_errors)]
        reported = result.get('interval') or result.get('wilsonInterval') or result.get('wilson')
        if reported is not None:
            if isinstance(reported, dict):
                reported = [reported.get('lower', reported.get('low')), reported.get('upper', reported.get('high'))]
            if not isinstance(reported, list) or len(reported) != 2:
                raise self.tools.InvoiceError('Interval must contain two bounds')
            difference = max(abs(self.tools.amount(a, 'interval') - b) for a, b in zip(reported, interval))
            checks.append(check('BER_INTERVAL', 'pass' if difference < 1e-7 else 'fail', 'Independent 95% Wilson score interval.', maximumDifference=difference))
        metadata = result.get('summary') or result.get('metadata') or {}
        if 'sigma' in metadata:
            delta = self.tools.small_error(self.tools.amount(metadata['sigma'], 'sigma'), sigma, 1e-12, 1e-9)
            checks.append(check('BPSK_NOISE_MODEL' if mode == 'BPSK' else 'COMPLEX_NOISE_MODEL', 'pass' if delta['passed'] else 'fail', 'Gaussian standard deviation per real/imaginary component is sqrt(N0/2).', expectedSigma=sigma, **delta))
        waves = result.get('waveform')
        if waves is not None:
            checks.append(check('SAMPLED_DURATION', 'pass' if isinstance(waves, list) and len(waves) == symbols * sps else 'fail', 'Waveform length is independently derived from CRC, line code, QPSK padding and oversampling.', expectedSamples=symbols * sps))
        ideal = timing == 0 and frequency == 0 and code == 'NRZ'
        theory = self.theory(mode, snr) if ideal else None
        if request.get('noiseless') and timing == 0 and frequency == 0:
            checks.append(check('NOISELESS_ROUNDTRIP', 'pass' if errors == 0 and valid else 'fail', 'Zero-offset noiseless frames round-trip exactly.'))
        elif ideal and not request.get('noiseless'):
            expected_errors = len(bits) * theory
            deviation = math.sqrt(len(bits) * theory * (1 - theory))
            checks.append(check('BPSK_FINITE_SAMPLE' if mode == 'BPSK' else 'MODULATION_FINITE_SAMPLE', 'warning' if abs(errors - expected_errors) > max(8., 6 * deviation) else 'consistent', 'Finite realization compared with ideal AWGN population theory; not a solver accuracy test.', expectedErrors=expected_errors, standardDeviation=deviation, observedErrors=errors, theoryInside95Interval=interval[0] <= theory <= interval[1]))
        if 'sweep' in request:
            checks.extend(self.scan(request, result, len(bits)))
        return {'checks': checks, 'reference': {'supported': True, 'idealTheoryApplicable': ideal, 'theoreticalBER': theory, 'operativeTheoreticalBER': 0. if ideal and request.get('noiseless') else theory,
                'model': 'noncoherent orthogonal BFSK AWGN' if mode == 'BFSK' else 'coherent Gray antipodal AWGN', 'formula': '0.5 exp(-Eb/N0 / 2)' if mode == 'BFSK' else '0.5 erfc(sqrt(Eb/N0))',
                'rows': [{'ebN0Db': x, 'ber': self.theory(mode, x)} for x in range(-8, 13, 2)] if ideal else [], 'empiricalBER': errors / len(bits), 'interval95': interval, 'sigma': sigma, 'payloadBits': len(bits), 'frameBits': len(expected),
                'warning': 'Ideal population curves are withheld for offsets/Manchester; correlated sweep cells are actual native executions, not independent trials.'},
                'support': {'nativeSucceeded': True, 'modulation': mode, 'lineCode': code, 'crc': crc, 'seed': seed, 'samplesPerSymbol': sps, 'sampleRateHz': fs, 'ebN0Db': snr}}

    def scan(self, request, result, n):
        scan, native = request['sweep'], result.get('sweep', {})
        x, y = scan['values'], scan.get('secondaryValues', [0])
        cells = native.get('cells', [])
        matched = native.get('executed') is True and native.get('cases') == len(x) * len(y) and len(cells) == len(x) * len(y)
        seen = set()
        for cell in cells:
            row, column = cell.get('row'), cell.get('column')
            if isinstance(row, bool) or isinstance(column, bool) or not isinstance(row, int) or not isinstance(column, int) or not 0 <= row < len(y) or not 0 <= column < len(x) or (row, column) in seen:
                matched = False
                continue
            seen.add((row, column))
            errors = cell.get('bitErrors')
            if isinstance(errors, bool) or not isinstance(errors, int) or not 0 <= errors <= n:
                matched = False
                continue
            bounds = cell.get('interval', {})
            expected = self.inherited.price(errors, n)
            matched &= cell.get('x') == x[column] and cell.get('y') == y[row] and cell.get('payloadLength') == n and abs(self.tools.amount(cell.get('ber'), 'scan BER') - errors / n) < 1e-12 and all(abs(self.tools.amount(bounds.get(key), 'scan interval') - value) < 1e-7 for key, value in zip(('lower', 'upper'), expected))
        return [self.tools.receipt('SWEEP_ACCOUNTING', 'pass' if matched else 'fail', 'Grid coverage, counts and Wilson intervals are audited; condensed cells omit raw frames, so their individual CRCs and waveforms are not independently rechecked.', expectedCases=len(x) * len(y), nativeCases=len(cells), correlated=True)]

    def plan(self, request, levels):
        self.record(request)
        if not isinstance(levels, list) or not 1 <= len(levels) <= 9:
            raise self.tools.InvoiceError('SNR plan requires 1..9 levels')
        return {'schema': 'ocv.signals/sweep-plan/1', 'executed': False, 'requests': [{**request, 'ebN0Db': self.tools.amount(snr, 'Eb/N0', -30, 60), 'seed': (request.get('seed', 42) + index * 2654435761) & 0xffffffff} for index, snr in enumerate(levels)],
                'limits': {'cases': 9, 'waveformSamplesPerCase': 32768, 'serialExecutionRequired': True}}
