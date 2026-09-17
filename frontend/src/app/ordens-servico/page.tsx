'use client';

import React, { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  Search,
  Plus,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  SlidersHorizontal,
  X,
  RotateCcw,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import Header from '@/components/Header';
import {
  CurrentUser,
  OrdemServico,
  PageResponse,
  STATUS_ORDEM_SERVICO_BADGES,
  STATUS_ORDEM_SERVICO_LABELS,
  OrdemServicoContadoresStatus,
} from '@/lib/types';
import { apiFetch, formatarMoeda, formatarData } from '@/lib/api';

function OrdensServicoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status') || '';

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
  const [statusFiltro, setStatusFiltro] = useState<string>(statusParam);
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');
  const [periodoAtivo, setPeriodoAtivo] = useState<'30' | '90' | 'ano' | 'tudo' | 'custom'>('tudo');
  const [filtrosAvancadosAbertos, setFiltrosAvancadosAbertos] = useState(false);

  // Contadores consolidados de status da oficina
  const [contadoresStatus, setContadoresStatus] = useState<OrdemServicoContadoresStatus | null>(null);

  // Gatilho de recarga manual (ex: botão tentar novamente)
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Sincronização segura do parâmetro da URL
  const [prevStatusParam, setPrevStatusParam] = useState(statusParam);
  if (statusParam !== prevStatusParam) {
    setPrevStatusParam(statusParam);
    setStatusFiltro(statusParam);
    setPage(0);
  }

  // Debounce do termo de busca (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setTermoDebounced(termo);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [termo]);

  // Carrega contadores consolidados de status (1 única chamada HTTP)
  const carregarContadoresStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/ordens-servico/contadores-status');
      if (res.ok) {
        const dados: OrdemServicoContadoresStatus = await res.json();
        setContadoresStatus(dados);
      }
    } catch {
      // Falha silenciosa ou mantêm os contadores nulos sem quebrar a tela
    }
  }, []);

  // Carrega Usuário da Sessão e Contadores Iniciais
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
          carregarContadoresStatus();
        }
      } catch {
        router.push('/login');
      }
    }
    loadUser();
    return () => {
      ignore = true;
    };
  }, [router, carregarContadoresStatus]);

  // Busca as Ordens de Serviço
  useEffect(() => {
    let ignore = false;
    async function carregarOrdens() {
      if (isLoadingUser) return;
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('size', size.toString());
        params.append('sort', 'dataEntrada,desc');

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
          const dtFim = new Date(dataFim);
          dtFim.setHours(23, 59, 59, 999);
          params.append('dataFim', dtFim.toISOString());
        }

        const res = await apiFetch(`/api/ordens-servico?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Falha ao carregar as Ordens de Serviço');
        }

        const data: PageResponse<OrdemServico> = await res.json();
        if (!ignore) {
          setOrdens(data.content || []);
          setTotalPages(data.totalPages || 0);
          setTotalElements(data.totalElements || 0);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Erro ao carregar Ordens de Serviço.';
          setErrorMessage(msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      carregarOrdens();
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [page, size, termoDebounced, statusFiltro, dataInicio, dataFim, isLoadingUser, refreshTrigger]);

  // Função para definir período rápido de datas
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

  // Limpar todos os filtros ativos
  const limparTodosFiltros = () => {
    setTermo('');
    setTermoDebounced('');
    setStatusFiltro('');
    setDataInicio('');
    setDataFim('');
    setPeriodoAtivo('tudo');
    setPage(0);
  };

  // Limpar apenas o filtro de status ativo
  const limparFiltroStatus = () => {
    setStatusFiltro('');
    setPage(0);
  };

  // Definição das pills operacionais com seus respectivos contadores
  const pillsStatus = useMemo(() => [
    { id: '', label: 'Todas', count: contadoresStatus?.total },
    { id: 'ABERTA', label: 'Abertas', count: contadoresStatus?.aberta },
    { id: 'AGUARDANDO_APROVACAO', label: 'Aguardando Aprovação', count: contadoresStatus?.aguardandoAprovacao },
    { id: 'EM_MANUTENCAO', label: 'Em Manutenção', count: contadoresStatus?.emManutencao },
    { id: 'AGUARDANDO_PECA', label: 'Aguardando Peça', count: contadoresStatus?.aguardandoPeca },
    { id: 'PRONTA', label: 'Prontas para Retirada', count: contadoresStatus?.pronta, destaque: true },
    { id: 'CONCLUIDA', label: 'Concluídas', count: contadoresStatus?.concluida },
    { id: 'CANCELADA', label: 'Canceladas', count: contadoresStatus?.cancelada },
  ], [contadoresStatus]);

  // Quantidade de filtros avançados ativos
  const totalFiltrosAvancadosAtivos = useMemo(() => {
    let count = 0;
    if (dataInicio || dataFim || periodoAtivo !== 'tudo') count++;
    return count;
  }, [dataInicio, dataFim, periodoAtivo]);

  const temFiltrosAtivos = termo.trim() !== '' || statusFiltro !== '' || dataInicio !== '' || dataFim !== '';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* ========================================================================= */}
        {/* 1. CABEÇALHO COMPACTO & AÇÃO HEROICA */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
              <FileText className="w-6 h-6 text-amber-500" />
              ORDENS DE SERVIÇO
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestão e acompanhamento operacional dos atendimentos da oficina
            </p>
          </div>

          {/* AÇÃO PRINCIPAL EM DESTAQUE ABSOLUTO */}
          <Link
            href="/ordens-servico/nova"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer transform hover:-translate-y-0.5 shrink-0"
            aria-label="Criar Nova Ordem de Serviço"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ NOVA ORDEM DE SERVIÇO</span>
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* 2. BARRA DE BUSCA PRINCIPAL & BOTÃO DE FILTROS AVANÇADOS */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {/* Campo de Busca Dominante */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Buscar por nº da OS, cliente, telefone ou equipamento..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all"
              />
              {termo && (
                <button
                  type="button"
                  onClick={() => setTermo('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-all cursor-pointer"
                  title="Limpar busca digitada"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Toggle de Mais Filtros (Recolhível) */}
            <button
              type="button"
              onClick={() => setFiltrosAvancadosAbertos((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                filtrosAvancadosAbertos || totalFiltrosAvancadosAtivos > 0
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {filtrosAvancadosAbertos ? 'Ocultar Filtros' : 'Mais Filtros'}
              </span>
              {totalFiltrosAvancadosAtivos > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                  {totalFiltrosAvancadosAtivos}
                </span>
              )}
            </button>

            {/* Botão Limpar Todos quando houver filtro */}
            {temFiltrosAtivos && (
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all cursor-pointer shrink-0"
                title="Limpar todos os filtros aplicados"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Limpar</span>
              </button>
            )}
          </div>

          {/* Painel Retrátil de Filtros Avançados */}
          {filtrosAvancadosAbertos && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-400 font-medium">Período de Entrada:</span>
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

                {/* Datas Customizadas */}
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => {
                      setDataInicio(e.target.value);
                      setPeriodoAtivo('custom');
                      setPage(0);
                    }}
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
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
                    className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500/40"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* 3. STATUS OPERACIONAIS: PILLS COMPACTAS COM CONTADORES REAIS */}
          {/* ======================================================================= */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-800">
            {pillsStatus.map((pill) => {
              const ativa = statusFiltro === pill.id;
              const isPronta = pill.id === 'PRONTA';

              return (
                <button
                  key={pill.id || 'todas'}
                  type="button"
                  onClick={() => {
                    setStatusFiltro(pill.id);
                    setPage(0);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${
                    ativa
                      ? isPronta
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                        : 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                      : isPronta
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <span>{pill.label}</span>
                  {pill.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        ativa
                          ? 'bg-slate-950/20 text-slate-950'
                          : isPronta
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {pill.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ======================================================================= */}
          {/* 4. CHIP / FEEDBACK VISUAL DE FILTRO ATIVO */}
          {/* ======================================================================= */}
          {statusFiltro && (
            <div className="flex items-center justify-between p-2.5 px-3.5 rounded-xl bg-slate-900/90 border border-amber-500/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Filtrando por:</span>
                <span className="font-bold text-amber-400">
                  {STATUS_ORDEM_SERVICO_LABELS[statusFiltro as keyof typeof STATUS_ORDEM_SERVICO_LABELS] || statusFiltro}
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300 font-medium">
                  {totalElements} {totalElements === 1 ? 'encontrada' : 'encontradas'}
                </span>
              </div>

              <button
                type="button"
                onClick={limparFiltroStatus}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
              >
                <X className="w-3 h-3" />
                <span>Limpar filtro</span>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 5. TABELA OPERACIONAL COMPACTA (6–8 LINHAS NA PRIMEIRA DOBRA) */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
          {isLoading ? (
            /* Loading State com Skeletons */
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-medium pb-2">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>Carregando ordens de serviço...</span>
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-800/50 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : errorMessage ? (
            /* Error State */
            <div className="p-8 text-center text-red-400 text-xs space-y-3">
              <div className="flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setRefreshTrigger((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar novamente</span>
              </button>
            </div>
          ) : ordens.length === 0 ? (
            /* Empty State */
            <div className="p-10 sm:p-12 text-center text-slate-400 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-slate-600" />
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white">
                  {temFiltrosAtivos
                    ? 'Nenhuma OS corresponde aos filtros aplicados'
                    : 'Nenhuma Ordem de Serviço registrada ainda'}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  {temFiltrosAtivos
                    ? 'Tente remover os filtros ou buscar por outros termos.'
                    : 'Inicie o primeiro atendimento técnico da oficina agora mesmo.'}
                </p>
              </div>

              {temFiltrosAtivos ? (
                <button
                  type="button"
                  onClick={limparTodosFiltros}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar filtros</span>
                </button>
              ) : (
                <Link
                  href="/ordens-servico/nova"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all cursor-pointer shadow-lg"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>+ Abrir Primeira Ordem de Serviço</span>
                </Link>
              )}
            </div>
          ) : (
            /* Tabela de Dados */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Nº da OS</th>
                    <th className="py-2.5 px-4">Cliente</th>
                    <th className="py-2.5 px-4">Equipamento</th>
                    <th className="py-2.5 px-4">Data</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                    <th className="py-2.5 px-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {ordens.map((os) => {
                    const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                      bg: 'bg-slate-800',
                      text: 'text-slate-300',
                      border: 'border-slate-700',
                    };
                    const statusDescricao = STATUS_ORDEM_SERVICO_LABELS[os.status] || os.statusDescricao || os.status;

                    return (
                      <tr
                        key={os.id}
                        className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/ordens-servico/${os.id}`)}
                      >
                        {/* 1. Nº da OS */}
                        <td className="py-2.5 px-4 font-mono font-bold text-white group-hover:text-amber-400 transition-colors whitespace-nowrap">
                          {os.numeroOs}
                        </td>

                        {/* 2. Cliente */}
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-white group-hover:text-amber-400 transition-colors">
                            {os.clienteNome || 'Cliente não identificado'}
                          </div>
                          {os.clienteTelefone && (
                            <div className="text-[11px] text-slate-500">{os.clienteTelefone}</div>
                          )}
                        </td>

                        {/* 3. Equipamento */}
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-slate-200">
                            {os.maquinaMarca || os.maquinaModelo ? (
                              <span>
                                {os.maquinaMarca} {os.maquinaModelo}
                              </span>
                            ) : (
                              <span>{os.maquinaTipoDescricao || 'Equipamento'}</span>
                            )}
                          </div>
                          {os.maquinaNumeroSerie && (
                            <div className="text-[11px] text-slate-500 font-mono">
                              Série: {os.maquinaNumeroSerie}
                            </div>
                          )}
                        </td>

                        {/* 4. Data */}
                        <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatarData(os.dataEntrada as unknown as string)}
                        </td>

                        {/* 5. Status */}
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {statusDescricao}
                          </span>
                        </td>

                        {/* 6. Total */}
                        <td className="py-2.5 px-4 text-right font-bold text-white whitespace-nowrap">
                          {formatarMoeda(os.valorTotal)}
                        </td>

                        {/* 7. Ação */}
                        <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/ordens-servico/${os.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-semibold text-[11px] transition-all cursor-pointer"
                            title={`Abrir OS ${os.numeroOs}`}
                          >
                            <span>Abrir</span>
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

          {/* ======================================================================= */}
          {/* 6. PAGINAÇÃO CLARA E COMPACTA */}
          {/* ======================================================================= */}
          {totalElements > 0 && (
            <div className="p-3 border-t border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
              <span>
                Mostrando{' '}
                <strong className="text-white">
                  {page * size + 1} a {Math.min((page + 1) * size, totalElements)}
                </strong>{' '}
                de <strong className="text-white">{totalElements}</strong> ordens
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
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
                    className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300 transition-all cursor-pointer"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function OrdensServicoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <OrdensServicoContent />
    </Suspense>
  );
}
