import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export default function MetricCard({ label, value, description, href, icon: Icon, attention = false }: {
  label: string; value: ReactNode; description: string; href: string; icon: LucideIcon; attention?: boolean;
}) {
  return (
    <Link href={href} className="ui-metric group">
      <div className="flex items-center justify-between gap-3 text-sm text-muted">
        <span>{label}</span><Icon aria-hidden="true" className={`w-5 h-5 ${attention ? 'text-accent' : 'text-muted'}`} />
      </div>
      <div className="ui-metric-value text-ink">{value}</div>
      <div className="flex items-end justify-between gap-3 text-xs text-muted">
        <span>{description}</span><ArrowUpRight aria-hidden="true" className="w-4 h-4 group-hover:text-accent" />
      </div>
    </Link>
  );
}
