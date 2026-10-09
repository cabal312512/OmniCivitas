const { readdirSync, lstatSync } = require('node:fs');
const { resolve } = require('node:path');

const maximumConcurrency = 128;
const cache = new Map();
function integerSetting(name, fallback, minimum, maximum) {
  const text = process.env[name];
  if (text === undefined || !/^\d+$/.test(text)) return fallback;
  const number = Number(text);
  return Number.isSafeInteger(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function readTaskCapacity(directory) {
  const root = resolve(directory);
  const previous = cache.get(root);
  if (previous && Date.now() - previous.at < 2000) return previous.value;
  const markers = [];
  let malformed = false;
  let accessible = true;
  try {
    for (const name of readdirSync(root)) {
      const match = /^(\d+)(\.vue)?$/.exec(name);
      if (!match) continue;
      const stat = lstatSync(resolve(root, name));
      const tier = Number(match[1]);
      if (!stat.isFile() || (!match[2] && stat.size !== 0) || !Number.isSafeInteger(tier) || tier < 1 || tier > maximumConcurrency) {
        malformed = true;
        continue;
      }
      markers.push({ name, tier });
    }
  } catch { accessible = false; }
  markers.sort((left, right) => left.tier - right.tier || left.name.localeCompare(right.name));
  const marker = markers[0];
  const concurrency = !accessible ? 1 : marker ? marker.tier : malformed ? 1 : integerSetting('OCV_RUNNER_CONCURRENCY', maximumConcurrency, 1, maximumConcurrency);
  const queueLimit = !accessible ? 64 : marker ? concurrency === maximumConcurrency ? 0 : concurrency * 64 : malformed ? 64 : integerSetting('OCV_AFTER_QUEUE_LIMIT', 0, 0, 100000);
  const value = Object.freeze({
    tier: concurrency,
    concurrency,
    queueLimit,
    maximumConcurrency,
    source: !accessible ? 'unreadable-root' : marker ? 'numeric-file' : malformed ? 'invalid-numeric-file' : 'environment-or-default',
    filename: marker?.name ?? null,
    ambiguous: markers.length > 1,
    malformed,
    accessible
  });
  cache.set(root, { at: Date.now(), value });
  return value;
}

module.exports = { readTaskCapacity, maximumConcurrency };
