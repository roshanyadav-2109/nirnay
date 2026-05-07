import { useState } from 'react';
import { ChevronRight, ChevronDown, Hash } from 'lucide-react';
import type { AuditEvent } from '../../types';

const EVENT_COLORS: Record<string, string> = {
  tender_uploaded: 'bg-blue-100 text-blue-700',
  criteria_extracted: 'bg-purple-100 text-purple-700',
  criteria_edited: 'bg-amber-100 text-amber-700',
  criteria_verified: 'bg-emerald-100 text-emerald-700',
  bidder_uploaded: 'bg-indigo-100 text-indigo-700',
  evaluation_started: 'bg-cyan-100 text-cyan-700',
  evaluation_completed: 'bg-teal-100 text-teal-700',
  verdict_produced: 'bg-emerald-100 text-emerald-700',
  verdict_overridden: 'bg-orange-100 text-orange-700',
  report_generated: 'bg-slate-100 text-slate-700',
  audit_chain_verified: 'bg-gold-100 text-gold-600',
};

interface Props {
  event: AuditEvent;
  index: number;
  broken?: boolean;
}

export default function AuditEventRow({ event, index, broken }: Props) {
  const [expanded, setExpanded] = useState(false);
  const colorCls = EVENT_COLORS[event.event_type] || 'bg-cream-300 text-navy-600';

  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        broken
          ? 'border-verdict-not-eligible bg-verdict-not-eligible-bg'
          : 'border-cream-400/60 bg-white'
      }`}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-cream-200/40"
      >
        <div className="text-navy-400 mt-1">
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-navy-400">#{index + 1}</span>
            <span className={`nirnay-badge ${colorCls}`}>{event.event_type}</span>
            <span className="nirnay-badge bg-cream-300 text-navy-500">
              {event.entity_type}
            </span>
            <span className="text-xs text-navy-400">
              {new Date(event.created_at).toLocaleString()}
            </span>
            <span className="text-xs text-navy-500">by {event.actor}</span>
            {broken && (
              <span className="nirnay-badge bg-verdict-not-eligible text-white">
                CHAIN BROKEN
              </span>
            )}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1 text-xs text-navy-400 font-mono shrink-0">
          <Hash size={11} />
          <span>{event.event_hash.slice(0, 10)}…</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-cream-400/60 bg-cream-100 px-4 py-3 space-y-3">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-navy-400 font-semibold mb-1">
              Payload
            </div>
            <pre className="font-mono text-xs bg-navy-800 text-cream-200 p-3 rounded overflow-x-auto">
              {JSON.stringify(event.payload, null, 2)}
            </pre>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
            <div>
              <div className="text-navy-400 uppercase">prev_hash</div>
              <div className="break-all text-navy-700">
                {event.prev_hash || '(genesis)'}
              </div>
            </div>
            <div>
              <div className="text-navy-400 uppercase">event_hash</div>
              <div className="break-all text-navy-700">{event.event_hash}</div>
            </div>
          </div>
          {event.entity_id && (
            <div className="text-[11px] font-mono">
              <span className="text-navy-400 uppercase">entity_id: </span>
              <span className="text-navy-700">{event.entity_id}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
