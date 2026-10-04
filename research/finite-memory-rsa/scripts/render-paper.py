#!/usr/bin/env python3
"""Render the archived Markdown report, without simulations or data selection.

Only the Markdown subset used by this report is accepted. Fonts are obtained
from the plotting dependency, so no machine-specific font path is required.
"""
import argparse
import html
import re
from pathlib import Path

import matplotlib
from PIL import Image as PILImage
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether,
)

ROOT = Path(__file__).resolve().parents[1]
NAVY = colors.HexColor('#142c48')
INK = colors.HexColor('#202a35')


def inline(text):
    text = html.escape(text)
    text = re.sub(r'`([^`]+)`', r'<font name="ResearchMono" size="8.5">\1</font>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(https?://\S+)', r'<link href="\1" color="#245a8c">\1</link>', text)
    return text


def register_fonts():
    folder = Path(matplotlib.get_data_path()) / 'fonts' / 'ttf'
    for name, filename in [
        ('ResearchSerif', 'DejaVuSerif.ttf'),
        ('ResearchSerifBold', 'DejaVuSerif-Bold.ttf'),
        ('ResearchSerifItalic', 'DejaVuSerif-Italic.ttf'),
        ('ResearchSans', 'DejaVuSans.ttf'),
        ('ResearchSansBold', 'DejaVuSans-Bold.ttf'),
        ('ResearchMono', 'DejaVuSansMono.ttf'),
    ]:
        pdfmetrics.registerFont(TTFont(name, str(folder / filename)))
    pdfmetrics.registerFontFamily('ResearchSerif', normal='ResearchSerif',
        bold='ResearchSerifBold', italic='ResearchSerifItalic', boldItalic='ResearchSerifBold')
    pdfmetrics.registerFontFamily('ResearchSans', normal='ResearchSans', bold='ResearchSansBold')


