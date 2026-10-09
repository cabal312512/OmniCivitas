import './guard-paths.mjs';
import { access, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import net from 'node:net';
import { resolveRuntimePaths, packageManagerCommand } from './runtime-paths.mjs';

const { projectRoot, config } = resolveRuntimePaths();
const mode = process.argv[2] || 'serve';
if (!['serve', 'dev'].includes(mode)) throw new Error('Use dev or serve.');
for (const [name, key] of Object.entries({ web: 'OCV_WEB_PORT', portal: 'OCV_PORTAL_PORT', next: 'OCV_NEXT_PORT', gateway: 'OCV_GATEWAY_PORT' })) {
  if (!process.env[key] && config.ports?.[name]) process.env[key] = String(config.ports[name]);
}
if (mode === 'dev') {
  // Keep the existing development entry and its application-specific builds.
  await import('./dev-server.mjs');
} else {
  const ports = { web: Number(process.env.OCV_WEB_PORT || 8080), next: Number(process.env.OCV_NEXT_PORT || 3200), gateway: Number(process.env.OCV_GATEWAY_PORT || 3000) };
  for (const port of Object.values(ports)) if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Configured ports must be integers between 1 and 65535.');
  if (new Set(Object.values(ports)).size !== Object.values(ports).length) throw new Error('The web, gateway and Next ports must be different.');
  const webRoot = path.join(projectRoot, 'config/apps/portal/dist');
  const gatewayFile = path.join(projectRoot, 'services/gateway/dist/main.js');
  try {
    await access(gatewayFile);
    await access(path.join(webRoot, 'index.html'));
    await access(path.join(projectRoot, 'config/apps/web2/.next/BUILD_ID'));
  } catch { throw new Error('Built application output is missing. Run pnpm build before civilization:serve.'); }
  for (const port of Object.values(ports)) await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port ${port} is occupied. This launcher does not stop unrelated processes.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
  const children = [], sockets = new Set();
  let stopping = false;
  const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.avif': 'image/avif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.csv': 'text/csv; charset=utf-8', '.zip': 'application/zip', '.pdf': 'application/pdf' };
  const route = url => /^\/(borrowed|studio|_next|next-api)(\/|\?|$)/.test(url) ? ports.next : /^\/(api|health)\//.test(url) ? ports.gateway : null;
  function stop(code = 0) {
    if (stopping) return; stopping = true;
    server.close();
    for (const socket of sockets) socket.destroy();
    for (const child of children) if (child.exitCode === null && child.pid) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      else { try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill(); } }
    }
    process.exitCode = code;
  }
  function start(name, command, args, extra = {}, shell = false) {
    const child = spawn(command, args, { cwd: projectRoot, env: { ...process.env, ...extra }, stdio: 'inherit', windowsHide: true, detached: process.platform !== 'win32', shell });
    children.push(child);
    child.once('error', error => { console.error(name + ': ' + error.message); stop(1); });
    child.once('exit', code => { if (!stopping) { console.error(name + ' stopped (' + code + ').'); stop(1); } });
  }
  const server = http.createServer(async (req, res) => {
    const target = route(req.url || '/');
    if (target) {
      const timeout = /^\/api\/q8\/events\//.test(req.url || '') ? 70000 : 10000;
      const upstream = http.request({ hostname: '127.0.0.1', port: target, method: req.method, path: req.url, headers: req.headers, timeout }, reply => { res.writeHead(reply.statusCode || 502, reply.headers); reply.pipe(res); });
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('窗口还没开；稍后重试。'); });
      upstream.on('timeout', () => upstream.destroy());
      req.pipe(upstream); res.on('close', () => upstream.destroy()); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
    try {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
      catch { res.writeHead(400); res.end(); return; }
      if (pathname.includes('\\') || pathname.includes('\0')) { res.writeHead(400); res.end(); return; }
      let file = path.resolve(webRoot, '.' + pathname);
      const relative = path.relative(webRoot, file);
      if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) { res.writeHead(403); res.end(); return; }
      let info = await stat(file);
      if (info.isDirectory()) { file = path.join(file, 'index.html'); info = await stat(file); }
      if (!info.isFile()) { res.writeHead(404); res.end(); return; }
      const headers = { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
      let startByte = 0, endByte = info.size - 1, status = 200;
      if (req.headers.range) {
        const match = String(req.headers.range).match(/^bytes=(\d*)-(\d*)$/);
        if (!match || (!match[1] && !match[2]) || info.size === 0) { res.writeHead(416, { 'Content-Range': 'bytes */' + info.size }); res.end(); return; }
        if (!match[1]) startByte = Math.max(0, info.size - Number(match[2]));
        else { startByte = Number(match[1]); if (match[2]) endByte = Math.min(endByte, Number(match[2])); }
        if (!Number.isSafeInteger(startByte) || !Number.isSafeInteger(endByte) || startByte < 0 || startByte > endByte || startByte >= info.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + info.size }); res.end(); return; }
        status = 206; headers['Content-Range'] = `bytes ${startByte}-${endByte}/${info.size}`;
      }
      headers['Content-Length'] = info.size === 0 ? 0 : endByte - startByte + 1;
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || info.size === 0) res.end();
      else { const stream = createReadStream(file, { start: startByte, end: endByte }); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res); }
    } catch (error) { if (!res.headersSent) res.writeHead(error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : 500); res.end(); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  server.on('upgrade', (req, client, head) => {
    const target = route(req.url || '/');
    if (!target) { client.destroy(); return; }
    const upstream = http.request({ hostname: '127.0.0.1', port: target, path: req.url, headers: req.headers, timeout: 10000 });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    upstream.on('response', reply => { reply.resume(); client.destroy(); });
    upstream.on('upgrade', (reply, socket, extra) => {
      client.write('HTTP/1.1 101 Switching Protocols\r\n' + Object.entries(reply.headers).map(([key, value]) => key + ': ' + value).join('\r\n') + '\r\n\r\n');
      socket.write(head); client.write(extra); sockets.add(socket);
      client.pipe(socket).pipe(client);
      client.once('close', () => { socket.destroy(); sockets.delete(socket); });
      socket.on('error', () => client.destroy());
    });
    upstream.end();
  });
  server.on('error', error => { console.error(error.message); stop(1); });
  start('gateway', process.execPath, [gatewayFile], { HOST: '127.0.0.1', PORT: String(ports.gateway), DATABASE_URL: '', REDIS_URL: '', OCV_REQUIRE_INFRASTRUCTURE: 'false', OCV_PROFILE: 'local-core', NODE_OPTIONS: '--max-old-space-size=512' });
  const manager = packageManagerCommand(['--filter', '@omnicivitas/web2', 'exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', String(ports.next)]);
  start('next', manager.command, manager.args, { OCV_GATEWAY_URL: 'http://127.0.0.1:' + ports.gateway, NODE_OPTIONS: '--max-old-space-size=512' }, manager.shell);
  server.listen(ports.web, '127.0.0.1', () => console.log(`OmniCivitas serve: http://127.0.0.1:${ports.web} ; built Astro + Next + NestJS. The core save is a bounded-memory demo; Docker core is the persistent deployment.`));
  process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
}

