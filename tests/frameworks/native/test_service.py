import json
import urllib.request

def get(path):
    with urllib.request.urlopen('http://fastapi:8000' + path, timeout=6) as response:
        assert response.status == 200
        return json.load(response)

def test_duckdb_reads_real_formal_sources():
    value = get('/api/analysis.php')
    assert value['total'] == 6
    assert value['csvRows'] == 3
    assert len(value['sources']) == 4
    assert value['meetsPolicy'] is True

def test_sqlite_service_is_reachable():
    value = get('/health')
    assert value['canContinue'] is True
