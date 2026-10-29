'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import DomainIcon from '@/components/ui/DomainIcon';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  Wrench,
  Boxes,
  AlertTriangle,
  Edit2,
  Power,
  ChevronLeft,
  ChevronRight,
  X,
  SlidersHorizontal,
  RotateCcw,
  CheckCircle2,
  Loader2,
  AlertCircle,
  MapPin,
  Tag,
  ExternalLink,
} from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import ProdutoModal from '@/components/ProdutoModal';
import CompatibilidadeModal from '@/components/CompatibilidadeModal';
import MovimentacaoEstoqueModal from '@/components/MovimentacaoEstoqueModal';
import {
  Produto,
  Fornecedor,
  Categoria,
} from '@/lib/types';
import { apiFetch, apiFetchJson, formatarMoeda, formatarCodigoSku, formatarUnidadeMedida } from '@/lib/api';

type PillTipo = 'TODAS' | 'PECA' | 'CONSUMIVEL' | 'PRODUTO' | 'CRITICO';

export default function ProdutosPage() {
  // Lista de Produtos e Paginação
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Busca e Filtros
  const [termoInput, setTermoInput] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const [pillAtiva, setPillAtiva] = useState<PillTipo>('TODAS');
  const [somenteAtivos, setSomenteAtivos] = useState(true);
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [fornecedorId, setFornecedorId] = useState<string>('');
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState(false);

  // Lazy Loaded Data (apenas quando solicitado)
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loadingFiltrosAuxiliares, setLoadingFiltrosAuxiliares] = useState(false);

  // Modais de Operação
  const [modalProdutoOpen, setModalProdutoOpen] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [modalCompatibilidadeOpen, setModalCompatibilidadeOpen] = useState(false);
  const [produtoCompatibilidade, setProdutoCompatibilidade] = useState<Produto | null>(null);
  const [modalMovimentacaoOpen, setModalMovimentacaoOpen] = useState(false);
  const [produtoMovimentacao, setProdutoMovimentacao] = useState<Produto | null>(null);

  // Modal de Confirmação de Status (substitui window.confirm)
  const [produtoParaAlternarStatus, setProdutoParaAlternarStatus] = useState<Produto | null>(null);
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [statusToast, setStatusToast] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);

  // =========================================================================
  // 1. BUSCA COM DEBOUNCE REAL DE 400ms (Fase 4)
  // =========================================================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setTermoDebounced(termoInput.trim());
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [termoInput]);

  // =========================================================================
  // 3. LAZY LOADING DE FORNECEDORES E CATEGORIAS (Fase 9)
  // =========================================================================
  const carregarFiltrosAuxiliares = useCallback(async () => {
    if (fornecedores.length > 0 && categorias.length > 0) return;
    setLoadingFiltrosAuxiliares(true);
    try {
      const [catsRes, fornsRes] = await Promise.all([
        categorias.length === 0 ? apiFetchJson<Categoria[]>('/api/categorias/ativas').catch(() => []) : Promise.resolve(categorias),
        fornecedores.length === 0 ? apiFetchJson<{ content: Fornecedor[] }>('/api/fornecedores?size=100').catch(() => ({ content: [] })) : Promise.resolve({ content: fornecedores }),
      ]);
      setCategorias(catsRes || []);
      setFornecedores(fornsRes?.content || []);
    } catch {
      // Ignora erro não impeditivo
    } finally {
      setLoadingFiltrosAuxiliares(false);
    }
  }, [categorias, fornecedores]);

  // Carrega categorias e fornecedores sob demanda
  useEffect(() => {
    if (filtrosAvancadosAbertos || modalProdutoOpen) {
      const timer = setTimeout(() => {
        carregarFiltrosAuxiliares();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [filtrosAvancadosAbertos, modalProdutoOpen, carregarFiltrosAuxiliares]);

  // =========================================================================
  // 4. CONSULTA PRINCIPAL DE PRODUTOS
  // =========================================================================
  const carregarProdutos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
      });

      if (termoDebounced) {
        params.append('termo', termoDebounced);
      }

      // Mapeamento das Pills Operacionais
      if (pillAtiva === 'PECA') {
        params.append('tipo', 'PECA');
      } else if (pillAtiva === 'CONSUMIVEL') {
        params.append('tipo', 'CONSUMIVEL');
      } else if (pillAtiva === 'PRODUTO') {
        params.append('tipo', 'PRODUTO');
      } else if (pillAtiva === 'CRITICO') {
        params.append('estoqueBaixo', 'true');
      }

      // Status Ativo
      if (somenteAtivos) {
        params.append('ativo', 'true');
      }

      // Filtros Avançados
      if (categoriaId) {
        params.append('categoriaId', categoriaId);
      }
      if (fornecedorId) {
        params.append('fornecedorId', fornecedorId);
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
      const msg = err instanceof Error ? err.message : 'Erro ao carregar catálogo de peças e produtos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, termoDebounced, pillAtiva, somenteAtivos, categoriaId, fornecedorId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarProdutos();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarProdutos]);

  // =========================================================================
  // 5. ATIVAÇÃO / INATIVAÇÃO DE STATUS (Fase 1 — Bug P0 & Fase 10 — Sem confirm)
  // =========================================================================
  const handleAbrirConfirmacaoStatus = (produto: Produto) => {
    setProdutoParaAlternarStatus(produto);
  };

  const handleConfirmarStatus = async () => {
    if (!produtoParaAlternarStatus || isSubmittingStatus) return;

    setIsSubmittingStatus(true);
    const novoStatus = !produtoParaAlternarStatus.ativo;
    const acaoTexto = novoStatus ? 'ativada' : 'inativada';

    try {
      const res = await apiFetch(`/api/produtos/${produtoParaAlternarStatus.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: novoStatus }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Falha ao alterar status da peça`);
      }

      setProdutoParaAlternarStatus(null);
      setStatusToast({
        tipo: 'sucesso',
        mensagem: `Peça '${produtoParaAlternarStatus.nome}' ${acaoTexto} com sucesso!`,
      });
      setTimeout(() => setStatusToast(null), 4000);
      carregarProdutos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao comunicar com o servidor';
      setStatusToast({
        tipo: 'erro',
        mensagem: msg,
      });
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // =========================================================================
  // 6. AÇÕES CONTEXTUAIS E MODAIS
  // =========================================================================
  const handleNovoProduto = () => {
    setProdutoEditando(null);
    setModalProdutoOpen(true);
  };

  const handleEditarProduto = (prod: Produto) => {
    setProdutoEditando(prod);
    setModalProdutoOpen(true);
  };

  const handleAbrirCompatibilidades = (prod: Produto) => {
    setProdutoCompatibilidade(prod);
    setModalCompatibilidadeOpen(true);
  };

  // Ação Contextual ± Estoque (Fase 7)
  const handleAbrirMovimentacao = (prod: Produto) => {
    setProdutoMovimentacao(prod);
    setModalMovimentacaoOpen(true);
  };

  // =========================================================================
  // 7. LIMPEZA DE FILTROS E DESCRIÇÃO DE FILTROS ATIVOS
  // =========================================================================
  const limparTodosFiltros = () => {
    setTermoInput('');
    setTermoDebounced('');
    setPillAtiva('TODAS');
    setSomenteAtivos(true);
    setCategoriaId('');
    setFornecedorId('');
    setPage(0);
  };

  const temFiltrosAtivos = useMemo(() => {
    return (
      !!termoDebounced ||
      pillAtiva !== 'TODAS' ||
      !somenteAtivos ||
      !!categoriaId ||
      !!fornecedorId
    );
  }, [termoDebounced, pillAtiva, somenteAtivos, categoriaId, fornecedorId]);

  const descricaoFiltroAtivo = useMemo(() => {
    const partes: string[] = [];
    if (termoDebounced) partes.push(`"${termoDebounced}"`);
    if (pillAtiva === 'PECA') partes.push('Peças / Componentes');
    if (pillAtiva === 'CONSUMIVEL') partes.push('Consumíveis');
    if (pillAtiva === 'PRODUTO') partes.push('Produtos Acabados');
    if (pillAtiva === 'CRITICO') partes.push('Estoque Crítico');
    if (!somenteAtivos) partes.push('Incluindo Inativos');
    if (categoriaId) {
      const cat = categorias.find((c) => c.id.toString() === categoriaId);
      partes.push(`Categoria: ${cat?.nome || categoriaId}`);
    }
    if (fornecedorId) {
      const forn = fornecedores.find((f) => f.id.toString() === fornecedorId);
      partes.push(`Fornecedor: ${forn?.razaoSocial || fornecedorId}`);
    }
    return partes.join(' • ');
  }, [termoDebounced, pillAtiva, somenteAtivos, categoriaId, fornecedorId, categorias, fornecedores]);

  return (
    <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-4 font-sans">
      <main className="space-y-4">
        {/* =================================================================== */}
        {/* TOPO: CABEÇALHO COMPACTO & CTA PRINCIPAL (Fases 3 e 13) */}
        {/* =================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20 shadow-sm shrink-0">
              <Package aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="ui-page-title">
                  Peças &amp; Produtos
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface border border-line text-ink">
                  {totalElements} {totalElements === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted mt-0.5 hidden sm:block">
                Catálogo técnico de componentes de reposição e controle de estoque
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <Link
              href="/estoque"
              className="px-3.5 py-2.5 rounded-xl border border-control bg-surface/80 hover:bg-elevated text-xs font-semibold text-ink hover:text-ink flex items-center gap-2 transition-all shadow-sm"
              title="Acessar painel consolidado de estoque"
            >
              <Boxes aria-hidden="true" className="w-4 h-4 text-accent" />
              <span className="hidden sm:inline">Painel de Estoque</span>
              <span className="sm:hidden">Estoque</span>
            </Link>

            <button
              id="novo-produto-btn"
              onClick={handleNovoProduto}
              className="ui-btn ui-btn-primary sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
            >
              <Plus aria-hidden="true" className="w-4 h-4 " />
              <span>Nova Peça / Produto</span>
            </button>
          </div>
        </div>

        {/* Toast Notificação de Feedback */}
        {statusToast && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200 ${statusToast.tipo === 'sucesso'
                ? 'bg-ink/5 border-line text-ink'
                : 'bg-danger/10 border-danger/30 text-danger'
              }`}
          >
            <div className="flex items-center gap-2">
              {statusToast.tipo === 'sucesso' ? (
                <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
              )}
              <span>{statusToast.mensagem}</span>
            </div>
            <button
              onClick={() => setStatusToast(null)}
              className="p-1 hover:opacity-70 text-muted"
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* TOOLBAR COMPACTA: BUSCA + PILLS + MAIS FILTROS (Fases 4, 5 e 6) */}
        {/* =================================================================== */}
        <div className="p-3 sm:p-4 rounded-2xl bg-surface/60 border border-line space-y-3 shadow-lg">
          {/* Linha de Busca Principal e Botão de Filtros Avançados */}
          <div className="flex items-center gap-2">
            {/* Campo de Busca com Debounce 400ms e Botão [✕] */}
            <div className="relative flex-1">
              <input aria-label="Buscar por código, nome, marca, SKU ou localização ..."
                type="text"
                value={termoInput}
                onChange={(e) => setTermoInput(e.target.value)}
                placeholder="Buscar por código, nome, marca, SKU ou localização ..."
                className="ui-field w-full border pl-9 pr-8 placeholder-subtle focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all"
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

            {/* Botão [Mais Filtros ▾] (Recolhível) */}
            <button
              type="button"
              onClick={() => setFiltrosAvancadosAbertos((prev) => !prev)}
              aria-label={filtrosAvancadosAbertos ? 'Menos Filtros' : 'Mais Filtros'}
              aria-expanded={filtrosAvancadosAbertos}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${filtrosAvancadosAbertos || categoriaId || fornecedorId
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-canvas border-line text-ink hover:border-control hover:text-ink'
                }`}
            >
              <SlidersHorizontal aria-hidden="true" className="w-4 h-4" />
              <span className="hidden sm:inline">
                {filtrosAvancadosAbertos ? 'Menos Filtros' : 'Mais Filtros'}
              </span>
              {(categoriaId || fornecedorId) && (
                <span className="w-4 h-4 rounded-full bg-accent text-inverse text-xs font-extrabold flex items-center justify-center">
                  {(categoriaId ? 1 : 0) + (fornecedorId ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Botão Limpar Filtros quando houver filtro ativo */}
            {temFiltrosAtivos && (
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="ui-icon-btn inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-canvas border border-line text-muted hover:text-ink hover:border-control transition-all cursor-pointer shrink-0"
                title="Limpar todos os filtros aplicados"
              >
                <RotateCcw aria-hidden="true" className="w-4 h-4" />
                <span className="hidden md:inline">Limpar</span>
              </button>
            )}
          </div>

          {/* Painel Retrátil de Filtros Avançados (Fase 6) */}
          {filtrosAvancadosAbertos && (
            <div className="p-3 rounded-xl bg-canvas/80 border border-line grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Categoria */}
              <div>
                <label htmlFor="field-src-app-authenticated-produtos-page-tsx-1" className="block text-xs font-semibold text-muted mb-1">
                  Filtrar por Categoria:
                </label>
                <select id="field-src-app-authenticated-produtos-page-tsx-1"
                  value={categoriaId}
                  onChange={(e) => {
                    setCategoriaId(e.target.value);
                    setPage(0);
                  }}
                  disabled={loadingFiltrosAuxiliares}
                  className="ui-field w-full border focus:outline-none focus:border-accent/50"
                >
                  <option value="">Todas as categorias</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Fornecedor */}
              <div>
                <label htmlFor="field-src-app-authenticated-produtos-page-tsx-2" className="block text-xs font-semibold text-muted mb-1">
                  Filtrar por Fornecedor:
                </label>
                <select id="field-src-app-authenticated-produtos-page-tsx-2"
                  value={fornecedorId}
                  onChange={(e) => {
                    setFornecedorId(e.target.value);
                    setPage(0);
                  }}
                  disabled={loadingFiltrosAuxiliares}
                  className="ui-field w-full border focus:outline-none focus:border-accent/50"
                >
                  <option value="">Todos os fornecedores</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.razaoSocial}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Linha de Pills Operacionais Horizontais (Fase 5) */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-line">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
              {/* Pill Todas */}
              <button aria-pressed={pillAtiva === 'TODAS'}
                type="button"
                onClick={() => {
                  setPillAtiva('TODAS');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${pillAtiva === 'TODAS'
                    ? 'bg-accent text-inverse border-accent shadow-sm'
                    : 'bg-canvas text-ink border-line hover:border-control hover:text-ink'
                  }`}
              >
                Todas
              </button>

              {/* Pill Peças */}
              <button aria-pressed={pillAtiva === 'PECA'}
                type="button"
                onClick={() => {
                  setPillAtiva('PECA');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${pillAtiva === 'PECA'
                    ? 'bg-accent text-inverse border-accent shadow-sm'
                    : 'bg-canvas text-ink border-line hover:border-control hover:text-ink'
                  }`}
              >
                <DomainIcon type="MAQUINA_SOLDA" />
                <span>Peças / Componentes</span>
              </button>

              {/* Pill Consumíveis */}
              <button aria-pressed={pillAtiva === 'CONSUMIVEL'}
                type="button"
                onClick={() => {
                  setPillAtiva('CONSUMIVEL');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${pillAtiva === 'CONSUMIVEL'
                    ? 'bg-accent text-inverse border-accent shadow-sm'
                    : 'bg-canvas text-ink border-line hover:border-control hover:text-ink'
                  }`}
              >
                <DomainIcon type="GERADOR_ENERGIA" />
                <span>Consumíveis</span>
              </button>

              {/* Pill Produtos */}
              <button aria-pressed={pillAtiva === 'PRODUTO'}
                type="button"
                onClick={() => {
                  setPillAtiva('PRODUTO');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${pillAtiva === 'PRODUTO'
                    ? 'bg-accent text-inverse border-accent shadow-sm'
                    : 'bg-canvas text-ink border-line hover:border-control hover:text-ink'
                  }`}
              >
                <DomainIcon type="PRODUTO" />
                <span>Produtos</span>
              </button>

              {/* Pill Estoque Crítico */}
              <button aria-pressed={pillAtiva === 'CRITICO'}
                type="button"
                onClick={() => {
                  setPillAtiva('CRITICO');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${pillAtiva === 'CRITICO'
                    ? 'bg-danger text-ink border-danger shadow-sm'
                    : 'bg-canvas text-danger border-line hover:border-danger/40'
                  }`}
              >
                <AlertTriangle aria-hidden="true" className="w-4 h-4" />
                <span>Estoque Crítico</span>
              </button>
            </div>

            {/* Toggle de Somente Ativas */}
            <div className="shrink-0 pl-2">
              <button
                type="button"
                onClick={() => {
                  setSomenteAtivos((prev) => !prev);
                  setPage(0);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${somenteAtivos
                    ? 'bg-ink/5 text-ink border-line hover:bg-ink/5'
                    : 'bg-canvas text-muted border-line hover:text-ink'
                  }`}
                title={somenteAtivos ? 'Exibindo apenas ativas (clique para ver todas)' : 'Exibindo ativas e inativas'}
              >
                {somenteAtivos ? 'Somente Ativas' : 'Todas as Situações'}
              </button>
            </div>
          </div>

          {/* Chip de Feedback de Filtro Ativo (Fase 11) */}
          {temFiltrosAtivos && (
            <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-canvas border border-accent/30 text-xs">
              <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                <span className="text-muted shrink-0">Filtrando por:</span>
                <span className="font-bold text-accent truncate">{descricaoFiltroAtivo}</span>
                <span className="text-subtle shrink-0">({totalElements} encontrados)</span>
              </div>
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="ui-icon-btn text-muted hover:text-accent transition-colors p-0.5 ml-2 cursor-pointer shrink-0"
                title="Remover todos os filtros"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Mensagem de Erro Geral se houver */}
        {error && (
          <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
            <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* TABELA OPERACIONAL COMPACTA (Fases 7 e 13 — 1366x768 @ 125%) */}
        {/* =================================================================== */}
        <div className="rounded-2xl border border-line bg-surface/60 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr className="border-b border-line bg-canvas/70 text-muted uppercase text-xs tracking-wider font-bold">
                  <th className="py-2.5 px-3.5">Código / SKU</th>
                  <th className="py-2.5 px-3.5">Peça & Marca</th>
                  <th className="py-2.5 px-3.5">Tipo / Categoria</th>
                  <th className="py-2.5 px-3.5">Localização</th>
                  <th className="py-2.5 px-3.5 text-right">Preço</th>
                  <th className="py-2.5 px-3.5 text-center">Estoque</th>
                  <th className="py-2.5 px-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 aria-hidden="true" className="w-4 h-4 text-accent animate-spin" />
                        <span>Carregando catálogo de peças...</span>
                      </div>
                    </td>
                  </tr>
                ) : produtos.length === 0 ? (
                  /* Estados Vazios Contextuais (Fase 11) */
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      <div className="max-w-md mx-auto space-y-3">
                        <Package className="w-9 h-9 text-subtle mx-auto" />
                        {temFiltrosAtivos ? (
                          <>
                            <p className="font-semibold text-ink">
                              Nenhuma peça ou produto encontrado para os filtros aplicados.
                            </p>
                            <p className="text-xs text-subtle">
                              Tente buscar por outro termo ou limpar os filtros para ver todo o catálogo.
                            </p>
                            <button
                              type="button"
                              onClick={limparTodosFiltros}
                              className="px-3 py-1.5 rounded-xl bg-elevated hover:bg-hover text-ink text-xs font-bold transition-all cursor-pointer"
                            >
                              Limpar Filtros
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-ink">
                              Nenhuma peça ou produto cadastrado no catálogo.
                            </p>
                            <p className="text-xs text-subtle">
                              Cadastre novos componentes técnicos para movimentar o estoque e abastecer ordens de serviço.
                            </p>
                            <button
                              type="button"
                              onClick={handleNovoProduto}
                              className="ui-btn ui-btn-primary transition-all cursor-pointer"
                            >
                              + Cadastrar Primeira Peça
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  produtos.map((p) => {
                    const isCritico = p.estoqueAtual <= p.estoqueMinimo;
                    const isZerado = p.estoqueAtual <= 0;

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-elevated/40 transition-colors group ${!p.ativo ? 'opacity-60 bg-canvas/40' : ''
                          }`}
                      >
                        {/* Código / SKU */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <span
                            className="font-mono font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded text-xs"
                            title={p.codigo}
                          >
                            {formatarCodigoSku(p.codigo, p.id)}
                          </span>
                          {p.linkCompra && (p.linkCompra.startsWith('http://') || p.linkCompra.startsWith('https://')) && (
                            <a
                              href={p.linkCompra}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-sans text-xs text-ink hover:text-ink hover:underline mt-1"
                              title={`Abrir link de compra: ${p.linkCompra}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink aria-hidden="true" className="w-3 h-3 shrink-0" />
                              <span>Link de Compra</span>
                            </a>
                          )}
                        </td>

                        {/* Nome & Marca */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-ink group-hover:text-accent transition-colors">
                              {p.nome}
                            </span>
                            {p.marca && (
                              <span className="px-1.5 py-0.2 rounded text-xs font-semibold bg-elevated text-accent border border-accent/20">
                                {p.marca}
                              </span>
                            )}
                          </div>
                          {p.descricao && (
                            <span className="text-xs text-muted line-clamp-1 mt-0.5">
                              {p.descricao}
                            </span>
                          )}
                        </td>

                        {/* Tipo & Categoria */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-ink text-xs">
                              <DomainIcon type={p.tipo} className="inline-block w-4 h-4 mr-1.5 align-text-bottom" />
                              {p.tipo === 'PECA' && 'Peça'}
                              {p.tipo === 'CONSUMIVEL' && 'Consumível'}
                              {p.tipo === 'PRODUTO' && 'Produto'}
                              {p.tipo === 'SERVICO' && 'Serviço'}
                            </span>
                            {p.categoriaNome ? (
                              <span className="text-xs text-ink flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />
                                <span>{p.categoriaNome}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-subtle">-</span>
                            )}
                          </div>
                        </td>

                        {/* Localização */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-muted text-xs">
                          {p.localizacao ? (
                            <span className="inline-flex items-center gap-1 text-ink">
                              <MapPin aria-hidden="true" className="w-3 h-3 text-accent" />
                              <span>{p.localizacao}</span>
                            </span>
                          ) : (
                            <span className="text-subtle">-</span>
                          )}
                        </td>

                        {/* Preço de Venda */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <span className="font-bold text-ink">
                            {formatarMoeda(p.precoVenda)}
                          </span>
                          {p.precoCusto > 0 && (
                            <span className="block text-xs text-subtle">
                              Custo: {formatarMoeda(p.precoCusto)}
                            </span>
                          )}
                        </td>

                        {/* Estoque e Saldo */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleAbrirMovimentacao(p)}
                            title="Clique para ajustar o estoque desta peça"
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${isZerado
                                ? 'bg-danger/10 text-danger border-danger/30 hover:bg-danger/20'
                                : isCritico
                                  ? 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20'
                                  : 'bg-ink/5 text-ink border-line hover:bg-ink/5'
                              }`}
                          >
                            <span>{p.estoqueAtual}</span>
                            <span className="text-xs font-normal opacity-80">
                              {formatarUnidadeMedida(p.unidadeMedida)}
                            </span>
                          </button>
                          <span className="block text-xs text-subtle mt-0.5">
                            Mín: {p.estoqueMinimo}
                          </span>
                        </td>

                        {/* Ações (Fase 7 e 1) */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            {/* Botão Contextual ± Estoque (Fase 7) */}
                            <button
                              type="button"
                              onClick={() => handleAbrirMovimentacao(p)}
                              className="ui-icon-btn px-2 py-1 rounded-lg text-ink hover:text-accent bg-elevated/80 hover:bg-accent/10 border border-control hover:border-accent/30 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="Registrar entrada, saída ou ajuste de estoque (sem sair da tela)"
                            >
                              <Boxes aria-hidden="true" className="w-4 h-4 text-accent" />
                              <span>± Estoque</span>
                            </button>

                            {/* Compatibilidade com Máquinas */}
                            <button
                              type="button"
                              onClick={() => handleAbrirCompatibilidades(p)}
                              className="ui-icon-btn p-1.5 rounded-lg text-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                              title="Compatibilidade Técnica (produto_maquina)"
                              aria-label="Compatibilidade técnica"
                            >
                              <Wrench aria-hidden="true" className="w-4 h-4" />
                            </button>

                            {/* Editar Peça */}
                            <button
                              type="button"
                              onClick={() => handleEditarProduto(p)}
                              className="ui-icon-btn p-1.5 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors cursor-pointer"
                              title="Editar Peça"
                              aria-label="Editar peça"
                            >
                              <Edit2 aria-hidden="true" className="w-4 h-4" />
                            </button>

                            {/* Ativar / Inativar Peça (Fase 1 e 10) */}
                            <button
                              type="button"
                              onClick={() => handleAbrirConfirmacaoStatus(p)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${p.ativo
                                  ? 'text-muted hover:text-danger hover:bg-danger/10'
                                  : 'text-subtle hover:text-ink hover:bg-ink/5'
                                }`}
                              title={p.ativo ? 'Inativar peça' : 'Ativar peça'}
                              aria-label={p.ativo ? 'Inativar peça' : 'Ativar peça'}
                            >
                              <Power aria-hidden="true" className="w-4 h-4" />
                            </button>
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
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-line bg-canvas/40 text-xs">
              <span className="text-muted">
                Mostrando <strong className="text-ink">{produtos.length}</strong> de{' '}
                <strong className="text-ink">{totalElements}</strong> registros
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={page === 0}
                  className="ui-icon-btn p-1.5 rounded-lg border border-line text-muted hover:text-ink hover:bg-elevated disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Página anterior"
                  aria-label="Página anterior"
                >
                  <ChevronLeft aria-hidden="true" className="w-4 h-4" />
                </button>
                <span className="text-ink font-semibold px-2 text-xs">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="ui-icon-btn p-1.5 rounded-lg border border-line text-muted hover:text-ink hover:bg-elevated disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Próxima página"
                  aria-label="Próxima página"
                >
                  <ChevronRight aria-hidden="true" className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* =================================================================== */}
      {/* MODAL DE CONFIRMAÇÃO VISUAL DE STATUS (ConfirmModal) */}
      {/* =================================================================== */}
      <ConfirmModal
        isOpen={!!produtoParaAlternarStatus}
        title={produtoParaAlternarStatus?.ativo ? 'Inativar Peça / Produto' : 'Reativar Peça / Produto'}
        message={
          produtoParaAlternarStatus
            ? `Deseja realmente ${produtoParaAlternarStatus.ativo ? 'inativar' : 'reativar'} a peça "${produtoParaAlternarStatus.nome}" (${produtoParaAlternarStatus.codigo})?${produtoParaAlternarStatus.ativo ? ' Ela deixará de aparecer nas buscas padrão de novas Ordens de Serviço.' : ''}`
            : ''
        }
        confirmText={produtoParaAlternarStatus?.ativo ? 'Confirmar Inativação' : 'Confirmar Ativação'}
        cancelText="Cancelar"
        isDestructive={!!produtoParaAlternarStatus?.ativo}
        isLoading={isSubmittingStatus}
        onConfirm={handleConfirmarStatus}
        onCancel={() => setProdutoParaAlternarStatus(null)}
      />

      {/* Modal de Cadastro / Edição de Produto */}
      <ProdutoModal
        isOpen={modalProdutoOpen}
        produto={produtoEditando}
        fornecedores={fornecedores}
        categorias={categorias}
        onClose={() => setModalProdutoOpen(false)}
        onSuccess={() => {
          setModalProdutoOpen(false);
          setStatusToast({
            tipo: 'sucesso',
            mensagem: produtoEditando
              ? 'Peça atualizada com sucesso!'
              : 'Nova peça cadastrada com sucesso!',
          });
          setTimeout(() => setStatusToast(null), 3000);
          carregarProdutos();
        }}
      />

      {/* Modal de Compatibilidade */}
      <CompatibilidadeModal
        isOpen={modalCompatibilidadeOpen}
        produto={produtoCompatibilidade}
        onClose={() => setModalCompatibilidadeOpen(false)}
      />

      {/* Modal de Movimentação de Estoque In-Place (Fase 7) */}
      <MovimentacaoEstoqueModal
        isOpen={modalMovimentacaoOpen}
        produto={produtoMovimentacao}
        onClose={() => setModalMovimentacaoOpen(false)}
        onSuccess={() => {
          setModalMovimentacaoOpen(false);
          setStatusToast({
            tipo: 'sucesso',
            mensagem: 'Movimentação de estoque registrada com sucesso!',
          });
          setTimeout(() => setStatusToast(null), 3000);
          carregarProdutos();
        }}
      />
    </div>
  );
}
