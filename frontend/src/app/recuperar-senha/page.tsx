'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

function RecoveryForm() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
    const timer = window.setTimeout(() => setToken(value), 0);
    if (value) window.history.replaceState(null, '', '/recuperar-senha');
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) { setError('As senhas não correspondem.'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/recuperacao/concluir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, senha: password, confirmacao: confirmation }),
      });
      if (!response.ok) throw new Error('Link inválido ou expirado. Solicite uma nova recuperação.');
      setPassword('');
      setConfirmation('');
      setDone(true);
    } catch {
      setError('Link inválido ou expirado. Solicite uma nova recuperação.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4">
    <section className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Oficina Gestão</p>
      <h1 className="text-2xl font-bold">Definir nova senha</h1>
      {done ? <div className="space-y-3"><p role="status">Senha atualizada. Entre novamente e confirme o código 2FA.</p>
        <Link href="/login" className="ui-btn ui-btn-primary">Ir para o login</Link></div>
        : !token ? <p role="alert">Link ausente. Solicite uma nova recuperação.</p>
        : <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-subtle">O link tem validade limitada e pode ser usado uma vez.</p>
          <label className="block text-sm font-semibold">Nova senha
            <input className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" type="password"
              autoComplete="new-password" minLength={12} required value={password}
              onChange={event => setPassword(event.target.value)} />
          </label>
          <label className="block text-sm font-semibold">Confirme a senha
            <input className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" type="password"
              autoComplete="new-password" minLength={12} required value={confirmation}
              onChange={event => setConfirmation(event.target.value)} />
          </label>
          <p className="text-xs text-subtle">Use ao menos 12 caracteres, com letra, número e símbolo.</p>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button className="ui-btn ui-btn-primary w-full" type="submit" disabled={busy}>
            {busy ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>}
    </section>
  </main>;
}

export default function RecoverPasswordPage() {
  return <RecoveryForm />;
}
