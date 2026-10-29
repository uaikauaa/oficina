'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import MetricCard from '@/components/ui/MetricCard';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Users,
  FileText,
  Boxes,
  BarChart3,
  Plus,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Eye,
  CheckSquare,
} from 'lucide-react';
import { useAuth } from '@/app/(authenticated)/layout';
import {
  OrdemServico,
  OrdemServicoContadoresDashboard,
  EstoqueResumo,
  STATUS_ORDEM_SERVICO_BADGES,
  STATUS_ORDEM_SERVICO_LABELS,
  PageResponse,
} from '@/lib/types';
import { apiFetch, formatarData } from '@/lib/api';

function obterSaudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatarDataHojeExtenso(): string {
  const agora = new Date();
  const dias = [
    'Domingo',
    'Segunda-Feira',
    'Terça-Feira',
    'Quarta-Feira',
    'Quinta-Feira',
    'Sexta-Feira',
    'Sábado',
  ];
  const meses = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  const diaSemana = dias[agora.getDay()];
  const dia = agora.getDate();
  const mes = meses[agora.getMonth()];
  const ano = agora.getFullYear();
  return `${diaSemana}, ${dia} de ${mes} de ${ano}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const dataHojeFormatada = useMemo(() => formatarDataHojeExtenso(), []);

  // 1. Contadores de Atenção de OS
  const [contadoresOs, setContadoresOs] = useState<OrdemServicoContadoresDashboard | null>(null);
  const [carregandoContadores, setCarregandoContadores] = useState(true);
  const [erroContadores, setErroContadores] = useState(false);

  // 2. Resumo de Estoque Crítico
  const [estoqueResumo, setEstoqueResumo] = useState<EstoqueResumo | null>(null);
  const [carregandoEstoque, setCarregandoEstoque] = useState(true);
  const [erroEstoque, setErroEstoque] = useState(false);

  // 3. Ordens de Serviço Recentes
  const [ordensRecentes, setOrdensRecentes] = useState<OrdemServico[]>([]);
  const [carregandoRecentes, setCarregandoRecentes] = useState(true);
  const [erroRecentes, setErroRecentes] = useState(false);

  // Busca de Contadores de OS (Painel de Atenção)
  const carregarContadoresOs = useCallback(async () => {
    setCarregandoContadores(true);
    setErroContadores(false);
    try {
      const res = await apiFetch('/api/ordens-servico/contadores-dashboard');
      if (res.ok) {
        const dados: OrdemServicoContadoresDashboard = await res.json();
        setContadoresOs(dados);
      } else {
        // Fallback resiliente caso endpoint específico falhe
        const [resProntas, resAprov, resManut] = await Promise.all([
          apiFetch('/api/ordens-servico?status=PRONTA&size=1'),
          apiFetch('/api/ordens-servico?status=AGUARDANDO_APROVACAO&size=1'),
          apiFetch('/api/ordens-servico?status=EM_MANUTENCAO&size=1'),
        ]);
        const prontas = resProntas.ok ? (await resProntas.json()).totalElements ?? 0 : 0;
        const aguardandoAprovacao = resAprov.ok ? (await resAprov.json()).totalElements ?? 0 : 0;
        const emManutencao = resManut.ok ? (await resManut.json()).totalElements ?? 0 : 0;
        setContadoresOs({ prontas, aguardandoAprovacao, emManutencao });
      }
    } catch {
      setErroContadores(true);
    } finally {
      setCarregandoContadores(false);
    }
  }, []);

  // Busca de Resumo de Estoque
  const carregarEstoque = useCallback(async () => {
    setCarregandoEstoque(true);
    setErroEstoque(false);
    try {
      const res = await apiFetch('/api/estoque/resumo');
      if (res.ok) {
        const dados: EstoqueResumo = await res.json();
        setEstoqueResumo(dados);
      } else {
        setErroEstoque(true);
      }
    } catch {
      setErroEstoque(true);
    } finally {
      setCarregandoEstoque(false);
    }
  }, []);

  // Busca de Ordens Recentes (Visão de Bancada)
  const carregarOrdensRecentes = useCallback(async () => {
    setCarregandoRecentes(true);
    setErroRecentes(false);
    try {
      const res = await apiFetch('/api/ordens-servico?size=5&sort=dataEntrada,desc');
      if (res.ok) {
        const page: PageResponse<OrdemServico> = await res.json();
        setOrdensRecentes(page.content || []);
      } else {
        setErroRecentes(true);
      }
    } catch {
      setErroRecentes(true);
    } finally {
      setCarregandoRecentes(false);
    }
  }, []);

  // Carga dos indicadores operacionais
  useEffect(() => {
    const timer = setTimeout(() => {
      carregarContadoresOs();
      carregarEstoque();
      carregarOrdensRecentes();
    }, 0);
    return () => clearTimeout(timer);
  }, [carregarContadoresOs, carregarEstoque, carregarOrdensRecentes]);

  const nomeExibicao = user?.nome ? user.nome.split(' ')[0] : 'Geisa';

  return (
    <main className="ui-page flex-1 space-y-7">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-line pb-6">
        <div>
          <p className="text-xs text-muted mb-2">Painel Operacional · {dataHojeFormatada}</p>
          <h1 className="ui-page-title">{obterSaudacao()}, {nomeExibicao}!</h1>
          <p className="text-sm text-muted mt-2">Atendimentos em andamento e prioridades da oficina.</p>
        </div>
        <Link href="/ordens-servico/nova" className="ui-btn ui-btn-primary shrink-0 self-start" aria-label="Abrir Nova Ordem de Serviço">
          <Plus aria-hidden="true" className="w-4 h-4" />Nova Ordem de Serviço
        </Link>
      </div>

      <section aria-labelledby="resumo-oficina" className="space-y-4">
        <h2 id="resumo-oficina" className="ui-section-title">Resumo da Oficina</h2>
        {erroContadores && (
          <div role="alert" className="ui-panel p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-danger">
            <span>Não foi possível carregar os contadores de ordens de serviço.</span>
            <button onClick={carregarContadoresOs} className="ui-btn ui-btn-secondary"><RefreshCw aria-hidden="true" className="w-4 h-4" />Tentar novamente</button>
          </div>
        )}
        {erroEstoque && (
          <div role="alert" className="ui-panel p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-danger">
            <span>Não foi possível carregar o resumo de estoque.</span>
            <button onClick={carregarEstoque} className="ui-btn ui-btn-secondary"><RefreshCw aria-hidden="true" className="w-4 h-4" />Tentar novamente</button>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard label="Prontas p/ Retirada" value={carregandoContadores ? '…' : contadoresOs?.prontas ?? '—'} description="Equipamentos prontos para entrega" href="/ordens-servico?status=PRONTA" icon={CheckSquare} />
          <MetricCard label="Aguardando Aprovação" value={carregandoContadores ? '…' : contadoresOs?.aguardandoAprovacao ?? '—'} description="Orçamentos pendentes de resposta" href="/ordens-servico?status=AGUARDANDO_APROVACAO" icon={Clock} />
          <MetricCard label="Em Manutenção" value={carregandoContadores ? '…' : contadoresOs?.emManutencao ?? '—'} description="Máquinas em serviço na bancada" href="/ordens-servico?status=EM_MANUTENCAO" icon={Wrench} />
          <MetricCard label="Estoque Crítico" value={carregandoEstoque || erroEstoque ? '—' : estoqueResumo?.itensEstoqueBaixo ?? 0} description="Peças no mínimo ou sem estoque" href="/estoque" icon={AlertTriangle} attention />
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. VISÃO DE BANCADA RECENTE (ÚLTIMAS OS)                                   */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <FileText aria-hidden="true" className="w-4 h-4 text-muted" />
              <h2 className="text-xs sm:text-sm font-bold text-ink">
                Ordens Recentes
              </h2>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Últimos atendimentos registrados na oficina.
            </p>
          </div>

          <Link
            href="/ordens-servico"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent transition-colors shrink-0"
          >
            <span>Ver todas as OS</span>
            <ArrowRight aria-hidden="true" className="w-4 h-4" />
          </Link>
        </div>

        {erroRecentes && (
          <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger flex items-center justify-between">
            <span>Não foi possível carregar a lista de ordens recentes.</span>
            <button
              onClick={carregarOrdensRecentes}
              className="px-3 py-1 rounded-lg bg-danger/20 hover:bg-danger/30 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw aria-hidden="true" className="w-4 h-4" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        {carregandoRecentes ? (
          <div className="p-6 rounded-2xl bg-surface border border-line space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-11 bg-elevated/60 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : ordensRecentes.length === 0 ? (
          /* Estado Vazio */
          <div className="p-8 sm:p-12 rounded-2xl bg-surface border border-line text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-elevated/80 border border-control flex items-center justify-center text-muted mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink">
                Nenhuma Ordem de Serviço registrada ainda
              </h3>
              <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                Inicie o primeiro atendimento técnico clicando no botão abaixo.
              </p>
            </div>
            <Link
              href="/ordens-servico/nova"
              className="ui-btn ui-btn-primary inline-flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus aria-hidden="true" className="w-4 h-4 " />
              <span>Abrir Primeira Ordem de Serviço</span>
            </Link>
          </div>
        ) : (
          /* Tabela de OS Recentes */
          <div className="rounded-2xl bg-surface border border-line overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="ui-table">
                <thead>
                  <tr className="border-b border-line bg-canvas text-muted font-semibold text-xs">
                    <th className="py-3 px-4 font-semibold">Número OS</th>
                    <th className="py-3 px-4 font-semibold">Cliente</th>
                    <th className="py-3 px-4 font-semibold">Equipamento</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Data Entrada</th>
                    <th className="py-3 px-4 text-right font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60 text-ink">
                  {ordensRecentes.map((os) => {
                    const badge =
                      STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                        bg: 'bg-elevated',
                        text: 'text-ink',
                        border: 'border-control',
                      };
                    const statusNome =
                      STATUS_ORDEM_SERVICO_LABELS[os.status] || os.status;

                    return (
                      <tr
                        key={os.id}
                        className="hover:bg-elevated/30 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/ordens-servico/${os.id}`)}
                      >
                        {/* Número OS */}
                        <td className="py-3 px-4 font-mono font-bold text-ink group-hover:text-accent transition-colors">
                          {os.numeroOs}
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-4 font-medium text-ink">
                          {os.clienteNome || 'Cliente não identificado'}
                        </td>

                        {/* Equipamento */}
                        <td className="py-3 px-4 text-ink">
                          {os.maquinaMarca || os.maquinaModelo ? (
                            <span>
                              {os.maquinaMarca} {os.maquinaModelo}
                            </span>
                          ) : (
                            <span className="text-subtle">Equipamento não especificado</span>
                          )}
                        </td>

                        {/* Status em Pill Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                          >
                            {statusNome}
                          </span>
                        </td>

                        {/* Data de Entrada */}
                        <td className="py-3 px-4 text-muted">
                          {formatarData(os.dataEntrada as unknown as string)}
                        </td>

                        {/* Ação para Abrir */}
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/ordens-servico/${os.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-elevated/80 hover:bg-accent hover:text-inverse text-ink font-semibold text-xs border border-control hover:border-accent transition-all cursor-pointer"
                            aria-label={`Abrir detalhes da Ordem de Serviço ${os.numeroOs}`}
                          >
                            <span>Abrir</span>
                            <Eye aria-hidden="true" className="w-4 h-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
      <section aria-labelledby="acessos-rapidos" className="space-y-4">
        <h2 id="acessos-rapidos" className="ui-section-title">Acessos Rápidos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { href: '/ordens-servico', label: 'Ordens de Serviço', icon: FileText },
            { href: '/clientes', label: 'Clientes', icon: Users },
            { href: '/maquinas', label: 'Equipamentos', icon: Wrench },
            { href: '/estoque', label: 'Estoque & Peças', icon: Boxes },
            { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="ui-panel p-4 flex items-center gap-3 text-sm text-muted hover:text-ink hover:bg-elevated">
              <Icon aria-hidden="true" className="w-4 h-4" /><span>{label}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
