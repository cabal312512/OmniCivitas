/**
 * Phase 5 local text workbench API.
 * `tools` contains portable, inert descriptors; parsers load only when a tool runs.
 * run(input, { signal? }) returns canonical text plus optional safe HTML/table.
 * Expected validation failures throw short errors for the workbench to display.
 * No network requests, persistent storage or browser globals run on import.
 */
export const MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
export const MAX_FILE_BYTES = MAX_INPUT_BYTES;
const MAX_CSV_ROWS = 5000;
const MAX_CSV_COLUMNS = 256;

function abort(context) {
  if (context?.signal?.aborted) throw new DOMException('操作已取消', 'AbortError');
}

function sourceOf(input, key = 'source') {
  const text = String(input?.[key] ?? '');
  if (text.length > MAX_INPUT_BYTES || new TextEncoder().encode(text).length > MAX_INPUT_BYTES) {
    throw new Error('输入不能超过 2 MiB');
  }
  return text;
}

function result(text, options = {}) {
  const output = String(text);
  if (output.length > MAX_OUTPUT_BYTES || new TextEncoder().encode(output).length > MAX_OUTPUT_BYTES) {
    throw new Error('输出不能超过 4 MiB');
  }
  return { text: output, extension: 'txt', mime: 'text/plain;charset=utf-8', ...options };
}

function mode(input, options, fallback) {
  const operation = input?.operation ?? fallback;
  if (!options.includes(operation)) throw new Error('请选择有效的操作');
  return operation;
}

function validUnicode(text) {
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error('文本含有不完整的 Unicode 字符');
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      throw new Error('文本含有不完整的 Unicode 字符');
    }
  }
}

export function encodeBase64(text) {
  validUnicode(text);
  const bytes = new TextEncoder().encode(text);
  // Avoid argument-count limits for large UTF-8 input.
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function decodeBase64(source) {
  const compact = source.replace(/[\t\n\r ]/g, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(compact) || compact.length % 4 === 1 ||
      (compact.includes('=') && compact.length % 4 !== 0)) throw new Error('不是有效的 Base64');
  const padded = compact.padEnd(Math.ceil(compact.length / 4) * 4, '=');
  let binary;
  try { binary = atob(padded); } catch { throw new Error('不是有效的 Base64'); }
  // atob accepts non-zero unused bits; reject these non-canonical encodings.
  if (btoa(binary) !== padded) throw new Error('不是有效的 Base64');
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(
      Uint8Array.from(binary, char => char.charCodeAt(0))
    );
  } catch { throw new Error('解码结果不是有效的 UTF-8 文本'); }
}

function normalizeLines(text) { return text.replace(/\r\n?/g, '\n'); }

export function textStatistics(source) {
  const text = normalizeLines(source);
  let codePoints = 0, nonWhitespace = 0, graphemes = 0, words = 0, lines = text ? 1 : 0;
  // Iterate segmenters rather than retaining a record per character.
  for (const char of text) {
    codePoints++;
    if (!/\s/u.test(char)) nonWhitespace++;
    if (char === '\n') lines++;
  }
  for (const _ of new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text)) graphemes++;
  for (const part of new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)) if (part.isWordLike) words++;
  return {
    codePoints,
    graphemes,
    nonWhitespace,
    words,
    lines,
    utf8Bytes: new TextEncoder().encode(source).length
  };
}

function formatXml(source) {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    throw new Error('XML 缩进需要浏览器');
  }
  if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(source)) throw new Error('缩进演示不读取 DTD 或实体声明');
  const doc = new DOMParser().parseFromString(source, 'application/xml');
  const invalid = Array.from(doc.getElementsByTagName('parsererror')).some(
    node => node.namespaceURI === 'http://www.mozilla.org/newlayout/xml/parsererror.xml'
  );
  if (invalid || !doc.documentElement) throw new Error('无法解析该结构');
  const stack = [{ node: doc.documentElement, depth: 0 }];
  let nodes = 0;
  while (stack.length) {
    const { node, depth } = stack.pop();
    if (depth > 64) throw new Error('XML 层级不能超过 64');
    if (++nodes > 50000) throw new Error('XML 节点不能超过 50000');
    for (const child of node.childNodes) stack.push({ node: child, depth: depth + 1 });
  }
  const serializer = new XMLSerializer();
  function indent(node, depth) {
    if (depth > 64) throw new Error('XML 层级不能超过 64');
    const padding = '  '.repeat(depth);
    // Mixed content, CDATA and all text (including whitespace) retain their
    // serialized subtree. This is an indentation demo, not a full formatter.
    if (node.nodeType !== 1 || Array.from(node.childNodes).some(child => child.nodeType === 3 || child.nodeType === 4)) {
      return padding + serializer.serializeToString(node);
    }
    if (!node.childNodes.length) return padding + serializer.serializeToString(node);
    const opening = serializer.serializeToString(node.cloneNode(false)).replace(/\/>$/, '>');
    const children = Array.from(node.childNodes, child => indent(child, depth + 1));
    return `${padding}${opening}\n${children.join('\n')}\n${padding}</${node.nodeName}>`;
  }
  const declaration = source.match(/^\uFEFF?\s*(<\?xml\s[^?]*\?>)/)?.[1];
  const formatted = Array.from(doc.childNodes, node => indent(node, 0)).join('\n');
  return declaration ? declaration + '\n' + formatted : formatted;
}

