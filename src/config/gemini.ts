import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';

const GEMINI_KEY_STORAGE = 'nirnay_gemini_api_key';
const GEMINI_MODEL_STORAGE = 'nirnay_gemini_model';

export const GEMINI_MODELS = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (recommended)',
    note: 'Production. Free tier: 15 RPM, 1500 req/day.',
  },
  {
    id: 'gemini-2.5-flash-lite',
    label: 'Gemini 2.5 Flash Lite',
    note: 'Cheaper, faster. Good fallback if 2.5 Flash hits quota.',
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    note: 'Some keys/projects have limit: 0 free tier — switch to 2.5 if you see "quota 0".',
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash (legacy)',
    note: 'Still works on most keys; widest free-tier availability.',
  },
] as const;

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

// Bundled fallback key so judges / first-time users don't need to bring their
// own. localStorage and env-var both override this if set. Keep this as a
// deliberate convenience for the demo deployment — users who want their own
// quota can paste a key in Settings.
const BUNDLED_GEMINI_API_KEY = 'AIzaSyAYc_b2CdpZHCszPPIyiHPNPGw-kUsmVMo';

export function getGeminiApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(GEMINI_KEY_STORAGE);
  if (stored) return stored;
  const fromEnv = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (fromEnv) return fromEnv;
  return BUNDLED_GEMINI_API_KEY;
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
}

export function clearGeminiApiKey(): void {
  localStorage.removeItem(GEMINI_KEY_STORAGE);
}

export function hasGeminiApiKey(): boolean {
  return !!getGeminiApiKey();
}

export function getGeminiModelId(): string {
  if (typeof window === 'undefined') return DEFAULT_GEMINI_MODEL;
  return localStorage.getItem(GEMINI_MODEL_STORAGE) || DEFAULT_GEMINI_MODEL;
}

export function setGeminiModelId(id: string): void {
  localStorage.setItem(GEMINI_MODEL_STORAGE, id);
}

// Backward-compat export so other modules that imported GEMINI_MODEL_ID still work.
export const GEMINI_MODEL_ID = DEFAULT_GEMINI_MODEL;

function getModel(): GenerativeModel {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error(
      'Gemini API key missing. Open Settings to add one (free at https://aistudio.google.com/apikey).',
    );
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: getGeminiModelId(),
    generationConfig: {
      temperature: 0.1,
      topP: 0.9,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });
}

// ------------------------------------------------------------------
// Throttling — free tier is 15 RPM. We aim for ~13 RPM (4.5s gap)
// to leave room for jitter.
// ------------------------------------------------------------------
const MIN_GAP_MS = 4500;
let lastCallAt = 0;
let inFlight: Promise<void> = Promise.resolve();

async function throttle(): Promise<void> {
  // Serialize through a single chain so concurrent callers also get spaced.
  const next = inFlight.then(async () => {
    const now = Date.now();
    const wait = Math.max(0, lastCallAt + MIN_GAP_MS - now);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  });
  inFlight = next.catch(() => {});
  return next;
}

export interface GeminiCallOptions {
  prompt: string;
  pdfs?: Array<{ data: string; mimeType?: string }>;
  retries?: number;
}

function isQuotaError(err: unknown): { is429: boolean; retryAfterMs?: number } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('429') || /quota/i.test(msg)) {
    const m = msg.match(/Please retry in ([0-9.]+)s/);
    if (m) return { is429: true, retryAfterMs: Math.ceil(parseFloat(m[1]) * 1000) };
    return { is429: true };
  }
  return { is429: false };
}

export async function callGemini({
  prompt,
  pdfs = [],
  retries = 3,
}: GeminiCallOptions): Promise<string> {
  const model = getModel();
  const parts: Part[] = [];

  for (const pdf of pdfs) {
    parts.push({
      inlineData: {
        mimeType: pdf.mimeType || 'application/pdf',
        data: pdf.data,
      },
    });
  }
  parts.push({ text: prompt });

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await throttle();
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      const { is429, retryAfterMs } = isQuotaError(err);

      if (is429 && /limit:\s*0/.test(err instanceof Error ? err.message : '')) {
        // Hard zero-quota — no point retrying. Surface a clear actionable error.
        throw new Error(
          `Quota = 0 for model "${getGeminiModelId()}" on this API key. ` +
            `Open Settings and switch to "Gemini 2.5 Flash" (or 1.5 Flash). ` +
            `If 2.5 Flash also fails, the key needs free-tier access enabled at https://aistudio.google.com/apikey.`,
        );
      }

      if (attempt < retries) {
        const backoff = retryAfterMs ?? 1500 * (attempt + 1);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini call failed');
}

export function parseJsonResponse<T = unknown>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let start = -1;
  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) start = firstBrace;
  else if (firstBracket >= 0) start = firstBracket;
  if (start > 0) cleaned = cleaned.slice(start);

  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end > 0 && end < cleaned.length - 1) cleaned = cleaned.slice(0, end + 1);

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(
      `Failed to parse Gemini JSON response: ${(e as Error).message}\n\nRaw output:\n${text.slice(0, 500)}`,
    );
  }
}
