import statusCodes from './codes.json' with { type: 'json' };
import mimeTypes from './mime.json' with { type: 'json' };
import { regexArguments } from './regex.mjs';

export const FILE_LIMIT = 8 * 1024 * 1024;
export const LARGE_FILE_MESSAGE = '大文件暂不支持';
export const REGEX_TIMEOUT = 1500;

function integer(value, label, lower = Number.MIN_SAFE_INTEGER, upper = Number.MAX_SAFE_INTEGER) {
  if (typeof value === 'string' && !value.trim()) throw new Error(`${label}不能为空`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < lower || number > upper) throw new Error(`${label}需要 ${lower} 到 ${upper} 的安全整数`);
  return number;
}

function cancelled(signal) {
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
}

function secure(provider = globalThis.crypto) {
  if (!provider?.getRandomValues) throw new Error('浏览器没有可用的安全随机源');
  return provider;
}

// Rejection sampling over a masked 64-bit sample keeps every integer equally likely, including negative bounds.
export function secureInteger(minimum, maximum, provider = globalThis.crypto) {
  const min = integer(minimum, '最小值');
  const max = integer(maximum, '最大值');
  if (min > max) throw new Error('最小值不能大于最大值');
  const span = BigInt(max) - BigInt(min) + 1n;
  if (span === 1n) return min;
  const mask = (1n << BigInt((span - 1n).toString(2).length)) - 1n;
  const words = new Uint32Array(2);
  const source = secure(provider);
  for (let attempt = 0; attempt < 128; attempt += 1) {
    source.getRandomValues(words);
    const sample = ((BigInt(words[0]) << 32n) | BigInt(words[1])) & mask;
    if (sample < span) return Number(BigInt(min) + sample);
  }
  throw new Error('随机源连续返回范围外值，请重试');
}

export function randomIntegers(input, provider = globalThis.crypto) {
  const min = integer(input.min, '最小值');
  const max = integer(input.max, '最大值');
  if (min > max) throw new Error('最小值不能大于最大值');
  const count = integer(input.count ?? 1, '数量', 1, 500);
  return Array.from({ length: count }, () => secureInteger(min, max, provider));
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}:,.?';
const ALPHABETS = { all: [LOWER, UPPER, DIGITS, SYMBOLS], alnum: [LOWER, UPPER, DIGITS], letters: [LOWER, UPPER], digits: [DIGITS], hex: ['0123456789abcdef'] };

export function randomString(input, provider = globalThis.crypto) {
  const length = integer(input.length ?? 24, '长度', 1, 256);
  const categories = ALPHABETS[input.alphabet ?? 'all'];
  if (!categories) throw new Error('未知字符集');
  if (length < categories.length) throw new Error(`该字符集至少需要 ${categories.length} 个字符`);
  const alphabet = categories.join('');
  const take = set => set[secureInteger(0, set.length - 1, provider)];
  const result = categories.map(take);
  while (result.length < length) result.push(take(alphabet));
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = secureInteger(0, i, provider);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.join('');
}

export async function sha256(value, provider = globalThis.crypto, signal) {
  cancelled(signal);
  if (!provider?.subtle) throw new Error('SHA-256 需要安全上下文中的 Web Crypto');
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await provider.subtle.digest('SHA-256', bytes);
  cancelled(signal);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function fileChecksum(file, { signal } = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('请选择文件');
  if (!Number.isFinite(file.size) || file.size < 0) throw new Error('文件大小无效');
  if (file.size > FILE_LIMIT) throw new Error(LARGE_FILE_MESSAGE);
  cancelled(signal);
  const bytes = await file.arrayBuffer();
  cancelled(signal);
  if (bytes.byteLength > FILE_LIMIT) throw new Error(LARGE_FILE_MESSAGE);
  return sha256(bytes, globalThis.crypto, signal);
}

export async function runRegex(input, { signal } = {}) {
  const args = regexArguments(input);
  cancelled(signal);
  if (typeof Worker === 'undefined') throw new Error('浏览器不支持 Worker，正则执行未开始');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./w.worker.js', import.meta.url), { type: 'module' });
    let settled = false;
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(null, new DOMException('已取消', 'AbortError'));
    const timer = setTimeout(() => finish(null, new Error('正则执行超过 1.5 秒，已终止隔离工位')), REGEX_TIMEOUT);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = event => event.data.ok ? finish(event.data.result) : finish(null, new Error(event.data.error));
    worker.onerror = event => { event.preventDefault(); finish(null, new Error(event.message || '正则隔离工位未启动')); };
    if (signal?.aborted) { abort(); return; }
    worker.postMessage(args);
  });
}

