import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatarDataLocalYmd,
  obterHojeLocal,
  formatarDataInicioParaApi,
  formatarDataFimParaApi,
  calcularIntervaloPreset,
  identificarPresetAtivo,
  OFFSET_PADRAO_SP,
} from './relatorioDateHelper.ts';

describe('UX-008: Relatório Date Helper — Testes Unitários de Presets e Fuso Horário', () => {
  describe('formatarDataLocalYmd e obterHojeLocal', () => {
    it('deve formatar data específica no padrão YYYY-MM-DD', () => {
      // 17 de Setembro de 2026 às 15:00 UTC (12:00 em São Paulo)
      const data = new Date('2026-09-17T15:00:00Z');
      const formatado = formatarDataLocalYmd(data);
      assert.equal(formatado, '2026-09-17');
    });

    it('deve respeitar a virada de dia no fuso de São Paulo (23h local vs 02h UTC do dia seguinte)', () => {
      // 17/09/2026 às 23:30 em SP = 18/09/2026 às 02:30 UTC
      const dataNoite = new Date('2026-09-18T02:30:00Z');
      assert.equal(formatarDataLocalYmd(dataNoite), '2026-09-17');
    });

    it('obterHojeLocal deve retornar uma string YYYY-MM-DD válida', () => {
      const hoje = obterHojeLocal();
      assert.match(hoje, /^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatarDataInicioParaApi e formatarDataFimParaApi', () => {
    it('deve anexar o offset -03:00 em vez do sufixo rígido Z para início de dia', () => {
      const apiInicio = formatarDataInicioParaApi('2026-09-17');
      assert.equal(apiInicio, `2026-09-17T00:00:00${OFFSET_PADRAO_SP}`);
      assert.ok(!apiInicio.endsWith('Z'), 'Não deve terminar com Z');
    });

    it('deve anexar o offset -03:00 em vez do sufixo rígido Z para fim de dia', () => {
      const apiFim = formatarDataFimParaApi('2026-09-17');
      assert.equal(apiFim, `2026-09-17T23:59:59${OFFSET_PADRAO_SP}`);
      assert.ok(!apiFim.endsWith('Z'), 'Não deve terminar com Z');
    });

    it('deve retornar string vazia quando entrada for vazia ou nula', () => {
      assert.equal(formatarDataInicioParaApi(''), '');
      assert.equal(formatarDataInicioParaApi('   '), '');
      assert.equal(formatarDataFimParaApi(''), '');
    });
  });

  describe('calcularIntervaloPreset', () => {
    // Data de referência fixada: 17/09/2026 às 12:00 BRT
    const dataRef = new Date('2026-09-17T15:00:00Z');

    it('preset hoje deve retornar a mesma data em início e fim', () => {
      const res = calcularIntervaloPreset('hoje', dataRef);
      assert.equal(res.dataInicio, '2026-09-17');
      assert.equal(res.dataFim, '2026-09-17');
    });

    it('preset 7dias deve retornar 7 dias corridos (D-6 até hoje)', () => {
      const res = calcularIntervaloPreset('7dias', dataRef);
      assert.equal(res.dataInicio, '2026-09-11');
      assert.equal(res.dataFim, '2026-09-17');
    });

    it('preset 30dias deve retornar 30 dias corridos (D-29 até hoje)', () => {
      const res = calcularIntervaloPreset('30dias', dataRef);
      assert.equal(res.dataInicio, '2026-08-19');
      assert.equal(res.dataFim, '2026-09-17');
    });

    it('preset mesAtual deve retornar do dia 01 do mês corrente até hoje', () => {
      const res = calcularIntervaloPreset('mesAtual', dataRef);
      assert.equal(res.dataInicio, '2026-09-01');
      assert.equal(res.dataFim, '2026-09-17');
    });

    it('preset limpo deve retornar strings vazias', () => {
      const res = calcularIntervaloPreset('limpo', dataRef);
      assert.equal(res.dataInicio, '');
      assert.equal(res.dataFim, '');
    });
  });

  describe('identificarPresetAtivo', () => {
    const dataRef = new Date('2026-09-17T15:00:00Z');

    it('deve identificar "hoje" quando ambas as datas forem iguais a hoje', () => {
      assert.equal(identificarPresetAtivo('2026-09-17', '2026-09-17', dataRef), 'hoje');
    });

    it('deve identificar "7dias"', () => {
      assert.equal(identificarPresetAtivo('2026-09-11', '2026-09-17', dataRef), '7dias');
    });

    it('deve identificar "30dias"', () => {
      assert.equal(identificarPresetAtivo('2026-08-19', '2026-09-17', dataRef), '30dias');
    });

    it('deve identificar "mesAtual"', () => {
      assert.equal(identificarPresetAtivo('2026-09-01', '2026-09-17', dataRef), 'mesAtual');
    });

    it('deve retornar "customizado" quando for um intervalo qualquer', () => {
      assert.equal(identificarPresetAtivo('2026-05-10', '2026-05-20', dataRef), 'customizado');
    });

    it('deve retornar "limpo" quando ambos forem vazios', () => {
      assert.equal(identificarPresetAtivo('', '', dataRef), 'limpo');
    });
  });
});
