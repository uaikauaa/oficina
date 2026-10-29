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
  ChevronDown,
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
import FeedbackNotice from '@/components/ui/FeedbackNotice';
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
            <h1 className="ui-page-title">
              Clientes
            </h1>
            <p className="text-xs sm:text-sm text-muted mt-0.5">
              Gestão cadastral, contatos e equipamentos dos clientes da oficina
            </p>
          </div>

          {/* Botão Hero Principal: Novo Cliente */}
          <button
            onClick={() => {
              setClienteParaEditar(null);
              setIsModalOpen(true);
            }}
            className="ui-btn ui-btn-primary sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
          >
            <Plus aria-hidden="true" className="w-4 h-4 " />
            <span>Novo Cliente</span>
          </button>
        </div>

        {/* Notificações e Feedback */}
        {toastSuccess && (
          <FeedbackNotice message={toastSuccess} variant="success" onDismiss={() => setToastSuccess(null)} />
        )}

        {toastError && (
          <FeedbackNotice message={toastError} variant="error" onDismiss={() => setToastError(null)} />
        )}

        {/* ========================================================================= */}
        {/* BARRA DE BUSCA PRINCIPAL DOMINANTE & FILTROS RETRÁTEIS                    */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            {/* Campo de Busca Dominante */}
            <div className="relative flex-1">
              <Search aria-hidden="true" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input aria-label="Buscar por nome, CPF/CNPJ ou telefone..."
                type="text"
                value={buscaInput}
                onChange={(e) => setBuscaInput(e.target.value)}
                placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
                className="ui-field w-full pl-10 pr-10 border placeholder-subtle focus:outline-none focus:border-accent transition-colors shadow-sm"
              />
              {buscaInput && (
                <button
                  onClick={() => {
                    setBuscaInput('');
                    setTermoDebounced('');
                    setPage(0);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-1 transition-colors cursor-pointer"
                  title="Limpar busca"
                >
                  <X aria-hidden="true" className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Botão Mais Filtros */}
            <button
              type="button"
              onClick={() => setIsMaisFiltrosOpen(!isMaisFiltrosOpen)}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-all cursor-pointer shrink-0 ${
                isMaisFiltrosOpen || ordenacao !== 'nomeRazaoSocial,asc'
                  ? 'bg-accent/15 border-accent/40 text-accent'
                  : 'bg-surface border-line text-ink hover:text-ink hover:border-control'
              }`}
            >
              <SlidersHorizontal aria-hidden="true" className="w-4 h-4" />
              <span>Mais Filtros</span>
              <ChevronDown aria-hidden="true" className={`w-4 h-4 ${isMaisFiltrosOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Painel Retrátil de Filtros Adicionais */}
          {isMaisFiltrosOpen && (
            <div className="p-4 rounded-xl bg-surface/90 border border-line grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-150">
              <div>
                <label htmlFor="field-src-app-authenticated-clientes-page-tsx-1" className="block text-xs font-semibold text-muted mb-1">
                  Tipo de Pessoa
                </label>
                <select id="field-src-app-authenticated-clientes-page-tsx-1"
                  value={tipoPessoaFiltro}
                  onChange={(e) => {
                    setTipoPessoaFiltro(e.target.value as TipoPessoa | '');
                    setPage(0);
                  }}
                  className="ui-field w-full border focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="">Todos os Tipos</option>
                  <option value="FISICA">Pessoa Física (PF)</option>
                  <option value="JURIDICA">Pessoa Jurídica (PJ)</option>
                </select>
              </div>

              <div>
                <label htmlFor="field-src-app-authenticated-clientes-page-tsx-2" className="block text-xs font-semibold text-muted mb-1">
                  Status Cadastral
                </label>
                <select id="field-src-app-authenticated-clientes-page-tsx-2"
                  value={ativoFiltro}
                  onChange={(e) => {
                    setAtivoFiltro(e.target.value);
                    setPage(0);
                  }}
                  className="ui-field w-full border focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="">Todos os Status</option>
                  <option value="true">Apenas Ativos</option>
                  <option value="false">Apenas Inativos</option>
                </select>
              </div>

              <div>
                <label htmlFor="field-src-app-authenticated-clientes-page-tsx-3" className="block text-xs font-semibold text-muted mb-1">
                  Ordenação
                </label>
                <select id="field-src-app-authenticated-clientes-page-tsx-3"
                  value={ordenacao}
                  onChange={(e) => {
                    setOrdenacao(e.target.value);
                    setPage(0);
                  }}
                  className="ui-field w-full border focus:outline-none focus:border-accent cursor-pointer"
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
                  ? 'bg-accent text-inverse border-accent shadow-sm'
                  : 'bg-surface/80 text-muted border-line hover:text-ink hover:border-control'
              }`}
            >
              Todas {contadores?.total !== undefined && `(${contadores.total})`}
            </button>

            <button
              onClick={() => selecionarPill('FISICA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                pillAtual === 'FISICA'
                  ? 'bg-accent/20 text-accent border-accent/40 shadow-sm'
                  : 'bg-surface/80 text-muted border-line hover:text-ink hover:border-control'
              }`}
            >
              <User aria-hidden="true" className="w-4 h-4 text-accent" />
              <span>Pessoa Física {contadores?.pessoaFisica !== undefined && `(${contadores.pessoaFisica})`}</span>
            </button>

            <button
              onClick={() => selecionarPill('JURIDICA')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 ${
                pillAtual === 'JURIDICA'
                  ? 'bg-ink/5 text-ink border-line shadow-sm'
                  : 'bg-surface/80 text-muted border-line hover:text-ink hover:border-control'
              }`}
            >
              <Building2 aria-hidden="true" className="w-4 h-4 text-ink" />
              <span>Pessoa Jurídica {contadores?.pessoaJuridica !== undefined && `(${contadores.pessoaJuridica})`}</span>
            </button>

            <button
              onClick={() => selecionarPill('ATIVOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                pillAtual === 'ATIVOS'
                  ? 'bg-ink/5 text-ink border-line shadow-sm'
                  : 'bg-surface/80 text-muted border-line hover:text-ink hover:border-control'
              }`}
            >
              Ativos {contadores?.ativos !== undefined && `(${contadores.ativos})`}
            </button>

            <button
              onClick={() => selecionarPill('INATIVOS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                pillAtual === 'INATIVOS'
                  ? 'bg-elevated text-ink border-control shadow-sm'
                  : 'bg-surface/80 text-muted border-line hover:text-ink hover:border-control'
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
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-accent/10 text-accent border border-accent/30">
                <span>
                  Filtro Ativo: <strong>{getDescricaoFiltroAtivo()}</strong> ({totalElements}{' '}
                  {totalElements === 1 ? 'encontrado' : 'encontrados'})
                </span>
                <button
                  onClick={limparFiltros}
                  className="ui-icon-btn text-accent hover:text-accent ml-1 p-0.5 rounded transition-colors cursor-pointer"
                  title="Limpar todos os filtros"
                >
                  <X aria-hidden="true" className="w-4 h-4" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* TABELA COMPACTA PRIORITÁRIA (6 COLUNAS OPERACIONAIS)                      */}
        {/* ========================================================================= */}
        <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr className="border-b border-line bg-canvas/70 text-xs font-bold text-muted">
                  <th className="py-2.5 px-3.5">Cliente</th>
                  <th className="py-2.5 px-3.5">Documento</th>
                  <th className="py-2.5 px-3.5">Contato</th>
                  <th className="py-2.5 px-3.5 text-center">Equipamentos</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <span>Carregando clientes...</span>
                      </div>
                    </td>
                  </tr>
                ) : hasError ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted">
                      <p className="text-sm font-medium text-danger">Erro ao carregar clientes</p>
                      <p className="text-xs text-subtle mt-1 mb-3">
                        Não foi possível conectar ao servidor. Verifique a conexão.
                      </p>
                      <button
                        onClick={() => setRefreshTrigger((prev) => prev + 1)}
                        className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-hover text-ink text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw aria-hidden="true" className="w-4 h-4" />
                        <span>Tentar novamente</span>
                      </button>
                    </td>
                  </tr>
                ) : clientes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted">
                      <p className="text-sm font-medium text-ink">
                        {temFiltroAtivo
                          ? 'Nenhum cliente encontrado para sua busca ou filtros atuais.'
                          : 'Nenhum cliente cadastrado ainda.'}
                      </p>
                      <p className="text-xs text-subtle mt-1">
                        {temFiltroAtivo ? (
                          <button
                            onClick={limparFiltros}
                            className="text-accent hover:underline font-semibold cursor-pointer"
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
                        className="hover:bg-elevated/40 transition-colors group"
                      >
                        {/* 1. Cliente: Nome, Fantasia, Badge PF/PJ */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold shrink-0 border ${
                                cli.tipoPessoa === 'JURIDICA'
                                  ? 'bg-ink/5 text-ink border-line'
                                  : 'bg-accent/15 text-accent border-accent/30'
                              }`}
                            >
                              {cli.tipoPessoa === 'JURIDICA' ? 'PJ' : 'PF'}
                            </span>

                            <div className="min-w-0">
                              <Link
                                href={`/clientes/${cli.id}`}
                                className="font-semibold text-ink group-hover:text-accent transition-colors block truncate max-w-[240px] sm:max-w-xs"
                                title={cli.nomeRazaoSocial}
                              >
                                {cli.nomeRazaoSocial}
                              </Link>
                              {cli.nomeFantasia && (
                                <div className="text-xs text-muted truncate max-w-[240px]">
                                  {cli.nomeFantasia}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Documento: CPF/CNPJ formatado em mono */}
                        <td className="py-2.5 px-3.5 font-mono text-xs text-ink whitespace-nowrap">
                          {formatarDocumento(cli.cpfCnpj)}
                        </td>

                        {/* 3. Contato: Telefone clicável + E-mail */}
                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                          {telefoneLimpo ? (
                            <a
                              href={`tel:${telefoneLimpo}`}
                              className="inline-flex items-center gap-1.5 text-ink hover:text-accent transition-colors"
                              title="Ligar para o cliente"
                            >
                              <Phone aria-hidden="true" className="w-3 h-3 text-subtle shrink-0" />
                              <span>{telefoneFormatado}</span>
                            </a>
                          ) : (
                            <span className="text-subtle">-</span>
                          )}
                          {cli.email && (
                            <div className="flex items-center gap-1 text-xs text-subtle mt-0.5">
                              <Mail aria-hidden="true" className="w-3 h-3 shrink-0" />
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
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-elevated hover:bg-hover text-ink border border-control transition-colors"
                            title="Ver equipamentos deste cliente"
                          >
                            <Wrench aria-hidden="true" className="w-3 h-3 text-accent" />
                            <span>{cli.totalEquipamentos} máq.</span>
                          </Link>
                        </td>

                        {/* 5. Status: Ativo / Inativo */}
                        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                          {cli.ativo ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-ink/5 text-ink border border-line">
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-elevated text-muted border border-control">
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
                              className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-accent/20 hover:text-accent text-ink text-xs font-semibold inline-flex items-center gap-1 border border-control transition-all cursor-pointer"
                              title="Ver cadastro completo e histórico do cliente"
                            >
                              <span>Ver</span>
                              <ArrowUpRight aria-hidden="true" className="w-3 h-3" />
                            </Link>

                            {/* Ação Operacional Rápida: Nova OS com cliente pré-selecionado */}
                            <Link
                              href={`/ordens-servico/nova?clienteId=${cli.id}`}
                              className="px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-xs font-bold inline-flex items-center gap-1 border border-accent/30 transition-all cursor-pointer"
                              title="Iniciar uma Nova Ordem de Serviço para este cliente"
                            >
                              <Plus aria-hidden="true" className="w-3 h-3 " />
                              <span>OS</span>
                            </Link>

                            {/* Editar */}
                            <button
                              onClick={() => {
                                setClienteParaEditar(cli);
                                setIsModalOpen(true);
                              }}
                              className="ui-icon-btn p-1.5 rounded-lg bg-elevated/80 hover:bg-ink/5 hover:text-ink text-muted transition-colors cursor-pointer border border-transparent hover:border-line"
                              title="Editar dados cadastrais"
                              aria-label={`Editar dados cadastrais de ${cli.nomeRazaoSocial}`}
                            >
                              <Edit2 aria-hidden="true" className="w-4 h-4" />
                            </button>

                            {/* Alterar Status (Ativar / Inativar) */}
                            <button
                              onClick={() => setClienteParaAlterarStatus(cli)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer border border-transparent ${
                                cli.ativo
                                  ? 'bg-elevated/80 hover:bg-danger/20 hover:text-danger text-muted hover:border-danger/30'
                                  : 'bg-elevated/80 hover:bg-ink/5 hover:text-ink text-muted hover:border-line'
                              }`}
                              title={cli.ativo ? 'Inativar cliente' : 'Reativar cliente'}
                              aria-label={cli.ativo ? `Inativar cliente ${cli.nomeRazaoSocial}` : `Reativar cliente ${cli.nomeRazaoSocial}`}
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

          {/* ========================================================================= */}
          {/* RODAPÉ DA TABELA COM PAGINAÇÃO OPERACIONAL                                */}
          {/* ========================================================================= */}
          <div className="p-3.5 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted bg-canvas/40">
            <div>
              Mostrando <span className="text-ink font-medium">{registroInicial}</span> a{' '}
              <span className="text-ink font-medium">{registroFinal}</span> de{' '}
              <span className="text-ink font-semibold">{totalElements}</span> clientes
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 0 || isLoading}
                onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-hover text-ink disabled:opacity-40 disabled:hover:bg-elevated transition-colors cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft aria-hidden="true" className="w-4 h-4" />
                <span>Anterior</span>
              </button>

              <span className="px-2">
                Página <span className="text-ink font-medium">{totalPages === 0 ? 0 : page + 1}</span> de{' '}
                <span className="text-ink font-medium">{totalPages === 0 ? 1 : totalPages}</span>
              </span>

              <button
                disabled={page + 1 >= totalPages || isLoading}
                onClick={() => setPage((prev) => prev + 1)}
                className="px-3 py-1.5 rounded-lg bg-elevated hover:bg-hover text-ink disabled:opacity-40 disabled:hover:bg-elevated transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Próxima</span>
                <ChevronRight aria-hidden="true" className="w-4 h-4" />
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
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <ClientesContent />
    </Suspense>
  );
}

