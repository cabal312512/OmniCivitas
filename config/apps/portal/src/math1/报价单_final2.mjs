// 报价单改作本地工具。Math.js 只在打开计算/矩阵工具后加载。
const MAX_DATE_MS = 8640000000000000n;
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const ZONES = ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'Europe/London', 'America/New_York', 'America/Los_Angeles'];
let mathPromise;

async function getMath() {
  mathPromise ??= import('mathjs');
  return mathPromise;
}

function fail(message) { throw new Error(message); }
function finite(value, label = '数值') {
  const source = String(value ?? '').trim();
  if (source.length > 80 || !NUMBER_PATTERN.test(source)) fail(`${label}必须是有限数字`);
  const number = Number(source);
  if (!Number.isFinite(number)) fail(`${label}超出可计算范围`);
  return number;
}
function checked(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('结果不是有限实数');
  return Object.is(value, -0) ? 0 : value;
}
// Number 的最短可往返文本；不擅自砍掉有效位或改变安全整数。
export function formatNumber(value) { return String(checked(value)); }
const choice = (value, allowed, label) => allowed.includes(value) ? value : fail(`${label}无效`);

export function timestampToMilliseconds(value, precision = 'seconds') {
  choice(precision, ['seconds', 'milliseconds'], '时间戳单位');
  const source = String(value ?? '').trim();
  const match = /^([+-]?)(\d{1,17})(?:\.(\d{1,3}))?$/.exec(source);
  if (!match || (precision === 'milliseconds' && match[3])) fail('秒可含最多三位小数；毫秒必须是整数');
  const sign = match[1] === '-' ? -1n : 1n;
  const milliseconds = precision === 'milliseconds'
    ? sign * BigInt(match[2])
    : sign * (BigInt(match[2]) * 1000n + BigInt((match[3] ?? '').padEnd(3, '0')));
  if (milliseconds < -MAX_DATE_MS || milliseconds > MAX_DATE_MS) fail('时间戳超出 Date 范围');
  return Number(milliseconds);
}

export function parseIsoDate(value) {
  const source = String(value ?? '').trim();
  const match = /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(source);
  if (!match) fail('日期须为 YYYY-MM-DDTHH:mm:ss[.SSS]Z 或带 ±HH:mm 偏移');
  const [, y, m, d, h, min, s, fraction = '', offset] = match;
  const [year, month, day, hour, minute, second] = [y, m, d, h, min, s].map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] || hour > 23 || minute > 59 || second > 59) fail('日期或时间不存在');
  let offsetMinutes = 0;
  if (offset !== 'Z') {
    const offsetHours = Number(offset.slice(1, 3));
    const offsetMins = Number(offset.slice(4, 6));
    if (offsetHours > 23 || offsetMins > 59) fail('时区偏移无效');
    offsetMinutes = (offsetHours * 60 + offsetMins) * (offset[0] === '-' ? -1 : 1);
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, Number(fraction.padEnd(3, '0')));
  const milliseconds = date.getTime() - offsetMinutes * 60000;
  if (!Number.isSafeInteger(milliseconds) || Math.abs(milliseconds) > Number(MAX_DATE_MS)) fail('日期超出 Date 范围');
  return milliseconds;
}

function secondsText(milliseconds) {
  const ms = BigInt(milliseconds);
  const magnitude = ms < 0n ? -ms : ms;
  const fraction = String(magnitude % 1000n).padStart(3, '0').replace(/0+$/, '');
  return `${ms < 0n ? '-' : ''}${magnitude / 1000n}${fraction ? `.${fraction}` : ''}`;
}

export function timeZoneText(milliseconds, timeZone) {
  choice(timeZone, ZONES, '目标时区');
  if (!Number.isSafeInteger(milliseconds) || Math.abs(milliseconds) > Number(MAX_DATE_MS)) fail('日期超出范围');
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'longOffset', era: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(milliseconds)).map(({ type, value }) => [type, value]));
  const ms = new Date(milliseconds).getUTCMilliseconds();
  const yearNumber = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
  const year = yearNumber >= 0 && yearNumber <= 9999 ? String(yearNumber).padStart(4, '0') : (yearNumber < 0 ? '-' : '+') + String(Math.abs(yearNumber)).padStart(6, '0');
  const offset = parts.timeZoneName === 'GMT' ? 'GMT+00:00' : parts.timeZoneName;
  return `${year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${String(ms).padStart(3, '0')} ${offset} [${timeZone}]`;
}

