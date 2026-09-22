/**
 * Helper para geração de mensagens e links wa.me de Ordens de Serviço
 * Oficina Gestão
 *
 * Provê mensagens automáticas profissionais, humanizadas, contextualizadas
 * por status da OS, com saudação por horário (America/Sao_Paulo) e sanitização segura.
 */

import type { StatusOrdemServico } from './types.ts';
import { OFICINA } from './oficina.ts';

export interface WhatsAppResult {
  url: string | null;
  mensagem: string;
  erro?: string;
}

export interface WhatsAppRetiradaParams {
  telefone?: string | null;
  clienteNome?: string | null;
  equipamentoModelo?: string | null;
  equipamentoNumeroSerie?: string | null;
  numeroOs?: string | null;
  valorTotal?: number | null;
  nomeOficina?: string;
  dataHora?: Date;
}

export interface WhatsAppOrcamentoParams {
  telefone?: string | null;
  clienteNome?: string | null;
  equipamentoModelo?: string | null;
  equipamentoNumeroSerie?: string | null;
  numeroOs?: string | null;
  valorPecas?: number | null;
  valorMaoObra?: number | null;
  valorDesconto?: number | null;
  valorTotal?: number | null;
  nomeOficina?: string;
  dataHora?: Date;
}

export interface WhatsAppOSParams {
  telefone?: string | null;
  clienteNome?: string | null;
  equipamentoModelo?: string | null;
  equipamentoNumeroSerie?: string | null;
  maquinaMarca?: string | null;
  maquinaModelo?: string | null;
  maquinaTipoDescricao?: string | null;
  numeroOs?: string | null;
  status?: StatusOrdemServico | string | null;
  problemaRelatado?: string | null;
  diagnostico?: string | null;
  valorPecas?: number | null;
  valorMaoObra?: number | null;
  valorDesconto?: number | null;
  valorTotal?: number | null;
  nomeOficina?: string;
  dataHora?: Date;
}

/**
 * Normaliza o número de telefone para o formato internacional aceito pelo wa.me (DDI 55 + DDD + Número)
 * Aceita números com ou sem máscara: (31) 99999-8888, 31999998888, 5531999998888, etc.
 * Retorna null para números vazios ou inválidos.
 */
export function sanitizarTelefoneWhatsapp(telefone?: string | null): string | null {
  if (!telefone) {
    return null;
  }

  // Remove qualquer caractere não numérico
  const apenasDigitos = telefone.replace(/\D/g, '');

  if (!apenasDigitos) {
    return null;
  }

  // Se já começar com DDI do Brasil (55) e tiver 12 ou 13 dígitos
  if (apenasDigitos.startsWith('55') && (apenasDigitos.length === 12 || apenasDigitos.length === 13)) {
    return apenasDigitos;
  }

  // Celular (11 dígitos com DDD) ou Fixo (10 dígitos com DDD)
  if (apenasDigitos.length === 10 || apenasDigitos.length === 11) {
    return `55${apenasDigitos}`;
  }

  // Caso seja um número com 8 ou 9 dígitos sem DDD, é inválido para wa.me pois falta DDD
  return null;
}

/**
 * Formata um valor numérico em moeda brasileira (BRL: R$ 1.250,00)
 */
export function formatarMoedaWhatsapp(valor?: number | null): string {
  const num = typeof valor === 'number' && !isNaN(valor) ? valor : 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num).replace(/\u00a0/g, ' ');
}

/**
 * Obtém a hora civil atual no fuso oficial do projeto (America/Sao_Paulo)
 */
export function obterHoraSaoPaulo(dataHora: Date = new Date()): number {
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    });
    const parsed = parseInt(formatter.format(dataHora), 10);
    return isNaN(parsed) ? dataHora.getHours() : parsed % 24;
  } catch {
    return dataHora.getHours();
  }
}

/**
 * Retorna saudação adequada ao horário de Brasília / São Paulo:
 * - 00:00 às 11:59: "bom dia"
 * - 12:00 às 17:59: "boa tarde"
 * - 18:00 às 23:59: "boa noite"
 */
