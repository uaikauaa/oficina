'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
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
  CheckSquare,
  Settings,
  Package,
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
    <main className="flex-1 max-w-7xl 2xl:max-w-screen-2xl w-full mx-auto p-4 sm:p-6 lg:p-7 space-y-6 sm:space-y-7">
      {/* ========================================================================= */}
      {/* 1. BANNER & CARD DE BOAS-VINDAS HEROICO                                   */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl bg-[#0b0f17] border border-slate-800 shadow-2xl">
        {/* Imagem de Fundo Oficial da Oficina posicionada no lado direito */}
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[62%] md:w-[55%] lg:w-[48%] pointer-events-none select-none z-0">
          <Image
            src="/dashboard-banner.png"
            alt="Operador de solda com faíscas da oficina"
            fill
            priority
            className="object-cover object-right"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
          {/* Overlays escuros para legibilidade do texto e contraste idêntico ao protótipo */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f17] via-[#0b0f17]/95 via-35% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f17]/90 via-transparent to-transparent sm:hidden" />
        </div>

        {/* Conteúdo do Card de Boas-Vindas */}
        <div className="relative z-10 p-5 sm:p-7 lg:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="max-w-xl">
            {/* Linha de Contexto: Ícone + Painel Operacional + Data */}
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
              <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="text-amber-500 tracking-wide font-bold">Painel Operacional</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300 font-normal">{dataHojeFormatada}</span>
            </div>

            {/* Saudação com Nome em Âmbar */}
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black text-white tracking-tight mt-1.5 leading-tight">
              {obterSaudacao()},{' '}
              <span className="text-[#f59e0b] font-black">{nomeExibicao}!</span>
            </h1>

            {/* Subtítulo Descritivo */}
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed font-normal">
              Veja o resumo das atividades e serviços que requerem atenção hoje na oficina.
            </p>
          </div>

          {/* Botão Oficial: [ + NOVA ORDEM DE SERVIÇO → ] */}
          <div className="shrink-0 pt-1 md:pt-0">
            <Link
              href="/ordens-servico/nova"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 sm:px-6 sm:py-3.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#b45309] text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 active:scale-[0.98] transition-all duration-150 cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
              aria-label="Abrir Nova Ordem de Serviço"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>NOVA ORDEM DE SERVIÇO</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </Link>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RESUMO DA OFICINA (4 CARDS SEMÂNTICOS DE ATENÇÃO)                      */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#f59e0b]" />
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
              Resumo da Oficina
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Clique no cartão para abrir a lista filtrada
          </span>
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
              className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Prontas p/ Retirada (Verde) */}
          <Link
            href="/ordens-servico?status=PRONTA"
            className="relative overflow-hidden p-5 rounded-2xl bg-[#0c101a] border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/[0.04] transition-all duration-200 group flex flex-col justify-between shadow-lg shadow-black/40 hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0"
          >
            {/* Topo: Badge + Ícone */}
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-wide">
                Prontas p/ Retirada
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckSquare className="w-4 h-4" />
              </div>
            </div>

            {/* Número Principal e Descrição + Marca d'água */}
            <div className="my-3.5 relative">
              <div className="text-3xl sm:text-4xl font-black text-white group-hover:text-emerald-400 transition-colors">
                {carregandoContadores ? (
                  <div className="w-12 h-9 bg-slate-800 animate-pulse rounded-lg" />
                ) : (
                  contadoresOs?.prontas ?? '-'
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Equipamentos prontos para entrega ao cliente
              </p>

              {/* Watermark decorativa */}
              <div className="absolute right-0 bottom-0 pointer-events-none opacity-10 text-emerald-400">
                <Wrench className="w-14 h-14" />
              </div>
            </div>

            {/* CTA Inferior */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-semibold group-hover:text-emerald-300">
              <span>Clique para entregar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform motion-reduce:transition-none" />
            </div>
          </Link>

          {/* Card 2: Aguardando Aprovação (Roxo) */}
          <Link
            href="/ordens-servico?status=AGUARDANDO_APROVACAO"
            className="relative overflow-hidden p-5 rounded-2xl bg-[#0c101a] border border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/[0.04] transition-all duration-200 group flex flex-col justify-between shadow-lg shadow-black/40 hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 uppercase tracking-wide">
                Aguardando Aprovação
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3.5 relative">
              <div className="text-3xl sm:text-4xl font-black text-white group-hover:text-purple-400 transition-colors">
                {carregandoContadores ? (
                  <div className="w-12 h-9 bg-slate-800 animate-pulse rounded-lg" />
                ) : (
                  contadoresOs?.aguardandoAprovacao ?? '-'
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Orçamentos enviados pendentes de resposta
              </p>

              <div className="absolute right-0 bottom-0 pointer-events-none opacity-10 text-purple-400">
                <FileText className="w-14 h-14" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-purple-400 font-semibold group-hover:text-purple-300">
              <span>Clique para contatar</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform motion-reduce:transition-none" />
            </div>
          </Link>

          {/* Card 3: Em Manutenção (Azul) */}
          <Link
            href="/ordens-servico?status=EM_MANUTENCAO"
            className="relative overflow-hidden p-5 rounded-2xl bg-[#0c101a] border border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/[0.04] transition-all duration-200 group flex flex-col justify-between shadow-lg shadow-black/40 hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 uppercase tracking-wide">
                Em Manutenção
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Wrench className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3.5 relative">
              <div className="text-3xl sm:text-4xl font-black text-white group-hover:text-blue-400 transition-colors">
                {carregandoContadores ? (
                  <div className="w-12 h-9 bg-slate-800 animate-pulse rounded-lg" />
                ) : (
                  contadoresOs?.emManutencao ?? '-'
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Máquinas ativas em serviço na bancada
              </p>

              <div className="absolute right-0 bottom-0 pointer-events-none opacity-10 text-blue-400">
                <Settings className="w-14 h-14" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-blue-400 font-semibold group-hover:text-blue-300">
              <span>Clique para ver bancada</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform motion-reduce:transition-none" />
            </div>
          </Link>

          {/* Card 4: Estoque Crítico (Vermelho) */}
          <Link
            href="/estoque"
            className="relative overflow-hidden p-5 rounded-2xl bg-[#0c101a] border border-rose-500/30 hover:border-rose-500/60 hover:bg-rose-500/[0.04] transition-all duration-200 group flex flex-col justify-between shadow-lg shadow-black/40 hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 uppercase tracking-wide">
                Estoque Crítico
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>

            <div className="my-3.5 relative">
              <div className="text-3xl sm:text-4xl font-black text-white group-hover:text-rose-400 transition-colors">
                {carregandoEstoque ? (
                  <div className="w-12 h-9 bg-slate-800 animate-pulse rounded-lg" />
                ) : erroEstoque ? (
                  '-'
                ) : (
                  estoqueResumo?.itensEstoqueBaixo ?? 0
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                Peças e produtos no limite mínimo ou zerados
              </p>

              <div className="absolute right-0 bottom-0 pointer-events-none opacity-10 text-rose-400">
                <Package className="w-14 h-14" />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-rose-400 font-semibold group-hover:text-rose-300">
              <span>Clique para repor estoque</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform motion-reduce:transition-none" />
            </div>
          </Link>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. ACESSOS RÁPIDOS DA OFICINA (5 CARDS HORIZONTAIS)                      */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#f59e0b]" />
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            Acessos Rápidos
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Ordens de Serviço */}
          <Link
            href="/ordens-servico"
            className="p-3.5 rounded-2xl bg-[#0c101a] border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/90 transition-all duration-150 flex items-center gap-3 group shadow-md hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                Ordens de Serviço
              </p>
              <p className="text-[11px] text-slate-400 truncate">Consultar histórico</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* 2. Clientes */}
          <Link
            href="/clientes"
            className="p-3.5 rounded-2xl bg-[#0c101a] border border-slate-800 hover:border-blue-500/40 hover:bg-slate-900/90 transition-all duration-150 flex items-center gap-3 group shadow-md hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                Clientes
              </p>
              <p className="text-[11px] text-slate-400 truncate">Pessoa física e jurídica</p>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* 3. Equipamentos */}
          <Link
            href="/maquinas"
            className="p-3.5 rounded-2xl bg-[#0c101a] border border-slate-800 hover:border-emerald-500/40 hover:bg-slate-900/90 transition-all duration-150 flex items-center gap-3 group shadow-md hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                Equipamentos
              </p>
              <p className="text-[11px] text-slate-400 truncate">Soldas e Garantias</p>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* 4. Estoque & Peças */}
          <Link
            href="/estoque"
            className="p-3.5 rounded-2xl bg-[#0c101a] border border-slate-800 hover:border-purple-500/40 hover:bg-slate-900/90 transition-all duration-150 flex items-center gap-3 group shadow-md hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform shrink-0">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                Estoque &amp; Peças
              </p>
              <p className="text-[11px] text-slate-400 truncate">Saldos e Movimentações</p>
            </div>
            <ArrowRight className="w-4 h-4 text-purple-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          {/* 5. Relatórios */}
          <Link
            href="/relatorios"
            className="p-3.5 rounded-2xl bg-[#0c101a] border border-slate-800 hover:border-amber-500/40 hover:bg-slate-900/90 transition-all duration-150 flex items-center gap-3 group shadow-md hover:-translate-y-0.5 cursor-pointer motion-reduce:hover:translate-y-0 col-span-1 sm:col-span-2 lg:col-span-1"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                Relatórios
              </p>
              <p className="text-[11px] text-slate-400 truncate">Faturamento e OS</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. VISÃO DE BANCADA RECENTE (ÚLTIMAS OS)                                   */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 text-[#f59e0b] flex flex-col justify-center gap-0.5">
                <span className="w-3.5 h-0.5 bg-[#f59e0b] rounded-full" />
                <span className="w-3.5 h-0.5 bg-[#f59e0b] rounded-full" />
                <span className="w-3.5 h-0.5 bg-[#f59e0b] rounded-full" />
              </div>
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                Ordens Recentes
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Últimas atendimentos realizados ou atualizações na oficina.
            </p>
          </div>

          <Link
            href="/ordens-servico"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors shrink-0"
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
              className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        )}

        {carregandoRecentes ? (
          <div className="p-6 rounded-2xl bg-[#0c101a] border border-slate-800 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-11 bg-slate-800/60 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : ordensRecentes.length === 0 ? (
          /* Estado Vazio */
          <div className="p-8 sm:p-12 rounded-2xl bg-[#0c101a] border border-slate-800 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Nenhuma Ordem de Serviço registrada ainda
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Inicie o primeiro atendimento técnico clicando no botão abaixo.
              </p>
            </div>
            <Link
              href="/ordens-servico/nova"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] text-slate-950 text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Abrir Primeira Ordem de Serviço</span>
            </Link>
          </div>
        ) : (
          /* Tabela de OS Recentes */
          <div className="rounded-2xl bg-[#0c101a] border border-slate-800/80 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800/90 bg-[#070a10] text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Número OS</th>
                    <th className="py-3 px-4 font-semibold">Cliente</th>
                    <th className="py-3 px-4 font-semibold">Equipamento</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Data Entrada</th>
                    <th className="py-3 px-4 text-right font-semibold">Ação</th>
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
                        className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/ordens-servico/${os.id}`)}
                      >
                        {/* Número OS */}
                        <td className="py-3 px-4 font-mono font-bold text-white group-hover:text-amber-400 transition-colors">
                          {os.numeroOs}
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-4 font-medium text-white">
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

                        {/* Status em Pill Badge */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
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
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/80 hover:bg-[#f59e0b] hover:text-slate-950 text-slate-300 font-semibold text-xs border border-slate-700/60 hover:border-amber-500 transition-all cursor-pointer"
                            aria-label={`Abrir detalhes da Ordem de Serviço ${os.numeroOs}`}
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