def render(source, output):
    register_fonts()
    width = A4[0] - 38 * mm
    styles = {
        'body': ParagraphStyle('body', fontName='ResearchSerif', fontSize=9.8,
            leading=14.1, textColor=INK, spaceAfter=7, splitLongWords=True),
        'title': ParagraphStyle('title', fontName='ResearchSansBold', fontSize=21,
            leading=26, textColor=NAVY, spaceAfter=12, keepWithNext=True),
        'meta': ParagraphStyle('meta', fontName='ResearchSans', fontSize=8,
            leading=12, textColor=colors.HexColor('#536779'), spaceAfter=17),
        'h2': ParagraphStyle('h2', fontName='ResearchSansBold', fontSize=12.3,
            leading=17, textColor=NAVY, spaceBefore=11, spaceAfter=6, keepWithNext=True),
        'h3': ParagraphStyle('h3', fontName='ResearchSansBold', fontSize=10.3,
            leading=14, textColor=NAVY, spaceBefore=8, spaceAfter=5, keepWithNext=True),
        'caption': ParagraphStyle('caption', fontName='ResearchSerif', fontSize=8.3,
            leading=11.5, textColor=colors.HexColor('#394f63'), spaceAfter=12),
        'cell': ParagraphStyle('cell', fontName='ResearchSans', fontSize=7.3,
            leading=10, textColor=INK),
        'header': ParagraphStyle('header', fontName='ResearchSansBold', fontSize=7.3,
            leading=10, textColor=NAVY),
    }
    lines = source.read_text(encoding='utf8').splitlines()
    story, index = [], 0
    while index < len(lines):
        line = lines[index].strip()
        index += 1
        if not line:
            continue
        if line.startswith('# '):
            story.append(Paragraph(inline(line[2:]), styles['title']))
        elif line.startswith('## '):
            story.append(Paragraph(inline(line[3:]), styles['h2']))
        elif line.startswith('### '):
            story.append(Paragraph(inline(line[4:]), styles['h3']))
        elif line.startswith('Independent computational'):
            story.append(Paragraph(inline(line), styles['meta']))
        elif line.startswith('|'):
            table_lines = [line]
            while index < len(lines) and lines[index].strip().startswith('|'):
                table_lines.append(lines[index].strip())
                index += 1
            rows = [[cell.strip() for cell in item.strip('|').split('|')]
                    for item in table_lines if not re.fullmatch(r'[|\s: -]+', item)]
            count = len(rows[0])
            if any(len(row) != count for row in rows):
                raise ValueError('Malformed Markdown table')
            cells = [[Paragraph(inline(cell), styles['header' if r == 0 else 'cell'])
                      for cell in row] for r, row in enumerate(rows)]
            # Tables are short and use wrapped column headers, not clipped text.
            weights = [1.0] * count
            if rows[0][0] in {'Policy', 'Experiment'}:
                weights[0] = 1.65
            if rows[0][-1] == '95% gain interval':
                weights[-1] = 2.0
            widths = [width * w / sum(weights) for w in weights]
            table = Table(cells, colWidths=widths, repeatRows=1, hAlign='LEFT')
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#e9eff4')),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7f9fb')]),
                ('LINEBELOW', (0, 0), (-1, 0), .65, colors.HexColor('#849aae')),
                ('LINEBELOW', (0, -1), (-1, -1), .35, colors.HexColor('#a9bac9')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            while index < len(lines) and not lines[index].strip():
                index += 1
            group = [Spacer(1, 5), table, Spacer(1, 5)]
            if index < len(lines) and re.match(r'Table\s*\d', lines[index]):
                group.append(Paragraph(inline(lines[index]), styles['caption']))
                index += 1
            story.append(KeepTogether(group))
        elif line.startswith('!['):
            match = re.fullmatch(r'!\[([^]]*)\]\(([^)]+)\)', line)
            if not match:
                raise ValueError('Malformed figure reference')
            image_path = (source.parent / match.group(2)).resolve()
            with PILImage.open(image_path) as im:
                image_width, image_height = im.size
            scale = min(width / image_width, 98 * mm / image_height)
            group = [Spacer(1, 7), Image(str(image_path), image_width * scale,
                image_height * scale, hAlign='CENTER'), Spacer(1, 6)]
            while index < len(lines) and not lines[index].strip():
                index += 1
            if index < len(lines) and re.match(r'Figure\s*\d', lines[index]):
                group.append(Paragraph(inline(lines[index]), styles['caption']))
                index += 1
            story.append(KeepTogether(group))
        elif re.match(r'^\d+\. ', line):
            story.append(Paragraph(inline(line), styles['body']))
        else:
            paragraph = [line]
            while index < len(lines) and lines[index].strip() and not lines[index].startswith(('#', '|', '![')):
                paragraph.append(lines[index].strip())
                index += 1
            story.append(Paragraph(inline(' '.join(paragraph)), styles['body']))

    def footer(canvas, document):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#bdcbd7'))
        canvas.setLineWidth(.35)
        canvas.line(19 * mm, 16 * mm, A4[0] - 19 * mm, 16 * mm)
        canvas.setFont('ResearchSans', 7)
        canvas.setFillColor(colors.HexColor('#586b7d'))
        canvas.drawString(19 * mm, 12 * mm, 'Finite-memory RSA | computational research draft')
        canvas.drawRightString(A4[0] - 19 * mm, 12 * mm, str(document.page))
        canvas.restoreState()

    output.parent.mkdir(parents=True, exist_ok=True)
    document = SimpleDocTemplate(str(output), pagesize=A4,
        leftMargin=19 * mm, rightMargin=19 * mm, topMargin=18 * mm,
        bottomMargin=23 * mm, title=lines[0].lstrip('# '),
        author='Independent computational research project',
        subject='Finite-memory control, geometric jamming and policy deadlock')
    document.build(story, onFirstPage=footer, onLaterPages=footer)
    reader = PdfReader(output)
    # The PDF contains font subsets, so distribute their actual notice inside
    # the standalone artifact as well as alongside the source paper.
    font_license = Path(matplotlib.get_data_path()) / 'fonts' / 'ttf' / 'LICENSE_DEJAVU'
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    writer.add_attachment('FONT_LICENSE.txt', font_license.read_bytes())
    with output.open('wb') as stream:
        writer.write(stream)
    reader = PdfReader(output)
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    for token in ['Abstract', 'References', '0.906823', '226,816', '0.00703']:
        if token not in text:
            raise ValueError('PDF text verification failed: ' + token)
    if '{{' in text or '\ufffd' in text:
        raise ValueError('Unresolved placeholder or replacement glyph')
    print(f'{output.name}: {len(reader.pages)} pages, {len(text)} extracted characters')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=ROOT / 'paper/paper.md')
    parser.add_argument('--output', type=Path, default=ROOT / 'paper/paper.pdf')
    args = parser.parse_args()
    render(args.input.resolve(), args.output.resolve())
