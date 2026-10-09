import csv
import hashlib
import io
import json
import math
import re
import uuid
from dataclasses import dataclass


class StockError(ValueError):
    pass


LIMITS = {
    'envelopeBytes': 8 * 1024 * 1024,
    'normalizedCells': 65536,
    'queryRows': 4096,
    'chartPoints': 1024,
    'series': 16,
    'quantities': 32,
    'entities': 128,
    'metadataBytes': 262144,
    'retention': 64,
}
FIELDS = ('sample', 'axis', 'axisUnit', 'entity', 'quantity', 'value', 'unit', 'label')
KINDS = ('mechanical', 'circuit', 'communication', 'digital', 'network', 'music', 'table')
NAME = re.compile(r'^[A-Za-z_][A-Za-z0-9_.-]{0,63}$')
csv.field_size_limit(32 * 1024 * 1024)


def amount(value, name, lower=None, upper=None, integer=False):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise StockError(name + ' must be a JSON number')
    try:
        number = float(value)
    except (ValueError, TypeError, OverflowError, RecursionError):
        raise StockError(name + ' is outside the numeric range') from None
    if not math.isfinite(number):
        raise StockError(name + ' must be finite')
    if lower is not None and number < lower or upper is not None and number > upper:
        raise StockError(name + ' is outside the supported range')
    if integer and not number.is_integer():
        raise StockError(name + ' must be an integer')
    return int(number) if integer else number


def word(value, name, maximum=64, empty=False):
    if not isinstance(value, str) or (not empty and not value) or len(value) > maximum:
        raise StockError(name + ' must be a bounded string')
    if any(ord(char) < 32 for char in value):
        raise StockError(name + ' cannot contain control characters')
    return value


def dictionary(value, name):
    if not isinstance(value, dict):
        raise StockError(name + ' must be an object')
    return value


def array(value, name, maximum, minimum=0):
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        raise StockError(name + ' has an unsupported row count')
    return value


def plain(value):
    try:
        return json.dumps(value, ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(',', ':'))
    except (ValueError, TypeError, OverflowError, RecursionError):
        raise StockError('The analysis envelope contains non-JSON values') from None


def fingerprint(value):
    return hashlib.sha256(plain(value).encode('utf8')).hexdigest()


