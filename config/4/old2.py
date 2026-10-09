import csv
import hashlib
import html
import io
import json
import math


class Config:
    def __init__(self, tools):
        self.tools = tools

    def paper(self, name, mime, content):
        payload = content.encode('utf8')
        if len(payload) > 1048576:
            raise self.tools.StockError('A generated analysis artifact exceeds 1 MiB')
        return {'name': name, 'mime': mime, 'content': content, 'bytes': len(payload),
                'sha256': hashlib.sha256(payload).hexdigest(), 'encoding': 'utf-8'}

    def safe_cell(self, value):
        if isinstance(value, str) and value[:1] in ('=', '+', '-', '@', '\t', '\r'):
            return "'" + value
        return value

    def csv(self, rows, fields):
        stream = io.StringIO(newline='')
        writer = csv.writer(stream, lineterminator='\n')
        writer.writerow(fields)
        for row in rows:
            writer.writerow([self.safe_cell(row.get(field)) for field in fields])
        return stream.getvalue()

    def bounds(self, values):
        low, high = min(values), max(values)
        if low == high:
            delta = max(1., abs(low) * .05)
            return low - delta, high + delta
        margin = (high - low) * .04
        return low - margin, high + margin

    def number(self, value):
        if value is None:
            return '—'
        return format(value, '.4g')

    def text(self, text, x, y, size=11, color='#53718d'):
        return f'<text x="{x:.2f}" y="{y:.2f}" fill="{color}" font-size="{size}">{html.escape(str(text), quote=True)}</text>'

    def frame(self, heading, panels):
        width, height = 960, max(320, 52 + math.ceil(max(1, len(panels)) / 2) * 174)
        content = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',
                   '<title>' + html.escape(heading) + '</title>',
                   '<rect width="100%" height="100%" fill="#f7fbff"/>',
                   '<g font-family="ui-monospace,Consolas,monospace">',
                   self.text(heading, 20, 25, 13, '#1f5995'),
                   '<path d="M20 36H940" stroke="#bcd1e7"/>']
        for index, panel in enumerate(panels):
            offset_x, offset_y = 18 + index % 2 * 472, 48 + index // 2 * 174
            content.append(f'<g transform="translate({offset_x},{offset_y})">')
            content.extend(panel)
            content.append('</g>')
        if not panels:
            content.append(self.text('No rows match the selected filters.', 25, 82, 12))
        content.extend(['</g>', '</svg>'])
        return ''.join(content)

    def line(self, series, scatter=False):
        panels = []
        for lane in series:
            points = lane['points']
            if not points:
                continue
            low_x, high_x = self.bounds([point[0] for point in points])
            low_y, high_y = self.bounds([point[1] for point in points] + [point[2] for point in points])
            project_x = lambda value: 50 + (value - low_x) / (high_x - low_x) * 378
            project_y = lambda value: 128 - (value - low_y) / (high_y - low_y) * 92
            title = lane['entity'] + ' / ' + lane['quantity'] + ' [' + lane['unit'] + ']'
            panel = ['<rect x="0.5" y="0.5" width="452" height="162" fill="#fff" stroke="#c8dbed"/>',
                     self.text(title[:70], 12, 19, 10, '#255e96')]
            for tick in range(5):
                y = 36 + tick * 23
                panel.append(f'<path d="M50 {y}H428" stroke="#edf3fa"/>')
            panel.append('<path d="M50 32V128H430" fill="none" stroke="#9ab7d4"/>')
            if scatter:
                panel.extend(f'<circle cx="{project_x(point[0]):.3f}" cy="{project_y(point[1]):.3f}" r="2" fill="#347bcc" fill-opacity=".75"/>' for point in points)
            else:
                if lane['unit'] == 'boolean':
                    commands = ' '.join((f'M{project_x(point[0]):.3f},{project_y(point[1]):.3f}' if index == 0
                                         else f'H{project_x(point[0]):.3f}V{project_y(point[1]):.3f}')
                                        for index, point in enumerate(points))
                else:
                    commands = ' '.join(('M' if index == 0 else 'L') + f'{project_x(point[0]):.3f},{project_y(point[1]):.3f}' for index, point in enumerate(points))
                panel.append('<path d="' + commands + '" fill="none" stroke="#3278cb" stroke-width="1.5"/>')
                if lane['rollingSamples'] > 1:
                    average = ' '.join(('M' if index == 0 else 'L') + f'{project_x(point[0]):.3f},{project_y(point[2]):.3f}' for index, point in enumerate(points))
                    panel.append('<path d="' + average + '" fill="none" stroke="#2bafaa" stroke-width="1.4"/>')
            panel += [self.text(self.number(high_y), 4, 40, 8), self.text(self.number(low_y), 4, 129, 8),
                      self.text(self.number(low_x), 50, 145, 8), self.text(self.number(high_x), 386, 145, 8),
                      self.text(lane['axisUnit'], 232, 153, 8),
                      self.text(str(lane['selectedPoints']) + '/' + str(lane['count']) + ' points', 320, 19, 8)]
            panels.append(panel)
        return self.frame('Source sample projection / ' + ('scatter' if scatter else 'sequence'), panels)

    def histogram(self, histogram):
        panels = []
        for lane in histogram:
            bins = lane['bins']
            if not bins:
                continue
            top = max(1, max(row['count'] for row in bins))
            domain_low = min(row['domainLow'] for row in bins)
            domain_high = max(row['domainHigh'] for row in bins)
            width = 376 / lane['configuredBins']
            panel = ['<rect x="0.5" y="0.5" width="452" height="162" fill="#fff" stroke="#c8dbed"/>',
                     self.text((lane['entity'] + ' / ' + lane['quantity'])[:65], 12, 19, 10, '#255e96'),
                     '<path d="M50 32V128H430" fill="none" stroke="#9ab7d4"/>']
            for row in bins:
                bar = row['count'] / top * 88
                panel.append(f'<rect x="{50 + row["bin"] * width:.3f}" y="{128-bar:.3f}" width="{max(.5,width-1):.3f}" height="{bar:.3f}" fill="#4986cd"/>')
            panel += [self.text(str(top), 6, 40, 9), self.text(self.number(domain_low), 50, 146, 8),
                      self.text(self.number(domain_high), 384, 146, 8), self.text(lane['unit'], 225, 153, 8),
                      self.text('observed numeric cells', 306, 19, 8)]
            panels.append(panel)
        return self.frame('Observed value distribution / occupied bins', panels)

    def heatmap(self, heatmaps):
        panel = ['<rect x=".5" y=".5" width="920" height="' + str(max(160, len(heatmaps) * 34 + 58)) + '" fill="#fff" stroke="#c8dbed"/>']
        for index, lane in enumerate(heatmaps):
            bins = lane['bins']
            if not bins:
                continue
            low, high = self.bounds([row['mean'] for row in bins])
            width, y = 640 / lane['configuredBins'], 30 + index * 34
            label = lane['entity'] + ' / ' + lane['quantity'] + ' [' + lane['unit'] + ']'
            panel.append(self.text(label[:35], 12, y + 15, 9, '#255e96'))
            for row in bins:
                level = (row['mean'] - low) / (high - low)
                color = f'rgb({round(211-155*level)},{round(235-105*level)},{round(251-45*level)})'
                cell_title = self.number(row['fromAxis']) + '–' + self.number(row['toAxis']) + ' ' + lane['axisUnit'] + ': ' + self.number(row['mean']) + ' ' + lane['unit'] + ' / n=' + str(row['count'])
                panel.append(f'<rect x="{246+row["bin"]*width:.2f}" y="{y}" width="{max(.5,width-1):.2f}" height="25" fill="{color}"><title>{html.escape(cell_title)}</title></rect>')
            panel.append(self.text(self.number(low) + '…' + self.number(high), 246, y + 31, 7))
        width, height = 960, max(250, len(heatmaps) * 34 + 122)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">'
                '<title>Observed source bins; each channel uses its own numeric scale</title><rect width="100%" height="100%" fill="#f7fbff"/>'
                '<g font-family="ui-monospace,Consolas,monospace">' + self.text('Source axis bins / per-channel numeric scale', 20, 25, 13, '#1f5995') +
                '<g transform="translate(18,42)">' + ''.join(panel) + '</g></g></svg>')

    def delete(self, report, options):
        chart_kind = options['chartKind']
        chart = self.histogram(report['histogram']) if chart_kind == 'histogram' else self.heatmap(report['heatmap']) if chart_kind == 'heatmap' else self.line(report['series'], chart_kind == 'scatter')
        artifacts = [self.paper('analysis.svg', 'image/svg+xml', chart),
                     self.paper('heatmap.svg', 'image/svg+xml', self.heatmap(report['heatmap'])),
                     self.paper('samples.csv', 'text/csv', self.csv(report['records'], self.tools.FIELDS))]
        statistics_fields = list(dict.fromkeys(field for row in report['statistics'] for field in row))
        artifacts.append(self.paper('statistics.csv', 'text/csv', self.csv(report['statistics'], statistics_fields or ['quantity', 'unit', 'count'])))
        if report.get('comparison'):
            fields = ('entity', 'quantity', 'unit', 'axisUnit', 'count', 'bias', 'rmse', 'maxAbsoluteError', 'correlation')
            artifacts.append(self.paper('comparison.csv', 'text/csv', self.csv(report['comparison']['groups'], fields)))
        # The JSON artifact precedes artifacts/audit, preventing recursive self-embedding.
        artifacts.append(self.paper('analysis.json', 'application/json', self.tools.plain(report)))
        return artifacts
