import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string | React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`p-8 rounded-xl bg-slate-950 border border-dashed border-slate-800 text-center ${className}`}>
      {Icon && <Icon className="w-8 h-8 text-slate-600 mx-auto mb-2" />}
      <p className="text-xs text-slate-300 font-semibold">{title}</p>
      {description && (
        <div className="text-[11px] text-slate-500 mt-1 max-w-md mx-auto">
          {description}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
