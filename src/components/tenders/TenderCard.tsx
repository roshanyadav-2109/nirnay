import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, ArrowRight, Users, CheckCircle2, MoreVertical } from 'lucide-react';
import type { TenderSummary } from '../../hooks/useTender';
import { useTender } from '../../hooks/useTender';
import ConfirmDialog from '../common/ConfirmDialog';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { getActiveTenderId } from '../../lib/active-tender';

interface Props {
  tender: TenderSummary;
  onChange: () => void;
}

const STATUS_LABEL: Record<TenderSummary['status'], string> = {
  uploaded: 'Uploaded',
  processing: 'Processing',
  criteria_extracted: 'Criteria ready',
  evaluation_complete: 'Evaluated',
};

export default function TenderCard({ tender, onChange }: Props) {
  const navigate = useNavigate();
  const { setActiveTender, deleteTender } = useTender();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isActive = getActiveTenderId() === tender.id;

  const open = async () => {
    setBusy(true);
    const t = toast.loading('Loading tender…');
    try {
      await setActiveTender(tender.id);
      toast.dismiss(t);
      // Send to criteria if ready, else evaluation
      if (tender.criteria_count > 0) navigate('/criteria');
      else navigate('/');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setConfirmOpen(false);
    const t = toast.loading('Deleting tender + cascade…');
    try {
      await deleteTender(tender.id, tender.name);
      toast.success('Tender deleted', { id: t });
      onChange();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    }
  };

  return (
    <>
      <div
        className={`group nirnay-card p-5 transition-colors ${
          isActive ? 'border-ink shadow-card' : 'hover:border-navy-300'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <button onClick={open} disabled={busy} className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="nirnay-badge bg-cream-300 text-navy-500">
                <FileText size={10} />
                {STATUS_LABEL[tender.status]}
              </span>
              {isActive && (
                <span className="nirnay-badge bg-ink text-white">active</span>
              )}
            </div>
            <h3 className="font-display font-semibold text-ink mt-2.5 tracking-tight line-clamp-2 leading-snug">
              {tender.name}
            </h3>
            {tender.description && (
              <p className="text-xs text-navy-400 mt-1 line-clamp-2">
                {tender.description}
              </p>
            )}
            <p className="text-[11px] text-navy-400 mt-3 font-mono">
              {format(new Date(tender.created_at), 'd LLL yyyy · HH:mm')}
            </p>
          </button>

          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              onBlur={() => setTimeout(() => setMenuOpen(false), 100)}
              className="p-1.5 rounded text-navy-400 hover:text-ink hover:bg-cream-200"
              aria-label="More actions"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 w-40 bg-white border border-rule rounded-md shadow-card overflow-hidden">
                <button
                  onClick={open}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-cream-200"
                >
                  <ArrowRight size={13} /> Open
                </button>
                <div className="h-px bg-rule" />
                <button
                  onMouseDown={() => setConfirmOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-verdict-not-eligible hover:bg-verdict-not-eligible-bg"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-mono">
          <Stat icon={<CheckCircle2 size={11} />} label="criteria" value={tender.criteria_count} />
          <Stat icon={<Users size={11} />} label="bidders" value={tender.bidders_count} />
          <Stat label="verdicts" value={tender.evaluations_count} />
        </div>

        <button
          onClick={open}
          disabled={busy}
          className="mt-4 w-full inline-flex items-center justify-center gap-1 text-xs font-medium text-navy-500 hover:text-ink py-1.5 rounded border border-rule hover:border-navy-300 transition-colors"
        >
          Open <ArrowRight size={12} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this tender?"
        body={
          <>
            <strong className="text-ink">{tender.name}</strong> and all its{' '}
            {tender.criteria_count} criteria, {tender.bidders_count} bidders, and{' '}
            {tender.evaluations_count} evaluations will be permanently removed. The
            audit log keeps a record of the deletion.
          </>
        }
        confirmLabel="Delete tender"
        destructive
        onConfirm={onDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col items-start gap-0.5 px-2 py-1.5 bg-cream-200 rounded">
      <span className="flex items-center gap-1 text-navy-400 text-[10px] uppercase tracking-wider">
        {icon}
        {label}
      </span>
      <span className="text-ink font-semibold text-base">{value}</span>
    </div>
  );
}
