import hashlib
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import unittest

from sqlalchemy import create_engine, text


_path = Path(__file__).resolve().parents[2] / 'services' / 'fastapi' / 'desk' / 'old.py'
_spec = importlib.util.spec_from_file_location('ce3_storage_acceptance', _path)
storage = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = storage
_spec.loader.exec_module(storage)


def report(index):
    return {'schema': 'ocv.signals/analysis/1', 'kind': 'circuit', 'verification': 'verified',
            'summary': {'checks': 1, 'failed': 0}, 'fingerprint': hashlib.sha256(str(index).encode()).hexdigest(),
            'checks': [{'code': 'REFERENCE', 'status': 'pass', 'message': 'analytic comparison'}],
            'reference': {'supported': True, 'model': 'divider', 'rows': [{'value': 8}]}}


class DerivedAuditStorage(unittest.TestCase):
    def setUp(self):
        directory = Path(os.environ.get('OCV_SIGNAL_TEST_DATA', '/ocv-deps/test-signals'))
        directory.mkdir(parents=True, exist_ok=True)
        self.folder = tempfile.TemporaryDirectory(prefix='ce3-', dir=directory)
        self.engine = create_engine('sqlite:///' + str(Path(self.folder.name) / 'audit.sqlite'))
        self.office = storage.Config(self.engine)

    def tearDown(self):
        self.engine.dispose()
        self.folder.cleanup()

    def test_three_real_tables_are_joined_without_becoming_project_authority(self):
        receipt = self.office.delete(report(7))
        readback = self.office.restore(receipt['id'])
        self.assertTrue(receipt['readbackVerified'])
        self.assertEqual(readback['fingerprint'], report(7)['fingerprint'])
        self.assertEqual(readback['checks'][0]['status'], 'pass')
        self.assertEqual(readback['authority'], 'derived analysis metadata')
        self.assertEqual(readback['reference']['rows'] if 'rows' in readback['reference'] else [], [])
        self.assertEqual(readback['reference']['originalReferenceRows'], 1)
        with self.engine.connect() as database:
            self.assertEqual(database.execute(text('SELECT count(*) FROM signal_current_orders')).scalar(), 1)

    def test_oldest_receipts_and_all_child_rows_expire_at_128(self):
        first = self.office.delete(report(0))
        last = None
        for index in range(1, 130):
            last = self.office.delete(report(index))
        self.assertIsNone(self.office.restore(first['id']))
        self.assertIsNotNone(self.office.restore(last['id']))
        with self.engine.connect() as database:
            for table in ('signal_order_items', 'signal_warehouse_stock', 'signal_delivery_notes'):
                self.assertEqual(database.execute(text('SELECT count(*) FROM ' + table)).scalar(), 128)


if __name__ == '__main__':
    unittest.main()
