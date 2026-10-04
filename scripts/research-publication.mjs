import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

// Publication exclusions are explicit; the original scientific seals stay intact.
export function publicationEntries(root, entries, policy) {
  const omitted = new Map(policy.omissions.map(row => [row.file, row]));
  const seen = new Set();
  const included = [];
  for (const entry of entries) {
    const source = path.join(root, entry.file);
    const omission = omitted.get(entry.file);
    if (omission) {
      if (omission.sha256 !== entry.sha256 || omission.bytes !== entry.bytes)
        throw Error('Publication exclusion does not match the frozen seal: ' + entry.file);
      seen.add(entry.file);
    }
    if (!omission || fs.existsSync(source)) {
      const bytes = fs.readFileSync(source);
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (bytes.length !== entry.bytes || hash !== entry.sha256)
        throw Error('Frozen scientific artifact changed: ' + entry.file);
    }
    if (!omission) included.push(entry);
  }
  for (const file of omitted.keys()) if (!seen.has(file))
    throw Error('Publication exclusion is absent from the original seal: ' + file);
  return included;
}
