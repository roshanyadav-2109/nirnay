import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Quote,
} from 'lucide-react';
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
    <div className="space-y-6 max-w-6xl mx-auto">
      <section className="nirnay-card p-8 bg-gradient-to-br from-navy-800 to-navy-700 text-cream-200 border-0">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold-400/20 text-gold-200 text-xs font-medium mb-3">
              <Sparkles size={14} /> Powered by Gemini 2.5 + Supabase
            </div>
            <h1 className="font-display text-4xl font-semibold leading-tight">
              Every verdict, with evidence.
            </h1>
            <p className="font-mono text-sm text-gold-200 mt-1">निर्णय</p>
            <p className="mt-4 text-cream-200/80 max-w-xl">
              Nirnay evaluates government tender bids against extracted eligibility
              criteria, citing every verdict with the exact source text — not a black
              box. Hash-chained audit trail, officer override built in.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Link to="/criteria" className="nirnay-btn-gold">
                Review Criteria <ArrowRight size={16} />
              </Link>
              <Link to="/audit" className="nirnay-btn-ghost text-cream-200 border-cream-200/30">
                <ShieldCheck size={16} /> Audit Trail
              </Link>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="bg-navy-700/60 rounded-lg p-4 border border-navy-600 max-w-xs">
              <Quote size={20} className="text-gold-400 mb-2" />
              <p className="text-sm text-cream-200/80 leading-relaxed">
                "No silent rejections. If we can't find evidence, the verdict is
                <span className="text-gold-200 font-medium"> needs review</span> — never
                <span className="text-verdict-not-eligible"> not eligible</span>."
              </p>
              <p className="text-[11px] text-cream-300/50 mt-2 font-mono">
                — Nirnay design principle #1
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <TenderUpload />
        <BidderUpload />
      </div>

      <section className="nirnay-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-lg text-navy-800">
              Pipeline status
            </h3>
            <p className="text-sm text-navy-400 mt-1">
              {tender ? (
                <>
                  Tender: <span className="font-mono text-navy-700">{tender.name}</span> ·
                  {' '}{criteria.length} criteria · {bidders.length} bidder{bidders.length === 1 ? '' : 's'}
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
            Start Evaluation <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
