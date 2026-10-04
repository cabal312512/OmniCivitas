export const TODO_KEY = 'ocv.todo.v1';
export const TODO_LIMIT = 100;
export const TODO_TEXT_LIMIT = 300;
export const TODO_FILE_LIMIT = 64 * 1024;

export function durationSeconds(value, label = '时间') {
  if (typeof value === 'string' && !value.trim()) throw new Error(`请输入${label}`);
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0.1 || seconds > 604800) throw new Error(`${label}需要 0.1 到 604800 秒`);
  return Math.round(seconds * 1000);
}

export function formatDuration(milliseconds, decimals = 1) {
  const time = Math.max(0, Math.floor(Number(milliseconds) || 0));
  const hours = Math.floor(time / 3600000), minutes = Math.floor(time / 60000) % 60, seconds = Math.floor(time / 1000) % 60;
  const tail = decimals === 0 ? '' : `.${String(time % 1000).padStart(3, '0').slice(0, decimals)}`;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}${tail}`;
}

// The interval only paints. Elapsed time is sampled from this monotonic origin.
export function createClock({ kind, duration = 60000, work = 1500000, rest = 300000, cycles = 4, now = () => performance.now() } = {}) {
  if (!['countdown', 'stopwatch', 'pomodoro'].includes(kind)) throw new Error('没有这种时钟');
  const validMs = value => Number.isSafeInteger(value) && value >= 100 && value <= 604800000;
  if (kind === 'countdown' && !validMs(duration)) throw new Error('倒计时长度无效');
  if (kind === 'pomodoro' && (!validMs(work) || !validMs(rest) || !Number.isInteger(cycles) || cycles < 1 || cycles > 24)) throw new Error('番茄钟参数无效');
  const total = kind === 'stopwatch' ? Infinity : kind === 'countdown' ? duration : (work + rest) * cycles;
  let state = 'running', base = 0, origin = now(), laps = [];
  function elapsed() {
    const value = Math.min(total, Math.max(0, base + (state === 'running' ? Math.max(0, now() - origin) : 0)));
    if (state === 'running' && value >= total) { base = total; state = 'finished'; }
    return value;
  }
  function snapshot() {
    const value = elapsed();
    if (kind === 'pomodoro') {
      const period = work + rest;
      const cycle = Math.min(cycles, Math.floor(value / period) + 1);
      const offset = value % period;
      const phase = state === 'finished' ? 'finished' : offset < work ? 'work' : 'rest';
      return { kind, state, elapsed: value, remaining: Math.max(0, total - value), phase, cycle, cycles, phaseRemaining: phase === 'finished' ? 0 : phase === 'work' ? work - offset : period - offset, laps: [] };
    }
    return { kind, state, elapsed: value, remaining: kind === 'countdown' ? Math.max(0, total - value) : null, laps: laps.map(lap => ({ ...lap })) };
  }
  return {
    snapshot,
    pause() { const value = elapsed(); if (state === 'running') { base = value; state = 'paused'; } return snapshot(); },
    resume() { if (state === 'paused') { origin = now(); state = 'running'; } return snapshot(); },
    reset() { base = 0; origin = now(); state = 'paused'; laps = []; return snapshot(); },
    lap() {
      if (kind !== 'stopwatch') throw new Error('只有秒表能分段');
      if (state !== 'running') throw new Error('先继续秒表');
      if (laps.length >= 200) throw new Error('最多记录 200 段');
      const value = Math.floor(elapsed()), previous = laps.at(-1)?.elapsed || 0;
      laps.push({ number: laps.length + 1, elapsed: value, duration: value - previous });
      return snapshot();
    },
  };
}

function plain(value) { return value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function exactKeys(value, expected) { return plain(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value, key)); }
export function todoText(value) {
  if (typeof value !== 'string') throw new Error('待办需要文字');
  const text = value.trim();
  if (!text || [...text].length > TODO_TEXT_LIMIT) throw new Error(`待办需要 1 到 ${TODO_TEXT_LIMIT} 个字符`);
  return text;
}
export function validateTodos(value) {
  if (!Array.isArray(value) || value.length > TODO_LIMIT) throw new Error(`最多 ${TODO_LIMIT} 条待办`);
  const seen = new Set();
  return value.map(item => {
    if (!exactKeys(item, ['id', 'text', 'completed']) || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || typeof item.completed !== 'boolean') throw new Error('待办文件结构不正确');
    if (seen.has(item.id)) throw new Error('待办编号重复');
    seen.add(item.id);
    const text = todoText(item.text);
    if (text !== item.text) throw new Error('待办文字格式不正确');
    return { id: item.id, text, completed: item.completed };
  });
}
export function decodeTodos(source) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).byteLength > TODO_FILE_LIMIT) throw new Error('待办文件超过 64 KiB');
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('待办文件不是有效 JSON'); }
  if (!exactKeys(data, ['version', 'items']) || data.version !== 1) throw new Error('待办文件版本或结构不正确');
  return validateTodos(data.items);
}
export function encodeTodos(items) {
  const source = JSON.stringify({ version: 1, items: validateTodos(items) }, null, 2);
  if (new TextEncoder().encode(source).byteLength > TODO_FILE_LIMIT) throw new Error('待办数据超过 64 KiB');
  return source;
}

export function createTodoStore(storage, id = () => crypto.randomUUID()) {
  let items = [], persistent = Boolean(storage), warning = '', disposed = false;
  try { const stored = storage?.getItem(TODO_KEY); if (stored) { const loaded = decodeTodos(stored); encodeTodos(loaded); items = loaded; } }
  catch { persistent = false; warning = '浏览器存储不可用或已有数据损坏；本次只保存在内存。'; }
  function alive() { if (disposed) throw new Error('待办已关闭，请重新运行'); }
  function snapshot() { return { items: items.map(item => ({ ...item })), persistent, warning }; }
  function save() {
    if (persistent) {
      try { storage.setItem(TODO_KEY, encodeTodos(items)); }
      catch { persistent = false; warning = '浏览器存储写入失败；本次只保存在内存。'; }
    }
    return snapshot();
  }
  function index(key) { const found = items.findIndex(item => item.id === key); if (found < 0) throw new Error('没有这条待办'); return found; }
  function commit(next) { const checked = validateTodos(next); encodeTodos(checked); items = checked; return save(); }
  return {
    snapshot,
    add(text) {
      alive(); if (items.length >= TODO_LIMIT) throw new Error(`最多 ${TODO_LIMIT} 条待办`);
      const item = { id: id(), text: todoText(text), completed: false };
      return commit([...items, item]);
    },
    edit(key, text) { alive(); const found = index(key); return commit(items.map((item, position) => position === found ? { ...item, text: todoText(text) } : item)); },
    toggle(key, completed) { alive(); if (typeof completed !== 'boolean') throw new Error('完成状态无效'); const found = index(key); return commit(items.map((item, position) => position === found ? { ...item, completed } : item)); },
    remove(key) { alive(); const found = index(key); return commit(items.filter((_item, position) => position !== found)); },
    clearCompleted() { alive(); return commit(items.filter(item => !item.completed)); },
    replace(source) { alive(); return commit(decodeTodos(source)); },
    dispose() { disposed = true; },
  };
}
