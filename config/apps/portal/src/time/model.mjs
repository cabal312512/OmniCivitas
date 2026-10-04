import { createClock, durationSeconds, formatDuration, createTodoStore, encodeTodos, TODO_TEXT_LIMIT } from './time.mjs';

const stateLabels = { running: '正在计时', paused: '已暂停', finished: '到时间了' };
const phaseLabels = { work: '专注', rest: '休息', finished: '完成' };
const field = (key, label, value) => ({ key, label, type: 'number', default: value });

function button(document, action, text) { const node = document.createElement('button'); node.type = 'button'; node.dataset.timeAction = action; node.textContent = text; return node; }
function timeResult(snapshot) {
  const lines = [`状态：${stateLabels[snapshot.state]}`, `已用：${formatDuration(snapshot.elapsed, 3)}`];
  if (snapshot.kind === 'countdown') lines.push(`剩余：${formatDuration(snapshot.remaining, 3)}`);
  if (snapshot.kind === 'pomodoro') lines.push(`阶段：${phaseLabels[snapshot.phase]}`, `轮次：${snapshot.cycle}/${snapshot.cycles}`, `本段剩余：${formatDuration(snapshot.phaseRemaining, 3)}`, `总剩余：${formatDuration(snapshot.remaining, 3)}`);
  const table = snapshot.laps.map(lap => [String(lap.number), formatDuration(lap.duration, 3), formatDuration(lap.elapsed, 3)]);
  if (table.length) lines.push('', '段号\t本段\t累计', ...table.map(row => row.join('\t')));
  return { text: lines.join('\n'), table: table.length ? [['段号', '本段', '累计'], ...table] : undefined };
}

export function mountClock(clock, context = {}) {
  const { lab, signal, onResult = () => {}, onStatus = () => {} } = context;
  if (!lab) return timeResult(clock.snapshot());
  const document = lab.ownerDocument, window = document.defaultView;
  const controller = new AbortController();
  let timer = null, disposed = false, suspended = false;
  const panel = document.createElement('section'); panel.dataset.timeWorkbench = clock.snapshot().kind;
  const display = document.createElement('output'); display.dataset.timeValue = '';
  const state = document.createElement('p'); state.dataset.timeState = '';
  const bar = document.createElement('div'); bar.className = 'time-buttons';
  const pause = button(document, 'pause', '暂停'), resume = button(document, 'resume', '继续'), reset = button(document, 'reset', '归零');
  bar.append(pause, resume, reset);
  if (clock.snapshot().kind === 'stopwatch') bar.append(button(document, 'lap', '记一段'));
  panel.append(display, state, bar); lab.append(panel);
  function paint(notify = true) {
    if (disposed || suspended) return;
    const snap = clock.snapshot();
    panel.dataset.clockState = snap.state;
    display.value = formatDuration(snap.kind === 'stopwatch' ? snap.elapsed : snap.kind === 'pomodoro' ? snap.phaseRemaining : snap.remaining, 1);
    state.textContent = snap.kind === 'pomodoro' ? `${phaseLabels[snap.phase]} · ${snap.cycle}/${snap.cycles} · ${stateLabels[snap.state]}` : stateLabels[snap.state];
    pause.disabled = snap.state !== 'running'; resume.disabled = snap.state !== 'paused';
    if (snap.state === 'finished') stopPaint();
    if (notify) { onResult(timeResult(snap)); onStatus(state.textContent); }
  }
  function stopPaint() { if (timer !== null) { window.clearInterval(timer); timer = null; } }
  function schedule() { stopPaint(); if (!disposed && !suspended && !document.hidden && clock.snapshot().state === 'running') timer = window.setInterval(() => paint(), 100); }
  panel.addEventListener('click', event => {
    const action = event.target.closest('button[data-time-action]')?.dataset.timeAction;
    if (!action || disposed || suspended) return;
    try { clock[action](); paint(); schedule(); } catch (error) { onStatus(error.message, true); }
  }, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPaint(); else { paint(); schedule(); } }, { signal: controller.signal });
  function dispose() { if (disposed) return; disposed = true; stopPaint(); controller.abort(); for (const node of bar.querySelectorAll('button')) node.disabled = true; panel.dataset.clockState = 'disposed'; }
  signal?.addEventListener('abort', dispose, { once: true, signal: controller.signal });
  if (signal?.aborted) dispose(); else { paint(false); schedule(); }
  return { ...timeResult(clock.snapshot()), dispose, suspend() { suspended = true; stopPaint(); }, resume() { if (disposed) return; suspended = false; paint(); schedule(); } };
}

function localStorageFor(window) { try { return window.localStorage; } catch { return { getItem() { throw new Error('不能读取浏览器存储'); } }; } }
function todoResult(snapshot) { return { text: encodeTodos(snapshot.items), extension: 'json', mime: 'application/json;charset=utf-8', table: [['完成', '事项'], ...snapshot.items.map(item => [item.completed ? '✓' : '', item.text])] }; }

