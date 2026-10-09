// Source publication rules also apply to GitHub release archives.
export function isNonPortableSourcePath(file) {
  return file.replaceAll('\\', '/').split('/').some(name =>
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ||
    /[<>:"|?*]|[. ]$/.test(name));
}

export function isAuthorOnlyDocument(file, policy) {
  const normalized = file.replaceAll('\\', '/');
  const name = normalized.split('/').at(-1);
  if (/^(?:AGENTS|CLAUDE|HANDOFF(?:[-_].*)?)\.md$/i.test(name)) return true;
  if (policy.omissions.some(row => row.file === normalized)) return true;
  if ((policy.localOnlyFiles || []).includes(normalized)) return true;
  if ((policy.localOnlyPatterns || []).some(pattern => new RegExp(pattern).test(normalized))) return true;
  if (normalized.startsWith('docs/')) {
    if (normalized.startsWith('docs/licenses/')) return false;
    return !policy.publicDocuments.includes(normalized);
  }
  return false;
}
