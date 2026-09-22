'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wrench, Users, LayoutDashboard, LogOut, FileText, Package, Boxes, Search, BarChart3, Menu, X, Settings } from 'lucide-react';
import { CurrentUser } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import BuscaRapidaModal from '@/components/BuscaRapidaModal';

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
  const isMaquinasActive = pathname.startsWith('/maquinas');
  const isOsActive = pathname.startsWith('/ordens-servico');
  const isProdutosActive = pathname.startsWith('/produtos');
  const isEstoqueActive = pathname.startsWith('/estoque');
  const isRelatoriosActive = pathname.startsWith('/relatorios');
  const isConfiguracaoActive = pathname.startsWith('/configuracoes');

  const [isBuscaOpen, setIsBuscaOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [, startTransition] = useTransition();

  // Fecha menu mobile ao trocar de rota (startTransition evita setState síncrono direto no efeito)
  useEffect(() => {
    startTransition(() => {
      setIsMobileMenuOpen(false);
    });
  }, [pathname, startTransition]);

  // Atalho global Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsBuscaOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinkClass = (active: boolean) =>
    `whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 ${
      active
        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
    }`;

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        {/* Barra principal */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">

            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-2.5 group shrink-0">
              <div className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-all">
                <Wrench className="w-4.5 h-4.5" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-sm font-bold text-white leading-none whitespace-nowrap">Oficina Gestão</h1>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">Soldas &amp; Geradores</span>
              </div>
            </Link>

            {/* Separador vertical — apenas desktop */}
            <div className="hidden lg:block w-px h-6 bg-slate-700/60 shrink-0 mx-1" />

            {/* Navegação desktop — lg+ (≥1024px) */}
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 min-w-0 overflow-hidden">
              <Link href="/dashboard" className={navLinkClass(isDashboardActive)}>
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                <span>Painel</span>
              </Link>
              <Link href="/clientes" className={navLinkClass(isClientesActive)}>
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span>Clientes</span>
              </Link>
              <Link href="/maquinas" className={navLinkClass(isMaquinasActive)}>
                <Wrench className="w-3.5 h-3.5 shrink-0" />
                <span>Equipamentos</span>
              </Link>
              <Link href="/ordens-servico" className={navLinkClass(isOsActive)}>
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>Ordens de Serviço</span>
              </Link>
              <Link href="/produtos" className={navLinkClass(isProdutosActive)}>
                <Package className="w-3.5 h-3.5 shrink-0" />
                <span>Peças &amp; Produtos</span>
              </Link>
              <Link href="/estoque" className={navLinkClass(isEstoqueActive)}>
                <Boxes className="w-3.5 h-3.5 shrink-0" />
                <span>Estoque</span>
              </Link>
              <Link href="/relatorios" className={navLinkClass(isRelatoriosActive)}>
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                <span>Relatórios</span>
              </Link>
              <Link href="/configuracoes" className={navLinkClass(isConfiguracaoActive)}>
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span>Configurações</span>
              </Link>
            </nav>

            {/* Spacer para empurrar área direita quando nav está oculta */}
            <div className="flex-1 lg:hidden" />

            {/* Área direita: busca + usuário + sair */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Botão Busca Rápida */}
              <button
                id="busca-rapida-trigger"
                onClick={() => setIsBuscaOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-slate-200 text-xs transition-all cursor-pointer shadow-sm"
                title="Busca Rápida Global (Ctrl+K)"
                aria-label="Abrir busca rápida"
              >
                <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="hidden md:inline whitespace-nowrap">Busca rápida...</span>
                <kbd className="hidden xl:inline-flex px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-mono border border-slate-700 whitespace-nowrap">
                  Ctrl+K
                </kbd>
              </button>

              {/* Dados do usuário — md+ */}
              <div className="hidden md:block text-right">
                <p className="text-xs font-medium text-white whitespace-nowrap leading-none">
                  {user?.nome || 'Proprietária'}
                </p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 whitespace-nowrap">
                    {user?.roles?.[0] || 'ROLE_ADMIN'}
                  </span>
                </div>
              </div>

              {/* Botão Sair */}
              <button
                id="header-logout-btn"
                onClick={handleLogout}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-red-500/10 hover:text-red-400 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 hover:border-red-500/30 transition-all cursor-pointer shrink-0"
                title="Encerrar Sessão"
                aria-label="Encerrar Sessão"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Sair</span>
              </button>

              {/* Botão hambúrguer — apenas md e abaixo */}
              <button
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="lg:hidden p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu de navegação'}
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menu mobile dropdown — visível quando hambúrguer ativo (abaixo de lg) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800/80 bg-slate-900/95">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
              <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link
                  href="/dashboard"
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isDashboardActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-300 bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Painel</span>
                </Link>
                <Link
                  href="/clientes"
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isClientesActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-300 bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Clientes</span>
                </Link>
                <Link
                  href="/maquinas"
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isMaquinasActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-300 bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  <Wrench className="w-4 h-4 shrink-0" />
                  <span>Equipamentos</span>
                </Link>
                <Link
                  href="/ordens-servico"
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isOsActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-300 bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Ordens de Serviço</span>
                </Link>
                <Link
                  href="/produtos"
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isProdutosActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-300 bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  <Package className="w-4 h-4 shrink-0" />
                  <span>Peças &amp; Produtos</span>
                </Link>
                <Link
                  href="/estoque"
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isEstoqueActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-300 bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  <Boxes className="w-4 h-4 shrink-0" />
                  <span>Estoque</span>
                </Link>
                <Link
                  href="/relatorios"
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isRelatoriosActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-300 bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Relatórios</span>
                </Link>
                <Link
                  href="/configuracoes"
                  className={`py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                    isConfiguracaoActive
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'text-slate-300 bg-slate-800/60 border border-slate-700/60 hover:bg-slate-700/60'
                  }`}
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Configurações</span>
                </Link>
              </nav>

              {/* Info do usuário no menu mobile */}
              {user && (
                <div className="mt-3 pt-3 border-t border-slate-800/60 flex items-center gap-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {user.roles?.[0] || 'ROLE_ADMIN'}
                  </span>
                  <span className="text-xs text-slate-400 truncate">{user.email}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
      <BuscaRapidaModal isOpen={isBuscaOpen} onClose={() => setIsBuscaOpen(false)} />
    </>
  );
}
