import { measurementSnapshot } from '../../../../../pinia/p.mjs';
import { suitability, filenameRisk, variableMaturity, windowDiscipline, refreshAssessment, complicated, predict404, oddText, cryptographicChoice, QUESTIONNAIRE, DEMO_COOKIE_NAMES, LOADER_KINDS, createProgressSequence, createWaitClock, createUndoChoice, trajectoryCertificate } from './model.mjs';

const field = (key, label, value, type = 'text') => ({ key, label, default: value, type });
const receipt = (text, extras = {}) => ({ text, ...extras });
function node(document, tag, text, dataset = {}) { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; Object.assign(element.dataset, dataset); return element; }
function actionButton(document, action, text) { const button = node(document, 'button', text, { oddAction: action }); button.type = 'button'; return button; }

// One timer per mounted workbench. CSS and paint both suspend without losing clock origins.
function workbench(context, id) {
  const { lab, signal, onResult = () => {}, onStatus = () => {} } = context;
  if (!lab) throw new Error('请在网页里打开这个窗口');
  const document = lab.ownerDocument, window = document.defaultView, controller = new AbortController();
  const panel = node(document, 'section', undefined, { oddWorkbench: id }); lab.append(panel);
  let timer = null, paint = null, period = 200, needed = () => true, disposed = false, suspended = false;
  const cleanups = new Set();
  function stop() { if (timer !== null) { window.clearInterval(timer); timer = null; } }
  function schedule() {
    stop(); panel.dataset.oddPaused = String(disposed || suspended || document.hidden);
    if (!disposed && !suspended && !document.hidden && paint && needed()) timer = window.setInterval(() => { if (disposed || suspended || document.hidden) { stop(); return; } paint(); if (!needed()) stop(); }, period);
  }
  function dispose() { if (disposed) return; disposed = true; stop(); controller.abort(); for (const cleanup of cleanups) cleanup(); cleanups.clear(); panel.dataset.oddPaused = 'true'; panel.dataset.oddDisposed = 'true'; for (const element of panel.querySelectorAll('button,input,select')) element.disabled = true; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); panel.dataset.oddPaused = 'true'; } else if (!disposed && !suspended) { paint?.(); schedule(); } }, { signal: controller.signal });
  signal?.addEventListener('abort', dispose, { once: true, signal: controller.signal });
  if (signal?.aborted) dispose();
  return {
    panel, document, window,
    result(text, extras) { if (!disposed && !suspended) onResult(receipt(text, extras)); },
    status(text, error = false) { if (!disposed && !suspended) onStatus(text, error); },
    listen(target, name, handler, options = {}) { target.addEventListener(name, event => { if (!disposed && !suspended) handler(event); }, { ...options, signal: controller.signal }); },
    cleanup(fn) { cleanups.add(fn); },
    tick(fn, interval = 200, active = () => true) { paint = fn; period = interval; needed = active; schedule(); },
    schedule,
    finish(text, extras = {}) { return receipt(text, { ...extras, dispose, suspend() { suspended = true; stop(); panel.dataset.oddPaused = 'true'; }, resume() { if (disposed) return; suspended = false; paint?.(); schedule(); } }); },
  };
}

