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
import {
  OrdemServico,
  PageResponse,
  STATUS_ORDEM_SERVICO_BADGES,
  STATUS_ORDEM_SERVICO_LABELS,
  OrdemServicoContadoresStatus,
} from '@/lib/types';
import { apiFetch, formatarMoeda, formatarData } from '@/lib/api';
import { formatarDataInicioParaApi, formatarDataFimParaApi, formatarDataLocalYmd } from '@/lib/relatorioDateHelper';

function OrdensServicoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get('status') || '';

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

  // Carrega Contadores Iniciais
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarContadoresStatus();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarContadoresStatus]);

  // Busca as Ordens de Serviço
  useEffect(() => {
    let ignore = false;
    async function carregarOrdens() {
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
          params.append('dataInicio', formatarDataInicioParaApi(dataInicio));
        }
        if (dataFim) {
          params.append('dataFim', formatarDataFimParaApi(dataFim));
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
  }, [page, size, termoDebounced, statusFiltro, dataInicio, dataFim, refreshTrigger]);

  // Função para definir período rápido de datas estritamente no fuso America/Sao_Paulo (ISSUE-05)
  const definirPeriodo = (tipo: '30' | '90' | 'ano' | 'tudo') => {
    setPeriodoAtivo(tipo);
    if (tipo === 'tudo') {
      setDataInicio('');
      setDataFim('');
    } else {
      const hoje = new Date();
      const hojeYmd = formatarDataLocalYmd(hoje);
      const [anoStr, mesStr, diaStr] = hojeYmd.split('-');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10) - 1;
      const dia = parseInt(diaStr, 10);

      if (tipo === '30') {
        const d = new Date(Date.UTC(ano, mes, dia - 30, 12, 0, 0));
        setDataInicio(formatarDataLocalYmd(d));
        setDataFim(hojeYmd);
      } else if (tipo === '90') {
        const d = new Date(Date.UTC(ano, mes, dia - 90, 12, 0, 0));
        setDataInicio(formatarDataLocalYmd(d));
        setDataFim(hojeYmd);
      } else if (tipo === 'ano') {
        setDataInicio(`${anoStr}-01-01`);
        setDataFim(hojeYmd);
      }
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
    <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
      {/* ========================================================================= */}
      {/* 1. CABEÇALHO COMPACTO & AÇÃO HEROICA */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="ui-page-title">
            <FileText className="w-6 h-6 text-accent" />
            <span>Ordens de Serviço</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Gestão e acompanhamento operacional dos atendimentos da oficina
          </p>
        </div>

        {/* AÇÃO PRINCIPAL EM DESTAQUE ABSOLUTO */}
        <Link
          href="/ordens-servico/nova"
          className="ui-btn ui-btn-primary inline-flex items-center justify-center gap-2 sm:text-sm tracking-wide transition-all cursor-pointer transform shrink-0"
          aria-label="Criar Nova Ordem de Serviço"
        >
          <Plus aria-hidden="true" className="w-4 h-4 stroke-[2.5]" />
          <span>Nova Ordem de Serviço</span>
        </Link>
      </div>

      {/* ========================================================================= */}
      {/* 2. BARRA DE BUSCA PRINCIPAL & BOTÃO DE FILTROS AVANÇADOS */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {/* Campo de Busca Dominante */}
          <div className="relative flex-1">
            <Search aria-hidden="true" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
            <input aria-label="Buscar por nº da OS, cliente, telefone ou equipamento..."
              type="text"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Buscar por nº da OS, cliente, telefone ou equipamento..."
              className="ui-field w-full pl-10 pr-10 border placeholder-subtle focus:outline-none focus:border-accent/50 transition-all"
            />
            {termo && (
              <button
                type="button"
                onClick={() => setTermo('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 rounded-full hover:bg-elevated transition-all cursor-pointer"
                title="Limpar busca digitada"
              >
                <X aria-hidden="true" className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Toggle de Mais Filtros (Recolhível) */}
          <button
            type="button"
            onClick={() => setFiltrosAvancadosAbertos((prev) => !prev)}
            aria-label="Mais Filtros"
            aria-expanded={filtrosAvancadosAbertos}
            className={`inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${filtrosAvancadosAbertos || totalFiltrosAvancadosAtivos > 0
                ? 'bg-accent/10 border-accent/40 text-accent'
                : 'bg-surface border-line text-ink hover:border-control hover:text-ink'
              }`}
          >
            <SlidersHorizontal aria-hidden="true" className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {filtrosAvancadosAbertos ? 'Ocultar Filtros' : 'Mais Filtros'}
            </span>
            {totalFiltrosAvancadosAtivos > 0 && (
              <span className="w-4 h-4 rounded-full bg-accent text-inverse text-xs font-bold flex items-center justify-center">
                {totalFiltrosAvancadosAtivos}
              </span>
            )}
          </button>

          {/* Botão Limpar Todos quando houver filtro */}
          {temFiltrosAtivos && (
            <button
              type="button"
              onClick={limparTodosFiltros}
              className="ui-icon-btn inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-surface border border-line text-muted hover:text-ink hover:border-control transition-all cursor-pointer shrink-0"
              title="Limpar todos os filtros aplicados"
            >
              <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Limpar</span>
            </button>
          )}
        </div>

        {/* Painel Retrátil de Filtros Avançados */}
        {filtrosAvancadosAbertos && (
          <div className="p-4 rounded-xl bg-surface/90 border border-line space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted font-medium">Período de Entrada:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => definirPeriodo('tudo')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${periodoAtivo === 'tudo'
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : 'bg-canvas text-muted border border-line hover:text-ink'
                      }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => definirPeriodo('30')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${periodoAtivo === '30'
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : 'bg-canvas text-muted border border-line hover:text-ink'
                      }`}
                  >
                    Últimos 30 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => definirPeriodo('90')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${periodoAtivo === '90'
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : 'bg-canvas text-muted border border-line hover:text-ink'
                      }`}
                  >
                    Últimos 90 dias
                  </button>
                  <button
                    type="button"
                    onClick={() => definirPeriodo('ano')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${periodoAtivo === 'ano'
                        ? 'bg-accent/20 text-accent border border-accent/40'
                        : 'bg-canvas text-muted border border-line hover:text-ink'
                      }`}
                  >
                    Este Ano
                  </button>
                </div>
              </div>

              {/* Datas Customizadas */}
              <div className="flex items-center gap-2">
                <Calendar aria-hidden="true" className="w-3.5 h-3.5 text-subtle" />
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setPeriodoAtivo('custom');
                    setPage(0);
                  }}
                  className="ui-field border focus:outline-none focus:border-accent/40"
                />
                <span className="text-subtle">até</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setPeriodoAtivo('custom');
                    setPage(0);
                  }}
                  className="ui-field border focus:outline-none focus:border-accent/40"
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border ${ativa
                    ? isPronta
                      ? 'bg-accent text-inverse border-accent'
                      : 'bg-accent text-inverse border-accent shadow-md shadow-none'
                    : isPronta
                      ? 'bg-ink/5 text-ink border-line hover:bg-ink/5'
                      : 'bg-surface text-ink border-line hover:border-control hover:text-ink'
                  }`}
              >
                <span>{pill.label}</span>
                {pill.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-xs font-extrabold ${ativa
                        ? 'bg-canvas/20 text-inverse'
                        : isPronta
                          ? 'bg-ink/5 text-ink'
                          : 'bg-elevated text-muted'
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
          <div className="flex items-center justify-between p-2.5 px-3.5 rounded-xl bg-surface/90 border border-accent/30 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted">Filtrando por:</span>
              <span className="font-bold text-accent">
                {STATUS_ORDEM_SERVICO_LABELS[statusFiltro as keyof typeof STATUS_ORDEM_SERVICO_LABELS] || statusFiltro}
              </span>
              <span className="text-subtle">•</span>
              <span className="text-ink font-medium">
                {totalElements} {totalElements === 1 ? 'encontrada' : 'encontradas'}
              </span>
            </div>

            <button
              type="button"
              onClick={limparFiltroStatus}
              className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:text-accent bg-accent/10 hover:bg-accent/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              <X aria-hidden="true" className="w-3 h-3" />
              <span>Limpar filtro</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. TABELA OPERACIONAL COMPACTA (6–8 LINHAS NA PRIMEIRA DOBRA) */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-line bg-surface/70 overflow-hidden shadow-xl">
        {isLoading ? (
          /* Loading State com Skeletons */
          <div className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-muted text-xs font-medium pb-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span>Carregando ordens de serviço...</span>
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-elevated/50 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : errorMessage ? (
          /* Error State */
          <div className="p-8 text-center text-danger text-xs space-y-3">
            <div className="flex items-center justify-center gap-2">
              <AlertCircle aria-hidden="true" className="w-5 h-5 shrink-0" />
              <span className="font-semibold">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger font-bold text-xs transition-colors cursor-pointer"
            >
              <RefreshCw aria-hidden="true" className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        ) : ordens.length === 0 ? (
          /* Empty State */
          <div className="p-10 sm:p-12 text-center text-muted space-y-3">
            <FileText className="w-10 h-10 mx-auto text-subtle" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-ink">
                {temFiltrosAtivos
                  ? 'Nenhuma OS corresponde aos filtros aplicados'
                  : 'Nenhuma Ordem de Serviço registrada ainda'}
              </h3>
              <p className="text-xs text-subtle max-w-sm mx-auto mt-1">
                {temFiltrosAtivos
                  ? 'Tente remover os filtros ou buscar por outros termos.'
                  : 'Inicie o primeiro atendimento técnico da oficina agora mesmo.'}
              </p>
            </div>

            {temFiltrosAtivos ? (
              <button
                type="button"
                onClick={limparTodosFiltros}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-elevated hover:bg-hover text-ink font-bold text-xs transition-all cursor-pointer"
              >
                <RotateCcw aria-hidden="true" className="w-3.5 h-3.5" />
                <span>Limpar filtros</span>
              </button>
            ) : (
              <Link
                href="/ordens-servico/nova"
                className="ui-btn ui-btn-primary inline-flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus aria-hidden="true" className="w-4 h-4 stroke-[3]" />
                <span>+ Abrir Primeira Ordem de Serviço</span>
              </Link>
            )}
          </div>
        ) : (
          /* Tabela de Dados */
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr className="border-b border-line bg-canvas/60 text-xs font-semibold text-muted">
                  <th className="py-2.5 px-4">Nº da OS</th>
                  <th className="py-2.5 px-4">Cliente</th>
                  <th className="py-2.5 px-4">Equipamento</th>
                  <th className="py-2.5 px-4">Data</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                  <th className="py-2.5 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 text-ink">
                {ordens.map((os) => {
                  const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                    bg: 'bg-elevated',
                    text: 'text-ink',
                    border: 'border-control',
                  };
                  const statusDescricao = STATUS_ORDEM_SERVICO_LABELS[os.status] || os.statusDescricao || os.status;

                  return (
                    <tr
                      key={os.id}
                      className="hover:bg-elevated/40 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/ordens-servico/${os.id}`)}
                    >
                      {/* 1. Nº da OS */}
                      <td className="py-2.5 px-4 font-mono font-bold text-ink group-hover:text-accent transition-colors whitespace-nowrap">
                        {os.numeroOs}
                      </td>

                      {/* 2. Cliente */}
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-ink group-hover:text-accent transition-colors">
                          {os.clienteNome || 'Cliente não identificado'}
                        </div>
                        {os.clienteTelefone && (
                          <div className="text-xs text-subtle">{os.clienteTelefone}</div>
                        )}
                      </td>

                      {/* 3. Equipamento */}
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-ink">
                          {os.maquinaMarca || os.maquinaModelo ? (
                            <span>
                              {os.maquinaMarca} {os.maquinaModelo}
                            </span>
                          ) : (
                            <span>{os.maquinaTipoDescricao || 'Equipamento'}</span>
                          )}
                        </div>
                        {os.maquinaNumeroSerie && (
                          <div className="text-xs text-subtle font-mono">
                            Série: {os.maquinaNumeroSerie}
                          </div>
                        )}
                      </td>

                      {/* 4. Data */}
                      <td className="py-2.5 px-4 text-muted whitespace-nowrap">
                        {formatarData(os.dataEntrada as unknown as string)}
                      </td>

                      {/* 5. Status */}
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {statusDescricao}
                        </span>
                      </td>

                      {/* 6. Total */}
                      <td className="py-2.5 px-4 text-right font-bold text-ink whitespace-nowrap">
                        {formatarMoeda(os.valorTotal)}
                      </td>

                      {/* 7. Ação */}
                      <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/ordens-servico/${os.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-elevated hover:bg-accent hover:text-inverse text-ink font-semibold text-xs transition-all cursor-pointer"
                          title={`Abrir OS ${os.numeroOs}`}
                        >
                          <span>Abrir</span>
                          <ArrowUpRight aria-hidden="true" className="w-3.5 h-3.5" />
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
          <div className="p-3 border-t border-line bg-canvas/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted">
            <span>
              Mostrando{' '}
              <strong className="text-ink">
                {page * size + 1} a {Math.min((page + 1) * size, totalElements)}
              </strong>{' '}
              de <strong className="text-ink">{totalElements}</strong> ordens
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="ui-icon-btn p-1.5 rounded-lg border border-line bg-surface disabled:opacity-30 disabled:cursor-not-allowed hover:bg-elevated text-ink transition-all cursor-pointer"
                  title="Página Anterior"
                >
                  <ChevronLeft aria-hidden="true" className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium text-ink">
                  Página {page + 1} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="ui-icon-btn p-1.5 rounded-lg border border-line bg-surface disabled:opacity-30 disabled:cursor-not-allowed hover:bg-elevated text-ink transition-all cursor-pointer"
                  title="Próxima Página"
                >
                  <ChevronRight aria-hidden="true" className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default function OrdensServicoPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex items-center justify-center text-muted">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <OrdensServicoContent />
    </Suspense>
  );
}
