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
  Boxes,
  Package,
  Search,
  Filter,
  FileText,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Header from '@/components/Header';
import {
  CurrentUser,
  EstoqueMovimentacao,
  TipoMovimentacaoEstoque,
  TIPO_MOVIMENTACAO_ESTOQUE_LABELS,
  TIPO_MOVIMENTACAO_ESTOQUE_BADGES,
} from '@/lib/types';
import { apiFetch, apiFetchJson, formatarDataHora, formatarMoeda } from '@/lib/api';

export default function MovimentacoesEstoquePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [tipo, setTipo] = useState<string>('');

  // Paginação
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  const carregarUsuario = useCallback(async () => {
    try {
      const u = await apiFetchJson<CurrentUser>('/api/auth/me');
      setUser(u);
    } catch {
      // Ignora erro
    }
  }, []);

  useEffect(() => {
    carregarUsuario();
  }, [carregarUsuario]);

  const carregarMovimentacoes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: '20',
      });
      if (tipo) params.append('tipo', tipo);

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
  }, [page, tipo]);

  useEffect(() => {
    carregarMovimentacoes();
  }, [carregarMovimentacoes]);

  const getTipoIcon = (tipoMov: TipoMovimentacaoEstoque) => {
    switch (tipoMov) {
      case 'ENTRADA':
        return <ArrowUpRight className="w-3.5 h-3.5" />;
      case 'SAIDA':
        return <ArrowDownRight className="w-3.5 h-3.5" />;
      case 'AJUSTE_POSITIVO':
      case 'AJUSTE_NEGATIVO':
        return <SlidersHorizontal className="w-3.5 h-3.5" />;
      case 'DEVOLUCAO':
        return <RotateCcw className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
              <Link href="/estoque" className="hover:text-amber-400 transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar ao Estoque</span>
              </Link>
            </div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-sm">
                <History className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Histórico & Auditoria de Movimentações
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Rastreamento de entradas por fornecedor, baixas automáticas em OS, ajustes físicos e devoluções
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/produtos"
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all shadow-sm"
            >
              <Package className="w-4 h-4 text-amber-400" />
              <span>Catálogo de Peças</span>
            </Link>
          </div>
        </div>

        {/* Toolbar de Filtros */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-72">
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value);
                setPage(0);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
            >
              <option value="">Todas as Movimentações</option>
              <option value="ENTRADA">Entradas (Compras / Reposições)</option>
              <option value="SAIDA">Saídas (Utilização em OS / Descartes)</option>
              <option value="AJUSTE_POSITIVO">Ajustes Positivos (+)</option>
              <option value="AJUSTE_NEGATIVO">Ajustes Negativos (-)</option>
              <option value="DEVOLUCAO">Devoluções / Estornos</option>
            </select>
          </div>

          <span className="text-xs text-slate-400">
            Total de <strong className="text-white">{totalElements}</strong> operações registradas
          </span>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Tabela de Movimentações */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-3.5 px-4">Data / Hora</th>
                  <th className="py-3.5 px-4">Peça / Componente</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4 text-center">Qtd</th>
                  <th className="py-3.5 px-4 text-center">Evolução de Saldo</th>
                  <th className="py-3.5 px-4">Motivo / Origem</th>
                  <th className="py-3.5 px-4">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando histórico de movimentações...</span>
                      </div>
                    </td>
                  </tr>
                ) : movimentacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p>Nenhuma movimentação de estoque encontrada.</p>
                    </td>
                  </tr>
                ) : (
                  movimentacoes.map((m) => {
                    const badge = TIPO_MOVIMENTACAO_ESTOQUE_BADGES[m.tipoMovimentacao] || {
                      bg: 'bg-slate-800',
                      text: 'text-slate-300',
                      border: 'border-slate-700',
                    };
                    const isPositivo =
                      m.tipoMovimentacao === 'ENTRADA' ||
                      m.tipoMovimentacao === 'AJUSTE_POSITIVO' ||
                      m.tipoMovimentacao === 'DEVOLUCAO';

                    return (
                      <tr
                        key={m.id}
                        className="hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Data/Hora */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                          {formatarDataHora(m.dataMovimentacao)}
                        </td>

                        {/* Peça */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[11px]">
                              {m.produtoCodigo}
                            </span>
                            <span className="font-semibold text-white">
                              {m.produtoNome}
                            </span>
                          </div>
                        </td>

                        {/* Tipo de Movimentação */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {getTipoIcon(m.tipoMovimentacao)}
                            <span>{m.tipoDescricao || TIPO_MOVIMENTACAO_ESTOQUE_LABELS[m.tipoMovimentacao]}</span>
                          </span>
                        </td>

                        {/* Quantidade */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`font-mono font-bold text-xs ${
                              isPositivo ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {isPositivo ? `+${m.quantidade}` : `-${m.quantidade}`}
                          </span>
                        </td>

                        {/* Evolução de Saldo */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                            <span className="text-slate-400">{m.quantidadeAnterior}</span>
                            <span className="text-slate-600">➔</span>
                            <span className="font-bold text-white">{m.quantidadePosterior}</span>
                          </div>
                        </td>

                        {/* Motivo e Vínculo com OS */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {m.ordemServicoId && (
                              <Link
                                href={`/ordens-servico/${m.ordemServicoId}`}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                              >
                                <FileText className="w-3 h-3" />
                                <span>{m.ordemServicoNumero || `OS #${m.ordemServicoId}`}</span>
                              </Link>
                            )}
                            <span className="text-slate-300 text-xs">{m.motivo}</span>
                          </div>
                        </td>

                        {/* Usuário */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <User className="w-3.5 h-3.5 text-slate-500" />
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs">
              <span className="text-slate-400">
                Página <strong className="text-white">{page + 1}</strong> de{' '}
                <strong className="text-white">{totalPages}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