function mountReliability(context) {
  const scene = workbench(context, 'button-reliability'), { document, panel } = scene;
  const buttons = node(document, 'div', undefined, { oddButtons: 'reliability' }), count = node(document, 'output', '0/10', { oddCount: '' });
  const tested = new Set();
  for (let index = 1; index <= 10; index++) { const button = actionButton(document, `button-${index}`, '检测'); button.dataset.oddNumber = String(index); button.setAttribute('aria-label', `检测按钮 ${index}`); buttons.append(button); }
  panel.append(count, buttons);
  scene.listen(buttons, 'click', event => {
    const button = event.target.closest('button[data-odd-number]'); if (!button) return;
    tested.add(Number(button.dataset.oddNumber)); count.value = `${tested.size}/10`;
    const text = tested.size === 10 ? '第 7 个按钮最像按钮' : `已检测 ${tested.size}/10 个按钮`;
    scene.result(text); scene.status(text);
  });
  return scene.finish('已检测 0/10 个按钮');
}
function mileageResult(snapshot) {
  const pixels = Math.round(snapshot.pixels * 100) / 100, nanometres = Math.round(pixels * 1000000);
  return receipt(`鼠标里程：${pixels.toFixed(2)} px\n纳米累计距离：${nanometres} nm\n采样事件：${snapshot.pointerEvents}\n${snapshot.persistence === 'session' ? '跨页累计：本标签页' : '累计仅在内存，刷新不保留'}\n换算：演示 1 px = 1,000,000 nm；不是屏幕物理测量。`, { table: [['项目', '值'], ['像素', pixels.toFixed(2)], ['演示纳米', String(nanometres)], ['事件', String(snapshot.pointerEvents)]] });
}
function wheelResult(snapshot) {
  const distance = Math.round(snapshot.wheelPixels * 100) / 100, efficiency = snapshot.wheelEvents ? Math.round(distance / snapshot.wheelEvents * 100) / 100 : 0;
  return receipt(`滚轮事件：${snapshot.wheelEvents}\n归一化滚动量：${distance.toFixed(2)} px\n使用效率：${efficiency.toFixed(2)} px/次\n${snapshot.persistence === 'session' ? '跨页累计：本标签页' : '累计仅在内存，刷新不保留'}\n${efficiency > 100 ? '滚轮正在超额履职' : '滚轮尚有晋升空间'}`, { table: [['事件数', '滚动量(px)', '平均(px/次)'], [String(snapshot.wheelEvents), distance.toFixed(2), efficiency.toFixed(2)]] });
}
function mountMeasurement(context, kind) {
  const scene = workbench(context, kind), formatter = kind === 'mouse-mileage' ? mileageResult : wheelResult;
  const display = node(scene.document, 'output', undefined, { oddMeasurement: '' }); scene.panel.append(display);
  function paint(notify = true) { const result = formatter(measurementSnapshot()); display.value = result.text; if (notify) scene.result(result.text, { table: result.table }); }
  paint(false); scene.tick(() => paint(), 200);
  return scene.finish(formatter(measurementSnapshot()).text, { table: formatter(measurementSnapshot()).table });
}
function mountDecide(input, context) {
  const options = [oddText(input.first, '第一个选项', 240), oddText(input.second, '第二个选项', 240)];
  const scene = workbench(context, 'help-decide'), { panel, document } = scene;
  const progress = node(document, 'output', '问题 1/14', { oddQuestionNumber: '' }), question = node(document, 'p', QUESTIONNAIRE[0], { oddQuestion: '' });
  const answer = node(document, 'select', undefined, { oddAnswer: '' }); answer.setAttribute('aria-label', '无关问题的回答');
  for (const value of ['是', '否', '需要另行讨论']) { const option = node(document, 'option', value); option.value = value; answer.append(option); }
  const next = actionButton(document, 'next-question', '下一题'), record = [];
  panel.append(progress, question, answer, next);
  scene.listen(next, 'click', () => {
    record.push({ question: QUESTIONNAIRE[record.length], answer: answer.value });
    if (record.length === QUESTIONNAIRE.length) {
      const chosen = options[cryptographicChoice(2)]; next.disabled = true; answer.disabled = true;
      progress.value = '14/14'; question.textContent = chosen; panel.dataset.oddDecision = 'finished';
      scene.result(`决定：${chosen}\n\n${record.map((item, index) => `${index + 1}. ${item.question} ${item.answer}`).join('\n')}`, { table: [['问题', '回答'], ...record.map(item => [item.question, item.answer])] }); scene.status('决定已登记');
    } else { progress.value = `问题 ${record.length + 1}/14`; question.textContent = QUESTIONNAIRE[record.length]; scene.result(`已回答 ${record.length}/14；还不能决定。`); }
  });
  return scene.finish('已回答 0/14；还不能决定。');
}
function mountFakeButtons(context) {
  const scene = workbench(context, 'fake-button'), buttons = node(scene.document, 'div', undefined, { oddButtons: 'fake' });
  const real = new Set([1, 3, 6]); let count = 0;
  const display = node(scene.document, 'output', '有效点击：0', { oddRealClicks: '' });
  for (let index = 1; index <= 6; index++) { const button = actionButton(scene.document, `fake-${index}`, '检测'); button.dataset.oddNumber = String(index); button.setAttribute('aria-label', `待检按钮 ${index}`); buttons.append(button); }
  scene.panel.append(display, buttons);
  scene.listen(buttons, 'click', event => {
    const button = event.target.closest('button[data-odd-number]'); if (!button || !real.has(Number(button.dataset.oddNumber))) return;
    count++; display.value = `有效点击：${count}`; scene.result(`第 ${button.dataset.oddNumber} 个按钮是真的。\n有效点击：${count}`);
  });
  return scene.finish('有效点击：0\n这里混有真的假按钮。');
}
function mountLoaders(context) {
  const scene = workbench(context, 'loading-gallery'), { panel, document, window } = scene;
  const grid = node(document, 'div', undefined, { oddLoaders: '' }), origin = window.performance.now(), tiles = [];
  for (let index = 0; index < 32; index++) {
    const tile = node(document, 'figure', undefined, { loaderKind: LOADER_KINDS[index % 8], loaderVariant: String(Math.floor(index / 8)), loaderIndex: String(index + 1) });
    tile.style.setProperty('--loader-period', `${(.65 + index * .045).toFixed(3)}s`); tile.style.setProperty('--loader-angle', `${index * 11}deg`); tile.style.setProperty('--loader-space', `${3 + Math.floor(index / 8)}px`);
    const glyph = node(document, 'span', undefined, { loaderGlyph: '' }); glyph.setAttribute('aria-hidden', 'true');
    for (let dot = 0; dot < 3 + Math.floor(index / 8); dot++) { const segment = node(document, 'i'); segment.style.setProperty('--segment', String(dot)); glyph.append(segment); }
    const label = node(document, 'figcaption', `L${String(index + 1).padStart(2, '0')} · 加载中`, { loaderStatus: '' });
    tile.append(glyph, label); grid.append(tile); tiles.push({ tile, label, duration: 3000 + index * 100, forever: index === 31 });
  }
  panel.append(grid); let complete = 0;
  function paint(notify = true) {
    const elapsed = window.performance.now() - origin; complete = 0;
    for (const [index, item] of tiles.entries()) {
      const finished = !item.forever && elapsed >= item.duration; if (finished) complete++;
      item.tile.dataset.loaderFinished = String(finished); item.tile.dataset.loaderForever = String(item.forever);
      item.label.textContent = `L${String(index + 1).padStart(2, '0')} · ${finished ? '完成' : '加载中'}`;
    }
    panel.dataset.oddLoaded = String(complete); if (notify) scene.result(`32 种 Loading\n已完成：${complete}/32\nL32：永远加载中`);
  }
  paint(false); scene.tick(() => paint(), 200, () => complete < 31);
  return scene.finish('32 种 Loading\n已完成：0/32\nL32：永远加载中');
}
function mountProgress(context) {
  const scene = workbench(context, 'progress-truth'), { document, panel, window } = scene, sequence = createProgressSequence(() => window.performance.now());
  const rows = [], labels = ['真实：3 秒计时', '随机：与任务无关', '超额：先到 120%']; let complete = false;
  for (let index = 0; index < 3; index++) {
    const row = node(document, 'div', undefined, { oddProgress: String(index) });
    const label = node(document, 'span', labels[index]), track = node(document, 'div', undefined, { oddProgressTrack: '' }), bar = node(document, 'span', undefined, { oddProgressBar: '' }), value = node(document, 'output', '0%');
    track.append(bar); row.append(label, track, value); panel.append(row); rows.push({ row, bar, value });
  }
  let values = [0, 0, 0];
  function paint(notify = true) {
    const snap = sequence.sample(cryptographicChoice(101)); values = snap.values; complete = snap.complete;
    rows.forEach((item, index) => { item.row.dataset.oddPercent = String(values[index]); item.value.value = `${values[index].toFixed(1)}%`; item.bar.style.width = `${values[index]}%`; });
    panel.dataset.oddProgressState = complete ? 'finished' : 'running';
    if (notify) scene.result(`真实：${values[0].toFixed(1)}%\n随机：${values[1].toFixed(1)}%\n超额：${values[2].toFixed(1)}%`, { table: [['进度条', '数值', '依据'], ['真实', String(values[0]), '实际单调计时'], ['随机', String(values[1]), '随机数'], ['超额', String(values[2]), '120 后回退到 100']] });
  }
  paint(false); scene.tick(() => paint(), 100, () => !complete);
  return scene.finish(`真实：${values[0].toFixed(1)}%\n随机：${values[1].toFixed(1)}%\n超额：${values[2].toFixed(1)}%`);
}
export async function harmlessCookiePersonality(context = {}) {
  const document = context.lab?.ownerDocument || globalThis.document, window = document?.defaultView || globalThis.window;
  if (!document || !window) throw new Error('请在网页中打开 Cookie 测试');
  const values = ['round', 'later', '7'], rows = [], store = window.cookieStore;
  let mode = '新写入值';
  for (const [index, name] of DEMO_COOKIE_NAMES.entries()) {
    if (context.signal?.aborted) throw new DOMException('已取消', 'AbortError');
    const value = values[index]; let actual = value;
    if (store?.set && store?.get) {
      try {
        await store.set({ name, value, path: '/functions/cookie-personality/', sameSite: 'lax', expires: Date.now() + 3600000 });
        const own = await store.get({ name, url: window.location.href });
        if (own?.name === name && values.includes(own.value)) { actual = own.value; mode = '按名称读取本站演示 Cookie'; }
      } catch { document.cookie = `${name}=${value}; Path=/functions/cookie-personality/; Max-Age=3600; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`; }
    } else document.cookie = `${name}=${value}; Path=/functions/cookie-personality/; Max-Age=3600; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    rows.push([name, actual]);
  }
  if (context.signal?.aborted) throw new DOMException('已取消', 'AbortError');
  return receipt(`人格：你对圆角抱有不必要的信任。\n排队倾向：愿意把现在推迟到稍后。\n页边距态度：7。\n依据：${mode}；不枚举其他 Cookie。`, { table: [['本站演示 Cookie', '值'], ...rows] });
}
function mountTrajectory(context) {
  const scene = workbench(context, 'trajectory-notary'), { panel, document, window } = scene;
  const canvas = node(document, 'canvas', undefined, { oddTrajectory: '' }); canvas.width = 320; canvas.height = 260; canvas.tabIndex = 0; canvas.setAttribute('aria-label', '画一个圈：鼠标拖动；Enter 落笔，方向键画线，Space 提笔');
  const drawing = canvas.getContext('2d'); if (!drawing) throw new Error('浏览器不能绘制轨迹');
  const actions = node(document, 'div', undefined, { oddDrawingActions: '' }), seal = actionButton(document, 'seal', '盖章'), reset = actionButton(document, 'reset-drawing', '重画'); actions.append(seal, reset);
  const certificate = node(document, 'div', undefined, { oddCertificate: '' });
  const help = node(document, 'p', '画一个圈，再盖章。'); panel.append(canvas, actions, help, certificate);
  let points = [], active = false, pointer = null, cursor = [160, 130], previewUrl = null;
  function clearPreview() { certificate.replaceChildren(); if (previewUrl) { window.URL.revokeObjectURL(previewUrl); previewUrl = null; } }
  scene.cleanup(clearPreview);
  function paint() {
    drawing.clearRect(0, 0, 320, 260); drawing.strokeStyle = '#155aff'; drawing.lineWidth = 2;
    if (points.length) { drawing.beginPath(); points.forEach((point, index) => index ? drawing.lineTo(...point) : drawing.moveTo(...point)); drawing.stroke(); }
    panel.dataset.oddPoints = String(points.length);
  }
  function add(point) { if (points.length >= 2048) { active = false; scene.status('最多保留 2048 个点，请盖章或重画。', true); return; } const clean = [Math.min(320, Math.max(0, point[0])), Math.min(260, Math.max(0, point[1]))]; if (!points.length || Math.hypot(clean[0] - points.at(-1)[0], clean[1] - points.at(-1)[1]) >= .5) points.push(clean); cursor = clean; paint(); }
  function position(event) { const rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return cursor; return [(event.clientX - rect.left) / rect.width * 320, (event.clientY - rect.top) / rect.height * 260]; }
  scene.listen(canvas, 'pointerdown', event => { if (!event.isPrimary || event.button !== 0) return; event.preventDefault(); clearPreview(); points = []; pointer = event.pointerId; active = true; canvas.setPointerCapture(event.pointerId); add(position(event)); });
  scene.listen(canvas, 'pointermove', event => { if (active && event.pointerId === pointer) add(position(event)); });
  function end(event) { if (event.pointerId === pointer) { if (active) add(position(event)); active = false; pointer = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } }
  scene.listen(canvas, 'pointerup', end); scene.listen(canvas, 'pointercancel', end);
  scene.listen(canvas, 'keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); clearPreview(); points = []; active = true; add(cursor); }
    else if (event.key === ' ') { event.preventDefault(); active = false; }
    else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); const [x, y] = cursor; const next = [x + (event.key === 'ArrowRight' ? 12 : event.key === 'ArrowLeft' ? -12 : 0), y + (event.key === 'ArrowDown' ? 12 : event.key === 'ArrowUp' ? -12 : 0)]; if (active) add(next); else cursor = [Math.min(320, Math.max(0, next[0])), Math.min(260, Math.max(0, next[1]))]; }
  });
  scene.listen(seal, 'click', () => {
    try {
      const id = `CVN-${window.crypto.randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
      const svg = trajectoryCertificate(points, id), mime = 'image/svg+xml;charset=utf-8', blob = new Blob([svg], { type: mime });
      clearPreview(); const image = node(document, 'img'); image.alt = `轨迹公证编号 ${id}`; previewUrl = window.URL.createObjectURL(blob); image.src = previewUrl; certificate.append(image); help.textContent = id; panel.dataset.oddCertificateId = id;
      scene.result(svg, { blob, extension: 'svg', mime }); scene.status('已盖章');
    } catch (error) { scene.status(error.message, true); }
  });
  scene.listen(reset, 'click', () => { points = []; active = false; clearPreview(); paint(); help.textContent = '画一个圈，再盖章。'; delete panel.dataset.oddCertificateId; scene.result('画一个圈，再盖章。'); scene.status('已清空'); });
  paint(); return scene.finish('画一个圈，再盖章。');
}
function mountUndo(input, context) {
  const choice = oddText(input.choice, '虚构选择', 240), model = createUndoChoice(), scene = workbench(context, 'undo-undo');
  const description = node(scene.document, 'output', '尚未选择', { oddUndoState: '' }), select = actionButton(scene.document, 'choose', '选择'), revoke = actionButton(scene.document, 'revoke', '撤销选择'), revokeRevoke = actionButton(scene.document, 'revoke-revocation', '撤销“撤销这个选择的决定”');
  scene.panel.append(description, select, revoke, revokeRevoke);
  const labels = { unselected: '尚未选择', active: '选择有效', revoked: '选择已撤销', restored: '撤销决定已撤销；选择恢复' };
  function paint(notify = true) { const state = model.snapshot(); description.value = `${labels[state.state]}${state.choice ? `：${state.choice}` : ''}`; scene.panel.dataset.oddUndoState = state.state; select.disabled = state.state !== 'unselected'; revoke.disabled = state.state !== 'active'; revokeRevoke.disabled = state.state !== 'revoked'; if (notify) scene.result(description.value); }
  scene.listen(select, 'click', () => { model.choose(choice); paint(); }); scene.listen(revoke, 'click', () => { model.revoke(); paint(); }); scene.listen(revokeRevoke, 'click', () => { model.revokeRevocation(); paint(); });
  paint(false); return scene.finish('尚未选择');
}
function mountWaiting(context) {
  const scene = workbench(context, 'waiting'), clock = createWaitClock(() => scene.window.performance.now());
  const display = node(scene.document, 'output', '尚未排队', { oddWaiting: '' }), queue = node(scene.document, 'p', '窗口尚未开始等待', { oddQueue: '' }), start = actionButton(scene.document, 'start-waiting', '开始等待'); scene.panel.append(display, queue, start);
  const queueMessages = ['正在确认排队资格', '正在核对队伍方向', '前方没有任何办理事项', '等待编号已进入等待区', '正在等候下一次等候', '正在复核已等待的时间'];
  function paint(notify = true) {
    const state = clock.snapshot(); scene.panel.dataset.oddWaitingState = state.state;
    display.value = state.completed ? '成功等待 15 秒' : state.state === 'idle' ? '尚未排队' : `等待 ${(state.elapsed / 1000).toFixed(1)} / 15 秒`;
    queue.textContent = state.completed ? '等待记录已生成' : queueMessages[Math.min(queueMessages.length - 1, Math.floor(state.elapsed / 2500))]; start.disabled = state.state !== 'idle';
    if (notify) { scene.result(state.completed ? '成功等待 15 秒\n实际等待下限：15,000 ms\n排队事项：无' : `${display.value}\n${queue.textContent}`); if (state.completed) scene.status('成功等待 15 秒'); }
  }
  scene.listen(start, 'click', () => { clock.start(); paint(); scene.schedule(); }); paint(false); scene.tick(() => paint(), 100, () => clock.snapshot().state === 'waiting');
  return scene.finish('尚未排队');
}