const UNITS = {
  length: { m: 1, km: 1000, cm: .01, mm: .001, in: .0254, ft: .3048, mi: 1609.344 },
  mass: { kg: 1, g: .001, mg: .000001, lb: .45359237, oz: .028349523125 },
  area: { m2: 1, km2: 1000000, cm2: .0001, ha: 10000, ft2: .09290304 },
  temperature: { C: true, F: true, K: true },
};
export function convertUnits(value, category, from, to) {
  const number = finite(value);
  const units = UNITS[category];
  if (!units || !Object.hasOwn(units, from) || !Object.hasOwn(units, to)) fail('单位不属于所选分类');
  if (from === to) return number;
  if (category === 'temperature') {
    const celsius = from === 'C' ? number : from === 'F' ? (number - 32) * 5 / 9 : number - 273.15;
    return checked(to === 'C' ? celsius : to === 'F' ? celsius * 9 / 5 + 32 : celsius + 273.15);
  }
  return checked(number * (units[from] / units[to]));
}

const FUNCTIONS = new Map([
  ['sqrt', [1, 1]], ['cbrt', [1, 1]], ['abs', [1, 1]], ['exp', [1, 1]],
  ['log', [1, 2]], ['log10', [1, 1]], ['sin', [1, 1]], ['cos', [1, 1]], ['tan', [1, 1]],
  ['asin', [1, 1]], ['acos', [1, 1]], ['atan', [1, 1]], ['sinh', [1, 1]], ['cosh', [1, 1]],
  ['tanh', [1, 1]], ['floor', [1, 1]], ['ceil', [1, 1]], ['round', [1, 2]], ['min', [1, 8]], ['max', [1, 8]],
]);
const BASIC_OPERATORS = new Set(['add', 'subtract', 'multiply', 'divide', 'unaryMinus', 'unaryPlus', 'mod']);

export async function calculateExpression(value, scientific = false) {
  const source = String(value ?? '').trim();
  if (!source || source.length > 400) fail('表达式须为 1–400 字符');
  const math = await getMath();
  let tree;
  try { tree = math.parse(source); } catch { fail('表达式语法无效'); }
  let count = 0;
  function inspect(node, depth) {
    if (++count > 200 || depth > 24) fail('表达式过于复杂');
    if (node.isConstantNode) {
      if (typeof node.value !== 'number' || !Number.isFinite(node.value)) fail('只接受有限实数常量');
    } else if (node.isSymbolNode) {
      if (!scientific || !['pi', 'e'].includes(node.name)) fail('仅支持科学常量 pi、e');
    } else if (node.isParenthesisNode) {
      inspect(node.content, depth + 1);
    } else if (node.isOperatorNode) {
      if (!BASIC_OPERATORS.has(node.fn) && !(scientific && node.fn === 'pow')) fail('不支持此运算符');
      for (const argument of node.args) inspect(argument, depth + 1);
    } else if (node.isFunctionNode) {
      const range = node.fn.isSymbolNode && FUNCTIONS.get(node.fn.name);
      if (!scientific || !range || node.args.length < range[0] || node.args.length > range[1]) fail('函数或参数数量不支持');
      for (const argument of node.args) inspect(argument, depth + 1);
    } else fail('不支持变量、赋值、单位、属性、范围或数组');
  }
  inspect(tree, 0);
  try { return checked(tree.compile().evaluate()); }
  catch (error) { fail(error.message === '结果不是有限实数' ? error.message : '函数输入超出定义域或范围'); }
}

export function parseMatrix(value) {
  const source = String(value ?? '').trim();
  if (!source || source.length > 800) fail('矩阵须为不超过 800 字符的 JSON');
  let rows;
  try { rows = JSON.parse(source); } catch { fail('矩阵须为 JSON 二维数组'); }
  if (!Array.isArray(rows) || ![2, 3].includes(rows.length) || !rows.every(row => Array.isArray(row) && row.length === rows.length && row.every(cell => typeof cell === 'number' && Number.isFinite(cell)))) fail('仅支持有限实数的 2×2 或 3×3 方阵');
  return rows;
}
export async function matrixOperation(a, b, operation) {
  const left = parseMatrix(a);
  choice(operation, ['add', 'subtract', 'determinant'], '矩阵运算');
  const math = await getMath();
  if (operation === 'determinant') return checked(math.det(left));
  const right = parseMatrix(b);
  if (left.length !== right.length) fail('两个矩阵维度必须相同');
  const result = operation === 'add' ? math.add(left, right) : math.subtract(left, right);
  result.forEach(row => row.forEach(checked));
  return result;
}

