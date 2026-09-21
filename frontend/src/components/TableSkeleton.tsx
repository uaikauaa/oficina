import React from 'react';

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  className?: string;
}

export default function TableSkeleton({
  columns,
  rows = 5,
  className = '',
}: TableSkeletonProps) {
  return (
    <tbody className={`divide-y divide-slate-800/60 bg-slate-950/40 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx}>
          {Array.from({ length: columns }).map((_, cIdx) => (
            <td key={cIdx} className="py-3 px-3.5">
              <div className="h-4 bg-slate-800/70 rounded-md w-full" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
