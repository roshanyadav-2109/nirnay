import { FileText, X, Quote, Edit3 } from 'lucide-react';
import { useState } from 'react';
import StatusPill from '../common/StatusPill';
import ConfidenceMeter from '../common/ConfidenceMeter';
import type { Evaluation, VerdictStatus } from '../../types';
import { useBidders } from '../../hooks/useBidders';
import toast from 'react-hot-toast';

interface Props {
  evaluation: Evaluation;
  onClose: () => void;
}

const STATUS_OPTIONS: VerdictStatus[] = ['eligible', 'not_eligible', 'needs_review'];

export default function EvidencePanel({ evaluation, onClose }: Props) {
  const { overrideVerdict } = useBidders();
  const [overriding, setOverriding] = useState(false);
  const [newStatus, setNewStatus] = useState<VerdictStatus>(evaluation.status);
  const [reason, setReason] = useState('');

  const submit = async () => {
    if (!reason.trim()) return toast.error('Reason required for override');
    const t = toast.loading('Saving override…');
    try {
      await overrideVerdict(evaluation, newStatus, reason.trim(), 'officer');
      toast.success('Verdict overridden + audit logged', { id: t });
      setOverriding(false);
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    }
  };

  return (
    <div className="nirnay-card p-5 sticky top-4">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-navy-400">Evidence</p>
          <h3 className="font-display font-semibold text-navy-800">
            {evaluation.criterion?.criterion_code} — {evaluation.criterion?.description}
          </h3>
        </div>
        <button onClick={onClose} className="text-navy-400 hover:text-navy-700">
          <X size={18} />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4 p-3 rounded-lg bg-cream-200">
        <StatusPill status={evaluation.status} size="lg" />
        <ConfidenceMeter value={evaluation.confidence} />
      </div>

      {evaluation.evidence_text ? (
        <>
          <p className="label-overline mb-1.5">Source quote</p>
          <div className="evidence-highlight">
            <Quote size={12} className="inline -mt-0.5 mr-1 text-yellow-700" />
            "{evaluation.evidence_text}"
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-navy-500 font-mono">
            <FileText size={12} />
            {evaluation.evidence_doc || 'unknown document'}
            {evaluation.evidence_page ? ` · page ${evaluation.evidence_page}` : ''}
          </div>
        </>
      ) : (
        <div className="text-sm text-navy-400 italic p-3 bg-cream-200 rounded">
          No evidence text returned. This is why the verdict is{' '}
          <strong>needs review</strong>.
        </div>
      )}

      <div className="mt-4 p-3 rounded bg-cream-200">
        <p className="text-xs uppercase tracking-wide text-navy-400 mb-1">
          AI reasoning
        </p>
        <p className="text-sm text-navy-700 leading-relaxed">{evaluation.reasoning}</p>
      </div>

      {evaluation.found_value && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-cream-200 rounded">
            <div className="text-navy-400 uppercase tracking-wide">Found value</div>
            <div className="font-mono text-navy-700 mt-0.5">{evaluation.found_value}</div>
          </div>
          {evaluation.found_unit && (
            <div className="p-2 bg-cream-200 rounded">
              <div className="text-navy-400 uppercase tracking-wide">Unit</div>
              <div className="font-mono text-navy-700 mt-0.5">{evaluation.found_unit}</div>
            </div>
          )}
        </div>
      )}

      {evaluation.human_override && (
        <div className="mt-3 p-3 rounded-md bg-yellow-50 border border-yellow-200">
          <p className="label-overline text-yellow-700/80">Human override</p>
          <p className="text-sm text-ink mt-1.5">
            {evaluation.human_override_reason}
          </p>
          <p className="text-[11px] text-navy-400 mt-1.5 font-mono">
            by {evaluation.human_override_by} ·{' '}
            {evaluation.human_override_at &&
              new Date(evaluation.human_override_at).toLocaleString()}
          </p>
        </div>
      )}

      <div className="mt-5 border-t border-cream-400/60 pt-4">
        {overriding ? (
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-navy-400 font-semibold">
              New status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as VerdictStatus)}
              className="nirnay-input"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
            </select>
            <label className="text-xs uppercase tracking-wide text-navy-400 font-semibold">
              Reason (required)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="nirnay-input"
              placeholder="e.g. confirmed turnover via supplementary CA certificate"
            />
            <div className="flex gap-2">
              <button onClick={submit} className="nirnay-btn-primary flex-1">
                Save override
              </button>
              <button onClick={() => setOverriding(false)} className="nirnay-btn-ghost">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOverriding(true)} className="nirnay-btn-ghost w-full">
            <Edit3 size={13} /> Officer override
          </button>
        )}
      </div>
    </div>
  );
}
