import net from 'node:net';
import assert from 'node:assert/strict';

/** Two bounded parser probes against the task-owned local Next server. No pipelining or external targets. */
export async function checkLocalHttpParser(port = 13002) {
  for (const headers of ['Content-Length: 5\r\nTransfer-Encoding: chunked', 'Content-Length: 5\r\nContent-Length: 6']) {
    const status = await new Promise((resolve, reject) => {
      const socket = net.connect({ host: '127.0.0.1', port });
      let response = '';
      socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('Local parser probe timed out')); });
      socket.once('error', reject);
      socket.on('data', bytes => {
        response += bytes.toString();
        const match = /^HTTP\/1\.[01] (\d+)/.exec(response);
        if (match) { socket.destroy(); resolve(Number(match[1])); }
      });
      socket.once('connect', () => socket.write('POST /api/echo HTTP/1.1\r\nHost: localhost\r\n' + headers + '\r\nConnection: close\r\n\r\n0\r\n\r\n'));
    });
    assert.equal(status, 400, 'Ambiguous framing must not reach the local proxy handler');
  }
  console.log('PASS: local Next HTTP/1 parser rejects CL+TE and conflicting Content-Length. Google ingress remains unverified.');
}
