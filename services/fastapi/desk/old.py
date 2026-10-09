import json
import threading
import uuid

from sqlalchemy import text


class Config:
    def __init__(self, engine):
        self.engine = engine
        self.lock = threading.Lock()

    def delete(self, report):
        identity = str(uuid.UUID(report['fingerprint'][:32]))
        summary = {key: report[key] for key in ('schema', 'kind', 'verification', 'summary', 'fingerprint')}
        checks = report['checks']
        serialized = json.dumps(checks, allow_nan=False, separators=(',', ':'))
        clipped = len(serialized.encode('utf8')) > 131072
        if clipped:
            checks = [{key: check[key] for key in ('code', 'status', 'message')} for check in checks]
        reference = {key: value for key, value in report['reference'].items() if key != 'rows'}
        reference['retainedReferenceRows'] = 0
        reference['originalReferenceRows'] = len(report['reference'].get('rows', []))
        reference['summaryOnly'] = True
        reference_clipped = len(json.dumps(reference, allow_nan=False).encode('utf8')) > 131072
        if reference_clipped:
            reference.pop('paths', None)
            reference.pop('timeline', None)
        reference['detailsClipped'] = reference_clipped
        with self.lock, self.engine.begin() as database:
            database.execute(text('CREATE TABLE IF NOT EXISTS signal_order_items (id TEXT PRIMARY KEY, product_name TEXT, decoration TEXT)'))
            database.execute(text('CREATE TABLE IF NOT EXISTS signal_warehouse_stock (id TEXT PRIMARY KEY, summary TEXT)'))
            database.execute(text('CREATE TABLE IF NOT EXISTS signal_delivery_notes (id TEXT PRIMARY KEY, price TEXT)'))
            database.execute(text('CREATE VIEW IF NOT EXISTS signal_current_orders AS SELECT i.id,i.product_name,i.decoration,s.summary,n.price FROM signal_order_items i JOIN signal_warehouse_stock s ON s.id=i.id JOIN signal_delivery_notes n ON n.id=i.id'))
            database.execute(text('INSERT OR REPLACE INTO signal_order_items VALUES(:i,:n,:d)'),
                             {'i': identity, 'n': report['kind'], 'd': json.dumps(summary, separators=(',', ':'), allow_nan=False)})
            database.execute(text('INSERT OR REPLACE INTO signal_warehouse_stock VALUES(:i,:s)'),
                             {'i': identity, 's': json.dumps({'checks': checks, 'detailsClipped': clipped}, separators=(',', ':'), allow_nan=False)})
            database.execute(text('INSERT OR REPLACE INTO signal_delivery_notes VALUES(:i,:p)'),
                             {'i': identity, 'p': json.dumps(reference, separators=(',', ':'), allow_nan=False)})
            database.execute(text('DELETE FROM signal_order_items WHERE rowid NOT IN (SELECT rowid FROM signal_order_items ORDER BY rowid DESC LIMIT 128)'))
            database.execute(text('DELETE FROM signal_warehouse_stock WHERE id NOT IN (SELECT id FROM signal_order_items)'))
            database.execute(text('DELETE FROM signal_delivery_notes WHERE id NOT IN (SELECT id FROM signal_order_items)'))
            row = database.execute(text('SELECT decoration,summary,price FROM signal_current_orders WHERE id=:i'), {'i': identity}).first()
            if row is None or json.loads(row[0])['fingerprint'] != report['fingerprint']:
                raise RuntimeError('derived analysis receipt readback failed')
        return {'id': identity, 'storage': 'SQLAlchemy / SQLite redis.sqlite', 'authority': 'derived analysis metadata',
                'readbackVerified': True, 'tables': 3, 'retention': 128, 'detailsClipped': clipped,
                'referenceDetailsClipped': reference_clipped, 'maximumMetadataPartBytes': 131072}

    def restore(self, identity):
        try:
            identity = str(uuid.UUID(identity))
        except (ValueError, AttributeError):
            return None
        with self.lock, self.engine.connect() as database:
            exists = database.execute(text("SELECT count(*) FROM sqlite_master WHERE type='view' AND name='signal_current_orders'")).scalar()
            if not exists:
                return None
            row = database.execute(text('SELECT decoration,summary,price FROM signal_current_orders WHERE id=:i'), {'i': identity}).first()
        if row is None:
            return None
        return {'ok': True, 'id': identity, **json.loads(row[0]), **json.loads(row[1]), 'reference': json.loads(row[2]),
                'source': 'SQLAlchemy / SQLite redis.sqlite', 'authority': 'derived analysis metadata'}
