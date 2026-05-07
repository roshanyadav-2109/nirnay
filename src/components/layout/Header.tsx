import { useEvaluationStore } from '../../store/evaluation-store';
import { hasGeminiApiKey } from '../../config/gemini';
import { AlertTriangle, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

const STAGE_DOTS: Record<'idle' | 'active' | 'done' | 'error', string> = {
  idle: 'bg-navy-200',
  active: 'bg-ink animate-pulse',
  done: 'bg-ink',
  error: 'bg-verdict-not-eligible',
};

export default function Header() {
  const { tender, pipeline, isProcessing } = useEvaluationStore();
  const keyOk = hasGeminiApiKey();

  return (
    <header className="bg-white border-b border-rule px-8 py-4">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold text-ink tracking-tight truncate">
            {tender ? tender.name : 'Tender Evaluation'}
          </h1>
          <p className="text-xs text-navy-400 mt-0.5">
            Every verdict, with evidence.
          </p>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-1.5">
            {pipeline.map((stage, idx) => (
              <div key={stage.key} className="flex items-center gap-1.5">
                <div className="flex flex-col items-center min-w-[44px]">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${STAGE_DOTS[stage.status]}`}
                  />
                  <span className="text-[9px] uppercase tracking-wider text-navy-400 mt-1.5 font-medium">
                    {stage.label}
                  </span>
                </div>
                {idx < pipeline.length - 1 && (
                  <div className="w-4 h-px bg-rule" />
                )}
              </div>
            ))}
          </div>

          {!keyOk ? (
            <Link
              to="/settings"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-verdict-review bg-verdict-review-bg border border-verdict-review/20 hover:bg-verdict-review-bg/70"
            >
              <AlertTriangle size={11} />
              No API key
            </Link>
          ) : (
            <Link
              to="/settings"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium text-navy-500 hover:text-ink hover:bg-cream-200"
            >
              <KeyRound size={11} />
              API key set
            </Link>
          )}
          {isProcessing && (
            <div className="text-[11px] text-navy-400 font-mono animate-pulse">
              processing…
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
