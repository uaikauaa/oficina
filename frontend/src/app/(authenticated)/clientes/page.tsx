'use client';

import React, { useEffect, useState, useTransition, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Building2,
  User,
  Power,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  X,
  Wrench,
  SlidersHorizontal,
  ArrowUpRight,
  Edit2,
  RefreshCw,
} from 'lucide-react';
import ClienteModal from '@/components/ClienteModal';
import ConfirmModal from '@/components/ConfirmModal';
import {
  Cliente,
  ClienteContadoresStatus,
  PageResponse,
  TipoPessoa,
} from '@/lib/types';
import { apiFetch, formatarDocumento, formatarTelefone } from '@/lib/api';

type FiltroPill = 'TODAS' | 'FISICA' | 'JURIDICA' | 'ATIVOS' | 'INATIVOS';

function ClientesContent() {
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // Estados da Listagem
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Contadores reais das Pills
  const [contadores, setContadores] = useState<ClienteContadoresStatus | null>(null);

  // Estados de Busca e Filtros
  const [buscaInput, setBuscaInput] = useState(searchParams.get('termo') || '');
  const [termoDebounced, setTermoDebounced] = useState(searchParams.get('termo') || '');
  const [tipoPessoaFiltro, setTipoPessoaFiltro] = useState<TipoPessoa | ''>(
    (searchParams.get('tipoPessoa') as TipoPessoa) || ''
  );
  const [ativoFiltro, setAtivoFiltro] = useState<string>(searchParams.get('ativo') || '');
  const [ordenacao, setOrdenacao] = useState<string>('nomeRazaoSocial,asc');
  const [isMaisFiltrosOpen, setIsMaisFiltrosOpen] = useState(false);

  // Mensagens de Feedback
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clienteParaEditar, setClienteParaEditar] = useState<Cliente | null>(null);
  const [clienteParaAlterarStatus, setClienteParaAlterarStatus] = useState<Cliente | null>(null);
  const [isConfirmingStatus, setIsConfirmingStatus] = useState(false);

  // Gatilho de recarga
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Debounce da busca textual (~400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setTermoDebounced(buscaInput.trim());
      setPage(0);
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [buscaInput]);


  // Carrega Contadores de Status das Pills (1 única requisição consolidada)
  const carregarContadores = useCallback(async () => {
    try {
      const res = await apiFetch('/api/clientes/contadores-status');
      if (res.ok) {
        const data: ClienteContadoresStatus = await res.json();
        setContadores(data);
      }
    } catch {
      // Ignora erro silencioso em contadores para não quebrar a tela
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarContadores();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarContadores, refreshTrigger]);

  // Carrega Clientes com Filtros e Paginação
  useEffect(() => {
    let ignore = false;

    async function fetchClientes() {
      try {
        setHasError(false);
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('size', pageSize.toString());
        params.set('sort', ordenacao);

        if (termoDebounced) {
          params.set('termo', termoDebounced);
        }
        if (tipoPessoaFiltro) {
          params.set('tipoPessoa', tipoPessoaFiltro);
        }
        if (ativoFiltro !== '') {
          params.set('ativo', ativoFiltro);
        }

        const res = await apiFetch(`/api/clientes?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Falha ao buscar clientes.');
        }

        const data: PageResponse<Cliente> = await res.json();
        if (!ignore) {
          setClientes(data.content || []);
          setTotalPages(data.totalPages || 0);
          setTotalElements(data.totalElements || 0);
          setIsLoading(false);
        }
      } catch {
        if (!ignore) {
          setHasError(true);
          setToastError('Não foi possível carregar a lista de clientes. Verifique a conexão com o servidor.');
          setIsLoading(false);
        }
      }
    }

    const timer = setTimeout(() => {
      setIsLoading(true);
      fetchClientes();
    }, 0);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [page, pageSize, termoDebounced, tipoPessoaFiltro, ativoFiltro, ordenacao, refreshTrigger]);

  // Determinar a Pill ativa atual
  const getPillAtiva = (): FiltroPill => {
    if (tipoPessoaFiltro === 'FISICA' && ativoFiltro === '') return 'FISICA';
    if (tipoPessoaFiltro === 'JURIDICA' && ativoFiltro === '') return 'JURIDICA';
    if (ativoFiltro === 'true' && tipoPessoaFiltro === '') return 'ATIVOS';
    if (ativoFiltro === 'false' && tipoPessoaFiltro === '') return 'INATIVOS';
    if (!tipoPessoaFiltro && ativoFiltro === '') return 'TODAS';
    return 'TODAS';
  };

  const selecionarPill = (pill: FiltroPill) => {
    startTransition(() => {
      setPage(0);
      switch (pill) {
        case 'TODAS':
          setTipoPessoaFiltro('');
          setAtivoFiltro('');
          break;
        case 'FISICA':
          setTipoPessoaFiltro('FISICA');
          setAtivoFiltro('');
          break;
        case 'JURIDICA':
          setTipoPessoaFiltro('JURIDICA');
          setAtivoFiltro('');
          break;
        case 'ATIVOS':
          setAtivoFiltro('true');
          setTipoPessoaFiltro('');
          break;
        case 'INATIVOS':
          setAtivoFiltro('false');
          setTipoPessoaFiltro('');
          break;
      }
    });
  };

  // Limpeza de todos os filtros e busca
  const limparFiltros = () => {
    setBuscaInput('');
    setTermoDebounced('');
    setTipoPessoaFiltro('');
    setAtivoFiltro('');
    setOrdenacao('nomeRazaoSocial,asc');
    setPage(0);
    setRefreshTrigger((prev) => prev + 1);
  };

  // Verificar se há filtros ativos para exibir chip
  const temFiltroAtivo = !!termoDebounced || !!tipoPessoaFiltro || ativoFiltro !== '';

  const getDescricaoFiltroAtivo = (): string => {
    const partes: string[] = [];
    if (termoDebounced) partes.push(`Busca "${termoDebounced}"`);
    if (tipoPessoaFiltro === 'FISICA') partes.push('Pessoa Física');
    if (tipoPessoaFiltro === 'JURIDICA') partes.push('Pessoa Jurídica');
    if (ativoFiltro === 'true') partes.push('Apenas Ativos');
    if (ativoFiltro === 'false') partes.push('Apenas Inativos');
    return partes.join(' + ');
  };

  // Alteração de Status (Ativar / Inativar)
  const confirmarAlteracaoStatus = async () => {
    if (!clienteParaAlterarStatus) return;

    setIsConfirmingStatus(true);
    const novoStatus = !clienteParaAlterarStatus.ativo;

    try {
      const res = await apiFetch(`/api/clientes/${clienteParaAlterarStatus.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: novoStatus }),
      });

      if (!res.ok) {
        const erro = await res.json();
        throw new Error(erro.message || 'Falha ao alterar status do cliente.');
      }

      setToastSuccess(
        novoStatus
          ? `Cliente "${clienteParaAlterarStatus.nomeRazaoSocial}" reativado com sucesso!`
          : `Cliente "${clienteParaAlterarStatus.nomeRazaoSocial}" inativado com sucesso!`
      );
      setClienteParaAlterarStatus(null);
      setIsLoading(true);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar alteração de status.';
      setToastError(msg);
    } finally {
      setIsConfirmingStatus(false);
    }
  };

  const pillAtual = getPillAtiva();

  // Calcular limites da paginação
  const registroInicial = totalElements === 0 ? 0 : page * pageSize + 1;
  const registroFinal = Math.min((page + 1) * pageSize, totalElements);

  return (
    <>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* ========================================================================= */}
        {/* CABEÇALHO COMPACTO OPERACIONAL                                            */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Clientes
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Gestão cadastral, contatos e equipamentos dos clientes da oficina
            </p>
          </div>

          {/* Botão Hero Principal: Novo Cliente */}
          <button
            onClick={() => {
              setClienteParaEditar(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Novo Cliente</span>
          </button>
        </div>

        {/* Notificações e Feedback */}
        {toastSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastSuccess}</span>
            </div>
            <button
              onClick={() => setToastSuccess(null)}
              className="text-emerald-400 hover:text-emerald-200 font-bold ml-4 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {toastError && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{toastError}</span>
            </div>
            <button
              onClick={() => setToastError(null)}
              className="text-red-400 hover:text-red-200 font-bold ml-4 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BARRA DE BUSCA PRINCIPAL DOMINANTE & FILTROS RETRÁTEIS                    */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            {/* Campo de Busca Dominante */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
              />
              {buscaInput && (
                <button
                  onClick={() => {
                    setBuscaInput('');
                    setTermoDebounced('');
                    setPage(0);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botão Mais Filtros */}
            <button
              type="button"
              onClick={() => setIsMaisFiltrosOpen(!isMaisFiltrosOpen)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
                isMaisFiltrosOpen || ordenacao !== 'nomeRazaoSocial,asc'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{isMaisFiltrosOpen ? 'Mais Filtros ▲' : 'Mais Filtros ▼'}</span>
            </button>
          </div>

          {/* Painel Retrátil de Filtros Adicionais */}
          {isMaisFiltrosOpen && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Tipo de Pessoa
                </label>
                <select
                  value={tipoPessoaFiltro}
                  onChange={(e) => {
                    setTipoPessoaFiltro(e.target.value as TipoPessoa | '');
                    setPage(0);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">Todos os Tipos</option>
                  <option value="FISICA">Pessoa Física (PF)</option>
                  <option value="JURIDICA">Pessoa Jurídica (PJ)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Status Cadastral
                </label>
                <select
                  value={ativoFiltro}
                  onChange={(e) => {
                    setAtivoFiltro(e.target.value);
                    setPage(0);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">Todos os Status</option>
                  <option value="true">Apenas Ativos</option>
                  <option value="false">Apenas Inativos</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Ordenação
                </label>
                <select
                  value={ordenacao}
                  onChange={(e) => {
                    setOrdenacao(e.target.value);
                    setPage(0);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="nomeRazaoSocial,asc">Nome / Razão Social (A-Z)</option>
                  <option value="nomeRazaoSocial,desc">Nome / Razão Social (Z-A)</option>
                  <option value="id,desc">Mais Recentes (Cadastro)</option>
                  <option value="id,asc">Mais Antigos (Cadastro)</option>
                </select>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PILLS OPERACIONAIS COMPACTAS COM CONTADORES REAIS                        */}
          {/* ========================================================================= */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => selecionarPill('TODAS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                pillAtual === 'TODAS' && !termoDebounced
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              Todas {contadores?.total !== undefined && `(${contadores.total})`}
            </button>

            <button
              onClick={() => selecionarPill('FISICA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                pillAtual === 'FISICA'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Pessoa Física {contadores?.pessoaFisica !== undefined && `(${contadores.pessoaFisica})`}</span>
            </button>

            <button
              onClick={() => selecionarPill('JURIDICA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                pillAtual === 'JURIDICA'
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Pessoa Jurídica {contadores?.pessoaJuridica !== undefined && `(${contadores.pessoaJuridica})`}</span>
            </button>

            <button
              onClick={() => selecionarPill('ATIVOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                pillAtual === 'ATIVOS'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              Ativos {contadores?.ativos !== undefined && `(${contadores.ativos})`}
            </button>

            <button
              onClick={() => selecionarPill('INATIVOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                pillAtual === 'INATIVOS'
                  ? 'bg-slate-800 text-slate-200 border-slate-600 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
              }`}
            >
              Inativos {contadores?.inativos !== undefined && `(${contadores.inativos})`}
            </button>
          </div>

          {/* ========================================================================= */}
          {/* CHIP DE FILTRO ATIVO                                                      */}
          {/* ========================================================================= */}
          {temFiltroAtivo && (
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span>
                  Filtro Ativo: <strong>{getDescricaoFiltroAtivo()}</strong> ({totalElements}{' '}
                  {totalElements === 1 ? 'encontrado' : 'encontrados'})
                </span>
                <button
                  onClick={limparFiltros}
                  className="text-amber-400 hover:text-amber-200 ml-1 p-0.5 rounded transition-colors cursor-pointer"
                  title="Limpar todos os filtros"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TABELA COMPACTA PRIORITÁRIA (6 COLUNAS OPERACIONAIS)                      */}
        {/* ========================================================================= */}
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-2.5 px-3.5">Cliente</th>
                  <th className="py-2.5 px-3.5">Documento</th>
                  <th className="py-2.5 px-3.5">Contato</th>
                  <th className="py-2.5 px-3.5 text-center">Equipamentos</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando clientes...</span>
                      </div>
                    </td>
                  </tr>
                ) : hasError ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-medium text-red-400">Erro ao carregar clientes</p>
                      <p className="text-xs text-slate-500 mt-1 mb-3">
                        Não foi possível conectar ao servidor. Verifique a conexão.
                      </p>
                      <button
                        onClick={() => setRefreshTrigger((prev) => prev + 1)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Tentar novamente</span>
                      </button>
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <p className="text-sm font-medium text-slate-300">
                        {temFiltroAtivo
                          ? 'Nenhum cliente encontrado para sua busca ou filtros atuais.'
                          : 'Nenhum cliente cadastrado ainda.'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {temFiltroAtivo ? (
                          <button
                            onClick={limparFiltros}
                            className="text-amber-400 hover:underline font-semibold cursor-pointer"
                          >
                            Limpar filtros e busca
                          </button>
                        ) : (
                          'Clique em "+ NOVO CLIENTE" acima para cadastrar o primeiro cliente da oficina.'
                        )}
                      </p>
                    </td>
                  </tr>
                ) : (
                  clientes.map((cli) => {
                    const telefoneFormatado = formatarTelefone(cli.celular || cli.telefone);
                    const telefoneLimpo = (cli.celular || cli.telefone)?.replace(/\D/g, '') || '';

                    return (
                      <tr
                        key={cli.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* 1. Cliente: Nome, Fantasia, Badge PF/PJ */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                                cli.tipoPessoa === 'JURIDICA'
                                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                  : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {cli.tipoPessoa === 'JURIDICA' ? 'PJ' : 'PF'}
                            </span>

                            <div className="min-w-0">
                              <Link
                                href={`/clientes/${cli.id}`}
                                className="font-semibold text-white group-hover:text-amber-400 transition-colors block truncate max-w-[240px] sm:max-w-xs"
                                title={cli.nomeRazaoSocial}
                              >
                                {cli.nomeRazaoSocial}
                              </Link>
                              {cli.nomeFantasia && (
                                <div className="text-[11px] text-slate-400 truncate max-w-[240px]">
                                  {cli.nomeFantasia}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Documento: CPF/CNPJ formatado em mono */}
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {formatarDocumento(cli.cpfCnpj)}
                        </td>

                        {/* 3. Contato: Telefone clicável + E-mail */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {telefoneLimpo ? (
                            <a
                              href={`tel:${telefoneLimpo}`}
                              className="inline-flex items-center gap-1.5 text-slate-300 hover:text-amber-400 transition-colors"
                              title="Ligar para o cliente"
                            >
                              <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{telefoneFormatado}</span>
                            </a>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                          {cli.email && (
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[150px]" title={cli.email}>
                                {cli.email}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 4. Equipamentos: Total real vindo da API */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          <Link
                            href={`/clientes/${cli.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                            title="Ver equipamentos deste cliente"
                          >
                            <Wrench className="w-3 h-3 text-amber-500" />
                            <span>{cli.totalEquipamentos} máq.</span>
                          </Link>
                        </td>

                        {/* 5. Status: Ativo / Inativo */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          {cli.ativo ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              Inativo
                            </span>
                          )}
                        </td>

                        {/* 6. Ações: Ver Detalhes (Principal) + Atalho + OS (Secundária) */}
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Ação Primária: Ver Detalhes */}
                            <Link
                              href={`/clientes/${cli.id}`}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 text-xs font-semibold inline-flex items-center gap-1 border border-slate-700 transition-all cursor-pointer"
                              title="Ver cadastro completo e histórico do cliente"
                            >
                              <span>Ver</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </Link>

                            {/* Ação Operacional Rápida: Nova OS com cliente pré-selecionado */}
                            <Link
                              href={`/ordens-servico/nova?clienteId=${cli.id}`}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold inline-flex items-center gap-1 border border-amber-500/30 transition-all cursor-pointer"
                              title="Iniciar uma Nova Ordem de Serviço para este cliente"
                            >
                              <Plus className="w-3 h-3 stroke-[2.5]" />
                              <span>OS</span>
                            </Link>

                            {/* Editar */}
                            <button
                              onClick={() => {
                                setClienteParaEditar(cli);
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-blue-500/20 hover:text-blue-400 text-slate-400 transition-colors cursor-pointer border border-transparent hover:border-blue-500/30"
                              title="Editar dados cadastrais"
                              aria-label={`Editar dados cadastrais de ${cli.nomeRazaoSocial}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Alterar Status (Ativar / Inativar) */}
                            <button
                              onClick={() => setClienteParaAlterarStatus(cli)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer border border-transparent ${
                                cli.ativo
                                  ? 'bg-slate-800/80 hover:bg-red-500/20 hover:text-red-400 text-slate-400 hover:border-red-500/30'
                                  : 'bg-slate-800/80 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-400 hover:border-emerald-500/30'
                              }`}
                              title={cli.ativo ? 'Inativar cliente' : 'Reativar cliente'}
                              aria-label={cli.ativo ? `Inativar cliente ${cli.nomeRazaoSocial}` : `Reativar cliente ${cli.nomeRazaoSocial}`}
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

          {/* ========================================================================= */}
          {/* RODAPÉ DA TABELA COM PAGINAÇÃO OPERACIONAL                                */}
          {/* ========================================================================= */}
          <div className="p-3.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 bg-slate-950/40">
            <div>
              Mostrando <span className="text-white font-medium">{registroInicial}</span> a{' '}
              <span className="text-white font-medium">{registroFinal}</span> de{' '}
              <span className="text-white font-semibold">{totalElements}</span> clientes
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 0 || isLoading}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>

              <span className="px-2">
                Página <span className="text-white font-medium">{totalPages === 0 ? 0 : page + 1}</span> de{' '}
                <span className="text-white font-medium">{totalPages === 0 ? 1 : totalPages}</span>
              </span>

              <button
                disabled={page + 1 >= totalPages || isLoading}
                onClick={() => setPage((prev) => prev + 1)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Próxima</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modal de Cadastro / Edição */}
      <ClienteModal
        isOpen={isModalOpen}
        cliente={clienteParaEditar}
        onClose={() => {
          setIsModalOpen(false);
          setClienteParaEditar(null);
        }}
        onSuccess={(salvo) => {
          setToastSuccess(
            clienteParaEditar
              ? `Cliente "${salvo.nomeRazaoSocial}" atualizado com sucesso!`
              : `Cliente "${salvo.nomeRazaoSocial}" cadastrado com sucesso!`
          );
          setIsLoading(true);
          setRefreshTrigger((prev) => prev + 1);
        }}
      />

      {/* Modal de Confirmação de Alteração de Status */}
      <ConfirmModal
        isOpen={!!clienteParaAlterarStatus}
        title={
          clienteParaAlterarStatus?.ativo
            ? 'Inativar Cliente?'
            : 'Reativar Cliente?'
        }
        message={
          clienteParaAlterarStatus?.ativo
            ? `Tem certeza que deseja inativar o cliente "${clienteParaAlterarStatus?.nomeRazaoSocial}"? Ele não aparecerá como ativo para novas ordens de serviço até ser reativado.`
            : `Deseja reativar o cliente "${clienteParaAlterarStatus?.nomeRazaoSocial}" no sistema?`
        }
        confirmText={clienteParaAlterarStatus?.ativo ? 'Sim, Inativar' : 'Sim, Ativar'}
        isDestructive={clienteParaAlterarStatus?.ativo}
        isLoading={isConfirmingStatus}
        onConfirm={confirmarAlteracaoStatus}
        onCancel={() => setClienteParaAlterarStatus(null)}
      />
    </>
  );
}

export default function ClientesPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <ClientesContent />
    </Suspense>
  );
}

