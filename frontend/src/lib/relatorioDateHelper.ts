/**
 * Helper de manipulação e cálculo de datas para o Módulo de Relatórios (UX-008)
 * Fuso Horário Oficial: America/Sao_Paulo (UTC-3)
 * 
 * Regra Crítica:
 * Nunca enviar o sufixo rígido 'Z' (UTC) para filtros de início e fim de dia,
 * pois isso gera um deslocamento de 3 horas em relação ao horário de funcionamento da oficina.
 */

export type PresetPeriodo = 'hoje' | '7dias' | '30dias' | 'mesAtual' | 'customizado' | 'limpo';

export const FUSO_HORARIO_OFICIAL = 'America/Sao_Paulo';
export const OFFSET_PADRAO_SP = '-03:00';

/**
 * Formata um objeto Date para string YYYY-MM-DD no fuso de São Paulo.
 */
export function formatarDataLocalYmd(data: Date = new Date()): string {
  // Formata usando Intl com o fuso America/Sao_Paulo para garantir exatidão
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO_OFICIAL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data);

  const ano = partes.find((p) => p.type === 'year')?.value || '2026';
  const mes = partes.find((p) => p.type === 'month')?.value || '01';
  const dia = partes.find((p) => p.type === 'day')?.value || '01';

  return `${ano}-${mes}-${dia}`;
}

/**
 * Obtém a data de hoje no fuso horário da oficina (YYYY-MM-DD).
 */
export function obterHojeLocal(): string {
  return formatarDataLocalYmd(new Date());
}

/**
 * Converte uma data YYYY-MM-DD em string ISO-8601 de início do dia com o offset oficial de São Paulo.
 * Exemplo: '2026-09-17' -> '2026-09-17T00:00:00-03:00'
 */
export function formatarDataInicioParaApi(dataYmd: string): string {
  if (!dataYmd || !dataYmd.trim()) return '';
  return `${dataYmd.trim()}T00:00:00${OFFSET_PADRAO_SP}`;
}

/**
 * Converte uma data YYYY-MM-DD em string ISO-8601 de fim do dia com o offset oficial de São Paulo.
 * Exemplo: '2026-09-17' -> '2026-09-17T23:59:59-03:00'
 */
export function formatarDataFimParaApi(dataYmd: string): string {
  if (!dataYmd || !dataYmd.trim()) return '';
  return `${dataYmd.trim()}T23:59:59${OFFSET_PADRAO_SP}`;
}

/**
 * Calcula os limites (dataInicio e dataFim em formato YYYY-MM-DD) para os presets rápidos de período.
 * 
 * Regras adotadas:
 * - 'hoje': dataInicio = hoje, dataFim = hoje
 * - '7dias': 7 dias corridos (do dia D-6 até hoje)
 * - '30dias': 30 dias corridos (do dia D-29 até hoje)
 * - 'mesAtual': do dia 01 do mês corrente até a data de hoje
 */
export function calcularIntervaloPreset(
  preset: PresetPeriodo,
  dataReferencia: Date = new Date()
): { dataInicio: string; dataFim: string } {
  const hojeYmd = formatarDataLocalYmd(dataReferencia);
  const [anoStr, mesStr, diaStr] = hojeYmd.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10) - 1; // 0-indexed
  const dia = parseInt(diaStr, 10);

  switch (preset) {
    case 'hoje':
      return { dataInicio: hojeYmd, dataFim: hojeYmd };

    case '7dias': {
      // 7 dias corridos: hoje menos 6 dias
      const d7 = new Date(Date.UTC(ano, mes, dia - 6, 12, 0, 0));
      return {
        dataInicio: formatarDataLocalYmd(d7),
        dataFim: hojeYmd,
      };
    }

    case '30dias': {
      // 30 dias corridos: hoje menos 29 dias
      const d30 = new Date(Date.UTC(ano, mes, dia - 29, 12, 0, 0));
      return {
        dataInicio: formatarDataLocalYmd(d30),
        dataFim: hojeYmd,
      };
    }

    case 'mesAtual': {
      // Primeiro dia do mês corrente até hoje
      const primeiroDia = `${anoStr}-${mesStr}-01`;
      return {
        dataInicio: primeiroDia,
        dataFim: hojeYmd,
      };
    }

    case 'limpo':
    case 'customizado':
    default:
      return { dataInicio: '', dataFim: '' };
  }
}

/**
 * Identifica qual preset está atualmente ativo com base nas datas selecionadas.
 */
export function identificarPresetAtivo(
  dataInicio: string,
  dataFim: string,
  dataReferencia: Date = new Date()
): PresetPeriodo {
  if (!dataInicio && !dataFim) return 'limpo';

  const hoje = calcularIntervaloPreset('hoje', dataReferencia);
  if (dataInicio === hoje.dataInicio && dataFim === hoje.dataFim) return 'hoje';

  const d7 = calcularIntervaloPreset('7dias', dataReferencia);
  if (dataInicio === d7.dataInicio && dataFim === d7.dataFim) return '7dias';

  const d30 = calcularIntervaloPreset('30dias', dataReferencia);
  if (dataInicio === d30.dataInicio && dataFim === d30.dataFim) return '30dias';

  const mes = calcularIntervaloPreset('mesAtual', dataReferencia);
  if (dataInicio === mes.dataInicio && dataFim === mes.dataFim) return 'mesAtual';

  return 'customizado';
}

/**
 * Obtém a data e hora atual formatada para input type="datetime-local" (YYYY-MM-DDTHH:mm)
 * estritamente no fuso horário oficial America/Sao_Paulo (ISSUE-02).
 */
export function obterAgoraLocalDatetimeInput(data: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_HORARIO_OFICIAL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(data);

  const ano = partes.find((p) => p.type === 'year')?.value || '2026';
  const mes = partes.find((p) => p.type === 'month')?.value || '01';
  const dia = partes.find((p) => p.type === 'day')?.value || '01';
  let hora = partes.find((p) => p.type === 'hour')?.value || '00';
  if (hora === '24') hora = '00';
  const minuto = partes.find((p) => p.type === 'minute')?.value || '00';

  return `${ano}-${mes}-${dia}T${hora}:${minuto}`;
}

/**
 * Converte o valor do input datetime-local para string ISO com offset oficial de São Paulo (-03:00).
 * Exemplo: '2026-09-17T21:30' -> '2026-09-17T21:30:00-03:00'
 */
export function converterDatetimeLocalParaIsoComOffset(datetimeLocal?: string | null): string | undefined {
  if (!datetimeLocal || !datetimeLocal.trim()) return undefined;
  const trimmed = datetimeLocal.trim();

  // Se já contém offset ou sufixo
  if (trimmed.includes('-03:00') || trimmed.endsWith('Z')) {
    return trimmed;
  }

  // Formato YYYY-MM-DDTHH:mm (16 caracteres)
  if (trimmed.length === 16) {
    return `${trimmed}:00${OFFSET_PADRAO_SP}`;
  }

  // Formato YYYY-MM-DDTHH:mm:ss (19 caracteres)
  if (trimmed.length === 19) {
    return `${trimmed}${OFFSET_PADRAO_SP}`;
  }

  return `${trimmed}${OFFSET_PADRAO_SP}`;
}