export function convertRadix(value, from, to) {
  const sourceBase = Number(from), targetBase = Number(to);
  choice(sourceBase, [2, 8, 10, 16], '来源进制');
  choice(targetBase, [2, 8, 10, 16], '目标进制');
  let source = String(value ?? '').trim();
  if (!source || source.length > 2051) fail('最多支持 2048 位数字');
  const negative = source[0] === '-';
  if (/^[+-]/.test(source)) source = source.slice(1);
  const prefix = { 2: '0b', 8: '0o', 16: '0x' }[sourceBase];
  if (prefix && source.slice(0, 2).toLowerCase() === prefix) source = source.slice(2);
  const pattern = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/i }[sourceBase];
  if (!pattern.test(source) || source.length > 2048) fail('数字不符合来源进制或长度限制');
  const magnitude = BigInt((prefix ?? '') + source);
  return (negative ? -magnitude : magnitude).toString(targetBase);
}

function hueToRgb(p, q, value) {
  const t = (value + 1) % 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
export function hslToRgb(h, s, l) {
  if (![h, s, l].every(Number.isFinite) || s < 0 || s > 100 || l < 0 || l > 100) fail('HSL 饱和度/亮度范围为 0–100%');
  h = ((h % 360) + 360) % 360 / 360; s /= 100; l /= 100;
  if (!s) return [l, l, l].map(channel => Math.round(channel * 255));
  const q = l < .5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [h + 1 / 3, h, h - 1 / 3].map(channel => Math.round(hueToRgb(p, q, channel) * 255));
}
export function rgbToHsl(r, g, b) {
  if (![r, g, b].every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 255)) fail('RGB 必须为 0–255 整数');
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  const lightness = (max + min) / 2;
  if (!delta) return [0, 0, lightness * 100];
  const saturation = Math.min(1, Math.max(0, delta / (1 - Math.abs(2 * lightness - 1))));
  let hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return [hue, saturation * 100, lightness * 100];
}
export function parseColor(value, format) {
  const source = String(value ?? '').trim();
  if (source.length > 120) fail('颜色输入过长');
  if (format === 'hex') {
    const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(source);
    if (!match) fail('HEX 仅支持 #RGB 或 #RRGGBB');
    const hex = match[1].length === 3 ? [...match[1]].map(char => char + char).join('') : match[1];
    return [0, 2, 4].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
  }
  if (format === 'rgb') {
    const match = /^(?:rgb\(\s*)?(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*\))?$/i.exec(source);
    if (!match || (source.includes('(') !== source.includes(')'))) fail('RGB 例：rgb(0, 96, 255)');
    const channels = match.slice(1).map(Number);
    rgbToHsl(...channels);
    return channels;
  }
  if (format === 'hsl') {
    const match = /^(?:hsl\(\s*)?([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:deg)?\s*,\s*(\d+(?:\.\d*)?|\.\d+)%\s*,\s*(\d+(?:\.\d*)?|\.\d+)%(?:\s*\))?$/i.exec(source);
    if (!match || (source.includes('(') !== source.includes(')'))) fail('HSL 例：hsl(220, 100%, 50%)');
    return hslToRgb(...match.slice(1).map(Number));
  }
  fail('颜色格式无效');
}
export function colorFormats(rgb) {
  const hsl = rgbToHsl(...rgb);
  const trim = number => String(Number(number.toFixed(6)));
  return {
    hex: `#${rgb.map(number => number.toString(16).padStart(2, '0')).join('').toUpperCase()}`,
    rgb: `rgb(${rgb.join(', ')})`,
    hsl: `hsl(${trim(hsl[0])}, ${trim(hsl[1])}%, ${trim(hsl[2])}%)`,
  };
}

const ROMAN_VALUES = [['M', 1000], ['CM', 900], ['D', 500], ['CD', 400], ['C', 100], ['XC', 90], ['L', 50], ['XL', 40], ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1]];
export function numberToRoman(value) {
  const source = String(value ?? '').trim();
  if (!/^\d{1,4}$/.test(source)) fail('整数范围为 1–3999');
  let number = Number(source);
  if (number < 1 || number > 3999) fail('整数范围为 1–3999');
  let result = '';
  for (const [symbol, amount] of ROMAN_VALUES) {
    while (number >= amount) { result += symbol; number -= amount; }
  }
  return result;
}
export function romanToNumber(value) {
  const source = String(value ?? '').trim().toUpperCase();
  if (!source || source.length > 15 || !/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(source)) fail('请输入规范罗马数字 I–MMMCMXCIX');
  let result = 0, position = 0;
  for (const [symbol, amount] of ROMAN_VALUES) {
    while (source.slice(position, position + symbol.length) === symbol) { result += amount; position += symbol.length; }
  }
  return result;
}

