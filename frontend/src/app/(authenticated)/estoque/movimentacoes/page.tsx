'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  History,
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  RotateCcw,
  Package,
  FileText,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  EstoqueMovimentacao,
  TipoMovimentacaoEstoque,
  TIPO_MOVIMENTACAO_ESTOQUE_LABELS,
  TIPO_MOVIMENTACAO_ESTOQUE_BADGES,
} from '@/lib/types';
import { apiFetchJson, formatarDataHora } from '@/lib/api';
import { formatarDataInicioParaApi, formatarDataFimParaApi } from '@/lib/relatorioDateHelper';

export default function MovimentacoesEstoquePage() {
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [termo, setTermo] = useState<string>('');
  const [tipo, setTipo] = useState<string>('');
  const [numeroOs, setNumeroOs] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  // Paginação
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);



  const carregarMovimentacoes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: '20',
      });
      if (termo.trim()) params.append('termo', termo.trim());
      if (tipo) params.append('tipo', tipo);
      if (numeroOs.trim()) params.append('numeroOs', numeroOs.trim());
      if (dataInicio) params.append('dataInicio', formatarDataInicioParaApi(dataInicio));
      if (dataFim) params.append('dataFim', formatarDataFimParaApi(dataFim));

      const res = await apiFetchJson<{
        content: EstoqueMovimentacao[];
        totalPages: number;
        totalElements: number;
      }>(`/api/estoque/movimentacoes?${params.toString()}`);

      setMovimentacoes(res.content || []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar movimentações';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, termo, tipo, numeroOs, dataInicio, dataFim]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarMovimentacoes();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarMovimentacoes]);

  const getTipoIcon = (tipoMov: TipoMovimentacaoEstoque) => {
    switch (tipoMov) {
      case 'ENTRADA':
        return <ArrowUpRight aria-hidden="true" className="w-3.5 h-3.5" />;
      case 'SAIDA':
        return <ArrowDownRight aria-hidden="true" className="w-3.5 h-3.5" />;
      case 'AJUSTE_POSITIVO':
      case 'AJUSTE_NEGATIVO':
        return <SlidersHorizontal aria-hidden="true" className="w-3.5 h-3.5" />;
      case 'DEVOLUCAO':
        return <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      <main className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted mb-2">
              <Link href="/estoque" className="hover:text-accent transition-colors flex items-center gap-1">
                <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Voltar ao Estoque</span>
              </Link>
            </div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-ink/5 text-ink border border-line shadow-sm">
                <History className="w-6 h-6" />
              </div>
              <h1 className="ui-page-title">
                Histórico & Auditoria de Movimentações
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted">
              Rastreamento de entradas por fornecedor, baixas automáticas em OS, ajustes físicos e devoluções
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/produtos"
              className="px-4 py-2.5 rounded-xl border border-control bg-surface/80 hover:bg-elevated text-xs font-semibold text-ink hover:text-ink flex items-center gap-2 transition-all shadow-sm"
            >
              <Package aria-hidden="true" className="w-4 h-4 text-accent" />
              <span>Catálogo de Peças</span>
            </Link>
          </div>
        </div>

        {/* Toolbar de Filtros */}
        <div className="p-4 rounded-2xl bg-surface/60 border border-line space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Filtro por Produto ou Usuário */}
            <div className="relative">
              <input aria-label="Peça (cód/nome) ou usuário..."
                type="text"
                value={termo}
                onChange={(e) => {
                  setTermo(e.target.value);
                  setPage(0);
                }}
                placeholder="Peça (cód/nome) ou usuário..."
                className="ui-field w-full border pl-9 pr-3 placeholder-subtle focus:outline-none focus:border-accent/50"
              />
              <Search aria-hidden="true" className="w-4 h-4 text-subtle absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Filtro por Tipo */}
            <div>
              <select aria-label="Todas as Movimentações"
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value);
                  setPage(0);
                }}
                className="ui-field w-full border focus:outline-none focus:border-accent/50"
              >
                <option value="">Todas as Movimentações</option>
                <option value="ENTRADA">Entradas (Compras / Reposições)</option>
                <option value="SAIDA">Saídas (Utilização em OS / Descartes)</option>
                <option value="AJUSTE_POSITIVO">Ajustes Positivos (+)</option>
                <option value="AJUSTE_NEGATIVO">Ajustes Negativos (-)</option>
                <option value="DEVOLUCAO">Devoluções / Estornos</option>
              </select>
            </div>

            {/* Filtro por Número de OS */}
            <div className="relative">
              <input aria-label="Filtrar por Nº de OS..."
                type="text"
                value={numeroOs}
                onChange={(e) => {
                  setNumeroOs(e.target.value);
                  setPage(0);
                }}
                placeholder="Filtrar por Nº de OS..."
                className="ui-field w-full border pl-9 pr-3 placeholder-subtle focus:outline-none focus:border-accent/50"
              />
              <Search aria-hidden="true" className="w-4 h-4 text-subtle absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Data Início */}
            <div>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPage(0);
                }}
                title="Data Inicial"
                className="ui-field w-full border focus:outline-none focus:border-accent/50"
              />
            </div>

            {/* Data Fim */}
            <div>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPage(0);
                }}
                title="Data Final"
                className="ui-field w-full border focus:outline-none focus:border-accent/50"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-line">
            <div className="flex items-center gap-3">
              <span>Filtro de auditoria operacional de estoque</span>
              {(termo || tipo || numeroOs || dataInicio || dataFim) && (
                <button
                  onClick={() => {
                    setTermo('');
                    setTipo('');
                    setNumeroOs('');
                    setDataInicio('');
                    setDataFim('');
                    setPage(0);
                  }}
                  className="text-accent hover:underline font-semibold cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
            <span>
              Total de <strong className="text-ink">{totalElements}</strong> operações registradas
            </span>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs">
            {error}
          </div>
        )}

        {/* Tabela de Movimentações */}
        <div className="rounded-2xl border border-line bg-surface/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-muted uppercase text-xs tracking-wider font-bold">
                  <th className="py-3.5 px-4">Data / Hora</th>
                  <th className="py-3.5 px-4">Peça / Componente</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4 text-center">Qtd</th>
                  <th className="py-3.5 px-4 text-center">Evolução de Saldo</th>
                  <th className="py-3.5 px-4">Motivo / Origem</th>
                  <th className="py-3.5 px-4">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin" />
                        <span>Carregando histórico de movimentações...</span>
                      </div>
                    </td>
                  </tr>
                ) : movimentacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-subtle">
                      <History className="w-8 h-8 text-subtle mx-auto mb-2" />
                      <p>Nenhuma movimentação de estoque encontrada.</p>
                    </td>
                  </tr>
                ) : (
                  movimentacoes.map((m) => {
                    const badge = TIPO_MOVIMENTACAO_ESTOQUE_BADGES[m.tipoMovimentacao] || {
                      bg: 'bg-elevated',
                      text: 'text-ink',
                      border: 'border-control',
                    };
                    const isPositivo =
                      m.tipoMovimentacao === 'ENTRADA' ||
                      m.tipoMovimentacao === 'AJUSTE_POSITIVO' ||
                      m.tipoMovimentacao === 'DEVOLUCAO';

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-elevated/40 transition-colors"
                      >
                        {/* Data/Hora */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-ink font-mono text-xs">
                          {formatarDataHora(m.dataMovimentacao)}
                        </td>

                        {/* Peça */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded text-xs">
                              {m.produtoCodigo}
                            </span>
                            <span className="font-semibold text-ink">
                              {m.produtoNome}
                            </span>
                          </div>
                        </td>

                        {/* Tipo de Movimentação */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {getTipoIcon(m.tipoMovimentacao)}
                            <span>{m.tipoDescricao || TIPO_MOVIMENTACAO_ESTOQUE_LABELS[m.tipoMovimentacao]}</span>
                          </span>
                        </td>

                        {/* Quantidade */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isPositivo ? 'text-ink' : 'text-danger'
                            }`}
                          >
                            {isPositivo ? `+${m.quantidade}` : `-${m.quantidade}`}
                          </span>
                        </td>

                        {/* Evolução de Saldo */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-canvas px-2.5 py-1 rounded-lg border border-line">
                            <span className="text-muted">{m.quantidadeAnterior}</span>
                            <span className="text-subtle">➔</span>
                            <span className="font-bold text-ink">{m.quantidadePosterior}</span>
                          </div>
                        </td>

                        {/* Motivo e Vínculo com OS */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {m.ordemServicoId && (
                              <Link
                                href={`/ordens-servico/${m.ordemServicoId}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20 transition-colors"
                              >
                                <FileText aria-hidden="true" className="w-3 h-3" />
                                <span>{m.ordemServicoNumero || `OS #${m.ordemServicoId}`}</span>
                              </Link>
                            )}
                            <span className="text-ink text-xs">{m.motivo}</span>
                          </div>
                        </td>

                        {/* Usuário */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-muted">
                          <div className="flex items-center gap-1.5 text-xs">
                            <User aria-hidden="true" className="w-3.5 h-3.5 text-subtle" />
                            <span>{m.usuarioNome || 'Sistema'}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-line bg-canvas/40 text-xs">
              <span className="text-muted">
                Página <strong className="text-ink">{page + 1}</strong> de{' '}
                <strong className="text-ink">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={page === 0}
                  className="ui-icon-btn p-1.5 rounded-lg border border-control text-muted hover:text-ink hover:bg-elevated disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft aria-hidden="true" className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="ui-icon-btn p-1.5 rounded-lg border border-control text-muted hover:text-ink hover:bg-elevated disabled:opacity-30 disabled:pointer-events-none transition-colors"
                  aria-label="Próxima página"
                >
                  <ChevronRight aria-hidden="true" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
