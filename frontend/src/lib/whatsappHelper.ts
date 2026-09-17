/**
 * Helper para geração de links wa.me de notificação de retirada de equipamentos (FEATURE-001)
 * Oficina Gestão — Versão 1.1
 */

export interface WhatsAppRetiradaParams {
  telefone?: string | null;
  clienteNome: string;
  equipamentoModelo: string;
  numeroOs: string;
  valorTotal: number;
}

export interface WhatsAppResult {
  url: string | null;
  mensagem: string;
  erro?: string;
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
 * Formata um valor numérico em moeda brasileira (BRL)
 */
export function formatarMoedaWhatsapp(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

/**
 * Constrói a mensagem e o link seguro wa.me para aviso de máquina pronta para retirada.
 */
export function gerarLinkWhatsappRetirada(params: WhatsAppRetiradaParams): WhatsAppResult {
  const { telefone, clienteNome, equipamentoModelo, numeroOs, valorTotal } = params;

  const nomeLimpo = (clienteNome || 'Cliente').trim();
  const modeloLimpo = (equipamentoModelo || 'Equipamento').trim();
  const osLimpa = (numeroOs || '').trim();
  const valorFormatado = formatarMoedaWhatsapp(valorTotal ?? 0);

  const mensagem = `Olá, ${nomeLimpo}.\n\nA máquina ${modeloLimpo} referente à OS ${osLimpa} está pronta para retirada.\n\nValor total: ${valorFormatado}`;

  const telefoneNormalizado = sanitizarTelefoneWhatsapp(telefone);

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
 * Parâmetros para geração de link de aprovação de orçamento
 */
export interface WhatsAppOrcamentoParams {
  telefone?: string | null;
  clienteNome: string;
  equipamentoModelo: string;
  numeroOs: string;
  valorPecas: number;
  valorMaoObra: number;
  valorTotal: number;
}

/**
 * Constrói a mensagem e o link seguro wa.me para envio de orçamento para aprovação.
 */
export function gerarLinkWhatsappOrcamento(params: WhatsAppOrcamentoParams): WhatsAppResult {
  const { telefone, clienteNome, equipamentoModelo, numeroOs, valorPecas, valorMaoObra, valorTotal } = params;

  const nomeLimpo = (clienteNome || 'Cliente').trim();
  const modeloLimpo = (equipamentoModelo || 'Equipamento').trim();
  const osLimpa = (numeroOs || '').trim();
  const pecasFormatado = formatarMoedaWhatsapp(valorPecas ?? 0);
  const maoObraFormatado = formatarMoedaWhatsapp(valorMaoObra ?? 0);
  const totalFormatado = formatarMoedaWhatsapp(valorTotal ?? 0);

  const mensagem = `Olá, ${nomeLimpo}.\n\nSegue o orçamento para a OS ${osLimpa} referente à máquina ${modeloLimpo}:\n- Peças: ${pecasFormatado}\n- Mão de Obra: ${maoObraFormatado}\n- Total: ${totalFormatado}\n\nFavor nos confirmar a aprovação para iniciarmos o serviço.`;

  const telefoneNormalizado = sanitizarTelefoneWhatsapp(telefone);

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
