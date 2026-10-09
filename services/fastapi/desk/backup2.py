import hashlib
import hmac
import importlib.util
import json
import os
import re
import sys
import threading
import uuid
import zlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException, Request
from starlette.concurrency import run_in_threadpool
from sqlalchemy import text


def delete():
    manifest = json.loads((Path(__file__).parent / 'receipt2.json').read_text(encoding='utf8'))
    if manifest.get('schema') != 'ocv.shared-source-map/1' or manifest.get('version') != '1.0.0':
        raise RuntimeError('The shared-analysis module map is unsupported')
    parents = Path(__file__).resolve().parents
    fallback = parents[3] if len(parents) > 3 else parents[1]
    root = Path(os.environ.get('OCV_SHARED_ROOT', fallback)).resolve()
    modules = {}
    allowed = {'config': 'config/4/7.py', 'stock': 'pinia/unused2/old.py', 'query': 'pcakage/stock2/2.py', 'paper': 'config/4/old2.py'}
    if manifest.get('files') != allowed:
        raise RuntimeError('The shared-analysis source map changed its fixed paths')
    for name, relative in manifest['files'].items():
        source = (root / relative).resolve()
        if not source.is_relative_to(root) or not source.is_file():
            raise RuntimeError('A declared shared-analysis module is unavailable')
        identity = 'ocv_shared_' + name + '2'
        spec = importlib.util.spec_from_file_location(identity, source)
        module = importlib.util.module_from_spec(spec)
        sys.modules[identity] = module
        spec.loader.exec_module(module)
        modules[name] = module
    return manifest, modules


MANIFEST, MODULES = delete()
TOOLS = MODULES['config']
MAXIMUM_RESPONSE = 2 * 1024 * 1024


