import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import { useEvaluationStore } from '../store/evaluation-store';
import { useTender } from '../hooks/useTender';
import CriterionCard from '../components/criteria/CriterionCard';
import toast from 'react-hot-toast';

export default function CriteriaPage() {
  const navigate = useNavigate();
  const { tender, criteria } = useEvaluationStore();
  const { loadLatestTender, verifyAllCriteria, updateCriterion } = useTender();

  useEffect(() => {
    if (!tender) loadLatestTender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const mandatory = criteria.filter((c) => c.is_mandatory).length;
    const optional = criteria.length - mandatory;
    return { mandatory, optional, total: criteria.length };
  }, [criteria]);

  if (!tender) {
    return (
      <div className="max-w-3xl mx-auto nirnay-card p-8 text-center">
        <p className="text-navy-500">
          No tender uploaded yet. Head back to{' '}
          <button onClick={() => navigate('/')} className="text-gold-500 underline">
            Home
          </button>{' '}
          to upload one.
        </p>
      </div>
    );
  }

  const onVerify = async () => {
    const t = toast.loading('Marking criteria as verified…');
    try {
      await verifyAllCriteria(tender.id);
      toast.success('Criteria verified — ready for evaluation', { id: t });
      navigate('/evaluation');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="nirnay-section-title">Eligibility Criteria</h2>
          <p className="text-sm text-navy-500 mt-1">
            Extracted from <span className="font-mono">{tender.name}</span>. Review and edit before evaluation.
          </p>
        </div>
        <button onClick={onVerify} className="nirnay-btn-gold">
          <ShieldCheck size={16} /> Confirm Criteria <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total" value={stats.total} />
        <Stat label="Mandatory" value={stats.mandatory} accent="text-verdict-not-eligible" />
        <Stat label="Preferred" value={stats.optional} accent="text-navy-500" />
      </div>

      <div className="space-y-3">
        {criteria.map((c) => (
          <CriterionCard
            key={c.id}
            criterion={c}
            onSave={async (next) => {
              await updateCriterion(next);
              const store = useEvaluationStore.getState();
              store.upsertCriterion({ ...next, human_edited: true });
              toast.success(`Saved ${next.criterion_code}`);
            }}
          />
        ))}
        {criteria.length === 0 && (
          <div className="nirnay-card p-8 text-center text-navy-400">
            No criteria extracted yet.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = 'text-navy-700',
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="nirnay-card p-4">
      <div className="text-xs uppercase tracking-wide text-navy-400 font-semibold">
        {label}
      </div>
      <div className={`text-3xl font-display font-semibold mt-1 ${accent}`}>
        {value}
      </div>
    </div>
  );
}
