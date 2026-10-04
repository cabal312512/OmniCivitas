export const REGEX_LIMITS = Object.freeze({ text: 100000, pattern: 2048, matches: 1000, output: 1024 * 1024 });

export function regexArguments(input = {}) {
  const text = String(input.text ?? '');
  const pattern = String(input.pattern ?? '');
  const flags = String(input.flags ?? '');
  if (text.length > REGEX_LIMITS.text) throw new Error('文本最多 100000 个 UTF-16 单元');
  if (pattern.length > REGEX_LIMITS.pattern) throw new Error('表达式最多 2048 个字符');
  if (flags.length > 8 || /[^dgimsuvy]/.test(flags)) throw new Error('只接受 JavaScript RegExp 标志 dgimsuvy');
  return { text, pattern, flags };
}

// This function only runs in the disposable Worker in the application. Its pure export is for bounded test vectors.
export function evaluateRegex(input) {
  const { text, pattern, flags } = regexArguments(input);
  const regex = new RegExp(pattern, flags);
  const matches = [];
  let outputBytes = 0;
  let truncated = false;
  const repeating = regex.global || regex.sticky;
  const unicode = regex.unicode || regex.unicodeSets;
  while (matches.length < REGEX_LIMITS.matches) {
    const match = regex.exec(text);
    if (!match) break;
    const row = {
      index: match.index,
      value: match[0],
      groups: Array.from(match).slice(1).map(value => value ?? null),
      namedGroups: match.groups ? { ...match.groups } : null,
      ...(match.indices ? { indices: Array.from(match.indices, value => value ?? null) } : {}),
    };
    // Reject a huge nested-capture result before JSON serialization can create a large temporary string.
    // JSON escapes can occupy six bytes per UTF-16 unit; property/index overhead is bounded separately.
    const values = [row.value, ...row.groups, ...Object.values(row.namedGroups ?? {})];
    const upperBytes = values.reduce((sum, value) => sum + (value?.length ?? 0) * 6 + 32, 256) + (row.indices?.length ?? 0) * 48;
    if (outputBytes + upperBytes > REGEX_LIMITS.output) { truncated = true; break; }
    const bytes = new TextEncoder().encode(JSON.stringify(row)).length;
    if (outputBytes + bytes > REGEX_LIMITS.output) { truncated = true; break; }
    outputBytes += bytes;
    matches.push(row);
    if (!repeating) break;
    if (!match[0].length) {
      const index = regex.lastIndex;
      const point = text.codePointAt(index);
      regex.lastIndex = index + (unicode && point > 0xffff ? 2 : 1);
    }
  }
  if (matches.length === REGEX_LIMITS.matches) truncated = true;
  return { source: regex.source, flags: regex.flags, matches, truncated, limits: REGEX_LIMITS, ...(truncated ? { note: '达到数量或保守输出大小上限，后续匹配未返回' } : {}) };
}
