'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  Wrench,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Power,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import Header from '@/components/Header';
import ProdutoModal from '@/components/ProdutoModal';
import CompatibilidadeModal from '@/components/CompatibilidadeModal';
import {
  CurrentUser,
  Produto,
  Fornecedor,
  TipoProduto,
  TIPO_PRODUTO_LABELS,
} from '@/lib/types';
import { apiFetch, apiFetchJson, formatarMoeda } from '@/lib/api';

export default function ProdutosPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [termo, setTermo] = useState('');
  const [tipo, setTipo] = useState<string>('');
  const [estoqueBaixo, setEstoqueBaixo] = useState(false);
  const [status, setStatus] = useState<string>('true');

  // Paginação
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);

  // Modais
  const [modalProdutoOpen, setModalProdutoOpen] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [modalCompatibilidadeOpen, setModalCompatibilidadeOpen] = useState(false);
  const [produtoCompatibilidade, setProdutoCompatibilidade] = useState<Produto | null>(null);

  const carregarUsuario = useCallback(async () => {
    try {
      const u = await apiFetchJson<CurrentUser>('/api/auth/me');
      setUser(u);
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
    carregarUsuario();
    carregarFornecedores();
  }, [carregarUsuario, carregarFornecedores]);

  const carregarProdutos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        size: '15',
      });
      if (termo.trim()) params.append('termo', termo.trim());
      if (tipo) params.append('tipo', tipo);
      if (estoqueBaixo) params.append('estoqueBaixo', 'true');
      if (status !== 'todos') params.append('ativo', status);

      const res = await apiFetchJson<{
        content: Produto[];
        totalPages: number;
        totalElements: number;
      }>(`/api/produtos?${params.toString()}`);

      setProdutos(res.content || []);
      setTotalPages(res.totalPages || 0);
      setTotalElements(res.totalElements || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar catálogo de produtos';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, termo, tipo, estoqueBaixo, status]);

  useEffect(() => {
    carregarProdutos();
  }, [carregarProdutos]);

  const handleToggleStatus = async (produto: Produto) => {
    const acao = produto.ativo ? 'inativar' : 'ativar';
    if (!confirm(`Deseja realmente ${acao} a peça/produto '${produto.nome}'?`)) {
      return;
    }

    try {
      await apiFetch(`/api/produtos/${produto.id}/status`, { method: 'PATCH' });
      carregarProdutos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Erro ao ${acao} produto`;
      alert(msg);
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm">
                <Package className="w-6 h-6" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Peças, Componentes & Produtos
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              Controle de peças técnicas de reposição para máquinas de solda e geradores elétricos
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/estoque"
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all shadow-sm"
            >
              <Boxes className="w-4 h-4 text-amber-400" />
              <span>Painel de Estoque</span>
            </Link>

            <button
              id="novo-produto-btn"
              onClick={handleNovoProduto}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Peça / Produto</span>
            </button>
          </div>
        </div>

        {/* Toolbar de Filtros */}
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
                placeholder="Buscar código, nome ou barras..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
              />
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            {/* Filtro por Tipo */}
            <div className="relative">
              <select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value);
                  setPage(0);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="">Todos os tipos</option>
                <option value="PECA">Peças / Componentes</option>
                <option value="CONSUMIVEL">Consumíveis</option>
                <option value="PRODUTO">Produtos Acabados</option>
                <option value="SERVICO">Serviços</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            {/* Status Ativo/Inativo */}
            <div>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(0);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
              >
                <option value="true">Somente Ativos</option>
                <option value="false">Somente Inativos</option>
                <option value="todos">Todos os Registros</option>
              </select>
            </div>

            {/* Checkbox de Estoque Baixo */}
            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={estoqueBaixo}
                  onChange={(e) => {
                    setEstoqueBaixo(e.target.checked);
                    setPage(0);
                  }}
                  className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500/20 h-4 w-4"
                />
                <span className="flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Apenas estoque baixo / crítico</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Mensagem de Erro se houver */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Tabela de Produtos */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-3.5 px-4">Código / SKU</th>
                  <th className="py-3.5 px-4">Nome & Especificação</th>
                  <th className="py-3.5 px-4">Tipo</th>
                  <th className="py-3.5 px-4 text-right">Preço Venda</th>
                  <th className="py-3.5 px-4 text-center">Estoque Atual</th>
                  <th className="py-3.5 px-4">Fornecedor</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando catálogo de peças...</span>
                      </div>
                    </td>
                  </tr>
                ) : produtos.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p>Nenhuma peça ou produto encontrado com os filtros aplicados.</p>
                    </td>
                  </tr>
                ) : (
                  produtos.map((p) => {
                    const isCritico = p.estoqueAtual <= p.estoqueMinimo;
                    const isZerado = p.estoqueAtual === 0;

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Código */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[11px]">
                            {p.codigo}
                          </span>
                          {p.codigoBarras && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              {p.codigoBarras}
                            </span>
                          )}
                        </td>

                        {/* Nome & Descrição */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-white group-hover:text-amber-300 transition-colors block">
                            {p.nome}
                          </span>
                          {p.descricao && (
                            <span className="text-[11px] text-slate-400 line-clamp-1">
                              {p.descricao}
                            </span>
                          )}
                          {p.localizacao && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 mt-0.5">
                              <span>📍 {p.localizacao}</span>
                            </span>
                          )}
                        </td>

                        {/* Tipo */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {p.tipoDescricao || TIPO_PRODUTO_LABELS[p.tipo]}
                          </span>
                        </td>

                        {/* Preço de Venda */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="font-bold text-white">
                            {formatarMoeda(p.precoVenda)}
                          </span>
                          {p.precoCusto > 0 && (
                            <span className="block text-[10px] text-slate-500">
                              Custo: {formatarMoeda(p.precoCusto)}
                            </span>
                          )}
                        </td>

                        {/* Estoque */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
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
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            Mín: {p.estoqueMinimo}
                          </span>
                        </td>

                        {/* Fornecedor */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                          {p.fornecedorNome || '-'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              p.ativo
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}
                          >
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleAbrirCompatibilidades(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors cursor-pointer"
                              title="Compatibilidade com Equipamentos (produto_maquina)"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleEditarProduto(p)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Editar Peça"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleToggleStatus(p)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                p.ativo
                                  ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                                  : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                              }`}
                              title={p.ativo ? 'Inativar peça' : 'Ativar peça'}
                            >
                              <Power className="w-4 h-4" />
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs">
              <span className="text-slate-400">
                Total de <strong className="text-white">{totalElements}</strong> registros
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

      {/* Modal de Cadastro / Edição de Produto */}
      <ProdutoModal
        isOpen={modalProdutoOpen}
        produto={produtoEditando}
        fornecedores={fornecedores}
        onClose={() => setModalProdutoOpen(false)}
        onSuccess={() => {
          setModalProdutoOpen(false);
          carregarProdutos();
        }}
      />

      {/* Modal de Compatibilidade */}
      <CompatibilidadeModal
        isOpen={modalCompatibilidadeOpen}
        produto={produtoCompatibilidade}
        onClose={() => setModalCompatibilidadeOpen(false)}
      />
    </div>
  );
}
