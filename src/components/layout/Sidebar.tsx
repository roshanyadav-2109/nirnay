import { NavLink } from 'react-router-dom';
import {
  Home,
  ListChecks,
  Gavel,
  FileBarChart,
  ShieldCheck,
  Settings,
  UserCircle2,
} from 'lucide-react';
import { useEvaluationStore } from '../../store/evaluation-store';
import { getOfficerName } from '../../lib/officer';

const items = [
  { to: '/', label: 'Tenders', Icon: Home },
  { to: '/criteria', label: 'Criteria', Icon: ListChecks, requiresTender: true },
  { to: '/evaluation', label: 'Evaluation', Icon: Gavel, requiresTender: true },
  { to: '/report', label: 'Report', Icon: FileBarChart, requiresTender: true },
  { to: '/audit', label: 'Audit Trail', Icon: ShieldCheck },
];

export default function Sidebar() {
  const tender = useEvaluationStore((s) => s.tender);
  const officer = getOfficerName();

  return (
    <aside className="w-60 bg-white border-r border-rule flex flex-col">
      <div className="px-6 py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif italic text-3xl text-ink leading-none">Nirnay</span>
          <span className="font-mono text-[10px] text-navy-300 tracking-wider">
            निर्णय
          </span>
        </div>
        <p className="text-[11px] text-navy-400 mt-1.5 leading-snug">
          Citation-backed
          <br />tender evaluation
        </p>
      </div>

      <div className="h-px bg-rule mx-6" />

      {tender && (
        <div className="mx-3 mt-3 px-3 py-2.5 rounded-md bg-cream-200 border border-rule">
          <p className="label-overline">Active tender</p>
          <p className="text-xs font-medium text-ink mt-1 line-clamp-2 leading-snug">
            {tender.name}
          </p>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(({ to, label, Icon, requiresTender }) => {
          const disabled = requiresTender && !tender;
          if (disabled) {
            return (
              <div
                key={to}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-navy-300 cursor-not-allowed"
                title="Select a tender first"
              >
                <Icon size={15} strokeWidth={1.75} />
                {label}
              </div>
            );
          }
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-cream-300 text-ink font-medium'
                    : 'text-navy-500 hover:bg-cream-200 hover:text-ink'
                }`
              }
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </NavLink>
          );
        })}
      </nav>

      <div className="h-px bg-rule mx-6" />

      <div className="p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive
                ? 'bg-cream-300 text-ink font-medium'
                : 'text-navy-500 hover:bg-cream-200 hover:text-ink'
            }`
          }
        >
          <Settings size={15} strokeWidth={1.75} />
          Settings
        </NavLink>
        <div className="px-3 pt-3 flex items-center gap-1.5 text-[11px] text-navy-400">
          <UserCircle2 size={12} className="text-navy-300" />
          <span className="truncate" title={officer}>{officer}</span>
        </div>
        <div className="px-3 pt-1 text-[10px] text-navy-300 font-mono">
          v0.1.0 · POC
        </div>
      </div>
    </aside>
  );
}
