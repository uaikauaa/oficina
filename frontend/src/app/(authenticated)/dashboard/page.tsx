'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Users,
  FileText,
  Boxes,
  BarChart3,
  Plus,
  Zap,
  Clock,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Eye,
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

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Data formatada por extenso
  const dataHojeFormatada = useMemo(() => {
    return new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

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
    carregarContadoresOs();
    carregarEstoque();
    carregarOrdensRecentes();
  }, [carregarContadoresOs, carregarEstoque, carregarOrdensRecentes]);

  return (
    <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ========================================================================= */}
        {/* 1. TOPO OPERACIONAL COMPACTO & AÇÃO HEROICA */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900/90 border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
              <Wrench className="w-4 h-4" />
              <span>Painel Operacional</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400 capitalize">{dataHojeFormatada}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-1">
              {obterSaudacao()}, {user?.nome ? user.nome.split(' ')[0] : 'Operador'}!
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Visão geral dos atendimentos e serviços que requerem ação hoje na oficina.
            </p>
          </div>

          {/* AÇÃO PRINCIPAL EM DESTAQUE ABSOLUTO */}
          <Link
            href="/ordens-servico/nova"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm sm:text-base tracking-wide shadow-xl shadow-amber-500/20 hover:shadow-amber-500/30 transition-all cursor-pointer transform hover:-translate-y-0.5 shrink-0"
            aria-label="Abrir Nova Ordem de Serviço"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
            <span>+ NOVA ORDEM DE SERVIÇO</span>
          </Link>
        </div>

        {/* ========================================================================= */}
        {/* 2. PAINEL "PRECISA DE ATENÇÃO" (INDICADORES ACIONÁVEIS) */}
        {/* ========================================================================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Precisa de Atenção
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">Clique no cartão para abrir a lista filtrada</span>
          </div>

          {/* Alerta de Falha de API se houver */}
          {erroContadores && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Não foi possível carregar os contadores de ordens de serviço.</span>
              </div>
              <button
                onClick={carregarContadoresOs}
                className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Tentar novamente</span>
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Prontas para Retirada */}
            <Link
              href="/ordens-servico?status=PRONTA"
              className="p-5 rounded-2xl bg-slate-900 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all group flex flex-col justify-between shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                  Prontas p/ Retirada
                </span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              <div className="my-3">
                <div className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">
                  {carregandoContadores ? (
                    <div className="w-12 h-8 bg-slate-800 animate-pulse rounded-lg" />
                  ) : (
                    contadoresOs?.prontas ?? '-'
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">Equipamentos prontos para entrega ao cliente</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-400/90 font-semibold">
                <span>Clique para entregar</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 2: Aguardando Aprovação */}
            <Link
              href="/ordens-servico?status=AGUARDANDO_APROVACAO"
              className="p-5 rounded-2xl bg-slate-900 border border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/5 transition-all group flex flex-col justify-between shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 uppercase">
                  Aguardando Aprovação
                </span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <Clock className="w-4 h-4" />
                </div>
              </div>

              <div className="my-3">
                <div className="text-3xl font-black text-white group-hover:text-purple-400 transition-colors">
                  {carregandoContadores ? (
                    <div className="w-12 h-8 bg-slate-800 animate-pulse rounded-lg" />
                  ) : (
                    contadoresOs?.aguardandoAprovacao ?? '-'
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">Orçamentos enviados pendentes de resposta</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-purple-400/90 font-semibold">
                <span>Clique para contatar</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 3: Em Manutenção */}
            <Link
              href="/ordens-servico?status=EM_MANUTENCAO"
              className="p-5 rounded-2xl bg-slate-900 border border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5 transition-all group flex flex-col justify-between shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 uppercase">
                  Em Manutenção
                </span>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Wrench className="w-4 h-4" />
                </div>
              </div>

              <div className="my-3">
                <div className="text-3xl font-black text-white group-hover:text-blue-400 transition-colors">
                  {carregandoContadores ? (
                    <div className="w-12 h-8 bg-slate-800 animate-pulse rounded-lg" />
                  ) : (
                    contadoresOs?.emManutencao ?? '-'
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">Máquinas ativas em serviço na bancada</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-blue-400/90 font-semibold">
                <span>Clique para ver bancada</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* Card 4: Estoque Crítico */}
            <Link
              href="/estoque"
              className="p-5 rounded-2xl bg-slate-900 border border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/5 transition-all group flex flex-col justify-between shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase">
                  Estoque Crítico
                </span>
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>

              <div className="my-3">
                <div className="text-3xl font-black text-white group-hover:text-rose-400 transition-colors">
                  {carregandoEstoque ? (
                    <div className="w-12 h-8 bg-slate-800 animate-pulse rounded-lg" />
                  ) : erroEstoque ? (
                    '-'
                  ) : (
                    estoqueResumo?.itensEstoqueBaixo ?? 0
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">Peças e produtos no limite mínimo ou zerados</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-rose-400/90 font-semibold">
                <span>Clique para repor estoque</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. ACESSOS RÁPIDOS DA OFICINA */}
        {/* ========================================================================= */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Acessos Rápidos
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* 1. Ordens de Serviço */}
            <Link
              href="/ordens-servico"
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/80 transition-all flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                  Ordens de Serviço
                </p>
                <p className="text-[10px] text-slate-400">Consultar histórico</p>
              </div>
            </Link>

            {/* 2. Clientes */}
            <Link
              href="/clientes"
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-800/80 transition-all flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                  Clientes
                </p>
                <p className="text-[10px] text-slate-400">Pessoa Física e Jurídica</p>
              </div>
            </Link>

            {/* 3. Equipamentos */}
            <Link
              href="/maquinas"
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-800/80 transition-all flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                  Equipamentos
                </p>
                <p className="text-[10px] text-slate-400">Soldas e Geradores</p>
              </div>
            </Link>

            {/* 4. Estoque & Peças */}
            <Link
              href="/estoque"
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-800/80 transition-all flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform shrink-0">
                <Boxes className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                  Estoque & Peças
                </p>
                <p className="text-[10px] text-slate-400">Saldos e Movimentações</p>
              </div>
            </Link>

            {/* 5. Relatórios */}
            <Link
              href="/relatorios"
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 hover:bg-slate-800/80 transition-all flex items-center gap-3 group col-span-2 sm:col-span-1"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                  Relatórios
                </p>
                <p className="text-[10px] text-slate-400">Faturamento e OS</p>
              </div>
            </Link>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. VISÃO DE BANCADA RECENTE (ÚLTIMAS OS) */}
        {/* ========================================================================= */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Ordens Recentes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Últimos atendimentos recebidos ou atualizados na oficina
              </p>
            </div>

            <Link
              href="/ordens-servico"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
            >
              <span>Ver todas as OS</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {erroRecentes && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center justify-between">
              <span>Não foi possível carregar a lista de ordens recentes.</span>
              <button
                onClick={carregarOrdensRecentes}
                className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Tentar novamente</span>
              </button>
            </div>
          )}

          {carregandoRecentes ? (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-800/60 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : ordensRecentes.length === 0 ? (
            /* Empty State */
            <div className="p-8 sm:p-12 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Nenhuma Ordem de Serviço registrada ainda</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Inicie o primeiro atendimento técnico clicando no botão abaixo.
                </p>
              </div>
              <Link
                href="/ordens-servico/nova"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Abrir Primeira Ordem de Serviço</span>
              </Link>
            </div>
          ) : (
            /* Tabela / Lista de OS Recentes */
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Número OS</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Equipamento</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Data Entrada</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {ordensRecentes.map((os) => {
                      const badge =
                        STATUS_ORDEM_SERVICO_BADGES[os.status] || {
                          bg: 'bg-slate-800',
                          text: 'text-slate-300',
                          border: 'border-slate-700',
                        };
                      const statusNome =
                        STATUS_ORDEM_SERVICO_LABELS[os.status] || os.status;

                      return (
                        <tr
                          key={os.id}
                          className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                          onClick={() => router.push(`/ordens-servico/${os.id}`)}
                        >
                          {/* Número OS */}
                          <td className="py-3 px-4 font-mono font-bold text-white group-hover:text-amber-400 transition-colors">
                            {os.numeroOs}
                          </td>

                          {/* Cliente */}
                          <td className="py-3 px-4 font-semibold text-white">
                            {os.clienteNome || 'Cliente não identificado'}
                          </td>

                          {/* Equipamento */}
                          <td className="py-3 px-4 text-slate-300">
                            {os.maquinaMarca || os.maquinaModelo ? (
                              <span>
                                {os.maquinaMarca} {os.maquinaModelo}
                              </span>
                            ) : (
                              <span className="text-slate-500">Equipamento não especificado</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                            >
                              {statusNome}
                            </span>
                          </td>

                          {/* Data de Entrada */}
                          <td className="py-3 px-4 text-slate-400">
                            {formatarData(os.dataEntrada as unknown as string)}
                          </td>

                          {/* Ação para Abrir */}
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <Link
                              href={`/ordens-servico/${os.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-semibold text-[11px] transition-all"
                            >
                              <span>Abrir</span>
                              <Eye className="w-3.5 h-3.5" />
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
      </main>
  );
}
