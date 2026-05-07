import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Eye, BarChart3, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEvaluationStore } from '../store/evaluation-store';
import { useTender } from '../hooks/useTender';
import { useBidders } from '../hooks/useBidders';
import BidderCard from '../components/evaluation/BidderCard';
import EvidencePanel from '../components/evaluation/EvidencePanel';
import AddBidderModal from '../components/evaluation/AddBidderModal';
import StatusPill from '../components/common/StatusPill';
import ConfidenceMeter from '../components/common/ConfidenceMeter';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { hasGeminiApiKey } from '../config/gemini';
import type { Evaluation } from '../types';

export default function EvaluationPage() {
  const navigate = useNavigate();
  const { tender, criteria, bidders, evaluations, isProcessing } = useEvaluationStore();
  const { loadActiveTender } = useTender();
  const { evaluateAll, loadBiddersForTender } = useBidders();
  const [selectedBidderId, setSelectedBidderId] = useState<string | null>(null);
  const [selectedEval, setSelectedEval] = useState<Evaluation | null>(null);
  const [addBidderOpen, setAddBidderOpen] = useState(false);

  const refreshBidders = async () => {
    if (tender) await loadBiddersForTender(tender.id);
  };

  useEffect(() => {
    (async () => {
      let t = tender;
      if (!t) t = await loadActiveTender();
      if (t) await loadBiddersForTender(t.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedBidderId && bidders.length) setSelectedBidderId(bidders[0].id);
  }, [bidders, selectedBidderId]);

  const evalsByBidder = useMemo(() => {
    const map: Record<string, Evaluation[]> = {};
    for (const ev of evaluations) {
      (map[ev.bidder_id] = map[ev.bidder_id] || []).push(ev);
    }
    return map;
  }, [evaluations]);

  const selectedBidder = bidders.find((b) => b.id === selectedBidderId) || null;
  const selectedEvals = selectedBidder ? evalsByBidder[selectedBidder.id] || [] : [];

  const totalEvals = evaluations.length;
  const expectedEvals = bidders.length * criteria.length;
  const allEvaluated = totalEvals >= expectedEvals && expectedEvals > 0;

  const startEvaluation = async () => {
    if (!hasGeminiApiKey()) {
      toast.error('Set your Gemini API key in Settings first');
      navigate('/settings');
      return;
    }
    if (!bidders.length) return toast.error('Add bidders first');
    if (!criteria.length) return toast.error('Extract criteria first');
    const t = toast.loading(`Evaluating ${bidders.length} bidder(s)…`);
    try {
      await evaluateAll(bidders, criteria);
      toast.success('All evaluations complete', { id: t });
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    }
  };

  if (!tender) {
    return (
      <div className="max-w-3xl mx-auto nirnay-card p-8 text-center">
        <p className="text-navy-500">
          Select or create a tender first.{' '}
          <button onClick={() => navigate('/')} className="text-ink underline">
            Go to Tenders
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="nirnay-section-title">Evaluation Dashboard</h2>
          <p className="text-sm text-navy-500 mt-1">
            {bidders.length} bidder(s) × {criteria.length} criteria ={' '}
            <span className="font-mono">{expectedEvals}</span> verdicts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAddBidderOpen(true)}
            className="nirnay-btn-ghost"
          >
            <UserPlus size={13} /> Add bidder
          </button>
          <button
            onClick={() => navigate('/report')}
            disabled={!allEvaluated}
            className="nirnay-btn-ghost"
          >
            <BarChart3 size={13} /> Report
          </button>
          <button
            onClick={startEvaluation}
            disabled={isProcessing || !bidders.length}
            className="nirnay-btn-primary"
          >
            {isProcessing ? <LoadingSpinner /> : <><Play size={14} /> Run Evaluation</>}
          </button>
        </div>
      </div>

      <AddBidderModal
        open={addBidderOpen}
        tenderId={tender.id}
        onClose={() => setAddBidderOpen(false)}
        onAdded={refreshBidders}
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-3 space-y-2">
          <div className="text-xs uppercase tracking-wide text-navy-400 font-semibold mb-1">
            Bidders
          </div>
          {bidders.map((b) => (
            <BidderCard
              key={b.id}
              bidder={b}
              evaluations={evalsByBidder[b.id] || []}
              selected={b.id === selectedBidderId}
              onSelect={() => {
                setSelectedBidderId(b.id);
                setSelectedEval(null);
              }}
              onDeleted={() => {
                if (selectedBidderId === b.id) setSelectedBidderId(null);
                if (selectedEval?.bidder_id === b.id) setSelectedEval(null);
                refreshBidders();
              }}
            />
          ))}
          <button
            onClick={() => setAddBidderOpen(true)}
            className="w-full border border-dashed border-rule rounded-md py-3 text-xs text-navy-500 hover:text-ink hover:border-navy-300 transition-colors"
          >
            <UserPlus size={12} className="inline mr-1.5" />
            Add bidder
          </button>
          {bidders.length === 0 && (
            <div className="nirnay-card p-4 text-sm text-navy-400">
              No bidders yet — click <strong>Add bidder</strong> above.
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-6 space-y-2">
          {selectedBidder ? (
            <>
              <div className="text-xs uppercase tracking-wide text-navy-400 font-semibold mb-1">
                {selectedBidder.name} — verdicts
              </div>
              {selectedEvals.length === 0 ? (
                <div className="nirnay-card p-6 text-sm text-navy-400">
                  Not evaluated yet. Click <strong>Run Evaluation</strong> above.
                </div>
              ) : (
                selectedEvals
                  .slice()
                  .sort((a, b) =>
                    (a.criterion?.criterion_code || '').localeCompare(
                      b.criterion?.criterion_code || '',
                    ),
                  )
                  .map((ev) => (
                    <EvalRow
                      key={ev.id}
                      evaluation={ev}
                      isSelected={selectedEval?.id === ev.id}
                      onClick={() => setSelectedEval(ev)}
                    />
                  ))
              )}
            </>
          ) : (
            <div className="nirnay-card p-6 text-sm text-navy-400">
              Select a bidder.
            </div>
          )}
        </div>

        <div className="col-span-12 lg:col-span-3">
          {selectedEval ? (
            <EvidencePanel
              evaluation={selectedEval}
              onClose={() => setSelectedEval(null)}
            />
          ) : (
            <div className="nirnay-card p-5 text-center text-sm text-navy-400 sticky top-4">
              <Eye className="mx-auto text-navy-300 mb-2" size={28} />
              Click any verdict on the left to see its evidence and source citation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EvalRow({
  evaluation,
  isSelected,
  onClick,
}: {
  evaluation: Evaluation;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-md border transition-colors ${
        isSelected
          ? 'border-ink bg-cream-200'
          : 'border-rule bg-white hover:border-navy-300'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-navy-500">
              {evaluation.criterion?.criterion_code}
            </span>
            {evaluation.criterion?.is_mandatory ? (
              <span className="nirnay-badge bg-verdict-not-eligible-bg text-verdict-not-eligible">
                mandatory
              </span>
            ) : (
              <span className="nirnay-badge bg-cream-300 text-navy-400">preferred</span>
            )}
            {evaluation.human_override && (
              <span className="nirnay-badge bg-gold-100 text-gold-500">
                overridden
              </span>
            )}
          </div>
          <p className="text-sm text-navy-700 mt-1.5 line-clamp-2">
            {evaluation.criterion?.description}
          </p>
          {evaluation.found_value && (
            <p className="text-xs font-mono text-navy-500 mt-1 truncate">
              found: {evaluation.found_value}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <StatusPill status={evaluation.status} size="sm" />
          <ConfidenceMeter value={evaluation.confidence} showLabel={false} />
        </div>
      </div>
    </button>
  );
}
