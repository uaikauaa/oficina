'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wrench, LogOut, ShieldCheck, Database, CheckCircle2, UserCheck } from 'lucide-react';

interface CurrentUser {
  id: number;
  nome: string;
  email: string;
  roles: string[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  useEffect(() => {
    async function loadCurrentUser() {
      try {
        let response = await fetch(`${apiUrl}/api/auth/me`, {
          credentials: 'include',
        });

        // Se o access_token expirou (401), tenta renovar silenciosamente com refresh token
        if (response.status === 401) {
          const refreshRes = await fetch(`${apiUrl}/api/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
          });
          if (refreshRes.ok) {
            response = await fetch(`${apiUrl}/api/auth/me`, {
              credentials: 'include',
            });
          }
        }

        if (!response.ok) {
          throw new Error('Não autenticado');
        }
        const data = await response.json();
        setUser(data);
      } catch {
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    }
    loadCurrentUser();
  }, [apiUrl, router]);

  const handleLogout = async () => {
    try {
      await fetch(`${apiUrl}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // Falha de rede silenciosa
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Carregando dados da sessão...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Barra de Navegação Superior */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Oficina Gestão</h1>
              <span className="text-xs text-slate-400">Painel Operacional</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-white">{user?.nome || 'Proprietária'}</p>
              <div className="flex items-center justify-end gap-1.5 mt-0.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {user?.roles?.[0] || 'ROLE_ADMIN'}
                </span>
                <span className="text-xs text-slate-400">{user?.email}</span>
              </div>
            </div>

            <button
              id="logout-btn"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 text-xs font-semibold flex items-center gap-2 border border-slate-700 hover:border-red-500/30 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Encerrar Sessão</span>
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Banner de Boas-Vindas */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 border border-slate-800 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Autenticação Web Validada</h2>
              <p className="text-sm text-slate-400 mt-1 max-w-2xl">
                Sessão ativa com perfil administrativo irrestrito (<code className="text-amber-400 font-mono text-xs">ROLE_ADMIN</code>). Acesso direto e seguro via tokens stateless e cookies protegidos contra XSS.
              </p>
            </div>
          </div>
        </div>

        {/* Grade de Indicadores de Infraestrutura do MVP */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Status da API</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">Online (200 OK)</div>
              <p className="text-xs text-slate-500 mt-1">Spring Boot 3.4.3 & Spring Security</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
