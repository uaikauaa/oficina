'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/(authenticated)/layout';
import { apiFetch } from '@/lib/api';

type Metric = { value: string | number | null; unit: string | null; status: string; source: string; measuredAt: string };
type Snapshot = { databaseProvider: string; databaseName: string | null; connectionStatus: string;
  database: Record<string, Metric>; neon: Record<string, Metric>; googleCloud: Record<string, Metric>;
  collectedAt: string; cacheExpiresAt: string };

const labels: Record<string, string> = {
  tamanhoLogicoBytes: 'Tamanho lógico do banco', tabelas: 'Tabelas',
  'registrosEstimados.clientes': 'Clientes (estimativa)',
  'registrosEstimados.maquinas': 'Equipamentos (estimativa)',
  'registrosEstimados.ordens_servico': 'Ordens de serviço (estimativa)',
  'registrosEstimados.produtos': 'Produtos (estimativa)',
  'registrosEstimados.usuarios': 'Usuários (estimativa)',
  projeto: 'Projeto Neon', armazenamentoFaturadoBytes: 'Armazenamento faturado',
  limiteArmazenamentoBytes: 'Limite do plano', computacaoCuHoras: 'Computação',
  requisicoes5Min: 'Requisições nos últimos 5 minutos', cpu: 'CPU', memoria: 'Memória',
  instancias: 'Instâncias', custoEstimado: 'Custo estimado', orcamentoMensal: 'Orçamento mensal',
};

function valueOf(metric: Metric): string {
  if (metric.value == null) return metric.status;
  if (metric.unit === 'bytes' && typeof metric.value === 'number')
    return `${(metric.value / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MiB`;
  return `${metric.value.toLocaleString('pt-BR')}${metric.unit === 'texto' ? '' : ` ${metric.unit ?? ''}`}`;
}

function Metrics({ title, metrics }: { title: string; metrics: Record<string, Metric> }) {
  return <section className="space-y-3"><h2 className="text-lg font-semibold">{title}</h2>
    <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(metrics).map(([key, metric]) =>
      <div key={key} className="rounded-2xl border border-line bg-surface p-4">
        <dt className="text-xs text-subtle">{labels[key] ?? key}</dt>
        <dd className="mt-2 text-sm font-semibold break-words">{valueOf(metric)}</dd>
        <p className="mt-2 text-xs text-subtle">Fonte: {metric.source} · {metric.status === 'medido' ? 'medido' : metric.status === 'estimado' ? 'estimado' : 'indisponível'}</p>
      </div>)}</dl></section>;
}

export default function InfrastructurePage() {
  const { user } = useAuth();
  const authorized = user?.roles.includes('ROLE_SUPER_ADMIN') === true ||
    user?.permissoes?.includes('infraestrutura.visualizar') === true;
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!authorized) return;
    let active = true;
    apiFetch('/api/admin/infraestrutura').then(async response => {
      if (!response.ok) throw new Error('Não foi possível carregar as métricas.');
      const snapshot: Snapshot = await response.json();
      if (active) setData(snapshot);
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Falha de coleta.'); });
    return () => { active = false; };
  }, [authorized]);

  if (!authorized) return <main className="mx-auto max-w-6xl p-6"><h1 className="text-xl font-bold">Acesso restrito</h1></main>;
  return <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 space-y-7">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-accent">Administração</p>
      <h1 className="text-2xl font-bold">Infraestrutura</h1>
      <p className="text-sm text-subtle">Medições com fonte e estado explícitos. Custos e limites dependem dos provedores.</p></header>
    <nav className="flex flex-wrap gap-2 text-sm" aria-label="Seções administrativas">
      <Link href="/administracao/usuarios" className="ui-btn">Usuários</Link>
      <Link href="/administracao/papeis" className="ui-btn">Papéis</Link>
      <Link href="/administracao/auditoria" className="ui-btn">Auditoria</Link>
    </nav>
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    {!data && !error && <p className="text-sm text-subtle">Carregando métricas...</p>}
    {data && <>
      <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
        <strong>Banco conectado: {data.databaseName ?? 'indisponível'}</strong>
        <p className="text-subtle">Origem configurada: {data.databaseProvider === 'neon' ? 'Neon' : 'local'} · Conexão: {data.connectionStatus}</p>
        <p className="text-subtle">Coletado em {new Date(data.collectedAt).toLocaleString('pt-BR')} · Cache até {new Date(data.cacheExpiresAt).toLocaleTimeString('pt-BR')}</p>
      </div>
      <Metrics title="PostgreSQL conectado" metrics={data.database} />
      <p className="text-xs text-subtle">O tamanho SQL e as estimativas de registros não representam o armazenamento faturado pelo Neon.</p>
      <Metrics title="Neon" metrics={data.neon} />
      <Metrics title="Google Cloud" metrics={data.googleCloud} />
      <p className="text-xs text-subtle">Alertas de orçamento, quando configurados no provedor, não limitam automaticamente cobranças.</p>
    </>}
  </main>;
}
