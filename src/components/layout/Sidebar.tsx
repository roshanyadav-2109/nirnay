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
    <aside className="w-64 bg-navy-800 text-cream-200 flex flex-col">
      <div className="px-6 py-6 border-b border-navy-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gold-400 rounded-lg flex items-center justify-center">
            <span className="font-display font-bold text-navy-800 text-xl">N</span>
          </div>
          <div>
            <div className="font-display font-semibold text-lg leading-tight">Nirnay</div>
            <div className="font-mono text-[10px] text-cream-300/60 tracking-wider">
              निर्णय
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-navy-700 text-gold-200'
                  : 'text-cream-200/80 hover:bg-navy-700/50 hover:text-cream-200'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-navy-700">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-navy-700 text-gold-200'
                : 'text-cream-200/80 hover:bg-navy-700/50'
            }`
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>
        <div className="px-3 pt-3 text-[10px] text-cream-300/40 font-mono">
          v0.1.0 · POC
        </div>
      </div>
    </aside>
  );
}
