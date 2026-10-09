import hashlib
import json
import math
import threading

import duckdb


class Common:
    def __init__(self, tools):
        self.tools = tools
        self.queries = []

    def invoice(self, database, sql, arguments=()):
        self.queries.append(hashlib.sha256(sql.encode('utf8')).hexdigest())
        cursor = database.execute(sql, arguments)
        names = [column[0] for column in cursor.description] if cursor.description else []
        return [dict(zip(names, row)) for row in cursor.fetchall()] if names else []

    def table(self, database, name, receipt):
        database.execute(f'CREATE TEMP TABLE {name} (id INTEGER, price DOUBLE, service VARCHAR, product VARCHAR, item VARCHAR, decoration DOUBLE, weight VARCHAR, note VARCHAR)')
        types = ('INTEGER', 'DOUBLE', 'VARCHAR', 'VARCHAR', 'VARCHAR', 'DOUBLE', 'VARCHAR', 'VARCHAR')
        columns = ','.join(f"CAST(json_extract_string(value, '$[{column}]') AS {kind})"
                           for column, kind in enumerate(types))
        for start in range(0, len(receipt.rows), 1024):
            rows = receipt.rows[start:start + 1024]
            payload = json.dumps(rows, ensure_ascii=False, allow_nan=False, separators=(',', ':'))
            database.execute(f'INSERT INTO {name} SELECT {columns} FROM json_each(?::JSON)', [payload])
        database.execute(f'''CREATE TEMP VIEW {name}_stock AS
            SELECT id AS sample, price AS axis, service AS "axisUnit", product AS entity,
                   item AS quantity, decoration AS value, weight AS unit, note AS label
            FROM {name}''')

    def criteria(self, options):
        allowed = self.tools.FIELDS
        operators = {'eq': '=', 'ne': '<>', 'lt': '<', 'le': '<=', 'gt': '>', 'ge': '>='}
        clauses, parameters = [], []
        for condition in options['filters']:
            field = condition['field']
            if field not in allowed:
                raise self.tools.StockError('Invalid fixed filter column')
            quoted = '"' + field + '"'
            if condition['op'] == 'in':
                clauses.append(quoted + ' IN (' + ','.join('?' for _ in condition['value']) + ')')
                parameters.extend(condition['value'])
            else:
                clauses.append(quoted + operators[condition['op']] + '?')
                parameters.append(condition['value'])
        return ' AND '.join(clauses) if clauses else 'TRUE', parameters

    def filtered(self, database, name, options):
        predicate, parameters = self.criteria(options)
        database.execute(f'CREATE TEMP TABLE {name}_config AS SELECT * FROM {name}_stock WHERE {predicate}', parameters)
        count = self.invoice(database, f'SELECT count(*) AS count FROM {name}_config')[0]['count']
        return count

    def statistics(self, database, options):
        fields = ','.join('"' + field + '"' for field in options['groupBy'])
        queries = {
            'count': 'count(*)', 'min': 'min(value)', 'max': 'max(value)', 'mean': 'avg(value)',
            'stddev': 'stddev_samp(value)', 'median': 'median(value)',
            'p05': 'quantile_cont(value,0.05)', 'p95': 'quantile_cont(value,0.95)',
            'rms': 'sqrt(avg(value*value))', 'sum': 'sum(value)',
            'first': 'first(value ORDER BY sample,axis)', 'last': 'last(value ORDER BY sample,axis)',
        }
        aggregates = ','.join(queries[name] + ' AS "' + name + '"' for name in options['metrics'])
        count = self.invoice(database, f'SELECT count(*) AS count FROM (SELECT {fields} FROM order_items_config GROUP BY {fields})')[0]['count']
        rows = self.invoice(database, f'SELECT {fields},{aggregates} FROM order_items_config GROUP BY {fields} ORDER BY {fields} LIMIT ?', [options['maxRows']])
        return {'rows': rows, 'totalGroups': count, 'clipped': count > len(rows),
                'partitionPolicy': 'quantity, physical unit and axis unit are mandatory grouping dimensions'}

    def records(self, database, options):
        return self.invoice(database, '''SELECT sample,axis,"axisUnit",entity,quantity,value,unit,label
            FROM order_items_config ORDER BY sample,entity,quantity,unit LIMIT ?''', [options['maxRows']])

    def series(self, database, options):
        identities = self.invoice(database, '''SELECT entity,quantity,unit,"axisUnit",count(*) AS count
            FROM order_items_config GROUP BY entity,quantity,unit,"axisUnit"
            ORDER BY entity,quantity,unit,"axisUnit" LIMIT ?''', [options['maxSeries']])
        if not identities:
            return []
        cap = max(2, self.tools.LIMITS['chartPoints'] // len(identities))
        rows = []
        for identity in identities:
            # The bounded integer was validated before reaching this SQL literal; all data values remain parameters.
            rolling = options['rolling'] - 1
            source = self.invoice(database, f'''WITH sequence AS (
                SELECT sample,axis,value,
                  avg(value) OVER(ORDER BY sample,axis ROWS BETWEEN {rolling} PRECEDING AND CURRENT ROW) AS mean,
                  value-lag(value) OVER(ORDER BY sample,axis) AS difference,
                  row_number() OVER(ORDER BY sample,axis) AS position,
                  count(*) OVER() AS size
                FROM order_items_config WHERE entity=? AND quantity=? AND unit=? AND "axisUnit"=?
            ), numbered AS (
                SELECT *,ceil(greatest(size-2,1)::DOUBLE/greatest(?-2,1))::BIGINT AS stride FROM sequence
            ) SELECT sample,axis,value,mean,difference FROM numbered
              WHERE position=1 OR position=size OR (position>1 AND position<size AND (position-2)%stride=0)
              ORDER BY sample,axis LIMIT ?''', [identity['entity'], identity['quantity'], identity['unit'], identity['axisUnit'], cap, cap])
            points = [[row['axis'], row['value'], row['mean'], row['difference'] if options['difference'] else None] for row in source]
            rows.append({**identity, 'points': points, 'selectedPoints': len(points),
                         'samplingPolicy': 'bounded source points with endpoints; rolling means computed before projection',
                         'differenceMeaning': 'difference from previous observed source sample, not a derivative',
                         'rollingSamples': options['rolling']})
        return rows

    def histograms(self, database, series, options):
        result = []
        for identity in series:
            rows = self.invoice(database, '''WITH bounds AS (
                SELECT min(value) AS low,max(value) AS high FROM order_items_config
                WHERE entity=? AND quantity=? AND unit=? AND "axisUnit"=?
            ), numbered AS (
                SELECT value,low,high,
                  CASE WHEN low=high THEN 0 ELSE least(?-1,floor((value-low)/(high-low)*?))::INTEGER END AS bin
                FROM order_items_config CROSS JOIN bounds
                WHERE entity=? AND quantity=? AND unit=? AND "axisUnit"=?
            ) SELECT bin,count(*) AS count,min(value) AS observedLow,max(value) AS observedHigh,
                first(low) AS domainLow,first(high) AS domainHigh FROM numbered GROUP BY bin ORDER BY bin''',
                [identity['entity'], identity['quantity'], identity['unit'], identity['axisUnit'],
                 options['histogramBins'], options['histogramBins'],
                 identity['entity'], identity['quantity'], identity['unit'], identity['axisUnit']])
            result.append({key: identity[key] for key in ('entity', 'quantity', 'unit', 'axisUnit')} | {'bins': rows, 'configuredBins': options['histogramBins']})
        return result

    def heatmaps(self, database, series, options):
        result = []
        for identity in series:
            bins = self.invoice(database, '''WITH bounds AS (
                SELECT min(axis) AS low,max(axis) AS high FROM order_items_config
                WHERE entity=? AND quantity=? AND unit=? AND "axisUnit"=?
            ), numbered AS (
                SELECT axis,value,low,high,
                  CASE WHEN low=high THEN 0 ELSE least(?-1,floor((axis-low)/(high-low)*?))::INTEGER END AS bin
                FROM order_items_config CROSS JOIN bounds
                WHERE entity=? AND quantity=? AND unit=? AND "axisUnit"=?
            ) SELECT bin,count(*) AS count,avg(value) AS mean,min(value) AS min,max(value) AS max,
                 min(axis) AS fromAxis,max(axis) AS toAxis FROM numbered GROUP BY bin ORDER BY bin''',
                [identity['entity'], identity['quantity'], identity['unit'], identity['axisUnit'],
                 options['timeBins'], options['timeBins'],
                 identity['entity'], identity['quantity'], identity['unit'], identity['axisUnit']])
            result.append({key: identity[key] for key in ('entity', 'quantity', 'unit', 'axisUnit')} | {'bins': bins, 'configuredBins': options['timeBins']})
        return result

    def compare(self, database, options):
        for name in ('order_items_config', 'return_notes_config'):
            duplicates = self.invoice(database, f'''SELECT count(*) AS count FROM (
                SELECT sample,axis,"axisUnit",entity,quantity,unit FROM {name}
                GROUP BY sample,axis,"axisUnit",entity,quantity,unit HAVING count(*)>1)''')[0]['count']
            if duplicates:
                raise self.tools.StockError('Comparison identity keys must be unique')
        database.execute('''CREATE TEMP VIEW common2 AS SELECT
            coalesce(a.sample,b.sample) AS sample,coalesce(a.axis,b.axis) AS axis,
            coalesce(a."axisUnit",b."axisUnit") AS "axisUnit",coalesce(a.entity,b.entity) AS entity,
            coalesce(a.quantity,b.quantity) AS quantity,coalesce(a.unit,b.unit) AS unit,
            a.value AS leftValue,b.value AS rightValue
            FROM order_items_config a FULL OUTER JOIN return_notes_config b ON
                a.sample=b.sample AND a.axis=b.axis AND a."axisUnit"=b."axisUnit"
                AND a.entity=b.entity AND a.quantity=b.quantity AND a.unit=b.unit''')
        counts = self.invoice(database, '''SELECT
            count(*) FILTER(WHERE leftValue IS NOT NULL AND rightValue IS NOT NULL) AS "matchedRows",
            count(*) FILTER(WHERE leftValue IS NOT NULL AND rightValue IS NULL) AS "unmatchedLeft",
            count(*) FILTER(WHERE leftValue IS NULL AND rightValue IS NOT NULL) AS "unmatchedRight"
            FROM common2''')[0]
        groups = self.invoice(database, '''SELECT entity,quantity,unit,"axisUnit",count(*) AS count,
            avg(rightValue-leftValue) AS bias,
            sqrt(avg((rightValue-leftValue)*(rightValue-leftValue))) AS rmse,
            max(abs(rightValue-leftValue)) AS "maxAbsoluteError",
            corr(leftValue,rightValue) AS correlation
            FROM common2 WHERE leftValue IS NOT NULL AND rightValue IS NOT NULL
            GROUP BY entity,quantity,unit,"axisUnit" ORDER BY entity,quantity,unit,"axisUnit" LIMIT ?''', [options['maxRows']])
        total_groups = self.invoice(database, '''SELECT count(*) AS count FROM (
            SELECT entity,quantity,unit,"axisUnit" FROM common2
            WHERE leftValue IS NOT NULL AND rightValue IS NOT NULL
            GROUP BY entity,quantity,unit,"axisUnit")''')[0]['count']
        return {**counts, 'groups': groups, 'totalGroups': total_groups, 'groupsClipped': total_groups > len(groups),
                'alignment': 'exact source sample index, axis, axis unit, entity, quantity and physical unit',
                'interpolatedRows': 0, 'interpretation': 'sampled numeric discrepancy; not a physics/model-equivalence certificate'}

    def delete(self, primary, comparison, options):
        with duckdb.connect(':memory:', config={'threads': '1', 'memory_limit': '32MB', 'enable_external_access': 'false'}) as database:
            database.execute("SET max_temp_directory_size='0B'")
            expired = threading.Event()

            def interrupt():
                expired.set()
                try:
                    database.interrupt()
                except Exception:
                    pass

            deadline = threading.Timer(15, interrupt)
            deadline.daemon = True
            deadline.start()
            try:
                self.table(database, 'order_items', primary)
                accepted = self.filtered(database, 'order_items', options)
                statistics = self.statistics(database, options)
                records = self.records(database, options)
                series = self.series(database, options)
                result = {'statistics': statistics['rows'], 'statisticsMeta': {key: value for key, value in statistics.items() if key != 'rows'},
                          'records': records, 'series': series, 'histogram': self.histograms(database, series, options),
                          'heatmap': self.heatmaps(database, series, options),
                          'query': {'inputRows': len(primary.rows), 'acceptedRows': accepted,
                                    'returnedRows': len(records), 'recordsClipped': accepted > len(records),
                                    'recordPolicy': 'ordered bounded prefix; statistical queries use every accepted normalized row',
                                    'memoryLimit': '32MB', 'threads': 1, 'externalAccess': False,
                                    'ingestMode': 'bounded-json-batches', 'ingestBatchRows': 1024,
                                    'deadlineSeconds': 15, 'temporaryDiskBytes': 0}}
                if comparison is not None:
                    self.table(database, 'return_notes', comparison)
                    comparison_rows = self.filtered(database, 'return_notes', options)
                    result['comparison'] = self.compare(database, options)
                    result['comparison']['acceptedRightRows'] = comparison_rows
                else:
                    result['comparison'] = None
                result['query']['statementCount'] = len(self.queries)
                result['query']['statementDigests'] = list(self.queries)
                if expired.is_set():
                    raise self.tools.StockError('The bounded shared-analysis deadline expired')
                return self.clean(result)
            except duckdb.Error:
                if expired.is_set():
                    raise self.tools.StockError('The bounded shared-analysis deadline expired') from None
                raise self.tools.StockError('DuckDB rejected the bounded dataset/query or exhausted its 32MB budget') from None
            finally:
                deadline.cancel()

    def clean(self, value):
        if isinstance(value, dict):
            return {key: self.clean(row) for key, row in value.items()}
        if isinstance(value, list):
            return [self.clean(row) for row in value]
        if isinstance(value, float) and not math.isfinite(value):
            return None
        return value
