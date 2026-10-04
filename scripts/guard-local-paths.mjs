import path from 'node:path';
const root = process.env.OCV_DEPS_ROOT;
if (process.env.OCV_LOCAL_STORAGE_GUARD === '1') {
  if (!root || (process.platform === 'win32' && path.resolve(root).toLowerCase() !== 'f:\\ocvdeps')) {
    throw new Error('Dependency environment is missing. On Windows use .\\ocv.ps1; no default C: installation is permitted.');
  }
  for (const key of ['OCV_STORE_DIR', 'OCV_VIRTUAL_STORE_DIR', 'npm_config_cache', 'TEMP', 'TMP']) {
    const value = process.env[key];
    if (!value || (process.platform === 'win32' && !path.resolve(value).toLowerCase().startsWith('f:\\ocvdeps\\'))) throw new Error(`${key} must be inside F:\\OCVdeps.`);
  }
}
