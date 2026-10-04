/** Phase 7: local templates, deliberately unhelpful prose, truthful file bytes. */
export const MAX_GENERATOR_INPUT_BYTES = 32768;
export const MAX_GENERATOR_OUTPUT_BYTES = 1024 * 1024;
const MIME = 'text/plain;charset=utf-8';
const encoder = new TextEncoder();

export function checkedText(value, label = '内容', allowEmpty = false) {
  const text = String(value ?? '');
  if (encoder.encode(text).length > MAX_GENERATOR_INPUT_BYTES) throw Error(`${label}限 32 KiB`);
  if (!allowEmpty && !text.trim()) throw Error(`请输入${label}`);
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(++index);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw Error('文本有不完整的字符');
    } else if (unit >= 0xdc00 && unit <= 0xdfff) throw Error('文本有不完整的字符');
  }
  return text;
}

function receipt(text, options = {}) {
  if (encoder.encode(text).length > MAX_GENERATOR_OUTPUT_BYTES) throw Error('结果限 1 MiB');
  return {text, extension: 'txt', mime: MIME, ...options};
}

export function pick(list, rng = Math.random) {
  const value = rng();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('随机源须返回 0–1 之间的值');
  return list[Math.floor(value * list.length)];
}

const formalClauses = [
  '作为当前意愿记录，原句应予原样保留',
  '涉及意愿归属的部分，以原话为准',
  '对原句所表达的意思，不另作扩大解释',
  '对于文字整理工作，不据此改变原有意愿',
  '如需转述，仍应以原句含义作为依据',
  '与原话不符的推断，不纳入本次表述',
  '文字形式的调整，不产生新的承诺',
  '意愿确认与表述整理，均以原句为基础',
];

export function formalize(source, level = '2') {
  const text = checkedText(source);
  if (!['0', '1', '2'].includes(String(level))) throw Error('请选择正式程度');
  if (String(level) === '0') return text;
  const count = String(level) === '2' ? 40 : 12;
  return Array.from({length: count}, (_, index) =>
    `${String(index + 1).padStart(2, '0')}、关于「${text}」，${formalClauses[index % formalClauses.length]}。`
  ).join('\n');
}

export function inflateText(source) {
  const text = checkedText(source);
  const clauses = [
    '就这句话本身而言，需要把这句话再说一遍',
    '在这里所说的意思，仍然是这里所说的意思',
    '关于这件已经说过的事情，现再次作出如下表述',
    '如需对前述表述进行进一步表述，可以重复前述表述',
    '从文字的角度观察上述文字，其文字内容如下',
    '为了确保前面的内容有内容，后面的内容与之相同',
    '至于这句话到底说了什么，这句话已经说了',
    '这里再补充一句与原句完全一样的话',
    '从前文到后文，原句不因所在位置而改变',
    '对这句话的补充说明就是再次引用这句话',
  ];
  return clauses.map((clause, index) => `${index + 1}. ${clause}：「${text}」。`).join('\n');
}

export function compressText(source) { checkedText(source, '内容', true); return '知道了'; }

export const ERROR_EXPLANATION = '该错误代码已被成功生成。关于错误的详情，请参阅此错误代码。';
export function randomErrorCode(rng = Math.random) {
  const digit = () => pick('0123456789', rng);
  const code = `E-CIVILIZATION-${Array.from({length: 6}, digit).join('')}-${pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ', rng)}`;
  return `${code}\n${ERROR_EXPLANATION}`;
}

export function explainError(source) {
  const code = checkedText(source, '错误代码').trim().split(/\r?\n/, 1)[0];
  if (!/^E-CIVILIZATION-\d{6}-[A-Z]$/.test(code)) throw Error('请输入 E-CIVILIZATION-000000-A 格式的代码');
  return '该错误代码表示系统产生了错误代码';
}

/** Exact decimal rounding to six places: no floating-point or scientific-notation loss. */
export function sixDecimals(value) {
  const source = checkedText(value, '数字').trim();
  if (source.length > 128) throw Error('数字太长');
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(source);
  if (!match) throw Error('请输入有限的十进制数字');
  const fraction = match[3] ?? match[4] ?? '', whole = match[2] ?? '0';
  const exponent = Number(match[5] ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 100) throw Error('指数限 -100–100');
  const digits = `${whole}${fraction}`;
  if (digits.length > 80) throw Error('有效数字限 80 位');
  const coefficient = BigInt(digits), shift = exponent - fraction.length + 6;
  let scaled;
  if (shift >= 0) scaled = coefficient * 10n ** BigInt(shift);
  else {
    const divisor = 10n ** BigInt(-shift);
    scaled = coefficient / divisor + (coefficient % divisor * 2n >= divisor ? 1n : 0n);
  }
  if (scaled > 1000000000000000000n) throw Error('绝对值限 1000000000000');
  const integer = scaled / 1000000n, decimal = String(scaled % 1000000n).padStart(6, '0');
  return `${match[1] === '-' && scaled !== 0n ? '-' : ''}${integer}.${decimal}`;
}

