import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ledger = JSON.parse(await readFile(path.join(root, 'docs/requirements.json'), 'utf8'));
const publication = JSON.parse(await readFile(path.join(root, 'config/source-publication.json'), 'utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [file, hash] of Object.entries(publication.ledgers)) {
  if (digest(await readFile(path.join(root, file))) !== hash) throw new Error('Frozen ledger changed: '+file);
}
async function authorInput(file, expectedHash) {
  const omission = publication.omissions.find(row => row.file === file);
  if (!omission || omission.sha256 !== expectedHash) throw new Error('Missing original input declaration: '+file);
  try {
    const bytes = await readFile(path.join(root, file));
    if (digest(bytes) !== expectedHash || bytes.length !== omission.bytes) throw new Error('Original input changed: '+file);
    return bytes;
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
const source = await authorInput('PROJECT_SPEC.txt', ledger.sourceHash);
const sourceLines = source?.toString('utf8').split(/\r?\n/);
const expected = [...Array.from({ length: 381 }, (_, i) => `A${String(i + 1).padStart(3, '0')}`), ...Array.from({ length: 351 }, (_, i) => `B${String(i + 1).padStart(3, '0')}`)];
if (ledger.requirements.length !== 732 || new Set(ledger.requirements.map(r => r.id)).size !== 732) throw new Error('Missing or duplicate numbered requirements.');
for (const id of expected) {
  const item = ledger.requirements.find(r => r.id === id);
  if (!item || item.phase < 1 || item.phase > 9 || !item.text) throw new Error(`Invalid ${id}`);
  if (!Number.isInteger(item.sourceLine) || item.sourceLine < 1) throw new Error(`Invalid source line ${id}`);
  if (sourceLines && sourceLines[item.sourceLine - 1].replace(/^\d+\.\s*/, '') !== item.text) throw new Error(`Text mismatch ${id}`);
  if (item.status === 'verified' && (!item.implementation.length || !item.verification.length)) throw new Error(`${id} marked verified without evidence.`);
}
if (ledger.stackCategories.length !== 34) throw new Error('Stack category loss.');
const prompt = await authorInput('AI写的提示词.txt', ledger.promptSourceHash);
console.log(source && prompt
  ? 'PASS: frozen ledgers, all 732 IDs, 34 categories and locally retained original input hashes/line mappings are intact.'
  : 'PASS: frozen ledger hashes, all 732 IDs and 34 categories are intact. Original author inputs are explicitly omitted from this public clone; raw input/line verification is unavailable here.');

