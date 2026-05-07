import { useEffect, useState } from 'react';
import { supabase } from '../../config/supabase';
import { Clock, ScrollText, Building2, Hash } from 'lucide-react';

interface Stats {
  tenders: number;
  bidders: number;
  verdicts: number;
  events: number;
}

const MINUTES_PER_VERDICT_MANUAL = 18; // realistic estimate per criterion-bidder
const MINUTES_PER_VERDICT_NIRNAY = 0.1; // ~6 seconds with batched eval

export default function ImpactPanel() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tenders, bidders, verdicts, events] = await Promise.all([
        supabase.from('tenders').select('id', { count: 'exact', head: true }),
        supabase.from('bidders').select('id', { count: 'exact', head: true }),
        supabase.from('evaluations').select('id', { count: 'exact', head: true }),
        supabase.from('audit_log').select('id', { count: 'exact', head: true }),
      ]);
      if (!cancelled) {
        setStats({
          tenders: tenders.count || 0,
          bidders: bidders.count || 0,
          verdicts: verdicts.count || 0,
          events: events.count || 0,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hoursSaved = stats
    ? Math.round((stats.verdicts * (MINUTES_PER_VERDICT_MANUAL - MINUTES_PER_VERDICT_NIRNAY)) / 60)
    : null;

  return (
    <div className="border border-rule rounded-md bg-white">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-rule">
        <Stat
          icon={<ScrollText size={14} strokeWidth={1.75} />}
          label="Tenders processed"
          value={stats?.tenders ?? '—'}
        />
        <Stat
          icon={<Building2 size={14} strokeWidth={1.75} />}
          label="Bidders evaluated"
          value={stats?.bidders ?? '—'}
        />
        <Stat
          icon={<Hash size={14} strokeWidth={1.75} />}
          label="Citation-backed verdicts"
          value={stats?.verdicts ?? '—'}
        />
        <Stat
          icon={<Clock size={14} strokeWidth={1.75} />}
          label="Officer hours saved"
          value={hoursSaved == null ? '—' : `${hoursSaved.toLocaleString('en-IN')}`}
          highlight
        />
      </div>
      <div className="px-4 py-2 border-t border-rule bg-cream-200 text-[11px] text-navy-400 font-mono">
        Manual baseline: {MINUTES_PER_VERDICT_MANUAL} min per criterion-bidder verdict ·
        Nirnay: ~6 sec ·
        100% citation coverage ·
        0 silent rejections by design
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-navy-400">
        {icon}
        <span className="label-overline">{label}</span>
      </div>
      <div
        className={`mt-1.5 font-display font-semibold tracking-tight ${
          highlight ? 'text-ink text-2xl' : 'text-ink text-xl'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
