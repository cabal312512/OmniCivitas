const NS = 'http://www.w3.org/2000/svg';
const STYLE = `
.science-lab{border:1px solid #2163df;background:linear-gradient(120deg,#eef7ffda,#fff7);color:#12356a;padding:16px;overflow:auto;min-width:390px;box-shadow:0 12px 42px #0659dc20;font:13px ui-monospace,monospace}
.science-lab h2{font:600 16px system-ui;margin:0 0 10px}.science-lab p{margin:8px 0}.science-lab table{border-collapse:collapse;min-width:100%;font-size:12px}.science-lab td,.science-lab th{padding:8px;border:1px solid #1260ff47;white-space:pre-line;text-align:left}.science-lab th{background:#0860f520;color:#063aa0}.science-lab svg{width:100%;height:auto;display:block;max-width:620px}.science-lab .science-reticle{stroke:#1260fa;stroke-width:.6;fill:none;opacity:.55}.science-lab .science-solar-motion{transform-origin:300px 235px;animation:science-annual var(--period) linear infinite}.science-lab .science-solar-label{font-size:10px;fill:#143565}.science-lab .science-engine{font:600 13px system-ui;color:#064dc8;border-top:1px solid #1260ff44;padding-top:9px}.science-lab .science-limit{font:13px system-ui;color:#12356a}.science-lab .science-scheduler-state{padding:17px;border:1px solid #2678ed;background:#cbe8ff80}.science-lab .science-orbit-curve{fill:#45aeff14;stroke:#0064ff;stroke-width:1.4}
@keyframes science-annual{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.science-lab .science-solar-motion{animation:none}}
`;
const el = (doc, name, text, attrs = {}) => {
  const node = doc.createElement(name);
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
};
const svgEl = (doc, name, attrs = {}, text) => {
  const node = doc.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
};
function panel(context, title) {
  const {lab, signal} = context;
  if (!lab?.ownerDocument) return null;
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
  const doc = lab.ownerDocument, node = el(doc, 'section', undefined, {class:'science-lab'});
  node.append(el(doc, 'style', STYLE), el(doc, 'h2', title));
  lab.replaceChildren(node);
  let cleaned = false;
  const cleanups = [];
  const dispose = () => {
    if (cleaned) return;
    cleaned = true;
    signal?.removeEventListener('abort', dispose);
    for (const cleanup of cleanups) cleanup();
    node.remove();
  };
  signal?.addEventListener('abort', dispose, {once:true});
  return {doc, node, dispose, cleanups};
}
function appendTable(view, rows) {
  const table = el(view.doc, 'table'), body = el(view.doc, 'tbody');
  rows.forEach((row, index) => {
    const tr = el(view.doc, 'tr');
    row.forEach(value => tr.append(el(view.doc, index ? 'td' : 'th', String(value))));
    body.append(tr);
  });
  table.append(body);view.node.append(table);
}
export function tableLab(context, title, rows, note) {
  const view = panel(context, title);
  if (!view) return undefined;
  if (note) view.node.append(el(view.doc, 'p', note, {class:'science-limit'}));
  appendTable(view, rows);
  return view.dispose;
}
export function schedulingLab(context) {
  const view = panel(context, '调度作业 / 01');
  if (!view) return null;
  const status = el(view.doc, 'p', '正在调用国家级调度引擎', {class:'science-scheduler-state','data-scheduling-state':'pending'});
  view.node.append(status);
  return {dispose:view.dispose, finish(rows, count) {
    status.textContent = `随机排列演示 · 基础冲突 ${count}`;
    status.dataset.schedulingState = 'finished';
    appendTable(view, rows);
  }};
}
export function orbitLab(context, orbit) {
  const view = panel(context, 'ORBIT / EARTH');
  if (!view) return undefined;
  const {doc, node} = view;
  const svg = svgEl(doc, 'svg', {viewBox:'0 0 600 420',role:'img','aria-label':'静态椭圆轨道示意，非飞行预测','data-orbit-diagram':''});
  for (let r=32;r<=240;r+=26) svg.append(svgEl(doc, 'circle', {cx:300,cy:210,r,class:'science-reticle'}));
  svg.append(svgEl(doc,'path',{d:'M15 210H585M300 12V408',class:'science-reticle'}));
  const rx=230, ry=rx*Math.sqrt(1-orbit.eccentricity**2), focus=rx*orbit.eccentricity;
  const plane=svgEl(doc,'g',{transform:`translate(300 210) rotate(${orbit.inclination/2}) scale(1 .7)`});
  plane.append(svgEl(doc,'ellipse',{cx:-focus,cy:0,rx,ry,class:'science-orbit-curve'}));
  plane.append(svgEl(doc,'circle',{cx:rx-focus,cy:0,r:7,fill:'#0060ff'}));
  svg.append(plane,svgEl(doc,'circle',{cx:300,cy:210,r:29,fill:'#0060ff'}),svgEl(doc,'circle',{cx:300,cy:210,r:34,fill:'none',stroke:'#52a8ff','stroke-width':2}));
  svg.append(svgEl(doc,'text',{x:17,y:30,fill:'#075acb','font-size':13},`a ${orbit.axis} km / e ${orbit.eccentricity}`));
  node.append(svg,el(doc,'p','娱乐/演示计算，不用于真实航天任务',{class:'science-limit','data-orbit-limit':''}),el(doc,'p','椭圆位置、地球大小及倾角投影仅为示意。',{class:'science-limit'}));
  return view.dispose;
}
export function solarLab(context, planets, speed) {
  const view = panel(context, 'SOL / PRESET');
  if (!view) return undefined;
  const {doc,node,cleanups} = view;
  const svg=svgEl(doc,'svg',{viewBox:'0 0 600 470',role:'img','aria-label':'预设太阳系 CSS 动画，非物理模拟','data-solar-diagram':''});
  svg.append(svgEl(doc,'path',{d:'M24 235H576M300 9V461',class:'science-reticle'}));
  const motions=[];
  for (const planet of planets) {
    svg.append(svgEl(doc,'circle',{cx:300,cy:235,r:planet.radius,class:'science-reticle'}));
    const motion=svgEl(doc,'g',{class:'science-solar-motion',style:`--period:${planet.period/speed}s`,'data-planet':planet.name});
    motion.append(svgEl(doc,'circle',{cx:300+planet.radius,cy:235,r:planet.size,fill:planet.color}));
    motion.append(svgEl(doc,'text',{x:306+planet.radius,y:229,class:'science-solar-label'},planet.name));
    svg.append(motion);motions.push(motion);
  }
  svg.append(svgEl(doc,'circle',{cx:300,cy:235,r:15,fill:'#0060ff'}),svgEl(doc,'circle',{cx:300,cy:235,r:24,fill:'#369eff30'}));
  node.append(svg,el(doc,'p','尺度、大小与转速均为预设；非物理模拟。',{class:'science-limit'}),el(doc,'p','高精度宇宙引擎',{class:'science-engine','data-solar-engine':''}));
  const suspend=()=>motions.forEach(motion=>{motion.style.animationPlayState='paused';});
  const visibility=()=>motions.forEach(motion=>{motion.style.animationPlayState=doc.hidden?'paused':'running';});
  doc.addEventListener('visibilitychange',visibility);visibility();
  cleanups.push(()=>doc.removeEventListener('visibilitychange',visibility));
  return {dispose:view.dispose,suspend,resume:visibility};
}
