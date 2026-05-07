import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-navy-500">
      <Loader2 className="animate-spin" size={16} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