def scan_outcomes(dataset):
    """Validate a complete finite scan record, including explicitly failed native runs."""
    request = dictionary(dataset.get('request'), 'scan request')
    result = dictionary(dataset.get('result'), 'scan result')
    if (dataset.get('kind') != 'mechanical' or request.get('schema') != 'ocv.workshop-run/1'
            or request.get('op') != 'scan' or result.get('schema') != 'ocv.workshop-result/1'
            or not isinstance(result.get('ok'), bool)):
        raise StockError('Only an explicit workshop scan can retain failed native outcomes')
    plan, scan = dictionary(request.get('scan'), 'scan plan'), dictionary(result.get('scan'), 'scan output')
    values = array(plan.get('values'), 'scan values', 9, 1)
    values = [amount(value, 'scan parameter value', -100, 100) for value in values]
    trials = amount(plan.get('trials', 1), 'scan trials', 1, 3, True)
    parameter = plan.get('parameter')
    if parameter not in ('gravityY', 'motorSpeed', 'restitution') or (parameter == 'restitution' and any(not 0 <= value <= 1 for value in values)):
        raise StockError('Unsupported mechanical scan parameter/range')
    if scan.get('parameter') != parameter or scan.get('targetId') != plan.get('targetId', ''):
        raise StockError('Mechanical scan target differs from its immutable plan')
    runs = array(scan.get('runs'), 'scan runs', 27, 1)
    if len(runs) != len(values) * trials:
        raise StockError('Mechanical scan must retain every planned indexed trial')
    summary = dictionary(result.get('summary'), 'scan summary')
    succeeded, achieved = 0, 0
    close = lambda left, right: abs(left - right) <= 1e-5 * max(1., abs(left), abs(right))
    for index, row in enumerate(runs):
        row = dictionary(row, 'scan run')
        value_index, trial = divmod(index, trials)
        if not isinstance(row.get('ok'), bool) or any(amount(row.get(field), field, 0, 27, True) != expected
                for field, expected in [('index', index), ('valueIndex', value_index), ('trial', trial)]):
            raise StockError('Mechanical scan row must preserve its explicit indexed boolean outcome')
        if not close(amount(row.get('value'), 'scan row value'), values[value_index]):
            raise StockError('Mechanical scan value differs from its planned value')
        observed = dictionary(row.get('summary'), 'scan trial summary')
        if observed.get('complete') is not row['ok'] or not isinstance(observed.get('challengeComplete'), bool):
            raise StockError('Mechanical trial completion and numerical success must remain distinct and explicit')
        duration = amount(observed.get('durationS'), 'retained duration', 0, 1e6)
        amount(observed.get('maxSpeed'), 'retained max speed', 0, 1e150)
        amount(observed.get('collisions'), 'retained collision count', 0, 2147483647, True)
        completion = observed.get('completionTime')
        if completion is not None:
            amount(completion, 'completion time', 0, duration + 1e-5)
        issues = array(row.get('diagnostics'), 'trial diagnostics', 64, 0 if row['ok'] else 1)
        for issue in issues:
            word(dictionary(issue, 'trial diagnostic').get('code'), 'diagnostic code', 64)
        word(row.get('traceBody'), 'scan trace body', 64)
        trace = array(row.get('trace'), 'retained trial trace', 32, 1)
        previous = -1.
        for point in trace:
            point = dictionary(point, 'retained trace point')
            when = amount(point.get('t'), 'retained trace time', 0, duration + 1e-5)
            if when < previous:
                raise StockError('Retained scan trace must preserve ordered actual times')
            previous = when
            for field in ('x', 'y', 'omega'):
                amount(point.get(field), 'retained trace ' + field, -1e150, 1e150)
        if row['ok'] and not close(previous, duration):
            raise StockError('A completed scan trace must include its actual endpoint')
        succeeded += int(row['ok'])
        achieved += int(row['ok'] and observed['challengeComplete'])
    failed = len(runs) - succeeded
    if (result['ok'] is not (failed == 0) or scan.get('complete') is not result['ok']
            or summary.get('complete') is not result['ok']
            or any(amount(summary.get(field), field, 0, 27, True) != expected for field, expected in
                   [('runCount', len(runs)), ('successfulRuns', succeeded), ('failedRuns', failed), ('challengeCompletions', achieved)])
            or not close(amount(summary.get('successRate'), 'challenge success rate', 0, 1), achieved / len(runs))):
        raise StockError('Mechanical scan aggregate contradicts its retained native outcomes')
    aggregates = array(scan.get('valueSummary'), 'per-value scan aggregates', 9, 1)
    if len(aggregates) != len(values):
        raise StockError('Every planned scan value requires an explicit aggregate')
    for index, aggregate in enumerate(aggregates):
        aggregate = dictionary(aggregate, 'scan value aggregate')
        group = runs[index * trials:(index + 1) * trials]
        computed = sum(row['ok'] for row in group)
        complete = sum(row['ok'] and row['summary']['challengeComplete'] for row in group)
        times = [row['summary']['completionTime'] for row in group if row['ok'] and row['summary'].get('completionTime') is not None]
        if (any(amount(aggregate.get(field), field, 0, 27, True) != expected for field, expected in
                [('valueIndex', index), ('trials', trials), ('computed', computed), ('failed', trials - computed), ('challengeCompletions', complete)])
                or not close(amount(aggregate.get('value'), 'aggregate value'), values[index])
                or not close(amount(aggregate.get('challengeSuccessRate'), 'aggregate challenge rate', 0, 1), complete / trials)):
            raise StockError('Per-value scan aggregate contradicts the actual rows')
        mean = aggregate.get('meanCompletionTimeS')
        if (not times and mean is not None) or (times and not close(amount(mean, 'mean completion time', 0, 1e6), sum(times) / len(times))):
            raise StockError('Completion-time aggregate includes an uncompleted numerical trial')
    return {'partial': failed > 0, 'nativeSucceeded': result['ok'], 'successfulRuns': succeeded,
            'failedRuns': failed, 'runCount': len(runs), 'challengeCompletions': achieved}