export function authoritativeNumber(source) {
  const number = sixDecimals(source);
  const table = [
    ['项目', '数值', '单位'],
    ['观测值', number, '1'],
    ['不确定度', '0.000000', '1'],
    ['小数位数', '6', '位'],
    ['报告性质', '排版演示', '—'],
    ['复核结论', '尚未复核', '—'],
  ];
  return receipt(`${number} ± 0.000000\n\n${table.map(row => row.join('\t')).join('\n')}`, {table});
}

const committeePrefixes = ['临时', '联合', '第零届', '常设临时', '跨部门', '非正式常设', '特设', '待成立'];
const committeeTopics = ['按钮存在性', '加载顺序', '会议筹备', '文件终稿', '空白页审查', '鼠标走向', '进度核对', '下次讨论'];
const committeeEnds = ['协调委员会', '复核委员会', '筹备委员会', '顾问委员会', '意见征集委员会'];
export function committeeName(rng = Math.random) { return `${pick(committeePrefixes, rng)}${pick(committeeTopics, rng)}${pick(committeeEnds, rng)}`; }

const agendaItems = [
  '确认签到表是否已经准备签到', '讨论本次会议是否应称为会议', '审阅上次审阅意见的审阅意见',
  '为尚未确定的议题确定一个待定名称', '就下次是否继续讨论征集讨论意见', '确认茶歇是否可以先行讨论',
  '复核议程最后一项为什么在最后', '商议下次开会讨论本次会议',
];
export function meetingAgenda(topic, rng = Math.random) {
  const title = checkedText(topic, '会议主题');
  const selected = [...agendaItems];
  for (let index = selected.length - 1; index > 0; index--) {
    const other = pick(Array.from({length: index + 1}, (_, position) => position), rng);
    [selected[index], selected[other]] = [selected[other], selected[index]];
  }
  const table = [['时间', '议程'], ...selected.map((item, index) => [`${String(9 + Math.floor(index / 3)).padStart(2, '0')}:${String(index % 3 * 20).padStart(2, '0')}`, item])];
  return receipt(`${title}\n${table.map(row => row.join('\t')).join('\n')}`, {table});
}

export function projectCode(rng = Math.random) {
  return `OCV-${pick(['NORTH', 'VOID', 'SEVEN', 'GLASS', 'TEMP'], rng)}-${Array.from({length: 4}, () => pick('0123456789', rng)).join('')}-${pick(['ALPHA', 'DEFERRED', 'FINAL', 'PENDING'], rng)}`;
}

export function upgradeFilename(value) {
  const name = checkedText(value, '文件名').trim();
  if (Array.from(name).length > 240 || /[\\/\u0000-\u001f]/.test(name) || /^\.{1,2}$/.test(name)) throw Error('请输入不含路径、控制字符的文件名，限 240 字');
  const dot = name.lastIndexOf('.'), extension = dot > 0 ? name.slice(dot) : '', stem = dot > 0 ? name.slice(0, dot) : name;
  const versions = Array.from(stem.matchAll(/_v(\d+)(?=_|$)/g), match => Number(match[1]));
  if (versions.some(version => !Number.isSafeInteger(version) || version >= 999999)) throw Error('版本号已超过上限');
  const version = Math.max(1, ...versions) + 1;
  const plain = stem.replace(/_v\d+(?=_|$)/g, '');
  return `${plain}_v${version}_final_REAL_final${extension}`;
}

export const BUTTON_NAMES = [
  '继续并暂不继续', '确认取消当前确认', '提交撤回后的提交', '保存尚未保存的保存',
  '重置已重置的重置', '确定不确定当前确定', '关闭尚未打开的关闭', '返回下一步的上一步',
];
export const LOADING_REASONS = [
  '正在核对上一次加载是否加载完成', '正在等待等待状态准备就绪', '正在确认进度条知道当前进度',
  '正在检查检查是否需要检查', '正在为已加载内容安排再次加载', '正在核实圆圈是否还在转',
  '正在排队申请结束排队', '正在加载本次加载的加载理由',
];

export function disclaimer(rng = Math.random) {
  return [
    pick(['本说明仅负责说明本说明。', '阅读本说明不代表本说明已被阅读完毕。', '本说明中的空白不构成另一个说明。'], rng),
    pick(['如内容有所变化，以变化后的内容为准。', '如发现未说明事项，请参考未说明事项本身。', '若无法理解，可保留无法理解的状态。'], rng),
    pick(['本说明的解释权暂时等待解释。', '以上内容不保证产生任何用途。', '本说明至此结束，是否结束以本句为准。'], rng),
  ].join('\n');
}

export function programmerExcuse(rng = Math.random) {
  return pick(['我这边能跑。', '昨天还能跑，今天应该是昨天的问题。', '缓存没清，但也可能清得太干净了。', '这个文件不是我写的，是我复制后改的。', '测试环境跟测试环境不一样。', '重启一下试试，先别问重启什么。', '不是代码变了，是需求回来了。', '还差一个分号，至于哪个文件还在找。'], rng);
}

