export const ODD_TEXT_LIMIT = 4000;
export const WAIT_MS = 15000;
export const QUESTIONNAIRE = Object.freeze([
  '电梯里有几层按钮？', '星期三是否应当独立？', '勺子需要年检吗？', '你更信任左括号还是右括号？',
  '文件夹有没有方向感？', '桌角是否已经审批？', '空格应该占几个座位？', '今天的蓝色够不够蓝？',
  '上一次眨眼是否有效？', '回形针是否应该轮休？', '走廊有必要设副走廊吗？', '这个问号需要编号吗？',
  '如果椅子请假，谁代班？', '最后一个问题应当放在哪里？',
]);
export const DEMO_COOKIE_NAMES = Object.freeze(['ocv_demo_geometry', 'ocv_demo_queue', 'ocv_demo_margin']);
export const LOADER_KINDS = Object.freeze(['orbit', 'bars', 'dots', 'squares', 'ripple', 'scan', 'braid', 'meter']);

export function oddText(value, label = '文字', limit = ODD_TEXT_LIMIT) {
  if (typeof value !== 'string') throw new Error(`请输入${label}`);
  const text = value.trim();
  if (!text || [...text].length > limit) throw new Error(`${label}需要 1–${limit} 个字符`);
  return text;
}
export function oddNumber(value, label = '数字', min = -1000000, max = 1000000) {
  const text = String(value).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) throw new Error(`${label}需要十进制数字`);
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label}超出范围`);
  return number;
}
export function hashText(text) {
  let hash = 2166136261;
  for (const code of text) { hash ^= code.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function gregorian(source) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) throw new Error('日期格式为 YYYY-MM-DD');
  const [year, month, day] = source.split('-').map(Number), date = new Date(0);
  date.setUTCHours(0, 0, 0, 0); date.setUTCFullYear(year, month - 1, day);
  if (year < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error('日期不存在');
  return { year, month, day, ordinal: date.getTime() / 86400000, weekday: date.getUTCDay() };
}

// Twenty separate, genuinely evaluated terms. Their weights are intentionally meaningless.
export function suitability(dateSource, browserVersion, randomSource) {
  const day = gregorian(oddText(dateSource, '日期', 10));
  const version = oddText(browserVersion, '浏览器版本', 80);
  if (!/^\d{1,8}(?:\.\d{1,8}){0,7}$/.test(version)) throw new Error('浏览器版本只能包含数字和点');
  const pieces = version.split('.').map(Number), random = oddNumber(randomSource, '随机数字');
  const terms = [
    ['年份余数', (day.year % 97) * .73], ['月份折返', Math.cos(day.month / 12 * Math.PI) * 21],
    ['日号立方根', Math.cbrt(day.day) * 14], ['星期权重', day.weekday * 6.7],
    ['历日正弦', Math.sin(day.ordinal / 17) * 37], ['历日模数', (day.ordinal % 31) * .41],
    ['版本主号', Math.sqrt(pieces[0] + 1) * 9.3], ['版本分段', pieces.length * 11.2],
    ['版本字符', version.length * 2.71], ['版本点号', (version.match(/\./g)?.length || 0) * -3.4],
    ['版本尾号', (pieces.at(-1) % 79) * .37], ['版本总和', pieces.reduce((a, b) => a + b, 0) % 113],
    ['随机正弦', Math.sin(random) * 47], ['随机平方根', Math.sqrt(Math.abs(random)) * .77],
    ['随机余数', (random % 19) * 1.3], ['日期与版本', Math.cos(day.day + pieces.length) * 17],
    ['版本与随机', Math.sin(pieces[0] + random / 3) * 23], ['月号对数', Math.log1p(day.month) * 8.1],
    ['字符散列', (hashText(`${dateSource}:${version}`) % 101) * .21], ['常量折旧', 63.7 * Math.PI / 7],
  ];
  const sum = terms.reduce((total, [, value]) => total + value, 0);
  const percent = Math.round((((sum % 100) + 100) % 100) * 10) / 10;
  return { percent, sum, terms, formula: 'round((((Σ 20 项贡献) % 100 + 100) % 100) × 10) / 10' };
}
export function filenameRisk(source) {
  const name = oddText(source, '文件名', 240), length = [...name].length;
  const underscores = (name.match(/_/g) || []).length, digits = (name.match(/\d/g) || []).length;
  const repeatedFinal = (name.match(/final/gi) || []).length;
  const risk = Math.min(100, length * 1.6 + underscores * 11 + digits * 7 + Math.max(0, repeatedFinal - 1) * 19);
  return { name, length, underscores, digits, repeatedFinal, risk: Math.round(risk * 10) / 10, verdict: risk >= 70 ? '大概率继续改名' : risk >= 35 ? '尚有修改余地' : '文件暂时认识自己' };
}
export function variableMaturity(source) {
  const name = oddText(source, '变量名', 240), length = [...name].length;
  const capitals = (name.match(/[A-Z]/g) || []).length, digits = (name.match(/\d/g) || []).length;
  const temporary = (name.match(/data|new|final|temp|foo/gi) || []).length;
  const validIdentifier = /^[\p{ID_Start}_$][\p{ID_Continue}$]*$/u.test(name);
  const maturity = Math.max(0, Math.min(100, 58 + length * 1.7 + capitals * 4.3 + digits * 3.1 - temporary * 5.6 - (validIdentifier ? 0 : 41)));
  return { name, length, capitals, digits, temporary, validIdentifier, maturity: Math.round(maturity * 10) / 10 };
}
export function windowDiscipline(width, height) {
  if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 100000)) throw new Error('窗口尺寸无效');
  const ratio = width / height;
  return { width, height, ratio, verdict: ratio < .75 || ratio > 2.4 ? '窗口缺乏组织纪律' : '窗口暂未提出异议' };
}
export function refreshAssessment({ width = 1000, height = 800, pixels = 0, wheelEvents = 0, second = 0 } = {}) {
  const values = [width, height, pixels, wheelEvents, second];
  if (!values.every(value => Number.isFinite(value) && value >= 0)) throw new Error('刷新判断参数无效');
  const names = ['窗口尾数', '椅子借位', '标点出勤', '滚轮工龄', '页边缘预算', '左侧审批', '右侧备案', '空行库存'];
  const checks = Array.from({ length: 40 }, (_, index) => {
    const value = values[index % values.length];
    return { number: index + 1, name: `${names[index % names.length]}·${Math.floor(index / names.length) + 1}`, pass: ((Math.floor(value) + (index + 1) ** 2 + index * 17) % (index + 7)) % 2 === 0 };
  });
  const approved = checks.filter(check => check.pass).length;
  return { checks, approved, verdict: approved % 3 === 0 ? '可以刷新，也可以不刷新' : '建议保持现状' };
}
export function complicated(source) {
  const text = oddText(source, '问题');
  const templates = [
    ['前置条件', `确认“${text}”已经作为一个问题提出`], ['前置条件', '划定问题开始前的准备阶段'],
    ['前置条件', '为准备阶段设立前期准备阶段'], ['前置条件', '指定负责指定负责人的负责人'],
    ['约束', '回答不得先于提问被正式认定'], ['约束', '所有选项应先完成选项身份登记'],
    ['约束', '不允许在决定之前擅自做决定'], ['约束', '每次犹豫必须留出复核窗口'],
    ['约束', '对上一条约束建立单独的约束台账'], ['约束', '会议室编号与问题编号不应相同'],
    ['风险', '结论可能无法代表结论本身'], ['风险', '负责人的负责人可能已另有负责人'],
    ['风险', '准备工作会产生新的准备工作'], ['风险', '问题可能在处理中被认定仍需处理'],
    ['风险', '归档后的问题可能要求重新归档'], ['风险', '最终决定存在成为临时决定的可能'],
  ];
  return { question: text, items: templates.map(([kind, content], index) => ({ number: index + 1, kind, content })) };
}
export function predict404(source) {
  const fragment = oddText(source, '网址片段', 1000);
  return { fragment, probability: (hashText(fragment) % 1001) / 10 };
}
export function cryptographicChoice(limit, cryptoObject = globalThis.crypto) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 65536) throw new Error('随机范围无效');
  const ceiling = 4294967296 - (4294967296 % limit), value = new Uint32Array(1);
  for (let attempt = 0; attempt < 32; attempt++) {
    cryptoObject.getRandomValues(value);
    if (value[0] < ceiling) return value[0] % limit;
  }
  throw new Error('随机源没有产生可用数字');
}
export function progressValues(elapsed, random) {
  if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(random) || random < 0 || random > 100) throw new Error('进度参数无效');
  const trueValue = Math.min(100, elapsed / 3000 * 100);
  // 500 ms at exactly 120 makes the overrun observable, rather than a single skipped frame.
  const overrun = elapsed < 2400 ? elapsed / 2400 * 120 : elapsed < 2900 ? 120 : Math.max(100, 120 - (elapsed - 2900) / 400 * 20);
  return { values: [Math.round(trueValue * 10) / 10, random, Math.round(overrun * 10) / 10], complete: elapsed >= 3300 };
}
// Keep the overrun as a displayed stage, even when a busy renderer skips several samples.
// The genuine bar still uses elapsed time; only the intentionally untruthful bar is staged.
export function createProgressSequence(now = () => performance.now()) {
  const origin = now();
  if (!Number.isFinite(origin)) throw new Error('进度时钟无效');
  let previous = origin, peakObservedAt = null;
  return {
    sample(random) {
      const observed = now();
      if (!Number.isFinite(observed) || !Number.isFinite(random) || random < 0 || random > 100) throw new Error('进度参数无效');
      const timestamp = Math.max(previous, observed); previous = timestamp;
      const elapsed = Math.max(0, timestamp - origin);
      const genuine = Math.round(Math.min(100, elapsed / 3000 * 100) * 10) / 10;
      let overrun, phase;
      if (elapsed < 2400) { overrun = elapsed / 2400 * 120; phase = 'growing'; }
      else {
        if (peakObservedAt === null) peakObservedAt = timestamp;
        const displayedFor = timestamp - peakObservedAt;
        if (displayedFor < 1500) { overrun = 120; phase = 'peak'; }
        else if (displayedFor < 1900) { overrun = 120 - (displayedFor - 1500) / 400 * 20; phase = 'returning'; }
        else { overrun = 100; phase = 'finished'; }
      }
      return { values: [genuine, random, Math.round(overrun * 10) / 10], elapsed, phase, complete: phase === 'finished' };
    },
  };
}
export function createWaitClock(now = () => performance.now()) {
  let origin = null;
  return {
    start() { if (origin === null) origin = now(); return this.snapshot(); },
    snapshot() { const elapsed = origin === null ? 0 : Math.max(0, now() - origin); return { state: origin === null ? 'idle' : elapsed >= WAIT_MS ? 'finished' : 'waiting', elapsed: Math.min(WAIT_MS, elapsed), completed: origin !== null && elapsed >= WAIT_MS }; },
  };
}
export function createUndoChoice() {
  let state = 'unselected', choice = '';
  return {
    snapshot: () => ({ state, choice }),
    choose(source) { if (state !== 'unselected') throw new Error('选择已经登记'); choice = oddText(source, '虚构选择', 240); state = 'active'; return this.snapshot(); },
    revoke() { if (state !== 'active') throw new Error('当前没有可以撤销的选择'); state = 'revoked'; return this.snapshot(); },
    revokeRevocation() { if (state !== 'revoked') throw new Error('请先撤销选择'); state = 'restored'; return this.snapshot(); },
  };
}
export function trajectoryCertificate(points, id) {
  if (!Array.isArray(points) || points.length < 8 || points.length > 2048 || !/^[A-Z0-9-]{8,80}$/.test(id)) throw new Error('轨迹或编号无效');
  const clean = points.map(point => {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(value => Number.isFinite(value) && value >= 0 && value <= 320)) throw new Error('轨迹坐标无效');
    return point.map(value => Math.round(value * 10) / 10);
  });
  const xs = clean.map(point => point[0]), ys = clean.map(point => point[1]);
  const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys);
  const gap = Math.hypot(clean[0][0] - clean.at(-1)[0], clean[0][1] - clean.at(-1)[1]);
  if (width < 20 || height < 20 || gap > Math.hypot(width, height) * .3) throw new Error('先画一条回到起点附近的圈');
  const path = clean.map((point, index) => `${index ? 'L' : 'M'}${point[0]},${point[1] + 72}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="440" viewBox="0 0 400 440"><rect width="400" height="440" fill="#fff"/><rect x="10" y="10" width="380" height="420" rx="4" fill="none" stroke="#155aff" stroke-width="2"/><text x="28" y="43" font-family="sans-serif" font-size="20" fill="#153479">轨迹公证编号</text><text x="28" y="65" font-family="monospace" font-size="11" fill="#153479">${id}</text><path d="${path}" transform="translate(38 0)" fill="none" stroke="#155aff" stroke-width="2"/><text x="28" y="409" font-family="sans-serif" font-size="12" fill="#153479">演示证书 · ${clean.length} 个采样点 · 不具法律效力</text></svg>`;
}
