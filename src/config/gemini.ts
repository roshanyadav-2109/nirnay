import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';

const GEMINI_KEY_STORAGE = 'nirnay_gemini_api_key';
export const GEMINI_MODEL_ID = 'gemini-2.0-flash';

export function getGeminiApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(GEMINI_KEY_STORAGE);
  if (stored) return stored;
  const fromEnv = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  return fromEnv || null;
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

function getModel(): GenerativeModel {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error(
      'Gemini API key missing. Open Settings to add one (free at https://aistudio.google.com/apikey).',
    );
  }
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({
    model: GEMINI_MODEL_ID,
    generationConfig: {
      temperature: 0.1,
      topP: 0.9,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  });
}

export interface GeminiCallOptions {
  prompt: string;
  pdfs?: Array<{ data: string; mimeType?: string }>;
  retries?: number;
}

export async function callGemini({
  prompt,
  pdfs = [],
  retries = 2,
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
      const result = await model.generateContent(parts);
      const text = result.response.text();
      return text;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
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
