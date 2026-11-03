import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { once } from 'node:events';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = [];
const start = (file, env = {}) => {
  const child = spawn(process.execPath, [file], { cwd: root, env: { ...process.env, ...env }, stdio: 'ignore', windowsHide: true });
  children.push(child); return child;
};
try {
  start('scripts/audit-proxy-fixture.mjs');
  start('frontend/.next/standalone/server.js', { PORT: '13002', HOSTNAME: '127.0.0.1', INTERNAL_BACKEND_URL: 'http://127.0.0.1:8080' });
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { ready = (await fetch('http://127.0.0.1:13002/api/echo')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('Isolated proxy did not start');
  await import('./audit-proxy-transport.mjs');
  await (await import('./audit-http-parser.mjs')).checkLocalHttpParser();
} finally {
  await Promise.all(children.map(async child => {
    if (child.exitCode !== null) return;
    const done = once(child, 'exit'); child.kill(); await done;
  }));
}
