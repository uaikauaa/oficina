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
} from 'lucide-react';

import { sanitizarRedirect, apiFetch, extrairMensagemErroLogin } from '@/lib/api';

const loginSchema = z.object({
  email: z.string().min(1, 'O email é obrigatório').email('Formato de email inválido'),
  senha: z.string().min(1, 'A senha é obrigatória'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = sanitizarRedirect(searchParams.get('redirect'));

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [manterConectado, setManterConectado] = useState(true);

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
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorMsg = await extrairMensagemErroLogin(response);
        throw new Error(errorMsg);
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

  return (
    <>
      {/* ========================================================================= */}
      {/* VERSÃO DESKTOP (>= 1024px) — ABSOLUTAMENTE INALTERADA                    */}
      {/* Layout Split Aprovado, Proporções, Tipografia e Painéis 100% Preservados   */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex min-h-screen w-full flex-row bg-[#0b0f17] text-slate-100 overflow-x-hidden selection:bg-[#f59e0b]/30 selection:text-[#fbbf24]">
        {/* 1. PAINEL ESQUERDO: APRESENTAÇÃO COM FOTOGRAFIA DA OFICINA */}
        <div className="relative w-[62%] xl:w-[64%] 2xl:w-[66%] flex flex-col justify-between p-10 lg:p-12 xl:p-16 min-h-screen overflow-hidden">
          {/* Imagem de Fundo Real (Asset Fornecido pelo Usuário) */}
          <div className="absolute inset-0 z-0">
            <Image
              src="/login-bg.png"
              alt="Bancada de ferramentas e máquinas de solda da oficina"
              fill
              priority
              quality={95}
              className="object-cover object-right"
              sizes="66vw"
            />
            {/* Overlay escuro de alto contraste garantindo legibilidade idêntica ao protótipo */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#070a0f]/95 via-[#090d14]/75 to-[#090d14]/50" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070a0f] via-transparent to-[#070a0f]/40" />
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
                  className="w-full h-full object-contain drop-shadow-[0_2px_10px_rgba(245,158,11,0.35)]"
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white whitespace-nowrap">
                Oficina <span className="text-[#f59e0b]">Gestão</span>
              </h1>
            </div>

            {/* Divisor Vertical */}
            <div className="hidden sm:block w-px h-8 bg-slate-700/80" />

            {/* Subtítulo Institucional */}
            <div className="hidden sm:block text-xs text-slate-300 font-medium leading-tight">
              <p>Mais controle</p>
              <p>para o seu negócio</p>
            </div>
          </div>

          {/* Meio Esquerdo: Título Heroico, Descrição e 3 Recursos */}
          <div className="relative z-10 my-auto py-10 lg:py-8 max-w-xl">
            <h2 className="text-3xl sm:text-4xl lg:text-[42px] xl:text-[46px] font-extrabold text-white tracking-tight leading-[1.12]">
              Gestão completa da sua <br />
              oficina <span className="text-[#f59e0b]">em um só lugar.</span>
            </h2>

            <p className="mt-5 text-sm sm:text-base text-slate-300 leading-relaxed font-normal max-w-lg">
              Controle seus clientes, ordens de serviço, estoque de peças e o histórico de cada máquina
              com praticidade e segurança.
            </p>

            {/* 3 Blocos de Recursos com Ícones */}
            <div className="mt-9 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4 lg:gap-5">
              {/* Bloco Clientes */}
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-center text-[#f59e0b] shadow-inner">
                  <User className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide">Clientes</h3>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    Cadastros e histórico completo
                  </p>
                </div>
              </div>

              {/* Bloco Ordens de Serviço */}
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-center text-[#f59e0b] shadow-inner">
                  <FileText className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide">Ordens de Serviço</h3>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    Do diagnóstico à finalização
                  </p>
                </div>
              </div>

              {/* Bloco Estoque */}
              <div className="space-y-2">
                <div className="w-9 h-9 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-center text-[#f59e0b] shadow-inner">
                  <Package className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white tracking-wide">Estoque</h3>
                  <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                    Controle de peças e movimentações
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé do Painel Esquerdo */}
          <div className="relative z-10 pt-6 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-slate-400">
                <ShieldCheck className="w-4 h-4 text-slate-300" />
                <span className="font-medium text-[11px] tracking-wide text-slate-300">
                  Sistema interno • Oficina Gestão
                </span>
              </div>
              <div className="w-32 xl:w-44 h-px bg-slate-700/50" />
            </div>
          </div>

          {/* Elemento Geométrico Decorativo no Canto Inferior Esquerdo (Âmbar) */}
          <div
            className="absolute -bottom-8 -left-8 w-36 h-36 border-2 border-[#f59e0b]/40 rotate-45 pointer-events-none rounded-lg z-0"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-12 -left-12 w-44 h-44 border border-[#f59e0b]/20 rotate-45 pointer-events-none rounded-xl z-0"
            aria-hidden="true"
          />
        </div>

        {/* 2. PAINEL DIREITO: ÁREA ESTRUTURAL DE AUTENTICAÇÃO */}
        <div className="relative w-[38%] xl:w-[36%] 2xl:w-[34%] bg-[#080c14] border-l border-slate-800/80 flex flex-col justify-center p-10 xl:p-14 min-h-screen">
          <div className="w-full max-w-[380px] mx-auto py-8">
            {/* Saudação com Barra Vertical Âmbar */}
            <div className="flex items-start gap-3.5 mb-7">
              <div className="w-1.5 h-12 bg-[#f59e0b] rounded-full shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-white leading-tight">
                  Bem-vindo de volta!
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 font-normal">
                  Faça login para continuar
                </p>
              </div>
            </div>

            {/* Alerta de Erro com Animação Resiliente */}
            {errorMessage && (
              <div
                id="login-error-alert"
                role="alert"
                aria-live="assertive"
                className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-2.5 shadow-lg shadow-red-950/20"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Formulário Desktop */}
            <form onSubmit={desktopForm.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Campo E-mail ou Usuário */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 tracking-wide"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
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
                    className={`w-full px-3.5 py-2.5 rounded-lg bg-[#0e1422] border text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all duration-150 ${
                      desktopForm.formState.errors.email
                        ? 'border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-slate-800 hover:border-slate-700 focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]'
                    }`}
                    {...desktopForm.register('email')}
                  />
                </div>
                {desktopForm.formState.errors.email && (
                  <p className="text-xs text-red-400 flex items-center gap-1 font-medium pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{desktopForm.formState.errors.email.message}</span>
                  </p>
                )}
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5">
                <label
                  htmlFor="senha"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 tracking-wide"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
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
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-[#0e1422] border text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all duration-150 ${
                      desktopForm.formState.errors.senha
                        ? 'border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-slate-800 hover:border-slate-700 focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]'
                    }`}
                    {...desktopForm.register('senha')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {desktopForm.formState.errors.senha && (
                  <p className="text-xs text-red-400 flex items-center gap-1 font-medium pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{desktopForm.formState.errors.senha.message}</span>
                  </p>
                )}
              </div>

              {/* Linha de Manter Conectado & Esqueceu Senha */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={manterConectado}
                    onChange={(e) => setManterConectado(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#0e1422] border-slate-700 text-[#f59e0b] accent-[#f59e0b] focus:ring-0 cursor-pointer"
                  />
                  <span>Manter conectado</span>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    alert('Para recuperação de senha, contate o administrador do sistema.')
                  }
                  className="text-[#f59e0b] hover:text-[#fbbf24] transition-colors font-medium text-xs cursor-pointer focus:outline-none"
                >
                  Esqueceu sua senha?
                </button>
              </div>

              {/* Botão Entrar em Destaque Âmbar */}
              <button
                id="login-submit-btn"
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 py-3 px-4 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#b45309] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.985] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Autenticando...</span>
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 stroke-[2.5]" />
                    <span>Entrar</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EXPERIÊNCIA MOBILE / TABLET (< 1024px)                                    */}
      {/* Fundo Fullscreen, Introdução Imersiva, Botão "Entrar" e Modal Central     */}
      {/* ========================================================================= */}
      <div className="flex lg:hidden relative min-h-screen w-full flex-col justify-between p-5 sm:p-8 md:p-10 bg-[#070a0f] text-slate-100 overflow-x-hidden selection:bg-[#f59e0b]/30 selection:text-[#fbbf24]">
        {/* Imagem de Fundo Real Fullscreen */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/login-bg.png"
            alt="Bancada de ferramentas e máquinas de solda da oficina"
            fill
            priority
            quality={90}
            className="object-cover object-center"
            sizes="100vw"
          />
          {/* Camadas de Overlay Escuro para Contraste e Legibilidade Perfeita */}
          <div className="absolute inset-0 bg-[#070a0f]/80" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#070a0f]/95 via-[#090d14]/75 to-[#070a0f]/95" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070a0f] via-transparent to-[#070a0f]/40" />
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
                className="w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(245,158,11,0.35)]"
              />
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
              Oficina <span className="text-[#f59e0b]">Gestão</span>
            </span>
          </div>

          {/* Lado Direito: Botão Primário "Entrar" */}
          <button
            ref={mobileTriggerRef}
            type="button"
            onClick={abrirModal}
            aria-haspopup="dialog"
            aria-expanded={isModalOpen}
            className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#b45309] text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/25 active:scale-[0.97] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:ring-offset-2 focus:ring-offset-[#070a0f]"
          >
            <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
            <span>Entrar</span>
          </button>
        </header>

        {/* 2. Conteúdo Principal da Introdução */}
        <main className="relative z-10 my-auto py-8 sm:py-12 max-w-2xl w-full mx-auto">
          <div className="space-y-4 sm:space-y-5">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-[1.18]">
              Gestão completa da sua <br />
              oficina <span className="text-[#f59e0b]">em um só lugar.</span>
            </h1>

            <p className="text-xs sm:text-sm md:text-base text-slate-300 leading-relaxed font-normal max-w-xl">
              Controle seus clientes, ordens de serviço, estoque de peças e o histórico de cada máquina
              com praticidade e segurança.
            </p>
          </div>

          {/* 3 Blocos de Recursos Adaptados para Telas Menores */}
          <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {/* Bloco Clientes */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/75 border border-slate-800/80 backdrop-blur-sm flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b] shrink-0">
                <User className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white tracking-wide">Clientes</h2>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Cadastros e histórico completo
                </p>
              </div>
            </div>

            {/* Bloco Ordens de Serviço */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/75 border border-slate-800/80 backdrop-blur-sm flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b] shrink-0">
                <FileText className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white tracking-wide">Ordens de Serviço</h2>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Do diagnóstico à finalização
                </p>
              </div>
            </div>

            {/* Bloco Estoque */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/75 border border-slate-800/80 backdrop-blur-sm flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center text-[#f59e0b] shrink-0">
                <Package className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white tracking-wide">Estoque</h2>
                <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                  Controle de peças e movimentações
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* 3. Rodapé Mobile/Tablet */}
        <footer className="relative z-10 pt-4 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-[11px] tracking-wide text-slate-400">
              Sistema interno • Oficina Gestão
            </span>
          </div>
        </footer>

        {/* Detalhe Geométrico Decorativo */}
        <div
          className="absolute -bottom-10 -left-10 w-32 h-32 border border-[#f59e0b]/20 rotate-45 pointer-events-none rounded-xl z-0"
          aria-hidden="true"
        />
      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL CENTRAL DE LOGIN PARA MOBILE / TABLET (< 1024px)                 */}
      {/* Backdrop com Blur Profundo, Animação de Entrada e Acessibilidade Completa  */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md transition-opacity duration-200"
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
            className="relative w-full max-w-[420px] max-h-[90vh] overflow-y-auto rounded-2xl bg-[#0c101a] border border-slate-800 p-6 sm:p-7 shadow-2xl shadow-black/90 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botão de Fechar X no Cabeçalho */}
            <button
              type="button"
              onClick={fecharModal}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f59e0b]/50"
              aria-label="Fechar modal de login"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Cabeçalho do Modal com Barra Âmbar */}
            <div className="flex items-start gap-3.5 mb-6 pr-8">
              <div className="w-1.5 h-11 bg-[#f59e0b] rounded-full shrink-0 mt-0.5" />
              <div>
                <h2
                  id="modal-login-title"
                  className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight"
                >
                  Entrar no Sistema
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-normal">
                  Faça login para continuar
                </p>
              </div>
            </div>

            {/* Alerta de Erro do Modal */}
            {errorMessage && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 shadow-md shadow-red-950/20"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              </div>
            )}

            {/* Formulário do Modal */}
            <form onSubmit={mobileForm.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {/* Campo E-mail ou Usuário */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-email"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 tracking-wide"
                >
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
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
                    className={`w-full px-3.5 py-2.5 rounded-lg bg-[#0e1422] border text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all duration-150 ${
                      mobileForm.formState.errors.email
                        ? 'border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-slate-800 hover:border-slate-700 focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]'
                    }`}
                    {...mobileForm.register('email')}
                  />
                </div>
                {mobileForm.formState.errors.email && (
                  <p className="text-xs text-red-400 flex items-center gap-1 font-medium pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{mobileForm.formState.errors.email.message}</span>
                  </p>
                )}
              </div>

              {/* Campo Senha */}
              <div className="space-y-1.5">
                <label
                  htmlFor="modal-senha"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 tracking-wide"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
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
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-lg bg-[#0e1422] border text-sm text-white placeholder:text-slate-600 focus:outline-none transition-all duration-150 ${
                      mobileForm.formState.errors.senha
                        ? 'border-red-500/70 focus:border-red-500 focus:ring-1 focus:ring-red-500'
                        : 'border-slate-800 hover:border-slate-700 focus:border-[#f59e0b] focus:ring-1 focus:ring-[#f59e0b]'
                    }`}
                    {...mobileForm.register('senha')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-200 transition-colors focus:outline-none cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mobileForm.formState.errors.senha && (
                  <p className="text-xs text-red-400 flex items-center gap-1 font-medium pt-0.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{mobileForm.formState.errors.senha.message}</span>
                  </p>
                )}
              </div>

              {/* Linha de Manter Conectado & Esqueceu Senha */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={manterConectado}
                    onChange={(e) => setManterConectado(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#0e1422] border-slate-700 text-[#f59e0b] accent-[#f59e0b] focus:ring-0 cursor-pointer"
                  />
                  <span>Manter conectado</span>
                </label>

                <button
                  type="button"
                  onClick={() =>
                    alert('Para recuperação de senha, contate o administrador do sistema.')
                  }
                  className="text-[#f59e0b] hover:text-[#fbbf24] transition-colors font-medium text-xs cursor-pointer focus:outline-none"
                >
                  Esqueceu sua senha?
                </button>
              </div>

              {/* Botão Entrar em Destaque Âmbar */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 py-3 px-4 rounded-xl bg-[#f59e0b] hover:bg-[#d97706] active:bg-[#b45309] text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.985] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Autenticando...</span>
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 stroke-[2.5]" />
                    <span>Entrar</span>
                  </>
                )}
              </button>
            </form>
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
        <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center text-slate-400">
          <div className="w-7 h-7 border-2 border-[#f59e0b] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