const MORSE = Object.freeze({
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-',
  '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
});
const REVERSE_MORSE = Object.fromEntries(Object.entries(MORSE).map(([key, value]) => [value, key]));

function unsupported(chars) {
  const unique = [...new Set(chars)].slice(0, 16);
  throw new Error('不支持的字符：' + unique.join(' '));
}

export function encodeMorse(source) {
  const text = source.toUpperCase().trim();
  const invalid = Array.from(text).filter(char => !/\s/u.test(char) && !Object.hasOwn(MORSE, char));
  if (invalid.length) unsupported(invalid);
  if (!text) return '';
  return text.split(/\s+/u).map(word => Array.from(word, char => MORSE[char]).join(' ')).join(' / ');
}

export function decodeMorse(source) {
  if (!source.trim()) return '';
  const tokens = source.trim().split(/\s+/u);
  const invalid = tokens.filter(token => token !== '/' && !Object.hasOwn(REVERSE_MORSE, token));
  if (invalid.length) throw new Error('不是有效的摩斯片段：' + invalid.slice(0, 8).join(' '));
  return tokens.map(token => token === '/' ? ' ' : REVERSE_MORSE[token]).join('');
}

// Original small 5 × 5 glyphs. No image-to-ASCII claim or external font asset.
const GLYPHS = {
  A: [' ### ', '#   #', '#####', '#   #', '#   #'], B: ['#### ', '#   #', '#### ', '#   #', '#### '],
  C: [' ####', '#    ', '#    ', '#    ', ' ####'], D: ['#### ', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#### ', '#    ', '#####'], F: ['#####', '#    ', '#### ', '#    ', '#    '],
  G: [' ####', '#    ', '# ###', '#   #', ' ####'], H: ['#   #', '#   #', '#####', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '#####'], J: ['  ###', '    #', '    #', '#   #', ' ### '],
  K: ['#   #', '#  # ', '###  ', '#  # ', '#   #'], L: ['#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '#   #', '#   #'], N: ['#   #', '##  #', '# # #', '#  ##', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', ' ### '], P: ['#### ', '#   #', '#### ', '#    ', '#    '],
  Q: [' ### ', '#   #', '# # #', '#  ##', ' ####'], R: ['#### ', '#   #', '#### ', '#  # ', '#   #'],
  S: [' ####', '#    ', ' ### ', '    #', '#### '], T: ['#####', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', ' ### '], V: ['#   #', '#   #', '#   #', ' # # ', '  #  '],
  W: ['#   #', '#   #', '# # #', '## ##', '#   #'], X: ['#   #', ' # # ', '  #  ', ' # # ', '#   #'],
  Y: ['#   #', ' # # ', '  #  ', '  #  ', '  #  '], Z: ['#####', '   # ', '  #  ', ' #   ', '#####'],
  0: [' ### ', '#  ##', '# # #', '##  #', ' ### '], 1: ['  #  ', ' ##  ', '  #  ', '  #  ', ' ### '],
  2: [' ### ', '#   #', '   # ', ' #   ', '#####'], 3: ['#### ', '    #', ' ### ', '    #', '#### '],
  4: ['#  # ', '#  # ', '#####', '   # ', '   # '], 5: ['#####', '#    ', '#### ', '    #', '#### '],
  6: [' ### ', '#    ', '#### ', '#   #', ' ### '], 7: ['#####', '   # ', '  #  ', ' #   ', ' #   '],
  8: [' ### ', '#   #', ' ### ', '#   #', ' ### '], 9: [' ### ', '#   #', ' ####', '    #', ' ### '],
  ' ': ['     ', '     ', '     ', '     ', '     '], '.': ['     ', '     ', '     ', '     ', '  #  '],
  '!': ['  #  ', '  #  ', '  #  ', '     ', '  #  '], '?': [' ### ', '#   #', '   # ', '     ', '  #  '],
  '-': ['     ', '     ', '#####', '     ', '     ']
};

export function asciiLetters(source, ink = '#') {
  const text = normalizeLines(source).toUpperCase();
  if (text.length > 160 || text.split('\n').length > 10) throw new Error('字符画最多 160 字符、10 行');
  if (!/^[!-~]$/.test(ink)) throw new Error('笔画只能是一个可见 ASCII 字符');
  if (!text) return '';
  const invalid = Array.from(text).filter(char => char !== '\n' && !Object.hasOwn(GLYPHS, char));
  if (invalid.length) unsupported(invalid);
  return text.split('\n').map(line => Array.from({ length: 5 }, (_, row) =>
    Array.from(line, char => GLYPHS[char][row].replaceAll('#', ink)).join(' ')
  ).join('\n')).join('\n\n');
}

const source = (value = '') => ({ key: 'source', label: '内容', type: 'textarea', default: value });
const operation = (options, value) => ({ key: 'operation', label: '操作', type: 'select', default: value,
  options: options.map(([value, label]) => ({ value, label })) });
const descriptor = (id, title, requirement, fields, run, group = '文本') => ({ id, title, requirements: [requirement], group, fields, run });

export const tools = [
  descriptor('base64', 'Base64', 'B026', [source('OmniCivitas OCV 🧪'), operation([['encode', '编码'], ['decode', '解码']], 'encode')],
    async input => result(mode(input, ['encode', 'decode'], 'encode') === 'encode' ? encodeBase64(sourceOf(input)) : decodeBase64(sourceOf(input)))),
  descriptor('json', 'JSON', 'B027', [source('{"OCV":true,"版本":5}'), operation([['format', '格式化'], ['compact', '压缩']], 'format')], async input => {
    const action = mode(input, ['format', 'compact'], 'format');
    let value;
    // Keep native JSON.parse's finite JavaScript-number semantics. Large
    // integers must be strings; do not silently round them or export null.
    try {
      value = JSON.parse(sourceOf(input), (_key, value) => {
        if (typeof value === 'number') {
          if (!Number.isFinite(value)) throw new Error('数值超出 JavaScript 有限数范围');
          if (Number.isInteger(value) && !Number.isSafeInteger(value)) throw new Error('大整数超出安全精度，请改为字符串');
        }
        return value;
      });
    } catch (error) { throw new Error('JSON 无效：' + error.message); }
    return result(JSON.stringify(value, null, action === 'format' ? 2 : undefined), { extension: 'json', mime: 'application/json' });
  }, '开发'),
  descriptor('xml', 'XML 缩进', 'B028', [source('<root><item>OCV</item><item><![CDATA[ x < y ]]></item></root>')],
    async input => result(formatXml(sourceOf(input)), { extension: 'xml', mime: 'application/xml' }), '开发'),
  descriptor('text', '字数', 'B040', [source('OCV，Hello 👨‍👩‍👧‍👦\n第二行')], async input => {
    const stats = textStatistics(sourceOf(input));
    const table = [['项目', '数量'], ['Unicode 码点', stats.codePoints], ['可见字素（含空白）', stats.graphemes],
      ['非空白码点', stats.nonWhitespace], ['词', stats.words], ['行', stats.lines], ['UTF-8 字节', stats.utf8Bytes]]
      .map(row => row.map(String));
    return result(table.slice(1).map(row => row.join('\t')).join('\n'), { table });
  }),
  descriptor('text-dedupe', '按行去重', 'B041', [source('alpha\nbeta\nalpha')],
    async input => result([...new Set(normalizeLines(sourceOf(input)).split('\n'))].join('\n'))),
  descriptor('text-sort', '按行排序', 'B042', [source('gamma\na\nbeta'), operation([['lexical', '字典序'], ['length', '长度']], 'lexical'),
    { key: 'direction', label: '方向', type: 'select', default: 'asc', options: [{ value: 'asc', label: '升序' }, { value: 'desc', label: '降序' }] }], async input => {
    const action = mode(input, ['lexical', 'length'], 'lexical');
    const direction = input?.direction ?? 'asc';
    if (!['asc', 'desc'].includes(direction)) throw new Error('请选择排序方向');
    const sign = direction === 'asc' ? 1 : -1;
    const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
    const rows = normalizeLines(sourceOf(input)).split('\n');
    if (rows.length > 100000) throw new Error('排序最多 100000 行');
    rows.sort((a, b) => sign * (action === 'length' ? Array.from(a).length - Array.from(b).length || compare(a, b) : compare(a, b)));
    return result(rows.join('\n'));
  }),
  descriptor('text-case', '大小写', 'B043', [source('Hello OmniCivitas'), operation([['upper', '大写'], ['lower', '小写'], ['title', '首字母大写']], 'upper')], async input => {
    const action = mode(input, ['upper', 'lower', 'title'], 'upper');
    const text = sourceOf(input);
    return result(action === 'upper' ? text.toUpperCase() : action === 'lower' ? text.toLowerCase() :
      text.toLowerCase().replace(/\p{L}[\p{L}\p{M}]*/gu, word => Array.from(word)[0].toUpperCase() + word.slice(Array.from(word)[0].length)));
  }),
  descriptor('markdown', 'Markdown', 'B044', [source('# OmniCivitas\n\n**OCV** / `const phase = 5`')], async (input, context) => {
    const text = sourceOf(input);
    abort(context);
    const [{ marked }, { default: purifier }] = await Promise.all([import('marked'), import('dompurify')]);
    abort(context);
    if (typeof purifier.sanitize !== 'function') throw new Error('Markdown 预览需要浏览器');
    const parsed = marked.parse(text, { async: false, gfm: true });
    if (parsed.length > MAX_OUTPUT_BYTES) throw new Error('预览不能超过 4 MiB');
    const html = purifier.sanitize(parsed, {
      ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'blockquote',
        'code', 'pre', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'del'],
      ALLOWED_ATTR: ['href', 'title'], ALLOWED_URI_REGEXP: /^#/,
      ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, RETURN_TRUSTED_TYPE: false
    });
    if (new TextEncoder().encode(html).length > MAX_OUTPUT_BYTES) throw new Error('预览不能超过 4 MiB');
    return result(text, { html, extension: 'md', mime: 'text/markdown;charset=utf-8' });
  }, '开发'),
  descriptor('csv', 'CSV', 'B045', [source('name,note\nOCV,"逗号,在这里"'),
    { key: 'file', label: '或选文件（2 MiB 内）', type: 'file', accept: '.csv,text/csv' }], async (input, context) => {
    abort(context);
    let text;
    const file = input?.file;
    if (file != null && file !== '') {
      if (typeof file.arrayBuffer !== 'function' || !Number.isFinite(file.size) || file.size < 0) throw new Error('请选择 CSV 文件');
      if (file.size > MAX_FILE_BYTES) throw new Error('CSV 文件不能超过 2 MiB');
      const bytes = await file.arrayBuffer();
      abort(context);
      if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('CSV 文件不能超过 2 MiB');
      try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
      catch { throw new Error('CSV 文件需要有效的 UTF-8 编码'); }
      text = sourceOf({ source: text });
    } else text = sourceOf(input);
    const { default: Papa } = await import('papaparse');
    abort(context);
    const parsed = Papa.parse(text, { delimiter: ',', header: false, dynamicTyping: false, skipEmptyLines: false,
      preview: MAX_CSV_ROWS + 1 });
    if (parsed.errors.length) throw new Error('CSV 无效：' + parsed.errors[0].message);
    if (parsed.meta.truncated || parsed.data.length > MAX_CSV_ROWS) throw new Error('CSV 最多 5000 行');
    if (parsed.data.some(row => row.length > MAX_CSV_COLUMNS)) throw new Error('CSV 最多 256 列');
    const table = parsed.data.map(row => row.map(String));
    return result(Papa.unparse(table, { newline: '\r\n', escapeFormulae: false }), { table, extension: 'csv', mime: 'text/csv;charset=utf-8' });
  }, '开发'),
  descriptor('ascii', 'ASCII 字符画', 'B059', [source('OMNI'), { key: 'ink', label: '笔画', type: 'text', default: '#' }],
    async input => result(asciiLetters(sourceOf(input), String(input?.ink ?? '#')))),
  descriptor('morse', '摩斯电码', 'B060', [source('SOS CIVILIZATION 5'), operation([['encode', '编码'], ['decode', '解码']], 'encode')],
    async input => result(mode(input, ['encode', 'decode'], 'encode') === 'encode' ? encodeMorse(sourceOf(input)) : decodeMorse(sourceOf(input))))
];
