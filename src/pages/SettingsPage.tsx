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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gold-100 text-gold-500 flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg text-navy-800">
              Gemini API key
            </h3>
            <p className="text-xs text-navy-400 mt-0.5 font-mono">
              Model: {GEMINI_MODEL_ID}
            </p>
          </div>
        </div>

        <p className="text-sm text-navy-600 mb-3">
          Get a free key from Google AI Studio (1500 requests/day on the free tier).
        </p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-gold-500 hover:text-gold-600 mb-4"
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
          <button onClick={save} className="nirnay-btn-gold">
            <Check size={16} /> Save
          </button>
          <button onClick={clear} className="nirnay-btn-ghost">
            <Trash2 size={14} /> Clear
          </button>
        </div>
      </section>

      <section className="nirnay-card p-6">
        <h3 className="font-display font-semibold text-lg text-navy-800 mb-2">
          Supabase
        </h3>
        <p className="text-sm text-navy-600">
          The demo uses a shared Supabase project. To run on your own infra, copy{' '}
          <code className="font-mono text-xs bg-cream-300 px-1.5 py-0.5 rounded">.env.example</code>
          {' '}to <code className="font-mono text-xs bg-cream-300 px-1.5 py-0.5 rounded">.env.local</code>{' '}
          and set the URL + anon key.
        </p>
      </section>
    </div>
  );
}
