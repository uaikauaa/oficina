'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/(authenticated)/layout';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

type AdminUser = {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  roles: string[];
  permissoes: string[];
};
type UserPage = { content: AdminUser[]; totalElements: number; totalPages: number };
type Action = 'status' | 'roles' | 'revoke';

const roleOptions = [
  'ROLE_SUPER_ADMIN', 'ROLE_OPERADOR_GERAL', 'ROLE_ADMIN', 'ROLE_GERENTE',
  'ROLE_ATENDENTE', 'ROLE_TECNICO', 'ROLE_ESTOQUISTA', 'ROLE_FINANCEIRO', 'ROLE_CONSULTA',
];

export default function AdminUsersPage() {
  const { user } = useAuth();
  const authorized = user?.roles.includes('ROLE_SUPER_ADMIN') === true;
  const [items, setItems] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [action, setAction] = useState<Action>('status');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ROLE_CONSULTA');
  const [inviteReason, setInviteReason] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [notice, setNotice] = useState('');
  const [availableRoles, setAvailableRoles] = useState(roleOptions);

  const load = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page: String(page), size: '20' });
      if (search.trim()) query.set('search', search.trim());
      if (status) query.set('ativo', status);
      if (role) query.set('role', role);
      const response = await apiFetch(`/api/admin/usuarios?${query}`);
      if (!response.ok) throw new Error('Não foi possível carregar usuários.');
      const data: UserPage = await response.json();
      setItems(data.content);
      setTotal(data.totalElements);
      setTotalPages(data.totalPages);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, [authorized, page, role, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!authorized) return;
    apiFetch('/api/admin/papeis').then(async response => {
      if (response.ok) {
        const data: { nome: string }[] = await response.json();
        setAvailableRoles(data.map(item => item.nome));
      }
    }).catch(() => {});
  }, [authorized]);

  function open(userItem: AdminUser, nextAction: Action) {
    setSelected(userItem);
    setAction(nextAction);
    setSelectedRoles(userItem.roles);
    setReason('');
    setPassword('');
    setError('');
  }

  async function submit() {
    if (!selected || reason.trim().length < 10 || !password) return;
    setBusy(true);
    setError('');
    const route = action === 'status' ? `${selected.id}/status`
      : action === 'roles' ? `${selected.id}/papeis` : `${selected.id}/revogar-sessoes`;
    const method = action === 'status' ? 'PATCH' : action === 'roles' ? 'PUT' : 'POST';
    const confirmation = action === 'status' ? 'ALTERAR_STATUS'
      : action === 'roles' ? 'ALTERAR_PAPEIS' : 'REVOGAR_SESSOES';
    const body = {
      motivo: reason.trim(), senhaAtual: password, confirmacao: confirmation,
      ...(action === 'status' ? { ativo: !selected.ativo } : {}),
      ...(action === 'roles' ? { roles: selectedRoles } : {}),
    };
    try {
      const response = await apiFetch(`/api/admin/usuarios/${route}`, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'A alteração foi recusada.');
      }
      setSelected(null);
      setPassword('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function sendInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/admin/convites', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole,
          motivo: inviteReason.trim(), senhaAtual: invitePassword, confirmacao: 'CRIAR_CONVITE' }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Não foi possível enviar o convite.');
      }
      setInviteOpen(false);
      setInvitePassword('');
      setInviteReason('');
      setInviteEmail('');
      setNotice('Convite enviado. A pessoa poderá definir a senha pelo link recebido.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao enviar convite.');
    } finally { setBusy(false); }
  }

  if (!authorized) return <main className="mx-auto max-w-6xl p-6"><h1 className="text-xl font-bold">Acesso restrito</h1></main>;

  return <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-accent">Administração</p>
      <h1 className="text-2xl font-bold text-ink">Usuários e acesso</h1>
      <p className="text-sm text-subtle">Controle de contas, papéis e sessões. Alterações exigem confirmação e senha.</p>
      </div>
      <button type="button" className="ui-btn ui-btn-primary" onClick={() => { setInviteOpen(true); setError(''); }}>Convidar usuário</button>
    </header>

    <nav className="flex flex-wrap gap-2 text-sm" aria-label="Seções administrativas">
      <Link href="/administracao/papeis" className="ui-btn">Papéis</Link>
      <Link href="/administracao/auditoria" className="ui-btn">Auditoria</Link>
      <Link href="/administracao/infraestrutura" className="ui-btn">Infraestrutura</Link>
    </nav>

    <section className="rounded-2xl border border-line bg-surface p-4 space-y-4" aria-label="Filtros de usuários">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold">Busca
          <input className="mt-1 w-full rounded-xl border border-control bg-canvas p-2 text-ink" value={search}
            onChange={event => { setSearch(event.target.value); setPage(0); }} placeholder="Nome ou e-mail" />
        </label>
        <label className="text-sm font-semibold">Status
          <select className="mt-1 w-full rounded-xl border border-control bg-canvas p-2 text-ink" value={status}
            onChange={event => { setStatus(event.target.value); setPage(0); }}>
            <option value="">Todos</option><option value="true">Ativos</option><option value="false">Desativados</option>
          </select>
        </label>
        <label className="text-sm font-semibold">Papel
          <select className="mt-1 w-full rounded-xl border border-control bg-canvas p-2 text-ink" value={role}
            onChange={event => { setRole(event.target.value); setPage(0); }}>
            <option value="">Todos</option>{availableRoles.map(option => <option key={option} value={option}>{option.replace('ROLE_', '').replaceAll('_', ' ')}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-subtle">{loading ? 'Carregando...' : `${total} usuário(s) encontrado(s)`}</p>
    </section>

    {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="rounded-xl border border-line bg-surface p-3 text-sm text-ink">{notice}</p>}
    <section className="grid gap-3" aria-label="Lista de usuários">
      {!loading && items.length === 0 && <p className="rounded-2xl border border-line bg-surface p-8 text-center text-subtle">Nenhum usuário encontrado.</p>}
      {items.map(item => <article key={item.id} className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{item.nome}</h2>
          <p className="text-sm text-subtle break-all">{item.email}</p>
          <p className="mt-1 text-xs text-subtle">{item.roles.join(', ')} · {item.ativo ? 'Ativo' : 'Desativado'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="ui-btn" type="button" onClick={() => open(item, 'roles')} disabled={item.id === user?.id}>Papéis</button>
          <button className="ui-btn" type="button" onClick={() => open(item, 'status')} disabled={item.id === user?.id}>{item.ativo ? 'Desativar' : 'Ativar'}</button>
          <button className="ui-btn" type="button" onClick={() => open(item, 'revoke')} disabled={item.id === user?.id}>Revogar sessões</button>
        </div>
      </article>)}
    </section>
    <div className="flex items-center justify-between gap-3 text-sm">
      <button className="ui-btn" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</button>
      <span>Página {page + 1} de {Math.max(totalPages, 1)}</span>
      <button className="ui-btn" type="button" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Próxima</button>
    </div>

    {selected && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="admin-action-title" className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-xl space-y-4">
        <h2 id="admin-action-title" className="text-lg font-bold">{action === 'status' ? selected.ativo ? 'Desativar conta' : 'Ativar conta' : action === 'roles' ? 'Alterar papéis' : 'Revogar sessões'}</h2>
        <p className="text-sm text-subtle">{selected.nome} · {selected.email}</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {action === 'roles' && <fieldset className="grid grid-cols-2 gap-2 text-sm"><legend className="mb-2 font-semibold">Papéis permitidos</legend>
          {availableRoles.map(option => <label key={option} className="flex items-center gap-2"><input type="checkbox" checked={selectedRoles.includes(option)}
            onChange={event => setSelectedRoles(current => event.target.checked ? [...current, option] : current.filter(value => value !== option))} />{option.replace('ROLE_', '').replaceAll('_', ' ')}</label>)}
        </fieldset>}
        <label className="block text-sm font-semibold">Motivo (mínimo 10 caracteres)
          <textarea className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Confirme com sua senha
          <input type="password" autoComplete="current-password" className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" value={password} onChange={event => setPassword(event.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button className="ui-btn" type="button" onClick={() => { setSelected(null); setPassword(''); }}>Cancelar</button>
          <button className="ui-btn ui-btn-primary" type="button" disabled={busy || reason.trim().length < 10 || !password || (action === 'roles' && selectedRoles.length === 0)} onClick={() => void submit()}>{busy ? 'Salvando...' : 'Confirmar'}</button>
        </div>
      </div>
    </div>}
    {inviteOpen && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={sendInvite} role="dialog" aria-modal="true" aria-labelledby="invite-title"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-xl space-y-4">
        <h2 id="invite-title" className="text-lg font-bold">Convidar usuário</h2>
        <p className="text-sm text-subtle">Um link de uso único será enviado por e-mail. O titular definirá a senha e fará login com 2FA.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <label className="block text-sm font-semibold">E-mail
          <input type="email" required maxLength={150} autoComplete="off" className="mt-1 w-full rounded-xl border border-control bg-canvas p-2"
            value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Papel
          <select className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" value={inviteRole}
            onChange={event => setInviteRole(event.target.value)}>
            {availableRoles.map(option => <option key={option} value={option}>{option.replace('ROLE_', '').replaceAll('_', ' ')}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold">Motivo
          <textarea required minLength={10} maxLength={500} className="mt-1 w-full rounded-xl border border-control bg-canvas p-2"
            value={inviteReason} onChange={event => setInviteReason(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Confirme com sua senha
          <input type="password" required autoComplete="current-password" className="mt-1 w-full rounded-xl border border-control bg-canvas p-2"
            value={invitePassword} onChange={event => setInvitePassword(event.target.value)} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" className="ui-btn" onClick={() => { setInviteOpen(false); setInvitePassword(''); }}>Cancelar</button>
          <button type="submit" className="ui-btn ui-btn-primary" disabled={busy || inviteReason.trim().length < 10}>{busy ? 'Enviando...' : 'Enviar convite'}</button>
        </div>
      </form>
    </div>}
  </main>;
}