export function obterSaudacaoPorHorario(dataHora: Date = new Date()): 'bom dia' | 'boa tarde' | 'boa noite' {
  const hora = obterHoraSaoPaulo(dataHora);
  if (hora >= 0 && hora < 12) {
    return 'bom dia';
  } else if (hora >= 12 && hora < 18) {
    return 'boa tarde';
  } else {
    return 'boa noite';
  }
}

/**
 * Converte o status técnico da OS em texto natural e amigável para o cliente
 */
export function formatarStatusAmigavel(status?: string | null): string {
  if (!status) return 'Em andamento';
  switch (status.toUpperCase()) {
    case 'ABERTA':
      return 'Recebido na oficina';
    case 'EM_DIAGNOSTICO':
      return 'Em processo de diagnóstico';
    case 'AGUARDANDO_APROVACAO':
      return 'Aguardando sua aprovação';
    case 'EM_MANUTENCAO':
      return 'Em processo de manutenção';
    case 'AGUARDANDO_PECA':
      return 'Aguardando peça para continuidade do serviço';
    case 'PRONTA':
      return 'Pronto para retirada';
    case 'CONCLUIDA':
      return 'Serviço finalizado';
    case 'CANCELADA':
      return 'Atendimento cancelado';
    default:
      return status;
  }
}

/**
 * Formata a saudação com ou sem nome de forma elegante e natural
 */
function montarSaudacao(clienteNome?: string | null, saudacao: string = 'bom dia', pontuacao: string = '!'): string {
  const limpo = clienteNome?.trim();
  // Ignora se for literal 'Cliente' ou vazio
  if (limpo && limpo.toLowerCase() !== 'cliente') {
    return `*Olá, ${saudacao}, ${limpo}${pontuacao}*`;
  }
  return `*Olá, ${saudacao}${pontuacao}*`;
}

/**
 * Resolve a identificação textual do equipamento combinando modelo, marca e número de série
 */
function resolverEquipamento(params: {
  equipamentoModelo?: string | null;
  maquinaMarca?: string | null;
  maquinaModelo?: string | null;
  maquinaTipoDescricao?: string | null;
  equipamentoNumeroSerie?: string | null;
}): string | null {
  const partes: string[] = [];
  if (params.equipamentoModelo?.trim()) {
    partes.push(params.equipamentoModelo.trim());
  } else {
    const mm = [params.maquinaMarca?.trim(), params.maquinaModelo?.trim()].filter(Boolean).join(' ');
    if (mm) {
      partes.push(mm);
    } else if (params.maquinaTipoDescricao?.trim()) {
      partes.push(params.maquinaTipoDescricao.trim());
    }
  }

  const base = partes.join(' ').trim();
  if (!base || base.toLowerCase() === 'equipamento') return null;

  const serie = params.equipamentoNumeroSerie?.trim();
  if (serie && serie !== 'S/N') {
    return `${base} (Nº de Série: ${serie})`;
  }

  return base;
}

/**
 * Gera mensagem WhatsApp contextualizada, completa e profissional para uma Ordem de Serviço
 */
