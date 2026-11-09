'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/(authenticated)/layout';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

type Role = { id: number; nome: string; descricao: string; permissoes: string[]; customizado: boolean };

export default function RolesPage() {
  const { user } = useAuth();
  const authorized = user?.roles.includes('ROLE_SUPER_ADMIN') === true;
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [editing, setEditing] = useState<Role | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [grants, setGrants] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [roleResponse, permissionResponse] = await Promise.all([
      apiFetch('/api/admin/papeis'), apiFetch('/api/admin/permissoes'),
    ]);
    if (!roleResponse.ok || !permissionResponse.ok) throw new Error('Não foi possível carregar papéis.');
    setRoles(await roleResponse.json());
    setCatalog(await permissionResponse.json());
  }

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    Promise.all([apiFetch('/api/admin/papeis'), apiFetch('/api/admin/permissoes')])
      .then(async ([roleResponse, permissionResponse]) => {
        if (!roleResponse.ok || !permissionResponse.ok) throw new Error('Não foi possível carregar papéis.');
        const [roleItems, permissionItems] = await Promise.all([roleResponse.json(), permissionResponse.json()]);
        if (active) { setRoles(roleItems); setCatalog(permissionItems); }
      }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar.'); });
    return () => { active = false; };
  }, [authorized]);

  function start(role?: Role) {
    setEditing(role || { id: 0, nome: '', descricao: '', permissoes: [], customizado: true });
    setName(role?.nome || 'ROLE_CUSTOM_');
    setDescription(role?.descricao || '');
    setGrants(role?.permissoes || []);
    setReason(''); setPassword(''); setFilter(''); setError(''); setNotice('');
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true); setError('');
    try {
      const endpoint = editing.id ? `/api/admin/papeis/${editing.id}` : '/api/admin/papeis';
      const response = await apiFetch(endpoint, {
        method: editing.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: name.trim(), descricao: description.trim(), permissoes: grants,
          motivo: reason.trim(), senhaAtual: password, confirmacao: 'GERENCIAR_PAPEL' }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Alteração recusada.');
      }
      setEditing(null); setPassword('');
      await reload();
      setNotice('Papel salvo. Sessões afetadas foram revogadas.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }

  if (!authorized) return <main className="mx-auto max-w-6xl p-6"><h1 className="text-xl font-bold">Acesso restrito</h1></main>;

  return <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-accent">Administração</p>
        <h1 className="text-2xl font-bold">Papéis e permissões</h1>
        <p className="text-sm text-subtle">Papéis padrão são preservados; crie escopos personalizados para delegação.</p></div>
      <button className="ui-btn ui-btn-primary" type="button" onClick={() => start()}>Novo papel</button>
    </header>
    <nav className="flex flex-wrap gap-2 text-sm" aria-label="Seções administrativas">
      <Link href="/administracao/usuarios" className="ui-btn">Usuários</Link>
      <Link href="/administracao/auditoria" className="ui-btn">Auditoria</Link>
      <Link href="/administracao/infraestrutura" className="ui-btn">Infraestrutura</Link>
    </nav>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {notice && <p role="status" className="text-sm text-ink">{notice}</p>}
    <section className="grid gap-3 md:grid-cols-2">
      {roles.map(role => <article key={role.id} className="rounded-2xl border border-line bg-surface p-4 space-y-2">
        <div className="flex items-start justify-between gap-3"><h2 className="font-semibold break-all">{role.nome}</h2>
          <span className="text-xs text-subtle">{role.customizado ? 'Personalizado' : 'Padrão'}</span></div>
        <p className="text-sm text-subtle">{role.descricao}</p>
        <p className="text-xs text-subtle">{role.permissoes.length} permissões</p>
        {role.customizado && <button type="button" className="ui-btn" onClick={() => start(role)}>Editar</button>}
      </article>)}
    </section>

    {editing && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="role-dialog-title"
        className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-line bg-surface p-5 shadow-xl space-y-4">
        <h2 id="role-dialog-title" className="text-lg font-bold">{editing.id ? 'Editar papel' : 'Criar papel'}</h2>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <label className="block text-sm font-semibold">Identificador
          <input required pattern="ROLE_CUSTOM_[A-Za-z0-9_]{3,30}" maxLength={42} disabled={editing.id !== 0}
            className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" value={name} onChange={event => setName(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Descrição
          <input required maxLength={255} className="mt-1 w-full rounded-xl border border-control bg-canvas p-2"
            value={description} onChange={event => setDescription(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Filtrar permissões
          <input className="mt-1 w-full rounded-xl border border-control bg-canvas p-2" value={filter}
            onChange={event => setFilter(event.target.value)} placeholder="Recurso ou ação" />
        </label>
        <fieldset className="max-h-64 overflow-auto rounded-xl border border-line p-3 grid gap-2 sm:grid-cols-2 text-xs">
          <legend className="font-semibold">Permissões ({grants.length} selecionadas)</legend>
          {catalog.filter(code => code.includes(filter.toLowerCase())).map(code => <label key={code} className="flex items-center gap-2 break-all">
            <input type="checkbox" checked={grants.includes(code)} onChange={event => setGrants(current => event.target.checked
              ? [...current, code] : current.filter(value => value !== code))} />{code}
          </label>)}
        </fieldset>
        <label className="block text-sm font-semibold">Motivo
          <textarea required minLength={10} maxLength={500} className="mt-1 w-full rounded-xl border border-control bg-canvas p-2"
            value={reason} onChange={event => setReason(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">Confirme com sua senha
          <input type="password" required autoComplete="current-password" className="mt-1 w-full rounded-xl border border-control bg-canvas p-2"
            value={password} onChange={event => setPassword(event.target.value)} />
        </label>
        <div className="flex justify-end gap-2"><button className="ui-btn" type="button" onClick={() => { setEditing(null); setPassword(''); }}>Cancelar</button>
          <button className="ui-btn ui-btn-primary" type="submit" disabled={busy || reason.trim().length < 10}>{busy ? 'Salvando...' : 'Salvar papel'}</button></div>
      </form>
    </div>}
  </main>;
}
