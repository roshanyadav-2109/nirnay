import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, X, Plus } from 'lucide-react';
import { bytesToReadable } from '../../lib/pdf-utils';
import { useBidders } from '../../hooks/useBidders';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';

interface DraftBidder {
  id: string;
  name: string;
  files: File[];
}

interface Props {
  open: boolean;
  tenderId: string;
  onClose: () => void;
  onAdded: () => void;
}

export default function AddBidderModal({ open, tenderId, onClose, onAdded }: Props) {
  const [drafts, setDrafts] = useState<DraftBidder[]>([
    { id: crypto.randomUUID(), name: '', files: [] },
  ]);
  const [busy, setBusy] = useState(false);
  const { addBidder } = useBidders();

  if (!open) return null;

  const updateDraft = (id: string, patch: Partial<DraftBidder>) =>
    setDrafts((arr) => arr.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const removeDraft = (id: string) =>
    setDrafts((arr) => arr.filter((d) => d.id !== id));
  const addDraft = () =>
    setDrafts((arr) => [...arr, { id: crypto.randomUUID(), name: '', files: [] }]);

  const reset = () => {
    setDrafts([{ id: crypto.randomUUID(), name: '', files: [] }]);
  };

  const submit = async () => {
    const valid = drafts.filter((d) => d.name.trim() && d.files.length > 0);
    if (valid.length === 0) {
      toast.error('Add at least one bidder with a name + documents');
      return;
    }
    setBusy(true);
    const t = toast.loading(`Saving ${valid.length} bidder${valid.length === 1 ? '' : 's'}…`);
    try {
      for (const draft of valid) {
        await addBidder(tenderId, { name: draft.name.trim(), files: draft.files });
      }
      toast.success('Saved', { id: t });
      reset();
      onAdded();
      onClose();
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center pt-16 p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-md border border-rule shadow-card">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-rule">
          <div>
            <p className="label-overline">Add bidders</p>
            <h3 className="font-display text-lg font-semibold text-ink tracking-tight">
              New bidder submissions
            </h3>
            <p className="text-xs text-navy-400 mt-1">
              Add one or many at once. Each bidder gets a name and a set of documents.
            </p>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-ink p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[55vh] overflow-y-auto">
          {drafts.map((d) => (
            <DraftBidderCard
              key={d.id}
              draft={d}
              onChange={(p) => updateDraft(d.id, p)}
              onRemove={drafts.length > 1 ? () => removeDraft(d.id) : undefined}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-rule bg-cream-200 rounded-b-md">
          <button onClick={addDraft} className="nirnay-btn-ghost text-xs">
            <Plus size={13} /> Another bidder
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="nirnay-btn-ghost text-sm">
              Cancel
            </button>
            <button onClick={submit} disabled={busy} className="nirnay-btn-primary text-sm">
              {busy ? <LoadingSpinner /> : 'Save bidders'}
            </button>
          </div>
        </div>
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
    <div className="border border-rule rounded-md p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <input
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Bidder name (e.g. Sharma Construction Pvt Ltd)"
          className="nirnay-input flex-1"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-navy-400 hover:text-verdict-not-eligible"
            title="Remove this bidder"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div
        {...getRootProps()}
        className={`border border-dashed rounded-md px-4 py-4 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-ink bg-cream-300' : 'border-rule hover:border-navy-300 hover:bg-cream-200'
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-xs text-navy-500">
          Drop documents here, or click to add
        </p>
        <p className="text-[10px] text-navy-400 mt-0.5">
          PDF, PNG, JPG — multiple OK
        </p>
      </div>

      {draft.files.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {draft.files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-[11px] font-mono text-navy-500 px-2 py-1 bg-cream-200 rounded"
            >
              <FileText size={10} />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-navy-400">{bytesToReadable(f.size)}</span>
              <button
                onClick={() =>
                  onChange({ files: draft.files.filter((_, idx) => idx !== i) })
                }
                className="text-navy-400 hover:text-verdict-not-eligible"
              >
                <X size={10} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
