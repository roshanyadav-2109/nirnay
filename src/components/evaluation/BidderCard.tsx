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
      className={`w-full text-left rounded-lg p-4 transition-all border ${
        selected
          ? 'bg-navy-800 text-cream-200 border-navy-800 shadow-card'
          : 'bg-white border-cream-400/60 hover:border-gold-400 shadow-soft'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              selected ? 'bg-gold-400 text-navy-800' : 'bg-cream-300 text-navy-500'
            }`}
          >
            <Building2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-display font-semibold truncate">{bidder.name}</div>
            <div
              className={`text-xs flex items-center gap-1 mt-0.5 ${
                selected ? 'text-cream-200/60' : 'text-navy-400'
              }`}
            >
              <FileText size={11} />
              {bidder.documents.length} document{bidder.documents.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
        {evaluations.length > 0 ? (
          <StatusPill status={status} size="sm" />
        ) : (
          <span
            className={`nirnay-badge ${
              selected ? 'bg-cream-200/20 text-cream-200' : 'bg-cream-300 text-navy-400'
            }`}
          >
            pending
          </span>
        )}
      </div>

      {evaluations.length > 0 && (
        <div className="flex items-center gap-3 mt-3 text-[11px] font-mono">
          <span
            className={
              selected ? 'text-verdict-eligible-bg' : 'text-verdict-eligible'
            }
          >
            ✓ {overall.passedCount}
          </span>
          <span
            className={
              selected ? 'text-verdict-not-eligible-bg' : 'text-verdict-not-eligible'
            }
          >
            ✗ {overall.failedCount}
          </span>
          <span
            className={selected ? 'text-verdict-review-bg' : 'text-verdict-review'}
          >
            ? {overall.reviewCount}
          </span>
        </div>
      )}
    </button>
  );
}
