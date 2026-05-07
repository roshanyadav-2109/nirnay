import { useEvaluationStore } from '../../store/evaluation-store';
import { hasGeminiApiKey } from '../../config/gemini';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

const STAGE_DOTS: Record<'idle' | 'active' | 'done' | 'error', string> = {
  idle: 'bg-navy-200',
  active: 'bg-gold-400 animate-pulse',
  done: 'bg-verdict-eligible',
  error: 'bg-verdict-not-eligible',
};

export default function Header() {
  const { tender, pipeline, isProcessing } = useEvaluationStore();
  const keyOk = hasGeminiApiKey();

  return (
    <header className="bg-cream-100 border-b border-cream-400/60 px-8 py-4">
      <div className="flex items-center justify-between gap-6">
        <div>
          <h1 className="font-display text-xl font-semibold text-navy-800">
            {tender ? tender.name : 'Tender Evaluation'}
          </h1>
          <p className="text-sm text-navy-400 mt-0.5">
            Every verdict, with evidence.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {pipeline.map((stage, idx) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${STAGE_DOTS[stage.status]}`}
                  />
                  <span className="text-[10px] text-navy-400 mt-1 font-mono">
                    {stage.label}
                  </span>
                </div>
                {idx < pipeline.length - 1 && (
                  <div className="w-6 h-px bg-navy-200" />
                )}
              </div>
            ))}
          </div>

          {!keyOk && (
            <Link
              to="/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-verdict-review-bg text-verdict-review text-xs font-medium hover:bg-verdict-review-bg/80"
            >
              <AlertTriangle size={14} />
              No API key
            </Link>
          )}
          {keyOk && (
            <Link
              to="/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-verdict-eligible-bg text-verdict-eligible text-xs font-medium"
            >
              <KeyRound size={14} />
              API key set
            </Link>
          )}
          {isProcessing && (
            <div className="text-xs text-navy-500 font-mono animate-pulse">
              Processing…
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