// Registry references: https://www.iana.org/assignments/http-status-codes/ and https://www.iana.org/assignments/media-types/.
// This intentionally excludes temporary status 104; common historical 305/306/418/510 retain registry labels.
export function queryHttpStatus(query = '') {
  const term = String(query).trim().toLowerCase();
  return Object.entries(statusCodes).filter(([code, description]) => !term || code.includes(term) || description.toLowerCase().includes(term));
}

export function queryMime(query = '') {
  const raw = String(query).trim().toLowerCase();
  const term = raw.includes('/') ? raw.split(';')[0].trim() : raw.split(/[?#]/)[0].split('.').pop();
  return Object.entries(mimeTypes).filter(([extension, type]) => !term || extension === term || type.includes(term));
}

function report(table, live) {
  return { text: table.map(row => row.join('\t')).join('\n'), table, ...(live ? { live } : {}) };
}

export function keyboardReport(event) {
  return report([
    ['key', String(event.key)], ['code', String(event.code)], ['type', String(event.type)],
    ['location', String(event.location)], ['repeat', String(event.repeat)],
    ['Ctrl / Alt / Shift / Meta', `${Boolean(event.ctrlKey)} / ${Boolean(event.altKey)} / ${Boolean(event.shiftKey)} / ${Boolean(event.metaKey)}`],
    ['isComposing', String(Boolean(event.isComposing))],
  ], 'keyboard');
}

export function pointerReport(event) {
  return report([
    ['clientX / clientY', `${event.clientX} / ${event.clientY}`],
    ['pageX / pageY', `${event.pageX} / ${event.pageY}`],
    ['screenX / screenY', `${event.screenX} / ${event.screenY}`],
    ['pointerType', String(event.pointerType ?? 'mouse')],
    ['buttons', String(event.buttons)],
  ], 'pointer');
}

export function measureScreen(win = globalThis.window) {
  if (!win?.screen) throw new Error('此环境没有屏幕信息');
  const viewport = win.visualViewport;
  return report([
    ['screen', `${win.screen.width} × ${win.screen.height} CSS px`],
    ['available', `${win.screen.availWidth} × ${win.screen.availHeight} CSS px`],
    ['layout viewport', `${win.innerWidth} × ${win.innerHeight} CSS px`],
    ['devicePixelRatio', String(win.devicePixelRatio)],
    ['visual viewport', viewport ? `${viewport.width} × ${viewport.height}; scale ${viewport.scale}` : '未提供'],
    ['colorDepth', String(win.screen.colorDepth)],
  ], 'screen');
}

export function capabilityReport(win = globalThis.window) {
  if (!win?.document) throw new Error('此环境没有浏览器能力信息');
  const canvas = win.document.createElement('canvas');
  let gl;
  let webgl = false;
  try { gl = canvas.getContext('webgl2') || canvas.getContext('webgl'); webgl = Boolean(gl); } catch {}
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
  const checks = [
    ['按钮', typeof win.document.createElement('button').click === 'function'],
    ['Web Crypto SHA-256', Boolean(win.crypto?.subtle)],
    ['crypto.randomUUID', typeof win.crypto?.randomUUID === 'function'],
    ['Worker', typeof win.Worker === 'function'],
    ['WebGL', webgl],
    ['IndexedDB', 'indexedDB' in win],
    ['Cache Storage', 'caches' in win],
    ['Clipboard API', Boolean(win.navigator?.clipboard)],
    ['Pointer Events', 'PointerEvent' in win],
    ['ResizeObserver', 'ResizeObserver' in win],
    ['CSS backdrop-filter', Boolean(win.CSS?.supports('backdrop-filter', 'blur(1px)'))],
    ['CSS grid', Boolean(win.CSS?.supports('display', 'grid'))],
  ];
  const result = report(checks.map(([name, exists]) => [name, exists ? '支持' : '未提供']));
  result.text = `${checks[0][1] ? '您的设备支持按钮' : '您的设备未提供按钮'}\n${result.text}`;
  return result;
}

export async function measurePing({ signal } = {}) {
  cancelled(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 5000);
  const started = performance.now();
  try {
    const response = await fetch('/tool-ping.json', { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal });
    if (!response.ok) throw new Error(`本站 ping 返回 HTTP ${response.status}`);
    const content = await response.text();
    if (content.length > 4096) throw new Error('本站 ping 响应过大');
    const elapsed = performance.now() - started;
    cancelled(signal);
    return report([['请求', '/tool-ping.json'], ['HTTP', String(response.status)], ['响应耗时', `${elapsed.toFixed(2)} ms`], ['范围', '本站单次请求；包含浏览器、服务端与网络等待，不能当作网络速度']]);
  } catch (error) {
    if (timedOut) throw new Error('本站 ping 超过 5 秒');
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

const field = (key, label, type = 'text', initial) => ({ key, label, type, ...(initial === undefined ? {} : { default: initial }) });
const number = (key, label, initial) => field(key, label, 'number', initial);
const tool = (id, title, requirements, fields, run, group = '开发') => ({ id, title, requirements, group, fields, run });

export const tools = [
  tool('regex', '正则表达式', ['B029'], [field('pattern', '表达式', 'text', '(?<word>\\w+)'), field('flags', '标志', 'text', 'g'), field('text', '文本', 'textarea', 'one two 42')], async (input, context = {}) => {
    const result = await runRegex(input, context);
    return { text: JSON.stringify(result, null, 2), extension: 'json', mime: 'application/json' };
  }),
  tool('uuid', 'UUID', ['B030'], [number('count', '数量', 1)], async input => {
    const count = integer(input.count ?? 1, '数量', 1, 100);
    if (typeof globalThis.crypto?.randomUUID !== 'function') throw new Error('UUID 需要安全上下文中的 crypto.randomUUID');
    return { text: Array.from({ length: count }, () => globalThis.crypto.randomUUID()).join('\n') };
  }),
  tool('random', '随机整数', ['B031'], [number('min', '最小值', 1), number('max', '最大值', 100), number('count', '数量', 10)], async input => ({ text: randomIntegers(input).join('\n') })),
  tool('hash', 'SHA-256', ['B032'], [field('text', '文本', 'textarea', 'abc')], async (input, context = {}) => {
    const text = String(input.text ?? '');
    if (text.length > 200000) throw new Error('文本最多 200000 个 UTF-16 单元');
    return { text: await sha256(text, globalThis.crypto, context.signal) };
  }),
  tool('password', '随机字符串', ['B047'], [number('length', '长度', 24), { key: 'alphabet', label: '字符集', type: 'select', default: 'all', options: [{ value: 'all', label: '字母 / 数字 / 符号' }, { value: 'alnum', label: '字母 / 数字' }, { value: 'letters', label: '字母' }, { value: 'digits', label: '数字' }, { value: 'hex', label: '十六进制' }] }], async input => ({ text: randomString(input) })),
  tool('file-checksum', '文件 SHA-256', ['B048'], [{ key: 'file', label: '文件（最多 8 MiB）', type: 'file' }], async (input, context = {}) => ({ text: await fileChecksum(input.file, context) })),
  tool('http-status', 'HTTP 状态码', ['B063'], [field('query', '状态码 / 名称', 'text', '404')], async input => {
    const rows = queryHttpStatus(input.query);
    return rows.length ? report([['状态码', '名称'], ...rows]) : { text: '常见状态码表没有此项；不代表已注册' };
  }),
  tool('mime', 'MIME 类型', ['B064'], [field('query', '后缀 / 文件名 / MIME', 'text', 'avif')], async input => {
    const rows = queryMime(input.query);
    const result = rows.length ? report([['后缀', 'MIME'], ...rows]) : { text: '常见类型表没有此项' };
    result.text += '\n按后缀查询，不鉴定文件内容。';
    return result;
  }),
  tool('keyboard', '键盘按键', ['B065'], [], async () => ({ text: '按一下键盘。', live: 'keyboard' }), '检测'),
  tool('screen', '屏幕尺寸', ['B066'], [], async () => measureScreen(), '检测'),
  tool('user-agent', 'User-Agent', ['B067'], [], async () => {
    if (typeof navigator === 'undefined') throw new Error('此环境没有 navigator');
    return { text: navigator.userAgent };
  }, '检测'),
  tool('capabilities', '浏览器能力', ['B068'], [], async () => capabilityReport(), '检测'),
  tool('pointer', '鼠标坐标', ['B069'], [], async () => ({ text: '移动一下指针。', live: 'pointer' }), '检测'),
  tool('ping', '本站响应耗时', ['B070'], [], async (_input, context = {}) => measurePing(context), '检测'),
];
