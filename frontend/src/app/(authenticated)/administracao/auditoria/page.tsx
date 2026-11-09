'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/(authenticated)/layout';
import { apiFetch } from '@/lib/api';

type Event = { id: number; atorId: number | null; alvoUsuarioId: number | null;
  acao: string; motivo: string | null; detalhes: string | null; ocorridoEm: string };
type EventPage = { content: Event[]; totalElements: number; page: number; size: number };

export default function AuditPage() {
  const { user } = useAuth();
  const authorized = user?.roles.includes('ROLE_SUPER_ADMIN') === true;
  const [page, setPage] = useState(0);
  const [data, setData] = useState<EventPage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    apiFetch(`/api/admin/auditoria?page=${page}&size=20`)
      .then(async response => {
        if (!response.ok) throw new Error('Não foi possível carregar a auditoria.');
        const next: EventPage = await response.json();
        if (active) { setData(next); setError(''); }
      }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar.'); });
    return () => { active = false; };
  }, [authorized, page]);

  if (!authorized) return <main className="mx-auto max-w-6xl p-6"><h1 className="text-xl font-bold">Acesso restrito</h1></main>;
  return <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-accent">Administração</p>
      <h1 className="text-2xl font-bold">Auditoria administrativa</h1>
      <p className="text-sm text-subtle">Registro de mudanças de acesso, convites e sessões.</p></header>
    <nav className="flex flex-wrap gap-2 text-sm" aria-label="Seções administrativas">
      <Link href="/administracao/usuarios" className="ui-btn">Usuários</Link>
      <Link href="/administracao/papeis" className="ui-btn">Papéis</Link>
      <Link href="/administracao/infraestrutura" className="ui-btn">Infraestrutura</Link>
    </nav>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!data && !error && <p className="text-sm text-subtle">Carregando...</p>}
    {data && <><p className="text-xs text-subtle">{data.totalElements} evento(s)</p>
      {data.content.length === 0 && <p className="rounded-2xl border border-line bg-surface p-6 text-subtle">Nenhum evento registrado.</p>}
      <ol className="space-y-3">{data.content.map(event => <li key={event.id} className="rounded-2xl border border-line bg-surface p-4 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{event.acao.replaceAll('_', ' ')}</strong>
          <time className="text-xs text-subtle" dateTime={event.ocorridoEm}>{new Date(event.ocorridoEm).toLocaleString('pt-BR')}</time></div>
        <p className="text-xs text-subtle">Ator #{event.atorId ?? 'removido'} · Alvo #{event.alvoUsuarioId ?? '—'}</p>
        {event.motivo && <p className="text-sm">Motivo: {event.motivo}</p>}
        {event.detalhes && <p className="text-xs text-subtle break-words">{event.detalhes}</p>}
      </li>)}</ol>
      <div className="flex items-center justify-between text-sm"><button className="ui-btn" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page + 1}</span><button className="ui-btn" type="button" disabled={(page + 1) * data.size >= data.totalElements} onClick={() => setPage(page + 1)}>Próxima</button></div>
    </>}
  </main>;
}
