import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import TenderUpload from '../components/upload/TenderUpload';
import BidderUpload from '../components/upload/BidderUpload';
import { useEvaluationStore } from '../store/evaluation-store';
import { useTender } from '../hooks/useTender';
import { useBidders } from '../hooks/useBidders';

export default function HomePage() {
  const navigate = useNavigate();
  const { tender, criteria, bidders } = useEvaluationStore();
  const { loadLatestTender } = useTender();
  const { loadBiddersForTender } = useBidders();

  useEffect(() => {
    if (!tender) {
      loadLatestTender().then((t) => {
        if (t) loadBiddersForTender(t.id);
      });
    } else {
      loadBiddersForTender(tender.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canEvaluate = tender && criteria.length > 0 && bidders.length > 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <section className="pt-6 pb-2">
        <p className="label-overline mb-3">PanIIT AI for Bharat · CRPF Procurement</p>
        <h1 className="font-display text-5xl md:text-6xl font-semibold text-ink tracking-tightest leading-[1.05] max-w-3xl">
          Every verdict,
          <br />
          <span className="font-serif italic font-normal">with evidence.</span>
        </h1>
        <p className="mt-5 text-base text-navy-500 max-w-2xl leading-relaxed">
          Nirnay reads government tenders and bidder submissions, citing every
          eligibility verdict with the exact source quote — never a black box. Officer
          override + hash-chained audit trail built in.
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link to="/criteria" className="nirnay-btn-primary">
            Review Criteria <ArrowRight size={14} />
          </Link>
          <Link to="/audit" className="nirnay-btn-ghost">
            <ShieldCheck size={14} /> Audit Trail
          </Link>
        </div>
      </section>

      <div className="h-px bg-rule" />

      <div className="grid md:grid-cols-2 gap-6">
        <TenderUpload />
        <BidderUpload />
      </div>

      <section className="nirnay-card p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="label-overline">Pipeline status</p>
            <p className="text-sm text-navy-500 mt-1.5">
              {tender ? (
                <>
                  Tender: <span className="font-mono text-ink">{tender.name}</span>
                  <span className="mx-2 text-navy-300">·</span>
                  {criteria.length} criteria
                  <span className="mx-2 text-navy-300">·</span>
                  {bidders.length} bidder{bidders.length === 1 ? '' : 's'}
                </>
              ) : (
                'No tender uploaded yet.'
              )}
            </p>
          </div>
          <button
            disabled={!canEvaluate}
            onClick={() => navigate('/evaluation')}
            className="nirnay-btn-primary"
          >
            Start Evaluation <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <section className="grid sm:grid-cols-3 gap-3">
        <Principle
          n="01"
          title="Citation on every verdict"
          body="Every verdict points at the exact source text, document name, and page. No floating numbers."
        />
        <Principle
          n="02"
          title="Never silently rejects"
          body="Missing evidence is needs review, never not eligible. Officers see exactly when we don't know."
        />
        <Principle
          n="03"
          title="Tamper-evident audit"
          body="SHA-256 hash chain across every action. One click verifies the entire trail end to end."
        />
      </section>
    </div>
  );
}

function Principle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border border-rule rounded-md p-5 bg-white">
      <p className="font-mono text-[11px] text-navy-300">{n}</p>
      <p className="font-display font-semibold text-ink mt-3 tracking-tight">{title}</p>
      <p className="text-sm text-navy-500 mt-2 leading-relaxed">{body}</p>
    </div>
  );
}
