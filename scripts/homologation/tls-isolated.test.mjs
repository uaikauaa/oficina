import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import net from 'node:net';
import { once } from 'node:events';
import { checkSmtp } from './smtp.mjs';

const directory = mkdtempSync(path.join(tmpdir(), 'oficina-tls-'));
let key, cert;
before(() => {
  const openssl = process.env.OPENSSL || (process.platform === 'win32' ? 'C:/Program Files/Git/usr/bin/openssl.exe' : 'openssl');
  execFileSync(openssl, ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=DNS:localhost', '-days', '1', '-keyout', path.join(directory, 'key.pem'), '-out', path.join(directory, 'cert.pem')],
  { stdio: 'ignore', windowsHide: true });
  key = readFileSync(path.join(directory, 'key.pem')); cert = readFileSync(path.join(directory, 'cert.pem'));
});
after(() => {
  const actual = realpathSync(directory);
  assert.equal(actual, path.resolve(directory));
  assert.ok(actual.startsWith(path.join(realpathSync(tmpdir()), 'oficina-tls-')));
  rmSync(actual, { recursive: true });
});

test('TLS accepts the trusted hostname and rejects unknown CA or mismatched hostname', async () => {
  const server = tls.createServer({ key, cert }, socket => socket.end());
  server.on('tlsClientError', () => {});
  server.listen(0, 'localhost'); await once(server, 'listening');
  const connect = async options => {
    const socket = tls.connect({ host: 'localhost', port: server.address().port, rejectUnauthorized: true, ...options });
    try { await once(socket, 'secureConnect'); assert.equal(socket.authorized, true); }
    finally { socket.destroy(); }
  };
  try {
    await connect({ ca: cert, servername: 'localhost' });
    await assert.rejects(connect({ ca: cert, servername: 'wrong-host.invalid' }), /Hostname|altnames|match/);
    await assert.rejects(connect({ servername: 'localhost' }), /self-signed|certificate/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('SMTP sends credentials only after authenticated TLS and rejects missing STARTTLS', async () => {
  let authenticatedInsideTls = false;
  let plaintextAuth = false;
  let supportTls = true;
  const context = tls.createSecureContext({ key, cert });
  const server = net.createServer(raw => {
    raw.write('220 synthetic SMTP\r\n');
    const plain = data => {
      const command = data.toString();
      if (command.startsWith('AUTH')) { plaintextAuth = true; raw.end('530 TLS required\r\n'); }
      else if (command.startsWith('EHLO')) raw.write(supportTls ? '250-localhost\r\n250 STARTTLS\r\n' : '250 localhost\r\n');
      else if (command.startsWith('STARTTLS')) {
        raw.off('data', plain); raw.write('220 Upgrade now\r\n');
        const socket = new tls.TLSSocket(raw, { isServer: true, secureContext: context });
        socket.on('error', () => socket.destroy());
        socket.on('data', bytes => {
          if (bytes.toString().startsWith('EHLO')) socket.write('250 AUTH PLAIN\r\n');
          else if (bytes.toString().startsWith('AUTH PLAIN ')) { authenticatedInsideTls = true; socket.write('235 Authenticated\r\n'); }
          else if (bytes.toString().startsWith('QUIT')) socket.end('221 Bye\r\n');
        });
      }
    };
    raw.on('data', plain); raw.on('error', () => raw.destroy());
  });
  server.listen(0, 'localhost'); await once(server, 'listening');
  try {
    const result = await checkSmtp({ host: 'localhost', port: server.address().port, username: 'synthetic', password: 'synthetic-only', ca: cert });
    assert.equal(result.certificateVerified, true); assert.equal(result.emailSent, false);
    assert.equal(authenticatedInsideTls, true); assert.equal(plaintextAuth, false);
    supportTls = false;
    await assert.rejects(checkSmtp({ host: 'localhost', port: server.address().port, username: 'synthetic', password: 'synthetic-only', ca: cert }), /STARTTLS/);
    assert.equal(plaintextAuth, false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
