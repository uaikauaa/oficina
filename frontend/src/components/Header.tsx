'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wrench, Users, LayoutDashboard, LogOut, FileText } from 'lucide-react';
import { CurrentUser } from '@/lib/types';
import { apiFetch } from '@/lib/api';

interface HeaderProps {
  user: CurrentUser | null;
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignora erro
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const isDashboardActive = pathname === '/dashboard';
  const isClientesActive = pathname.startsWith('/clientes');
  const isOsActive = pathname.startsWith('/ordens-servico');

  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logotipo e Identificação do Sistema */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-all">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white leading-none">Oficina Gestão</h1>
              <span className="text-[11px] text-slate-400">Soldas & Geradores</span>
            </div>
          </Link>

          {/* Links de Navegação Principal */}
          <nav className="hidden md:flex items-center gap-1.5 ml-4">
            <Link
              href="/dashboard"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                isDashboardActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Painel</span>
            </Link>

            <Link
              href="/clientes"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                isClientesActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Clientes</span>
            </Link>

            <Link
              href="/ordens-servico"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                isOsActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Ordens de Serviço</span>
            </Link>
          </nav>
        </div>

        {/* Perfil da Usuária e Logout */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs sm:text-sm font-medium text-white">{user?.nome || 'Proprietária'}</p>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {user?.roles?.[0] || 'ROLE_ADMIN'}
              </span>
              <span className="text-[11px] text-slate-400">{user?.email}</span>
            </div>
          </div>

          <button
            id="header-logout-btn"
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 hover:border-red-500/30 transition-all cursor-pointer"
            title="Encerrar Sessão"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>

      {/* Navegação Mobile Inferior */}
      <div className="flex md:hidden items-center gap-2 mt-3 pt-3 border-t border-slate-800/80">
        <Link
          href="/dashboard"
          className={`flex-1 py-1.5 text-center rounded-lg text-xs font-semibold flex items-center justify-center gap-2 ${
            isDashboardActive
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 bg-slate-900/80 border border-slate-800'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Painel</span>
        </Link>
        <Link
          href="/clientes"
          className={`flex-1 py-1.5 text-center rounded-lg text-xs font-semibold flex items-center justify-center gap-2 ${
            isClientesActive
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 bg-slate-900/80 border border-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Clientes</span>
        </Link>
        <Link
          href="/ordens-servico"
          className={`flex-1 py-1.5 text-center rounded-lg text-xs font-semibold flex items-center justify-center gap-2 ${
            isOsActive
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'text-slate-400 bg-slate-900/80 border border-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>OS</span>
        </Link>
      </div>
    </header>
  );
}
