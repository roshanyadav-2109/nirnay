import { useState } from 'react';
import { Edit2, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import type { Criterion, CriterionCategory, RuleType } from '../../types';

const CATEGORY_COLORS: Record<CriterionCategory, string> = {
  technical: 'bg-blue-100 text-blue-700',
  financial: 'bg-emerald-100 text-emerald-700',
  compliance: 'bg-purple-100 text-purple-700',
  document: 'bg-amber-100 text-amber-700',
};

const RULE_TYPES: RuleType[] = [
  'numeric_threshold',
  'boolean_presence',
  'date_validity',
  'document_required',
  'semantic_match',
];

interface Props {
  criterion: Criterion;
  onSave: (next: Criterion) => Promise<void> | void;
}

export default function CriterionCard({ criterion, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(criterion);
  const [expanded, setExpanded] = useState(false);

  const handleSave = async () => {
    await onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(criterion);
    setEditing(false);
  };

  return (
    <div className="border border-cream-400/60 rounded-lg bg-white shadow-soft overflow-hidden">
      <div className="px-4 py-3 flex items-start gap-3">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-navy-400 hover:text-navy-700 mt-0.5"
          aria-label="expand"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-navy-500 font-semibold">
              {criterion.criterion_code}
            </span>
            <span
              className={`nirnay-badge ${CATEGORY_COLORS[criterion.category]}`}
            >
              {criterion.category}
            </span>
            <span
              className={`nirnay-badge ${
                criterion.is_mandatory
                  ? 'bg-verdict-not-eligible-bg text-verdict-not-eligible'
                  : 'bg-cream-400 text-navy-500'
              }`}
            >
              {criterion.is_mandatory ? 'Mandatory' : 'Preferred'}
            </span>
            <span className="nirnay-badge bg-cream-300 text-navy-500 font-mono">
              {criterion.rule_type}
            </span>
            {criterion.human_verified && (
              <span className="nirnay-badge bg-verdict-eligible-bg text-verdict-eligible">
                ✓ verified
              </span>
            )}
            {criterion.human_edited && (
              <span className="nirnay-badge bg-gold-100 text-gold-500">
                edited
              </span>
            )}
          </div>

          {editing ? (
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="nirnay-input mt-2 text-sm"
              rows={2}
            />
          ) : (
            <p className="mt-2 text-sm text-navy-700 leading-relaxed">
              {criterion.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <button onClick={handleSave} className="p-1.5 hover:bg-cream-300 rounded">
                <Save size={14} className="text-verdict-eligible" />
              </button>
              <button onClick={cancel} className="p-1.5 hover:bg-cream-300 rounded">
                <X size={14} className="text-verdict-not-eligible" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 hover:bg-cream-300 rounded text-navy-400 hover:text-navy-700"
            >
              <Edit2 size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-cream-400/60 bg-cream-100">
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-navy-400 font-semibold">
                Rule type
              </label>
              {editing ? (
                <select
                  value={draft.rule_type}
                  onChange={(e) =>
                    setDraft({ ...draft, rule_type: e.target.value as RuleType })
                  }
                  className="nirnay-input mt-1 text-sm"
                >
                  {RULE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="font-mono text-sm text-navy-700 mt-1">
                  {criterion.rule_type}
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-navy-400 font-semibold">
                Mandatory?
              </label>
              {editing ? (
                <select
                  value={String(draft.is_mandatory)}
                  onChange={(e) =>
                    setDraft({ ...draft, is_mandatory: e.target.value === 'true' })
                  }
                  className="nirnay-input mt-1 text-sm"
                >
                  <option value="true">Mandatory (shall/must)</option>
                  <option value="false">Preferred (desirable)</option>
                </select>
              ) : (
                <div className="text-sm text-navy-700 mt-1">
                  {criterion.is_mandatory ? 'Yes' : 'No'}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wide text-navy-400 font-semibold">
                Parameters
              </label>
              <pre className="font-mono text-xs bg-navy-800 text-cream-200 p-3 rounded mt-1 overflow-x-auto">
                {JSON.stringify(criterion.parameters || {}, null, 2)}
              </pre>
            </div>
            {criterion.source_text && (
              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase tracking-wide text-navy-400 font-semibold">
                  Source quote {criterion.source_page ? `(page ${criterion.source_page})` : ''}
                </label>
                <div className="evidence-highlight mt-1">
                  "{criterion.source_text}"
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