export function octalToPermissions(value) {
  const source = String(value ?? '').trim();
  if (!/^[0-7]{3,4}$/.test(source)) fail('权限须为 3 或 4 位八进制，如 755、4755');
  const [special, owner, group, other] = source.padStart(4, '0').split('').map(Number);
  return [owner, group, other].map((bits, index) => {
    const activeSpecial = Boolean(special & [4, 2, 1][index]);
    const execute = Boolean(bits & 1);
    return `${bits & 4 ? 'r' : '-'}${bits & 2 ? 'w' : '-'}${activeSpecial ? (index === 2 ? (execute ? 't' : 'T') : (execute ? 's' : 'S')) : (execute ? 'x' : '-')}`;
  }).join('');
}
export function permissionsToOctal(value) {
  let source = String(value ?? '').trim();
  if (source.length === 10 && /^[-dl]/.test(source)) source = source.slice(1);
  if (!/^[r-][w-][xsS-][r-][w-][xsS-][r-][w-][xtT-]$/.test(source)) fail('权限须为 rwxr-xr-x 形式，支持 s/S/t/T');
  let special = 0;
  const bits = [0, 1, 2].map(index => {
    const triplet = source.slice(index * 3, index * 3 + 3);
    if (/[sStT]/.test(triplet[2])) special |= [4, 2, 1][index];
    return (triplet[0] === 'r' ? 4 : 0) + (triplet[1] === 'w' ? 2 : 0) + (/[xst]/.test(triplet[2]) ? 1 : 0);
  });
  return `${special || ''}${bits.join('')}`;
}

const select = (key, label, entries, defaultValue) => ({ key, label, type: 'select', default: defaultValue, options: entries.map(entry => Array.isArray(entry) ? { value: entry[0], label: entry[1] } : { value: entry, label: entry }) });
const field = (key, label, type, value) => ({ key, label, type, default: value });
const unitOptions = Object.values(UNITS).flatMap(units => Object.keys(units));

