import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs');
await mkdir(docs, { recursive: true });
const raw = await readFile(path.join(root, 'PROJECT_SPEC.txt'));
const lines = raw.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
const sourceHash = createHash('sha256').update(raw).digest('hex');
let old = {};
try { old = Object.fromEntries(JSON.parse(await readFile(path.join(docs, 'requirements.json'), 'utf8')).requirements.map(r => [r.id, r])); } catch (error) { if (error.code !== 'ENOENT') throw error; }
function phase(group, n) {
  if (group === 'B') {
    if (n <= 17) return 4; if (n <= 25) return 6; if (n <= 48) return 5;
    if (n <= 58) return 6; if (n <= 70) return 5; if (n === 123) return 6;
    if (n <= 140) return 7; if (n <= 146) return 4; if (n <= 337) return 8;
    if (n <= 350) return 9; return 8;
  }
  if (n <= 41) return 3; if ([44,45,46,47,49,50,65,340].includes(n)) return 3; if (n <= 130) return 2;
  if (n <= 147) return 3; if (n <= 152) return 2; if (n <= 173) return 4;
  if (n <= 219) return 8; if (n <= 228) return 3;
  if (n <= 232) return 8; if (n === 233) return 3;
  if (n <= 235) return 1; if (n <= 239) return 8; if (n <= 242) return 1;
  if (n <= 278) return 8; if (n <= 287) return 2; if (n <= 322) return 8;
  if (n <= 340) return 2; if (n === 341) return 3; if (n <= 380) return 9; return 8;
}
let group = 'A';
const requirements = [];
const unnumbered = [];
lines.forEach((line, index) => {
  if (line.startsWith('附加 ')) { group = 'B'; return; }
  const match = line.match(/^(\d+)\.\s*(.*)$/);
  if (match) {
    const n = Number(match[1]); const id = `${group}${String(n).padStart(3, '0')}`;
    const original = old[id];
    if (original && original.text !== match[2]) throw new Error(`Source changed at ${id}; audit explicitly before replacing the requirement.`);
    requirements.push({ id, source: 'PROJECT_SPEC.txt', sourceLine: index + 1, text: match[2], phase: phase(group, n), status: original?.status || 'planned', implementation: original?.implementation || [], verification: original?.verification || [], notes: original?.notes || '', crossPhaseConstraint: group === 'A' && n >= 342 && n <= 379 || group === 'B' && n >= 338 && n <= 350 });
  } else if (index >= 35 && line.trim() && !line.startsWith('附加 ')) {
    unnumbered.push({ id: `N${String(unnumbered.length + 1).padStart(3, '0')}`, sourceLine: index + 1, text: line, status: 'planned', phase: 9 });
  }
});
const stackCategories = lines.slice(1, 35).map((line, index) => { const [category, ...specification] = line.split('\t'); return { id: `T${String(index + 1).padStart(3, '0')}`, sourceLine: index + 2, category, specification: specification.join('\t') }; });
const promptRaw = await readFile(path.join(root, 'AI写的提示词.txt'));
const promptParagraphs = promptRaw.toString('utf8').split(/\r?\n\s*\r?\n/).filter(x => x.trim()).map((text, index) => ({ id: `P${String(index + 1).padStart(3, '0')}`, text: text.trim(), status: 'planned', priority: 'user-instructions-override' }));
const ledger = { schemaVersion: 1, sourceHash, counts: { A: 381, B: 351, numbered: 732 }, requirements, unnumbered, stackCategories, promptSourceHash: createHash('sha256').update(promptRaw).digest('hex'), promptParagraphs };
await writeFile(path.join(docs, 'requirements.json'), JSON.stringify(ledger, null, 2) + '\n');
const escape = value => value.replaceAll('|', '\\|').replaceAll('\n', '<br>');
const markdown = '# 全量需求验收账本\n\n本表从原文生成，JSON 是状态来源。不得仅凭装包/文件存在标记 verified。阶段是主要归属，不豁免跨阶段约束。\n\n| ID | 原文行 | 阶段 | 状态 | 原始要求 | 实现 / 验证 |\n| --- | --- | --- | --- | --- | --- |\n' + requirements.map(r => `| ${r.id} | ${r.sourceLine} | ${r.phase} | ${r.status} | ${escape(r.text)} | ${escape([...r.implementation, ...r.verification].join('; '))} |`).join('\n') + '\n';
await writeFile(path.join(docs, 'REQUIREMENTS.md'), markdown);
console.log(`Ledger generated: ${requirements.filter(r => r.id.startsWith('A')).length} A + ${requirements.filter(r => r.id.startsWith('B')).length} B; ${stackCategories.length} original stack categories; ${promptParagraphs.length} full prompt paragraphs.`);

