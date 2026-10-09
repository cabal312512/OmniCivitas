import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publicationFiles } from '../scripts/publication-files.mjs';
import { isAuthorOnlyDocument, isNonPortableSourcePath } from '../scripts/publication-policy.mjs';

test('public source paths can be checked out on Windows', () => {
  for (const file of ['pinia/receipt2/aux.rs', 'NUL.txt', 'path/COM1/data', 'a/b.', 'a/b ', 'a/b:c']) assert.equal(isNonPortableSourcePath(file), true, file);
  for (const file of ['pinia/receipt2/aux1.rs', 'a/com10.rs', 'a/auxiliary.rs', '窗口/图.vue']) assert.equal(isNonPortableSourcePath(file), false, file);
});

test('a public preview retains runnable sources and explicit public docs, but not private machine state', async () => {
  const repository = await mkdtemp(path.join(tmpdir(), 'ocv-publication-'));
  const policy = { omissions: [{ file: 'Prompt.txt' }],
    publicDocuments: ['docs/PORTABILITY.md'], localOnlyFiles: ['config/runtime.local.json'],
    localOnlyPatterns: ['^scripts/record-', '^vps-1g/'] };
  const files = { '.git': 'gitdir: private-location', '.gitignore': 'docs/*\n!docs/PORTABILITY.md\nconfig/runtime.local.json\n',
    'config/source-publication.json': JSON.stringify(policy), 'config/runtime.local.json': '{}',
    'config/runtime.local.example.json': '{}', 'docs/HANDOFF.md': 'private', 'docs/PORTABILITY.md': 'public',
    'docs/licenses/NOTICE.txt': 'required license', 'Prompt.txt': 'private', 'scripts/record-local.mjs': 'private',
    'scripts/local-runtime.mjs': 'public', 'vps-1g/copy.js': 'separate local copy',
    'node_modules/dependency/package.json': '{}', 'services/gateway/src/main.ts': 'public',
    'services/gateway/dist/main.js': 'generated' };
  try {
    for (const [file, contents] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(repository, file)), { recursive: true });
      await writeFile(path.join(repository, file), contents);
    }
    const included = await publicationFiles(repository);
    for (const file of ['config/runtime.local.example.json', 'scripts/local-runtime.mjs', 'docs/PORTABILITY.md', 'services/gateway/src/main.ts']) assert.ok(included.includes(file), file);
    for (const file of ['.git', 'config/runtime.local.json', 'docs/HANDOFF.md', 'Prompt.txt', 'scripts/record-local.mjs', 'vps-1g/copy.js', 'node_modules/dependency/package.json', 'services/gateway/dist/main.js']) assert.ok(!included.includes(file), file);
    assert.equal(isAuthorOnlyDocument('docs/licenses/NOTICE.txt', policy), false);
  } finally { await rm(repository, { recursive: true, force: true }); }
});
