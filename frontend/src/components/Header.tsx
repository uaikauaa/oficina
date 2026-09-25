'use client';

import React, { useState, useEffect, useRef, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Wrench,
  Users,
  LayoutDashboard,
  LogOut,
  FileText,
  Package,
  Boxes,
  Search,
  BarChart3,
  Menu,
  X,
  Settings,
  Bell,
  ChevronDown,
  CheckSquare,
  Clock,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { CurrentUser } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { OFICINA } from '@/lib/oficina';
import BuscaRapidaModal from '@/components/BuscaRapidaModal';

interface HeaderProps {
  user: CurrentUser | null;
}

interface AlertaNotificacao {
  id: string;
  titulo: string;
  descricao: string;
  href: string;
  tipo: 'success' | 'warning' | 'danger';
}

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Silencioso em caso de falha de rede
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
  const [isNotificacoesOpen, setIsNotificacoesOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [alertas, setAlertas] = useState<AlertaNotificacao[]>([]);

  const notificacoesRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const userName =
    user?.nome && user.nome.trim() !== 'Proprietária Oficina'
      ? user.nome
      : (OFICINA.responsavel || 'Geisa');

  const firstName = useMemo(() => {
    return userName.trim().split(/\s+/)[0] || 'Geisa';
  }, [userName]);

  const userInitials = useMemo(() => {
    const partes = userName.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return 'OF';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
  }, [userName]);

  const [, startTransition] = useTransition();

  // Fecha menu mobile ao navegar
  useEffect(() => {
    startTransition(() => {
      setIsMobileMenuOpen(false);
      setIsNotificacoesOpen(false);
      setIsUserMenuOpen(false);
    });
  }, [pathname, startTransition]);

  // Carrega alertas reais da oficina (ordens pendentes e estoque crítico)
  useEffect(() => {
    if (!user) return;
    let cancel = false;

    async function carregarAlertasReais() {
      try {
        const [resOs, resEstoque] = await Promise.all([
          apiFetch('/api/ordens-servico/contadores-dashboard').catch(() => null),
          apiFetch('/api/estoque/resumo').catch(() => null),
        ]);

        const itens: AlertaNotificacao[] = [];

        if (resOs && resOs.ok) {
          const contadores = await resOs.json();
          if (contadores?.prontas && contadores.prontas > 0) {
            itens.push({
              id: 'prontas',
              titulo: 'Prontas para Retirada',
              descricao: `${contadores.prontas} equipamento(s) pronto(s) para entrega ao cliente`,
              href: '/ordens-servico?status=PRONTA',
              tipo: 'success',
            });
          }
          if (contadores?.aguardandoAprovacao && contadores.aguardandoAprovacao > 0) {
            itens.push({
              id: 'aprovacao',
              titulo: 'Aguardando Aprovação',
              descricao: `${contadores.aguardandoAprovacao} orçamento(s) pendente(s) de resposta`,
              href: '/ordens-servico?status=AGUARDANDO_APROVACAO',
              tipo: 'warning',
            });
          }
        }

        if (resEstoque && resEstoque.ok) {
          const estoque = await resEstoque.json();
          if (estoque?.itensEstoqueBaixo && estoque.itensEstoqueBaixo > 0) {
            itens.push({
              id: 'estoque',
              titulo: 'Estoque Crítico',
              descricao: `${estoque.itensEstoqueBaixo} produto(s) no limite mínimo ou zerados`,
              href: '/estoque',
              tipo: 'danger',
            });
          }
        }

        if (!cancel) {
          setAlertas(itens);
        }
      } catch {
        // Silencioso em caso de falha de conexão
      }
    }

    carregarAlertasReais();
    return () => {
      cancel = true;
    };
  }, [user, pathname]);

  // Fecha popovers ao clicar fora ou pressionar Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notificacoesRef.current && !notificacoesRef.current.contains(target)) {
        setIsNotificacoesOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotificacoesOpen(false);
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
    `whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
      active
        ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50 shadow-sm shadow-amber-500/10'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
    }`;

  return (
    <>
      <header className="border-b border-slate-800 bg-[#070a10]/95 backdrop-blur-md sticky top-0 z-30">
        {/* Barra Principal */}
        <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-4 sm:px-6 py-2.5">
          <div className="flex items-center justify-between gap-3 min-w-0">

            {/* Logo Mobile / Tablet (oculto no desktop lg+ para dar lugar à barra do protótipo) */}
            <div className="flex items-center gap-2.5 lg:hidden shrink-0">
              <Link href="/dashboard" className="flex items-center gap-2 group">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-all">
                  <Wrench className="w-4 h-4" />
                </div>
                <div className="hidden sm:block">
                  <span className="text-xs font-bold text-white leading-none whitespace-nowrap">
                    {OFICINA.nomeFantasia.toUpperCase()}
                  </span>
                </div>
              </Link>
            </div>

            {/* Navegação Desktop (lg+) — fiel à esquerda do protótipo */}
            <nav className="hidden lg:flex items-center gap-1 flex-1 min-w-0">
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
            </nav>

            {/* Área Direita: Busca Global + Notificações + Usuário */}
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Botão de Busca Rápida (Pill com Ctrl+K) */}
              <button
                id="busca-rapida-trigger"
                onClick={() => setIsBuscaOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0c101a] border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-slate-200 text-xs transition-all cursor-pointer shadow-sm"
                title="Busca Global (Ctrl+K)"
                aria-label="Abrir busca rápida"
              >
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="hidden sm:inline whitespace-nowrap">Buscar...</span>
                <kbd className="hidden md:inline-flex px-1.5 py-0.5 bg-slate-900 text-slate-400 rounded text-[10px] font-mono border border-slate-700/80 whitespace-nowrap ml-1">
                  Ctrl + K
                </kbd>
              </button>

              {/* Botão de Notificações (Sino com Badge) */}
              <div className="relative" ref={notificacoesRef}>
                <button
                  type="button"
                  onClick={() => setIsNotificacoesOpen((prev) => !prev)}
                  className={`relative p-2 rounded-xl bg-[#0c101a] border transition-all cursor-pointer ${
                    isNotificacoesOpen
                      ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                      : 'border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                  }`}
                  aria-label="Notificações da oficina"
                  aria-haspopup="dialog"
                  aria-expanded={isNotificacoesOpen}
                >
                  <Bell className="w-4 h-4" />
                  {alertas.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md animate-in zoom-in-75">
                      {alertas.length}
                    </span>
                  )}
                </button>

                {/* Popover de Notificações */}
                {isNotificacoesOpen && (
                  <div
                    role="dialog"
                    aria-label="Painel de Notificações"
                    className="fixed sm:absolute top-14 sm:top-auto left-4 right-4 sm:left-auto sm:right-0 sm:mt-2 sm:w-88 rounded-2xl bg-[#0c101a] border border-slate-800 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 px-1">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Notificações
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {alertas.length} {alertas.length === 1 ? 'pendência' : 'pendências'}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5">
                      {alertas.length === 0 ? (
                        <div className="py-6 px-3 text-center text-xs text-slate-400">
                          <p className="font-semibold text-slate-300">Tudo em dia!</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Nenhum alerta ou pendência crítica no momento.
                          </p>
                        </div>
                      ) : (
                        alertas.map((alerta) => {
                          const iconColor =
                            alerta.tipo === 'success'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : alerta.tipo === 'warning'
                              ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                              : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

                          return (
                            <Link
                              key={alerta.id}
                              href={alerta.href}
                              onClick={() => setIsNotificacoesOpen(false)}
                              className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 transition-all flex items-start gap-2.5 group"
                            >
                              <div
                                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}
                              >
                                {alerta.tipo === 'success' && <CheckSquare className="w-3.5 h-3.5" />}
                                {alerta.tipo === 'warning' && <Clock className="w-3.5 h-3.5" />}
                                {alerta.tipo === 'danger' && <AlertTriangle className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                                  {alerta.titulo}
                                </p>
                                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                                  {alerta.descricao}
                                </p>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all mt-1" />
                            </Link>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bloco do Usuário (Avatar com Iniciais + Nome + Dropdown) */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className={`flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                    isUserMenuOpen
                      ? 'bg-slate-800/80 ring-1 ring-slate-700'
                      : 'hover:bg-slate-800/50'
                  }`}
                  aria-label="Menu do usuário autenticado"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                >
                  <div className="w-8 h-8 rounded-full bg-[#1b263b] border border-slate-700 flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0">
                    {userInitials}
                  </div>
                  <span className="text-xs font-semibold text-white whitespace-nowrap hidden sm:inline">
                    {firstName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {/* Dropdown do Usuário */}
                {isUserMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Opções do usuário"
                    className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#0c101a] border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
                  >
                    <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                      <p className="text-xs font-bold text-white truncate">{userName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {user?.email || 'admin@oficina.com'}
                      </p>
                    </div>

                    <Link
                      href="/configuracoes"
                      role="menuitem"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                        isConfiguracaoActive
                          ? 'bg-amber-500/15 text-amber-400 font-semibold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                      }`}
                    >
                      <Settings className={`w-3.5 h-3.5 ${isConfiguracaoActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>Configurações</span>
                    </Link>

                    <button
                      id="header-logout-btn"
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair do Sistema</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Botão Hambúrguer Mobile (apenas abaixo de lg) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="lg:hidden p-2 rounded-xl bg-[#0c101a] border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu de navegação'}
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menu Mobile Dropdown (quando hambúrguer aberto em telas < lg) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-800/80 bg-[#070a10]/98 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
              <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link
                  href="/dashboard"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isDashboardActive
                      ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50'
                      : 'text-slate-300 bg-slate-900/60 border border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>Painel</span>
                </Link>
                <Link
                  href="/clientes"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isClientesActive
                      ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50'
                      : 'text-slate-300 bg-slate-900/60 border border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Clientes</span>
                </Link>
                <Link
                  href="/maquinas"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isMaquinasActive
                      ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50'
                      : 'text-slate-300 bg-slate-900/60 border border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <Wrench className="w-4 h-4 shrink-0" />
                  <span>Equipamentos</span>
                </Link>
                <Link
                  href="/ordens-servico"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isOsActive
                      ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50'
                      : 'text-slate-300 bg-slate-900/60 border border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  <span>Ordens de Serviço</span>
                </Link>
                <Link
                  href="/produtos"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isProdutosActive
                      ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50'
                      : 'text-slate-300 bg-slate-900/60 border border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <Package className="w-4 h-4 shrink-0" />
                  <span>Peças &amp; Produtos</span>
                </Link>
                <Link
                  href="/estoque"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isEstoqueActive
                      ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50'
                      : 'text-slate-300 bg-slate-900/60 border border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <Boxes className="w-4 h-4 shrink-0" />
                  <span>Estoque</span>
                </Link>
                <Link
                  href="/relatorios"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isRelatoriosActive
                      ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50'
                      : 'text-slate-300 bg-slate-900/60 border border-slate-800 hover:bg-slate-800/60'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Relatórios</span>
                </Link>
              </nav>

              {/* Info do usuário no menu mobile */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#1b263b] border border-slate-700 flex items-center justify-center text-[11px] font-black text-white shrink-0">
                    {userInitials}
                  </div>
                  <span className="text-xs text-slate-300 truncate font-semibold">{userName}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href="/configuracoes"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                      isConfiguracaoActive
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Configurações</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1 border border-red-500/20 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>
      <BuscaRapidaModal isOpen={isBuscaOpen} onClose={() => setIsBuscaOpen(false)} />
    </>
  );
}
