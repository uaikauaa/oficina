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
  const logoutInFlight = useRef(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const handleLogout = async () => {
    if (logoutInFlight.current) return;
    logoutInFlight.current = true;
    setIsLoggingOut(true);
    setLogoutError(null);
    let confirmed = false;
    try {
      const response = await apiFetch('/api/auth/logout', { method: 'POST' });
      if (response.ok !== true) {
        let message = 'Não foi possível confirmar sua saída. Tente novamente.';
        if (response.status === 403) {
          const body = await response.json().catch(() => null);
          if (body?.error === 'CSRF_INVALID') {
            message = 'Não foi possível confirmar sua saída por uma falha de segurança da sessão. Tente novamente.';
          }
        }
        console.warn('LOGOUT_NOT_CONFIRMED', { status: response.status });
        setLogoutError(message);
        return;
      }
      router.replace('/login');
      router.refresh();
      confirmed = true;
    } catch {
      console.warn('LOGOUT_NOT_CONFIRMED: falha de comunicação.');
      setLogoutError('Não foi possível confirmar sua saída. Tente novamente.');
    } finally {
      // Após sucesso, mantém o bloqueio até a navegação desmontar o Header.
      if (!confirmed) {
        logoutInFlight.current = false;
        setIsLoggingOut(false);
      }
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
        ? 'bg-accent/15 text-accent border border-accent/50 shadow-sm shadow-none'
        : 'text-ink hover:text-ink hover:bg-elevated/60 border border-transparent'
    }`;

  return (
    <>
      <header className="border-b border-line bg-canvas/95 sticky top-0 z-30 print:hidden">
        {/* Barra Principal */}
        <div className="max-w-[90rem] mx-auto px-3 sm:px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">

            {/* 1. ESQUERDA: Ícone e Nome da Empresa */}
            <div className="flex items-center justify-start shrink-0 min-w-0">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 sm:gap-2.5 min-w-0 group transition-all"
                title={`${OFICINA.nomeFantasia} - Painel`}
              >
                <div className="relative w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 group-hover:border-accent/40 flex items-center justify-center p-1 transition-all shadow-sm shadow-none shrink-0">
                  <Image
                    src="/logo-icone.png"
                    alt={OFICINA.nomeFantasia}
                    width={26}
                    height={26}
                    priority
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="hidden sm:flex flex-col min-w-0">
                  <span className="text-xs sm:text-sm font-semibold text-ink tracking-wide group-hover:text-accent transition-colors leading-none whitespace-nowrap">
                    {OFICINA.nomeFantasia}
                  </span>
                  <span className="text-xs text-muted leading-none mt-1 hidden sm:inline">
                    Oficina Especializada
                  </span>
                </div>
              </Link>
            </div>

            {/* 2. CENTRO: Painel de Navegação Centralizado (Desktop lg+) */}
            <nav aria-label="Navegação principal" className="hidden lg:flex order-3 basis-full items-center gap-1 min-w-0 pt-2 border-t border-line">
              <Link href="/dashboard" className={navLinkClass(isDashboardActive)}>
                <LayoutDashboard aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span>Painel</span>
              </Link>
              <Link href="/clientes" className={navLinkClass(isClientesActive)}>
                <Users aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span>Clientes</span>
              </Link>
              <Link href="/maquinas" className={navLinkClass(isMaquinasActive)}>
                <Wrench aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span>Equipamentos</span>
              </Link>
              <Link href="/ordens-servico" className={navLinkClass(isOsActive)}>
                <FileText aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span>Ordens de Serviço</span>
              </Link>
              <Link href="/produtos" className={navLinkClass(isProdutosActive)}>
                <Package aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span>Peças &amp; Produtos</span>
              </Link>
              <Link href="/estoque" className={navLinkClass(isEstoqueActive)}>
                <Boxes aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span>Estoque</span>
              </Link>
              <Link href="/relatorios" className={navLinkClass(isRelatoriosActive)}>
                <BarChart3 aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                <span>Relatórios</span>
              </Link>
            </nav>

            {/* 3. DIREITA: Busca Global + Notificações + Usuário + Menu Hambúrguer (Mobile) */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2.5 shrink-0">
              {/* Botão de Busca Rápida (Pill com Ctrl+K) */}
              <button
                id="busca-rapida-trigger"
                onClick={() => setIsBuscaOpen(true)}
                className="ui-icon-btn flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-surface border border-line hover:border-accent/40 text-muted hover:text-ink text-xs transition-all cursor-pointer shadow-sm"
                title="Busca Global (Ctrl+K)"
                aria-label="Abrir busca rápida"
              >
                <Search aria-hidden="true" className="w-3.5 h-3.5 text-muted shrink-0" />
                <span className="hidden sm:inline lg:hidden xl:inline whitespace-nowrap">Buscar...</span>
                <kbd className="hidden 2xl:inline-flex px-1.5 py-0.5 bg-surface text-muted rounded text-xs font-mono border border-control whitespace-nowrap ml-1">
                  Ctrl + K
                </kbd>
              </button>

              {/* Botão de Notificações (Sino com Badge) */}
              <div className="relative" ref={notificacoesRef}>
                <button
                  type="button"
                  onClick={() => setIsNotificacoesOpen((prev) => !prev)}
                  className={`relative p-2 rounded-xl bg-surface border transition-all cursor-pointer ${
                    isNotificacoesOpen
                      ? 'border-accent/50 text-accent bg-accent/10'
                      : 'border-line text-ink hover:text-ink hover:border-control'
                  }`}
                  aria-label={naoLidas > 0 ? `Notificações da oficina (${naoLidas} não lidas)` : 'Notificações da oficina'}
                  aria-haspopup="dialog"
                  aria-expanded={isNotificacoesOpen}
                >
                  <Bell aria-hidden="true" className="w-4 h-4" />
                  {naoLidas > 0 && (
                    <span
                      data-testid="notification-badge"
                      className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-inverse text-xs font-semibold flex items-center justify-center shadow-md animate-in zoom-in-75"
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
                    className="ui-dialog fixed sm:absolute top-14 sm:top-auto left-3 right-3 sm:left-auto sm:right-0 sm:mt-2 w-auto sm:w-96 border p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
                  >
                    <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-line px-1">
                      <div className="flex items-center gap-2">
                        <Bell aria-hidden="true" className="w-4 h-4 text-accent" />
                        <span className="text-xs font-bold text-ink">
                          Notificações
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {naoLidas > 0 && (
                          <button
                            type="button"
                            onClick={handleMarcarTodasComoLidas}
                            disabled={isMarkingAllRead}
                            className="text-xs font-semibold text-accent hover:text-accent hover:underline transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Marcar todas como lidas
                          </button>
                        )}
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-elevated text-ink border border-control">
                          {naoLidas > 0 ? `${naoLidas} não lida${naoLidas > 1 ? 's' : ''}` : 'Tudo lido'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                      {isLoadingNotificacoes ? (
                        <div className="py-6 px-3 text-center text-xs text-muted flex flex-col items-center justify-center gap-2">
                          <RefreshCw aria-hidden="true" className="w-4 h-4 animate-spin text-accent" />
                          <p>Carregando notificações...</p>
                        </div>
                      ) : notificacoesError ? (
                        <div className="py-6 px-3 text-center text-xs text-danger flex flex-col items-center justify-center gap-1.5">
                          <AlertTriangle aria-hidden="true" className="w-5 h-5 text-danger" />
                          <p>{notificacoesError}</p>
                          <button
                            type="button"
                            onClick={carregarNotificacoes}
                            className="mt-1 text-xs font-bold text-accent hover:underline cursor-pointer"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : notificacoes.length === 0 ? (
                        <div className="py-6 px-3 text-center text-xs text-muted">
                          <CheckSquare className="w-6 h-6 mx-auto mb-1 text-ink" />
                          <p className="font-semibold text-ink">Tudo em dia!</p>
                          <p className="text-xs text-subtle mt-0.5">
                            Nenhum alerta ou pendência crítica no momento.
                          </p>
                        </div>
                      ) : (
                        notificacoes.map((item) => {
                          const iconColor =
                            item.tipo === 'OS_PRONTA'
                              ? 'text-ink bg-ink/5 border-line'
                              : item.tipo === 'OS_AGUARDANDO_APROVACAO'
                              ? 'text-accent bg-accent/10 border-accent/20'
                              : 'text-danger bg-danger/10 border-danger/20';

                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleNotificacaoClick(item)}
                              className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 group cursor-pointer ${
                                !item.lida
                                  ? 'bg-surface/90 border-control hover:border-accent/40 shadow-sm'
                                  : 'bg-canvas/40 border-line opacity-80 hover:opacity-100 hover:border-control'
                              }`}
                            >
                              <div
                                className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconColor}`}
                              >
                                {item.tipo === 'OS_PRONTA' && <CheckSquare aria-hidden="true" className="w-3.5 h-3.5" />}
                                {item.tipo === 'OS_AGUARDANDO_APROVACAO' && <Clock aria-hidden="true" className="w-3.5 h-3.5" />}
                                {item.tipo === 'ESTOQUE_BAIXO' && <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p
                                    className={`text-xs transition-colors ${
                                      !item.lida
                                        ? 'font-bold text-ink group-hover:text-accent'
                                        : 'font-medium text-ink group-hover:text-ink'
                                    }`}
                                  >
                                    {item.titulo}
                                  </p>
                                  {!item.lida && (
                                    <span className="text-xs font-bold px-1.5 py-0.2 rounded bg-accent/20 text-accent border border-accent/30">
                                      Nova
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-muted leading-tight mt-0.5">
                                  {item.mensagem}
                                </p>
                              </div>
                              {item.link && (
                                <ArrowRight aria-hidden="true" className="w-3.5 h-3.5 text-subtle group-hover:text-accent group-hover:translate-x-0.5 transition-all mt-1 shrink-0" />
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
                      ? 'bg-elevated/80 ring-1 ring-control'
                      : 'hover:bg-elevated/50'
                  }`}
                  aria-label="Menu do usuário autenticado"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                >
                  <div className="w-8 h-8 rounded-full bg-elevated border border-control flex items-center justify-center text-xs font-semibold text-ink shadow-sm shrink-0">
                    {userInitials}
                  </div>
                  <span className="text-xs font-semibold text-ink whitespace-nowrap hidden sm:inline lg:hidden xl:inline">
                    {firstName}
                  </span>
                  <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-muted shrink-0" />
                </button>

                {/* Dropdown do Usuário */}
                {isUserMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Opções do usuário"
                    className="ui-dialog absolute right-0 mt-2 w-52 border p-2 z-50 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
                  >
                    <div className="px-3 py-2 border-b border-line mb-1">
                      <p className="text-xs font-bold text-ink truncate">{userName}</p>
                      <p className="text-xs text-muted truncate">
                        {user?.email || 'admin@oficina.com'}
                      </p>
                    </div>

                    <Link
                      href="/configuracoes"
                      role="menuitem"
                      onClick={() => setIsUserMenuOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition-colors ${
                        isConfiguracaoActive
                          ? 'bg-accent/15 text-accent font-semibold'
                          : 'text-ink hover:text-ink hover:bg-elevated/60'
                      }`}
                    >
                      <Settings className={`w-3.5 h-3.5 ${isConfiguracaoActive ? 'text-accent' : 'text-muted'}`} />
                      <span>Configurações</span>
                    </Link>

                    <button
                      id="header-logout-btn"
                      type="button"
                      role="menuitem"
                      disabled={isLoggingOut}
                      aria-busy={isLoggingOut}
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-danger hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                    >
                      <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
                      <span>{isLoggingOut ? 'Saindo...' : 'Sair do Sistema'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Botão Hambúrguer Mobile (apenas abaixo de lg) */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="ui-icon-btn lg:hidden p-2 rounded-xl bg-surface border border-line text-ink hover:text-ink hover:bg-elevated transition-all cursor-pointer"
                aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu de navegação'}
              >
                {isMobileMenuOpen ? <X aria-hidden="true" className="w-4 h-4" /> : <Menu aria-hidden="true" className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menu Mobile Dropdown (quando hambúrguer aberto em telas < lg) */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-line bg-canvas/98">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
              <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Link
                  href="/dashboard"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isDashboardActive
                      ? 'bg-accent/15 text-accent border border-accent/50'
                      : 'text-ink bg-surface/60 border border-line hover:bg-elevated/60'
                  }`}
                >
                  <LayoutDashboard aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>Painel</span>
                </Link>
                <Link
                  href="/clientes"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isClientesActive
                      ? 'bg-accent/15 text-accent border border-accent/50'
                      : 'text-ink bg-surface/60 border border-line hover:bg-elevated/60'
                  }`}
                >
                  <Users aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>Clientes</span>
                </Link>
                <Link
                  href="/maquinas"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isMaquinasActive
                      ? 'bg-accent/15 text-accent border border-accent/50'
                      : 'text-ink bg-surface/60 border border-line hover:bg-elevated/60'
                  }`}
                >
                  <Wrench aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>Equipamentos</span>
                </Link>
                <Link
                  href="/ordens-servico"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isOsActive
                      ? 'bg-accent/15 text-accent border border-accent/50'
                      : 'text-ink bg-surface/60 border border-line hover:bg-elevated/60'
                  }`}
                >
                  <FileText aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>Ordens de Serviço</span>
                </Link>
                <Link
                  href="/produtos"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isProdutosActive
                      ? 'bg-accent/15 text-accent border border-accent/50'
                      : 'text-ink bg-surface/60 border border-line hover:bg-elevated/60'
                  }`}
                >
                  <Package aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>Peças &amp; Produtos</span>
                </Link>
                <Link
                  href="/estoque"
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                    isEstoqueActive
                      ? 'bg-accent/15 text-accent border border-accent/50'
                      : 'text-ink bg-surface/60 border border-line hover:bg-elevated/60'
                  }`}
                >
                  <Boxes aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>Estoque</span>
                </Link>
                <Link
                  href="/relatorios"
                  className={`col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center sm:justify-start gap-2 transition-all ${
                    isRelatoriosActive
                      ? 'bg-accent/15 text-accent border border-accent/50'
                      : 'text-ink bg-surface/60 border border-line hover:bg-elevated/60'
                  }`}
                >
                  <BarChart3 aria-hidden="true" className="w-4 h-4 shrink-0" />
                  <span>Relatórios</span>
                </Link>
              </nav>

              {/* Info do usuário no menu mobile */}
              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-elevated border border-control flex items-center justify-center text-xs font-semibold text-ink shrink-0">
                    {userInitials}
                  </div>
                  <span className="text-xs text-ink truncate font-semibold">{userName}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href="/configuracoes"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                      isConfiguracaoActive
                        ? 'bg-accent/15 text-accent border border-accent/30'
                        : 'bg-elevated hover:bg-hover text-ink hover:text-ink border border-control'
                    }`}
                  >
                    <Settings aria-hidden="true" className="w-3.5 h-3.5" />
                    <span>Configurações</span>
                  </Link>
                  <button
                    id="header-mobile-logout-btn"
                    type="button"
                    disabled={isLoggingOut}
                    aria-busy={isLoggingOut}
                    onClick={handleLogout}
                    className="px-2.5 py-1 rounded-lg bg-danger/10 hover:bg-danger/20 text-danger text-xs font-semibold flex items-center gap-1 border border-danger/20 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                  >
                    <LogOut aria-hidden="true" className="w-3.5 h-3.5" />
                    <span>{isLoggingOut ? 'Saindo...' : 'Sair'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>
      {isLoggingOut && (
        <div role="status" className="fixed bottom-4 inset-x-4 mx-auto max-w-md rounded-xl border border-control bg-surface p-3 text-sm text-ink shadow-lg z-50 print:hidden">
          Confirmando saída...
        </div>
      )}
      {logoutError && (
        <div className="fixed bottom-4 inset-x-4 mx-auto max-w-md rounded-xl border border-danger/30 bg-surface p-3 text-sm text-danger shadow-lg z-50 print:hidden">
          <p role="alert" aria-atomic="true">{logoutError}</p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="mt-2 rounded-lg px-2 py-1 font-semibold text-ink hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger disabled:opacity-60"
          >
            Tentar novamente
          </button>
        </div>
      )}
      <BuscaRapidaModal isOpen={isBuscaOpen} onClose={() => setIsBuscaOpen(false)} />
    </>
  );
}
