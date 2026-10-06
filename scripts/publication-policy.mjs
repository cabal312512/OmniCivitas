// Source publication rules also apply to GitHub release archives.
export function isAuthorOnlyDocument(file, policy) {
  const normalized = file.replaceAll('\\', '/');
  const name = normalized.split('/').at(-1);
  if (/^(?:AGENTS|CLAUDE|HANDOFF(?:[-_].*)?)\.md$/i.test(name)) return true;
  if (policy.omissions.some(row => row.file === normalized)) return true;
  if (normalized.startsWith('docs/')) {
    if (normalized.startsWith('docs/licenses/')) return false;
    return !policy.publicDocuments.includes(normalized);
  }
  return false;
}