export const tools = [
  {
    id: 'timestamp', title: '时间戳', requirements: ['B033'], group: '转换',
    fields: [select('mode', '方向', [['forward', '时间戳 → 日期'], ['reverse', '日期 → 时间戳']], 'forward'), field('value', '时间戳 / ISO 日期', 'text', '0'), select('precision', '时间戳单位', [['seconds', '秒'], ['milliseconds', '毫秒']], 'seconds')],
    async run(input) {
      choice(input.mode, ['forward', 'reverse'], '转换方向');
      choice(input.precision, ['seconds', 'milliseconds'], '时间戳单位');
      const milliseconds = input.mode === 'forward' ? timestampToMilliseconds(input.value, input.precision) : parseIsoDate(input.value);
      const iso = new Date(milliseconds).toISOString();
      const seconds = secondsText(milliseconds);
      return { text: input.mode === 'forward' ? iso : input.precision === 'seconds' ? seconds : String(milliseconds), table: [['格式', '值'], ['UTC / ISO 8601', iso], ['Unix 秒', seconds], ['Unix 毫秒', String(milliseconds)]] };
    },
  },
  {
    id: 'time-zone', title: '时区', requirements: ['B034'], group: '转换',
    fields: [field('value', 'ISO 日期（含 Z 或偏移）', 'text', '2024-03-10T07:00:00Z'), select('zone', '目标时区', ZONES, 'Asia/Shanghai')],
    async run(input) {
      const milliseconds = parseIsoDate(input.value);
      return { text: timeZoneText(milliseconds, input.zone), table: [['时区', '时间'], ...ZONES.map(zone => [zone, timeZoneText(milliseconds, zone)])] };
    },
  },
  {
    id: 'convert', title: '单位换算', requirements: ['B035'], group: '转换',
    fields: [select('category', '分类', [['length', '长度'], ['mass', '重量'], ['temperature', '温度'], ['area', '面积']], 'length'), field('value', '数值', 'number', '1'), select('from', '来源单位', unitOptions, 'm'), select('to', '目标单位', unitOptions, 'cm')],
    async run(input) { return { text: formatNumber(convertUnits(input.value, input.category, input.from, input.to)), table: [['来源', '结果'], [`${input.value} ${input.from}`, `${formatNumber(convertUnits(input.value, input.category, input.from, input.to))} ${input.to}`]] }; },
  },
  {
    id: 'calculator', title: '计算器', requirements: ['B036'], group: '计算',
    fields: [field('expression', '表达式（+ − * / %）', 'text', '(5 + 3) / 2')],
    async run(input) { return { text: formatNumber(await calculateExpression(input.expression)) }; },
  },
  {
    id: 'scientific', title: '科学计算', requirements: ['B037'], group: '计算',
    fields: [field('expression', '表达式（角度为弧度）', 'textarea', 'sin(pi / 6)^2 + cos(pi / 6)^2')],
    async run(input) { return { text: formatNumber(await calculateExpression(input.expression, true)) }; },
  },
  {
    id: 'matrix', title: '矩阵', requirements: ['B038'], group: '计算',
    fields: [select('operation', '操作', [['add', 'A + B'], ['subtract', 'A − B'], ['determinant', 'det(A)']], 'add'), field('a', 'A（2×2 / 3×3 JSON）', 'textarea', '[[1,2],[3,4]]'), field('b', 'B', 'textarea', '[[4,3],[2,1]]')],
    async run(input) {
      const result = await matrixOperation(input.a, input.b, input.operation);
      if (typeof result === 'number') return { text: formatNumber(result) };
      const rendered = result.map(row => row.map(formatNumber));
      return { text: rendered.map(row => row.join('\t')).join('\n'), table: [['行', ...result.map((_, index) => String(index + 1))], ...rendered.map((row, index) => [String(index + 1), ...row])], extension: 'tsv', mime: 'text/tab-separated-values;charset=utf-8' };
    },
  },
  {
    id: 'radix', title: '进制', requirements: ['B039'], group: '转换',
    fields: [field('value', '整数（有符号）', 'textarea', '9007199254740993'), select('from', '来源进制', ['2', '8', '10', '16'], '10'), select('to', '目标进制', ['2', '8', '10', '16'], '16')],
    async run(input) { return { text: convertRadix(input.value, input.from, input.to), table: [['进制', '整数'], ...[2, 8, 10, 16].map(base => [String(base), convertRadix(input.value, input.from, base)])] }; },
  },
  {
    id: 'color', title: '颜色', requirements: ['B046'], group: '转换',
    fields: [select('format', '输入格式', [['hex', 'HEX'], ['rgb', 'RGB'], ['hsl', 'HSL']], 'hex'), field('value', '颜色', 'text', '#0060FF')],
    async run(input) {
      const result = colorFormats(parseColor(input.value, input.format));
      return { text: Object.values(result).join('\n'), table: [['格式', '颜色'], ...Object.entries(result).map(([format, value]) => [format.toUpperCase(), value])] };
    },
  },
  {
    id: 'roman', title: '罗马数字', requirements: ['B061'], group: '转换',
    fields: [select('mode', '方向', [['forward', '整数 → 罗马'], ['reverse', '罗马 → 整数']], 'forward'), field('value', '1–3999 / 罗马数字', 'text', '1994')],
    async run(input) {
      choice(input.mode, ['forward', 'reverse'], '转换方向');
      const decimal = input.mode === 'forward' ? romanToNumber(numberToRoman(input.value)) : romanToNumber(input.value);
      const roman = numberToRoman(decimal);
      return { text: input.mode === 'forward' ? roman : String(decimal), table: [['整数', '罗马'], [String(decimal), roman]] };
    },
  },
  {
    id: 'permissions', title: 'Unix 权限', requirements: ['B062'], group: '转换',
    fields: [select('mode', '方向', [['forward', '八进制 → 符号'], ['reverse', '符号 → 八进制']], 'forward'), field('value', '755 / rwxr-xr-x', 'text', '755')],
    async run(input) {
      choice(input.mode, ['forward', 'reverse'], '转换方向');
      const octal = input.mode === 'forward' ? permissionsToOctal(octalToPermissions(input.value)) : permissionsToOctal(input.value);
      const symbolic = octalToPermissions(octal);
      return { text: input.mode === 'forward' ? symbolic : octal, table: [['八进制', '符号'], [octal, symbolic]] };
    },
  },
];