export function gerarMensagemWhatsappOS(params: WhatsAppOSParams): string {
  const nomeOficina = params.nomeOficina?.trim() || OFICINA.nomeFantasia;
  const saudacao = obterSaudacaoPorHorario(params.dataHora);
  const cliente = params.clienteNome;
  const equipamento = resolverEquipamento(params);
  const osNum = (params.numeroOs || '').trim();
  const osBold = osNum ? `*${osNum}*` : 'sua Ordem de Serviço';
  const status = (params.status || '').toUpperCase();

  const footer = `_Esta é uma mensagem automática da ${nomeOficina}._\n\n*Atenciosamente,*\n${nomeOficina}`;

  switch (status) {
    case 'PRONTA': {
      const saudacaoLinha = `${montarSaudacao(cliente, saudacao)} 👋`;
      const equipFrase = equipamento
        ? `A máquina *${equipamento}*, referente à Ordem de Serviço ${osBold}, está pronta para retirada em nossa oficina.`
        : `O seu atendimento referente à Ordem de Serviço ${osBold} está pronto para retirada em nossa oficina.`;

      const valorTotal = params.valorTotal ?? 0;
      const valorLinha = valorTotal > 0
        ? `\n\n*Valor total:* ${formatarMoedaWhatsapp(valorTotal)}`
        : '';

      return `${saudacaoLinha}\n\nTemos uma atualização sobre o seu equipamento.\n\n${equipFrase}${valorLinha}\n\nCaso tenha alguma dúvida ou precise de mais informações, entre em contato conosco por este WhatsApp.\n\n${footer}`;
    }

    case 'AGUARDANDO_APROVACAO': {
      const saudacaoLinha = `${montarSaudacao(cliente, saudacao)} 👋`;
      const equipFrase = equipamento
        ? ` referente à máquina *${equipamento}*`
        : '';

      const pecas = params.valorPecas ?? 0;
      const maoObra = params.valorMaoObra ?? 0;
      const desconto = params.valorDesconto ?? 0;
      const total = params.valorTotal ?? 0;

      const linhasDetalhamento: string[] = [];
      if (pecas > 0) linhasDetalhamento.push(`- Peças: ${formatarMoedaWhatsapp(pecas)}`);
      if (maoObra > 0) linhasDetalhamento.push(`- Mão de Obra: ${formatarMoedaWhatsapp(maoObra)}`);
      if (desconto > 0) linhasDetalhamento.push(`- Desconto: -${formatarMoedaWhatsapp(desconto)}`);
      linhasDetalhamento.push(`- Total: ${formatarMoedaWhatsapp(total)}`);

      const blocoValores = linhasDetalhamento.join('\n');

      return `${saudacaoLinha}\n\nTemos uma atualização sobre sua Ordem de Serviço.\n\nSegue o orçamento para a Ordem de Serviço ${osBold}${equipFrase}:\n${blocoValores}\n\nFavor nos confirmar a aprovação para iniciarmos o serviço.\n\nCaso tenha alguma dúvida sobre o diagnóstico ou valores apresentados, nossa equipe está à disposição por este WhatsApp.\n\n${footer}`;
    }

    case 'EM_DIAGNOSTICO': {
      const saudacaoLinha = `${montarSaudacao(cliente, saudacao)} 👋`;
      const equipFrase = equipamento
        ? `o equipamento *${equipamento}*, referente à Ordem de Serviço ${osBold},`
        : `o seu atendimento referente à Ordem de Serviço ${osBold}`;

      return `${saudacaoLinha}\n\nInformamos que ${equipFrase} está atualmente em processo de diagnóstico técnico.\n\nNossa equipe está realizando a avaliação necessária para identificar a causa do problema e definir os procedimentos adequados.\n\nAssim que tivermos uma atualização sobre o equipamento, entraremos em contato.\n\nCaso tenha alguma dúvida, estamos à disposição por este WhatsApp.\n\n${footer}`;
    }

    case 'EM_MANUTENCAO': {
      const saudacaoLinha = `${montarSaudacao(cliente, saudacao)} 👋`;
      const equipFrase = equipamento
        ? `o equipamento *${equipamento}*, referente à Ordem de Serviço ${osBold},`
        : `o seu atendimento referente à Ordem de Serviço ${osBold}`;

      return `${saudacaoLinha}\n\nGostaríamos de informar que ${equipFrase} está atualmente em processo de manutenção.\n\nNossa equipe está realizando os procedimentos necessários para o reparo e revisão do equipamento.\n\nAssim que houver uma nova atualização sobre o serviço, entraremos em contato.\n\nCaso tenha alguma dúvida, estamos à disposição por este WhatsApp.\n\n${footer}`;
    }

    case 'AGUARDANDO_PECA': {
      const saudacaoLinha = `${montarSaudacao(cliente, saudacao)} 👋`;
      const equipFrase = equipamento
        ? `, referente ao equipamento *${equipamento}*`
        : '';

      return `${saudacaoLinha}\n\nTemos uma atualização sobre a Ordem de Serviço ${osBold}${equipFrase}.\n\nO serviço está temporariamente aguardando a disponibilidade e chegada de peça(s) necessária(s) para a continuidade da manutenção com total segurança e qualidade.\n\nAssim que os itens chegarem, retomaremos os procedimentos e entraremos em contato.\n\nCaso tenha alguma dúvida, permanecemos à disposição por este WhatsApp.\n\n${footer}`;
    }

    case 'CONCLUIDA': {
      const saudacaoLinha = `${montarSaudacao(cliente, saudacao)} 👋`;
      const equipFrase = equipamento
        ? `ao equipamento *${equipamento}*, da Ordem de Serviço ${osBold},`
        : `à Ordem de Serviço ${osBold}`;

      const valorTotal = params.valorTotal ?? 0;
      const valorLinha = valorTotal > 0
        ? `\n\n*Valor total:* ${formatarMoedaWhatsapp(valorTotal)}`
        : '';

      return `${saudacaoLinha}\n\nInformamos que o serviço referente ${equipFrase} foi finalizado com sucesso.${valorLinha}\n\nAgradecemos a preferência e confiança em nosso trabalho! Caso tenha alguma dúvida ou precise de novas informações, entre em contato conosco por este WhatsApp.\n\n${footer}`;
    }

    case 'CANCELADA': {
      const saudacaoLinha = montarSaudacao(cliente, saudacao, '.');
      const equipFrase = equipamento
        ? `, referente ao equipamento *${equipamento}*,`
        : '';

      return `${saudacaoLinha}\n\nInformamos que a Ordem de Serviço ${osBold}${equipFrase} foi cancelada em nosso sistema.\n\nCaso tenha alguma dúvida ou precise de mais informações sobre o atendimento, entre em contato conosco por este WhatsApp.\n\n${footer}`;
    }

    case 'ABERTA': {
      const saudacaoLinha = `${montarSaudacao(cliente, saudacao)} 👋`;
      const equipFrase = equipamento
        ? ` do equipamento *${equipamento}*`
        : '';

      const problema = params.problemaRelatado?.trim();
      const problemaLinha = problema
        ? `\n*Problema relatado:* ${problema}\n`
        : '';

      return `${saudacaoLinha}\n\nConfirmamos o recebimento${equipFrase} em nossa oficina.\n\n*Ordem de Serviço:* ${osNum || 'Registrada'}\n${problemaLinha}\nO equipamento será avaliado por nossa equipe técnica e, conforme o andamento do serviço, enviaremos novas atualizações.\n\nCaso tenha alguma dúvida, estamos à disposição por este WhatsApp.\n\n${footer}`;
    }

    default: {
      const saudacaoLinha = `${montarSaudacao(cliente, saudacao)} 👋`;
      const statusAmigavel = formatarStatusAmigavel(params.status);
      const equipLinha = equipamento
        ? `*Equipamento:* ${equipamento}\n`
        : '';

      return `${saudacaoLinha}\n\nTemos uma nova atualização sobre o seu atendimento.\n\n*Ordem de Serviço:* ${osNum || 'Em andamento'}\n${equipLinha}*Status atual:* ${statusAmigavel}\n\nCaso tenha alguma dúvida ou precise de mais informações, nossa equipe está à disposição por este WhatsApp.\n\n${footer}`;
    }
  }
}

