'use client';

import React, { useEffect, useState, use, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  User,
  Wrench,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  DollarSign,
  Ban,
  CheckCircle,
  Package,
  Plus,
  Trash2,
  Loader2,
  Printer,
  MessageCircle,
  Save,
  Search,
  X,
  History,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Info,
} from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import OrdemServicoImpressao, { type ConfiguracaoOficinaImpressao } from '@/components/OrdemServicoImpressao';
import {
  gerarLinkWhatsappOS,
} from '@/lib/whatsappHelper';
import {
  OrdemServico,
  OrdemServicoStatusData,
  OrdemServicoUpdateData,
  StatusOrdemServico,
  STATUS_ORDEM_SERVICO_BADGES,
  STATUS_ORDEM_SERVICO_LABELS,
  OrdemServicoItem,
  OrdemServicoItemFormData,
  Produto,
  PageResponse,
} from '@/lib/types';
import {
  apiFetch,
  apiFetchJson,
  formatarMoeda,
  formatarDataHora,
  formatarDocumento,
  formatarTelefone,
} from '@/lib/api';

interface PageProps {
  params: Promise<{ id: string }>;
}

type TabType = 'laudo' | 'pecas' | 'historico' | 'observacoes';

interface ToastState {
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function OrdemServicoDetalhesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const osId = resolvedParams.id;

  // Estados principais da OS
  const [os, setOs] = useState<OrdemServico | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [configuracaoOficina, setConfiguracaoOficina] = useState<ConfiguracaoOficinaImpressao | null>(null);

  // Aba ativa do Cockpit de Bancada
  const [activeTab, setActiveTab] = useState<TabType>('laudo');

  // Estado do Formulário de Laudo & Testes (Edição direta na bancada)
  const [laudoForm, setLaudoForm] = useState({
    diagnostico: '',
    solucaoAplicada: '',
    testesRealizados: '',
    valorMaoObra: 0,
    valorDesconto: 0,
  });
  const [isSavingLaudo, setIsSavingLaudo] = useState(false);

  // Itens / Peças da OS
  const [itens, setItens] = useState<OrdemServicoItem[]>([]);
  const [isLoadingItens, setIsLoadingItens] = useState(false);

  // Modal de Adicionar Peça com Busca Debounced
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [buscaPecaTermo, setBuscaPecaTermo] = useState('');
  const [isSearchingPecas, setIsSearchingPecas] = useState(false);
  const [pecasResultados, setPecasResultados] = useState<Produto[]>([]);
  const [pecaSelecionada, setPecaSelecionada] = useState<Produto | null>(null);
  const [itemForm, setItemForm] = useState<OrdemServicoItemFormData>({
    produtoId: 0,
    quantidade: 1,
    valorDesconto: 0,
    observacoes: '',
  });
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [itemModalError, setItemModalError] = useState<string | null>(null);

  // Modal de Confirmação Visual para Remoção de Peça (sem window.confirm)
  const [itemParaRemover, setItemParaRemover] = useState<OrdemServicoItem | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  // Histórico da Máquina (Lazy Loading via GET /api/maquinas/{id}/historico)
  const [historicoOs, setHistoricoOs] = useState<OrdemServico[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);
  const [historicoCarregado, setHistoricoCarregado] = useState(false);

