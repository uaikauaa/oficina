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
    <div className={`ui-panel p-8 text-center ${className}`}>
      {Icon && <Icon aria-hidden="true" className="w-6 h-6 text-muted mx-auto mb-3" />}
      <p className="text-sm text-ink font-semibold">{title}</p>
      {description && (
        <div className="text-sm text-muted mt-2 max-w-md mx-auto">
          {description}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
