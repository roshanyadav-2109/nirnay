import { Building2, FileText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import StatusPill from '../common/StatusPill';
import ConfirmDialog from '../common/ConfirmDialog';
import type { Bidder, Evaluation } from '../../types';
import { computeOverallVerdict } from '../../lib/verdict-engine';
import { useBidders } from '../../hooks/useBidders';
import toast from 'react-hot-toast';

interface Props {
  bidder: Bidder;
  evaluations: Evaluation[];
  selected?: boolean;
  onSelect: () => void;
  onDeleted?: () => void;
}

export default function BidderCard({
  bidder,
  evaluations,
  selected,
  onSelect,
  onDeleted,
}: Props) {
  const overall = computeOverallVerdict(evaluations);
  const status = bidder.overall_verdict || overall.status;
  const { deleteBidder } = useBidders();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    setConfirmOpen(false);
    const t = toast.loading('Deleting bidder…');
    try {
      await deleteBidder(bidder);
      toast.success('Bidder deleted', { id: t });
      onDeleted?.();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    }
  };

  return (
    <>
      <div
        className={`group relative w-full text-left rounded-md p-4 transition-all border ${
          selected
            ? 'bg-ink text-white border-ink'
            : 'bg-white border-rule hover:border-navy-300'
        }`}
      >
        <button onClick={onSelect} className="block w-full text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                  selected ? 'bg-white/10 text-white' : 'bg-cream-300 text-navy-500'
                }`}
              >
                <Building2 size={14} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display font-semibold text-sm tracking-tight truncate pr-6">
                  {bidder.name}
                </div>
                <div
                  className={`text-[11px] flex items-center gap-1 mt-0.5 ${
                    selected ? 'text-white/50' : 'text-navy-400'
                  }`}
                >
                  <FileText size={10} />
                  {bidder.documents.length} document{bidder.documents.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            {evaluations.length > 0 ? (
              <StatusPill status={status} size="sm" />
            ) : (
              <span
                className={`nirnay-badge ${
                  selected ? 'bg-white/10 text-white/70' : 'bg-cream-300 text-navy-400'
                }`}
              >
                pending
              </span>
            )}
          </div>

          {evaluations.length > 0 && (
            <div className="flex items-center gap-3 mt-3 text-[11px] font-mono">
              <span className={selected ? 'text-white/70' : 'text-verdict-eligible'}>
                ✓ {overall.passedCount}
              </span>
              <span className={selected ? 'text-white/70' : 'text-verdict-not-eligible'}>
                ✗ {overall.failedCount}
              </span>
              <span className={selected ? 'text-white/70' : 'text-verdict-review'}>
                ? {overall.reviewCount}
              </span>
            </div>
          )}
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmOpen(true);
          }}
          className={`absolute top-2.5 right-2.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
            selected
              ? 'text-white/60 hover:text-white hover:bg-white/10'
              : 'text-navy-400 hover:text-verdict-not-eligible hover:bg-verdict-not-eligible-bg'
          }`}
          aria-label="Delete bidder"
          title="Delete bidder"
        >
          <Trash2 size={12} />
        </button>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this bidder?"
        body={
          <>
            <strong className="text-ink">{bidder.name}</strong> and its{' '}
            {evaluations.length} verdict{evaluations.length === 1 ? '' : 's'} will be
            removed. The audit log keeps a record of the deletion.
          </>
        }
        destructive
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
