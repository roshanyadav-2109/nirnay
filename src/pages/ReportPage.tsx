import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, Check, X, AlertTriangle } from 'lucide-react';
import { useEvaluationStore } from '../store/evaluation-store';
import { useTender } from '../hooks/useTender';
import { useBidders } from '../hooks/useBidders';
import { logAuditEvent } from '../lib/audit-logger';
import StatusPill from '../components/common/StatusPill';
import { computeOverallVerdict } from '../lib/verdict-engine';
import type { Evaluation } from '../types';

export default function ReportPage() {
  const navigate = useNavigate();
  const { tender, criteria, bidders, evaluations } = useEvaluationStore();
  const { loadLatestTender } = useTender();
  const { loadBiddersForTender } = useBidders();

  useEffect(() => {
    (async () => {
      let t = tender;
      if (!t) t = await loadLatestTender();
      if (t) await loadBiddersForTender(t.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const evalsByBidder = useMemo(() => {
    const map: Record<string, Evaluation[]> = {};
    for (const ev of evaluations) {
      (map[ev.bidder_id] = map[ev.bidder_id] || []).push(ev);
    }
    return map;
  }, [evaluations]);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, Evaluation>> = {};
    for (const ev of evaluations) {
      m[ev.bidder_id] = m[ev.bidder_id] || {};
      m[ev.bidder_id][ev.criterion_id] = ev;
    }
    return m;
  }, [evaluations]);

  const summary = useMemo(() => {
    let eligible = 0;
    let notEligible = 0;
    let needsReview = 0;
    for (const b of bidders) {
      const overall = computeOverallVerdict(evalsByBidder[b.id] || []);
      const final = b.overall_verdict || overall.status;
      if (final === 'eligible') eligible++;
      else if (final === 'not_eligible') notEligible++;
      else needsReview++;
    }
    return { eligible, notEligible, needsReview };
  }, [bidders, evalsByBidder]);

  const handlePrint = async () => {
    if (tender) {
      await logAuditEvent({
        event_type: 'report_generated',
        entity_type: 'tender',
        entity_id: tender.id,
        actor: 'officer',
        payload: { ...summary, format: 'print' },
      });
    }
    window.print();
  };

  if (!tender) {
    return (
      <div className="max-w-3xl mx-auto nirnay-card p-8 text-center">
        <p className="text-navy-500">
          No tender.{' '}
          <button onClick={() => navigate('/')} className="text-gold-500 underline">
            Go to Home
          </button>
        </p>
      </div>
    );
  }

  const sortedCriteria = criteria
    .slice()
    .sort((a, b) => a.criterion_code.localeCompare(b.criterion_code));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        <div>
          <h2 className="nirnay-section-title">Consolidated Report</h2>
          <p className="text-sm text-navy-500 mt-1">
            {tender.name} · {bidders.length} bidder(s) × {criteria.length} criteria
          </p>
        </div>
        <button onClick={handlePrint} className="nirnay-btn-gold">
          <Printer size={16} /> Export / Print
        </button>
      </div>

      <div className="nirnay-card p-6 print:shadow-none print:border-0">
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-semibold text-navy-800">
            Tender Evaluation Report
          </h1>
          <p className="text-sm text-navy-500 font-mono mt-1">
            {tender.name} · generated {new Date().toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryCard label="Eligible" value={summary.eligible} accent="text-verdict-eligible" />
          <SummaryCard
            label="Not Eligible"
            value={summary.notEligible}
            accent="text-verdict-not-eligible"
          />
          <SummaryCard
            label="Needs Review"
            value={summary.needsReview}
            accent="text-verdict-review"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-navy-800 text-cream-200">
                <th className="text-left px-3 py-2 font-display font-semibold sticky left-0 bg-navy-800">
                  Bidder
                </th>
                {sortedCriteria.map((c) => (
                  <th
                    key={c.id}
                    className="px-2 py-2 font-mono text-xs whitespace-nowrap text-center"
                    title={c.description}
                  >
                    {c.criterion_code}
                  </th>
                ))}
                <th className="px-3 py-2 font-display font-semibold text-right">Overall</th>
              </tr>
            </thead>
            <tbody>
              {bidders.map((b, i) => (
                <tr
                  key={b.id}
                  className={i % 2 ? 'bg-cream-200/40' : 'bg-white'}
                >
                  <td className="px-3 py-2 font-medium text-navy-800 sticky left-0 bg-inherit border-b border-cream-400/40">
                    {b.name}
                  </td>
                  {sortedCriteria.map((c) => {
                    const ev = matrix[b.id]?.[c.id];
                    return (
                      <td key={c.id} className="px-2 py-2 text-center border-b border-cream-400/40">
                        {ev ? <Cell evaluation={ev} /> : <span className="text-navy-300">—</span>}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right border-b border-cream-400/40">
                    <StatusPill
                      status={
                        b.overall_verdict ||
                        computeOverallVerdict(evalsByBidder[b.id] || []).status
                      }
                      size="sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-xs text-navy-500 leading-relaxed">
          <p className="font-semibold mb-1">Legend</p>
          <div className="flex flex-wrap gap-4">
            <span className="inline-flex items-center gap-1">
              <Check size={14} className="text-verdict-eligible" /> Eligible — clear evidence found
            </span>
            <span className="inline-flex items-center gap-1">
              <X size={14} className="text-verdict-not-eligible" /> Not Eligible — evidence contradicts requirement
            </span>
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={14} className="text-verdict-review" /> Needs Review — evidence missing or ambiguous
            </span>
          </div>
        </div>

        <div className="mt-6 print:block">
          <h3 className="font-display font-semibold mb-2">Criteria definitions</h3>
          <ol className="text-xs space-y-1 text-navy-600">
            {sortedCriteria.map((c) => (
              <li key={c.id}>
                <span className="font-mono font-semibold">{c.criterion_code}</span>:{' '}
                {c.description}{' '}
                {c.is_mandatory ? (
                  <em className="text-verdict-not-eligible">(mandatory)</em>
                ) : (
                  <em className="text-navy-400">(preferred)</em>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function Cell({ evaluation }: { evaluation: Evaluation }) {
  if (evaluation.status === 'eligible') {
    return (
      <div title={evaluation.reasoning} className="inline-flex">
        <Check className="text-verdict-eligible" size={16} />
      </div>
    );
  }
  if (evaluation.status === 'not_eligible') {
    return (
      <div title={evaluation.reasoning} className="inline-flex">
        <X className="text-verdict-not-eligible" size={16} />
      </div>
    );
  }
  return (
    <div title={evaluation.reasoning} className="inline-flex">
      <AlertTriangle className="text-verdict-review" size={14} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="border border-cream-400/60 rounded-lg p-3 text-center">
      <div className="text-xs uppercase tracking-wide text-navy-400 font-semibold">
        {label}
      </div>
      <div className={`text-3xl font-display font-semibold mt-1 ${accent}`}>{value}</div>
    </div>
  );
}
