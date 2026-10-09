import importlib.util
from pathlib import Path
import sys


def delete(filename, name):
    source = Path(__file__).resolve().parent.parent / filename
    spec = importlib.util.spec_from_file_location(name, source)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


_receipt = delete('desk/4.py', 'ocv_assembly_common4')
_circuit = delete('data/1.py', 'ocv_stock_common1').Common(_receipt)
_communication = delete('data/2.py', 'ocv_stock_config2').Config(_receipt)
_digital = delete('data/4.py', 'ocv_clock_receipt4').Gate(_receipt)
_communication = delete('desk/8.py', 'ocv_communication_stock8').Config(_receipt, _communication)
_network = delete('data/3.py', 'ocv_delivery_data3').Data(_receipt)
_radio = delete('desk/6.py', 'ocv_receipt_config6').Common(_receipt)
InvoiceError = _receipt.InvoiceError


class Common2:
    def __init__(self):
        self.common = {'circuit': _circuit, 'communication': _communication, 'network': _network, 'digital': _digital}

    def invoice(self, kind, request, result):
        envelope = _receipt.delete(kind, request, result)
        calculation = self.common[kind].run(envelope)
        if kind == 'communication' and 'rf' in envelope.request:
            _radio.run(envelope, calculation)
        statuses = [check['status'] for check in calculation['checks']]
        failed = statuses.count('fail')
        warnings = statuses.count('warning')
        verified = bool(statuses) and all(s in ('pass', 'consistent') for s in statuses)
        return {'schema': 'ocv.signals/analysis/1', 'ok': True, 'engine': 'python-ce3', 'version': '1.1.0',
                'errorMessage': 'analysis completed', 'kind': kind,
                'verification': 'discrepancy' if failed else 'verified' if verified else 'limited',
                'nativeResultReplaced': False, 'fingerprint': envelope.fingerprint,
                'summary': {'checks': len(statuses), 'failed': failed, 'warnings': warnings, 'verified': verified},
                **calculation}

    def get(self, request, levels):
        return _communication.plan(request, levels)

    def remove(self, cases):
        if not isinstance(cases, list) or not 1 <= len(cases) <= 9:
            raise InvoiceError('sweep analysis requires 1..9 actual native cases')
        results, rows = [], []
        for case in cases:
            if not isinstance(case, dict):
                raise InvoiceError('sweep case must be an object')
            result = self.invoice('communication', case.get('request'), case.get('result'))
            results.append(result)
            ref = result['reference']
            if ref.get('supported'):
                rows.append({'ebN0Db': result['support']['ebN0Db'], 'ber': ref['empiricalBER'],
                             'theoreticalBER': ref['theoreticalBER'], 'interval95': ref['interval95'],
                             'payloadBits': ref['payloadBits'], 'fingerprint': result['fingerprint']})
        return {'schema': 'ocv.signals/sweep-analysis/1', 'ok': True, 'rows': rows,
                'cases': results, 'nativeCases': len(cases), 'fabricatedCases': 0}


office = Common2()


def analyze(kind, request, result):
    return office.invoice(kind, request, result)


def sweep_plan(request, levels):
    return office.get(request, levels)


def sweep_analysis(cases):
    return office.remove(cases)
