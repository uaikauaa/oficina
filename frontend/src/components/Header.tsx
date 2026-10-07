'use client';

import React, { useState, useEffect, useRef, useTransition, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
  RefreshCw,
} from 'lucide-react';
import { CurrentUser, Notificacao, NotificacoesResumo } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { OFICINA } from '@/lib/oficina';
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

  // Estados de Notificações Reais Persistentes
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [isLoadingNotificacoes, setIsLoadingNotificacoes] = useState(false);
  const [notificacoesError, setNotificacoesError] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

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

  // Carrega notificações reais persistentes da API
  const carregarNotificacoes = useCallback(async () => {
    if (!user) return;
    setIsLoadingNotificacoes(true);
    setNotificacoesError(null);

    try {
      const res = await apiFetch('/api/notificacoes');
      if (res.ok) {
        const data: NotificacoesResumo = await res.json();
        setNotificacoes(data.notificacoes || []);
        setNaoLidas(data.naoLidas || 0);
      } else {
        setNotificacoesError('Não foi possível carregar as notificações.');
      }
    } catch {
      setNotificacoesError('Falha de conexão ao carregar notificações.');
    } finally {
      setIsLoadingNotificacoes(false);
    }
  }, [user]);

  useEffect(() => {
    let ativo = true;
    if (!user) return;

    apiFetch('/api/notificacoes')
      .then(async (res) => {
        if (!ativo) return;
        if (res.ok) {
          const data: NotificacoesResumo = await res.json();
          if (ativo) {
            setNotificacoes(data.notificacoes || []);
            setNaoLidas(data.naoLidas || 0);
            setNotificacoesError(null);
          }
        } else {
          if (ativo) setNotificacoesError('Não foi possível carregar as notificações.');
        }
      })
      .catch(() => {
        if (ativo) setNotificacoesError('Falha de conexão ao carregar notificações.');
      })
      .finally(() => {
        if (ativo) setIsLoadingNotificacoes(false);
      });

    return () => {
      ativo = false;
    };
  }, [user, pathname]);

  const handleNotificacaoClick = async (notificacao: Notificacao) => {
    // 1. Marca como lida no backend se ainda não estiver
    if (!notificacao.lida) {
      setNotificacoes((prev) =>
        prev.map((n) =>
          n.id === notificacao.id ? { ...n, lida: true, lidoEm: new Date().toISOString() } : n
        )
      );
      setNaoLidas((prev) => Math.max(0, prev - 1));

      try {
        await apiFetch(`/api/notificacoes/${notificacao.id}/ler`, { method: 'PATCH' });
      } catch {
        // Silencioso se der erro na persistência
      }
    }

    // 2. Fecha painel
    setIsNotificacoesOpen(false);

    // 3. Navega para recurso se rota existir
    if (notificacao.link) {
      router.push(notificacao.link);
    }
  };

  const handleMarcarTodasComoLidas = async () => {
    if (isMarkingAllRead || naoLidas === 0) return;
    setIsMarkingAllRead(true);

    // Atualização otimista
    setNotificacoes((prev) =>
      prev.map((n) => ({ ...n, lida: true, lidoEm: new Date().toISOString() }))
    );
    setNaoLidas(0);

    try {
      await apiFetch('/api/notificacoes/ler-todas', { method: 'PATCH' });
    } catch {
      // Reverte se houver falha de conexão
      carregarNotificacoes();
    } finally {
      setIsMarkingAllRead(false);
    }
  };

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
    `whitespace-nowrap px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 xl:gap-1.5 transition-all shrink-0 cursor-pointer ${
      active
        ? 'bg-[#533804] text-[#fbbf24] border border-[#f59e0b]/50 shadow-sm shadow-amber-500/10'
        : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-transparent'
    }`;

  return (
    <>
      <header className="border-b border-slate-800 bg-[#070a10]/95 backdrop-blur-md sticky top-0 z-30 print:hidden">
        {/* Barra Principal */}
        <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto px-3 sm:px-6 py-2.5">
          <div className="flex items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 min-w-0">

            {/* 1. ESQUERDA: Ícone e Nome da Empresa */}
            <div className="flex items-center justify-start shrink-0 min-w-0">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 sm:gap-2.5 min-w-0 group transition-all"
                title={`${OFICINA.nomeFantasia} - Painel`}
              >
                <div className="relative w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 group-hover:border-amber-500/40 flex items-center justify-center p-1 transition-all shadow-sm shadow-amber-500/5 shrink-0">
                  <Image
                    src="/logo-icone.png"
                    alt={OFICINA.nomeFantasia}
                    width={26}
                    height={26}
                    priority
                    className="w-full h-full object-contain drop-shadow-[0_1px_4px_rgba(245,158,11,0.3)]"
                  />
                </div>
                <div className="hidden sm:flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-black text-white tracking-wide group-hover:text-amber-400 transition-colors leading-none whitespace-nowrap">
                    {OFICINA.nomeFantasia.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-amber-500/80 font-medium leading-none mt-1 hidden sm:inline">
                    Oficina Especializada
                  </span>
                </div>
              </Link>
            </div>

            {/* 2. CENTRO: Painel de Navegação Centralizado (Desktop lg+) */}
            <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-1.5 min-w-0">
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

            {/* 3. DIREITA: Busca Global + Notificações + Usuário + Menu Hambúrguer (Mobile) */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0">
              {/* Botão de Busca Rápida (Pill com Ctrl+K) */}
              <button
                id="busca-rapida-trigger"
                onClick={() => setIsBuscaOpen(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#0c101a] border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-slate-200 text-xs transition-all cursor-pointer shadow-sm"
                title="Busca Global (Ctrl+K)"
                aria-label="Abrir busca rápida"
              >
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="hidden sm:inline lg:hidden xl:inline whitespace-nowrap">Buscar...</span>
                <kbd className="hidden 2xl:inline-flex px-1.5 py-0.5 bg-slate-900 text-slate-400 rounded text-[10px] font-mono border border-slate-700/80 whitespace-nowrap ml-1">
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
                  aria-label={naoLidas > 0 ? `Notificações da oficina (${naoLidas} não lidas)` : 'Notificações da oficina'}
                  aria-haspopup="dialog"
                  aria-expanded={isNotificacoesOpen}
                >
                  <Bell className="w-4 h-4" />
                  {naoLidas > 0 && (
                    <span
                      data-testid="notification-badge"
                      className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center shadow-md animate-in zoom-in-75"
                    >
                      {naoLidas > 99 ? '99+' : naoLidas}
                    </span>
                  )}
                </button>

                {/* Popover de Notificações */}
                {isNotificacoesOpen && (
                  <div
                    role="dialog"
                    aria-label="Painel de Notificações"
                    className="fixed sm:absolute top-14 sm:top-auto left-3 right-3 sm:left-auto sm:right-0 sm:mt-2 w-auto sm:w-96 rounded-2xl bg-[#0c101a] border border-slate-800 shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
                  >
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800/80 px-1">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Notificações
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {naoLidas > 0 && (
                          <button
                            type="button"
                            onClick={handleMarcarTodasComoLidas}
                            disabled={isMarkingAllRead}
                            className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 hover:underline transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Marcar todas como lidas
                          </button>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                          {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Tudo lido'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                      {isLoadingNotificacoes ? (
                        <div className="py-6 px-3 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          <p>Carregando notificações...</p>
                        </div>
                      ) : notificacoesError ? (
                        <div className="py-6 px-3 text-center text-xs text-rose-400 flex flex-col items-center justify-center gap-1.5">
                          <AlertTriangle className="w-5 h-5 text-rose-400" />
                          <p>{notificacoesError}</p>
                          <button
                            type="button"
                            onClick={carregarNotificacoes}
                            className="mt-1 text-[11px] font-bold text-amber-400 hover:underline cursor-pointer"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : notificacoes.length === 0 ? (
                        <div className="py-6 px-3 text-center text-xs text-slate-400">
                          <CheckSquare className="w-6 h-6 mx-auto mb-1 text-emerald-400/80" />
                          <p className="font-semibold text-slate-300">Tudo em dia!</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Nenhum alerta ou pendência crítica no momento.
                          </p>
                        </div>
                      ) : (
                        notificacoes.map((item) => {
                          const iconColor =
                            item.tipo === 'OS_PRONTA'
                              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              : item.tipo === 'OS_AGUARDANDO_APROVACAO'
                              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                              : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleNotificacaoClick(item)}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 group cursor-pointer ${
                                !item.lida
                                  ? 'bg-slate-900/90 border-slate-700/80 hover:border-amber-500/40 shadow-sm'
                                  : 'bg-slate-950/40 border-slate-800/60 opacity-80 hover:opacity-100 hover:border-slate-700'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}
                              >
                                {item.tipo === 'OS_PRONTA' && <CheckSquare className="w-3.5 h-3.5" />}
                                {item.tipo === 'OS_AGUARDANDO_APROVACAO' && <Clock className="w-3.5 h-3.5" />}
                                {item.tipo === 'ESTOQUE_BAIXO' && <AlertTriangle className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p
                                    className={`text-xs transition-colors ${
                                      !item.lida
                                        ? 'font-bold text-white group-hover:text-amber-400'
                                        : 'font-medium text-slate-300 group-hover:text-white'
                                    }`}
                                  >
                                    {item.titulo}
                                  </p>
                                  {!item.lida && (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                      Nova
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                                  {item.mensagem}
                                </p>
                              </div>
                              {item.link && (
                                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
                              )}
                            </button>
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
                  <span className="text-xs font-semibold text-white whitespace-nowrap hidden sm:inline lg:hidden xl:inline">
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
                  className={`col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center sm:justify-start gap-2 transition-all ${
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
