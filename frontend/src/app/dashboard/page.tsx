'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  ShieldCheck,
  Database,
  CheckCircle2,
  UserCheck,
  ArrowRight,
} from 'lucide-react';
import Header from '@/components/Header';
import { CurrentUser } from '@/lib/types';
import { apiFetch } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [totalClientes, setTotalClientes] = useState<number | null>(null);
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

        // Carrega contagem de clientes
        const clientesRes = await apiFetch('/api/clientes?size=1');
        if (clientesRes.ok) {
          const clientesData = await clientesRes.json();
          setTotalClientes(clientesData.totalElements ?? 0);
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

        {/* Card em Destaque: Módulo de Clientes (Fase 4A) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-amber-500/30 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                    Fase 4A Disponível
                  </span>
                  <span className="text-xs text-slate-400">Base de Cadastros</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">Gestão de Clientes</h3>
                <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                  Cadastro de Pessoa Física e Jurídica, pesquisa paginada, controle de duplicidade (CPF/CNPJ, telefone, razão social) e estrutura pronta para equipamentos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:self-center shrink-0">
              <Link
                href="/clientes"
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
              >
                <span>Acessar Módulo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Grade de Indicadores de Infraestrutura e Operação */}
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

          {/* Modelo de Acesso */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Modelo de Acesso</span>
              <UserCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">Usuária Única</div>
              <p className="text-xs text-slate-500 mt-1">Acesso exclusivo da proprietária (MVP)</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
