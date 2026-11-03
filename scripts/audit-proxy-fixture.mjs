// Local disposable upstream only. Never deployed with the application.
import http from 'node:http';
const pdf = Buffer.from('%PDF-1.4\n% synthetic transport fixture\n%%EOF\n');
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture.invalid');
  if (url.pathname === '/api/pdf') {
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' });
    return res.end(pdf);
  }
  if (url.pathname === '/api/cookies') {
    res.writeHead(200, { 'Set-Cookie': ['audit_a=synthetic; HttpOnly; Path=/; SameSite=Lax',
      'audit_b=synthetic; HttpOnly; Path=/api; SameSite=Strict'], 'Content-Type': 'application/json' });
    return res.end('{}');
  }
  if (url.pathname.startsWith('/api/status/')) {
    const status = Number(url.pathname.split('/').pop());
    if (![401, 403, 404, 429, 500].includes(status)) { res.writeHead(400); return res.end(); }
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '60' });
    return res.end(JSON.stringify({ status, error: 'SYNTHETIC', method: req.method }));
  }
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 4096) { res.writeHead(413); return res.end(); } }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ method: req.method, body, csrfPreserved: req.headers['x-xsrf-token'] === 'synthetic-csrf',
    cookiePreserved: req.headers.cookie === 'audit_a=synthetic' }));
}).listen(8080, '0.0.0.0');
