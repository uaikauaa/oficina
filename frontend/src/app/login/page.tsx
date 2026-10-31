'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  User,
  FileText,
  Package,
  ShieldCheck,
  LogIn,
  AlertCircle,
  X,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  Clock,
} from 'lucide-react';

import { sanitizarRedirect, apiFetch, extrairMensagemErroLogin } from '@/lib/api';
import DialogFocus from '@/components/ui/DialogFocus';

const loginSchema = z.object({
  email: z.string().min(1, 'O email é obrigatório').email('Formato de email inválido'),
  senha: z.string().min(1, 'A senha é obrigatória'),
  rememberMe: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedRedirect = sanitizarRedirect(searchParams.get('redirect'));
  const redirectUrl = requestedRedirect.split(/[?#]/, 1)[0] === '/login'
    ? '/dashboard'
    : requestedRedirect;
  const sessionAlreadyChecked = searchParams.get('sessionChecked') === '1';
  const [checkingSession, setCheckingSession] = useState(!sessionAlreadyChecked);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [manterConectado, setManterConectado] = useState(true);

  // Estados da etapa de Autenticação em Duas Etapas (2FA)
  const [twoFactorStep, setTwoFactorStep] = useState(false);
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [attemptsExceeded, setAttemptsExceeded] = useState(false);

  // Estado e referências do Modal Mobile/Tablet (< 1024px)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Instância de formulário Desktop (>= 1024px)
  const desktopForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      senha: '',
    },
  });

  // Instância de formulário Mobile / Tablet Modal (< 1024px)
  const mobileForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      senha: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email,
          senha: data.senha,
          rememberMe: Boolean(manterConectado),
        }),
      });

      if (!response.ok) {
        const errorMsg = await extrairMensagemErroLogin(response);
        throw new Error(errorMsg);
      }

      const resData = await response.json();
      if (resData.twoFactorRequired) {
        setChallengeToken(resData.challengeToken);
        setTwoFactorStep(true);
        setTwoFactorCode('');
        setCountdownSeconds(300);
        setResendCooldown(30);
        setAttemptsExceeded(false);
        setErrorMessage(null);
        return;
      }

      // Sucesso na autenticação
      router.push(redirectUrl);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocorreu um erro inesperado ao realizar login.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onVerify2FA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (twoFactorCode.length !== 6 || !challengeToken) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiFetch('/api/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({
          challengeToken,
          code: twoFactorCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const msg = errorData?.message || 'Código de verificação incorreto ou expirado.';
        if (msg.includes('Limite de tentativas excedido') || msg.includes('5 tentativas')) {
          setAttemptsExceeded(true);
        }
        throw new Error(msg);
      }

      // Sucesso na autenticação 2FA: cookies definidos no navegador
      router.push(redirectUrl);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocorreu um erro ao verificar o código.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onResend2FA = async () => {
    if (!challengeToken || isResending || resendCooldown > 0) return;

    setIsResending(true);
    setErrorMessage(null);

    try {
      const response = await apiFetch('/api/auth/2fa/resend', {
        method: 'POST',
        body: JSON.stringify({ challengeToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.message || 'Falha ao reenviar código de verificação.');
      }

      const resData = await response.json();
      if (resData.challengeToken) {
        setChallengeToken(resData.challengeToken);
      }
      setTwoFactorCode('');
      setCountdownSeconds(300);
      setResendCooldown(30);
      setAttemptsExceeded(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Não foi possível reenviar o código no momento.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const voltarParaLogin = () => {
    setTwoFactorStep(false);
    setChallengeToken(null);
    setTwoFactorCode('');
    setErrorMessage(null);
    setAttemptsExceeded(false);
    setCountdownSeconds(300);
    setResendCooldown(0);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Contagem regressiva de 5 minutos do código 2FA
  useEffect(() => {
    if (!twoFactorStep || countdownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [twoFactorStep, countdownSeconds]);

  // Contagem regressiva do cooldown de reenvio (30s)
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Foco automático no campo de 2FA ao entrar na etapa
  useEffect(() => {
    if (twoFactorStep) {
      const timer = setTimeout(() => {
        const id = isModalOpen ? 'modal-two-factor-code' : 'two-factor-code';
        const input = document.getElementById(id) as HTMLInputElement | null;
        input?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [twoFactorStep, isModalOpen]);

  const abrirModal = () => {
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const fecharModal = useCallback(() => {
    setIsModalOpen(false);
    setErrorMessage(null);
    // Retorna foco para o botão Entrar no mobile
    mobileTriggerRef.current?.focus();
  }, []);

  // Fechamento via tecla Escape
  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        fecharModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, fecharModal]);

  // Foco no primeiro campo do modal ao abrir
  useEffect(() => {
    if (isModalOpen) {
      const timer = setTimeout(() => {
        const input = document.getElementById('modal-email') as HTMLInputElement | null;
        input?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

  // Bloquear rolagem do fundo enquanto modal estiver aberto
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  useEffect(() => {
    let ignore = false;
    if (sessionAlreadyChecked) {
      return () => { ignore = true; };
    }
    async function checkSession() {
      try {
        const response = await apiFetch('/api/auth/me');
        if (response.ok) {
          if (!ignore) router.replace(redirectUrl);
          return;
        }
      } catch {
        // Sem confirmação do backend, permanece no login.
      }
      if (!ignore) setCheckingSession(false);
    }
    checkSession();
    return () => { ignore = true; };
  }, [router, redirectUrl, sessionAlreadyChecked]);

  if (checkingSession && !sessionAlreadyChecked) {
    return <div className="min-h-screen bg-canvas" aria-label="Verificando sessão" />;
  }

  return (
    <>
      {/* ========================================================================= */}
      {/* VERSÃO DESKTOP (>= 1024px) — fotografia e formulário em painéis         */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex min-h-screen w-full flex-row bg-canvas text-ink overflow-x-hidden selection:bg-accent/30 selection:text-accent">
        {/* 1. PAINEL ESQUERDO: APRESENTAÇÃO COM FOTOGRAFIA DA OFICINA */}
        <div className="relative w-[62%] xl:w-[64%] 2xl:w-[66%] flex flex-col justify-between p-10 lg:p-12 xl:p-16 min-h-screen overflow-hidden">
          {/* Imagem de Fundo Real (Asset Fornecido pelo Usuário) */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/login-bg.png"
              alt="Bancada de ferramentas e máquinas de solda da oficina"
              fill
              priority
              className="saturate-[.75] object-cover object-right"
              sizes="66vw"
            />
            {/* A fotografia mantém cor; o contraste se concentra atrás do texto. */}
            <div className="absolute inset-0 bg-gradient-to-r from-canvas/90 via-canvas/70 to-canvas/30" />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-transparent to-canvas/20" />
          </div>

          {/* Topo Esquerdo: Logo & Slogan */}
          <div className="relative z-10 flex items-center gap-5 sm:gap-6">
            {/* Logomarca de Engrenagem com Chave Inglesa Oficial */}
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center shrink-0">
                <Image
                  src="/logo-icone.png"
                  alt="Ícone Oficina Gestão"
                  width={44}
                  height={44}
                  priority
                  className="w-full h-full object-contain"
                />
              </div>
              <h1 className="ui-page-title">
                Oficina <span className="text-accent">Gestão</span>
              </h1>
            </div>

            {/* Divisor Vertical */}
            <div className="hidden sm:block w-px h-8 bg-hover/80" />

            {/* Subtítulo Institucional */}
            <div className="hidden sm:block text-xs text-ink font-medium leading-tight">
              <p>Mais controle</p>
              <p>para o seu negócio</p>
            </div>
          </div>

          {/* Meio Esquerdo: Título Heroico, Descrição e 3 Recursos */}
          <div className="relative z-10 my-auto py-10 lg:py-8 max-w-xl">
            <h2 className="text-3xl sm:text-4xl lg:text-[38px] xl:text-[44px] font-semibold text-ink tracking-tight leading-[1.18]">
              Gestão completa da sua <br />
              oficina <span className="text-accent">em um só lugar.</span>
            </h2>

            <p className="mt-5 text-sm sm:text-base text-muted leading-relaxed font-normal max-w-lg">
              Controle seus clientes, ordens de serviço, estoque de peças e o histórico de cada máquina
              com praticidade e segurança.
            </p>

            {/* 3 Blocos de Recursos com Ícones */}
            <div className="mt-9 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4 lg:gap-5">
              {/* Bloco Clientes */}
              <div className="space-y-2">
                <div className="w-6 h-6 flex items-center text-accent">
                  <User aria-hidden="true" className="w-4 h-4 " />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-ink">Clientes</h3>
                  <p className="text-xs text-muted leading-snug mt-0.5">
                    Cadastros e histórico completo
                  </p>
                </div>
              </div>

              {/* Bloco Ordens de Serviço */}
              <div className="space-y-2">
                <div className="w-6 h-6 flex items-center text-accent">
                  <FileText aria-hidden="true" className="w-4 h-4 " />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-ink">Ordens de Serviço</h3>
                  <p className="text-xs text-muted leading-snug mt-0.5">
                    Do diagnóstico à finalização
                  </p>
                </div>
              </div>

              {/* Bloco Estoque */}
              <div className="space-y-2">
                <div className="w-6 h-6 flex items-center text-accent">
                  <Package aria-hidden="true" className="w-4 h-4 " />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-ink">Estoque</h3>
                  <p className="text-xs text-muted leading-snug mt-0.5">
                    Controle de peças e movimentações
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* 2. PAINEL DIREITO: ÁREA ESTRUTURAL DE AUTENTICAÇÃO */}
        <div className="relative w-[38%] xl:w-[36%] 2xl:w-[34%] bg-surface border-l border-line flex flex-col justify-center p-8 xl:p-12 min-h-screen">
          <div className="w-full max-w-[380px] mx-auto py-8">
            {/* Saudação do formulário */}
            <div className="flex items-start gap-3.5 mb-8">
              <div>
                <h2 className="text-2xl sm:text-[26px] font-semibold tracking-tight text-ink leading-tight">
                  {twoFactorStep ? 'Código de Verificação' : 'Bem-vindo de volta!'}
                </h2>
                <p className="text-xs sm:text-sm text-muted mt-1 font-normal">
                  {twoFactorStep
                    ? 'Informe o código de 6 dígitos enviado para seu e-mail'
                    : 'Faça login para continuar'}
                </p>
              </div>
            </div>

            {/* Alerta de Erro com Animação Resiliente */}
            {errorMessage && (
              <div
                id="login-error-alert"
                role="alert"
                aria-live="assertive"
                className="ui-notice mb-5 text-sm"
                data-variant="error"
              >
                <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Alerta de código expirado */}
            {twoFactorStep && countdownSeconds === 0 && !errorMessage && (
              <div
                role="alert"
                className="ui-notice mb-5 text-sm"
                data-variant="warning"
              >
                <Clock aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                <div className="flex-1 font-medium leading-relaxed">
                  O código de verificação expirou após 5 minutos. Solicite um novo código.
                </div>
              </div>
            )}

            {twoFactorStep ? (
              /* Formulário 2FA Desktop */
              <form onSubmit={onVerify2FA} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <label
                    htmlFor="two-factor-code"
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink tracking-wide"
                  >
                    <KeyRound aria-hidden="true" className="w-4 h-4 text-accent" />
                    <span>Código de 6 dígitos</span>
                  </label>
                  <input
                    id="two-factor-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    disabled={isLoading}
                    placeholder="000000"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFactorCode(val);
                    }}
                    className="ui-field w-full text-center font-mono tracking-[0.4em] text-2xl border placeholder:text-subtle hover:border-control focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                  />
                </div>

                {/* Linha do Timer e Reenvio */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock aria-hidden="true" className="w-4 h-4 text-subtle" />
                    <span>
                      {countdownSeconds > 0 ? (
                        <>
                          Expira em{' '}
                          <strong className="text-accent font-mono">
                            {formatTimer(countdownSeconds)}
                          </strong>
                        </>
                      ) : (
                        <span className="text-danger font-semibold">Expirado</span>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    id="resend-2fa-btn"
                    onClick={onResend2FA}
                    disabled={isResending || resendCooldown > 0}
                    className="text-xs font-medium text-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none flex items-center gap-1"
                  >
                    {isResending ? <RefreshCw aria-hidden="true" className="w-3 h-3 animate-spin" /> : null}
                    <span>
                      {resendCooldown > 0
                        ? `Reenviar (${resendCooldown}s)`
                        : isResending
                        ? 'Reenviando...'
                        : 'Reenviar código'}
                    </span>
                  </button>
                </div>

                {/* Botão Verificar */}
                <button
                  id="verify-2fa-submit-btn"
                  type="submit"
                  disabled={
                    isLoading ||
                    twoFactorCode.length !== 6 ||
                    countdownSeconds === 0 ||
                    attemptsExceeded
                  }
                  className="ui-btn ui-btn-primary w-full mt-4 flex items-center justify-center gap-2 active:scale-[0.985] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin" />
                      <span>Verificando...</span>
                    </div>
                  ) : (
                    <>
                      <ShieldCheck aria-hidden="true" className="w-4 h-4 " />
                      <span>Verificar código</span>
                    </>
                  )}
                </button>

                {/* Botão Voltar */}
                <button
                  type="button"
                  onClick={voltarParaLogin}
                  disabled={isLoading}
                  className="w-full py-2 text-xs text-muted hover:text-ink transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none"
                >
                  <ArrowLeft aria-hidden="true" className="w-4 h-4" />
                  <span>Voltar para o login</span>
                </button>
              </form>
            ) : (
              /* Formulário Desktop */
              <form onSubmit={desktopForm.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {/* Campo E-mail ou Usuário */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink tracking-wide"
                  >
                    <Mail aria-hidden="true" className="w-4 h-4 text-muted" />
                    <span>E-mail ou usuário</span>
                  </label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      disabled={isLoading}
                      aria-invalid={desktopForm.formState.errors.email ? 'true' : 'false'}
                      placeholder="Digite seu e-mail ou usuário"
                      className={`w-full px-3.5 py-2.5 rounded-lg bg-canvas border text-sm text-ink placeholder:text-subtle focus:outline-none transition-all duration-150 ${
                        desktopForm.formState.errors.email
                          ? 'border-danger/70 focus:border-danger focus:ring-1 focus:ring-danger'
                          : 'border-line hover:border-control focus:border-accent focus:ring-1 focus:ring-accent'
                      }`}
                      {...desktopForm.register('email')}
                    />
                  </div>
                  {desktopForm.formState.errors.email && (
                    <p className="text-xs text-danger flex items-center gap-1 font-medium pt-0.5">
                      <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
                      <span>{desktopForm.formState.errors.email.message}</span>
                    </p>
                  )}
                </div>

                {/* Campo Senha */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="senha"
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink tracking-wide"
                  >
                    <Lock aria-hidden="true" className="w-4 h-4 text-muted" />
                    <span>Senha</span>
                  </label>
                  <div className="relative">
                    <input
                      id="senha"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      disabled={isLoading}
                      aria-invalid={desktopForm.formState.errors.senha ? 'true' : 'false'}
                      placeholder="Digite sua senha"
                      className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-canvas border text-sm text-ink placeholder:text-subtle focus:outline-none transition-all duration-150 ${
                        desktopForm.formState.errors.senha
                          ? 'border-danger/70 focus:border-danger focus:ring-1 focus:ring-danger'
                          : 'border-line hover:border-control focus:border-accent focus:ring-1 focus:ring-accent'
                      }`}
                      {...desktopForm.register('senha')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-subtle hover:text-ink transition-colors focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      tabIndex={0}
                    >
                      {showPassword ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
                    </button>
                  </div>
                  {desktopForm.formState.errors.senha && (
                    <p className="text-xs text-danger flex items-center gap-1 font-medium pt-0.5">
                      <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
                      <span>{desktopForm.formState.errors.senha.message}</span>
                    </p>
                  )}
                </div>

                {/* Linha de Manter Conectado & Esqueceu Senha */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-1 text-xs">
                  <label htmlFor="field-src-app-login-page-tsx-1" className="flex items-center gap-2 cursor-pointer select-none text-ink hover:text-ink transition-colors">
                    <input id="field-src-app-login-page-tsx-1"
                      type="checkbox"
                      checked={manterConectado}
                      onChange={(e) => setManterConectado(e.target.checked)}
                      className="w-4 h-4 rounded bg-canvas border-control text-accent accent-accent focus:ring-0 cursor-pointer"
                    />
                    <span>Manter conectado</span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      alert('Para recuperação de senha, contate o administrador do sistema.')
                    }
                    className="text-accent hover:text-accent transition-colors font-medium text-xs cursor-pointer focus:outline-none"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>

                {/* Botão Entrar em Destaque Âmbar */}
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="ui-btn ui-btn-primary w-full mt-4 flex items-center justify-center gap-2 active:scale-[0.985] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin" />
                      <span>Autenticando...</span>
                    </div>
                  ) : (
                    <>
                      <LogIn aria-hidden="true" className="w-4 h-4 " />
                      <span>Entrar</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPERIÊNCIA MOBILE / TABLET (< 1024px)                                    */}
      {/* Fundo Fullscreen, Introdução Imersiva, Botão "Entrar" e Modal Central     */}
      {/* ========================================================================= */}
      <div className="flex lg:hidden relative min-h-dvh w-full flex-col p-5 sm:p-8 md:p-10 bg-canvas text-ink overflow-x-hidden selection:bg-accent/30 selection:text-accent">
        {/* Imagem de Fundo Real Fullscreen */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/login-bg.png"
            alt="Bancada de ferramentas e máquinas de solda da oficina"
            fill
            priority
            className="saturate-[.75] object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-canvas/90 via-canvas/75 to-canvas/95" />
        </div>

        {/* 1. Header Superior Mobile/Tablet */}
        <header className="relative z-10 w-full flex items-center justify-between gap-4">
          {/* Lado Esquerdo: Logomarca Oficial */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
              <Image
                src="/logo-icone.png"
                alt="Ícone Oficina Gestão"
                width={40}
                height={40}
                priority
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-ink whitespace-nowrap">
              Oficina <span className="text-accent">Gestão</span>
            </span>
          </div>

          {/* Lado Direito: Botão Primário "Entrar" */}
          <button
            ref={mobileTriggerRef}
            type="button"
            onClick={abrirModal}
            aria-haspopup="dialog"
            aria-expanded={isModalOpen}
            className="ui-btn ui-btn-primary sm:px-5 sm:py-2.5 sm:text-sm flex items-center gap-2 active:scale-[0.97] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-canvas"
          >
            <LogIn aria-hidden="true" className="w-4 h-4 sm:w-4 sm:h-4 " />
            <span>Entrar</span>
          </button>
        </header>

        {/* 2. Conteúdo Principal da Introdução */}
        <main className="relative z-10 my-auto py-8 sm:py-12 max-w-2xl w-full mx-auto">
          <div className="space-y-4 sm:space-y-5">
            <h1 className="text-[1.875rem] sm:text-4xl font-semibold tracking-tight leading-[1.2] text-ink">
              Gestão completa da sua <br />
              oficina <span className="text-accent">em um só lugar.</span>
            </h1>

            <p className="text-sm md:text-base text-muted leading-relaxed font-normal max-w-xl">
              Controle seus clientes, ordens de serviço, estoque de peças e o histórico de cada máquina
              com praticidade e segurança.
            </p>
          </div>

          {/* 3 Blocos de Recursos Adaptados para Telas Menores */}
          <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Bloco Clientes */}
            <div className="py-4 border-t border-line flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2.5">
              <div className="w-6 h-6 flex items-center justify-center text-accent shrink-0">
                <User aria-hidden="true" className="w-4 h-4 " />
              </div>
              <div>
                <h2 className="text-sm font-medium text-ink">Clientes</h2>
                <p className="text-xs text-muted leading-tight mt-0.5">
                  Cadastros e histórico completo
                </p>
              </div>
            </div>

            {/* Bloco Ordens de Serviço */}
            <div className="py-4 border-t border-line flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2.5">
              <div className="w-6 h-6 flex items-center justify-center text-accent shrink-0">
                <FileText aria-hidden="true" className="w-4 h-4 " />
              </div>
              <div>
                <h2 className="text-sm font-medium text-ink">Ordens de Serviço</h2>
                <p className="text-xs text-muted leading-tight mt-0.5">
                  Do diagnóstico à finalização
                </p>
              </div>
            </div>

            {/* Bloco Estoque */}
            <div className="py-4 border-t border-line flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2.5">
              <div className="w-6 h-6 flex items-center justify-center text-accent shrink-0">
                <Package aria-hidden="true" className="w-4 h-4 " />
              </div>
              <div>
                <h2 className="text-sm font-medium text-ink">Estoque</h2>
                <p className="text-xs text-muted leading-tight mt-0.5">
                  Controle de peças e movimentações
                </p>
              </div>
            </div>
          </div>
        </main>

      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL CENTRAL DE LOGIN PARA MOBILE / TABLET (< 1024px)                 */}
      {/* Formulário com superfície sólida e rolagem em telas menores             */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/85 transition-opacity duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              fecharModal();
            }
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-login-title"
            className="ui-dialog relative w-full max-w-[420px] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain border p-5 sm:p-7 animate-in fade-in duration-150 motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            <DialogFocus />
            {/* Botão de Fechar X no Cabeçalho */}
            <button
              type="button"
              onClick={fecharModal}
              className="absolute top-4 right-4 p-2 rounded-xl text-muted hover:text-ink hover:bg-elevated/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50"
              aria-label="Fechar modal de login"
            >
              <X aria-hidden="true" className="w-5 h-5" />
            </button>

            {/* Cabeçalho do formulário */}
            <div className="flex items-start gap-3.5 mb-6 pr-8">
              <div>
                <h2
                  id="modal-login-title"
                  className="text-xl sm:text-2xl font-semibold tracking-tight text-ink leading-tight"
                >
                  {twoFactorStep ? 'Código de Verificação' : 'Entrar no Sistema'}
                </h2>
                <p className="text-xs text-muted mt-1 font-normal">
                  {twoFactorStep
                    ? 'Informe o código de 6 dígitos enviado para seu e-mail'
                    : 'Faça login para continuar'}
                </p>
              </div>
            </div>

            {/* Alerta de Erro do Modal */}
            {errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="ui-notice mb-4 text-sm"
                data-variant="error"
              >
                <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5 text-danger" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Alerta de código expirado */}
            {twoFactorStep && countdownSeconds === 0 && !errorMessage && (
              <div
                role="alert"
                className="ui-notice mb-4 text-sm"
                data-variant="warning"
              >
                <Clock aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                <div className="flex-1 font-medium leading-relaxed">
                  O código de verificação expirou após 5 minutos. Solicite um novo código.
                </div>
              </div>
            )}

            {twoFactorStep ? (
              /* Formulário 2FA Mobile */
              <form onSubmit={onVerify2FA} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <label
                    htmlFor="modal-two-factor-code"
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink tracking-wide"
                  >
                    <KeyRound aria-hidden="true" className="w-4 h-4 text-accent" />
                    <span>Código de 6 dígitos</span>
                  </label>
                  <input
                    id="modal-two-factor-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    disabled={isLoading}
                    placeholder="000000"
                    maxLength={6}
                    value={twoFactorCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setTwoFactorCode(val);
                    }}
                    className="ui-field w-full text-center font-mono tracking-[0.4em] text-2xl border placeholder:text-subtle hover:border-control focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                  />
                </div>

                {/* Linha do Timer e Reenvio */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex items-center gap-1.5 text-muted">
                    <Clock aria-hidden="true" className="w-4 h-4 text-subtle" />
                    <span>
                      {countdownSeconds > 0 ? (
                        <>
                          Expira em{' '}
                          <strong className="text-accent font-mono">
                            {formatTimer(countdownSeconds)}
                          </strong>
                        </>
                      ) : (
                        <span className="text-danger font-semibold">Expirado</span>
                      )}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onResend2FA}
                    disabled={isResending || resendCooldown > 0}
                    className="text-xs font-medium text-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer focus:outline-none flex items-center gap-1"
                  >
                    {isResending ? <RefreshCw aria-hidden="true" className="w-3 h-3 animate-spin" /> : null}
                    <span>
                      {resendCooldown > 0
                        ? `Reenviar (${resendCooldown}s)`
                        : isResending
                        ? 'Reenviando...'
                        : 'Reenviar código'}
                    </span>
                  </button>
                </div>

                {/* Botão Verificar */}
                <button
                  type="submit"
                  disabled={
                    isLoading ||
                    twoFactorCode.length !== 6 ||
                    countdownSeconds === 0 ||
                    attemptsExceeded
                  }
                  className="ui-btn ui-btn-primary w-full mt-4 flex items-center justify-center gap-2 active:scale-[0.985] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin" />
                      <span>Verificando...</span>
                    </div>
                  ) : (
                    <>
                      <ShieldCheck aria-hidden="true" className="w-4 h-4 " />
                      <span>Verificar código</span>
                    </>
                  )}
                </button>

                {/* Botão Voltar */}
                <button
                  type="button"
                  onClick={voltarParaLogin}
                  disabled={isLoading}
                  className="w-full py-2 text-xs text-muted hover:text-ink transition-colors flex items-center justify-center gap-1.5 cursor-pointer focus:outline-none"
                >
                  <ArrowLeft aria-hidden="true" className="w-4 h-4" />
                  <span>Voltar para o login</span>
                </button>
              </form>
            ) : (
              /* Formulário do Modal */
              <form onSubmit={mobileForm.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {/* Campo E-mail ou Usuário */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="modal-email"
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink tracking-wide"
                  >
                    <Mail aria-hidden="true" className="w-4 h-4 text-muted" />
                    <span>E-mail ou usuário</span>
                  </label>
                  <div className="relative">
                    <input
                      id="modal-email"
                      type="email"
                      autoComplete="email"
                      disabled={isLoading}
                      aria-invalid={mobileForm.formState.errors.email ? 'true' : 'false'}
                      placeholder="Digite seu e-mail ou usuário"
                      className={`w-full px-3.5 py-2.5 rounded-lg bg-canvas border text-sm text-ink placeholder:text-subtle focus:outline-none transition-all duration-150 ${
                        mobileForm.formState.errors.email
                          ? 'border-danger/70 focus:border-danger focus:ring-1 focus:ring-danger'
                          : 'border-line hover:border-control focus:border-accent focus:ring-1 focus:ring-accent'
                      }`}
                      {...mobileForm.register('email')}
                    />
                  </div>
                  {mobileForm.formState.errors.email && (
                    <p className="text-xs text-danger flex items-center gap-1 font-medium pt-0.5">
                      <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
                      <span>{mobileForm.formState.errors.email.message}</span>
                    </p>
                  )}
                </div>

                {/* Campo Senha */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="modal-senha"
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink tracking-wide"
                  >
                    <Lock aria-hidden="true" className="w-4 h-4 text-muted" />
                    <span>Senha</span>
                  </label>
                  <div className="relative">
                    <input
                      id="modal-senha"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      disabled={isLoading}
                      aria-invalid={mobileForm.formState.errors.senha ? 'true' : 'false'}
                      placeholder="Digite sua senha"
                      className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-canvas border text-sm text-ink placeholder:text-subtle focus:outline-none transition-all duration-150 ${
                        mobileForm.formState.errors.senha
                          ? 'border-danger/70 focus:border-danger focus:ring-1 focus:ring-danger'
                          : 'border-line hover:border-control focus:border-accent focus:ring-1 focus:ring-accent'
                      }`}
                      {...mobileForm.register('senha')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-subtle hover:text-ink transition-colors focus:outline-none cursor-pointer"
                      aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                      tabIndex={0}
                    >
                      {showPassword ? <EyeOff aria-hidden="true" className="w-4 h-4" /> : <Eye aria-hidden="true" className="w-4 h-4" />}
                    </button>
                  </div>
                  {mobileForm.formState.errors.senha && (
                    <p className="text-xs text-danger flex items-center gap-1 font-medium pt-0.5">
                      <AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" />
                      <span>{mobileForm.formState.errors.senha.message}</span>
                    </p>
                  )}
                </div>

                {/* Linha de Manter Conectado & Esqueceu Senha */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-1 text-xs">
                  <label htmlFor="field-src-app-login-page-tsx-2" className="flex items-center gap-2 cursor-pointer select-none text-ink hover:text-ink transition-colors">
                    <input id="field-src-app-login-page-tsx-2"
                      type="checkbox"
                      checked={manterConectado}
                      onChange={(e) => setManterConectado(e.target.checked)}
                      className="w-4 h-4 rounded bg-canvas border-control text-accent accent-accent focus:ring-0 cursor-pointer"
                    />
                    <span>Manter conectado</span>
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      alert('Para recuperação de senha, contate o administrador do sistema.')
                    }
                    className="text-accent hover:text-accent transition-colors font-medium text-xs cursor-pointer focus:outline-none"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>

                {/* Botão Entrar em Destaque Âmbar */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="ui-btn ui-btn-primary w-full mt-4 flex items-center justify-center gap-2 active:scale-[0.985] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-4 h-4 border-2 border-line border-t-transparent rounded-full animate-spin" />
                      <span>Autenticando...</span>
                    </div>
                  ) : (
                    <>
                      <LogIn aria-hidden="true" className="w-4 h-4 " />
                      <span>Entrar</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-canvas flex items-center justify-center text-muted">
          <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