class Data:
    def __init__(self, engine):
        self.engine = engine
        self.lock = threading.Lock()

    def schema(self, database):
        database.execute(text('CREATE TABLE IF NOT EXISTS sh3_order_items (id TEXT PRIMARY KEY,root_id TEXT NOT NULL,source_digest TEXT NOT NULL,invoice_digest TEXT NOT NULL,created_at TEXT NOT NULL)'))
        database.execute(text('CREATE TABLE IF NOT EXISTS sh3_warehouse_stock (id TEXT PRIMARY KEY,decoration BLOB NOT NULL,price INTEGER NOT NULL)'))
        database.execute(text('CREATE TABLE IF NOT EXISTS sh3_delivery_notes (id TEXT PRIMARY KEY,product_name TEXT NOT NULL)'))
        database.execute(text('CREATE INDEX IF NOT EXISTS sh3_source_orders ON sh3_order_items(root_id,source_digest)'))
        database.execute(text('CREATE VIEW IF NOT EXISTS sh3_current_orders AS SELECT i.id,i.root_id,i.source_digest,i.invoice_digest,i.created_at,s.decoration,s.price,n.product_name FROM sh3_order_items i JOIN sh3_warehouse_stock s ON s.id=i.id JOIN sh3_delivery_notes n ON n.id=i.id'))

    def restore(self, run_id=None, source_digest=None, identity=None):
        with self.lock, self.engine.begin() as database:
            self.schema(database)
            if identity is not None:
                row = database.execute(text('SELECT id,decoration,price,product_name,invoice_digest FROM sh3_current_orders WHERE id=:i'), {'i': identity}).first()
            else:
                row = database.execute(text('SELECT id,decoration,price,product_name,invoice_digest FROM sh3_current_orders WHERE root_id=:r AND source_digest=:d ORDER BY created_at DESC,id DESC LIMIT 1'), {'r': run_id, 'd': source_digest}).first()
        if row is None:
            return None
        identity, compressed, size, metadata, digest = row
        if not isinstance(compressed, bytes) or len(compressed) > TOOLS.LIMITS['metadataBytes'] or not 0 < size <= MAXIMUM_RESPONSE:
            raise RuntimeError('Shared-analysis receipt has an invalid stored byte count')
        inflater = zlib.decompressobj()
        raw = inflater.decompress(compressed, MAXIMUM_RESPONSE + 1)
        if not inflater.eof or inflater.unused_data or inflater.unconsumed_tail or len(raw) != size:
            raise RuntimeError('Shared-analysis receipt is incomplete or exceeds the decoding limit')
        checksum = hashlib.sha256(raw).hexdigest()
        declaration = json.loads(metadata)
        if declaration.get('sha256') != checksum or declaration.get('bytes') != size:
            raise RuntimeError('Shared-analysis receipt checksum does not match')
        report = json.loads(raw)
        if report.get('id') != identity or report.get('fingerprint') != digest:
            raise RuntimeError('Shared-analysis receipt identity changed during readback')
        for artifact in report.get('artifacts', []):
            content = artifact['content'].encode('utf8')
            if len(content) != artifact['bytes'] or hashlib.sha256(content).hexdigest() != artifact['sha256']:
                raise RuntimeError('Shared-analysis artifact checksum does not match')
        report['audit'] = {'storage': 'SQLAlchemy / SQLite redis.sqlite', 'authority': 'derived analysis receipt',
                           'id': identity, 'retention': TOOLS.LIMITS['retention'], 'tables': 3,
                           'compressedBytes': len(compressed), 'decodedBytes': size,
                           'maximumCompressedBytes': TOOLS.LIMITS['metadataBytes'],
                           'maximumDecodedBytes': MAXIMUM_RESPONSE, 'readbackVerified': True,
                           'payloadSha256': checksum}
        return report

    def invoice(self, report):
        raw = TOOLS.plain(report).encode('utf8')
        if len(raw) > MAXIMUM_RESPONSE:
            raise TOOLS.StockError('The derived report exceeds 2 MiB; select fewer rows or series')
        compressed = zlib.compress(raw, 6)
        if len(compressed) > TOOLS.LIMITS['metadataBytes']:
            raise TOOLS.StockError('The derived receipt exceeds its 256 KiB compressed retention limit')
        declaration = {'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': len(raw),
                       'artifacts': [{key: artifact[key] for key in ('name', 'mime', 'bytes', 'sha256')} for artifact in report['artifacts']]}
        identity, source = report['id'], report['source']
        with self.lock, self.engine.begin() as database:
            self.schema(database)
            database.execute(text('INSERT OR REPLACE INTO sh3_order_items VALUES (:i,:r,:d,:f,:t)'),
                             {'i': identity, 'r': source['runId'], 'd': report['sourceDigest'], 'f': report['fingerprint'], 't': datetime.now(timezone.utc).isoformat()})
            database.execute(text('INSERT OR REPLACE INTO sh3_warehouse_stock VALUES (:i,:p,:n)'), {'i': identity, 'p': compressed, 'n': len(raw)})
            database.execute(text('INSERT OR REPLACE INTO sh3_delivery_notes VALUES (:i,:p)'), {'i': identity, 'p': TOOLS.plain(declaration)})
            database.execute(text('DELETE FROM sh3_order_items WHERE rowid NOT IN(SELECT rowid FROM sh3_order_items ORDER BY rowid DESC LIMIT 64)'))
            database.execute(text('DELETE FROM sh3_warehouse_stock WHERE id NOT IN(SELECT id FROM sh3_order_items)'))
            database.execute(text('DELETE FROM sh3_delivery_notes WHERE id NOT IN(SELECT id FROM sh3_order_items)'))
        restored = self.restore(identity=identity)
        if restored is None or restored['fingerprint'] != report['fingerprint']:
            raise RuntimeError('The joined shared-analysis receipt could not be read back')
        return restored


