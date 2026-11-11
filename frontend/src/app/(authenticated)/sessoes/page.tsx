'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Session = { id: string; criadaEm: string; expiraEm: string; lembrar: boolean; atual: boolean };

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await apiFetch('/api/auth/sessoes');
    if (!response.ok) throw new Error('Não foi possível carregar as sessões.');
    setSessions(await response.json());
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { load().catch(e => setError(e.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const revoke = async (path: string, current: boolean) => {
    if (!window.confirm(current ? 'Encerrar esta sessão?' : 'Encerrar as sessões selecionadas?')) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch(path, { method: 'DELETE' });
      if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
      if (current) router.replace('/login?sessionChecked=1');
      else await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao encerrar.'); }
    finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-4xl space-y-5 p-4 sm:p-6">
    <header><h1 className="text-2xl font-bold">Sessões</h1><p className="text-sm text-subtle">Sessões com renovação ativa. A data de última atividade e o dispositivo não são registrados.</p></header>
    <div className="flex flex-wrap gap-2"><button className="ui-btn" disabled={busy || !sessions?.some(s => !s.atual)} onClick={() => revoke('/api/auth/sessoes/outras', false)}>Encerrar outras</button>
      <button className="ui-btn" disabled={busy || !sessions?.length} onClick={() => revoke('/api/auth/sessoes', true)}>Encerrar todas</button></div>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {!sessions && !error && <p>Carregando...</p>}
    {sessions?.length === 0 && <p>Nenhuma sessão com renovação ativa.</p>}
    <ul className="space-y-3">{sessions?.map(s => <li key={s.id} className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><strong>{s.atual ? 'Sessão atual' : 'Outra sessão'}</strong><p className="text-sm text-subtle">Criada em {new Date(s.criadaEm).toLocaleString('pt-BR')} · Expira em {new Date(s.expiraEm).toLocaleString('pt-BR')}</p><p className="text-xs text-subtle">{s.lembrar ? 'Manter conectado' : 'Sessão temporária'}</p></div>
        <button className="ui-btn" disabled={busy} onClick={() => revoke(`/api/auth/sessoes/${s.id}`, s.atual)}>Encerrar</button></div>
    </li>)}</ul>
    <p className="text-xs text-subtle">Após encerrar uma sessão individual, o acesso já emitido pode permanecer válido por até 15 minutos. A renovação é bloqueada imediatamente.</p>
  </main>;
}
