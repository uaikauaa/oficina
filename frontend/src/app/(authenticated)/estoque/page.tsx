'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Package,
  AlertTriangle,
  XCircle,
  TrendingUp,
  SlidersHorizontal,
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  X,
  RotateCcw,
} from 'lucide-react';
import MovimentacaoEstoqueModal from '@/components/MovimentacaoEstoqueModal';
import { Produto, EstoqueResumo, Categoria, Fornecedor } from '@/lib/types';
import { apiFetchJson, formatarMoeda } from '@/lib/api';

export default function EstoquePage() {
  const [resumo, setResumo] = useState<EstoqueResumo | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [termoInput, setTermoInput] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [fornecedorId, setFornecedorId] = useState<string>('');
  const [filtroNivel, setFiltroNivel] = useState<'TODOS' | 'CRITICO' | 'ZERADO'>('TODOS');

  // Paginação
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Modal de Movimentação
  const [modalMovimentacaoOpen, setModalMovimentacaoOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);

  const [carregandoCategorias, setCarregandoCategorias] = useState(false);
  const [carregandoFornecedores, setCarregandoFornecedores] = useState(false);

  const carregarResumo = useCallback(async () => {
    try {
      const r = await apiFetchJson<EstoqueResumo>('/api/estoque/resumo');
      setResumo(r);
    } catch {
      // Ignora erro
    }
  }, []);

  const carregarCategorias = useCallback(async () => {
    if (categorias.length > 0 || carregandoCategorias) return;
    setCarregandoCategorias(true);
    try {
      const data = await apiFetchJson<Categoria[]>('/api/categorias/ativas');
      setCategorias(data || []);
    } catch {
      // Ignora erro
    } finally {
      setCarregandoCategorias(false);
    }
  }, [categorias.length, carregandoCategorias]);

  const carregarFornecedores = useCallback(async () => {
    if (fornecedores.length > 0 || carregandoFornecedores) return;
    setCarregandoFornecedores(true);
    try {
      const data = await apiFetchJson<{ content: Fornecedor[] }>('/api/fornecedores?size=100');
      setFornecedores(data.content || []);
    } catch {
      // Ignora erro
    } finally {
      setCarregandoFornecedores(false);
    }
  }, [fornecedores.length, carregandoFornecedores]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarResumo();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarResumo]);

  // Debounce de 400ms para a busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setTermoDebounced(termoInput.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [termoInput]);

  const carregarProdutos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: '15',
        ativo: 'true',
      });
      if (termoDebounced) params.append('termo', termoDebounced);
      if (categoriaId) params.append('categoriaId', categoriaId);
      if (fornecedorId) params.append('fornecedorId', fornecedorId);
      if (filtroNivel === 'CRITICO' || filtroNivel === 'ZERADO') {
        params.append('estoqueBaixo', 'true');
      }

      const res = await apiFetchJson<{
        content: Produto[];
        totalPages: number;
        totalElements: number;
      }>(`/api/produtos?${params.toString()}`);

      setProdutos(res.content || []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar saldo de estoque';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, termoDebounced, categoriaId, fornecedorId, filtroNivel]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarProdutos();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarProdutos]);

  const handleAbrirMovimentacao = (prod?: Produto) => {
    setProdutoSelecionado(prod || produtos[0] || null);
    setModalMovimentacaoOpen(true);
  };

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 font-sans">
      <main className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/20 shadow-sm">
                <Boxes className="w-6 h-6" />
              </div>
              <h1 className="ui-page-title">
                Controle de Estoque & Saldos
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted">
              Acompanhamento de inventário físico, pontos de pedido e movimentações atômicas
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/estoque/movimentacoes"
              className="px-4 py-2.5 rounded-xl border border-control bg-surface/80 hover:bg-elevated text-xs font-semibold text-ink hover:text-ink flex items-center gap-2 transition-all shadow-sm"
            >
              <History aria-hidden="true" className="w-4 h-4 text-ink" />
              <span>Histórico de Movimentações</span>
            </Link>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total de Itens */}
          <div className="p-5 rounded-2xl bg-surface/60 border border-line">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Total de Peças Ativas</span>
              <div className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20">
                <Package aria-hidden="true" className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-ink">
                {resumo?.totalProdutos ?? 0}
              </span>
              <span className="text-xs text-subtle block mt-0.5">itens cadastrados</span>
            </div>
          </div>

          {/* Estoque Baixo */}
          <div className="p-5 rounded-2xl bg-surface/60 border border-line">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Estoque Crítico (Baixo)</span>
              <div className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20">
                <AlertTriangle aria-hidden="true" className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-accent">
                {resumo?.itensEstoqueBaixo ?? 0}
              </span>
              <span className="text-xs text-subtle block mt-0.5">abaixo do estoque mínimo</span>
            </div>
          </div>

          {/* Sem Estoque */}
          <div className="p-5 rounded-2xl bg-surface/60 border border-line">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Zerados / Sem Estoque</span>
              <div className="p-2 rounded-xl bg-danger/10 text-danger border border-danger/20">
                <XCircle aria-hidden="true" className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-danger">
                {resumo?.itensSemEstoque ?? 0}
              </span>
              <span className="text-xs text-subtle block mt-0.5">necessita reposição urgente</span>
            </div>
          </div>

          {/* Valor Total do Estoque */}
          <div className="p-5 rounded-2xl bg-surface/60 border border-line">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted">Valorização Total</span>
              <div className="p-2 rounded-xl bg-ink/5 text-ink border border-line">
                <TrendingUp aria-hidden="true" className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-ink">
                {formatarMoeda(resumo?.valorTotalEstoque ?? 0)}
              </span>
              <span className="text-xs text-subtle block mt-0.5">calculado a preço de custo</span>
            </div>
          </div>
        </div>

        {/* Toolbar de Busca e Filtros */}
        <div className="p-4 rounded-2xl bg-surface/60 border border-line space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Campo de Busca Textual */}
            <div className="relative">
              <input aria-label="Buscar por código, nome ou marca..."
                type="text"
                value={termoInput}
                onChange={(e) => setTermoInput(e.target.value)}
                placeholder="Buscar por código, nome ou marca..."
                className="ui-field w-full border pl-9 pr-8 placeholder-subtle focus:outline-none focus:border-accent/50"
              />
              <Search aria-hidden="true" className="w-4 h-4 text-subtle absolute left-3 top-2.5 pointer-events-none" />
              {termoInput && (
                <button
                  type="button"
                  onClick={() => setTermoInput('')}
                  className="absolute right-2.5 top-2.5 text-subtle hover:text-ink transition-colors cursor-pointer"
                  title="Limpar busca"
                >
                  <X aria-hidden="true" className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filtro por Categoria */}
            <div>
              <select
                value={categoriaId}
                aria-label="Categoria"
                onFocus={carregarCategorias}
                onPointerDown={carregarCategorias}
                onChange={(e) => {
                  setCategoriaId(e.target.value);
                  setPage(0);
                }}
                className="ui-field w-full border focus:outline-none focus:border-accent/50"
              >
                <option value="">{carregandoCategorias ? 'Carregando categorias...' : 'Todas as categorias'}</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Fornecedor */}
            <div>
              <select
                value={fornecedorId}
                aria-label="Fornecedor"
                onFocus={carregarFornecedores}
                onPointerDown={carregarFornecedores}
                onChange={(e) => {
                  setFornecedorId(e.target.value);
                  setPage(0);
                }}
                className="ui-field w-full border focus:outline-none focus:border-accent/50"
              >
                <option value="">{carregandoFornecedores ? 'Carregando fornecedores...' : 'Todos os fornecedores'}</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.razaoSocial || f.nomeFantasia}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Nível de Estoque */}
            <div>
              <select aria-label="Todos os saldos"
                value={filtroNivel}
                onChange={(e) => {
                  setFiltroNivel(e.target.value as 'TODOS' | 'CRITICO' | 'ZERADO');
                  setPage(0);
                }}
                className="ui-field w-full border focus:outline-none focus:border-accent/50"
              >
                <option value="TODOS">Todos os saldos</option>
                <option value="CRITICO">Apenas estoque crítico (&le; mín)</option>
              </select>
            </div>
          </div>

          {(termoDebounced || categoriaId || fornecedorId || filtroNivel !== 'TODOS') && (
            <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
              <span className="text-muted">
                Filtros ativos: <strong className="text-accent">{totalElements}</strong> registros encontrados
              </span>
              <button
                type="button"
                onClick={() => {
                  setTermoInput('');
                  setTermoDebounced('');
                  setCategoriaId('');
                  setFornecedorId('');
                  setFiltroNivel('TODOS');
                  setPage(0);
                }}
                className="inline-flex items-center gap-1 text-muted hover:text-accent text-xs transition-colors cursor-pointer"
              >
                <RotateCcw aria-hidden="true" className="w-4 h-4" />
                <span>Limpar Filtros</span>
              </button>
            </div>
          )}
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs">
            {error}
          </div>
        )}

        {/* Tabela de Saldos de Estoque */}
        <div className="rounded-2xl border border-line bg-surface/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-muted uppercase text-xs tracking-wider font-bold">
                  <th className="py-2.5 px-2.5 sm:px-3">Peça / Componente</th>
                  <th className="py-2.5 px-2 sm:px-2.5">Categoria</th>
                  <th className="py-2.5 px-2 sm:px-2.5">Localização</th>
                  <th className="py-2.5 px-2 sm:px-2.5 text-center">Nível Físico</th>
                  <th className="py-2.5 px-2 sm:px-2.5 text-center">Saldo Atual</th>
                  <th className="py-2.5 px-2 sm:px-2.5 text-center">Estoque Mínimo</th>
                  <th className="py-2.5 px-2 sm:px-2.5 text-right">Valor em Estoque</th>
                  <th className="py-2.5 px-2.5 sm:px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <span>Carregando saldos em estoque...</span>
                      </div>
                    </td>
                  </tr>
                ) : produtos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-subtle">
                      <Boxes className="w-8 h-8 text-subtle mx-auto mb-2" />
                      <p>Nenhuma peça com saldo encontrada com os filtros selecionados.</p>
                    </td>
                  </tr>
                ) : (
                  produtos.map((p) => {
                    const isZerado = p.estoqueAtual === 0;
                    const isCritico = p.estoqueAtual <= p.estoqueMinimo;

                    // Cálculo da porcentagem da barra de estoque
                    const refMax = Math.max(p.estoqueMinimo * 2, 10);
                    const pct = Math.min(Math.round((p.estoqueAtual / refMax) * 100), 100);

                    const valorInvestido = p.estoqueAtual * p.precoCusto;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-elevated/40 transition-colors group"
                      >
                        {/* Peça & Marca */}
                        <td className="py-2.5 px-2.5 sm:px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded text-xs shrink-0">
                              {p.codigo}
                            </span>
                            <span className="font-bold text-ink group-hover:text-accent transition-colors break-words">
                              {p.nome}
                            </span>
                            {p.marca && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-elevated text-accent border border-accent/20 shrink-0">
                                {p.marca}
                              </span>
                            )}
                          </div>
                          {p.fornecedorNome && (
                            <span className="block text-xs text-subtle mt-0.5 truncate max-w-[200px] sm:max-w-xs" title={`Fornecedor: ${p.fornecedorNome}`}>
                              Fornecedor: {p.fornecedorNome}
                            </span>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="py-2.5 px-2 sm:px-2.5">
                          {p.categoriaNome ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-xs font-bold bg-ink/5 text-ink border border-line break-words max-w-[110px] sm:max-w-[130px] leading-tight">
                              {p.categoriaNome}
                            </span>
                          ) : (
                            <span className="text-xs text-subtle">-</span>
                          )}
                        </td>

                        {/* Localização */}
                        <td className="py-2.5 px-2 sm:px-2.5 text-ink">
                          {p.localizacao ? (
                            <span className="inline-flex items-center gap-1 text-xs break-words max-w-[90px]">
                              <MapPin aria-hidden="true" className="w-3 h-3 text-subtle shrink-0" />
                              <span>{p.localizacao}</span>
                            </span>
                          ) : (
                            <span className="text-subtle">-</span>
                          )}
                        </td>

                        {/* Barra de Nível Físico */}
                        <td className="py-2.5 px-2 sm:px-2.5 text-center">
                          <div className="w-14 sm:w-16 md:w-20 mx-auto space-y-0.5">
                            <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden border border-line">
                              <div
                                className={`h-full transition-all rounded-full ${
                                  isZerado
                                    ? 'bg-danger'
                                    : isCritico
                                    ? 'bg-accent'
                                    : 'bg-elevated'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-subtle block leading-tight">
                              {isZerado ? 'Esgotado' : isCritico ? 'Crítico' : 'Normal'}
                            </span>
                          </div>
                        </td>

                        {/* Saldo Atual */}
                        <td className="py-2.5 px-2 sm:px-2.5 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-extrabold border ${
                              isZerado
                                ? 'bg-danger/10 text-danger border-danger/30'
                                : isCritico
                                ? 'bg-accent/10 text-accent border-accent/30'
                                : 'bg-ink/5 text-ink border-line'
                            }`}
                          >
                            <span>{p.estoqueAtual}</span>
                            <span className="text-xs font-normal opacity-80">
                              {p.unidadeMedida}
                            </span>
                          </span>
                        </td>

                        {/* Estoque Mínimo */}
                        <td className="py-2.5 px-2 sm:px-2.5 text-center whitespace-nowrap text-muted font-semibold text-xs">
                          {p.estoqueMinimo} {p.unidadeMedida}
                        </td>

                        {/* Valor Investido */}
                        <td className="py-2.5 px-2 sm:px-2.5 text-right whitespace-nowrap">
                          <span className="font-bold text-ink text-xs sm:text-xs">
                            {formatarMoeda(valorInvestido)}
                          </span>
                          <span className="block text-xs text-subtle">
                            Unit: {formatarMoeda(p.precoCusto)}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-2.5 px-2.5 sm:px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleAbrirMovimentacao(p)}
                            className="ui-icon-btn px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-control bg-elevated/80 hover:bg-hover text-xs font-semibold text-ink hover:text-ink inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Ajustar saldo, registrar compra ou descarte"
                          >
                            <SlidersHorizontal aria-hidden="true" className="w-4 h-4 text-accent shrink-0" />
                            <span className="hidden xl:inline">Movimentar</span>
                          </button>
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
                Total de <strong className="text-ink">{totalElements}</strong> itens
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
                <span className="text-ink font-semibold px-2">
                  Página {page + 1} de {totalPages}
                </span>
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

      {/* Modal de Movimentação de Estoque */}
      <MovimentacaoEstoqueModal
        isOpen={modalMovimentacaoOpen}
        produto={produtoSelecionado}
        onClose={() => setModalMovimentacaoOpen(false)}
        onSuccess={() => {
          setModalMovimentacaoOpen(false);
          carregarResumo();
          carregarProdutos();
        }}
      />
    </div>
  );
}