/**
 * Constrói a mensagem e o link seguro wa.me para qualquer status de Ordem de Serviço
 */
export function gerarLinkWhatsappOS(params: WhatsAppOSParams): WhatsAppResult {
  const mensagem = gerarMensagemWhatsappOS(params);
  const telefoneNormalizado = sanitizarTelefoneWhatsapp(params.telefone);

  if (!telefoneNormalizado) {
    return {
      url: null,
      mensagem,
      erro: 'Telefone inválido ou não informado.',
    };
  }

  const encodedText = encodeURIComponent(mensagem);
  const url = `https://wa.me/${telefoneNormalizado}?text=${encodedText}`;

  return {
    url,
    mensagem,
  };
}

/**
 * Constrói a mensagem e o link seguro wa.me para aviso de máquina pronta para retirada.
 * Mantém retrocompatibilidade estrita com a assinatura anterior.
 */
export function gerarLinkWhatsappRetirada(params: WhatsAppRetiradaParams): WhatsAppResult {
  return gerarLinkWhatsappOS({
    ...params,
    status: 'PRONTA',
  });
}

/**
 * Constrói a mensagem e o link seguro wa.me para envio de orçamento para aprovação.
 * Mantém retrocompatibilidade estrita com a assinatura anterior.
 */
export function gerarLinkWhatsappOrcamento(params: WhatsAppOrcamentoParams): WhatsAppResult {
  return gerarLinkWhatsappOS({
    ...params,
    status: 'AGUARDANDO_APROVACAO',
  });
}
