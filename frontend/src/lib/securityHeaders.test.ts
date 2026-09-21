import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContentSecurityPolicy,
  getSecurityHeaders,
} from './securityHeaders.ts';

describe('SEC-002: Security Headers & CSP (PSQ-SaaS-001)', () => {
  describe('buildContentSecurityPolicy', () => {
    it('deve conter default-src restrito a self', () => {
      const csp = buildContentSecurityPolicy();
      assert.ok(csp.includes("default-src 'self'"));
    });

    it('deve permitir script-src self e unsafe-inline para hidratação Next.js', () => {
      const csp = buildContentSecurityPolicy();
      assert.ok(csp.includes("script-src 'self' 'unsafe-inline'"));
    });

    it('deve permitir style-src self e unsafe-inline para Tailwind CSS', () => {
      const csp = buildContentSecurityPolicy();
      assert.ok(csp.includes("style-src 'self' 'unsafe-inline'"));
    });

    it('deve permitir img-src self, data: e blob:', () => {
      const csp = buildContentSecurityPolicy();
      assert.ok(csp.includes("img-src 'self' data: blob:"));
    });

    it('deve restringir font-src a self', () => {
      const csp = buildContentSecurityPolicy();
      assert.ok(csp.includes("font-src 'self'"));
    });

    it('deve restringir connect-src a self', () => {
      const csp = buildContentSecurityPolicy();
      assert.ok(csp.includes("connect-src 'self'"));
    });

    it('deve restringir frame-ancestors a none (anti-clickjacking CSP nível 2/3)', () => {
      const csp = buildContentSecurityPolicy();
      assert.ok(csp.includes("frame-ancestors 'none'"));
    });

    it('deve restringir base-uri e form-action a self', () => {
      const csp = buildContentSecurityPolicy();
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

    it('deve incluir Content-Security-Policy', () => {
      const headers = getSecurityHeaders(false);
      const header = headers.find((h) => h.key === 'Content-Security-Policy');
      assert.ok(header, 'Content-Security-Policy deve existir');
      assert.strictEqual(header.value, buildContentSecurityPolicy());
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
