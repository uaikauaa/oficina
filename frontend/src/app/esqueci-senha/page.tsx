'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function RequestPasswordRecoveryPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/recuperacao/solicitar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) throw new Error('Não foi possível processar a solicitação. Tente novamente mais tarde.');
      setDone(true);
    } catch {
      setError('Não foi possível processar a solicitação. Tente novamente mais tarde.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4">
    <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Oficina Gestão</p>
      <h1 className="text-2xl font-bold">Recuperar acesso</h1>
      {done ? <p role="status">Se existir uma conta ativa para esse e-mail, enviaremos um link de recuperação.</p>
        : <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-subtle">Informe o e-mail da conta. A resposta será a mesma para endereços existentes ou não.</p>
          <label className="block text-sm font-semibold">E-mail
            <input className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" type="email"
              autoComplete="email" maxLength={150} required value={email}
              onChange={event => setEmail(event.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button className="ui-btn ui-btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Enviando...' : 'Solicitar recuperação'}
          </button>
        </form>}
      <Link href="/login" className="text-sm text-accent underline">Voltar ao login</Link>
    </section>
  </main>;
}
