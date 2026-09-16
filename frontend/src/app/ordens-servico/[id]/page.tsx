'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  FileText,
  User,
  Wrench,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Calendar,
  DollarSign,
  Ban,
  CheckCircle,
  Package,
  Plus,
  Trash2,
  Loader2,
  Download,
  Printer,
  MessageCircle,
} from 'lucide-react';
import Header from '@/components/Header';
import OrdemServicoImpressao from '@/components/OrdemServicoImpressao';
import { gerarLinkWhatsappRetirada } from '@/lib/whatsappHelper';
import {
  CurrentUser,
  OrdemServico,
  OrdemServicoStatusData,
  OrdemServicoUpdateData,
  StatusOrdemServico,
  STATUS_ORDEM_SERVICO_BADGES,
  STATUS_ORDEM_SERVICO_LABELS,
  OrdemServicoItem,
  OrdemServicoItemFormData,
  Produto,
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

export default function OrdemServicoDetalhesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const osId = resolvedParams.id;
  const router = useRouter();

  // Usuário da Sessão
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Estados da OS
  const [os, setOs] = useState<OrdemServico | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados de Modais
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<StatusOrdemServico | null>(null);
  const [statusTestes, setStatusTestes] = useState('');
  const [statusObs, setStatusObs] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Estado do formulário de edição técnica e financeira
  const [editForm, setEditForm] = useState<OrdemServicoUpdateData>({
    problemaRelatado: '',
    diagnostico: '',
    solucaoAplicada: '',
    testesRealizados: '',
    observacoes: '',
    horimetroAtual: '',
    valorMaoObra: 0,
    valorPecas: 0,
    valorDesconto: 0,
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Download do PDF A4
  const handleGerarPdf = async () => {
    if (!os) return;
    setIsDownloadingPdf(true);
    try {
      const res = await apiFetch(`/api/ordens-servico/${os.id}/pdf`);
      if (!res.ok) {
        throw new Error('Falha ao gerar arquivo PDF da Ordem de Serviço.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OS-${os.numeroOs || os.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao baixar PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

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

  // Estados para Peças e Itens da OS
  const [itens, setItens] = useState<OrdemServicoItem[]>([]);
  const [isLoadingItens, setIsLoadingItens] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);
  const [produtoSelecionadoParaItem, setProdutoSelecionadoParaItem] = useState<Produto | null>(null);
  const [itemForm, setItemForm] = useState<OrdemServicoItemFormData>({
    produtoId: 0,
    quantidade: 1,
    valorDesconto: 0,
    observacoes: '',
  });
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

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

      // Preenche formulário de edição
      setEditForm({
        problemaRelatado: data.problemaRelatado || '',
        diagnostico: data.diagnostico || '',
        solucaoAplicada: data.solucaoAplicada || '',
        testesRealizados: data.testesRealizados || '',
        observacoes: data.observacoes || '',
        horimetroAtual: data.horimetroAtual != null ? String(data.horimetroAtual) : '',
        valorMaoObra: data.valorMaoObra || 0,
        valorPecas: data.valorPecas || 0,
        valorDesconto: data.valorDesconto || 0,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao buscar OS.');
    } finally {
      setIsLoading(false);
    }
  }, [osId]);

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

  const carregarProdutosDisponiveis = async () => {
    try {
      const data = await apiFetchJson<{ content: Produto[] }>('/api/produtos?ativo=true&size=100');
      setProdutosDisponiveis(data.content || []);
    } catch {
      // Ignora erro
    }
  };

  const handleOpenItemModal = () => {
    carregarProdutosDisponiveis();
    setProdutoSelecionadoParaItem(null);
    setItemForm({
      produtoId: 0,
      quantidade: 1,
      valorDesconto: 0,
      observacoes: '',
    });
    setItemError(null);
    setIsItemModalOpen(true);
  };

  const handleSelectProduto = (prodId: number) => {
    const p = produtosDisponiveis.find((item) => item.id === prodId) || null;
    setProdutoSelecionadoParaItem(p);
    setItemForm((prev) => ({
      ...prev,
      produtoId: prodId,
      quantidade: 1,
    }));
  };

  const handleAdicionarItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemError(null);

    if (!itemForm.produtoId) {
      setItemError('Selecione uma peça/produto.');
      return;
    }

    if (itemForm.quantidade <= 0) {
      setItemError('A quantidade deve ser superior a zero.');
      return;
    }

    if (produtoSelecionadoParaItem && itemForm.quantidade > produtoSelecionadoParaItem.estoqueAtual) {
      setItemError(
        `Saldo insuficiente em estoque! Disponível: ${produtoSelecionadoParaItem.estoqueAtual} ${produtoSelecionadoParaItem.unidadeMedida}`
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
      setSuccessMessage('Peça adicionada e estoque deduzido com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchItens();
      fetchOs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao adicionar peça';
      setItemError(msg);
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleRemoverItem = async (item: OrdemServicoItem) => {
    if (
      !confirm(
        `Deseja remover '${item.produtoNome}' da OS? A quantidade (${item.quantidade}) será estornada ao estoque.`
      )
    ) {
      return;
    }

    try {
      await apiFetchJson(`/api/ordens-servico/${osId}/itens/${item.id}`, {
        method: 'DELETE',
      });
      setSuccessMessage('Peça removida e saldo estornado ao estoque com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchItens();
      fetchOs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao remover peça';
      alert(msg);
    }
  };

  // Abertura do Modal de Transição de Status
  const handleOpenStatusModal = (novoStatus: StatusOrdemServico) => {
    setTargetStatus(novoStatus);
    setStatusTestes(os?.testesRealizados || '');
    setStatusObs('');
    setIsStatusModalOpen(true);
  };

  // Envio da Mudança de Status
  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus || !os) return;

    if (targetStatus === 'PRONTA' && !statusTestes.trim()) {
      alert('Para marcar a Ordem de Serviço como PRONTA, é obrigatório registrar os testes técnicos realizados na bancada.');
      return;
    }

    setIsSubmittingStatus(true);
    setErrorMessage(null);

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
      setSuccessMessage(`Status alterado com sucesso para ${atualizada.statusDescricao}!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao alterar status.');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Notificação de Retirada via WhatsApp (FEATURE-001)
  const handleAbrirWhatsApp = () => {
    if (!os) return;
    const res = gerarLinkWhatsappRetirada({
      telefone: os.clienteTelefone,
      clienteNome: os.clienteNome,
      equipamentoModelo: `${os.maquinaMarca || ''} ${os.maquinaModelo || ''}`.trim(),
      numeroOs: os.numeroOs,
      valorTotal: os.valorTotal || 0,
    });

    if (!res.url) {
      alert(res.erro || 'Telefone do cliente não informado ou inválido para WhatsApp.');
      return;
    }

    window.open(res.url, '_blank', 'noopener,noreferrer');
  };

  // Envio da Atualização Técnica e Financeira
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!os) return;

    setIsSubmittingEdit(true);
    setErrorMessage(null);

    try {
      const payload: OrdemServicoUpdateData = {
        problemaRelatado: editForm.problemaRelatado?.trim() || undefined,
        diagnostico: editForm.diagnostico?.trim() || undefined,
        solucaoAplicada: editForm.solucaoAplicada?.trim() || undefined,
        testesRealizados: editForm.testesRealizados?.trim() || undefined,
        observacoes: editForm.observacoes?.trim() || undefined,
        horimetroAtual: editForm.horimetroAtual ? editForm.horimetroAtual.replace(/\s+/g, '').replace(',', '.') : undefined,
        valorMaoObra: Number(editForm.valorMaoObra) || 0,
        valorPecas: Number(editForm.valorPecas) || 0,
        valorDesconto: Number(editForm.valorDesconto) || 0,
      };

      const res = await apiFetch(`/api/ordens-servico/${os.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Erro ao salvar alterações na OS.');
      }

      const atualizada: OrdemServico = await res.json();
      setOs(atualizada);
      setIsEditModalOpen(false);
      setSuccessMessage('Dados técnicos e financeiros atualizados com sucesso!');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar dados.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Carregando detalhes da Ordem de Serviço...</span>
        </div>
      </div>
    );
  }

  if (!os || errorMessage) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header user={currentUser} />
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-xl font-bold text-white">Não foi possível carregar a OS</h2>
          <p className="text-sm text-slate-400 max-w-md">{errorMessage || 'Registro não localizado no sistema.'}</p>
          <Link
            href="/ordens-servico"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Retornar para a Lista
          </Link>
        </main>
      </div>
    );
  }

  const isTerminal = os.status === 'CONCLUIDA' || os.status === 'CANCELADA';
  const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    border: 'border-slate-700',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="print:hidden">
        <Header user={currentUser} />
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6 print:hidden">
        {/* Navegação e Alertas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href="/ordens-servico"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Ordens de Serviço</span>
          </Link>

          {successMessage && (
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Cabeçalho Técnico da OS */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {os.numeroOs}
                  </span>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {os.statusDescricao}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-white mt-1.5">
                  Atendimento Técnico — {os.maquinaMarca} {os.maquinaModelo}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Entrada: <strong className="text-slate-200">{formatarDataHora(os.dataEntrada)}</strong>
                  </span>
                  {os.dataConclusao && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Conclusão: <strong>{formatarDataHora(os.dataConclusao)}</strong>
                      </span>
                    </>
                  )}
                  {os.horimetroAtual != null && (
                    <>
                      <span>•</span>
                      <span>
                        Horímetro na entrada: <strong className="text-slate-200">{os.horimetroAtual} h</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Ações Técnicas no Topo */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleGerarPdf}
                disabled={isDownloadingPdf}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Baixar Ordem de Serviço em PDF A4"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Gerar PDF</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Imprimir layout da Ordem de Serviço"
              >
                <Printer className="w-3.5 h-3.5 text-sky-400" />
                <span>Imprimir</span>
              </button>
              {(os.status === 'PRONTA' || os.status === 'CONCLUIDA') && (
                <button
                  type="button"
                  onClick={handleAbrirWhatsApp}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Avisar cliente via WhatsApp que o equipamento está pronto para retirada"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Avisar no WhatsApp</span>
                </button>
              )}
              {!isTerminal && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Editar Técnico / Valores</span>
                </button>
              )}
            </div>
          </div>

          {/* Barra de Ciclo de Vida e Transições de Status */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Fluxo de Transição da Oficina:
              </span>

              {isTerminal ? (
                <div className="text-xs text-slate-500 italic">
                  Esta Ordem de Serviço está em estado terminal ({os.statusDescricao}) e não aceita mais transições.
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Transições possíveis a partir de ABERTA */}
                  {os.status === 'ABERTA' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_DIAGNOSTICO')}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        Iniciar Diagnóstico
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('AGUARDANDO_APROVACAO')}
                        className="px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 text-xs font-bold transition-all cursor-pointer"
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
                        className="px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        Enviar p/ Aprovação
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_MANUTENCAO')}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all cursor-pointer"
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
                        className="px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        Aprovado (Iniciar Manutenção)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_DIAGNOSTICO')}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer"
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
                        className="px-3 py-1.5 rounded-lg bg-orange-500/15 hover:bg-orange-500/25 text-orange-400 border border-orange-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        Pausar (Aguardando Peça)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('PRONTA')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Finalizar e Validar Bancada (PRONTA)</span>
                      </button>
                    </>
                  )}

                  {/* Transições possíveis a partir de AGUARDANDO_PECA */}
                  {os.status === 'AGUARDANDO_PECA' && (
                    <button
                      type="button"
                      onClick={() => handleOpenStatusModal('EM_MANUTENCAO')}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all cursor-pointer"
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
                        className="px-3.5 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-slate-950 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-green-500/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Entregar e Concluir OS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenStatusModal('EM_MANUTENCAO')}
                        className="px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 text-xs font-bold transition-all cursor-pointer"
                      >
                        Retornar p/ Manutenção
                      </button>
                    </>
                  )}

                  {/* Botão de Cancelar sempre disponível para status não terminais */}
                  <button
                    type="button"
                    onClick={() => handleOpenStatusModal('CANCELADA')}
                    className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Cancelar OS</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* GRID PRINCIPAL: CLIENTE, EQUIPAMENTO E RESUMO FINANCEIRO */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card do Cliente */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-500" />
                Cliente Proprietário
              </span>
              <Link
                href={`/clientes/${os.clienteId}`}
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                Ver Ficha
              </Link>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{os.clienteNome}</h3>
              <div className="text-xs text-slate-400 space-y-1 mt-2">
                {os.clienteCpfCnpj && (
                  <p>
                    Documento:{' '}
                    <strong className="text-slate-200">{formatarDocumento(os.clienteCpfCnpj)}</strong>
                  </p>
                )}
                {os.clienteTelefone && (
                  <div className="flex items-center justify-between">
                    <p>
                      Contato:{' '}
                      <strong className="text-slate-200">{formatarTelefone(os.clienteTelefone)}</strong>
                    </p>
                    {(os.status === 'PRONTA' || os.status === 'CONCLUIDA') && (
                      <button
                        type="button"
                        onClick={handleAbrirWhatsApp}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                        title="Notificar cliente via WhatsApp"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Avisar Retirada</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card do Equipamento */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-500" />
                Equipamento em Manutenção
              </span>
              <Link
                href={`/maquinas/${os.maquinaId}`}
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                Histórico da Máquina
              </Link>
            </div>
            <div>
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {os.maquinaTipoDescricao}
              </span>
              <h3 className="text-base font-bold text-white mt-1.5">
                {os.maquinaMarca} {os.maquinaModelo}
              </h3>
              <div className="text-xs text-slate-400 space-y-1 mt-2">
                {os.maquinaNumeroSerie && (
                  <p className="font-mono">
                    Nº de Série: <strong className="text-slate-200">{os.maquinaNumeroSerie}</strong>
                  </p>
                )}
                {os.maquinaPotencia && <p>Potência: {os.maquinaPotencia}</p>}
                {os.maquinaTensao && <p>Tensão: {os.maquinaTensao}</p>}
              </div>
            </div>
          </div>

          {/* Card Financeiro Resumido */}
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Resumo Financeiro
              </span>
              {!isTerminal && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs text-amber-400 hover:underline font-semibold"
                >
                  Ajustar Valores
                </button>
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Mão de Obra / Serviços:</span>
                <span className="font-semibold text-slate-200">{formatarMoeda(os.valorMaoObra)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Peças e Componentes:</span>
                <span className="font-semibold text-slate-200">{formatarMoeda(os.valorPecas)}</span>
              </div>
              {os.valorDesconto > 0 && (
                <div className="flex items-center justify-between text-red-400">
                  <span>Desconto:</span>
                  <span className="font-semibold">- {formatarMoeda(os.valorDesconto)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Valor Total da OS:</span>
                <span className="text-lg font-black text-emerald-400">{formatarMoeda(os.valorTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* DETALHES TÉCNICOS: PROBLEMA, DIAGNÓSTICO, SOLUÇÃO E TESTES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Entrada e Sintoma Relatado */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-white">Problema Relatado na Entrada</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950 p-4 rounded-xl border border-slate-800/80">
              {os.problemaRelatado}
            </p>

            {os.observacoes && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Observações Gerais / Acessórios Deixados:
                </span>
                <p className="text-xs text-slate-400 whitespace-pre-line bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  {os.observacoes}
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Diagnóstico e Solução de Bancada */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Diagnóstico e Solução Técnica</h3>
              </div>
              {!isTerminal && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs text-cyan-400 hover:underline font-semibold"
                >
                  Editar
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Diagnóstico Técnico:
                </span>
                <p className="text-xs text-slate-300 mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800/80 min-h-[3rem]">
                  {os.diagnostico || 'Nenhum diagnóstico registrado até o momento.'}
                </p>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Solução Aplicada:
                </span>
                <p className="text-xs text-slate-300 mt-1 bg-slate-950 p-3 rounded-xl border border-slate-800/80 min-h-[3rem]">
                  {os.solucaoAplicada || 'Nenhuma solução técnica aplicada registrada.'}
                </p>
              </div>
            </div>
          </div>

          {/* Card 3: Testes Técnicos de Bancada (Mandatório para PRONTA) */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Testes Técnicos Realizados na Bancada</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                  Requisito de Qualidade
                </span>
              </div>
              {!isTerminal && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs text-emerald-400 hover:underline font-semibold"
                >
                  Registrar Testes
                </button>
              )}
            </div>

            {os.testesRealizados ? (
              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 text-sm text-slate-200 leading-relaxed whitespace-pre-line flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-xs uppercase text-emerald-400 font-bold block mb-1">
                    Histórico de Testes Validados:
                  </strong>
                  {os.testesRealizados}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white">Nenhum teste de bancada registrado ainda.</strong>
                  <p className="mt-0.5">
                    Antes de liberar esta máquina como <strong>PRONTA</strong>, realize os testes sob carga
                    (arco sob carga para máquinas de solda ou aferição de tensão/Hz sob carga para geradores)
                    e registre os parâmetros apurados.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Peças e Componentes Utilizados na OS (Integração com Estoque) */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Peças & Componentes Utilizados</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                </span>
                {itens.length > 0 && (
                  <span className="text-xs font-bold text-slate-300">
                    Total: {formatarMoeda(os.valorPecas)}
                  </span>
                )}
              </div>

              {!isTerminal && (
                <button
                  type="button"
                  id="adicionar-peca-os-btn"
                  onClick={handleOpenItemModal}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/10 cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Peça</span>
                </button>
              )}
            </div>

            {isLoadingItens ? (
              <div className="py-8 flex justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : itens.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center">
                <Package className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  Nenhuma peça ou componente vinculado a esta Ordem de Serviço até o momento.
                </p>
                {!isTerminal && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Clique em &quot;Adicionar Peça&quot; para registrar componentes técnicos (IGBTs, diodos, AVR, etc.) e baixar o estoque automaticamente.
                  </p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
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
                  <tbody className="divide-y divide-slate-800/60">
                    {itens.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded text-[11px]">
                            {item.produtoCodigo}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {item.produtoNome}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-200">
                          {item.quantidade}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {formatarMoeda(item.valorUnitario)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-red-400">
                          {item.valorDesconto > 0 ? `- ${formatarMoeda(item.valorDesconto)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                          {formatarMoeda(item.valorTotal)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {item.observacoes || '-'}
                        </td>
                        {!isTerminal && (
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoverItem(item)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remover peça e devolver ao estoque"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL 1: TRANSIÇÃO DE STATUS */}
      {isStatusModalOpen && targetStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Alterar Status para:</span>
                <span className="text-amber-400">{STATUS_ORDEM_SERVICO_LABELS[targetStatus]}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                ✕ Fechar
              </button>
            </div>

            <form onSubmit={handleConfirmStatusChange} className="p-5 space-y-4">
              {targetStatus === 'PRONTA' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Zap className="w-4 h-4" />
                    <span>Registro Obrigatório de Testes de Bancada:</span>
                  </div>

                  {/* Modelos de Laudos Rápidos (FEATURE-002) */}
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
                    <span className="text-[11px] font-semibold text-slate-400 block">
                      Modelos de Laudo Rápido (clique para carregar e editar):
                    </span>

                    {/* Modelos Máquina de Solda */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-bold text-amber-400/90 tracking-wider block">
                        Máquina de Solda
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStatusTestes('Arco elétrico estável a 180A por 15 minutos.')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all text-left"
                        >
                          Arco estável a 180A (15 min)
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusTestes('Teste de soldagem realizado com estabilidade de arco e corrente dentro dos parâmetros.')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all text-left"
                        >
                          Soldagem estável e corrente nominal
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusTestes('Equipamento testado sob carga, sem desarme térmico.')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all text-left"
                        >
                          Sob carga, sem desarme térmico
                        </button>
                      </div>
                    </div>

                    {/* Modelos Gerador */}
                    <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                      <span className="text-[10px] uppercase font-bold text-cyan-400/90 tracking-wider block">
                        Gerador de Energia
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setStatusTestes('Carga resistiva aplicada em 5 kVA, tensão estável em 220 V / 60 Hz.')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all text-left"
                        >
                          Carga 5 kVA / 220V 60Hz estável
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusTestes('Partida, tensão e frequência verificadas com funcionamento estável.')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all text-left"
                        >
                          Partida, tensão e frequência estáveis
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatusTestes('Teste de carga e regulador AVR realizado com resultado satisfatório.')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-all text-left"
                        >
                          Teste de carga e AVR satisfatório
                        </button>
                      </div>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    required
                    value={statusTestes}
                    onChange={(e) => setStatusTestes(e.target.value)}
                    placeholder="Selecione um modelo acima ou digite os testes de bancada realizados..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 leading-relaxed"
                  />
                </div>
              )}

              {targetStatus === 'CONCLUIDA' && (
                <div className="p-3.5 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-300">
                  <strong className="font-bold text-white block mb-0.5">Entrega do Equipamento:</strong>
                  Ao concluir esta Ordem de Serviço, a data de conclusão será registrada como agora ({new Date().toLocaleDateString('pt-BR')}) e a OS será congelada para alterações operacionais.
                </div>
              )}

              {targetStatus === 'CANCELADA' && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300">
                  <strong className="font-bold text-white block mb-0.5">Cancelamento da Ordem:</strong>
                  Ao cancelar a OS, o atendimento é encerrado e o equipamento poderá ser retirado sem faturamento de conserto.
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Observações da Transição (Opcional):
                </label>
                <input
                  type="text"
                  value={statusObs}
                  onChange={(e) => setStatusObs(e.target.value)}
                  placeholder="Ex: Orçamento aprovado via telefone pelo responsável técnico..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStatus}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {isSubmittingStatus ? 'Salvando...' : 'Confirmar Mudança de Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIÇÃO TÉCNICA E FINANCEIRA */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                <span>Editar Dados Técnicos e Financeiros — {os.numeroOs}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                ✕ Fechar
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Diagnóstico */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Diagnóstico Técnico Constatado:
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.diagnostico}
                    onChange={(e) => setEditForm({ ...editForm, diagnostico: e.target.value })}
                    placeholder="Ex: Curto no enrolamento primário do transformador auxiliar..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Solução Aplicada */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Solução Técnica Aplicada:
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.solucaoAplicada}
                    onChange={(e) => setEditForm({ ...editForm, solucaoAplicada: e.target.value })}
                    placeholder="Ex: Rebobinamento do rotor e substituição do conjunto de escovas..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Testes Técnicos */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Testes Técnicos Realizados na Bancada:
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.testesRealizados}
                    onChange={(e) => setEditForm({ ...editForm, testesRealizados: e.target.value })}
                    placeholder="Ex: Teste sob carga de 250A estável, ciclo de trabalho 100% OK..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                {/* Valores Financeiros */}
                <div className="sm:col-span-2 pt-2 border-t border-slate-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                    Valores da Ordem de Serviço (R$)
                  </h4>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mão de Obra Técnica (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.valorMaoObra}
                    onChange={(e) => setEditForm({ ...editForm, valorMaoObra: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Peças e Componentes (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.valorPecas}
                    disabled={itens.length > 0}
                    readOnly={itens.length > 0}
                    onChange={(e) => setEditForm({ ...editForm, valorPecas: Number(e.target.value) })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs text-white focus:outline-none ${
                      itens.length > 0
                        ? 'bg-slate-900/50 border-slate-800/80 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-950 border-slate-800 focus:border-amber-500/50'
                    }`}
                  />
                  {itens.length > 0 && (
                    <p className="mt-1 text-[11px] text-amber-400/90 flex items-center gap-1">
                      <span>ℹ️</span> Valor calculado a partir das peças lançadas.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Desconto (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.valorDesconto}
                    onChange={(e) => setEditForm({ ...editForm, valorDesconto: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Total Previsto:</span>
                    <span className="font-black text-emerald-400 text-sm">
                      {formatarMoeda(
                        Math.max(
                          0,
                          (Number(editForm.valorMaoObra) || 0) +
                            (Number(editForm.valorPecas) || 0) -
                            (Number(editForm.valorDesconto) || 0)
                        )
                      )}
                    </span>
                  </div>
                </div>

                {/* Observações */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Observações de Atendimento:
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.observacoes}
                    onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all"
                >
                  {isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADICIONAR PEÇA / COMPONENTE NA OS */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>Adicionar Peça à Ordem de Serviço</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            <form onSubmit={handleAdicionarItem} className="p-5 space-y-4">
              {itemError && (
                <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{itemError}</span>
                </div>
              )}

              {/* Seleção do Produto */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Selecione a Peça / Componente *
                </label>
                <select
                  value={itemForm.produtoId || ''}
                  onChange={(e) => handleSelectProduto(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  required
                >
                  <option value="">Selecione uma peça...</option>
                  {produtosDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.codigo}] {p.nome} — Saldo: {p.estoqueAtual} {p.unidadeMedida} — {formatarMoeda(p.precoVenda)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Painel de Saldo e Preço da Peça Selecionada */}
              {produtoSelecionadoParaItem && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Saldo Disponível:</span>
                    <span
                      className={`font-bold text-sm ${
                        produtoSelecionadoParaItem.estoqueAtual === 0
                          ? 'text-rose-400'
                          : produtoSelecionadoParaItem.estoqueAtual <= produtoSelecionadoParaItem.estoqueMinimo
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {produtoSelecionadoParaItem.estoqueAtual} {produtoSelecionadoParaItem.unidadeMedida}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Preço Unitário Atual:</span>
                    <span className="font-bold text-white text-sm">
                      {formatarMoeda(produtoSelecionadoParaItem.precoVenda)}
                    </span>
                  </div>
                </div>
              )}

              {/* Quantidade e Desconto */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Quantidade *
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max={produtoSelecionadoParaItem ? produtoSelecionadoParaItem.estoqueAtual : undefined}
                    value={itemForm.quantidade}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, quantidade: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Desconto no Item (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemForm.valorDesconto ?? 0}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, valorDesconto: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              {/* Total Previsto do Item */}
              {produtoSelecionadoParaItem && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Subtotal a ser adicionado na OS:</span>
                  <span className="font-bold text-emerald-400 text-sm">
                    {formatarMoeda(
                      Math.max(
                        0,
                        produtoSelecionadoParaItem.precoVenda * itemForm.quantidade -
                          (itemForm.valorDesconto || 0)
                      )
                    )}
                  </span>
                </div>
              )}

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observações Técnicas do Componente
                </label>
                <input
                  type="text"
                  value={itemForm.observacoes}
                  onChange={(e) => setItemForm({ ...itemForm, observacoes: e.target.value })}
                  placeholder="Ex: Substituição preventiva; Canal de potência primário"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500/50"
                />
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmittingItem ||
                    !itemForm.produtoId ||
                    itemForm.quantidade <= 0 ||
                    (produtoSelecionadoParaItem != null &&
                      itemForm.quantidade > produtoSelecionadoParaItem.estoqueAtual)
                  }
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmittingItem ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
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

      {/* Componente Exclusivo de Impressão (A4) */}
      <OrdemServicoImpressao os={os} itens={itens} />
    </div>
  );
}
