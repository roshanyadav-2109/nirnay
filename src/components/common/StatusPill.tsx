import { Check, X, AlertTriangle } from 'lucide-react';
import { verdictColor } from '../../lib/verdict-engine';
import type { VerdictStatus } from '../../types';

interface Props {
  status: VerdictStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export default function StatusPill({ status, size = 'md', showIcon = true }: Props) {
  const c = verdictColor(status);
  const sizeCls =
    size === 'sm'
      ? 'text-xs px-2 py-0.5'
      : size === 'lg'
      ? 'text-sm px-3 py-1.5'
      : 'text-xs px-2.5 py-1';
  const iconSize = size === 'lg' ? 16 : 12;
  const Icon =
    status === 'eligible' ? Check : status === 'not_eligible' ? X : AlertTriangle;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium ${c.bg} ${c.text} ${sizeCls}`}
    >
      {showIcon && <Icon size={iconSize} />}
      {c.label}
    </span>
  );
}