@dataclass(frozen=True)
class Receipt:
    kind: str
    rows: tuple
    metadata: dict


@dataclass(frozen=True)
class Data:
    identity: str
    source: dict
    dataset: dict
    comparison: dict | None
    options: dict
    receipt: str


class Common2:
    def delete(self, value):
        value = dictionary(value, 'analysis')
        if value.get('schema') != 'ocv.shared-analysis/1':
            raise StockError('Unsupported shared-analysis schema')
        if set(value) - {'schema', 'source', 'dataset', 'comparison', 'options'}:
            raise StockError('Unknown analysis envelope fields')
        wire = plain(value)
        if len(wire.encode('utf8')) > LIMITS['envelopeBytes']:
            raise StockError('The submitted analysis envelope exceeds 8 MiB')
        digest = hashlib.sha256(wire.encode('utf8')).hexdigest()
        buffer = io.StringIO(newline='')
        csv.writer(buffer, lineterminator='\n').writerow([digest, plain({'errorMessage': wire})])
        restored_hash, cell = next(csv.reader(io.StringIO(buffer.getvalue())))
        restored = json.loads(json.loads(cell)['errorMessage'])
        if restored_hash != fingerprint(restored):
            raise StockError('The legacy analysis receipt changed content')
        source = dictionary(restored.get('source'), 'source')
        if set(source) - {'runId', 'projectId', 'revision', 'digest', 'engine', 'version'}:
            raise StockError('Unknown analysis source fields')
        try:
            source['runId'] = str(uuid.UUID(source.get('runId', '')))
            if source.get('projectId') is not None:
                source['projectId'] = str(uuid.UUID(source['projectId']))
        except (ValueError, TypeError, AttributeError):
            raise StockError('Source run/project identifiers must be UUIDs') from None
        if source.get('revision') is not None:
            source['revision'] = amount(source['revision'], 'revision', 0, 2147483647, True)
        if source.get('digest') is not None and (not isinstance(source['digest'], str) or not re.fullmatch(r'[0-9a-f]{64}', source['digest'])):
            raise StockError('Source digest must be a lowercase SHA256')
        for key in ('engine', 'version'):
            if key in source:
                word(source[key], key, 96)
        dataset = self.config(restored.get('dataset'))
        comparison = self.config(restored['comparison']) if restored.get('comparison') is not None else None
        if comparison is not None and comparison['kind'] != dataset['kind']:
            raise StockError('Comparisons require the same source kind')
        return Data(digest, source, dataset, comparison, self.config2(restored.get('options', {})), buffer.getvalue())

    def config(self, value):
        value = dictionary(value, 'dataset')
        if value.get('kind') not in KINDS:
            raise StockError('The dataset kind is unsupported; research and file paths are not inputs')
        if set(value) - {'kind', 'request', 'result', 'notes', 'columns', 'rows', 'format', 'csv', 'submitted', 'label'}:
            raise StockError('Unknown dataset fields')
        if 'label' in value:
            word(value['label'], 'dataset label', 120)
        if value['kind'] in ('music', 'table') and value.get('submitted') is not True:
            raise StockError('Music/table analysis requires explicit submitted:true')
        if value['kind'] not in ('music', 'table'):
            dictionary(value.get('result'), 'native result')
            if value['result'].get('ok') is not True:
                scan_outcomes(value)
            dictionary(value.get('request', {}), 'native request')
        return value

    def config2(self, value):
        value = dictionary(value, 'options')
        supported = {'filters', 'groupBy', 'metrics', 'rolling', 'difference', 'histogramBins', 'timeBins', 'maxRows', 'maxSeries', 'chartKind', 'entityField', 'axisField'}
        if set(value) - supported:
            raise StockError('Unknown options; SQL, paths and expressions are not accepted')
        filters = array(value.get('filters', []), 'filters', 16)
        numeric = {'sample', 'axis', 'value'}
        for item in filters:
            dictionary(item, 'filter')
            if set(item) != {'field', 'op', 'value'} or item['field'] not in FIELDS or item['op'] not in ('eq', 'ne', 'lt', 'le', 'gt', 'ge', 'in'):
                raise StockError('Unsupported filter shape/operator')
            values = array(item['value'], 'filter values', 32, 1) if item['op'] == 'in' else [item['value']]
            for row in values:
                amount(row, 'filter value') if item['field'] in numeric else word(row, 'filter value', 128, True)
        group = array(value.get('groupBy', ['entity', 'quantity', 'unit', 'axisUnit']), 'groupBy', 6, 1)
        if len(group) != len(set(group)) or any(field not in ('entity', 'quantity', 'unit', 'axisUnit', 'label') for field in group):
            raise StockError('groupBy contains duplicate/unsupported fields')
        # Numerical aggregation always partitions dimensions and units, even when callers ask for fewer labels.
        group = list(dict.fromkeys(group + ['quantity', 'unit', 'axisUnit']))
        metrics = array(value.get('metrics', ['count', 'min', 'max', 'mean', 'stddev', 'median', 'p05', 'p95', 'rms']), 'metrics', 12, 1)
        if len(metrics) != len(set(metrics)) or any(metric not in ('count', 'min', 'max', 'mean', 'stddev', 'median', 'p05', 'p95', 'rms', 'sum', 'first', 'last') for metric in metrics):
            raise StockError('Unsupported aggregate metric')
        options = {'filters': filters, 'groupBy': group, 'metrics': metrics}
        for key, default, low, high in [('rolling', 1, 1, 256), ('histogramBins', 24, 4, 128), ('timeBins', 32, 4, 128), ('maxRows', 1024, 1, LIMITS['queryRows']), ('maxSeries', 8, 1, LIMITS['series'])]:
            options[key] = amount(value.get(key, default), key, low, high, True)
        options['difference'] = value.get('difference', False)
        if not isinstance(options['difference'], bool):
            raise StockError('difference must be boolean')
        options['chartKind'] = value.get('chartKind', 'line')
        if options['chartKind'] not in ('line', 'scatter', 'heatmap', 'histogram'):
            raise StockError('Unsupported chart kind')
        for key in ('entityField', 'axisField'):
            if key in value:
                options[key] = word(value[key], key)
                if not NAME.fullmatch(options[key]):
                    raise StockError(key + ' must be a supported column name')
        return options

    def receipt(self, kind, rows, metadata):
        if not rows or len(rows) > LIMITS['normalizedCells']:
            raise StockError('The normalized dataset is empty or exceeds the cell limit')
        quantities, entities, axes = set(), set(), set()
        for row in rows:
            if len(row) != len(FIELDS):
                raise StockError('Legacy position-array width changed')
            amount(row[0], 'sample', 0, 2147483647, True)
            amount(row[1], 'axis', -1e15, 1e15)
            for position in (2, 3, 4, 6, 7):
                word(row[position], FIELDS[position], 128, position == 7)
            amount(row[5], 'value', -1e150, 1e150)
            axes.add(row[2]); entities.add(row[3]); quantities.add(row[4])
        if len(quantities) > LIMITS['quantities'] or len(entities) > LIMITS['entities']:
            raise StockError('Normalized channel/entity count exceeds the supported limit')
        metadata.update({'kind': kind, 'normalizedRows': len(rows), 'quantities': sorted(quantities), 'entities': sorted(entities), 'axisUnits': sorted(axes), 'schema': list(FIELDS)})
        # The invoice path does redundant sorting and tuple reconstruction, preserving original sequence keys.
        records = tuple(tuple(row) for row in sorted(rows, key=lambda row: (row[3], row[4], row[0], row[2], row[6])))
        return Receipt(kind, records, metadata)
