const CRORE = 10_000_000;
const LAKH = 100_000;

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  twenty_five: 25,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
};

function stripCurrencyPrefixes(input: string): string {
  return input
    .replace(/(?:rs\.?|inr|₹|rupees?)\s*/gi, '')
    .replace(/\s*\/\s*-/g, '')
    .replace(/\(rupees?[^)]*\)/gi, '')
    .trim();
}

function parseIndianNumberString(numStr: string): number | null {
  const cleaned = numStr.replace(/[\s,]/g, '');
  if (!/^[\d.]+$/.test(cleaned)) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function normalizeIndianCurrency(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;

  const original = String(input).trim();
  if (!original) return null;

  const cleaned = stripCurrencyPrefixes(original).toLowerCase();

  // Word-form numerals e.g. "fifty lakh", "five crore"
  for (const [word, value] of Object.entries(WORD_NUMBERS)) {
    const wordRegex = new RegExp(`\\b${word.replace('_', '[\\s-]?')}\\b`, 'i');
    if (wordRegex.test(cleaned)) {
      if (/cror|cr\b/i.test(cleaned)) return value * CRORE;
      if (/lakh|lac/i.test(cleaned)) return value * LAKH;
    }
  }

  const numMatch = cleaned.match(/([\d,]+(?:\.\d+)?)/);
  if (!numMatch) return null;
  const baseNum = parseIndianNumberString(numMatch[1]);
  if (baseNum == null) return null;

  if (/cror|\bcrs?\b|\bcr\b/i.test(cleaned)) return baseNum * CRORE;
  if (/lakh|lac|\blacs?\b/i.test(cleaned)) return baseNum * LAKH;
  if (/million|\bmn\b/i.test(cleaned)) return baseNum * 1_000_000;
  if (/billion|\bbn\b/i.test(cleaned)) return baseNum * 1_000_000_000;

  return baseNum;
}

export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  if (amount >= CRORE) {
    const cr = amount / CRORE;
    return `₹${cr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
  }
  if (amount >= LAKH) {
    const lk = amount / LAKH;
    return `₹${lk.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Lakh`;
  }
  return `₹${amount.toLocaleString('en-IN')}`;
}

export function compareNumeric(
  found: string | number | null | undefined,
  operator: '>=' | '<=' | '==' | '>' | '<',
  threshold: number,
): { passed: boolean; foundValue: number | null } {
  const foundNum = normalizeIndianCurrency(found ?? null);
  if (foundNum == null) return { passed: false, foundValue: null };
  let passed = false;
  switch (operator) {
    case '>=':
      passed = foundNum >= threshold;
      break;
    case '<=':
      passed = foundNum <= threshold;
      break;
    case '==':
      passed = foundNum === threshold;
      break;
    case '>':
      passed = foundNum > threshold;
      break;
    case '<':
      passed = foundNum < threshold;
      break;
  }
  return { passed, foundValue: foundNum };
}
