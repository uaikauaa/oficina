import net from 'node:net';
import tls from 'node:tls';
import { once } from 'node:events';

async function reply(socket, expected) {
  let buffer = '';
  return new Promise((resolve, reject) => {
    const cleanup = () => { socket.off('data', data); socket.off('error', error); socket.off('close', closed); };
    const error = () => { cleanup(); reject(new Error('SMTP transport failed')); };
    const closed = () => { cleanup(); reject(new Error('SMTP connection closed')); };
    const data = bytes => {
      buffer += bytes.toString();
      if (buffer.length > 16384) { error(); return; }
      const lines = buffer.trimEnd().split('\r\n');
      if (/^\d{3} /.test(lines.at(-1)) && buffer.endsWith('\r\n')) {
        cleanup();
        if (!lines.at(-1).startsWith(expected + ' ')) reject(new Error('SMTP response rejected'));
        else resolve(buffer);
      }
    };
    socket.on('data', data); socket.once('error', error); socket.once('close', closed);
  });
}
export async function checkSmtp({ host, port = 587, username, password, ca }) {
  let socket = net.connect({ host, port });
  socket.setTimeout(10000, () => socket.destroy(new Error('SMTP timeout')));
  try {
    await reply(socket, 220);
    socket.write('EHLO security-test.invalid\r\n');
    const greeting = await reply(socket, 250);
    if (!greeting.includes('STARTTLS')) throw new Error('Mandatory STARTTLS unavailable');
    socket.write('STARTTLS\r\n'); await reply(socket, 220);
    socket = tls.connect({ socket, servername: host, rejectUnauthorized: true, ca, minVersion: 'TLSv1.2' });
    socket.setTimeout(10000, () => socket.destroy(new Error('SMTP timeout')));
    await once(socket, 'secureConnect');
    socket.write('EHLO security-test.invalid\r\n'); await reply(socket, 250);
    const credentials = Buffer.from('\0' + username + '\0' + password).toString('base64');
    socket.write('AUTH PLAIN ' + credentials + '\r\n'); await reply(socket, 235);
    socket.write('QUIT\r\n'); await reply(socket, 221);
    return { starttls: true, certificateVerified: true, authenticated: true, emailSent: false };
  } finally { socket.destroy(); }
}