export function userExcuse(rng = Math.random) {
  return pick(['我没动，它自己变成这样的。', '我只点了一下，后来那些下不是我点的。', '我以为那个删除按钮是收起。', '密码肯定没错，就是账号可能不是这个。', '截图忘了截，但当时确实有个东西。', '我没关闭页面，只是把浏览器关了。', '操作步骤跟上次一样，上次也没记住。', '按钮离我太远，我就没过去。'], rng);
}

export function productDemand(rng = Math.random) {
  const demands = [
    ['按钮视觉上必须消失', '但用户第一眼必须能找到'],
    ['所有内容放在首屏', '首屏不得出现滚动或缩小的字'],
    ['不改变现有操作流程', '将所有操作步骤合并为零步'],
    ['页面保持完全静态', '每个元素都需要实时跟随鼠标'],
    ['加载过程不能出现等待', '加载动画至少展示三十秒'],
    ['界面颜色只能用白色', '每个状态需要不同的醒目颜色'],
    ['默认不保存任何设置', '下次打开必须恢复全部设置'],
    ['功能无需任何说明', '每个按钮先弹出完整使用手册'],
  ];
  const pair = pick(demands, rng);
  return `需求：${pair[0]}。\n验收：${pair[1]}。\n优先级：都要。`;
}

export function featureExistence(source, rng = Math.random) {
  const feature = checkedText(source, '功能');
  const reason = pick(['还缺一个关于缺少依据的依据', '可用性意见与不可用性意见尚未互相确认', '需要等下一次讨论确认是否继续讨论', '存在与否均有尚未收到的补充意见'], rng);
  return `关于「${feature}」：可能需要，也可能不需要。\n依据：${reason}。\n结论：暂时无法确定。`;
}

const textField = (key, label, value) => ({key, label, type: 'textarea', default: value});
function descriptor(id, title, requirements, fields, run) {
  return {id, title, requirements, group: '生成器', fields, run: async (input, context) => {
    if (context?.signal?.aborted) throw new DOMException('操作已取消', 'AbortError');
    return run(input);
  }};
}
export const tools = [
  descriptor('formalize', '文本正式化', ['B101', 'B102'], [textField('source', '原话', '我不想去'), {key: 'level', label: '程度', type: 'select', default: '2', options: [{value: '0', label: '原话'}, {value: '1', label: '公文'}, {value: '2', label: '最高'}]}], input => receipt(formalize(input.source, input.level))),
  descriptor('inflate-text', '废话膨胀', ['B103'], [textField('source', '原话', '今天吃什么')], input => receipt(inflateText(input.source))),
  descriptor('compress-text', '废话压缩', ['B104'], [textField('source', '整段', '关于今天吃什么这件事，需要先确认是否已经到了吃饭时间，然后再确认时间是否已经确认。')], input => receipt(compressText(input.source))),
  descriptor('useless-file', '无用文件', ['B121', 'B122'], [], () => receipt('该文件存在')),
  descriptor('error-code', '随机错误代码', ['B124', 'B125'], [], () => receipt(randomErrorCode())),
  descriptor('explain-error', '解释错误代码', ['B126', 'B127'], [textField('source', '代码', 'E-CIVILIZATION-004731-B')], input => receipt(explainError(input.source))),
  descriptor('authoritative-number', '数字权威化', ['B128', 'B129'], [{key: 'number', label: '数字', type: 'text', default: '5'}], input => authoritativeNumber(input.number)),
  descriptor('committee-name', '委员会名称', ['B130'], [], () => receipt(committeeName())),
  descriptor('meeting-agenda', '会议议程', ['B131'], [textField('topic', '主题', '终稿是否还能再终稿')], input => meetingAgenda(input.topic)),
  descriptor('project-code', '临时项目代号', ['B132'], [], () => receipt(projectCode())),
  descriptor('version-upgrade', '文件版本升级', ['B133'], [{key: 'filename', label: '文件名', type: 'text', default: 'final.docx'}], input => receipt(upgradeFilename(input.filename))),
  descriptor('button-name', '按钮名称', ['B134'], [], () => receipt(pick(BUTTON_NAMES))),
  descriptor('loading-reason', '加载理由', ['B135'], [], () => receipt(pick(LOADING_REASONS))),
  descriptor('disclaimer', '免责声明', ['B136'], [], () => receipt(disclaimer())),
  descriptor('programmer-excuse', '程序员借口', ['B137'], [], () => receipt(programmerExcuse())),
  descriptor('user-excuse', '用户借口', ['B138'], [], () => receipt(userExcuse())),
  descriptor('product-demand', '产品经理需求', ['B139'], [], () => receipt(productDemand())),
  descriptor('feature-existence', '此功能是否应该存在', ['B140'], [textField('feature', '功能', '这个分析器')], input => receipt(featureExistence(input.feature))),
];
