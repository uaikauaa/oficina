import assert from 'node:assert/strict';
import { checkSmtp } from './smtp.mjs';
assert.equal(process.env.HML_SMTP_ISOLATED, 'true');
const host = process.env.HML_SMTP_HOST || '';
assert.ok(host.includes('sandbox') || host.endsWith('.test'), 'A sandbox SMTP host is required');
assert.ok(process.env.HML_SMTP_USERNAME && process.env.HML_SMTP_PASSWORD, 'Synthetic sandbox account required');
try {
  const result = await checkSmtp({ host, port: Number(process.env.HML_SMTP_PORT || 587),
    username: process.env.HML_SMTP_USERNAME, password: process.env.HML_SMTP_PASSWORD });
  console.log(JSON.stringify(result));
} catch { console.error('FAIL: isolated SMTP TLS/authentication. Credentials and response bodies omitted.'); process.exitCode = 1; }
