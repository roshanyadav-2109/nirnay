import { Building2, FileText } from 'lucide-react';
import StatusPill from '../common/StatusPill';
import type { Bidder, Evaluation } from '../../types';
import { computeOverallVerdict } from '../../lib/verdict-engine';

interface Props {
  bidder: Bidder;
  evaluations: Evaluation[];
  selected?: boolean;
  onSelect: () => void;
}

export default function BidderCard({ bidder, evaluations, selected, onSelect }: Props) {
  const overall = computeOverallVerdict(evaluations);
  const status = bidder.overall_verdict || overall.status;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-md p-4 transition-all border ${
        selected
          ? 'bg-ink text-white border-ink'
          : 'bg-white border-rule hover:border-navy-300'
      }`}
    >
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
            <div className="font-display font-semibold text-sm tracking-tight truncate">
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
  );
}
