import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContentSecurityPolicy,
  getSecurityHeaders,
} from './securityHeaders.ts';

describe('SEC-002: Security Headers & CSP (PSQ-SaaS-001)', () => {
  describe('buildContentSecurityPolicy', () => {
    it('deve conter default-src restrito a self em prod e dev', () => {
      assert.ok(buildContentSecurityPolicy(true).includes("default-src 'self'"));
      assert.ok(buildContentSecurityPolicy(false).includes("default-src 'self'"));
    });

    it('PRODUÇÃO: deve permitir script-src self e unsafe-inline SEM unsafe-eval', () => {
      const csp = buildContentSecurityPolicy(true);
      assert.ok(csp.includes("script-src 'self' 'unsafe-inline'"));
      assert.strictEqual(csp.includes("'unsafe-eval'"), false, 'Produção NUNCA deve conter unsafe-eval');
    });

    it('DESENVOLVIMENTO: deve permitir unsafe-eval em script-src para Turbopack e HMR', () => {
      const csp = buildContentSecurityPolicy(false);
      assert.ok(csp.includes("script-src 'self' 'unsafe-inline' 'unsafe-eval'"));
      assert.ok(csp.includes("'unsafe-eval'"));
    });

    it('PRODUÇÃO: deve restringir connect-src estritamente a self', () => {
      const csp = buildContentSecurityPolicy(true);
      assert.ok(csp.includes("connect-src 'self'"));
      assert.strictEqual(csp.includes("ws:"), false, 'Produção não deve expor ws: aberto');
    });

    it('DESENVOLVIMENTO: deve permitir ws: e http: em connect-src para HMR local', () => {
      const csp = buildContentSecurityPolicy(false);
      assert.ok(csp.includes("connect-src 'self' ws: http:"));
    });

    it('deve permitir style-src self e unsafe-inline para Tailwind CSS', () => {
      assert.ok(buildContentSecurityPolicy(true).includes("style-src 'self' 'unsafe-inline'"));
      assert.ok(buildContentSecurityPolicy(false).includes("style-src 'self' 'unsafe-inline'"));
    });

    it('deve permitir img-src self, data: e blob:', () => {
      assert.ok(buildContentSecurityPolicy(true).includes("img-src 'self' data: blob:"));
      assert.ok(buildContentSecurityPolicy(false).includes("img-src 'self' data: blob:"));
    });

    it('deve restringir font-src a self', () => {
      assert.ok(buildContentSecurityPolicy(true).includes("font-src 'self'"));
      assert.ok(buildContentSecurityPolicy(false).includes("font-src 'self'"));
    });

    it('deve restringir frame-ancestors a none (anti-clickjacking CSP nível 2/3)', () => {
      assert.ok(buildContentSecurityPolicy(true).includes("frame-ancestors 'none'"));
      assert.ok(buildContentSecurityPolicy(false).includes("frame-ancestors 'none'"));
    });

    it('deve restringir base-uri e form-action a self', () => {
      const csp = buildContentSecurityPolicy(true);
      assert.ok(csp.includes("base-uri 'self'"));
      assert.ok(csp.includes("form-action 'self'"));
    });
  });

  describe('getSecurityHeaders', () => {
    it('deve incluir X-Content-Type-Options: nosniff', () => {
      const headers = getSecurityHeaders(false);
      const header = headers.find((h) => h.key === 'X-Content-Type-Options');
      assert.ok(header, 'X-Content-Type-Options deve existir');
      assert.strictEqual(header.value, 'nosniff');
    });

    it('deve incluir X-Frame-Options: DENY', () => {
      const headers = getSecurityHeaders(false);
      const header = headers.find((h) => h.key === 'X-Frame-Options');
      assert.ok(header, 'X-Frame-Options deve existir');
      assert.strictEqual(header.value, 'DENY');
    });

    it('deve incluir Referrer-Policy: strict-origin-when-cross-origin', () => {
      const headers = getSecurityHeaders(false);
      const header = headers.find((h) => h.key === 'Referrer-Policy');
      assert.ok(header, 'Referrer-Policy deve existir');
      assert.strictEqual(header.value, 'strict-origin-when-cross-origin');
    });

    it('deve incluir Permissions-Policy desativando APIs perigosas', () => {
      const headers = getSecurityHeaders(false);
      const header = headers.find((h) => h.key === 'Permissions-Policy');
      assert.ok(header, 'Permissions-Policy deve existir');
      assert.ok(header.value.includes('camera=()'));
      assert.ok(header.value.includes('microphone=()'));
      assert.ok(header.value.includes('geolocation=()'));
      assert.ok(header.value.includes('payment=()'));
      assert.ok(header.value.includes('usb=()'));
    });

    it('deve incluir Content-Security-Policy correspondente em dev e prod', () => {
      const headersDev = getSecurityHeaders(false);
      const headerDev = headersDev.find((h) => h.key === 'Content-Security-Policy');
      assert.ok(headerDev, 'Content-Security-Policy deve existir em dev');
      assert.strictEqual(headerDev.value, buildContentSecurityPolicy(false));

      const headersProd = getSecurityHeaders(true);
      const headerProd = headersProd.find((h) => h.key === 'Content-Security-Policy');
      assert.ok(headerProd, 'Content-Security-Policy deve existir em prod');
      assert.strictEqual(headerProd.value, buildContentSecurityPolicy(true));
    });

    it('NÃO deve incluir HSTS em ambiente não-produção para permitir testes locais', () => {
      const headers = getSecurityHeaders(false);
      const hsts = headers.find((h) => h.key === 'Strict-Transport-Security');
      assert.strictEqual(hsts, undefined);
    });

    it('DEVE incluir HSTS com max-age>=31536000 e includeSubDomains em produção', () => {
      const headers = getSecurityHeaders(true);
      const hsts = headers.find((h) => h.key === 'Strict-Transport-Security');
      assert.ok(hsts, 'HSTS deve estar presente em produção');
      assert.strictEqual(hsts.value, 'max-age=31536000; includeSubDomains');
    });

    it('deve retornar exatamente 5 headers em dev e 6 em prod', () => {
      assert.strictEqual(getSecurityHeaders(false).length, 5);
      assert.strictEqual(getSecurityHeaders(true).length, 6);
    });
  });
});
