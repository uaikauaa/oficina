'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/(authenticated)/layout';
import { apiFetch } from '@/lib/api';

type Summary = { usuarios: number; ativos: number; inativos: number; convitesPendentes: number;
  usuariosPorPapel: Record<string, number>; eventosRecentes: { acao: string; ocorridoEm: string }[];
  conexaoBanco: string; origemBanco: string; atualizadoEm: string };

export default function AdminDashboard() {
  const { user } = useAuth();
  const authorized = user?.roles.includes('ROLE_SUPER_ADMIN') === true;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    apiFetch('/api/admin/resumo').then(async response => {
      if (!response.ok) throw new Error('Não foi possível carregar o painel administrativo.');
      const result: Summary = await response.json();
      if (active) setSummary(result);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar.'); });
    return () => { active = false; };
  }, [authorized]);

  if (!authorized) return <main className="mx-auto max-w-6xl p-6"><h1 className="text-xl font-bold">Acesso restrito</h1></main>;
  return <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 space-y-7">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-accent">Administração</p>
      <h1 className="text-2xl font-bold">Visão geral</h1>
      <p className="text-sm text-subtle">Contas, convites e eventos administrativos recentes.</p></header>
    <nav className="flex flex-wrap gap-2 text-sm" aria-label="Seções administrativas">
      <Link href="/administracao/usuarios" className="ui-btn">Usuários</Link>
      <Link href="/administracao/papeis" className="ui-btn">Papéis</Link>
      <Link href="/administracao/auditoria" className="ui-btn">Auditoria</Link>
      <Link href="/administracao/infraestrutura" className="ui-btn">Infraestrutura</Link>
    </nav>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!summary && !error && <p className="text-sm text-subtle">Carregando...</p>}
    {summary && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo de contas">
        {([['Usuários', summary.usuarios], ['Ativos', summary.ativos], ['Inativos', summary.inativos], ['Convites pendentes', summary.convitesPendentes]] as const)
          .map(([label, count]) => <div key={label} className="rounded-2xl border border-line bg-surface p-5">
            <p className="text-xs text-subtle">{label}</p><strong className="text-3xl">{count}</strong></div>)}
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface p-5"><h2 className="font-semibold">Usuários por papel</h2>
          <ul className="mt-3 space-y-2 text-sm">{Object.entries(summary.usuariosPorPapel).map(([role, count]) =>
            <li key={role} className="flex justify-between gap-4"><span>{role.replace('ROLE_', '').replaceAll('_', ' ')}</span><strong>{count}</strong></li>)}</ul></section>
        <section className="rounded-2xl border border-line bg-surface p-5"><h2 className="font-semibold">Eventos recentes</h2>
          {summary.eventosRecentes.length === 0 ? <p className="mt-3 text-sm text-subtle">Nenhum evento.</p> :
            <ul className="mt-3 space-y-2 text-sm">{summary.eventosRecentes.map((event, index) =>
              <li key={`${event.ocorridoEm}-${index}`} className="flex justify-between gap-3"><span>{event.acao.replaceAll('_', ' ')}</span>
                <time className="text-subtle" dateTime={event.ocorridoEm}>{new Date(event.ocorridoEm).toLocaleString('pt-BR')}</time></li>)}</ul>}
        </section>
      </div>
      <section className="rounded-2xl border border-line bg-surface p-5 text-sm"><h2 className="font-semibold">Infraestrutura</h2>
        <p className="mt-2 text-subtle">Banco {summary.origemBanco}: {summary.conexaoBanco}. Indicadores detalhados e estado das integrações estão no painel de infraestrutura.</p>
        <Link href="/administracao/infraestrutura" className="mt-3 inline-block text-accent underline">Ver infraestrutura</Link>
      </section>
      <p className="text-xs text-subtle">Atualizado em {new Date(summary.atualizadoEm).toLocaleString('pt-BR')}</p>
    </>}
  </main>;
}
