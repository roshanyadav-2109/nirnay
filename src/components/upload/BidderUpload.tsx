import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Users, Plus, X, FileText } from 'lucide-react';
import { useEvaluationStore } from '../../store/evaluation-store';
import { useBidders } from '../../hooks/useBidders';
import LoadingSpinner from '../common/LoadingSpinner';
import { bytesToReadable } from '../../lib/pdf-utils';
import toast from 'react-hot-toast';

interface DraftBidder {
  id: string;
  name: string;
  files: File[];
}

export default function BidderUpload() {
  const tender = useEvaluationStore((s) => s.tender);
  const bidders = useEvaluationStore((s) => s.bidders);
  const { addBidder } = useBidders();
  const [drafts, setDrafts] = useState<DraftBidder[]>([
    { id: crypto.randomUUID(), name: '', files: [] },
  ]);
  const [busy, setBusy] = useState(false);

  const updateDraft = (id: string, patch: Partial<DraftBidder>) =>
    setDrafts((arr) => arr.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const removeDraft = (id: string) =>
    setDrafts((arr) => arr.filter((d) => d.id !== id));

  const addDraft = () =>
    setDrafts((arr) => [...arr, { id: crypto.randomUUID(), name: '', files: [] }]);

  const handleSave = async () => {
    if (!tender) return toast.error('Upload and process a tender first');
    const valid = drafts.filter((d) => d.name.trim() && d.files.length > 0);
    if (valid.length === 0) return toast.error('Add at least one bidder with documents');

    setBusy(true);
    try {
      for (const draft of valid) {
        await addBidder(tender.id, { name: draft.name.trim(), files: draft.files });
      }
      toast.success(`Saved ${valid.length} bidder${valid.length === 1 ? '' : 's'}`);
      setDrafts([{ id: crypto.randomUUID(), name: '', files: [] }]);
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nirnay-card p-6">
      <div className="mb-5">
        <p className="label-overline">Step 2</p>
        <h3 className="font-display font-semibold text-lg text-ink mt-1.5 tracking-tight flex items-center gap-2">
          <Users size={16} strokeWidth={1.75} className="text-navy-400" />
          Upload bidder submissions
        </h3>
        <p className="text-sm text-navy-400 mt-1">
          Each bidder may have multiple documents (PDF, images).
        </p>
      </div>

      {bidders.length > 0 && (
        <div className="mb-4 px-3 py-2 border border-rule rounded-md text-xs text-navy-500 bg-cream-200">
          <span className="font-medium text-ink">{bidders.length} bidder{bidders.length === 1 ? '' : 's'}</span> already saved for this tender.
        </div>
      )}

      <div className="space-y-3">
        {drafts.map((d) => (
          <DraftBidderCard
            key={d.id}
            draft={d}
            onChange={(p) => updateDraft(d.id, p)}
            onRemove={drafts.length > 1 ? () => removeDraft(d.id) : undefined}
          />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 mt-4">
        <button onClick={addDraft} className="nirnay-btn-ghost text-sm">
          <Plus size={14} /> Add another bidder
        </button>
        <button
          onClick={handleSave}
          disabled={busy || !tender}
          className="nirnay-btn-primary"
        >
          {busy ? <LoadingSpinner /> : 'Save Bidders'}
        </button>
      </div>
    </div>
  );
}

function DraftBidderCard({
  draft,
  onChange,
  onRemove,
}: {
  draft: DraftBidder;
  onChange: (p: Partial<DraftBidder>) => void;
  onRemove?: () => void;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => onChange({ files: [...draft.files, ...accepted] }),
    [draft.files, onChange],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
    },
  });

  return (
    <div className="border border-navy-200 rounded-lg p-4 bg-cream-100">
      <div className="flex items-center gap-3 mb-3">
        <input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Bidder name (e.g. Sharma Construction Pvt Ltd)"
          className="nirnay-input flex-1"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-navy-400 hover:text-verdict-not-eligible p-1.5"
            title="Remove this bidder"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div
        {...getRootProps()}
        className={`border border-dashed rounded-md px-4 py-5 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-ink bg-cream-300' : 'border-rule hover:border-navy-300 hover:bg-cream-200'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-navy-500">
          Drop documents here, or click to add
        </p>
        <p className="text-[11px] text-navy-400 mt-1">
          PDF, PNG, JPG — multiple OK
        </p>
      </div>

      {draft.files.length > 0 && (
        <ul className="mt-3 space-y-1">
          {draft.files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-xs font-mono text-navy-600 px-2 py-1 bg-cream-300 rounded"
            >
              <FileText size={12} />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-navy-400">{bytesToReadable(f.size)}</span>
              <button
                onClick={() =>
                  onChange({ files: draft.files.filter((_, idx) => idx !== i) })
                }
                className="text-navy-400 hover:text-verdict-not-eligible"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
