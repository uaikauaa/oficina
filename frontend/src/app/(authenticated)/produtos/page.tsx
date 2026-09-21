'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { apiFetch, apiFetchJson, formatarMoeda } from '@/lib/api';

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shrink-0">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
                  Peças & Produtos
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 border border-slate-800 text-slate-400">
                  {totalElements} {totalElements === 1 ? 'item' : 'itens'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Catálogo técnico de componentes de reposição e controle de estoque
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/estoque"
              className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm"
              title="Acessar painel consolidado de estoque"
            >
              <Boxes className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Painel de Estoque</span>
              <span className="sm:hidden">Estoque</span>
            </Link>

            <button
              id="novo-produto-btn"
              onClick={handleNovoProduto}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ NOVA PEÇA / PRODUTO</span>
            </button>
          </div>
        </div>

        {/* Toast Notificação de Feedback */}
        {statusToast && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 duration-200 ${
              statusToast.tipo === 'sucesso'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusToast.tipo === 'sucesso' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusToast.mensagem}</span>
            </div>
            <button
              onClick={() => setStatusToast(null)}
              className="p-1 hover:opacity-70 text-slate-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* =================================================================== */}
        {/* TOOLBAR COMPACTA: BUSCA + PILLS + MAIS FILTROS (Fases 4, 5 e 6) */}
        {/* =================================================================== */}
        <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md space-y-3 shadow-lg">
          {/* Linha de Busca Principal e Botão de Filtros Avançados */}
          <div className="flex items-center gap-2">
            {/* Campo de Busca com Debounce 400ms e Botão [✕] */}
            <div className="relative flex-1">
              <input
                type="text"
                value={termoInput}
                onChange={(e) => setTermoInput(e.target.value)}
                placeholder="Buscar por código, nome, marca, SKU ou localização (📍)..."
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
              {termoInput && (
                <button
                  type="button"
                  onClick={() => setTermoInput('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white transition-colors cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botão [Mais Filtros ▾] (Recolhível) */}
            <button
              type="button"
              onClick={() => setFiltrosAvancadosAbertos((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                filtrosAvancadosAbertos || categoriaId || fornecedorId
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {filtrosAvancadosAbertos ? 'Menos Filtros' : 'Mais Filtros'}
              </span>
              {(categoriaId || fornecedorId) && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                  {(categoriaId ? 1 : 0) + (fornecedorId ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Botão Limpar Filtros quando houver filtro ativo */}
            {temFiltrosAtivos && (
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer shrink-0"
                title="Limpar todos os filtros aplicados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Limpar</span>
              </button>
            )}
          </div>

          {/* Painel Retrátil de Filtros Avançados (Fase 6) */}
          {filtrosAvancadosAbertos && (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
              {/* Categoria */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Filtrar por Categoria:
                </label>
                <select
                  value={categoriaId}
                  onChange={(e) => {
                    setCategoriaId(e.target.value);
                    setPage(0);
                  }}
                  disabled={loadingFiltrosAuxiliares}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
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
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Filtrar por Fornecedor:
                </label>
                <select
                  value={fornecedorId}
                  onChange={(e) => {
                    setFornecedorId(e.target.value);
                    setPage(0);
                  }}
                  disabled={loadingFiltrosAuxiliares}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50"
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
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/50">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
              {/* Pill Todas */}
              <button
                type="button"
                onClick={() => {
                  setPillAtiva('TODAS');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  pillAtiva === 'TODAS'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                Todas
              </button>

              {/* Pill Peças */}
              <button
                type="button"
                onClick={() => {
                  setPillAtiva('PECA');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                  pillAtiva === 'PECA'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span>⚡</span>
                <span>Peças / Componentes</span>
              </button>

              {/* Pill Consumíveis */}
              <button
                type="button"
                onClick={() => {
                  setPillAtiva('CONSUMIVEL');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                  pillAtiva === 'CONSUMIVEL'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span>🔋</span>
                <span>Consumíveis</span>
              </button>

              {/* Pill Produtos */}
              <button
                type="button"
                onClick={() => {
                  setPillAtiva('PRODUTO');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                  pillAtiva === 'PRODUTO'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
              >
                <span>📦</span>
                <span>Produtos</span>
              </button>

              {/* Pill Estoque Crítico */}
              <button
                type="button"
                onClick={() => {
                  setPillAtiva('CRITICO');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                  pillAtiva === 'CRITICO'
                    ? 'bg-rose-500 text-white border-rose-400 shadow-sm'
                    : 'bg-slate-950 text-rose-400 border-slate-800 hover:border-rose-500/40'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
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
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  somenteAtivos
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title={somenteAtivos ? 'Exibindo apenas ativas (clique para ver todas)' : 'Exibindo ativas e inativas'}
              >
                {somenteAtivos ? '✓ Somente Ativas' : 'Todas as Situações'}
              </button>
            </div>
          </div>

          {/* Chip de Feedback de Filtro Ativo (Fase 11) */}
          {temFiltrosAtivos && (
            <div className="flex items-center justify-between p-2 px-3 rounded-xl bg-slate-950 border border-amber-500/30 text-xs">
              <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
                <span className="text-slate-400 shrink-0">Filtrando por:</span>
                <span className="font-bold text-amber-300 truncate">{descricaoFiltroAtivo}</span>
                <span className="text-slate-500 shrink-0">({totalElements} encontrados)</span>
              </div>
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="text-slate-400 hover:text-amber-400 transition-colors p-0.5 ml-2 cursor-pointer shrink-0"
                title="Remover todos os filtros"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Mensagem de Erro Geral se houver */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* =================================================================== */}
        {/* TABELA OPERACIONAL COMPACTA (Fases 7 e 13 — 1366x768 @ 125%) */}
        {/* =================================================================== */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-2.5 px-3.5">Código / SKU</th>
                  <th className="py-2.5 px-3.5">Peça & Marca</th>
                  <th className="py-2.5 px-3.5">Tipo / Categoria</th>
                  <th className="py-2.5 px-3.5">Localização</th>
                  <th className="py-2.5 px-3.5 text-right">Preço</th>
                  <th className="py-2.5 px-3.5 text-center">Estoque</th>
                  <th className="py-2.5 px-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                        <span>Carregando catálogo de peças...</span>
                      </div>
                    </td>
                  </tr>
                ) : produtos.length === 0 ? (
                  /* Estados Vazios Contextuais (Fase 11) */
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <div className="max-w-md mx-auto space-y-3">
                        <Package className="w-9 h-9 text-slate-600 mx-auto" />
                        {temFiltrosAtivos ? (
                          <>
                            <p className="font-semibold text-slate-300">
                              Nenhuma peça ou produto encontrado para os filtros aplicados.
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Tente buscar por outro termo ou limpar os filtros para ver todo o catálogo.
                            </p>
                            <button
                              type="button"
                              onClick={limparTodosFiltros}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                            >
                              ✕ Limpar Filtros
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-300">
                              Nenhuma peça ou produto cadastrado no catálogo.
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Cadastre novos componentes técnicos para movimentar o estoque e abastecer ordens de serviço.
                            </p>
                            <button
                              type="button"
                              onClick={handleNovoProduto}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer"
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
                        className={`hover:bg-slate-800/40 transition-colors group ${
                          !p.ativo ? 'opacity-60 bg-slate-950/40' : ''
                        }`}
                      >
                        {/* Código / SKU */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[11px]">
                            {p.codigo}
                          </span>
                          {p.codigoBarras && (
                            <span className="block font-mono text-[10px] text-slate-500 mt-0.5">
                              {p.codigoBarras}
                            </span>
                          )}
                        </td>

                        {/* Nome & Marca */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white group-hover:text-amber-300 transition-colors">
                              {p.nome}
                            </span>
                            {p.marca && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-800 text-amber-400/90 border border-amber-500/20">
                                {p.marca}
                              </span>
                            )}
                          </div>
                          {p.descricao && (
                            <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {p.descricao}
                            </span>
                          )}
                        </td>

                        {/* Tipo & Categoria */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-300 text-[11px]">
                              {p.tipo === 'PECA' && '⚡ Peça'}
                              {p.tipo === 'CONSUMIVEL' && '🔋 Consumível'}
                              {p.tipo === 'PRODUTO' && '📦 Produto'}
                              {p.tipo === 'SERVICO' && '🛠️ Serviço'}
                            </span>
                            {p.categoriaNome ? (
                              <span className="text-[10px] text-indigo-400 flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />
                                <span>{p.categoriaNome}</span>
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-600">-</span>
                            )}
                          </div>
                        </td>

                        {/* Localização */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-400 text-[11px]">
                          {p.localizacao ? (
                            <span className="inline-flex items-center gap-1 text-slate-300">
                              <MapPin className="w-3 h-3 text-amber-500/80" />
                              <span>{p.localizacao}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Preço de Venda */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <span className="font-bold text-white">
                            {formatarMoeda(p.precoVenda)}
                          </span>
                          {p.precoCusto > 0 && (
                            <span className="block text-[10px] text-slate-500">
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
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                              isZerado
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                                : isCritico
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                          >
                            <span>{p.estoqueAtual}</span>
                            <span className="text-[10px] font-normal opacity-80">
                              {p.unidadeMedida}
                            </span>
                          </button>
                          <span className="block text-[10px] text-slate-500 mt-0.5">
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
                              className="px-2 py-1 rounded-lg text-slate-300 hover:text-amber-400 bg-slate-800/80 hover:bg-amber-500/10 border border-slate-700/80 hover:border-amber-500/30 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="Registrar entrada, saída ou ajuste de estoque (sem sair da tela)"
                            >
                              <Boxes className="w-3.5 h-3.5 text-amber-400" />
                              <span>± Estoque</span>
                            </button>

                            {/* Compatibilidade com Máquinas */}
                            <button
                              type="button"
                              onClick={() => handleAbrirCompatibilidades(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                              title="Compatibilidade Técnica (produto_maquina)"
                              aria-label="Compatibilidade técnica"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </button>

                            {/* Editar Peça */}
                            <button
                              type="button"
                              onClick={() => handleEditarProduto(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Editar Peça"
                              aria-label="Editar peça"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Ativar / Inativar Peça (Fase 1 e 10) */}
                            <button
                              type="button"
                              onClick={() => handleAbrirConfirmacaoStatus(p)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                p.ativo
                                  ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                                  : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={p.ativo ? 'Inativar peça' : 'Ativar peça'}
                              aria-label={p.ativo ? 'Inativar peça' : 'Ativar peça'}
                            >
                              <Power className="w-3.5 h-3.5" />
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
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800/80 bg-slate-950/40 text-xs">
              <span className="text-slate-400">
                Mostrando <strong className="text-white">{produtos.length}</strong> de{' '}
                <strong className="text-white">{totalElements}</strong> registros
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Página anterior"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-300 font-semibold px-2 text-[11px]">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, totalPages - 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  title="Próxima página"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="w-4 h-4" />
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
