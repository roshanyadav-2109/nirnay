import StatusPill from '../common/StatusPill';
import ConfidenceMeter from '../common/ConfidenceMeter';
import type { VerdictStatus } from '../../types';

interface Props {
  status: VerdictStatus;
  confidence?: number;
  reasoning?: string;
}

export default function VerdictBadge({ status, confidence, reasoning }: Props) {
  return (
    <div className="flex flex-col items-end gap-1">
      <StatusPill status={status} />
      {typeof confidence === 'number' && <ConfidenceMeter value={confidence} />}
      {reasoning && (
        <p className="text-[11px] text-navy-400 italic max-w-[260px] text-right">
          {reasoning}
        </p>
      )}
    </div>
  );
}
