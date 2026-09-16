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
} from 'lucide-react';
import Header from '@/components/Header';
import MovimentacaoEstoqueModal from '@/components/MovimentacaoEstoqueModal';
import { CurrentUser, Produto, EstoqueResumo, Categoria, Fornecedor } from '@/lib/types';
import { apiFetchJson, formatarMoeda } from '@/lib/api';

export default function EstoquePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [resumo, setResumo] = useState<EstoqueResumo | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [termo, setTermo] = useState('');
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

  const carregarUsuario = useCallback(async () => {
    try {
      const u = await apiFetchJson<CurrentUser>('/api/auth/me');
      setUser(u);
    } catch {
      // Ignora erro
    }
  }, []);

  const carregarResumo = useCallback(async () => {
    try {
      const r = await apiFetchJson<EstoqueResumo>('/api/estoque/resumo');
      setResumo(r);
    } catch {
      // Ignora erro
    }
  }, []);

  const carregarCategorias = useCallback(async () => {
    try {
      const data = await apiFetchJson<Categoria[]>('/api/categorias/ativas');
      setCategorias(data || []);
    } catch {
      // Ignora erro
    }
  }, []);

  const carregarFornecedores = useCallback(async () => {
    try {
      const data = await apiFetchJson<{ content: Fornecedor[] }>('/api/fornecedores?size=100');
      setFornecedores(data.content || []);
    } catch {
      // Ignora erro
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarUsuario();
      carregarResumo();
      carregarCategorias();
      carregarFornecedores();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarUsuario, carregarResumo, carregarCategorias, carregarFornecedores]);

  const carregarProdutos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: '15',
        ativo: 'true',
      });
      if (termo.trim()) params.append('termo', termo.trim());
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

      let list = res.content || [];
      if (filtroNivel === 'ZERADO') {
        list = list.filter((p) => p.estoqueAtual === 0);
      } else if (filtroNivel === 'CRITICO') {
        list = list.filter((p) => p.estoqueAtual > 0 && p.estoqueAtual <= p.estoqueMinimo);
      }

      setProdutos(list);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar saldo de estoque';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, termo, categoriaId, fornecedorId, filtroNivel]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                <Boxes className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Controle de Estoque & Saldos
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Acompanhamento de inventário físico, pontos de pedido e movimentações atômicas
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/estoque/movimentacoes"
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all shadow-sm"
            >
              <History className="w-4 h-4 text-cyan-400" />
              <span>Histórico de Movimentações</span>
            </Link>

            <button
              id="nova-movimentacao-btn"
              onClick={() => handleAbrirMovimentacao()}
              disabled={produtos.length === 0}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Registrar Movimentação</span>
            </button>
          </div>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total de Itens */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Total de Peças Ativas</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-white">
                {resumo?.totalProdutos ?? 0}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">itens cadastrados</span>
            </div>
          </div>

          {/* Estoque Baixo */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Estoque Crítico (Baixo)</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-amber-400">
                {resumo?.itensEstoqueBaixo ?? 0}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">abaixo do estoque mínimo</span>
            </div>
          </div>

          {/* Sem Estoque */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Zerados / Sem Estoque</span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <XCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-rose-400">
                {resumo?.itensSemEstoque ?? 0}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">necessita reposição urgente</span>
            </div>
          </div>

          {/* Valor Total do Estoque */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">Valorização Total</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-bold text-emerald-400">
                {formatarMoeda(resumo?.valorTotalEstoque ?? 0)}
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">calculado a preço de custo</span>
            </div>
          </div>
        </div>

        {/* Toolbar de Busca e Filtros */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Campo de Busca Textual */}
            <div className="relative">
              <input
                type="text"
                value={termo}
                onChange={(e) => {
                  setTermo(e.target.value);
                  setPage(0);
                }}
                placeholder="Buscar por código, nome ou marca..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Filtro por Categoria */}
            <div>
              <select
                value={categoriaId}
                onChange={(e) => {
                  setCategoriaId(e.target.value);
                  setPage(0);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="">Todas as categorias</option>
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
                onChange={(e) => {
                  setFornecedorId(e.target.value);
                  setPage(0);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="">Todos os fornecedores</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.razaoSocial || f.nomeFantasia}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Nível de Estoque */}
            <div>
              <select
                value={filtroNivel}
                onChange={(e) => {
                  setFiltroNivel(e.target.value as 'TODOS' | 'CRITICO' | 'ZERADO');
                  setPage(0);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="TODOS">Todos os saldos</option>
                <option value="CRITICO">Apenas estoque crítico (&le; mín)</option>
                <option value="ZERADO">Apenas estoque zerado (= 0)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Tabela de Saldos de Estoque */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-3.5 px-4">Peça / Componente</th>
                  <th className="py-3.5 px-4">Categoria</th>
                  <th className="py-3.5 px-4">Localização</th>
                  <th className="py-3.5 px-4 text-center">Nível Físico</th>
                  <th className="py-3.5 px-4 text-center">Saldo Atual</th>
                  <th className="py-3.5 px-4 text-center">Estoque Mínimo</th>
                  <th className="py-3.5 px-4 text-right">Valor em Estoque</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando saldos em estoque...</span>
                      </div>
                    </td>
                  </tr>
                ) : produtos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <Boxes className="w-8 h-8 text-slate-600 mx-auto mb-2" />
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
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Peça & Marca */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[11px]">
                              {p.codigo}
                            </span>
                            <span className="font-bold text-white group-hover:text-amber-300 transition-colors">
                              {p.nome}
                            </span>
                            {p.marca && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-amber-400 border border-amber-500/20">
                                {p.marca}
                              </span>
                            )}
                          </div>
                          {p.fornecedorNome && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              Fornecedor: {p.fornecedorNome}
                            </span>
                          )}
                        </td>

                        {/* Categoria */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {p.categoriaNome ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                              {p.categoriaNome}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">-</span>
                          )}
                        </td>

                        {/* Localização */}
                        <td className="py-3.5 px-4 text-slate-300">
                          {p.localizacao ? (
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              <span>{p.localizacao}</span>
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>

                        {/* Barra de Nível Físico */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="w-32 mx-auto space-y-1">
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div
                                className={`h-full transition-all rounded-full ${
                                  isZerado
                                    ? 'bg-rose-500'
                                    : isCritico
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500 block">
                              {isZerado ? 'Esgotado' : isCritico ? 'Crítico' : 'Normal'}
                            </span>
                          </div>
                        </td>

                        {/* Saldo Atual */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold border ${
                              isZerado
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : isCritico
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            }`}
                          >
                            <span>{p.estoqueAtual}</span>
                            <span className="text-[10px] font-normal opacity-80">
                              {p.unidadeMedida}
                            </span>
                          </span>
                        </td>

                        {/* Estoque Mínimo */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap text-slate-400 font-semibold">
                          {p.estoqueMinimo} {p.unidadeMedida}
                        </td>

                        {/* Valor Investido */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="font-bold text-white">
                            {formatarMoeda(valorInvestido)}
                          </span>
                          <span className="block text-[10px] text-slate-500">
                            Unit: {formatarMoeda(p.precoCusto)}
                          </span>
                        </td>

                        {/* Ação */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleAbrirMovimentacao(p)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Ajustar saldo, registrar compra ou descarte"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                            <span>Movimentar</span>
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs">
              <span className="text-slate-400">
                Total de <strong className="text-white">{totalElements}</strong> itens
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
                  disabled={page === 0}
                  className="p-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-slate-300 font-semibold px-2">
                  Página {page + 1} de {totalPages}
                </span>
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
