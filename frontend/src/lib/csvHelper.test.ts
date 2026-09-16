import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escaparCampoCsv,
  gerarCsv,
} from './csvHelper.ts';
import type { ColunaCsv } from './csvHelper.ts';

describe('FEATURE-004: CSV Helper — Testes Unitários', () => {
  describe('escaparCampoCsv', () => {
    it('deve retornar string vazia para valores nulos ou indefinidos', () => {
      assert.equal(escaparCampoCsv(null), '');
      assert.equal(escaparCampoCsv(undefined), '');
    });

    it('deve preservar texto simples sem caracteres especiais', () => {
      assert.equal(escaparCampoCsv('Ordem de Servico'), 'Ordem de Servico');
      assert.equal(escaparCampoCsv(12345), '12345');
    });

    it('deve escapar ponto e vírgula envolvendo o valor entre aspas', () => {
      const res = escaparCampoCsv('Solda MIG; Eletrodo');
      assert.equal(res, '"Solda MIG; Eletrodo"');
    });

    it('deve escapar aspas duplas duplicando-as e envolvendo entre aspas', () => {
      const res = escaparCampoCsv('Equipamento "ESAB" 450A');
      assert.equal(res, '"Equipamento ""ESAB"" 450A"');
    });

    it('deve escapar quebras de linha envolvendo o valor entre aspas', () => {
      const res = escaparCampoCsv('Linha 1\nLinha 2');
      assert.equal(res, '"Linha 1\nLinha 2"');
    });

    it('deve preservar acentuação corretamente (UTF-8)', () => {
      const res = escaparCampoCsv('Manutenção em Gerador à Gasolina — Peça de Reposição');
      assert.equal(res, 'Manutenção em Gerador à Gasolina — Peça de Reposição');
    });
  });

  describe('gerarCsv', () => {
    interface ExemploItem {
      id: number;
      nome: string;
      descricao: string;
      valor: number;
      data: string;
      ativo: boolean;
      observacao?: string | null;
    }

    const colunas: ColunaCsv<ExemploItem>[] = [
      { cabecalho: 'ID', acessar: (i) => i.id },
      { cabecalho: 'Nome do Cliente / Equipamento', acessar: (i) => i.nome },
      { cabecalho: 'Descrição Técnica', acessar: (i) => i.descricao },
      { cabecalho: 'Valor (R$)', acessar: (i) => i.valor.toFixed(2).replace('.', ',') },
      { cabecalho: 'Data de Abertura', acessar: (i) => i.data },
      { cabecalho: 'Status Ativo', acessar: (i) => (i.ativo ? 'Sim' : 'Não') },
      { cabecalho: 'Observações', acessar: (i) => i.observacao },
    ];

    const dados: ExemploItem[] = [
      {
        id: 1,
        nome: 'João Construtora & Serviços',
        descricao: 'Solda "Smashweld"; 450A',
        valor: 1540.5,
        data: '16/09/2026',
        ativo: true,
        observacao: null,
      },
      {
        id: 2,
        nome: 'Auto Mecânica São José',
        descricao: 'Gerador Toyama\n5.5 kVA Diesel',
        valor: 350.0,
        data: '10/09/2026',
        ativo: false,
        observacao: 'Aguardando retirada',
      },
    ];

    it('deve iniciar com o BOM UTF-8 (\\uFEFF) para leitura nativa sem corromper acentos no Excel', () => {
      const csv = gerarCsv(colunas, dados);
      assert.ok(csv.startsWith('\uFEFF'));
    });

    it('deve usar ponto e vírgula como delimitador principal', () => {
      const csv = gerarCsv(colunas, dados);
      const linhas = csv.replace('\uFEFF', '').split('\r\n');
      const cabecalho = linhas[0];
      assert.ok(cabecalho.includes('ID;Nome do Cliente / Equipamento;Descrição Técnica;Valor (R$);Data de Abertura;Status Ativo;Observações'));
    });

    it('deve usar quebra de linha consistente \\r\\n', () => {
      const csv = gerarCsv(colunas, dados);
      assert.ok(csv.includes('\r\n'));
      assert.ok(!csv.includes('\n\n'));
    });

    it('deve formatar valores monetários, datas e campos vazios corretamente', () => {
      const csv = gerarCsv(colunas, dados);
      assert.ok(csv.includes('1540,50'));
      assert.ok(csv.includes('16/09/2026'));
      // O item 1 tem observacao null, então termina com ponto e vírgula antes do fim da linha
      assert.ok(csv.includes('Sim;'));
    });

    it('deve suportar lista vazia contendo apenas cabeçalho com BOM', () => {
      const csvVazio = gerarCsv(colunas, []);
      assert.ok(csvVazio.startsWith('\uFEFF'));
      const linhas = csvVazio.replace('\uFEFF', '').trim().split('\r\n');
      assert.equal(linhas.length, 1);
    });
  });
});
