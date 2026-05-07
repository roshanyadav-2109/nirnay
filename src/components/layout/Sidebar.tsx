import { NavLink } from 'react-router-dom';
import {
  Home,
  ListChecks,
  Gavel,
  FileBarChart,
  ShieldCheck,
  Settings,
} from 'lucide-react';

const items = [
  { to: '/', label: 'Home', Icon: Home },
  { to: '/criteria', label: 'Criteria', Icon: ListChecks },
  { to: '/evaluation', label: 'Evaluation', Icon: Gavel },
  { to: '/report', label: 'Report', Icon: FileBarChart },
  { to: '/audit', label: 'Audit Trail', Icon: ShieldCheck },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-white border-r border-rule flex flex-col">
      <div className="px-6 py-6">
        <div className="flex items-baseline gap-2">
          <span className="font-serif italic text-3xl text-ink leading-none">
            Nirnay
          </span>
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

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(({ to, label, Icon }) => (
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
        ))}
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
        <div className="px-3 pt-3 text-[10px] text-navy-300 font-mono">
          v0.1.0 · POC
        </div>
      </div>
    </aside>
  );
}
