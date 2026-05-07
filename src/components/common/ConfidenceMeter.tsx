interface Props {
  value: number;
  showLabel?: boolean;
}

export default function ConfidenceMeter({ value, showLabel = true }: Props) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? 'bg-verdict-eligible' : pct >= 60 ? 'bg-gold-400' : 'bg-verdict-review';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full bg-navy-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <span className="text-xs font-mono text-navy-500 w-9 text-right">{pct}%</span>
      )}
    </div>
  );
}
