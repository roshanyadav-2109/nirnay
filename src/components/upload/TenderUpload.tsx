import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Upload, X } from 'lucide-react';
import { useTender } from '../../hooks/useTender';
import { hasGeminiApiKey } from '../../config/gemini';
import LoadingSpinner from '../common/LoadingSpinner';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function TenderUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const { uploadAndProcessTender } = useTender();
  const navigate = useNavigate();

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0]);
      if (!name) setName(accepted[0].name.replace(/\.[^.]+$/, ''));
    }
  }, [name]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!file) return toast.error('Choose a tender PDF first');
    if (!name.trim()) return toast.error('Give the tender a name');
    if (!hasGeminiApiKey()) {
      toast.error('Set your Gemini API key in Settings first');
      navigate('/settings');
      return;
    }
    setBusy(true);
    const t = toast.loading('Extracting criteria with Gemini…');
    try {
      const { criteria } = await uploadAndProcessTender(file, name.trim(), description.trim() || undefined);
      toast.success(`Extracted ${criteria.length} criteria`, { id: t });
      navigate('/criteria');
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`, { id: t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nirnay-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-gold-100 text-gold-500 flex items-center justify-center">
          <FileText size={20} />
        </div>
        <div>
          <h3 className="font-display font-semibold text-lg text-navy-800">
            Upload Tender Document
          </h3>
          <p className="text-sm text-navy-400">
            Single PDF. Gemini reads it natively — no OCR pipeline needed.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-navy-500 uppercase tracking-wide">
            Tender name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="nirnay-input mt-1"
            placeholder="e.g. CRPF Border Outpost Construction"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-navy-500 uppercase tracking-wide">
            Description (optional)
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="nirnay-input mt-1"
            placeholder="Brief notes for the evaluation team"
          />
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg px-6 py-10 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-gold-400 bg-gold-100/40'
              : 'border-navy-200 hover:border-gold-400 hover:bg-cream-300'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="mx-auto text-navy-400" size={28} />
          <p className="mt-2 text-sm text-navy-600">
            {file ? (
              <span className="font-mono">{file.name}</span>
            ) : (
              <>Drop tender PDF here, or click to browse</>
            )}
          </p>
          {file && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
              }}
              className="mt-2 text-xs text-navy-400 hover:text-verdict-not-eligible inline-flex items-center gap-1"
            >
              <X size={12} /> remove
            </button>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={busy || !file}
          className="nirnay-btn-gold w-full"
        >
          {busy ? <LoadingSpinner label="Working…" /> : 'Extract Criteria'}
        </button>
      </div>
    </div>
  );
}
