import { Award, Trophy, Crown } from 'lucide-react';
import StatusPill from '../common/StatusPill';
import type { BidderRanking } from '../../lib/verdict-engine';

interface Props {
  rankings: BidderRanking[];
}

export default function RankingPanel({ rankings }: Props) {
  if (rankings.length === 0) return null;

  const winner = rankings.find((r) => r.rank === 1);
  const eligibleCount = rankings.filter((r) => r.overall.status === 'eligible').length;

  return (
    <div className="nirnay-card overflow-hidden">
      <div className="px-5 py-4 border-b border-rule bg-cream-200">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="label-overline flex items-center gap-1.5">
              <Award size={11} /> Ranking
            </p>
            <h3 className="font-display text-lg font-semibold text-ink mt-1 tracking-tight">
              {winner
                ? `Recommended: ${winner.bidder.name}`
                : eligibleCount === 0
                ? 'No eligible bidder yet'
                : 'Ranking'}
            </h3>
          </div>
          {winner && (
            <div className="text-right">
              <div className="font-mono text-xs text-navy-400">composite score</div>
              <div className="font-display text-2xl font-semibold text-ink">
                {(winner.score * 100).toFixed(1)}
                <span className="text-navy-400 text-sm">/100</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-rule">
        {rankings.map((r) => (
          <RankingRow key={r.bidder.id} ranking={r} />
        ))}
      </div>

      <div className="px-5 py-2.5 border-t border-rule bg-cream-200 text-[11px] font-mono text-navy-400">
        Score = (avg mandatory confidence × 0.7) + (preferred passed ratio × 0.3). Eligible bidders only.
      </div>
    </div>
  );
}

function RankingRow({ ranking }: { ranking: BidderRanking }) {
  const isEligible = ranking.overall.status === 'eligible';
  const isWinner = ranking.rank === 1;

  return (
    <div
      className={`px-5 py-4 flex items-start gap-4 ${
        isWinner ? 'bg-yellow-50/60' : ''
      }`}
    >
      <div className="shrink-0 w-12 flex flex-col items-center">
        {isWinner ? (
          <div className="w-10 h-10 rounded-full bg-ink text-white flex items-center justify-center">
            <Crown size={16} strokeWidth={2} />
          </div>
        ) : ranking.rank ? (
          <div className="w-10 h-10 rounded-full bg-cream-300 text-ink flex items-center justify-center">
            <span className="font-display font-semibold">#{ranking.rank}</span>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full bg-cream-300 text-navy-400 flex items-center justify-center">
            <Trophy size={14} className="opacity-30" />
          </div>
        )}
        {isEligible && (
          <div className="font-mono text-[10px] text-navy-400 mt-1.5">
            {(ranking.score * 100).toFixed(1)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-display font-semibold text-ink tracking-tight">
            {ranking.bidder.name}
          </h4>
          <StatusPill status={ranking.overall.status} size="sm" />
        </div>
        <p className="text-sm text-navy-600 mt-1.5 leading-relaxed">{ranking.reasoning}</p>
        {ranking.highlights.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {ranking.highlights.map((h, i) => (
              <li key={i} className="text-xs text-navy-500 leading-relaxed flex gap-2">
                <span className="text-navy-300 mt-0.5">•</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isEligible && (
        <div className="shrink-0 hidden sm:block">
          <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
            <Stat label="✓" value={ranking.overall.passedCount} color="text-verdict-eligible" />
            <Stat label="✗" value={ranking.overall.failedCount} color="text-verdict-not-eligible" />
            <Stat label="?" value={ranking.overall.reviewCount} color="text-verdict-review" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="px-2 py-1 bg-cream-200 rounded text-center">
      <span className={color}>{label}</span> <span className="text-ink">{value}</span>
    </div>
  );
}
