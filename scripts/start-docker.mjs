import { existsSync } from 'node:fs';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveRuntimePaths, resolveRuntimeTool } from './runtime-paths.mjs';

export function dockerDesktopLaunchPlan({ platform = process.platform, environment = process.env, repository } = {}) {
  const options = { environment, ...(repository ? { repository } : {}) };
  const { config, projectRoot } = resolveRuntimePaths(options);
  const explicit = resolveRuntimeTool('dockerDesktop', options);
  let command, args = [];
  if (platform === 'win32') {
    command = explicit || path.join(environment.ProgramFiles || environment.PROGRAMFILES || '', 'Docker', 'Docker', 'Docker Desktop.exe');
    if (!existsSync(command)) throw new Error('Docker Desktop was not found. Install it normally or set tools.dockerDesktop in config/runtime.local.json.');
  } else if (platform === 'darwin') {
    command = 'open'; args = ['-a', explicit || 'Docker'];
  } else {
    throw new Error('Docker Desktop is not required on this platform. Start your installed Docker Engine using its normal service manager, then retry civilization:core.');
  }
  const desktopHome = config.dockerDesktopHome ? path.resolve(projectRoot, config.dockerDesktopHome) : null;
  const overrides = desktopHome ? {
    USERPROFILE: desktopHome,
    APPDATA: path.join(desktopHome, 'appdata/Roaming'),
    LOCALAPPDATA: path.join(desktopHome, 'appdata/Local'),
    PINATA_USER_DATA_DIR_OVERRIDE: path.join(desktopHome, 'electron')
  } : {};
  if (desktopHome && platform === 'win32') args.push('--user-data-dir=' + overrides.PINATA_USER_DATA_DIR_OVERRIDE);
  return { command, args, overrides, desktopHome };
}

async function main() {
  if (process.argv.includes('--check')) {
    const plan = dockerDesktopLaunchPlan();
    console.log(JSON.stringify({ command: plan.command, args: plan.args, customProfile: Boolean(plan.desktopHome), dryRun: true }));
    return;
  }
  const { dockerCall } = await import('./docker-child.mjs');
  try {
    const check = dockerCall(['info', '--format', '{{.OSType}}'], { allowFailure: true });
    if (check.status === 0) { console.log('Docker Engine is already available. No extra instance was started.'); return; }
  } catch {}
  const plan = dockerDesktopLaunchPlan();
  if (plan.desktopHome) {
    for (const directory of [plan.desktopHome, plan.overrides.APPDATA, plan.overrides.LOCALAPPDATA, plan.overrides.PINATA_USER_DATA_DIR_OVERRIDE]) await mkdir(directory, { recursive: true });
    const source = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, '.wslconfig') : null;
    if (source && existsSync(source) && path.resolve(source) !== path.resolve(plan.desktopHome, '.wslconfig')) await copyFile(source, path.join(plan.desktopHome, '.wslconfig'));
  }
  const child = spawn(plan.command, plan.args, { env: { ...process.env, ...plan.overrides }, detached: true, windowsHide: true, stdio: 'ignore' });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
  console.log('Docker Desktop was requested. Wait for its engine to become ready, then run civilization:core. This command does not install software or change WSL settings.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
