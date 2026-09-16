'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Search,
  Plus,
  Clock,
  Wrench,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Zap,
} from 'lucide-react';
import Header from '@/components/Header';
import {
  CurrentUser,
  OrdemServico,
  PageResponse,
  STATUS_ORDEM_SERVICO_BADGES,
  STATUS_ORDEM_SERVICO_LABELS,
} from '@/lib/types';
import { apiFetch, formatarMoeda, formatarDataHora } from '@/lib/api';

export default function OrdensServicoPage() {
  const router = useRouter();

  // Estados de Usuário e Autenticação
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  // Estados de Dados e Paginação
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [page, setPage] = useState(0);
  const [size] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Estados de Filtros
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [periodoAtivo, setPeriodoAtivo] = useState<'30' | '90' | 'ano' | 'tudo' | 'custom'>('tudo');

  const definirPeriodo = (tipo: '30' | '90' | 'ano' | 'tudo') => {
    setPeriodoAtivo(tipo);
    const hoje = new Date();
    if (tipo === 'tudo') {
      setDataInicio('');
      setDataFim('');
    } else if (tipo === '30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(hoje.toISOString().split('T')[0]);
    } else if (tipo === '90') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(hoje.toISOString().split('T')[0]);
    } else if (tipo === 'ano') {
      const d = new Date(hoje.getFullYear(), 0, 1);
      setDataInicio(d.toISOString().split('T')[0]);
      setDataFim(hoje.toISOString().split('T')[0]);
    }
    setPage(0);
  };

  // Contadores rápidos
  const [metricas, setMetricas] = useState({
    total: 0,
    abertas: 0,
    emManutencao: 0,
    prontas: 0,
    concluidas: 0,
  });

  // Debounce do termo de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setTermoDebounced(termo);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [termo]);

  // Carrega Usuário da Sessão
  useEffect(() => {
    let ignore = false;
    async function loadUser() {
      try {
        const res = await apiFetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (!ignore) {
          setCurrentUser(data);
          setIsLoadingUser(false);
        }
      } catch {
        router.push('/login');
      }
    }
    loadUser();
    return () => {
      ignore = true;
    };
  }, [router]);

  // Busca as Ordens de Serviço
  const fetchOrdens = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('size', size.toString());

      if (termoDebounced.trim()) {
        params.append('termo', termoDebounced.trim());
      }
      if (statusFiltro) {
        params.append('status', statusFiltro);
      }
      if (dataInicio) {
        params.append('dataInicio', new Date(dataInicio).toISOString());
      }
      if (dataFim) {
        // Final do dia
        const dtFim = new Date(dataFim);
        dtFim.setHours(23, 59, 59, 999);
        params.append('dataFim', dtFim.toISOString());
      }

      const res = await apiFetch(`/api/ordens-servico?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Falha ao carregar as Ordens de Serviço');
      }

      const data: PageResponse<OrdemServico> = await res.json();
      setOrdens(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar Ordens de Serviço.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, size, termoDebounced, statusFiltro, dataInicio, dataFim]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoadingUser) {
        fetchOrdens();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchOrdens, isLoadingUser]);

  // Carrega contadores globais rápidos
  useEffect(() => {
    let ignore = false;
    async function carregarMetricas() {
      try {
        const [resTot, resAberta, resManut, resPronta, resConc] = await Promise.all([
          apiFetch('/api/ordens-servico?size=1'),
          apiFetch('/api/ordens-servico?status=ABERTA&size=1'),
          apiFetch('/api/ordens-servico?status=EM_MANUTENCAO&size=1'),
          apiFetch('/api/ordens-servico?status=PRONTA&size=1'),
          apiFetch('/api/ordens-servico?status=CONCLUIDA&size=1'),
        ]);

        if (resTot.ok && !ignore) {
          const dTot = await resTot.json();
          const dAberta = resAberta.ok ? await resAberta.json() : { totalElements: 0 };
          const dManut = resManut.ok ? await resManut.json() : { totalElements: 0 };
          const dPronta = resPronta.ok ? await resPronta.json() : { totalElements: 0 };
          const dConc = resConc.ok ? await resConc.json() : { totalElements: 0 };

          setMetricas({
            total: dTot.totalElements || 0,
            abertas: dAberta.totalElements || 0,
            emManutencao: dManut.totalElements || 0,
            prontas: dPronta.totalElements || 0,
            concluidas: dConc.totalElements || 0,
          });
        }
      } catch {
        // Métricas opcionais
      }
    }
    if (!isLoadingUser) {
      carregarMetricas();
    }
    return () => {
      ignore = true;
    };
  }, [isLoadingUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                Fluxo Técnico Central
              </span>
              <span className="text-xs text-slate-500">Fase 5</span>
            </div>
            <h1 className="text-2xl font-black text-white mt-1 flex items-center gap-2.5">
              <FileText className="w-7 h-7 text-amber-500" />
              Ordens de Serviço
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Controle completo do atendimento: entrada, diagnóstico, testes de bancada e faturamento.
            </p>
          </div>

          <Link
            href="/ordens-servico/nova"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Ordem de Serviço</span>
          </Link>
        </div>

        {/* Cards de Métricas Operacionais */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <div
            onClick={() => {
              setStatusFiltro('');
              setPage(0);
            }}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFiltro === ''
                ? 'bg-slate-900 border-amber-500/50 shadow-md shadow-amber-500/5'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <span className="text-xs text-slate-400 font-medium">Total de OS</span>
            <p className="text-xl sm:text-2xl font-black text-white mt-1">{metricas.total}</p>
          </div>

          <div
            onClick={() => {
              setStatusFiltro('ABERTA');
              setPage(0);
            }}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFiltro === 'ABERTA'
                ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-500/5'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-400 font-medium">Abertas</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-400 mt-1">{metricas.abertas}</p>
          </div>

          <div
            onClick={() => {
              setStatusFiltro('EM_MANUTENCAO');
              setPage(0);
            }}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFiltro === 'EM_MANUTENCAO'
                ? 'bg-blue-950/20 border-blue-500/50 shadow-md shadow-blue-500/5'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-400 font-medium">Em Manutenção</span>
              <Wrench className="w-4 h-4 text-blue-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-blue-400 mt-1">{metricas.emManutencao}</p>
          </div>

          <div
            onClick={() => {
              setStatusFiltro('PRONTA');
              setPage(0);
            }}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFiltro === 'PRONTA'
                ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md shadow-emerald-500/5'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-emerald-400 font-medium">Prontas (Testadas)</span>
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-1">{metricas.prontas}</p>
          </div>

          <div
            onClick={() => {
              setStatusFiltro('CONCLUIDA');
              setPage(0);
            }}
            className={`p-4 rounded-xl border transition-all cursor-pointer col-span-2 lg:col-span-1 ${
              statusFiltro === 'CONCLUIDA'
                ? 'bg-green-950/20 border-green-500/50 shadow-md shadow-green-500/5'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-green-400 font-medium">Concluídas</span>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-green-400 mt-1">{metricas.concluidas}</p>
          </div>
        </div>

        {/* Barra de Filtros e Pesquisa */}
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Campo de Busca Livre (OS, Cliente, CPF/CNPJ, Equipamento, Nº Série) */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Buscar por Nº da OS, cliente, CPF/CNPJ, equipamento ou nº de série..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
              />
            </div>

            {/* Filtro por Status */}
            <div className="sm:col-span-4">
              <select
                value={statusFiltro}
                onChange={(e) => {
                  setStatusFiltro(e.target.value);
                  setPage(0);
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all cursor-pointer"
              >
                <option value="">Todos os Status</option>
                {Object.entries(STATUS_ORDEM_SERVICO_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Limpar Filtros */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setTermo('');
                  setStatusFiltro('');
                  setDataInicio('');
                  setDataFim('');
                  setPeriodoAtivo('tudo');
                  setPage(0);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Atalhos Rápidos de Período */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 font-medium">Período:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => definirPeriodo('tudo')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    periodoAtivo === 'tudo'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => definirPeriodo('30')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    periodoAtivo === '30'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Últimos 30 dias
                </button>
                <button
                  type="button"
                  onClick={() => definirPeriodo('90')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    periodoAtivo === '90'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Últimos 90 dias
                </button>
                <button
                  type="button"
                  onClick={() => definirPeriodo('ano')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    periodoAtivo === 'ano'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Este Ano
                </button>
              </div>
            </div>

            {/* Inputs de Data Personalizada */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setPeriodoAtivo('custom');
                  setPage(0);
                }}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/40"
              />
              <span className="text-slate-500">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setPeriodoAtivo('custom');
                  setPage(0);
                }}
                className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-amber-500/40"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Ordens de Serviço */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-medium">Carregando ordens de serviço...</span>
            </div>
          ) : errorMessage ? (
            <div className="p-8 text-center text-red-400 text-sm flex items-center justify-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{errorMessage}</span>
            </div>
          ) : ordens.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-slate-600" />
              <p className="text-sm font-semibold text-white">Nenhuma Ordem de Serviço encontrada</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tente ajustar os filtros de busca ou abra uma nova Ordem de Serviço para iniciar o atendimento.
              </p>
              <Link
                href="/ordens-servico/nova"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Abrir Primeira OS</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Nº da OS</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Equipamento</th>
                    <th className="py-3 px-4">Data Entrada</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Valor Total</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {ordens.map((os) => {
                    const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                      bg: 'bg-slate-800',
                      text: 'text-slate-300',
                      border: 'border-slate-700',
                    };

                    return (
                      <tr
                        key={os.id}
                        className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/ordens-servico/${os.id}`)}
                      >
                        {/* Número da OS */}
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                            {os.numeroOs}
                          </span>
                        </td>

                        {/* Cliente */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                            {os.clienteNome}
                          </div>
                          {os.clienteTelefone && (
                            <span className="text-[11px] text-slate-500">{os.clienteTelefone}</span>
                          )}
                        </td>

                        {/* Equipamento */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-200">
                            {os.maquinaMarca} {os.maquinaModelo}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <span>{os.maquinaTipoDescricao}</span>
                            {os.maquinaNumeroSerie && (
                              <>
                                <span>•</span>
                                <span className="font-mono">Série: {os.maquinaNumeroSerie}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Data de Entrada */}
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatarDataHora(os.dataEntrada)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {os.statusDescricao}
                          </span>
                        </td>

                        {/* Valor Total */}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-100">
                          {formatarMoeda(os.valorTotal)}
                        </td>

                        {/* Ações */}
                        <td
                          className="py-3.5 px-4 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Link
                            href={`/ordens-servico/${os.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 text-xs font-semibold border border-slate-700 transition-all"
                          >
                            <span>Detalhes</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="p-3.5 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
              <span>
                Mostrando <strong className="text-white">{ordens.length}</strong> de{' '}
                <strong className="text-white">{totalElements}</strong> registros
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium text-white">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                  title="Próxima Página"
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
