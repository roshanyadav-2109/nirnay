import { useState } from 'react';
import { KeyRound, ExternalLink, Trash2, Check } from 'lucide-react';
import {
  getGeminiApiKey,
  setGeminiApiKey,
  clearGeminiApiKey,
  GEMINI_MODEL_ID,
} from '../config/gemini';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [key, setKey] = useState(getGeminiApiKey() || '');
  const [revealed, setRevealed] = useState(false);

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
          <p className="text-xs text-navy-400 mt-1 font-mono">
            Model: {GEMINI_MODEL_ID}
          </p>
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
