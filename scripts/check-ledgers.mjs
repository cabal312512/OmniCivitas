import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ledger = JSON.parse(await readFile(path.join(root, 'docs/requirements.json'), 'utf8'));
const source = await readFile(path.join(root, 'PROJECT_SPEC.txt'));
if (createHash('sha256').update(source).digest('hex') !== ledger.sourceHash) throw new Error('Source hash changed. Reconcile the ledger before continuing.');
const sourceLines = source.toString('utf8').split(/\r?\n/);
const expected = [...Array.from({ length: 381 }, (_, i) => `A${String(i + 1).padStart(3, '0')}`), ...Array.from({ length: 351 }, (_, i) => `B${String(i + 1).padStart(3, '0')}`)];
if (ledger.requirements.length !== 732 || new Set(ledger.requirements.map(r => r.id)).size !== 732) throw new Error('Missing or duplicate numbered requirements.');
for (const id of expected) {
  const item = ledger.requirements.find(r => r.id === id);
  if (!item || item.phase < 1 || item.phase > 9 || !item.text) throw new Error(`Invalid ${id}`);
  if (sourceLines[item.sourceLine - 1].replace(/^\d+\.\s*/, '') !== item.text) throw new Error(`Text mismatch ${id}`);
  if (item.status === 'verified' && (!item.implementation.length || !item.verification.length)) throw new Error(`${id} marked verified without evidence.`);
}
if (ledger.stackCategories.length !== 34) throw new Error('Stack category loss.');
const prompt = await readFile(path.join(root, 'AI写的提示词.txt'));
if (createHash('sha256').update(prompt).digest('hex') !== ledger.promptSourceHash) throw new Error('Prompt source hash changed.');
console.log('PASS: all 732 IDs, source text/line mappings, 34 categories and original file hashes are intact.');

