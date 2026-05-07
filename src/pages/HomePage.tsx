import { useEffect, useState } from 'react';
import { Plus, Search, ShieldCheck, X } from 'lucide-react';
import TenderUpload from '../components/upload/TenderUpload';
import TenderCard from '../components/tenders/TenderCard';
import ImpactPanel from '../components/tenders/ImpactPanel';
import { useTender, type TenderSummary } from '../hooks/useTender';
import { Link } from 'react-router-dom';

export default function HomePage() {
  const { listTenders, loadActiveTender } = useTender();
  const [tenders, setTenders] = useState<TenderSummary[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('');

  const refresh = async () => {
    const list = await listTenders();
    setTenders(list);
    if (list.length === 0) setShowNew(true);
  };

  useEffect(() => {
    refresh();
    loadActiveTender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = (tenders || []).filter((t) =>
    filter ? t.name.toLowerCase().includes(filter.toLowerCase()) : true,
  );

  return (
    <div className="space-y-7 max-w-6xl mx-auto">
      <section className="pt-6 pb-2">
        <p className="label-overline mb-3">Tender workspace</p>
        <h1 className="font-display text-4xl md:text-5xl font-semibold text-ink tracking-tightest leading-[1.05] max-w-3xl">
          Every verdict,{' '}
          <span className="font-serif italic font-normal">with evidence.</span>
        </h1>
        <p className="mt-4 text-sm text-navy-500 max-w-2xl leading-relaxed">
          A workspace for procurement officers to evaluate tender bids — citation-backed
          verdicts, hash-chained audit trail, officer override built in. Each tender is
          independent and persists across sessions.
        </p>
      </section>

      <ImpactPanel />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold text-ink tracking-tight">
            Tenders
          </h2>
          {tenders && (
            <span className="nirnay-badge bg-cream-300 text-navy-500">
              {tenders.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-navy-400"
            />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="nirnay-input pl-7 w-56 text-xs"
              placeholder="Filter tenders…"
            />
          </div>
          <Link to="/audit" className="nirnay-btn-ghost">
            <ShieldCheck size={13} /> Audit
          </Link>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="nirnay-btn-primary"
          >
            {showNew ? <><X size={13} /> Close</> : <><Plus size={13} /> New tender</>}
          </button>
        </div>
      </div>

      {showNew && (
        <div className="space-y-2">
          <TenderUpload
            onCreated={() => {
              setShowNew(false);
              refresh();
            }}
          />
        </div>
      )}

      {tenders === null ? (
        <div className="text-center py-16 text-sm text-navy-400">Loading tenders…</div>
      ) : visible.length === 0 ? (
        <EmptyState hasFilter={!!filter} onNew={() => setShowNew(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((t) => (
            <TenderCard key={t.id} tender={t} onChange={refresh} />
          ))}
        </div>
      )}

      <div className="h-px bg-rule" />

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
          body="SHA-256 hash chain across every action, attributed to the officer. One click verifies the trail."
        />
      </section>
    </div>
  );
}

function EmptyState({ hasFilter, onNew }: { hasFilter: boolean; onNew: () => void }) {
  if (hasFilter) {
    return (
      <div className="border border-dashed border-rule rounded-md p-10 text-center text-sm text-navy-400">
        No tenders match that filter.
      </div>
    );
  }
  return (
    <div className="border border-dashed border-rule rounded-md p-10 text-center">
      <p className="font-display text-lg text-ink tracking-tight">
        No tenders yet
      </p>
      <p className="text-sm text-navy-500 mt-1">
        Upload your first tender PDF to extract its eligibility criteria.
      </p>
      <button onClick={onNew} className="nirnay-btn-primary mt-4">
        <Plus size={13} /> New tender
      </button>
    </div>
  );
}

function Principle({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border border-rule rounded-md p-5 bg-white">
      <p className="font-mono text-[11px] text-navy-300">{n}</p>
      <p className="font-display font-semibold text-ink mt-2.5 tracking-tight">{title}</p>
      <p className="text-xs text-navy-500 mt-2 leading-relaxed">{body}</p>
    </div>
  );
}
