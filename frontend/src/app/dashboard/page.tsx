'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldCheck,
  Database,
  CheckCircle2,
  ArrowRight,
  FileText,
  Clock,
  Wrench,
  Plus,
  Zap,
} from 'lucide-react';
import Header from '@/components/Header';
import { CurrentUser } from '@/lib/types';
import { apiFetch } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [totalClientes, setTotalClientes] = useState<number | null>(null);
  const [totalOs, setTotalOs] = useState<number | null>(null);
  const [totalOsAbertas, setTotalOsAbertas] = useState<number | null>(null);
  const [totalOsManutencao, setTotalOsManutencao] = useState<number | null>(null);
  const [totalOsProntas, setTotalOsProntas] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const userRes = await apiFetch('/api/auth/me');
        if (!userRes.ok) {
          throw new Error('Não autenticado');
        }
        const userData = await userRes.json();
        setUser(userData);

        // Carrega contagens operacionais
        const [cliRes, osTotRes, osAbertaRes, osManutRes, osProntaRes] = await Promise.all([
          apiFetch('/api/clientes?size=1'),
          apiFetch('/api/ordens-servico?size=1'),
          apiFetch('/api/ordens-servico?status=ABERTA&size=1'),
          apiFetch('/api/ordens-servico?status=EM_MANUTENCAO&size=1'),
          apiFetch('/api/ordens-servico?status=PRONTA&size=1'),
        ]);

        if (cliRes.ok) {
          const d = await cliRes.json();
          setTotalClientes(d.totalElements ?? 0);
        }
        if (osTotRes.ok) {
          const d = await osTotRes.json();
          setTotalOs(d.totalElements ?? 0);
        }
        if (osAbertaRes.ok) {
          const d = await osAbertaRes.json();
          setTotalOsAbertas(d.totalElements ?? 0);
        }
        if (osManutRes.ok) {
          const d = await osManutRes.json();
          setTotalOsManutencao(d.totalElements ?? 0);
        }
        if (osProntaRes.ok) {
          const d = await osProntaRes.json();
          setTotalOsProntas(d.totalElements ?? 0);
        }
      } catch {
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Carregando painel operacional...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={user} />

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Banner de Boas-Vindas */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Painel Operacional da Oficina</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Oficina técnica especializada em manutenção e conserto de <strong className="text-white">máquinas de solda</strong> e <strong className="text-white">geradores de energia</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* CARD EM DESTAQUE PRINCIPAL: ORDENS DE SERVIÇO (FASE 5) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/40 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <FileText className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                    Fase 5 — Coração da Oficina
                  </span>
                  <span className="text-xs text-slate-400">Fluxo Operacional Técnico</span>
                </div>
                <h3 className="text-xl font-bold text-white mt-1">Ordens de Serviço</h3>
                <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                  Recepção de máquinas, diagnóstico de bancada, validação técnica sob carga e histórico completo por cliente e equipamento.
                </p>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs">
                  <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <strong>{totalOsAbertas ?? 0}</strong> Abertas
                  </span>
                  <span className="text-blue-400 font-semibold flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    <strong>{totalOsManutencao ?? 0}</strong> Em Manutenção
                  </span>
                  <Link
                    href="/ordens-servico?status=PRONTA"
                    className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1.5 transition-colors underline-offset-4 hover:underline"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <strong>{totalOsProntas ?? 0}</strong> Prontas para Retirada
                  </Link>
                  <span className="text-slate-400 font-medium">
                    Total: <strong className="text-white">{totalOs ?? 0}</strong> atendimentos
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link
                href="/ordens-servico?status=PRONTA"
                className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2 border border-emerald-500/30 transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Prontas para Retirada ({totalOsProntas ?? 0})</span>
              </Link>
              <Link
                href="/ordens-servico/nova"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Ordem de Serviço</span>
              </Link>
              <Link
                href="/ordens-servico"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              >
                <span>Ver Todas as OS</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Card Secundário: Clientes e Equipamentos */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                    Fases 4A & 4B
                  </span>
                  <span className="text-xs text-slate-400">Cadastros Permanentes</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">Clientes & Equipamentos</h3>
                <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                  Base de clientes (Pessoa Física e Jurídica) e máquinas vinculadas (soldas MIG/TIG/Eletrodo e geradores de energia).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <Link
                href="/clientes"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              >
                <span>Acessar Clientes ({totalClientes ?? '-'})</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Grade de Indicadores de Infraestrutura */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total de Clientes */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total de Clientes</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-white">
                {totalClientes !== null ? totalClientes : '-'}
              </div>
              <p className="text-xs text-slate-500 mt-1">Clientes cadastrados na oficina</p>
            </div>
          </div>

          {/* Banco Neon */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Banco de Dados</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <span>Neon Cloud</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-500 mt-1">PostgreSQL Serverless conectado</p>
            </div>
          </div>

          {/* Total de Ordens */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ordens de Serviço</span>
              <FileText className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-3xl font-bold text-white">
                {totalOs !== null ? totalOs : '0'}
              </div>
              <p className="text-xs text-slate-500 mt-1">Atendimentos registrados no total</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
