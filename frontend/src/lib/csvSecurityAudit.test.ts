import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escaparCampoCsv, gerarCsv } from './csvHelper.ts';

test('spreadsheet formulas from untrusted text must be neutralized', () => {
  assert.equal(escaparCampoCsv('=1+1'), '"\t=1+1"');
});

test('formula prefixes and invisible leading characters cannot bypass neutralization', () => {
  for (const value of ['+1+1', '-1+1', '@SUM(1)', ' =1+1', '\t=1+1', '\r\n=1+1', '\u200b=1+1', '＝1+1', '＠SUM(1)']) {
    assert.ok(escaparCampoCsv(value).startsWith('"\t'), JSON.stringify(value));
  }
});

test('legitimate numeric values, text and RFC escaping remain usable', () => {
  assert.equal(escaparCampoCsv(-12.5), '-12.5');
  assert.equal(escaparCampoCsv('-12,50'), '-12,50');
  assert.equal(escaparCampoCsv('Oficina; "A"'), '"Oficina; ""A"""');
  assert.equal(escaparCampoCsv('texto normal'), 'texto normal');
  const csv = gerarCsv([{ cabecalho: 'Nome', acessar: (row: { value: string }) => row.value }], [{ value: '=1+1' }]);
  assert.ok(csv.includes('\r\n"\t=1+1"\r\n'));
});
