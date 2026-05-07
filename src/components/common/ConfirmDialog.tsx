import { AlertTriangle, X } from 'lucide-react';
import { useEffect } from 'react';

interface Props {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md bg-white rounded-md border border-rule shadow-card">
        <div className="flex items-start gap-3 p-5">
          <div
            className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${
              destructive
                ? 'bg-verdict-not-eligible-bg text-verdict-not-eligible'
                : 'bg-cream-300 text-ink'
            }`}
          >
            <AlertTriangle size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-ink tracking-tight">
              {title}
            </h3>
            <div className="text-sm text-navy-500 mt-1.5 leading-relaxed">{body}</div>
          </div>
          <button
            onClick={onCancel}
            className="text-navy-400 hover:text-ink"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-rule bg-cream-200 rounded-b-md">
          <button onClick={onCancel} className="nirnay-btn-ghost text-sm">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`nirnay-btn text-sm text-white ${
              destructive
                ? 'bg-verdict-not-eligible hover:bg-red-700'
                : 'bg-ink hover:bg-navy-700'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