export function mountTodos(context = {}) {
  const { lab, signal, onResult = () => {}, onStatus = () => {} } = context;
  if (!lab) throw new Error('请在网页中打开待办');
  const document = lab.ownerDocument, window = document.defaultView;
  const controller = new AbortController(), store = createTodoStore(localStorageFor(window));
  let disposed = false, suspended = false;
  const panel = document.createElement('section'); panel.dataset.todoWorkbench = '';
  const storageNotice = document.createElement('p'); storageNotice.dataset.todoStorage = '';
  const addLine = document.createElement('div'); addLine.className = 'todo-add';
  const input = document.createElement('input'); input.type = 'text'; input.dataset.todoInput = ''; input.maxLength = TODO_TEXT_LIMIT * 2; input.setAttribute('aria-label', '新待办');
  const add = document.createElement('button'); add.type = 'button'; add.dataset.todoAdd = ''; add.textContent = '添加';
  addLine.append(input, add);
  const list = document.createElement('ul'); list.dataset.todoList = '';
  const clear = document.createElement('button'); clear.type = 'button'; clear.dataset.todoClear = ''; clear.textContent = '删掉已完成';
  const importLabel = document.createElement('label'); importLabel.textContent = '导入 JSON';
  const importer = document.createElement('textarea'); importer.dataset.todoImport = ''; importer.setAttribute('aria-label', '待办 JSON'); importer.rows = 3;
  const importButton = document.createElement('button'); importButton.type = 'button'; importButton.dataset.todoImportButton = ''; importButton.textContent = '替换列表';
  importLabel.append(importer); panel.append(storageNotice, addLine, list, clear, importLabel, importButton); lab.append(panel);
  function paint(notify = true) {
    if (disposed || suspended) return;
    const snapshot = store.snapshot();
    panel.dataset.todoCount = String(snapshot.items.length); panel.dataset.todoPersistent = String(snapshot.persistent);
    storageNotice.textContent = snapshot.persistent ? '只保存在此浏览器。' : snapshot.warning || '只保存在内存，刷新会丢失。';
    list.replaceChildren();
    for (const item of snapshot.items) {
      const row = document.createElement('li'); row.dataset.todoId = item.id;
      const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = item.completed; toggle.dataset.todoToggle = ''; toggle.setAttribute('aria-label', `完成：${item.text}`);
      const text = document.createElement('input'); text.type = 'text'; text.value = item.text; text.dataset.todoEdit = ''; text.maxLength = TODO_TEXT_LIMIT * 2; text.setAttribute('aria-label', `编辑：${item.text}`);
      const save = document.createElement('button'); save.type = 'button'; save.dataset.todoSave = ''; save.textContent = '保存';
      const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.todoRemove = ''; remove.textContent = '×'; remove.setAttribute('aria-label', `删除：${item.text}`);
      row.append(toggle, text, save, remove); list.append(row);
    }
    if (notify) { onResult(todoResult(snapshot)); onStatus(snapshot.persistent ? `${snapshot.items.length} 条待办` : storageNotice.textContent); }
  }
  function action(run) { if (disposed || suspended) return; try { run(); paint(); } catch (error) { onStatus(error.message, true); } }
  function addItem() { action(() => { store.add(input.value); input.value = ''; }); }
  add.addEventListener('click', addItem, { signal: controller.signal });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); addItem(); } }, { signal: controller.signal });
  clear.addEventListener('click', () => action(() => store.clearCompleted()), { signal: controller.signal });
  importButton.addEventListener('click', () => action(() => { store.replace(importer.value); importer.value = ''; }), { signal: controller.signal });
  list.addEventListener('change', event => { const row = event.target.closest('[data-todo-id]'); if (row && event.target.matches('[data-todo-toggle]')) action(() => store.toggle(row.dataset.todoId, event.target.checked)); }, { signal: controller.signal });
  list.addEventListener('click', event => {
    const row = event.target.closest('[data-todo-id]'); if (!row) return;
    if (event.target.matches('[data-todo-save]')) action(() => store.edit(row.dataset.todoId, row.querySelector('[data-todo-edit]').value));
    if (event.target.matches('[data-todo-remove]')) action(() => store.remove(row.dataset.todoId));
  }, { signal: controller.signal });
  function dispose() { if (disposed) return; disposed = true; controller.abort(); store.dispose(); for (const node of panel.querySelectorAll('input,button,textarea')) node.disabled = true; }
  signal?.addEventListener('abort', dispose, { once: true, signal: controller.signal });
  if (signal?.aborted) dispose(); else paint(false);
  return { ...todoResult(store.snapshot()), dispose, suspend() { suspended = true; }, resume() { if (disposed) return; suspended = false; paint(); } };
}

export const tools = [
  { id: 'countdown', title: '倒计时', requirements: ['B049'], group: '时间', fields: [field('seconds', '秒数', 60)], run: async (input, context) => mountClock(createClock({ kind: 'countdown', duration: durationSeconds(input.seconds, '倒计时') }), context) },
  { id: 'stopwatch', title: '秒表', requirements: ['B050'], group: '时间', fields: [], run: async (_input, context) => mountClock(createClock({ kind: 'stopwatch' }), context) },
  { id: 'pomodoro', title: '番茄钟', requirements: ['B051'], group: '时间', fields: [field('workSeconds', '专注秒数', 1500), field('restSeconds', '休息秒数', 300), field('cycles', '轮数', 4)], run: async (input, context) => mountClock(createClock({ kind: 'pomodoro', work: durationSeconds(input.workSeconds, '专注时间'), rest: durationSeconds(input.restSeconds, '休息时间'), cycles: Number(input.cycles) }), context) },
  { id: 'todo', title: '待办', requirements: ['B052'], group: '学习', fields: [], run: async (_input, context) => mountTodos(context) },
];

function cabal312512(){return 43;}