  // Modal de Transição de Status
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StatusOrdemServico | null>(null);
  const [statusTestes, setStatusTestes] = useState('');
  const [statusObs, setStatusObs] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);


  // Timer para debounce de busca
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Helper para exibir Toast temporário
  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (toast && toast.type !== 'error') {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);


  // Carrega Dados da OS
  const fetchOs = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch(`/api/ordens-servico/${osId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Ordem de Serviço não encontrada.');
        }
        throw new Error('Erro ao carregar dados da Ordem de Serviço.');
      }
      const data: OrdemServico = await res.json();
      setOs(data);

      // Sincroniza formulário de laudo da bancada
      setLaudoForm({
        diagnostico: data.diagnostico || '',
        solucaoAplicada: data.solucaoAplicada || '',
        testesRealizados: data.testesRealizados || '',
        valorMaoObra: data.valorMaoObra || 0,
        valorDesconto: data.valorDesconto || 0,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao buscar OS.');
    } finally {
      setIsLoading(false);
    }
  }, [osId]);

  // Carrega Itens da OS
  const fetchItens = useCallback(async () => {
    setIsLoadingItens(true);
    try {
      const data = await apiFetchJson<OrdemServicoItem[]>(`/api/ordens-servico/${osId}/itens`);
      setItens(data || []);
    } catch {
      // Ignora erro
    } finally {
      setIsLoadingItens(false);
    }
  }, [osId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchOs();
      fetchItens();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchOs, fetchItens]);

  useEffect(() => {
    let active = true;
    apiFetchJson<ConfiguracaoOficinaImpressao>('/api/configuracao-oficina')
      .then((data) => {
        if (active && data.nomeFantasia?.trim()) setConfiguracaoOficina(data);
      })
      .catch(() => {
        if (active) setConfiguracaoOficina(null);
      });
    return () => { active = false; };
  }, []);

  // Lazy loading do histórico da máquina ao acessar a aba correspondente
  const carregarHistoricoMaquina = useCallback(async (maquinaId: number) => {
    if (historicoCarregado || isLoadingHistorico) return;
    setIsLoadingHistorico(true);
    try {
      const res = await apiFetchJson<PageResponse<OrdemServico>>(
        `/api/maquinas/${maquinaId}/historico?page=0&size=15`
      );
      setHistoricoOs(res.content || []);
      setHistoricoCarregado(true);
    } catch (err: unknown) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Não foi possível carregar o histórico desta máquina.'
      );
    } finally {
      setIsLoadingHistorico(false);
    }
  }, [historicoCarregado, isLoadingHistorico, showToast]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'historico' && os?.maquinaId && !historicoCarregado) {
      carregarHistoricoMaquina(os.maquinaId);
    }
  };


  // Notificação WhatsApp contextual
  const handleAbrirWhatsApp = () => {
    if (!os) return;

    const res = gerarLinkWhatsappOS({
      telefone: os.clienteTelefone,
      clienteNome: os.clienteNome,
      equipamentoModelo: `${os.maquinaMarca || ''} ${os.maquinaModelo || ''}`.trim() || os.maquinaTipoDescricao || undefined,
      equipamentoNumeroSerie: os.maquinaNumeroSerie || undefined,
      numeroOs: os.numeroOs,
      status: os.status,
      problemaRelatado: os.problemaRelatado,
      diagnostico: os.diagnostico || undefined,
      valorPecas: os.valorPecas || 0,
      valorMaoObra: os.valorMaoObra || 0,
      valorDesconto: os.valorDesconto || 0,
      valorTotal: os.valorTotal || 0,
    });

    if (!res.url) {
      showToast('error', res.erro || 'Telefone do cliente inválido ou não informado para WhatsApp.');
      return;
    }

    window.open(res.url, '_blank', 'noopener,noreferrer');
  };

  // Salvar Laudo Técnico Contextual (sem abrir modal monolítico)
  const handleSalvarLaudo = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!os) return;

    setIsSavingLaudo(true);
    try {
      const payload: OrdemServicoUpdateData = {
        problemaRelatado: os.problemaRelatado,
        diagnostico: laudoForm.diagnostico.trim(),
        solucaoAplicada: laudoForm.solucaoAplicada.trim(),
        testesRealizados: laudoForm.testesRealizados.trim(),
        observacoes: os.observacoes?.trim() || undefined,
        horimetroAtual: os.horimetroAtual != null ? String(os.horimetroAtual) : undefined,
        valorMaoObra: Number(laudoForm.valorMaoObra) || 0,
        valorPecas: os.valorPecas || 0,
        valorDesconto: Number(laudoForm.valorDesconto) || 0,
      };

      const res = await apiFetch(`/api/ordens-servico/${os.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erro ao salvar alterações do laudo técnico.');
      }

      const atualizada: OrdemServico = await res.json();
      setOs(atualizada);
      showToast('success', 'Laudo técnico e valores atualizados com sucesso!');
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao salvar laudo.');
    } finally {
      setIsSavingLaudo(false);
    }
  };

  // Inserir modelo rápido de teste de bancada
  const aplicarModeloTeste = (texto: string) => {
    setLaudoForm((prev) => ({
      ...prev,
      testesRealizados: prev.testesRealizados
        ? `${prev.testesRealizados.trim()}\n${texto}`
        : texto,
    }));
    showToast('info', 'Modelo inserido no campo de testes. Totalmente editável.');
  };

  // Busca de Peças com Debounce de 400ms
  const handleBuscaPecaChange = (termo: string) => {
    setBuscaPecaTermo(termo);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!termo.trim()) {
      setPecasResultados([]);
      setIsSearchingPecas(false);
      return;
    }

    setIsSearchingPecas(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const res = await apiFetchJson<PageResponse<Produto>>(
          `/api/produtos?termo=${encodeURIComponent(termo.trim())}&ativo=true&size=10`
        );
        setPecasResultados(res.content || []);
      } catch {
        setPecasResultados([]);
      } finally {
        setIsSearchingPecas(false);
      }
    }, 400);
  };

  const handleOpenItemModal = () => {
    setBuscaPecaTermo('');
    setPecasResultados([]);
    setPecaSelecionada(null);
    setItemForm({
      produtoId: 0,
      quantidade: 1,
      valorDesconto: 0,
      observacoes: '',
    });
    setItemModalError(null);
    setIsItemModalOpen(true);
  };

  const handleSelectPeca = (p: Produto) => {
    setPecaSelecionada(p);
    setItemForm((prev) => ({
      ...prev,
      produtoId: p.id,
      quantidade: 1,
    }));
    setItemModalError(null);
  };

  // Submissão de Adição de Peça
  const handleAdicionarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemModalError(null);

    if (!itemForm.produtoId || !pecaSelecionada) {
      setItemModalError('Selecione uma peça ou componente do catálogo.');
      return;
    }

    if (itemForm.quantidade <= 0) {
      setItemModalError('A quantidade deve ser superior a zero.');
      return;
    }

    if (itemForm.quantidade > pecaSelecionada.estoqueAtual) {
      setItemModalError(
        `Saldo insuficiente em estoque! Disponível: ${pecaSelecionada.estoqueAtual} ${pecaSelecionada.unidadeMedida}`
      );
      return;
    }

    setIsSubmittingItem(true);
    try {
      await apiFetchJson(`/api/ordens-servico/${osId}/itens`, {
        method: 'POST',
        body: JSON.stringify({
          produtoId: itemForm.produtoId,
          quantidade: itemForm.quantidade,
          valorDesconto: itemForm.valorDesconto || 0,
          observacoes: itemForm.observacoes?.trim() || null,
        }),
      });

      setIsItemModalOpen(false);
      showToast('success', 'Peça adicionada e estoque deduzido com sucesso!');
      await Promise.all([fetchItens(), fetchOs()]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao adicionar peça à OS.';
      setItemModalError(msg);
    } finally {
      setIsSubmittingItem(false);
    }
  };

  // Remoção de Peça com Modal Visual (sem window.confirm)
  const handleConfirmarRemocaoItem = async () => {
    if (!itemParaRemover) return;

    setIsDeletingItem(true);
    try {
      await apiFetchJson(`/api/ordens-servico/${osId}/itens/${itemParaRemover.id}`, {
        method: 'DELETE',
      });
      showToast('success', `'${itemParaRemover.produtoNome}' removido e saldo estornado ao estoque.`);
      setItemParaRemover(null);
      await Promise.all([fetchItens(), fetchOs()]);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao remover peça da OS.');
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Abertura do Modal de Transição de Status
  const handleOpenStatusModal = (novoStatus: StatusOrdemServico) => {
    // Se for PRONTA, valida preventivamente se há testes de bancada com mínimo de 15 caracteres
    const testesAtuais = (laudoForm.testesRealizados || os?.testesRealizados || '').trim();
    if (novoStatus === 'PRONTA' && testesAtuais.length < 15) {
      showToast(
        'error',
        `Para marcar como PRONTA, registre os testes de bancada com no mínimo 15 caracteres (atual: ${testesAtuais.length}/15).`
      );
      setActiveTab('laudo');
      return;
    }

    setTargetStatus(novoStatus);
    setStatusTestes(testesAtuais);
    setStatusObs('');
    setIsStatusModalOpen(true);
  };

  // Submissão de Mudança de Status
  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus || !os) return;

    if (targetStatus === 'PRONTA' && statusTestes.trim().length < 15) {
      showToast(
        'error',
        'É obrigatório registrar testes técnicos de bancada com no mínimo 15 caracteres para liberar como PRONTA.'
      );
      return;
    }

    setIsSubmittingStatus(true);
    try {
      const payload: OrdemServicoStatusData = {
        status: targetStatus,
        testesRealizados: statusTestes.trim() || undefined,
        observacoes: statusObs.trim() || undefined,
      };

      const res = await apiFetch(`/api/ordens-servico/${os.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Falha ao alterar status da OS.');
      }

      const atualizada: OrdemServico = await res.json();
      setOs(atualizada);
      setIsStatusModalOpen(false);
      showToast('success', `Status alterado com sucesso para ${atualizada.statusDescricao}!`);
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Erro ao alterar status.');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex items-center justify-center text-muted">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span>Carregando Cockpit da Ordem de Serviço...</span>
        </div>
      </main>
    );
  }

  if (!os || errorMessage) {
    return (
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-ink">Não foi possível carregar a OS</h2>
        <p className="text-sm text-muted max-w-md">{errorMessage || 'Registro não localizado no sistema.'}</p>
        <Link
          href="/ordens-servico"
          className="px-4 py-2 rounded-xl bg-elevated hover:bg-hover text-ink text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4" />
          <span>Voltar para Lista de Ordens de Serviço</span>
        </Link>
      </main>
    );
  }

  const isTerminal = os.status === 'CONCLUIDA' || os.status === 'CANCELADA';
  const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
    bg: 'bg-elevated',
    text: 'text-ink',
    border: 'border-control',
  };

  const testesLength = (laudoForm.testesRealizados || '').trim().length;
  const isTestesValidosParaPronta = testesLength >= 15;

  return (
    <>

      {/* TOAST FLUTUANTE DE FEEDBACK (Sem alert() nativo) */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200 max-w-md print:hidden">
          <div
            className={`px-4 py-3 rounded-xl border shadow-xl flex items-start gap-3 ${
              toast.type === 'success'
                ? 'bg-surface/5 border-line text-ink'
                : toast.type === 'error'
                ? 'bg-danger/10 border-danger/40 text-danger'
                : 'bg-surface/5 border-line text-ink'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 aria-hidden="true" className="w-5 h-5 shrink-0 text-ink mt-0.5" />}
            {toast.type === 'error' && <AlertTriangle aria-hidden="true" className="w-5 h-5 shrink-0 text-danger mt-0.5" />}
            {toast.type === 'info' && <Info aria-hidden="true" className="w-5 h-5 shrink-0 text-ink mt-0.5" />}
            <div className="flex-1 text-xs font-medium leading-relaxed">{toast.message}</div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ui-icon-btn text-muted hover:text-ink p-0.5"
              aria-label="Fechar notificação"
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[1440px] w-full mx-auto p-3 sm:p-5 space-y-4 print:hidden">
        {/* BARRA SUPERIOR DE NAVEGAÇÃO E IDENTIFICAÇÃO DA OS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface/60 p-3.5 rounded-xl border border-line">
          <div className="flex items-center gap-3">
            <Link
              href="/ordens-servico"
              className="p-1.5 rounded-lg bg-elevated hover:bg-hover text-ink hover:text-ink transition-colors"
              title="Voltar para a lista de Ordens de Serviço"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/30">
                {os.numeroOs}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
              >
                {os.statusDescricao}
              </span>
            </div>
            <span className="hidden md:inline text-subtle">|</span>
            <span className="hidden md:inline text-xs text-ink font-semibold truncate max-w-sm">
              {os.maquinaMarca} {os.maquinaModelo}
            </span>
          </div>

          {/* AÇÕES DE EXPORTAÇÃO / IMPRESSÃO */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (!configuracaoOficina) {
                  showToast('error', 'Dados da oficina indisponíveis. Recarregue a página antes de imprimir.');
                  return;
                }
                window.print();
              }}
              className="ui-icon-btn px-3 py-1.5 rounded-lg bg-elevated hover:bg-hover text-ink font-semibold text-xs border border-control transition-all flex items-center gap-1.5 cursor-pointer"
              title="Imprimir recibo da Ordem de Serviço"
            >
              <Printer aria-hidden="true" className="w-3.5 h-3.5 text-ink" />
              <span>Imprimir recibo</span>
            </button>
          </div>
        </div>

        {/* COCKPIT DE BANCADA — 2 COLUNAS RESPONSIVAS (35% CONTEXTO / 65% BANCADA) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ========================================================================= */}
          {/* COLUNA ESQUERDA: CONTEXTO DA OS (~35% -> col-span-12 lg:col-span-4 xl:col-span-4) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 xl:col-span-4 space-y-4">
            {/* Card 1: Equipamento */}
            <div className="p-4 rounded-xl bg-surface/80 border border-line space-y-2.5">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-bold text-muted flex items-center gap-1.5">
                  <Wrench aria-hidden="true" className="w-3.5 h-3.5 text-accent" />
                  Equipamento
                </span>
                <Link
                  href={`/maquinas/${os.maquinaId}`}
                  className="text-xs text-accent hover:underline font-semibold flex items-center gap-1"
                  title="Acessar ficha completa do equipamento"
                >
                  <span>Ficha</span>
                  <ExternalLink aria-hidden="true" className="w-3 h-3" />
                </Link>
              </div>

              <div>
                <span className="text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                  {os.maquinaTipoDescricao}
                </span>
                <h3 className="text-sm font-bold text-ink mt-1">
                  {os.maquinaMarca} {os.maquinaModelo}
                </h3>

                <div className="text-xs text-muted space-y-1 mt-2">
                  {os.maquinaNumeroSerie && (
                    <p className="font-mono text-xs">
                      Nº de Série: <strong className="text-ink">{os.maquinaNumeroSerie}</strong>
                    </p>
                  )}
                  {os.maquinaPotencia && <p className="text-xs">Potência: {os.maquinaPotencia}</p>}
                  {os.maquinaTensao && <p className="text-xs">Tensão: {os.maquinaTensao}</p>}
                  {os.horimetroAtual != null && (
                    <p className="text-xs flex items-center gap-1 text-ink">
                      <Clock aria-hidden="true" className="w-3 h-3 text-subtle" />
                      Horímetro na Entrada: <strong>{os.horimetroAtual} h</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Cliente Proprietário */}
            <div className="p-4 rounded-xl bg-surface/80 border border-line space-y-2.5">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-bold text-muted flex items-center gap-1.5">
                  <User aria-hidden="true" className="w-3.5 h-3.5 text-accent" />
                  Cliente
                </span>
                <Link
                  href={`/clientes/${os.clienteId}`}
                  className="text-xs text-accent hover:underline font-semibold flex items-center gap-1"
                  title="Acessar cadastro do cliente"
                >
                  <span>Ficha</span>
                  <ExternalLink aria-hidden="true" className="w-3 h-3" />
                </Link>
              </div>

              <div>
                <h3 className="text-sm font-bold text-ink">{os.clienteNome}</h3>
                <div className="text-xs text-muted space-y-1.5 mt-2">
                  {os.clienteCpfCnpj && (
                    <p className="text-xs">
                      Documento:{' '}
                      <strong className="text-ink">{formatarDocumento(os.clienteCpfCnpj)}</strong>
                    </p>
                  )}
                  {os.clienteTelefone && (
                    <p className="text-xs">
                      Telefone:{' '}
                      <strong className="text-ink">{formatarTelefone(os.clienteTelefone)}</strong>
                    </p>
                  )}
                </div>

                {/* BOTÃO CONTEXTUAL DE WHATSAPP (Aviso de Retirada ou Orçamento) */}
                <div className="mt-3 pt-2.5 border-t border-line">
                  <button
                    type="button"
                    onClick={handleAbrirWhatsApp}
                    className="ui-btn ui-btn-secondary w-full"
                    title={
                      os.status === 'AGUARDANDO_APROVACAO'
                        ? 'Enviar orçamento via WhatsApp para aprovação'
                        : os.status === 'PRONTA'
                        ? 'Notificar cliente de retirada via WhatsApp'
                        : os.status === 'CONCLUIDA'
                        ? 'Enviar aviso de conclusão via WhatsApp'
                        : os.status === 'EM_DIAGNOSTICO'
                        ? 'Informar cliente sobre diagnóstico em andamento'
                        : os.status === 'EM_MANUTENCAO'
                        ? 'Informar cliente sobre andamento da manutenção'
                        : os.status === 'AGUARDANDO_PECA'
                        ? 'Informar cliente sobre espera de peça'
                        : os.status === 'ABERTA'
                        ? 'Confirmar recebimento do equipamento via WhatsApp'
                        : os.status === 'CANCELADA'
                        ? 'Informar cancelamento da Ordem de Serviço via WhatsApp'
                        : 'Contatar cliente via WhatsApp'
                    }
                  >
                    <MessageCircle aria-hidden="true" className="w-3.5 h-3.5" />
                    <span>
                      {os.status === 'AGUARDANDO_APROVACAO'
                        ? 'Enviar Orçamento WhatsApp'
                        : os.status === 'PRONTA'
                        ? 'Avisar Retirada no WhatsApp'
                        : os.status === 'CONCLUIDA'
                        ? 'Avisar Conclusão no WhatsApp'
                        : os.status === 'EM_DIAGNOSTICO'
                        ? 'Avisar Diagnóstico no WhatsApp'
                        : os.status === 'EM_MANUTENCAO'
                        ? 'Avisar Manutenção no WhatsApp'
                        : os.status === 'AGUARDANDO_PECA'
                        ? 'Avisar Espera de Peça'
                        : os.status === 'ABERTA'
                        ? 'Confirmar Entrada no WhatsApp'
                        : os.status === 'CANCELADA'
                        ? 'Avisar Cancelamento'
                        : 'Contatar via WhatsApp'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Card 3: Resumo Financeiro */}
            <div className="p-4 rounded-xl bg-surface/80 border border-line space-y-2">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-bold text-muted flex items-center gap-1.5">
                  <DollarSign aria-hidden="true" className="w-3.5 h-3.5 text-ink" />
                  Resumo Financeiro
                </span>
                <button
                  type="button"
                  onClick={() => handleTabChange('pecas')}
                  className="text-xs text-accent hover:underline font-semibold"
                >
                  Ver Peças
                </button>
              </div>

              <div className="space-y-2 text-sm tabular-nums">
                <div className="flex items-center justify-between text-muted">
                  <span>Mão de Obra:</span>
                  <span className="font-semibold text-ink">
                    {formatarMoeda(laudoForm.valorMaoObra || os.valorMaoObra)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>Peças ({itens.length}):</span>
                  <span className="font-semibold text-ink">{formatarMoeda(os.valorPecas)}</span>
                </div>
                {(laudoForm.valorDesconto > 0 || os.valorDesconto > 0) && (
                  <div className="flex items-center justify-between text-muted">
                    <span>Desconto:</span>
                    <span className="font-semibold">
                      - {formatarMoeda(laudoForm.valorDesconto || os.valorDesconto)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-line flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Total da OS:</span>
                  <span className="text-base font-semibold text-ink">
                    {formatarMoeda(
                      Math.max(
                        0,
                        (Number(laudoForm.valorMaoObra) || 0) +
                          (Number(os.valorPecas) || 0) -
                          (Number(laudoForm.valorDesconto) || 0)
                      )
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 4: Datas do Atendimento */}
            <div className="p-3.5 rounded-xl bg-surface/60 border border-line text-xs text-muted space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar aria-hidden="true" className="w-3 h-3 text-subtle" />
                  Entrada:
                </span>
                <strong className="text-ink">{formatarDataHora(os.dataEntrada)}</strong>
              </div>
              {os.previsaoConclusao && (
                <div className="flex items-center justify-between">
                  <span>Previsão:</span>
                  <strong className="text-ink">{formatarDataHora(os.previsaoConclusao)}</strong>
                </div>
              )}
              {os.dataConclusao && (
                <div className="flex items-center justify-between text-ink">
                  <span className="flex items-center gap-1">
                    <CheckCircle aria-hidden="true" className="w-3 h-3" />
                    Conclusão:
                  </span>
                  <strong>{formatarDataHora(os.dataConclusao)}</strong>
                </div>
              )}
            </div>

          </div>

          {/* ========================================================================= */}
          {/* COLUNA DIREITA: COCKPIT OPERACIONAL DE BANCADA COM ABAS (~65% -> col-span-12 lg:col-span-8) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-4">
            {/* FLUXO DE STATUS / TRANSIÇÕES DISPONÍVEIS */}
            <div className="p-3.5 rounded-xl bg-surface/80 border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">
                  Status Atual:
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  {os.statusDescricao}
                </span>
              </div>

              {isTerminal ? (
                <span className="text-xs text-subtle italic">
                  OS em estado terminal ({os.statusDescricao}). Alterações de status bloqueadas.
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Transições possíveis a partir de ABERTA */}
                  {os.status === 'ABERTA' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_DIAGNOSTICO')}
                        className="ui-btn ui-btn-secondary"
                      >
                        Iniciar Diagnóstico
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('AGUARDANDO_APROVACAO')}
                        className="ui-btn ui-btn-secondary"
                      >
                        Aguardar Aprovação
                      </button>
                    </>
                  )}

                  {/* Transições possíveis a partir de EM_DIAGNOSTICO */}
                  {os.status === 'EM_DIAGNOSTICO' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('AGUARDANDO_APROVACAO')}
                        className="ui-btn ui-btn-secondary"
                      >
                        Enviar p/ Aprovação
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_MANUTENCAO')}
                        className="ui-btn ui-btn-secondary"
                      >
                        Iniciar Manutenção
                      </button>
                    </>
                  )}

                  {/* Transições possíveis a partir de AGUARDANDO_APROVACAO */}
                  {os.status === 'AGUARDANDO_APROVACAO' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_MANUTENCAO')}
                        className="ui-btn ui-btn-secondary"
                      >
                        Aprovado (Iniciar Manutenção)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_DIAGNOSTICO')}
                        className="ui-btn ui-btn-secondary"
                      >
                        Reavaliar Diagnóstico
                      </button>
                    </>
                  )}

                  {/* Transições possíveis a partir de EM_MANUTENCAO */}
                  {os.status === 'EM_MANUTENCAO' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('AGUARDANDO_PECA')}
                        className="px-3 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent border border-accent/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        Aguardando Peça
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('PRONTA')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                          isTestesValidosParaPronta
                            ? 'bg-ink/5 hover:bg-ink/5 text-ink border-line shadow-sm shadow-none'
                            : 'bg-accent/10 hover:bg-accent/20 text-accent border-accent/30'
                        }`}
                        title={
                          isTestesValidosParaPronta
                            ? 'Liberar OS como PRONTA com testes de bancada validados'
                            : `Atenção: Necessário registrar testes com no mínimo 15 caracteres (atual: ${testesLength}/15)`
                        }
                      >
                        <Zap aria-hidden="true" className="w-3.5 h-3.5" />
                        <span>Liberar (PRONTA)</span>
                      </button>
                    </>
                  )}

                  {/* Transições possíveis a partir de AGUARDANDO_PECA */}
                  {os.status === 'AGUARDANDO_PECA' && (
                    <button
                      type="button"
                      onClick={() => handleOpenStatusModal('EM_MANUTENCAO')}
                      className="ui-btn ui-btn-secondary"
                    >
                      Peça Recebida (Retomar Manutenção)
                    </button>
                  )}

                  {/* Transições possíveis a partir de PRONTA */}
                  {os.status === 'PRONTA' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('CONCLUIDA')}
                        className="ui-btn ui-btn-primary"
                      >
                        <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" />
                        <span>Entregar e Concluir OS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_MANUTENCAO')}
                        className="ui-btn ui-btn-secondary"
                      >
                        Retornar p/ Manutenção
                      </button>
                    </>
                  )}

                  {/* Cancelar OS */}
                  <button
                    type="button"
                    onClick={() => handleOpenStatusModal('CANCELADA')}
                    className="px-2.5 py-1 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Ban aria-hidden="true" className="w-3 h-3" />
                    <span>Cancelar</span>
                  </button>
                </div>
              )}
            </div>

            {/* CABEÇALHO DE ABAS DO COCKPIT */}
            <div className="flex border-b border-line bg-surface/40 rounded-t-xl px-2 pt-2 gap-1 overflow-x-auto">
              <button
                type="button"
                id="tab-btn-laudo"
                onClick={() => handleTabChange('laudo')}
                className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-t border-x whitespace-nowrap ${
                  activeTab === 'laudo'
                    ? 'bg-surface text-accent border-accent/40 border-b-2 border-b-accent'
                    : 'text-muted hover:text-ink border-transparent hover:bg-surface/40'
                }`}
              >
                <Zap aria-hidden="true" className="w-3.5 h-3.5 text-accent" />
                <span>Laudo & Testes</span>
              </button>

              <button
                type="button"
                id="tab-btn-pecas"
                onClick={() => handleTabChange('pecas')}
                className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-t border-x whitespace-nowrap ${
                  activeTab === 'pecas'
                    ? 'bg-surface text-accent border-accent/40 border-b-2 border-b-accent'
                    : 'text-muted hover:text-ink border-transparent hover:bg-surface/40'
                }`}
              >
                <Package aria-hidden="true" className="w-3.5 h-3.5 text-ink" />
                <span>Peças & Serviços ({itens.length})</span>
              </button>

              <button
                type="button"
                id="tab-btn-historico"
                onClick={() => handleTabChange('historico')}
                className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-t border-x whitespace-nowrap ${
                  activeTab === 'historico'
                    ? 'bg-surface text-accent border-accent/40 border-b-2 border-b-accent'
                    : 'text-muted hover:text-ink border-transparent hover:bg-surface/40'
                }`}
              >
                <History aria-hidden="true" className="w-3.5 h-3.5 text-ink" />
                <span>Histórico da Máquina</span>
              </button>

              <button
                type="button"
                id="tab-btn-observacoes"
                onClick={() => handleTabChange('observacoes')}
                className={`px-3.5 py-2.5 text-xs font-bold rounded-t-lg transition-all flex items-center gap-2 cursor-pointer border-t border-x whitespace-nowrap ${
                  activeTab === 'observacoes'
                    ? 'bg-surface text-accent border-accent/40 border-b-2 border-b-accent'
                    : 'text-muted hover:text-ink border-transparent hover:bg-surface/40'
                }`}
              >
                <Clock aria-hidden="true" className="w-3.5 h-3.5 text-muted" />
                <span>Observações & Dados</span>
              </button>
            </div>

            {/* CONTEÚDO DA ABA ATIVA */}
            <div className="bg-surface/90 border border-line rounded-b-xl rounded-tr-xl p-4 sm:p-5 shadow-xl">
              {/* ================================================================= */}
              {/* ABA 1: [LAUDO & TESTES] */}
              {/* ================================================================= */}
              {activeTab === 'laudo' && (
                <form onSubmit={handleSalvarLaudo} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                        <Zap aria-hidden="true" className="w-4 h-4 text-accent" />
                        <span>Laudo Técnico e Testes de Bancada</span>
                      </h3>
                      <p className="text-xs text-muted mt-0.5">
                        Registre o diagnóstico, a intervenção técnica e os parâmetros apurados sob carga.
                      </p>
                    </div>

                    {!isTerminal && (
                      <button
                        type="submit"
                        disabled={isSavingLaudo}
                        className="ui-btn ui-btn-primary disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        {isSavingLaudo ? (
                          <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save aria-hidden="true" className="w-3.5 h-3.5" />
                        )}
                        <span>{isSavingLaudo ? 'Salvando...' : 'Salvar Laudo'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Diagnóstico Técnico */}
                    <div>
                      <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-1" className="block text-xs font-semibold text-ink mb-1">
                        Diagnóstico Técnico Constatado:
                      </label>
                      <textarea id="field-src-app-authenticated-ordens-servico-id-page-tsx-1"
                        rows={3}
                        disabled={isTerminal}
                        value={laudoForm.diagnostico}
                        onChange={(e) => setLaudoForm({ ...laudoForm, diagnostico: e.target.value })}
                        placeholder="Descreva o defeito constatado na bancada (ex: IGBTs em curto, diodo de roda livre estourado, falha na excitação do rotor)..."
                        className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50 disabled:opacity-60 leading-relaxed"
                      />
                    </div>

                    {/* Solução Aplicada */}
                    <div>
                      <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-2" className="block text-xs font-semibold text-ink mb-1">
                        Solução Técnica Aplicada:
                      </label>
                      <textarea id="field-src-app-authenticated-ordens-servico-id-page-tsx-2"
                        rows={3}
                        disabled={isTerminal}
                        value={laudoForm.solucaoAplicada}
                        onChange={(e) => setLaudoForm({ ...laudoForm, solucaoAplicada: e.target.value })}
                        placeholder="Descreva a solução executada (ex: Substituição do módulo de potência, limpeza química do bloco, regulagem do trimpot de corrente)..."
                        className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50 disabled:opacity-60 leading-relaxed"
                      />
                    </div>

                    {/* Testes Técnicos de Bancada (Mandatório para PRONTA) */}
                    <div className="sm:col-span-2 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-3" className="text-xs font-bold text-ink flex items-center gap-1.5">
                            <Zap aria-hidden="true" className="w-3.5 h-3.5" />
                            <span>Testes Realizados na Bancada (Obrigatório para status PRONTA):</span>
                          </label>
                        </div>

                        {/* Contador e Validação Visual de 15 Caracteres */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-mono px-2 py-0.5 rounded font-bold border ${
                              isTestesValidosParaPronta
                                ? 'bg-ink/5 text-ink border-line'
                                : testesLength > 0
                                ? 'bg-accent/10 text-accent border-accent/30'
                                : 'bg-elevated text-muted border-control'
                            }`}
                          >
                            {testesLength}/15 caracteres mínimos
                          </span>
                          {isTestesValidosParaPronta ? (
                            <span className="text-xs text-ink font-semibold flex items-center gap-1">
                              <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" />
                              <span>Válido para liberação</span>
                            </span>
                          ) : (
                            <span className="text-xs text-accent font-medium">
                              (mínimo 15 p/ PRONTA)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* MODELOS RÁPIDOS DE LAUDO (Editáveis e contextualizados) */}
                      {!isTerminal && (
                        <div className="p-3 rounded-xl bg-canvas border border-line space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
                              <Sparkles aria-hidden="true" className="w-3.5 h-3.5 text-accent" />
                              <span>Modelos Rápidos de Teste (clique para carregar e editar):</span>
                            </span>
                            <span className="text-xs text-subtle">Totalmente editáveis</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {/* Modelos Soldas */}
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-accent block">
                                Máquinas de Solda (TIG / MIG / MMA)
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    aplicarModeloTeste(
                                      'Arco elétrico estável a 180A por 15 minutos em ciclo contínuo sem oscilações.'
                                    )
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-all text-left cursor-pointer"
                                >
                                  Arco estável a 180A (15 min)
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    aplicarModeloTeste(
                                      'Teste de soldagem sob carga com arco estável e corrente nominal de bancada.'
                                    )
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-all text-left cursor-pointer"
                                >
                                  Solda estável sob carga
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    aplicarModeloTeste(
                                      'Equipamento testado sob carga com ventilação forçada em ciclo contínuo, sem desarme térmico.'
                                    )
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 transition-all text-left cursor-pointer"
                                >
                                  Carga contínua sem desarme
                                </button>
                              </div>
                            </div>

                            {/* Modelos Geradores */}
                            <div className="space-y-1">
                              <span className="text-xs font-bold text-ink block">
                                Geradores de Energia
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    aplicarModeloTeste(
                                      'Carga resistiva aplicada sob demanda, tensão estável em 220V e frequência em 60Hz.'
                                    )
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-ink/5 hover:bg-ink/5 text-ink border border-line transition-all text-left cursor-pointer"
                                >
                                  Tensão 220V / 60Hz estáveis
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    aplicarModeloTeste(
                                      'Partida, rotação e frequência testadas sob carga com resposta dinâmica estável.'
                                    )
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-ink/5 hover:bg-ink/5 text-ink border border-line transition-all text-left cursor-pointer"
                                >
                                  Partida e frequência estáveis
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    aplicarModeloTeste(
                                      'Teste de carga com aferição do regulador AVR e estabilização de voltagem plena.'
                                    )
                                  }
                                  className="px-2 py-1 rounded-md text-xs font-medium bg-ink/5 hover:bg-ink/5 text-ink border border-line transition-all text-left cursor-pointer"
                                >
                                  Regulação AVR satisfatória
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <textarea id="field-src-app-authenticated-ordens-servico-id-page-tsx-3"
                        rows={3}
                        disabled={isTerminal}
                        value={laudoForm.testesRealizados}
                        onChange={(e) => setLaudoForm({ ...laudoForm, testesRealizados: e.target.value })}
                        placeholder="Registre os testes executados na bancada (corrente, arco, voltagem, estabilização sob carga, etc)..."
                        className={`w-full px-3 py-2 rounded-xl bg-canvas border text-xs text-ink placeholder-subtle focus:outline-none leading-relaxed disabled:opacity-60 ${
                          isTestesValidosParaPronta
                            ? 'border-line focus:border-line'
                            : 'border-line focus:border-accent/50'
                        }`}
                      />
                    </div>

                    {/* Ajuste Rápido de Valores na Bancada */}
                    <div className="sm:col-span-2 pt-2 border-t border-line grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-4" className="block text-xs font-semibold text-ink mb-1">
                          Mão de Obra Técnica (R$):
                        </label>
                        <input id="field-src-app-authenticated-ordens-servico-id-page-tsx-4"
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={isTerminal}
                          value={laudoForm.valorMaoObra}
                          onChange={(e) =>
                            setLaudoForm({ ...laudoForm, valorMaoObra: Number(e.target.value) || 0 })
                          }
                          className="ui-field w-full border focus:outline-none focus:border-accent/50 disabled:opacity-60"
                        />
                      </div>

                      <div>
                        <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-5" className="block text-xs font-semibold text-ink mb-1">
                          Desconto (R$):
                        </label>
                        <input id="field-src-app-authenticated-ordens-servico-id-page-tsx-5"
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={isTerminal}
                          value={laudoForm.valorDesconto}
                          onChange={(e) =>
                            setLaudoForm({ ...laudoForm, valorDesconto: Number(e.target.value) || 0 })
                          }
                          className="ui-field w-full border focus:outline-none focus:border-accent/50 disabled:opacity-60"
                        />
                      </div>

                      <div className="flex flex-col justify-end">
                        <div className="p-2 rounded-xl bg-canvas border border-line flex items-center justify-between text-xs">
                          <span className="text-muted">Total Projetado:</span>
                          <span className="font-semibold text-ink text-sm">
                            {formatarMoeda(
                              Math.max(
                                0,
                                (Number(laudoForm.valorMaoObra) || 0) +
                                  (Number(os.valorPecas) || 0) -
                                  (Number(laudoForm.valorDesconto) || 0)
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              )}

              {/* ================================================================= */}
              {/* ABA 2: [PEÇAS & SERVIÇOS] */}
              {/* ================================================================= */}
              {activeTab === 'pecas' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-line pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                        <Package aria-hidden="true" className="w-4 h-4 text-ink" />
                        <span>Peças & Componentes Utilizados na OS</span>
                      </h3>
                      <p className="text-xs text-muted mt-0.5">
                        Baixa atômica de estoque e congelamento de preço histórico no momento da inclusão.
                      </p>
                    </div>

                    {!isTerminal && (
                      <button
                        type="button"
                        id="btn-adicionar-peca"
                        onClick={handleOpenItemModal}
                        className="ui-btn ui-btn-primary flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
                      >
                        <Plus aria-hidden="true" className="w-4 h-4" />
                        <span>Adicionar Peça</span>
                      </button>
                    )}
                  </div>

                  {isLoadingItens ? (
                    <div className="py-8 flex justify-center text-muted">
                      <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    </div>
                  ) : itens.length === 0 ? (
                    <div className="p-8 rounded-xl bg-canvas border border-dashed border-line text-center">
                      <Package className="w-8 h-8 text-subtle mx-auto mb-2" />
                      <p className="text-xs text-ink font-semibold">
                        Nenhuma peça ou componente vinculado a esta Ordem de Serviço.
                      </p>
                      {!isTerminal && (
                        <p className="text-xs text-subtle mt-1 max-w-md mx-auto">
                          Utilize a busca contextual para selecionar módulos, IGBTs, pontes retificadoras, AVRs e outros itens do estoque técnico.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="ui-table">
                        <thead>
                          <tr className="border-b border-line bg-canvas text-muted uppercase text-xs tracking-wider font-bold">
                            <th className="py-2.5 px-3">Código</th>
                            <th className="py-2.5 px-3">Peça / Componente</th>
                            <th className="py-2.5 px-3 text-center">Qtd</th>
                            <th className="py-2.5 px-3 text-right">Preço Unit.</th>
                            <th className="py-2.5 px-3 text-right">Desconto</th>
                            <th className="py-2.5 px-3 text-right">Subtotal</th>
                            <th className="py-2.5 px-3">Observações</th>
                            {!isTerminal && <th className="py-2.5 px-3 text-right">Ação</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60 bg-canvas/40">
                          {itens.map((item) => (
                            <tr key={item.id} className="hover:bg-elevated/30 transition-colors">
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="font-bold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded text-xs">
                                  {item.produtoCodigo}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-ink">
                                {item.produtoNome}
                              </td>
                              <td className="py-2.5 px-3 text-center font-bold text-ink">
                                {item.quantidade}
                              </td>
                              <td className="py-2.5 px-3 text-right text-ink">
                                {formatarMoeda(item.valorUnitario)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-danger">
                                {item.valorDesconto > 0 ? `- ${formatarMoeda(item.valorDesconto)}` : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-ink">
                                {formatarMoeda(item.valorTotal)}
                              </td>
                              <td className="py-2.5 px-3 text-muted text-xs">
                                {item.observacoes || '-'}
                              </td>
                              {!isTerminal && (
                                <td className="py-2.5 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setItemParaRemover(item)}
                                    className="ui-icon-btn p-1 text-subtle hover:text-danger rounded hover:bg-danger/10 transition-colors cursor-pointer"
                                    title={`Remover ${item.produtoNome} da OS`}
                                    aria-label={`Remover ${item.produtoNome} da OS`}
                                  >
                                    <Trash2 aria-hidden="true" className="w-4 h-4" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-line bg-canvas font-semibold text-xs">
                            <td colSpan={5} className="py-2.5 px-3 text-right text-muted">
                              Subtotal de Peças e Componentes:
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-ink">
                              {formatarMoeda(os.valorPecas)}
                            </td>
                            <td colSpan={isTerminal ? 1 : 2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* ABA 3: [HISTÓRICO DA MÁQUINA] (Contrato oficial /api/maquinas/{id}/historico) */}
              {/* ================================================================= */}
              {activeTab === 'historico' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-line pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                        <History aria-hidden="true" className="w-4 h-4 text-ink" />
                        <span>Histórico de Atendimentos do Equipamento</span>
                      </h3>
                      <p className="text-xs text-muted mt-0.5">
                        Consultando atendimentos anteriores da máquina {os.maquinaMarca} {os.maquinaModelo} (N/S: {os.maquinaNumeroSerie || 'S/N'}).
                      </p>
                    </div>

                    <Link
                      href={`/maquinas/${os.maquinaId}`}
                      className="text-xs text-ink hover:underline font-semibold flex items-center gap-1"
                    >
                      <span>Abrir Ficha da Máquina</span>
                      <ChevronRight aria-hidden="true" className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {isLoadingHistorico ? (
                    <div className="py-8 flex justify-center text-muted">
                      <div className="flex items-center gap-2 text-xs">
                        <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin text-ink" />
                        <span>Buscando atendimentos anteriores no banco...</span>
                      </div>
                    </div>
                  ) : historicoOs.length === 0 ? (
                    <div className="p-8 rounded-xl bg-canvas border border-dashed border-line text-center">
                      <History className="w-8 h-8 text-subtle mx-auto mb-2" />
                      <p className="text-xs text-ink font-semibold">
                        Nenhum atendimento anterior encontrado para esta máquina.
                      </p>
                      <p className="text-xs text-subtle mt-1">
                        Esta é a primeira Ordem de Serviço registrada para este equipamento no sistema.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {historicoOs.map((h) => {
                        const isThisOs = h.id === os.id;
                        const hBadge = STATUS_ORDEM_SERVICO_BADGES[h.status] || {
                          bg: 'bg-elevated',
                          text: 'text-ink',
                          border: 'border-control',
                        };

                        return (
                          <div
                            key={h.id}
                            className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isThisOs
                                ? 'bg-accent/5 border-accent/30'
                                : 'bg-canvas/60 border-line hover:border-control'
                            }`}
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-accent">
                                  {h.numeroOs}
                                </span>
                                {isThisOs && (
                                  <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30 uppercase">
                                    OS Atual
                                  </span>
                                )}
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${hBadge.bg} ${hBadge.text} ${hBadge.border}`}
                                >
                                  {h.statusDescricao}
                                </span>
                                <span className="text-xs text-muted">
                                  {formatarDataHora(h.dataEntrada)}
                                </span>
                              </div>
                              <p className="text-xs text-ink line-clamp-1">
                                <strong className="text-muted font-medium">Defeito:</strong> {h.problemaRelatado}
                              </p>
                              {h.solucaoAplicada && (
                                <p className="text-xs text-muted line-clamp-1">
                                  <strong className="text-subtle font-medium">Solução:</strong> {h.solucaoAplicada}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                              <span className="text-xs font-semibold text-ink">
                                {formatarMoeda(h.valorTotal)}
                              </span>
                              {!isThisOs && (
                                <Link
                                  href={`/ordens-servico/${h.id}`}
                                  className="px-2.5 py-1 rounded-lg bg-elevated hover:bg-hover text-ink text-xs font-semibold flex items-center gap-1 border border-control"
                                >
                                  <span>Visualizar</span>
                                  <ChevronRight aria-hidden="true" className="w-3 h-3" />
                                </Link>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ================================================================= */}
              {/* ABA 4: [OBSERVAÇÕES & DADOS] */}
              {/* ================================================================= */}
              {activeTab === 'observacoes' && (
                <div className="space-y-4">
                  <div className="border-b border-line pb-2.5">
                    <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                      <Clock aria-hidden="true" className="w-4 h-4 text-muted" />
                      <span>Dados Gerais e Observações da Entrada</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1.5">
                      <span className="font-semibold text-muted text-xs">
                        Defeito Relatado pelo Cliente na Entrada:
                      </span>
                      <p className="text-ink whitespace-pre-line leading-relaxed">
                        {os.problemaRelatado}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1.5">
                      <span className="font-semibold text-muted text-xs">
                        Observações Internas / Acessórios Deixados:
                      </span>
                      <p className="text-ink whitespace-pre-line leading-relaxed">
                        {os.observacoes || 'Nenhuma observação complementar registrada.'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1.5">
                      <span className="font-semibold text-muted text-xs">
                        Horímetro e Operação:
                      </span>
                      <p className="text-ink">
                        {os.horimetroAtual != null
                          ? `${os.horimetroAtual} horas registradas no recebimento do equipamento.`
                          : 'Horímetro não informado no recebimento.'}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-canvas border border-line space-y-1.5">
                      <span className="font-semibold text-muted text-xs">
                        Prazos e Histórico Operacional:
                      </span>
                      <div className="text-ink space-y-1">
                        <p>Entrada no laboratório: <strong>{formatarDataHora(os.dataEntrada)}</strong></p>
                        {os.previsaoConclusao && (
                          <p>Previsão de conclusão: <strong>{formatarDataHora(os.previsaoConclusao)}</strong></p>
                        )}
                        {os.dataConclusao && (
                          <p className="text-ink">
                            Conclusão de bancada: <strong>{formatarDataHora(os.dataConclusao)}</strong>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR PEÇA COM BUSCA CONTEXTUAL E DEBOUNCE (400ms) */}
      {/* ========================================================================= */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-canvas/80">
          <div
            data-testid="adicionar-peca-modal"
            className="ui-dialog border w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col min-w-0 overflow-hidden animate-in fade-in zoom-in-95"
          >
            <div className="p-3 sm:p-4 border-b border-line flex items-center justify-between gap-2 shrink-0">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2 min-w-0">
                <Package aria-hidden="true" className="w-4 h-4 text-accent shrink-0" />
                <span>Adicionar Peça / Componente à OS</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                aria-label="Fechar modal de adicionar peça"
                className="ui-icon-btn text-muted hover:text-ink text-xs font-semibold cursor-pointer p-1 shrink-0"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdicionarItem} className="flex flex-col flex-1 min-h-0">
              <div data-testid="adicionar-peca-modal-body" className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 sm:p-5 space-y-4">
              {itemModalError && (
                <div className="flex items-start gap-2 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs">
                  <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{itemModalError}</span>
                </div>
              )}

              {/* BUSCA DE PRODUTOS COM DEBOUNCE */}
              <div className="space-y-1.5">
                <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-6" className="block text-xs font-semibold text-ink">
                  Pesquisar Peça no Estoque (código, nome ou descrição) *
                </label>
                <div className="relative">
                  <Search aria-hidden="true" className="w-4 h-4 text-subtle absolute left-3 top-2.5" />
                  <input id="field-src-app-authenticated-ordens-servico-id-page-tsx-6"
                    type="text"
                    autoFocus
                    value={buscaPecaTermo}
                    onChange={(e) => handleBuscaPecaChange(e.target.value)}
                    placeholder="Digite para buscar (ex: IGBT, ponte, AVR, diodo)..."
                    className="ui-field w-full pl-9 pr-8 border focus:outline-none focus:border-accent/50 placeholder-subtle"
                  />
                  {buscaPecaTermo && (
                    <button
                      type="button"
                      onClick={() => handleBuscaPecaChange('')}
                      className="absolute right-2.5 top-2.5 text-subtle hover:text-ink"
                    >
                      <X aria-hidden="true" className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* RESULTADOS DA BUSCA */}
                {isSearchingPecas && (
                  <div className="py-2 text-center text-xs text-muted flex items-center justify-center gap-1.5">
                    <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin text-accent" />
                    <span>Pesquisando catálogo técnico...</span>
                  </div>
                )}

                {buscaPecaTermo.trim() && !isSearchingPecas && pecasResultados.length === 0 && (
                  <div className="p-2.5 text-center text-xs text-subtle bg-canvas rounded-lg border border-line">
                    Nenhuma peça encontrada para &quot;{buscaPecaTermo}&quot;.
                  </div>
                )}

                {pecasResultados.length > 0 && (
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-line divide-y divide-line bg-canvas">
                    {pecasResultados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectPeca(p)}
                        className={`w-full p-2 text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${
                          pecaSelecionada?.id === p.id
                            ? 'bg-accent/15 text-accent'
                            : 'hover:bg-elevated text-ink'
                        }`}
                      >
                        <div className="min-w-0 flex-1 break-words wrap-anywhere">
                          <span className="font-mono font-bold text-accent mr-2">[{p.codigo}]</span>
                          <span className="font-medium text-ink">{p.nome}</span>
                        </div>
                        <div className="text-right text-xs shrink-0 ml-2">
                          <span className="text-muted block">
                            Saldo: {p.estoqueAtual} {p.unidadeMedida}
                          </span>
                          <span className="font-bold text-ink">{formatarMoeda(p.precoVenda)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* CARD DA PEÇA SELECIONADA */}
              {pecaSelecionada && (
                <div className="p-3 rounded-xl bg-canvas border border-line space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs uppercase font-bold text-accent bg-accent/10 px-1.5 py-0.2 rounded border border-accent/20 break-words wrap-anywhere">
                        {pecaSelecionada.codigo}
                      </span>
                      <strong className="text-ink block mt-0.5 break-words wrap-anywhere">{pecaSelecionada.nome}</strong>
                    </div>
                    <span className="font-bold text-ink text-sm shrink-0">
                      {formatarMoeda(pecaSelecionada.precoVenda)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-line">
                    <div>
                      <span className="text-muted block">Saldo Disponível:</span>
                      <span
                        className={`font-bold ${
                          pecaSelecionada.estoqueAtual === 0
                            ? 'text-danger'
                            : pecaSelecionada.estoqueAtual <= pecaSelecionada.estoqueMinimo
                            ? 'text-accent'
                            : 'text-ink'
                        }`}
                      >
                        {pecaSelecionada.estoqueAtual} {pecaSelecionada.unidadeMedida}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block">Estoque Mínimo:</span>
                      <span className="text-ink">
                        {pecaSelecionada.estoqueMinimo} {pecaSelecionada.unidadeMedida}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* QUANTIDADE E DESCONTO */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-7" className="block text-xs font-semibold text-ink mb-1">
                    Quantidade *
                  </label>
                  <input id="field-src-app-authenticated-ordens-servico-id-page-tsx-7"
                    type="number"
                    step="1"
                    min="1"
                    max={pecaSelecionada ? pecaSelecionada.estoqueAtual : undefined}
                    value={itemForm.quantidade}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, quantidade: Number(e.target.value) || 0 })
                    }
                    className="ui-field w-full border focus:outline-none focus:border-accent/50"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-8" className="block text-xs font-semibold text-ink mb-1">
                    Desconto no Item (R$)
                  </label>
                  <input id="field-src-app-authenticated-ordens-servico-id-page-tsx-8"
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemForm.valorDesconto ?? 0}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, valorDesconto: parseFloat(e.target.value) || 0 })
                    }
                    className="ui-field w-full border focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>

              {/* SUBTOTAL PREVISTO */}
              {pecaSelecionada && (
                <div className="p-2.5 rounded-xl bg-canvas border border-line flex items-center justify-between text-xs">
                  <span className="text-muted">Subtotal da Peça na OS:</span>
                  <span className="font-bold text-ink text-sm">
                    {formatarMoeda(
                      Math.max(
                        0,
                        pecaSelecionada.precoVenda * itemForm.quantidade -
                          (itemForm.valorDesconto || 0)
                      )
                    )}
                  </span>
                </div>
              )}

              {/* OBSERVAÇÕES TÉCNICAS DO ITEM */}
              <div>
                <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-9" className="block text-xs font-semibold text-ink mb-1">
                  Observações Técnicas do Componente (Opcional)
                </label>
                <input id="field-src-app-authenticated-ordens-servico-id-page-tsx-9"
                  type="text"
                  value={itemForm.observacoes}
                  onChange={(e) => setItemForm({ ...itemForm, observacoes: e.target.value })}
                  placeholder="Ex: Módulo canal primário; Substituição preventiva"
                  className="ui-field w-full border focus:outline-none focus:border-accent/50"
                />
              </div>
              </div>

              {/* BOTÕES (rodapé fixo, sempre visível) */}
              <div className="flex items-center justify-end gap-2 p-3 sm:px-5 sm:py-4 border-t border-line shrink-0">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-elevated text-ink text-xs font-semibold hover:bg-hover transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingItem ||
                    !itemForm.produtoId ||
                    itemForm.quantidade <= 0 ||
                    (pecaSelecionada != null && itemForm.quantidade > pecaSelecionada.estoqueAtual)
                  }
                  className="ui-btn ui-btn-primary disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingItem ? (
                    <>
                      <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
                      <span>Adicionando...</span>
                    </>
                  ) : (
                    <span>Adicionar Peça</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Remoção de Peça (Padronizado via ConfirmModal) */}
      <ConfirmModal
        isOpen={!!itemParaRemover}
        title="Confirmar Remoção de Peça"
        message={
          itemParaRemover
            ? `Deseja remover a peça "${itemParaRemover.produtoNome}" (${itemParaRemover.produtoCodigo}) desta Ordem de Serviço? A quantidade de ${itemParaRemover.quantidade} unidades será estornada imediatamente ao estoque da oficina e o valor total da OS será recalculado.`
            : ''
        }
        confirmText="Remover Peça"
        cancelText="Cancelar"
        isDestructive={true}
        isLoading={isDeletingItem}
        onConfirm={handleConfirmarRemocaoItem}
        onCancel={() => setItemParaRemover(null)}
      />

      {/* ========================================================================= */}
      {/* MODAL DE TRANSIÇÃO DE STATUS */}
      {/* ========================================================================= */}
      {isStatusModalOpen && targetStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80">
          <div className="ui-dialog border w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-line flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <span>Alterar Status para:</span>
                <span className="text-accent">{STATUS_ORDEM_SERVICO_LABELS[targetStatus]}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="text-muted hover:text-ink text-xs font-semibold cursor-pointer p-1"
              >
                <X aria-hidden="true" className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmStatusChange} className="p-5 space-y-4">
              {targetStatus === 'PRONTA' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Zap aria-hidden="true" className="w-4 h-4" />
                      <span>Testes de Bancada Realizados:</span>
                    </span>
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded font-bold border ${
                        statusTestes.trim().length >= 15
                          ? 'bg-ink/5 text-ink border-line'
                          : 'bg-danger/10 text-danger border-danger/30'
                      }`}
                    >
                      {statusTestes.trim().length}/15 caracteres
                    </span>
                  </div>

                  <textarea aria-label="Descreva os testes técnicos executados na bancada..."
                    rows={3}
                    required
                    value={statusTestes}
                    onChange={(e) => setStatusTestes(e.target.value)}
                    placeholder="Descreva os testes técnicos executados na bancada..."
                    className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50 leading-relaxed"
                  />
                  {statusTestes.trim().length < 15 && (
                    <p className="text-xs text-danger flex items-center gap-1">
                      <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5" />
                      <span>Mínimo de 15 caracteres para validar a bancada antes de liberar como PRONTA.</span>
                    </p>
                  )}
                </div>
              )}

              {targetStatus === 'CONCLUIDA' && (
                <div className="p-3.5 rounded-xl bg-ink/5 border border-line text-xs text-ink">
                  <strong className="font-bold text-ink block mb-0.5">Entrega do Equipamento:</strong>
                  Ao concluir esta Ordem de Serviço, a data de conclusão será registrada e a OS será congelada para alterações operacionais.
                </div>
              )}

              {targetStatus === 'CANCELADA' && (
                <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/20 text-xs text-danger">
                  <strong className="font-bold text-ink block mb-0.5">Cancelamento da Ordem:</strong>
                  Ao cancelar a OS, o atendimento é encerrado e eventuais peças lançadas serão estornadas ao estoque pelo backend.
                </div>
              )}

              <div className="space-y-1">
                <label htmlFor="field-src-app-authenticated-ordens-servico-id-page-tsx-10" className="block text-xs font-semibold text-ink">
                  Observações da Transição (Opcional):
                </label>
                <input id="field-src-app-authenticated-ordens-servico-id-page-tsx-10"
                  type="text"
                  value={statusObs}
                  onChange={(e) => setStatusObs(e.target.value)}
                  placeholder="Ex: Orçamento aprovado via telefone pelo responsável..."
                  className="ui-field w-full border placeholder-subtle focus:outline-none focus:border-accent/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-elevated text-ink text-xs font-semibold hover:bg-hover transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingStatus ||
                    (targetStatus === 'PRONTA' && statusTestes.trim().length < 15)
                  }
                  className="ui-btn ui-btn-primary disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingStatus ? (
                    <>
                      <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Confirmar Mudança</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Componente Exclusivo de Impressão (A4) */}
      {configuracaoOficina && <OrdemServicoImpressao os={os} itens={itens} configuracao={configuracaoOficina} />}
    </>
  );
}
