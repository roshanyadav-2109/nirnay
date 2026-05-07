import { useState } from 'react';
import { KeyRound, ExternalLink, Trash2, Check, Cpu } from 'lucide-react';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  clearGeminiApiKey,
  getGeminiModelId,
  setGeminiModelId,
  GEMINI_MODELS,
} from '../config/gemini';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [key, setKey] = useState(getGeminiApiKey() || '');
  const [revealed, setRevealed] = useState(false);
  const [modelId, setModelIdState] = useState(getGeminiModelId());

  const save = () => {
    if (!key.trim()) return toast.error('Enter a key first');
    setGeminiApiKey(key.trim());
    toast.success('API key saved (browser only)');
  };

  const clear = () => {
    clearGeminiApiKey();
    setKey('');
    toast.success('API key cleared');
  };

  const onModelChange = (id: string) => {
    setModelIdState(id);
    setGeminiModelId(id);
    toast.success(`Model switched to ${id}`);
  };

  const activeModel = GEMINI_MODELS.find((m) => m.id === modelId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="nirnay-section-title">Settings</h2>
        <p className="text-sm text-navy-400 mt-1">
          API keys live in your browser only — never sent to our servers.
        </p>
      </div>

      <section className="nirnay-card p-6">
        <div className="mb-5">
          <p className="label-overline">API access</p>
          <h3 className="font-display font-semibold text-lg text-ink mt-1.5 tracking-tight flex items-center gap-2">
            <KeyRound size={16} strokeWidth={1.75} className="text-navy-400" />
            Gemini API key
          </h3>
        </div>

        <p className="text-sm text-navy-500 mb-2">
          Get a free key from Google AI Studio (1500 requests/day on the free tier).
        </p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-ink underline underline-offset-4 hover:opacity-70 mb-4"
        >
          aistudio.google.com/apikey <ExternalLink size={12} />
        </a>

        <div className="flex gap-2">
          <input
            type={revealed ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="nirnay-input font-mono"
            placeholder="AIza…"
          />
          <button
            onClick={() => setRevealed((v) => !v)}
            className="nirnay-btn-ghost text-xs"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={save} className="nirnay-btn-primary">
            <Check size={14} /> Save
          </button>
          <button onClick={clear} className="nirnay-btn-ghost">
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </section>

      <section className="nirnay-card p-6">
        <div className="mb-5">
          <p className="label-overline">Model</p>
          <h3 className="font-display font-semibold text-lg text-ink mt-1.5 tracking-tight flex items-center gap-2">
            <Cpu size={16} strokeWidth={1.75} className="text-navy-400" />
            Gemini model
          </h3>
          <p className="text-xs text-navy-400 mt-1">
            If you see <code className="font-mono">quota = 0</code> errors, switch to a different model — different keys/projects have different free-tier availability.
          </p>
        </div>

        <div className="space-y-2">
          {GEMINI_MODELS.map((m) => (
            <label
              key={m.id}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-md border cursor-pointer transition-colors ${
                modelId === m.id
                  ? 'border-ink bg-cream-200'
                  : 'border-rule bg-white hover:border-navy-300'
              }`}
            >
              <input
                type="radio"
                name="model"
                value={m.id}
                checked={modelId === m.id}
                onChange={() => onModelChange(m.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-ink">{m.id}</span>
                  <span className="text-xs text-navy-400">— {m.label.replace(/^Gemini [^—]+/, '').trim() || m.label}</span>
                </div>
                <p className="text-xs text-navy-400 mt-0.5">{m.note}</p>
              </div>
            </label>
          ))}
        </div>

        {activeModel && (
          <p className="text-xs text-navy-500 mt-3 font-mono">
            Active: {activeModel.id}
          </p>
        )}
      </section>

      <section className="nirnay-card p-6">
        <p className="label-overline">Throttling</p>
        <h3 className="font-display font-semibold text-lg text-ink mt-1.5 tracking-tight">
          Request pacing
        </h3>
        <p className="text-sm text-navy-500 mt-3">
          Calls to Gemini are auto-throttled to roughly <span className="font-mono text-ink">13 RPM</span> (≈4.5s between calls)
          to stay under the free-tier limit of 15 RPM. A full evaluation of 5 bidders × 10 criteria therefore takes ~4 minutes.
          Quota errors are retried with exponential backoff using the API's <code className="font-mono">retry-after</code> hint.
        </p>
      </section>

      <section className="nirnay-card p-6">
        <p className="label-overline">Backend</p>
        <h3 className="font-display font-semibold text-lg text-ink mt-1.5 tracking-tight">
          Supabase
        </h3>
        <p className="text-sm text-navy-500 mt-3">
          The demo uses a shared Supabase project. To run on your own infra, copy{' '}
          <code className="font-mono text-xs bg-cream-300 px-1.5 py-0.5 rounded text-ink">.env.example</code>
          {' '}to <code className="font-mono text-xs bg-cream-300 px-1.5 py-0.5 rounded text-ink">.env.local</code>{' '}
          and set the URL + anon key.
        </p>
      </section>
    </div>
  );
}
