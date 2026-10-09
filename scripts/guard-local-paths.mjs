import path from 'node:path';
import { resolveRuntimePaths } from './runtime-paths.mjs';
const root = resolveRuntimePaths().depsRoot;
if (process.env.OCV_LOCAL_STORAGE_GUARD === '1') {
  const canonical = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
  const within = value => { const relative = path.relative(canonical(root), canonical(value)); return !relative.startsWith('..'+path.sep) && relative !== '..' && !path.isAbsolute(relative); };
  for (const key of ['OCV_STORE_DIR', 'OCV_VIRTUAL_STORE_DIR', 'npm_config_cache', 'TEMP', 'TMP']) {
    const value = process.env[key];
    if (!value || !within(value)) throw new Error(`${key} must be inside the configured dependency root. Use ocv.ps1 to initialize its cache paths.`);
  }
}
