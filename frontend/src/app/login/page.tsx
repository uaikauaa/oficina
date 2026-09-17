'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Mail, Eye, EyeOff, Wrench, AlertCircle, ArrowRight } from 'lucide-react';

import { sanitizarRedirect } from '@/lib/api';

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      senha: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Importante: inclui e recebe cookies HttpOnly
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Credenciais inválidas. Verifique seu email e senha.');
        } else if (response.status === 403) {
          throw new Error('Conta desativada. Entre em contato com o suporte.');
        } else {
          throw new Error('Falha de conexão com o servidor. Tente novamente mais tarde.');
        }
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

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-slate-950 text-slate-100 p-4">
      {/* Container do Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        {/* Cabeçalho */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4 shadow-inner">
            <Wrench className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Oficina Gestão</h1>
          <p className="text-sm text-slate-400 mt-1">Acesso Administrativo da Proprietária</p>
        </div>

        {/* Alerta de Erro */}
        {errorMessage && (
          <div
            id="login-error-alert"
            className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3 animate-in fade-in duration-200"
          >
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Campo Email */}
          <div>
            <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Email de Acesso
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="email"
                type="email"
                autoComplete="email"
                disabled={isLoading}
                placeholder="exemplo@oficina.com.br"
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
                  errors.email
                    ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-slate-800 focus:border-amber-500 focus:ring-amber-500/20'
                }`}
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Campo Senha */}
          <div>
            <label htmlFor="senha" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Senha
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="senha"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isLoading}
                placeholder="••••••••"
                className={`w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-950/60 border text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
                  errors.senha
                    ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500'
                    : 'border-slate-800 focus:border-amber-500 focus:ring-amber-500/20'
                }`}
                {...register('senha')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.senha && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                {errors.senha.message}
              </p>
            )}
          </div>

          {/* Botão de Envio */}
          <button
            id="login-submit-btn"
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Autenticando...</span>
              </div>
            ) : (
              <>
                <span>Entrar no Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Rodapé do card */}
        <div className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-500">
            Acesso restrito ao operador cadastrado. Comunicação segura via SSL e tokens stateless.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
