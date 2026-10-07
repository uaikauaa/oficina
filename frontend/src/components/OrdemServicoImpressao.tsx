import React from 'react';
import { OrdemServico, OrdemServicoItem } from '@/lib/types';
import { formatarMoeda, formatarDataHora } from '@/lib/api';

import type { ConfiguracaoOficinaImpressao } from '@/lib/ordemServicoImpressaoHelper';
export type { ConfiguracaoOficinaImpressao };

interface OrdemServicoImpressaoProps {
  os: OrdemServico;
  itens: OrdemServicoItem[];
  configuracao: ConfiguracaoOficinaImpressao;
}

import {
  temValor,
  extrairCamposCliente,
  extrairCamposEquipamento,
  extrairCamposTecnicos,
  deveExibirSecaoPecas,
  formatarDadosOficina,
} from '@/lib/ordemServicoImpressaoHelper';

export default function OrdemServicoImpressao({ os, itens, configuracao }: OrdemServicoImpressaoProps) {
  const { identificacao, contato, endereco, nomeEmpresarial } = formatarDadosOficina(configuracao);
  const camposCliente = extrairCamposCliente(os);
  const camposEquipamento = extrairCamposEquipamento(os);
  const camposTecnicos = extrairCamposTecnicos(os);
  const temItens = deveExibirSecaoPecas(itens);

  return (
    <div className="hidden print:block text-slate-900 bg-white font-sans p-6 max-w-4xl mx-auto text-xs leading-relaxed">
      {/* 1. Cabeçalho Oficial */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
            {configuracao.nomeFantasia}
          </h1>
          <p className="text-xs font-bold text-slate-700 uppercase">
            Assistência Técnica Especializada
          </p>
          <p className="text-[11px] text-slate-600">
            Máquinas de Solda • Geradores de Energia • Manutenção Técnica
          </p>
          {nomeEmpresarial && (
            <p className="text-[10px] text-slate-500">{nomeEmpresarial}</p>
          )}
          {identificacao && <p className="text-[10px] text-slate-500 mt-0.5">{identificacao}</p>}
          {contato && <p className="text-[10px] text-slate-500">{contato}</p>}
          {endereco && <p className="text-[10px] text-slate-500">{endereco}</p>}
        </div>

        {/* Identificação Discreta do Recibo (sem selo, sem status destacado) */}
        <div className="text-right text-[11px] text-slate-600 shrink-0">
          <p className="text-sm font-bold text-slate-900 uppercase tracking-wide">Recibo de Serviço</p>
          {temValor(os.numeroOs) && (
            <p className="font-mono text-xs font-semibold text-slate-700 mt-0.5">
              OS: {os.numeroOs.trim()}
            </p>
          )}
          {temValor(os.dataEntrada) && (
            <p className="text-[10px] text-slate-500 mt-0.5">
              Entrada: {formatarDataHora(os.dataEntrada)}
            </p>
          )}
          {temValor(os.dataConclusao) && (
            <p className="text-[10px] text-slate-500">
              Conclusão: {formatarDataHora(os.dataConclusao)}
            </p>
          )}
        </div>
      </div>

      {/* 2. Dados do Cliente (Apenas campos com valor) */}
      {camposCliente.length > 0 && (
        <div className="mb-4 break-inside-avoid">
          <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
            Identificação do Cliente
          </h2>
          <div className="border border-slate-300 p-2.5 rounded-xs flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
            {camposCliente.map((c) => (
              <div key={c.label} className="flex items-baseline gap-1.5 min-w-[180px] flex-1">
                <span className="font-bold text-slate-700 whitespace-nowrap">{c.label}:</span>
                <span className="text-slate-900">{c.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Dados do Equipamento (Apenas campos com valor, grid dinâmico) */}
      {camposEquipamento.length > 0 && (
        <div className="mb-4 break-inside-avoid">
          <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
            Dados do Equipamento
          </h2>
          <div className="border border-slate-300 p-2.5 rounded-xs flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
            {camposEquipamento.map((c) => (
              <div key={c.label} className="flex items-baseline gap-1.5 min-w-[140px] flex-1">
                <span className="font-bold text-slate-700 whitespace-nowrap">{c.label}:</span>
                <span className={`text-slate-900 ${c.mono ? 'font-mono' : ''}`}>{c.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Diagnóstico e Serviços Técnicos (Omitido completamente se vazio) */}
      {camposTecnicos.length > 0 && (
        <div className="mb-4 break-inside-avoid">
          <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
            Diagnóstico e Serviços Técnicos
          </h2>
          <div className="border border-slate-300 p-2.5 rounded-xs space-y-2 text-[11px]">
            {camposTecnicos.map((item, idx) => (
              <div key={item.label} className={idx > 0 ? 'border-t border-slate-200 pt-1.5' : ''}>
                <span className="font-bold text-slate-700 block">{item.label}:</span>
                <p className="text-slate-900 whitespace-pre-wrap">{item.valor}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Peças e Componentes Aplicados (Omitido completamente se vazio) */}
      {temItens && (
        <div className="mb-4 break-inside-avoid">
          <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
            Peças e Componentes Aplicados
          </h2>
          <table className="w-full border-collapse border border-slate-300 text-[10px]">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold">
                <th className="border border-slate-300 px-2 py-1 text-left w-24">Código</th>
                <th className="border border-slate-300 px-2 py-1 text-left">Peça / Componente</th>
                <th className="border border-slate-300 px-2 py-1 text-right w-16">Qtd</th>
                <th className="border border-slate-300 px-2 py-1 text-right w-24">Unit. (R$)</th>
                <th className="border border-slate-300 px-2 py-1 text-right w-24">Desc. (R$)</th>
                <th className="border border-slate-300 px-2 py-1 text-right w-28">Total (R$)</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="border border-slate-300 px-2 py-1 font-mono">{item.produtoCodigo}</td>
                  <td className="border border-slate-300 px-2 py-1 font-semibold text-slate-900">
                    {item.produtoNome}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono">{item.quantidade}</td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                    {formatarMoeda(item.valorUnitario)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono text-slate-600">
                    {formatarMoeda(item.valorDesconto || 0)}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900">
                    {formatarMoeda(item.valorTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 6. Resumo Financeiro (Zeros preservados como valores válidos) */}
      <div className="mb-6 break-inside-avoid">
        <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
          Resumo Financeiro
        </h2>
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          <div className="border border-slate-300 p-2 rounded-xs bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Mão de Obra</span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {formatarMoeda(os.valorMaoObra ?? 0)}
            </span>
          </div>
          <div className="border border-slate-300 p-2 rounded-xs bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Peças / Insumos</span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {formatarMoeda(os.valorPecas ?? 0)}
            </span>
          </div>
          <div className="border border-slate-300 p-2 rounded-xs bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Desconto</span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {formatarMoeda(os.valorDesconto ?? 0)}
            </span>
          </div>
          <div className="border-2 border-slate-800 p-2 rounded-xs bg-slate-100">
            <span className="text-[10px] uppercase font-black text-slate-900 block">Valor Total</span>
            <span className="text-sm font-black text-slate-950 font-mono">
              {formatarMoeda(os.valorTotal ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* 7. Termos Legais e Assinaturas */}
      <div className="border-t border-slate-300 pt-3 break-inside-avoid">
        <p className="text-[9px] text-slate-600 leading-tight mb-8">
          Condições de garantia conforme política da oficina sobre os serviços executados e componentes substituídos, respeitadas as condições
          normais de operação do equipamento. A garantia não cobre danos por sobretensão de rede, quedas, uso
          indevido ou intervenção de terceiros. O equipamento poderá ser retirado somente mediante a apresentação desta via.
        </p>

        <div className="grid grid-cols-2 gap-12 text-center text-[10px] pt-4">
          <div>
            <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
              {temValor(os.clienteNome) ? os.clienteNome.trim() : '\u00A0'}
            </div>
            <span className="text-[9px] text-slate-500">Assinatura do Cliente / Responsável</span>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
              {temValor(os.tecnicoNome)
                ? os.tecnicoNome!.trim()
                : temValor(configuracao.nomeFantasia)
                ? configuracao.nomeFantasia.trim()
                : '\u00A0'}
            </div>
            <span className="text-[9px] text-slate-500">
              {temValor(configuracao.nomeFantasia)
                ? `Técnico Responsável / ${configuracao.nomeFantasia.trim()}`
                : 'Técnico Responsável'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
