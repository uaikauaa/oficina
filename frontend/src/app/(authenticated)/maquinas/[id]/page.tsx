'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import DomainIcon from '@/components/ui/DomainIcon';
import Link from 'next/link';
import {
  X,
  ArrowLeft,
  Wrench,
  Zap,
  AlertCircle,
  FileText,
  Plus,
  ArrowUpRight,
  RotateCcw,
  Calendar,
  DollarSign,
  Package,
  ChevronDown,
  ChevronUp,
  User,
  Clock,
  CheckCircle2,
  Edit2,
  Power,
  Table as TableIcon,
} from 'lucide-react';
import MaquinaModal from '@/components/MaquinaModal';
import ConfirmModal from '@/components/ConfirmModal';
import {
  Maquina,
  MaquinaResumo,
  OrdemServico,
  OrdemServicoItem,
  PageResponse,
  STATUS_ORDEM_SERVICO_BADGES,
  TIPO_EQUIPAMENTO_LABELS,
} from '@/lib/types';
import { apiFetch, formatarMoeda, formatarDataHora } from '@/lib/api';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MaquinaDetalhesPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const maquinaId = resolvedParams.id;

  const [maquina, setMaquina] = useState<Maquina | null>(null);
  const [resumo, setResumo] = useState<MaquinaResumo | null>(null);
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Alternador de Visualização do Histórico: 'tabela' ou 'timeline'
  const [visualizacao, setVisualizacao] = useState<'tabela' | 'timeline'>('tabela');

  // Modais de Ação
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Armazena itens por OS e estado de expansão para a timeline
  const [itensPorOs, setItensPorOs] = useState<Record<number, OrdemServicoItem[]>>({});
  const [loadingItensOs, setLoadingItensOs] = useState<Record<number, boolean>>({});
  const [osExpandidas, setOsExpandidas] = useState<Record<number, boolean>>({});


  // Carrega dados da Máquina, Resumo (KPIs) e Histórico Completo com PARALELIZAÇÃO (Promise.all)
  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [resMaq, resResumo, resOs] = await Promise.all([
        apiFetch(`/api/maquinas/${maquinaId}`),
        apiFetch(`/api/maquinas/${maquinaId}/resumo`),
        apiFetch(`/api/maquinas/${maquinaId}/historico?size=50`),
      ]);

      if (!resMaq.ok) {
        if (resMaq.status === 404) {
          throw new Error('Equipamento não encontrado no sistema.');
        }
        throw new Error('Falha ao carregar dados do equipamento.');
      }

      const dataMaq: Maquina = await resMaq.json();
      setMaquina(dataMaq);

      if (resResumo.ok) {
        const dataResumo: MaquinaResumo = await resResumo.json();
        setResumo(dataResumo);
      }

      if (resOs.ok) {
        const dataOs: PageResponse<OrdemServico> = await resOs.json();
        setOrdens(dataOs.content ?? []);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao consultar equipamento.');
    } finally {
      setIsLoading(false);
    }
  }, [maquinaId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarDados();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarDados]);

  // Alterna expansão de peças para uma OS específica na timeline
  const toggleItens = async (osId: number) => {
    const expandir = !osExpandidas[osId];
    setOsExpandidas((prev) => ({ ...prev, [osId]: expandir }));

    if (expandir && !itensPorOs[osId]) {
      setLoadingItensOs((prev) => ({ ...prev, [osId]: true }));
      try {
        const res = await apiFetch(`/api/ordens-servico/${osId}/itens`);
        if (res.ok) {
          const data: OrdemServicoItem[] = await res.json();
          setItensPorOs((prev) => ({ ...prev, [osId]: data }));
        }
      } catch {
        // Ignora erro
      } finally {
        setLoadingItensOs((prev) => ({ ...prev, [osId]: false }));
      }
    }
  };

  // Feedback visual de ação de status
  const [statusFeedback, setStatusFeedback] = useState<{ tipo: 'sucesso' | 'erro'; mensagem: string } | null>(null);

  // Alterna status ativo/inativo
  const handleToggleStatus = async () => {
    if (!maquina) return;
    setIsChangingStatus(true);
    setStatusFeedback(null);
    try {
      const res = await apiFetch(`/api/maquinas/${maquina.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ ativo: !maquina.ativo }),
      });
      if (res.ok) {
        const atualizada: Maquina = await res.json();
        setMaquina(atualizada);
        setIsStatusModalOpen(false);
        setStatusFeedback({
          tipo: 'sucesso',
          mensagem: `Equipamento ${atualizada.ativo ? 'reativado' : 'inativado'} com sucesso!`,
        });
        setTimeout(() => setStatusFeedback(null), 4000);
      } else {
        const err = await res.json().catch(() => ({}));
        setIsStatusModalOpen(false);
        setStatusFeedback({
          tipo: 'erro',
          mensagem: err.message || 'Erro ao alterar status do equipamento.',
        });
        setTimeout(() => setStatusFeedback(null), 5000);
      }
    } catch {
      setIsStatusModalOpen(false);
      setStatusFeedback({
        tipo: 'erro',
        mensagem: 'Falha na comunicação com o servidor.',
      });
      setTimeout(() => setStatusFeedback(null), 5000);
    } finally {
      setIsChangingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span>Carregando dados do equipamento...</span>
        </div>
      </main>
    );
  }

  if (!maquina || errorMessage) {
    return (
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="w-12 h-12 text-danger" />
        <h2 className="text-xl font-bold text-ink">Equipamento não localizado</h2>
        <p className="text-sm text-muted">{errorMessage}</p>
        <Link
          href="/maquinas"
          className="px-4 py-2 rounded-xl bg-elevated text-ink text-xs font-semibold hover:bg-hover transition-colors"
        >
          Voltar para Equipamentos
        </Link>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navegação de Retorno */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/maquinas"
              className="inline-flex items-center gap-2 text-muted hover:text-ink transition-colors"
            >
              <ArrowLeft aria-hidden="true" className="w-4 h-4" />
              <span>Todos os Equipamentos</span>
            </Link>
            <span className="text-subtle">|</span>
            <Link
              href={`/clientes/${maquina.clienteId}`}
              className="inline-flex items-center gap-1.5 text-muted hover:text-accent transition-colors"
            >
              <User aria-hidden="true" className="w-4 h-4" />
              <span>Cliente: {maquina.clienteNome}</span>
            </Link>
          </div>
        </div>

        {/* Feedback de Ação Contextual (Substitui window.alert) */}
        {statusFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-md animate-in fade-in transition-all ${
              statusFeedback.tipo === 'sucesso'
                ? 'bg-ink/5 border-line text-ink'
                : 'bg-danger/10 border-danger/30 text-danger'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusFeedback.tipo === 'sucesso' ? (
                <CheckCircle2 aria-hidden="true" className="w-4 h-4 shrink-0 text-ink" />
              ) : (
                <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 text-danger" />
              )}
              <span>{statusFeedback.mensagem}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusFeedback(null)}
              aria-label="Fechar notificação"
              className="text-muted hover:text-ink text-xs font-semibold px-2 py-0.5 cursor-pointer"
            >
              <X aria-hidden="true" className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Alerta de Equipamento Inativo se aplicável */}
        {!maquina.ativo && (
          <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 text-danger" />
              <span>
                <strong>Equipamento inativo no sistema:</strong> Não é permitido abrir novas Ordens de Serviço para este equipamento enquanto estiver inativo.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-danger/20 hover:bg-danger/30 text-ink text-xs font-semibold shrink-0 cursor-pointer transition-colors"
            >
              Reativar agora
            </button>
          </div>
        )}

        {/* Card do Equipamento Técnico */}
        <div className="p-6 rounded-2xl bg-surface border border-line shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                <Wrench className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-accent bg-accent/10 px-2.5 py-0.5 rounded border border-accent/20">
                    <DomainIcon type={maquina.tipoEquipamento} className="inline-block w-4 h-4 mr-1.5 align-text-bottom" />
                    {TIPO_EQUIPAMENTO_LABELS[maquina.tipoEquipamento] || maquina.tipoEquipamento}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      maquina.ativo
                        ? 'bg-ink/5 text-ink border border-line'
                        : 'bg-elevated text-muted border border-control'
                    }`}
                  >
                    {maquina.ativo ? 'Equipamento Ativo' : 'Inativo'}
                  </span>
                </div>
                <h1 className="ui-page-title">
                  {maquina.marca} {maquina.modelo}
                </h1>
                <p className="text-xs text-muted mt-0.5">
                  Proprietário:{' '}
                  <Link
                    href={`/clientes/${maquina.clienteId}`}
                    className="font-bold text-ink hover:text-accent transition-colors"
                  >
                    {maquina.clienteNome}
                  </Link>
                </p>
              </div>
            </div>

            {/* Ações Rápidas no Cabeçalho */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* Botão Editar Equipamento */}
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-elevated hover:bg-hover text-ink text-xs font-semibold border border-control transition-colors cursor-pointer"
              >
                <Edit2 aria-hidden="true" className="w-4 h-4 text-muted" />
                <span>Editar</span>
              </button>

              {/* Botão Inativar / Reativar */}
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  maquina.ativo
                    ? 'bg-elevated hover:bg-danger/10 hover:border-danger/30 hover:text-danger text-ink border-control'
                    : 'bg-ink/5 hover:bg-ink/5 text-ink border-line'
                }`}
              >
                <Power aria-hidden="true" className="w-4 h-4" />
                <span>{maquina.ativo ? 'Inativar' : 'Reativar'}</span>
              </button>

              {/* Botão Hero + Nova OS */}
              {maquina.ativo ? (
                <Link
                  href={`/ordens-servico/nova?clienteId=${maquina.clienteId}&maquinaId=${maquina.id}`}
                  className="ui-btn ui-btn-primary inline-flex items-center justify-center gap-2 sm:text-sm transition-all cursor-pointer"
                >
                  <Plus aria-hidden="true" className="w-4 h-4" />
                  <span>Nova Ordem de Serviço</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="ui-icon-btn inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-elevated/50 text-subtle font-semibold text-xs sm:text-sm border border-line cursor-not-allowed opacity-60"
                  title="Equipamento inativo. Reative o equipamento para abrir nova OS."
                >
                  <Plus aria-hidden="true" className="w-4 h-4" />
                  <span>Nova OS (Inativo)</span>
                </button>
              )}
            </div>
          </div>

          {/* Ficha Técnica Rápida */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-line text-xs">
            <div>
              <span className="text-subtle font-medium block">Número de Série:</span>
              <span className="font-mono font-bold text-ink mt-0.5 block">
                {maquina.numeroSerie || 'Não informado'}
              </span>
            </div>
            <div>
              <span className="text-subtle font-medium block">Potência / Capacidade:</span>
              <span className="font-semibold text-ink mt-0.5 block">
                {maquina.potencia || 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-subtle font-medium block">Tensão de Trabalho:</span>
              <span className="font-semibold text-ink mt-0.5 block">
                {maquina.tensao || 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-subtle font-medium block">Último Horímetro:</span>
              <span className="font-semibold text-ink mt-0.5 block">
                {maquina.horimetro != null ? `${maquina.horimetro} horas` : 'Não registrado'}
              </span>
            </div>
          </div>

          {maquina.observacoes && (
            <div className="mt-4 pt-3 border-t border-line text-xs">
              <span className="text-subtle font-medium block">Observações Técnicas:</span>
              <p className="text-ink mt-1 whitespace-pre-wrap leading-relaxed">
                {maquina.observacoes}
              </p>
            </div>
          )}
        </div>

        {/* INDICADORES DO TOPO (4 CARDS DE KPI) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
              <RotateCcw aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-muted font-medium block">Atendimentos</span>
              <span className="text-xl font-semibold text-ink">
                {resumo?.totalAtendimentos ?? ordens.length}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-ink/5 border border-line flex items-center justify-center text-ink shrink-0">
              <Calendar aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-muted font-medium block">Última Manutenção</span>
              <span className="text-xs sm:text-sm font-bold text-ink">
                {resumo?.ultimaManutencaoData
                  ? formatarDataHora(resumo.ultimaManutencaoData)
                  : 'Nenhuma'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-ink/5 border border-line flex items-center justify-center text-ink shrink-0">
              <FileText aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-muted font-medium block">Última OS</span>
              <span className="text-sm font-mono font-bold text-ink">
                {resumo?.ultimaOsNumero ?? 'Nenhuma'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-surface/80 border border-line flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-ink/5 border border-line flex items-center justify-center text-ink shrink-0">
              <DollarSign aria-hidden="true" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-muted font-medium block">Total Acumulado</span>
              <span className="text-base sm:text-lg font-semibold text-ink">
                {formatarMoeda(resumo?.valorAcumulado ?? 0)}
              </span>
              <span className="text-xs text-subtle block leading-tight">Somente OS Concluídas</span>
            </div>
          </div>
        </div>

        {/* HISTÓRICO DE ATENDIMENTOS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileText aria-hidden="true" className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-bold text-ink">Histórico de Ordens de Serviço</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface border border-line text-ink">
                {ordens.length} {ordens.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {/* Alternador de Visualização: Tabela Compacta vs Linha do Tempo */}
            {ordens.length > 0 && (
              <div className="flex items-center gap-1.5 p-1 bg-surface border border-line rounded-xl">
                <button
                  type="button"
                  onClick={() => setVisualizacao('tabela')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    visualizacao === 'tabela'
                      ? 'bg-accent text-inverse font-bold shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <TableIcon aria-hidden="true" className="w-4 h-4" />
                  <span>Tabela</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualizacao('timeline')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    visualizacao === 'timeline'
                      ? 'bg-accent text-inverse font-bold shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  <Clock aria-hidden="true" className="w-4 h-4" />
                  <span>Linha do Tempo</span>
                </button>
              </div>
            )}
          </div>

          {ordens.length === 0 ? (
            <div className="p-10 rounded-2xl bg-surface/60 border border-line text-center space-y-3 shadow-sm">
              <RotateCcw className="w-8 h-8 mx-auto text-subtle" />
              <div>
                <p className="text-sm font-semibold text-ink">
                  Este equipamento ainda não possui Ordens de Serviço.
                </p>
                <p className="text-xs text-muted max-w-sm mx-auto mt-0.5">
                  Esta máquina ainda não deu entrada em nenhuma manutenção na oficina.
                </p>
              </div>
              {maquina.ativo ? (
                <Link
                  href={`/ordens-servico/nova?clienteId=${maquina.clienteId}&maquinaId=${maquina.id}`}
                  className="ui-btn ui-btn-primary inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus aria-hidden="true" className="w-4 h-4" />
                  <span>Registrar Primeira Entrada</span>
                </Link>
              ) : (
                <p className="text-xs text-subtle italic">
                  Reative o equipamento para poder emitir Ordens de Serviço.
                </p>
              )}
            </div>
          ) : visualizacao === 'tabela' ? (
            /* VISUALIZAÇÃO EM TABELA COMPACTA (PADRÃO OPERACIONAL) */
            <div className="rounded-2xl border border-line bg-surface/60 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="ui-table">
                  <thead>
                    <tr className="border-b border-line bg-surface/80 text-muted font-semibold text-xs">
                      <th className="py-2.5 px-3.5">Nº OS</th>
                      <th className="py-2.5 px-3.5">Data Entrada</th>
                      <th className="py-2.5 px-3.5">Status</th>
                      <th className="py-2.5 px-3.5">Problema Relatado / Diagnóstico</th>
                      <th className="py-2.5 px-3.5 text-right">Peças</th>
                      <th className="py-2.5 px-3.5 text-right">Valor Total</th>
                      <th className="py-2.5 px-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60 text-ink">
                    {ordens.map((os) => {
                      const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                        bg: 'bg-elevated',
                        text: 'text-ink',
                        border: 'border-control',
                      };
                      return (
                        <tr key={os.id} className="hover:bg-elevated/40 transition-colors">
                          <td className="py-2.5 px-3.5 font-mono font-bold text-accent">
                            <Link href={`/ordens-servico/${os.id}`} className="hover:underline">
                              {os.numeroOs}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3.5 text-ink whitespace-nowrap">
                            {formatarDataHora(os.dataEntrada).split(' ')[0]}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {os.statusDescricao}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 max-w-sm">
                            <span className="text-ink block font-medium truncate" title={os.problemaRelatado}>
                              {os.problemaRelatado}
                            </span>
                            {(os.solucaoAplicada || os.diagnostico) && (
                              <span
                                className="text-xs text-muted block truncate mt-0.5"
                                title={os.solucaoAplicada || os.diagnostico || ''}
                              >
                                {os.solucaoAplicada ? `Solução: ${os.solucaoAplicada}` : `Diag: ${os.diagnostico}`}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono text-muted whitespace-nowrap">
                            {formatarMoeda(os.valorPecas)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-ink whitespace-nowrap">
                            {formatarMoeda(os.valorTotal)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                            <Link
                              href={`/ordens-servico/${os.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-elevated hover:bg-hover text-ink text-xs font-semibold border border-control transition-colors cursor-pointer"
                            >
                              <span>Ver OS</span>
                              <ArrowUpRight aria-hidden="true" className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VISUALIZAÇÃO EM LINHA DO TEMPO DETALHADA */
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-elevated">
              {ordens.map((os) => {
                const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                  bg: 'bg-elevated',
                  text: 'text-ink',
                  border: 'border-control',
                };
                const expandido = !!osExpandidas[os.id];
                const itens = itensPorOs[os.id] || [];
                const isLoadingItens = !!loadingItensOs[os.id];

                return (
                  <div key={os.id} className="relative group">
                    {/* Marcador na linha do tempo */}
                    <div className="absolute -left-6 top-5 w-4 h-4 rounded-full bg-surface border-2 border-accent group-hover:bg-accent transition-colors" />

                    {/* Card do Atendimento */}
                    <div className="p-5 rounded-2xl bg-surface/80 border border-line hover:border-control transition-all space-y-3.5 shadow-md">
                      {/* Topo do Atendimento */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-accent bg-accent/10 px-2.5 py-0.5 rounded border border-accent/20 text-xs">
                            {os.numeroOs}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {os.statusDescricao}
                          </span>
                          {os.tecnicoNome && (
                            <span className="text-xs text-muted flex items-center gap-1 hidden md:flex">
                              <User aria-hidden="true" className="w-3 h-3 text-subtle" />
                              Técnico: <strong className="text-ink">{os.tecnicoNome}</strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Clock aria-hidden="true" className="w-3 h-3 text-subtle" />
                            Entrada: {formatarDataHora(os.dataEntrada)}
                          </span>
                          {os.dataConclusao && (
                            <>
                              <span>•</span>
                              <span className="text-ink flex items-center gap-1">
                                <CheckCircle2 aria-hidden="true" className="w-3 h-3 text-ink" />
                                Saída: {formatarDataHora(os.dataConclusao)}
                              </span>
                            </>
                          )}
                          <Link
                            href={`/ordens-servico/${os.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-elevated hover:bg-accent/20 hover:text-accent text-ink text-xs font-semibold border border-control transition-all ml-2 cursor-pointer"
                          >
                            <span>Ver OS</span>
                            <ArrowUpRight aria-hidden="true" className="w-4 h-4" />
                          </Link>
                        </div>
                      </div>

                      {/* Conteúdo Técnico */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="font-semibold text-muted block mb-1">
                            Problema Relatado:
                          </span>
                          <p className="text-ink bg-canvas p-2.5 rounded-lg border border-line min-h-[3.5rem]">
                            {os.problemaRelatado}
                          </p>
                        </div>

                        <div>
                          <span className="font-semibold text-muted block mb-1">
                            Diagnóstico Técnico:
                          </span>
                          <p className="text-ink bg-canvas p-2.5 rounded-lg border border-line min-h-[3.5rem]">
                            {os.diagnostico || <span className="text-subtle italic">Sem diagnóstico registrado</span>}
                          </p>
                        </div>

                        <div>
                          <span className="font-semibold text-muted block mb-1">
                            Solução Aplicada:
                          </span>
                          <p className="text-ink bg-canvas p-2.5 rounded-lg border border-line min-h-[3.5rem]">
                            {os.solucaoAplicada || <span className="text-subtle italic">Sem solução registrada</span>}
                          </p>
                        </div>
                      </div>

                      {/* Testes Realizados */}
                      {os.testesRealizados && (
                        <div className="pt-2 border-t border-line text-xs flex items-start gap-2 text-ink">
                          <Zap aria-hidden="true" className="w-4 h-4 text-ink shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-ink">Testes Validados:</strong> {os.testesRealizados}
                          </span>
                        </div>
                      )}

                      {/* Peças Utilizadas (Expansível) */}
                      <div className="pt-2 border-t border-line text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package aria-hidden="true" className="w-4 h-4 text-muted" />
                            <span className="text-ink font-medium">
                              Peças e Componentes:
                            </span>
                            <span className="text-muted font-semibold">
                              {formatarMoeda(os.valorPecas)}
                            </span>
                          </div>

                          {os.valorPecas > 0 && (
                            <button
                              onClick={() => toggleItens(os.id)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent transition-colors cursor-pointer"
                            >
                              <span>{expandido ? 'Ocultar Peças' : 'Ver Peças Utilizadas'}</span>
                              {expandido ? <ChevronUp aria-hidden="true" className="w-4 h-4" /> : <ChevronDown aria-hidden="true" className="w-4 h-4" />}
                            </button>
                          )}
                        </div>

                        {/* Tabela de Peças Expandidas */}
                        {expandido && (
                          <div className="mt-3 bg-canvas rounded-xl border border-line p-3 overflow-hidden">
                            {isLoadingItens ? (
                              <div className="py-4 text-center text-subtle flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                                <span>Carregando peças aplicadas...</span>
                              </div>
                            ) : itens.length === 0 ? (
                              <p className="text-subtle py-2 text-center italic">
                                Nenhum item detalhado nesta OS.
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="ui-table">
                                  <thead>
                                    <tr className="border-b border-line text-xs text-subtle">
                                      <th className="pb-2">Peça / Insumo</th>
                                      <th className="pb-2 text-center">Qtd</th>
                                      <th className="pb-2 text-right">Valor Unit. (Histórico)</th>
                                      <th className="pb-2 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-line text-ink">
                                    {itens.map((item) => (
                                      <tr key={item.id} className="hover:bg-surface/50">
                                        <td className="py-2">
                                          <span className="font-bold text-ink">{item.produtoNome}</span>
                                          {item.produtoCodigo && (
                                            <span className="ml-2 font-mono text-xs text-subtle">
                                              ({item.produtoCodigo})
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 text-center font-mono">
                                          {item.quantidade}
                                        </td>
                                        <td className="py-2 text-right font-mono text-muted">
                                          {formatarMoeda(item.valorUnitario)}
                                        </td>
                                        <td className="py-2 text-right font-mono font-bold text-ink">
                                          {formatarMoeda(item.valorTotal)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Rodapé Financeiro do Atendimento */}
                      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-line text-muted">
                        <span>
                          Mão de Obra: {formatarMoeda(os.valorMaoObra)} • Peças: {formatarMoeda(os.valorPecas)}
                          {os.valorDesconto > 0 && ` • Desc: ${formatarMoeda(os.valorDesconto)}`}
                        </span>
                        <span className="text-sm font-bold text-ink">
                          Total da OS:{' '}
                          <strong className="text-ink font-semibold">{formatarMoeda(os.valorTotal)}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Edição do Equipamento */}
      {maquina && (
        <MaquinaModal
          isOpen={isEditModalOpen}
          clienteId={maquina.clienteId}
          clienteNome={maquina.clienteNome}
          maquina={maquina}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={(atualizada) => {
            setMaquina(atualizada);
            setIsEditModalOpen(false);
            carregarDados();
          }}
        />
      )}

      {/* Modal de Confirmação de Status (Ativar/Inativar) */}
      {maquina && (
        <ConfirmModal
          isOpen={isStatusModalOpen}
          title={maquina.ativo ? 'Inativar Equipamento' : 'Reativar Equipamento'}
          message={
            maquina.ativo
              ? `Tem certeza que deseja inativar o equipamento ${maquina.marca} ${maquina.modelo}? Novas Ordens de Serviço não poderão ser abertas para máquinas inativas.`
              : `Deseja reativar o equipamento ${maquina.marca} ${maquina.modelo}? A máquina voltará a ficar disponível para emissão de Ordens de Serviço.`
          }
          confirmText={maquina.ativo ? 'Inativar Equipamento' : 'Reativar Equipamento'}
          cancelText="Cancelar"
          isDestructive={maquina.ativo}
          isLoading={isChangingStatus}
          onConfirm={handleToggleStatus}
          onCancel={() => setIsStatusModalOpen(false)}
        />
      )}
    </>
  );
}
