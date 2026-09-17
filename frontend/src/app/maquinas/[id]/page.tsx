'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
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
import Header from '@/components/Header';
import MaquinaModal from '@/components/MaquinaModal';
import ConfirmModal from '@/components/ConfirmModal';
import {
  CurrentUser,
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
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
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
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Carregando dados do equipamento...</span>
        </div>
      </div>
    );
  }

  if (!maquina || errorMessage) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header user={currentUser} />
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <h2 className="text-xl font-bold text-white">Equipamento não localizado</h2>
          <p className="text-sm text-slate-400">{errorMessage}</p>
          <Link
            href="/maquinas"
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 transition-colors"
          >
            Voltar para Equipamentos
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={currentUser} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Navegação de Retorno */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/maquinas"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Todos os Equipamentos</span>
            </Link>
            <span className="text-slate-700">|</span>
            <Link
              href={`/clientes/${maquina.clienteId}`}
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-amber-400 transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              <span>Cliente: {maquina.clienteNome}</span>
            </Link>
          </div>
        </div>

        {/* Feedback de Ação Contextual (Substitui window.alert) */}
        {statusFeedback && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 shadow-md animate-in fade-in transition-all ${
              statusFeedback.tipo === 'sucesso'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusFeedback.tipo === 'sucesso' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{statusFeedback.mensagem}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusFeedback(null)}
              className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-0.5 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Alerta de Equipamento Inativo se aplicável */}
        {!maquina.ativo && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>
                <strong>Equipamento inativo no sistema:</strong> Não é permitido abrir novas Ordens de Serviço para este equipamento enquanto estiver inativo.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsStatusModalOpen(true)}
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white text-xs font-semibold shrink-0 cursor-pointer transition-colors"
            >
              Reativar agora
            </button>
          </div>
        )}

        {/* Card do Equipamento Técnico */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                <Wrench className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                    {maquina.tipoEquipamento === 'MAQUINA_SOLDA' && '⚡ '}
                    {maquina.tipoEquipamento === 'GERADOR_ENERGIA' && '🔋 '}
                    {maquina.tipoEquipamento === 'OUTRO_EQUIPAMENTO' && '🔧 '}
                    {TIPO_EQUIPAMENTO_LABELS[maquina.tipoEquipamento] || maquina.tipoEquipamento}
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      maquina.ativo
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/10 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {maquina.ativo ? 'Equipamento Ativo' : 'Inativo'}
                  </span>
                </div>
                <h1 className="text-2xl font-black text-white mt-1.5">
                  {maquina.marca} {maquina.modelo}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proprietário:{' '}
                  <Link
                    href={`/clientes/${maquina.clienteId}`}
                    className="font-bold text-white hover:text-amber-400 transition-colors"
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
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Editar</span>
              </button>

              {/* Botão Inativar / Reativar */}
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  maquina.ativo
                    ? 'bg-slate-800 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-slate-300 border-slate-700'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                }`}
              >
                <Power className="w-3.5 h-3.5" />
                <span>{maquina.ativo ? 'Inativar' : 'Reativar'}</span>
              </button>

              {/* Botão Hero + Nova OS */}
              {maquina.ativo ? (
                <Link
                  href={`/ordens-servico/nova?clienteId=${maquina.clienteId}&maquinaId=${maquina.id}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Ordem de Serviço</span>
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/50 text-slate-500 font-semibold text-xs sm:text-sm border border-slate-800 cursor-not-allowed opacity-60"
                  title="Equipamento inativo. Reative o equipamento para abrir nova OS."
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova OS (Inativo)</span>
                </button>
              )}
            </div>
          </div>

          {/* Ficha Técnica Rápida */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800/80 text-xs">
            <div>
              <span className="text-slate-500 font-medium block">Número de Série:</span>
              <span className="font-mono font-bold text-slate-200 mt-0.5 block">
                {maquina.numeroSerie || 'Não informado'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Potência / Capacidade:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">
                {maquina.potencia || 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Tensão de Trabalho:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">
                {maquina.tensao || 'Não informada'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Último Horímetro:</span>
              <span className="font-semibold text-slate-200 mt-0.5 block">
                {maquina.horimetro != null ? `${maquina.horimetro} horas` : 'Não registrado'}
              </span>
            </div>
          </div>

          {maquina.observacoes && (
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-xs">
              <span className="text-slate-500 font-medium block">Observações Técnicas:</span>
              <p className="text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                {maquina.observacoes}
              </p>
            </div>
          )}
        </div>

        {/* INDICADORES DO TOPO (4 CARDS DE KPI) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Atendimentos</span>
              <span className="text-xl font-black text-white">
                {resumo?.totalAtendimentos ?? ordens.length}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Última Manutenção</span>
              <span className="text-xs sm:text-sm font-bold text-white">
                {resumo?.ultimaManutencaoData
                  ? formatarDataHora(resumo.ultimaManutencaoData)
                  : 'Nenhuma'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Última OS</span>
              <span className="text-sm font-mono font-bold text-white">
                {resumo?.ultimaOsNumero ?? 'Nenhuma'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Total Acumulado</span>
              <span className="text-base sm:text-lg font-black text-emerald-400">
                {formatarMoeda(resumo?.valorAcumulado ?? 0)}
              </span>
              <span className="text-[9px] text-slate-500 block leading-tight">Somente OS Concluídas</span>
            </div>
          </div>
        </div>

        {/* HISTÓRICO DE ATENDIMENTOS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileText className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-white">Histórico de Ordens de Serviço</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300">
                {ordens.length} {ordens.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>

            {/* Alternador de Visualização: Tabela Compacta vs Linha do Tempo */}
            {ordens.length > 0 && (
              <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setVisualizacao('tabela')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    visualizacao === 'tabela'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Tabela</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualizacao('timeline')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    visualizacao === 'timeline'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Linha do Tempo</span>
                </button>
              </div>
            )}
          </div>

          {ordens.length === 0 ? (
            <div className="p-10 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-3 shadow-sm">
              <RotateCcw className="w-8 h-8 mx-auto text-slate-600" />
              <div>
                <p className="text-sm font-semibold text-white">
                  Este equipamento ainda não possui Ordens de Serviço.
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-0.5">
                  Esta máquina ainda não deu entrada em nenhuma manutenção na oficina.
                </p>
              </div>
              {maquina.ativo ? (
                <Link
                  href={`/ordens-servico/nova?clienteId=${maquina.clienteId}&maquinaId=${maquina.id}`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Primeira Entrada</span>
                </Link>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Reative o equipamento para poder emitir Ordens de Serviço.
                </p>
              )}
            </div>
          ) : visualizacao === 'tabela' ? (
            /* VISUALIZAÇÃO EM TABELA COMPACTA (PADRÃO OPERACIONAL) */
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-2.5 px-3.5">Nº OS</th>
                      <th className="py-2.5 px-3.5">Data Entrada</th>
                      <th className="py-2.5 px-3.5">Status</th>
                      <th className="py-2.5 px-3.5">Problema Relatado / Diagnóstico</th>
                      <th className="py-2.5 px-3.5 text-right">Peças</th>
                      <th className="py-2.5 px-3.5 text-right">Valor Total</th>
                      <th className="py-2.5 px-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {ordens.map((os) => {
                      const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                        bg: 'bg-slate-800',
                        text: 'text-slate-300',
                        border: 'border-slate-700',
                      };
                      return (
                        <tr key={os.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 font-mono font-bold text-amber-400">
                            <Link href={`/ordens-servico/${os.id}`} className="hover:underline">
                              {os.numeroOs}
                            </Link>
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-300 whitespace-nowrap">
                            {formatarDataHora(os.dataEntrada).split(' ')[0]}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {os.statusDescricao}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 max-w-sm">
                            <span className="text-white block font-medium truncate" title={os.problemaRelatado}>
                              {os.problemaRelatado}
                            </span>
                            {(os.solucaoAplicada || os.diagnostico) && (
                              <span
                                className="text-[11px] text-slate-400 block truncate mt-0.5"
                                title={os.solucaoAplicada || os.diagnostico || ''}
                              >
                                {os.solucaoAplicada ? `Solução: ${os.solucaoAplicada}` : `Diag: ${os.diagnostico}`}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono text-slate-400 whitespace-nowrap">
                            {formatarMoeda(os.valorPecas)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                            {formatarMoeda(os.valorTotal)}
                          </td>
                          <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                            <Link
                              href={`/ordens-servico/${os.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                            >
                              <span>Ver OS</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
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
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
              {ordens.map((os) => {
                const badge = STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                  bg: 'bg-slate-800',
                  text: 'text-slate-300',
                  border: 'border-slate-700',
                };
                const expandido = !!osExpandidas[os.id];
                const itens = itensPorOs[os.id] || [];
                const isLoadingItens = !!loadingItensOs[os.id];

                return (
                  <div key={os.id} className="relative group">
                    {/* Marcador na linha do tempo */}
                    <div className="absolute -left-6 top-5 w-4 h-4 rounded-full bg-slate-900 border-2 border-amber-500 group-hover:bg-amber-500 transition-colors" />

                    {/* Card do Atendimento */}
                    <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3.5 shadow-md">
                      {/* Topo do Atendimento */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 text-xs">
                            {os.numeroOs}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {os.statusDescricao}
                          </span>
                          {os.tecnicoNome && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 hidden md:flex">
                              <User className="w-3 h-3 text-slate-500" />
                              Técnico: <strong className="text-slate-200">{os.tecnicoNome}</strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            Entrada: {formatarDataHora(os.dataEntrada)}
                          </span>
                          {os.dataConclusao && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Saída: {formatarDataHora(os.dataConclusao)}
                              </span>
                            </>
                          )}
                          <Link
                            href={`/ordens-servico/${os.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 text-xs font-semibold border border-slate-700 transition-all ml-2 cursor-pointer"
                          >
                            <span>Ver OS</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Conteúdo Técnico */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                            Problema Relatado:
                          </span>
                          <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 min-h-[3.5rem]">
                            {os.problemaRelatado}
                          </p>
                        </div>

                        <div>
                          <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                            Diagnóstico Técnico:
                          </span>
                          <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 min-h-[3.5rem]">
                            {os.diagnostico || <span className="text-slate-500 italic">Sem diagnóstico registrado</span>}
                          </p>
                        </div>

                        <div>
                          <span className="font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                            Solução Aplicada:
                          </span>
                          <p className="text-slate-200 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 min-h-[3.5rem]">
                            {os.solucaoAplicada || <span className="text-slate-500 italic">Sem solução registrada</span>}
                          </p>
                        </div>
                      </div>

                      {/* Testes Realizados */}
                      {os.testesRealizados && (
                        <div className="pt-2 border-t border-slate-800/60 text-xs flex items-start gap-2 text-emerald-300">
                          <Zap className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          <span>
                            <strong className="text-emerald-400">Testes Validados:</strong> {os.testesRealizados}
                          </span>
                        </div>
                      )}

                      {/* Peças Utilizadas (Expansível) */}
                      <div className="pt-2 border-t border-slate-800/60 text-xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-300 font-medium">
                              Peças e Componentes:
                            </span>
                            <span className="text-slate-400 font-semibold">
                              {formatarMoeda(os.valorPecas)}
                            </span>
                          </div>

                          {os.valorPecas > 0 && (
                            <button
                              onClick={() => toggleItens(os.id)}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                            >
                              <span>{expandido ? 'Ocultar Peças' : 'Ver Peças Utilizadas'}</span>
                              {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>

                        {/* Tabela de Peças Expandidas */}
                        {expandido && (
                          <div className="mt-3 bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-hidden">
                            {isLoadingItens ? (
                              <div className="py-4 text-center text-slate-500 flex items-center justify-center gap-2">
                                <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                <span>Carregando peças aplicadas...</span>
                              </div>
                            ) : itens.length === 0 ? (
                              <p className="text-slate-500 py-2 text-center italic">
                                Nenhum item detalhado nesta OS.
                              </p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-500">
                                      <th className="pb-2">Peça / Insumo</th>
                                      <th className="pb-2 text-center">Qtd</th>
                                      <th className="pb-2 text-right">Valor Unit. (Histórico)</th>
                                      <th className="pb-2 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-900 text-slate-300">
                                    {itens.map((item) => (
                                      <tr key={item.id} className="hover:bg-slate-900/50">
                                        <td className="py-2">
                                          <span className="font-bold text-white">{item.produtoNome}</span>
                                          {item.produtoCodigo && (
                                            <span className="ml-2 font-mono text-[10px] text-slate-500">
                                              ({item.produtoCodigo})
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 text-center font-mono">
                                          {item.quantidade}
                                        </td>
                                        <td className="py-2 text-right font-mono text-slate-400">
                                          {formatarMoeda(item.valorUnitario)}
                                        </td>
                                        <td className="py-2 text-right font-mono font-bold text-slate-200">
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
                      <div className="flex items-center justify-between text-xs pt-2.5 border-t border-slate-800/80 text-slate-400">
                        <span>
                          Mão de Obra: {formatarMoeda(os.valorMaoObra)} • Peças: {formatarMoeda(os.valorPecas)}
                          {os.valorDesconto > 0 && ` • Desc: ${formatarMoeda(os.valorDesconto)}`}
                        </span>
                        <span className="text-sm font-bold text-white">
                          Total da OS:{' '}
                          <strong className="text-emerald-400 font-black">{formatarMoeda(os.valorTotal)}</strong>
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
    </div>
  );
}
