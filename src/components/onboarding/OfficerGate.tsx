import { useEffect, useState } from 'react';
import { UserCircle2 } from 'lucide-react';
import { hasOfficerName, setOfficerName, getOfficerName } from '../../lib/officer';
import { logAuditEvent } from '../../lib/audit-logger';

export default function OfficerGate({ children }: { children: React.ReactNode }) {
  const [needsName, setNeedsName] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setNeedsName(!hasOfficerName());
    setDraft(getOfficerName() === 'officer' ? '' : getOfficerName());
  }, []);

  const submit = async () => {
    const name = draft.trim();
    if (!name) return;
    setOfficerName(name);
    await logAuditEvent({
      event_type: 'officer_set',
      entity_type: 'officer',
      actor: name,
      payload: { name, set_at: new Date().toISOString() },
    });
    setNeedsName(false);
  };

  if (!needsName) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-cream-200">
      <div className="w-full max-w-md bg-white rounded-md border border-rule shadow-card p-7">
        <div className="flex items-center gap-2.5 mb-1">
          <UserCircle2 size={18} className="text-navy-500" strokeWidth={1.75} />
          <p className="label-overline">Welcome to Nirnay</p>
        </div>
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">
          Your name for the audit log
        </h2>
        <p className="text-sm text-navy-500 mt-2 leading-relaxed">
          This name is attached to every action you take — uploads, criteria edits,
          verdict overrides — so the audit trail can attribute decisions back to you.
          Stored in your browser only.
        </p>

        <div className="mt-5">
          <label className="label-overline">Officer name or email</label>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="nirnay-input mt-1.5"
            placeholder="e.g. Insp. R. Yadav · CRPF Procurement Cell"
          />
        </div>

        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="nirnay-btn-primary w-full mt-4"
        >
          Continue
        </button>

        <p className="text-[11px] text-navy-400 mt-3">
          You can change this anytime in Settings.
        </p>
      </div>
    </div>
  );
}