export const tools = [
  { id: 'site-suitability', title: '今天适不适合打开这个网站', requirements: ['B081', 'B082'], group: '日常', fields: [field('date', '日期', '2026-10-03'), field('version', '浏览器版本', '143.0.7499.0'), field('random', '随机数字', 37, 'number')], run: async input => { const value = suitability(input.date, input.version, input.random); return receipt(`适合度 ${value.percent.toFixed(1)}%\n公式：${value.formula}\n贡献总和：${value.sum}\n演示计算，无科学意义。`, { table: [['贡献项', '值'], ...value.terms.map(([name, number]) => [name, number.toFixed(6)])] }); } },
  { id: 'filename-risk', title: '文件名吉凶', requirements: ['B083', 'B084'], group: '日常', fields: [field('name', '文件名', 'final_final_v2.docx')], run: async input => { const value = filenameRisk(input.name); return receipt(`项目风险：${value.risk.toFixed(1)}%\n${value.verdict}`, { table: [['长度', '下划线', '数字', 'final 次数'], ...[[value.length, value.underscores, value.digits, value.repeatedFinal].map(String)]] }); } },
  { id: 'variable-maturity', title: '变量名质量', requirements: ['B085', 'B086'], group: '日常', fields: [field('name', '变量名', 'data2NewFinal')], run: async input => { const value = variableMaturity(input.name); return receipt(`企业级命名成熟度：${value.maturity.toFixed(1)}%\n${value.validIdentifier ? '标识符形式可用' : '标识符形式尚未通过'}`, { table: [['长度', '大写', '数字', '临时词'], ...[[value.length, value.capitals, value.digits, value.temporary].map(String)]] }); } },
  { id: 'button-reliability', title: '按钮可靠性', requirements: ['B087', 'B088'], group: '日常', fields: [], run: async (_input, context) => mountReliability(context) },
  { id: 'mouse-mileage', title: '鼠标移动里程', requirements: ['B089', 'B090'], group: '日常', fields: [], run: async (_input, context) => mountMeasurement(context, 'mouse-mileage') },
  { id: 'wheel-efficiency', title: '滚轮使用效率', requirements: ['B091'], group: '日常', fields: [], run: async (_input, context) => mountMeasurement(context, 'wheel-efficiency') },
  { id: 'window-discipline', title: '窗口形状', requirements: ['B092'], group: '日常', fields: [], run: async (_input, context) => { const window = context?.lab?.ownerDocument.defaultView || globalThis.window; const value = windowDiscipline(window.innerWidth, window.innerHeight); return receipt(`${value.verdict}\n宽高比：${value.ratio.toFixed(4)}`, { table: [['宽', '高', '宽高比'], [String(value.width), String(value.height), value.ratio.toFixed(4)]] }); } },
  { id: 'refresh-decision', title: '是否应该刷新页面', requirements: ['B093', 'B094'], group: '日常', fields: [], run: async (_input, context) => { const window = context?.lab?.ownerDocument.defaultView || globalThis.window, measures = measurementSnapshot(); const value = refreshAssessment({ width: window.innerWidth, height: window.innerHeight, pixels: measures.pixels, wheelEvents: measures.wheelEvents, second: new Date().getSeconds() }); return receipt(`${value.verdict}\n已判断：40 项；同意：${value.approved} 项`, { table: [['序号', '判断', '通过'], ...value.checks.map(check => [String(check.number), check.name, check.pass ? '是' : '否'])] }); } },
  { id: 'help-decide', title: '帮我决定', requirements: ['B095', 'B096'], group: '日常', fields: [field('first', '选项一', '去'), field('second', '选项二', '不去')], run: async (input, context) => mountDecide(input, context) },
  { id: 'complexify', title: '把问题复杂化', requirements: ['B097', 'B098'], group: '日常', fields: [field('question', '问题', '今天吃什么', 'textarea')], run: async input => { const value = complicated(input.question); return receipt(`${value.question}\n\n${value.items.map(item => `${item.number}. [${item.kind}] ${item.content}`).join('\n')}`, { table: [['序号', '类别', '内容'], ...value.items.map(item => [String(item.number), item.kind, item.content])] }); } },
  { id: 'simplify', title: '把复杂问题简单化', requirements: ['B099', 'B100'], group: '日常', fields: [field('question', '复杂问题', '如果负责人的负责人也需要负责人，该由谁指定？', 'textarea')], run: async input => { oddText(input.question, '问题'); return receipt('需要处理'); } },
  { id: 'fake-button', title: '这个按钮是不是假的', requirements: ['B105', 'B106'], group: '日常', fields: [], run: async (_input, context) => mountFakeButtons(context) },
  { id: 'loading-gallery', title: 'Loading 鉴赏', requirements: ['B107', 'B108'], group: '日常', fields: [], run: async (_input, context) => mountLoaders(context) },
  { id: 'progress-truth', title: '进度条真实性', requirements: ['B109', 'B110'], group: '日常', fields: [], run: async (_input, context) => mountProgress(context) },
  { id: 'page404-predict', title: '404 页面预测', requirements: ['B111', 'B112'], group: '日常', fields: [field('fragment', '网址片段', '/final/last-final/')], run: async input => { const value = predict404(input.fragment); return receipt(`此页面未来有 ${value.probability.toFixed(1)}% 概率不存在\n依据：网址字符散列；不访问网址。`); } },
  { id: 'cookie-personality', title: 'Cookie 心理测试', requirements: ['B113', 'B114'], group: '日常', fields: [], note: '只新建三个无害演示 Cookie，一小时过期。', run: async (_input, context) => harmlessCookiePersonality(context) },
  { id: 'trajectory-notary', title: '鼠标轨迹公证处', requirements: ['B115', 'B116'], group: '日常', fields: [], run: async (_input, context) => mountTrajectory(context) },
  { id: 'undo-undo', title: '撤销决定撤销器', requirements: ['B117', 'B118'], group: '日常', fields: [field('choice', '虚构选择', '把会议移到会议以后')], run: async (input, context) => mountUndo(input, context) },
  { id: 'waiting', title: '等待模拟器', requirements: ['B119', 'B120'], group: '日常', fields: [], run: async (_input, context) => mountWaiting(context) },
];
