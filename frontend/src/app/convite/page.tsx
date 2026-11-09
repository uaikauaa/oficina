'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

function InviteForm() {
  const params = useSearchParams();
  const [token] = useState(() => params.get('token') || '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token) window.history.replaceState(null, '', '/convite');
  }, [token]);

  async function accept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || name.trim().length === 0 || password.length < 12) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/convites/aceitar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, nome: name.trim(), senha: password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Convite inválido ou expirado.');
      }
      setPassword('');
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível aceitar o convite.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4">
    <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Oficina Gestão</p>
      <h1 className="text-2xl font-bold">Ativar sua conta</h1>
      {done ? <div className="space-y-3">
        <p>Conta criada. Entre com sua senha e confirme o código 2FA enviado ao seu e-mail.</p>
        <Link href="/login" className="ui-btn ui-btn-primary">Ir para o login</Link>
      </div> : !token ? <p role="alert">Link de convite ausente. Solicite um novo convite ao administrador.</p>
        : <form onSubmit={accept} className="space-y-4">
          <p className="text-sm text-subtle">O link pode ser usado uma única vez e expira em 24 horas.</p>
          <label className="block text-sm font-semibold">Seu nome
            <input className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" maxLength={100}
              autoComplete="name" value={name} onChange={event => setName(event.target.value)} required />
          </label>
          <label className="block text-sm font-semibold">Crie sua senha
            <input className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" type="password"
              autoComplete="new-password" minLength={12} value={password}
              onChange={event => setPassword(event.target.value)} required />
          </label>
          <p className="text-xs text-subtle">Use pelo menos 12 caracteres, incluindo letra, número e símbolo.</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button className="ui-btn ui-btn-primary w-full" type="submit" disabled={busy}>{busy ? 'Ativando...' : 'Ativar conta'}</button>
        </form>}
    </section>
  </main>;
}

export default function InvitePage() {
  return <Suspense fallback={<div className="min-h-screen bg-canvas" />}><InviteForm /></Suspense>;
}
