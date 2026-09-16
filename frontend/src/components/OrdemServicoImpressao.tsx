import React from 'react';
import { OrdemServico, OrdemServicoItem } from '@/lib/types';
import { formatarMoeda, formatarDataHora } from '@/lib/api';

interface OrdemServicoImpressaoProps {
  os: OrdemServico;
  itens: OrdemServicoItem[];
}

export default function OrdemServicoImpressao({ os, itens }: OrdemServicoImpressaoProps) {
  const isCancelada = os.status === 'CANCELADA';

  return (
    <div className="hidden print:block text-slate-900 bg-white font-sans p-6 max-w-4xl mx-auto text-xs leading-relaxed">
      {/* 1. Cabeçalho Oficial */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3 mb-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
            Oficina Gestão
          </h1>
          <p className="text-xs font-bold text-slate-700 uppercase">
            Assistência Técnica Especializada
          </p>
          <p className="text-[11px] text-slate-600">
            Máquinas de Solda • Geradores de Energia • Manutenção Técnica
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Telefone: (31) 3333-4444 | contato@oficinagestao.com.br
          </p>
        </div>

        <div className="text-right border border-slate-400 rounded p-2.5 bg-slate-50 min-w-[190px]">
          <p className="text-[10px] uppercase font-bold text-slate-500">Ordem de Serviço</p>
          <p className="text-lg font-black font-mono text-slate-900 leading-tight">{os.numeroOs}</p>
          <p
            className={`text-xs font-black uppercase mt-1 px-1.5 py-0.5 rounded inline-block ${
              isCancelada
                ? 'bg-red-100 text-red-700 border border-red-300'
                : os.status === 'CONCLUIDA'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-slate-200 text-slate-800'
            }`}
          >
            STATUS: {os.statusDescricao}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            Entrada: <strong>{formatarDataHora(os.dataEntrada)}</strong>
          </p>
          {os.dataConclusao && (
            <p className="text-[10px] text-slate-600">
              Conclusão: <strong>{formatarDataHora(os.dataConclusao)}</strong>
            </p>
          )}
        </div>
      </div>

      {/* 2. Dados do Cliente */}
      <div className="mb-4">
        <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
          1. Identificação do Cliente
        </h2>
        <div className="border border-slate-300 p-2 rounded-xs grid grid-cols-12 gap-2 text-[11px]">
          <div className="col-span-6">
            <span className="font-bold text-slate-700">Nome / Razão Social: </span>
            <span className="text-slate-900">{os.clienteNome}</span>
          </div>
          <div className="col-span-3">
            <span className="font-bold text-slate-700">CPF/CNPJ: </span>
            <span className="text-slate-900">{os.clienteCpfCnpj || 'Não informado'}</span>
          </div>
          <div className="col-span-3">
            <span className="font-bold text-slate-700">Telefone: </span>
            <span className="text-slate-900">{os.clienteTelefone || 'Não informado'}</span>
          </div>
        </div>
      </div>

      {/* 3. Dados do Equipamento */}
      <div className="mb-4">
        <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
          2. Dados do Equipamento
        </h2>
        <div className="border border-slate-300 p-2 rounded-xs grid grid-cols-12 gap-2 text-[11px]">
          <div className="col-span-3">
            <span className="font-bold text-slate-700">Tipo: </span>
            <span className="text-slate-900">{os.maquinaTipoDescricao}</span>
          </div>
          <div className="col-span-3">
            <span className="font-bold text-slate-700">Marca/Modelo: </span>
            <span className="text-slate-900">
              {os.maquinaMarca} {os.maquinaModelo}
            </span>
          </div>
          <div className="col-span-3">
            <span className="font-bold text-slate-700">Nº de Série: </span>
            <span className="font-mono text-slate-900">{os.maquinaNumeroSerie || 'Sem série'}</span>
          </div>
          <div className="col-span-3">
            <span className="font-bold text-slate-700">Tensão/Potência: </span>
            <span className="text-slate-900">
              {os.maquinaTensao || '-'} {os.maquinaPotencia ? `• ${os.maquinaPotencia}` : ''}
            </span>
          </div>
          {os.horimetroAtual != null && (
            <div className="col-span-12 border-t border-slate-200 pt-1 mt-1 text-slate-700">
              <span className="font-bold">Horímetro na Entrada: </span>
              <span>{os.horimetroAtual} horas</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Diagnóstico e Serviços */}
      <div className="mb-4">
        <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
          3. Diagnóstico e Serviços Técnicos
        </h2>
        <div className="border border-slate-300 p-2 rounded-xs space-y-2 text-[11px]">
          <div>
            <span className="font-bold text-slate-700 block">Defeito / Problema Relatado:</span>
            <p className="text-slate-900 whitespace-pre-wrap">{os.problemaRelatado}</p>
          </div>
          {os.diagnostico && (
            <div className="border-t border-slate-200 pt-1.5">
              <span className="font-bold text-slate-700 block">Laudo / Diagnóstico Técnico:</span>
              <p className="text-slate-900 whitespace-pre-wrap">{os.diagnostico}</p>
            </div>
          )}
          {os.solucaoAplicada && (
            <div className="border-t border-slate-200 pt-1.5">
              <span className="font-bold text-slate-700 block">Serviço / Solução Aplicada:</span>
              <p className="text-slate-900 whitespace-pre-wrap">{os.solucaoAplicada}</p>
            </div>
          )}
          {os.testesRealizados && (
            <div className="border-t border-slate-200 pt-1.5">
              <span className="font-bold text-slate-700 block">Testes Técnicos de Bancada:</span>
              <p className="text-slate-900 whitespace-pre-wrap">{os.testesRealizados}</p>
            </div>
          )}
          {os.observacoes && (
            <div className="border-t border-slate-200 pt-1.5">
              <span className="font-bold text-slate-700 block">Observações:</span>
              <p className="text-slate-900 whitespace-pre-wrap">{os.observacoes}</p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Tabela de Peças e Componentes Aplicados */}
      <div className="mb-4">
        <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
          4. Peças e Componentes Aplicados
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
            {itens && itens.length > 0 ? (
              itens.map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="border border-slate-300 px-2 py-1 font-mono">{item.produtoCodigo}</td>
                  <td className="border border-slate-300 px-2 py-1 font-semibold text-slate-900">
                    {item.produtoNome}
                  </td>
                  <td className="border border-slate-300 px-2 py-1 text-right font-mono">{item.quantidade}</td>
                  {/* PREÇO HISTÓRICO CONGELADO: */}
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
              ))
            ) : (
              <tr>
                <td colSpan={6} className="border border-slate-300 px-2 py-2 text-center text-slate-500 italic">
                  Nenhuma peça foi aplicada nesta Ordem de Serviço.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 6. Resumo Financeiro */}
      <div className="mb-6">
        <h2 className="bg-slate-800 text-white font-bold text-[10px] uppercase px-2 py-0.5 tracking-wider mb-1.5 rounded-xs">
          5. Resumo Financeiro
        </h2>
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          <div className="border border-slate-300 p-2 rounded-xs bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Mão de Obra</span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {formatarMoeda(os.valorMaoObra || 0)}
            </span>
          </div>
          <div className="border border-slate-300 p-2 rounded-xs bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Peças / Insumos</span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {formatarMoeda(os.valorPecas || 0)}
            </span>
          </div>
          <div className="border border-slate-300 p-2 rounded-xs bg-slate-50">
            <span className="text-[10px] uppercase font-bold text-slate-600 block">Desconto</span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              {formatarMoeda(os.valorDesconto || 0)}
            </span>
          </div>
          <div className="border-2 border-slate-800 p-2 rounded-xs bg-slate-100">
            <span className="text-[10px] uppercase font-black text-slate-900 block">Valor Total</span>
            <span className="text-sm font-black text-slate-950 font-mono">
              {formatarMoeda(os.valorTotal || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* 7. Termos Legais e Assinaturas */}
      <div className="border-t border-slate-300 pt-3">
        <p className="text-[9px] text-slate-600 leading-tight mb-8">
          Garantia legal de 90 (noventa) dias sobre os serviços executados e componentes substituídos, respeitadas as condições
          normais de operação do equipamento (CDC Art. 26). A garantia não cobre danos por sobretensão de rede, quedas, uso
          indevido ou intervenção de terceiros. O equipamento poderá ser retirado somente mediante a apresentação desta via.
        </p>

        <div className="grid grid-cols-2 gap-12 text-center text-[10px] pt-4">
          <div>
            <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
              {os.clienteNome}
            </div>
            <span className="text-[9px] text-slate-500">Assinatura do Cliente / Responsável</span>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-1 font-bold text-slate-900">
              {os.tecnicoNome || 'Oficina Gestão'}
            </div>
            <span className="text-[9px] text-slate-500">Técnico Responsável / Oficina</span>
          </div>
        </div>
      </div>
    </div>
  );
}
