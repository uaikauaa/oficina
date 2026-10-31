import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:13002';
for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
  const response = await fetch(`${base}/api/echo`, { method, headers: {
    'X-XSRF-TOKEN': 'synthetic-csrf', Cookie: 'audit_a=synthetic', 'Content-Type': 'application/json',
  }, ...(['GET', 'HEAD'].includes(method) ? {} : { body: '{"synthetic":true}' }) });
  const body = await response.json();
  assert.equal(body.method, method); assert.equal(body.csrfPreserved, true); assert.equal(body.cookiePreserved, true);
}
for (const code of [401, 403, 404, 429, 500]) {
  const response = await fetch(`${base}/api/status/${code}`, { method: 'POST' });
  assert.equal(response.status, code); assert.equal((await response.json()).method, 'POST');
  assert.equal(response.headers.get('retry-after'), '60');
}
const cookies = await fetch(`${base}/api/cookies`);
assert.equal(cookies.headers.getSetCookie().length, 2);
assert.ok(cookies.headers.getSetCookie().every(cookie => cookie.includes('HttpOnly')));
const response = await fetch(`${base}/api/pdf`);
assert.equal(response.headers.get('content-type'), 'application/pdf');
assert.equal(Buffer.from(await response.arrayBuffer()).toString(), '%PDF-1.4\n% synthetic transport fixture\n%%EOF\n');
console.log('PASS: 5 methods, CSRF/cookie headers, 5 error statuses, 2 Set-Cookie headers, exact PDF bytes.');