class Common2:
    def __init__(self, engine, gate):
        self.gate = gate
        self.data = Data(engine)
        self.config = TOOLS.Common2()
        self.stock = MODULES['stock'].Config(TOOLS)
        self.paper = MODULES['paper'].Config(TOOLS)

    def read(self, value):
        if not isinstance(value, dict) or set(value) != {'action', 'runId', 'digest'} or value.get('action') != 'read':
            raise TOOLS.StockError('Read requires action, runId and source digest only')
        try:
            run_id = str(uuid.UUID(value['runId']))
        except (ValueError, TypeError, AttributeError):
            raise TOOLS.StockError('Receipt runId must be a UUID') from None
        if not isinstance(value['digest'], str) or not re.fullmatch(r'[0-9a-f]{64}', value['digest']):
            raise TOOLS.StockError('Receipt digest must be a lowercase SHA256')
        report = self.data.restore(run_id=run_id, source_digest=value['digest'])
        if report is None:
            raise HTTPException(status_code=404, detail='The derived analysis receipt is unavailable or expired')
        report['cacheHit'] = True
        return report

    def delete(self, value):
        if not self.gate.acquire(blocking=False):
            raise HTTPException(status_code=503, detail='The bounded analysis worker is busy')
        try:
            if isinstance(value, dict) and value.get('action') == 'read':
                return self.read(value)
            envelope = self.config.delete(value)
            cached = self.data.restore(identity=envelope.identity)
            if cached is not None:
                cached['cacheHit'] = True
                return cached
            primary = self.stock.delete(envelope.dataset, envelope.options)
            comparison = self.stock.delete(envelope.comparison, envelope.options) if envelope.comparison is not None else None
            query = MODULES['query'].Common(TOOLS).delete(primary, comparison, envelope.options)
            report = {'schema': 'ocv.shared-analysis-result/1', 'ok': True,
                      'engine': 'SH3/python-duckdb', 'version': MANIFEST['version'],
                      'id': envelope.identity, 'fingerprint': envelope.identity,
                      'source': envelope.source, 'sourceDigest': envelope.source.get('digest', envelope.identity),
                      'dataset': primary.metadata, 'comparisonDataset': comparison.metadata if comparison is not None else None,
                      'options': envelope.options, 'errorMessage': 'analysis completed',
                      'nativeResultReplaced': False, 'cacheHit': False,
                      'sources': ['DuckDB', 'SQLAlchemy', 'SQLite redis.sqlite'], **query}
            report['artifacts'] = self.paper.delete(report, envelope.options)
            return self.data.invoice(report)
        except TOOLS.StockError as error:
            raise HTTPException(status_code=409, detail=str(error)) from None
        except (KeyError, TypeError, ValueError, OverflowError, AttributeError, RecursionError):
            raise HTTPException(status_code=409, detail='The submitted dataset contains an invalid source row') from None
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=503, detail='The bounded derived receipt could not be processed or verified') from None
        finally:
            self.gate.release()


def mount_shared(app, engine, gate):
    office = Common2(engine, gate)

    @app.get('/shared/health')
    def health():
        return {'ok': True, 'engine': 'SH3/python-duckdb', 'version': MANIFEST['version'],
                'roles': ['derived dataset/query/statistics', 'sample-aligned comparison', 'SVG/CSV/JSON artifacts'],
                'limits': TOOLS.LIMITS, 'sourceKinds': list(TOOLS.KINDS),
                'sharedCe3Semaphore': 1, 'numericalAuthority': False, 'explicitSubmissionRequired': ['music', 'table']}

    @app.post('/shared/analysis.aspx')
    async def analysis(request: Request):
        key = os.environ.get('OCV_RUNNER_KEY', '')
        if not key:
            raise HTTPException(status_code=503, detail='The private analysis adapter is not configured')
        supplied = request.headers.get('X-Ocv-Runner', '')
        if not supplied or len(supplied) > 512 or not hmac.compare_digest(supplied.encode('utf8'), key.encode('utf8')):
            raise HTTPException(status_code=403, detail='The private analysis adapter requires a worker credential')
        payload = bytearray()
        async for chunk in request.stream():
            if len(payload) + len(chunk) > TOOLS.LIMITS['envelopeBytes']:
                raise HTTPException(status_code=413, detail='The shared-analysis envelope exceeds 8 MiB')
            payload.extend(chunk)
        try:
            value = json.loads(payload)
        except (ValueError, UnicodeDecodeError, RecursionError):
            raise HTTPException(status_code=409, detail='The shared-analysis envelope is not valid JSON') from None
        return await run_in_threadpool(office.delete, value)

    return office
