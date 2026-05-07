import { useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, RefreshCcw, Bug } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuditLog } from '../hooks/useAuditLog';
import { logAuditEvent, simulateTampering } from '../lib/audit-logger';
import AuditEventRow from '../components/audit/AuditEvent';

export default function AuditPage() {
  const { events, loading, verification, refresh, verify } = useAuditLog();
  const [filter, setFilter] = useState('');
  const [verifying, setVerifying] = useState(false);

  const filtered = useMemo(() => {
    if (!filter) return events;
    const q = filter.toLowerCase();
    return events.filter(
      (e) =>
        e.event_type.toLowerCase().includes(q) ||
        e.entity_type.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        JSON.stringify(e.payload).toLowerCase().includes(q),
    );
  }, [events, filter]);

  const handleTamper = async () => {
    const t = toast.loading('Simulating tampering — modifying one audit row…');
    try {
      const row = await simulateTampering();
      if (!row) {
        toast.error('No audit events to tamper with', { id: t });
        return;
      }
      toast.success(`Tampered with event #${row.id}. Click "Verify chain" to detect it.`, {
        id: t,
        duration: 5000,
      });
      await refresh();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    const t = toast.loading('Recomputing hash chain…');
    try {
      const result = await verify();
      if (result.ok) {
        toast.success(`Chain intact across ${result.total} events`, { id: t });
        await logAuditEvent({
          event_type: 'audit_chain_verified',
          entity_type: 'audit_log',
          payload: { ok: true, total: result.total },
        });
        refresh();
      } else {
        toast.error(`Chain broken at event #${(result.firstBrokenIndex ?? 0) + 1}`, { id: t });
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="nirnay-section-title">Audit Trail</h2>
          <p className="text-sm text-navy-500 mt-1">
            Every action chained with SHA-256. Tampering breaks the chain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="nirnay-btn-ghost text-sm">
            <RefreshCcw size={14} /> Refresh
          </button>
          <button
            onClick={handleTamper}
            className="nirnay-btn-ghost text-sm border-verdict-not-eligible/40 text-verdict-not-eligible hover:bg-verdict-not-eligible-bg"
            title="Demo only — modify a row's payload directly to prove the chain catches it"
          >
            <Bug size={13} /> Simulate tampering
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="nirnay-btn-primary"
          >
            <ShieldCheck size={14} /> Verify chain
          </button>
        </div>
      </div>

      {verification && (
        <div
          className={`nirnay-card p-4 flex items-center gap-3 border-2 ${
            verification.ok
              ? 'border-verdict-eligible bg-verdict-eligible-bg/40'
              : 'border-verdict-not-eligible bg-verdict-not-eligible-bg/40'
          }`}
        >
          {verification.ok ? (
            <ShieldCheck className="text-verdict-eligible" size={24} />
          ) : (
            <ShieldAlert className="text-verdict-not-eligible" size={24} />
          )}
          <div>
            <div
              className={`font-display font-semibold ${
                verification.ok ? 'text-verdict-eligible' : 'text-verdict-not-eligible'
              }`}
            >
              {verification.ok ? 'Chain verified' : 'Chain integrity FAILED'}
            </div>
            <div className="text-xs text-navy-500 font-mono">
              {verification.ok
                ? `${verification.total} events validated end-to-end`
                : `Tampering detected at event #${(verification.firstBrokenIndex ?? 0) + 1}`}
            </div>
          </div>
        </div>
      )}

      <div className="nirnay-card p-4">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="nirnay-input"
          placeholder="Filter by event type, entity, actor, or payload…"
        />
      </div>

      <div className="space-y-2">
        {loading && (
          <div className="text-center py-8 text-navy-400 text-sm">Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-8 text-navy-400 text-sm">No events.</div>
        )}
        {filtered.map((ev, i) => (
          <AuditEventRow
            key={ev.id}
            event={ev}
            index={i}
            broken={
              !!verification &&
              !verification.ok &&
              verification.firstBrokenIndex === i
            }
          />
        ))}
      </div>
    </div>
  );
}
