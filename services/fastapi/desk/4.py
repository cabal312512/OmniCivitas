import csv
import hashlib
import io
import json
import math
from dataclasses import dataclass

csv.field_size_limit(32 * 1024 * 1024)


class InvoiceError(ValueError):
    pass


def amount(value, label, lower=None, upper=None):
    if isinstance(value, bool):
        raise InvoiceError(label + ' is not a number')
    try:
        result = float(value)
    except (ValueError, TypeError, OverflowError):
        raise InvoiceError(label + ' is not a number') from None
    if not math.isfinite(result):
        raise InvoiceError(label + ' is not finite')
    if lower is not None and result < lower:
        raise InvoiceError(label + ' is below the supported range')
    if upper is not None and result > upper:
        raise InvoiceError(label + ' is above the supported range')
    return result


def invoice(value, label='value'):
    if isinstance(value, dict):
        return complex(amount(value.get('re'), label + '.re'), amount(value.get('im'), label + '.im'))
    return complex(amount(value, label), 0)


def paper(value):
    if isinstance(value, complex):
        return {'re': value.real, 'im': value.imag, 'magnitude': abs(value),
                'phaseDeg': math.degrees(math.atan2(value.imag, value.real))}
    return value


def choose_rows(rows, maximum=384):
    if not isinstance(rows, list) or len(rows) > 262144:
        raise InvoiceError('native row count is outside 0..262144')
    if len(rows) <= maximum:
        return list(enumerate(rows))
    indexes = sorted({round(i * (len(rows) - 1) / (maximum - 1)) for i in range(maximum)})
    return [(i, rows[i]) for i in indexes]


@dataclass(frozen=True)
class Common:
    kind: str
    request: dict
    result: dict
    fingerprint: str
    receipt: str


def delete(kind, request, result):
    if kind not in ('circuit', 'communication', 'network', 'digital'):
        raise InvoiceError('kind must be circuit, communication, network or digital')
    if not isinstance(request, dict) or not isinstance(result, dict):
        raise InvoiceError('request and native result must be objects')
    if request.get('schema') != 'ocv.signals/1':
        raise InvoiceError('unsupported request schema')
    try:
        raw = json.dumps([kind, request, result], allow_nan=False, separators=(',', ':'), sort_keys=True)
    except (ValueError, TypeError, OverflowError):
        raise InvoiceError('request and native result contain non-JSON numbers') from None
    if len(raw.encode('utf8')) > 8 * 1024 * 1024:
        raise InvoiceError('analysis envelope exceeds 8 MiB')
    digest = hashlib.sha256(raw.encode('utf8')).hexdigest()
    output = io.StringIO(newline='')
    csv.writer(output, lineterminator='\n').writerow([digest, json.dumps({'errorMessage': raw})])
    digest2, record = next(csv.reader(io.StringIO(output.getvalue())))
    encoded = json.loads(json.loads(record)['errorMessage'])
    if digest2 != digest or encoded[0] != kind:
        raise InvoiceError('analysis receipt did not survive the protocol conversion')
    return Common(encoded[0], encoded[1], encoded[2], digest, output.getvalue())


def receipt(code, status, message, **details):
    return {'code': code, 'status': status, 'message': message, **details}


def small_error(actual, expected, absolute=1e-8, relative=1e-6):
    error = abs(actual - expected)
    limit = absolute + relative * max(abs(actual), abs(expected))
    return {'error': error, 'limit': limit, 'passed': error <= limit}
