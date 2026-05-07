const KEY = 'nirnay_demo_mode';

// Demo mode is ON by default — judges using the public deploy get instant
// cached evaluations on the bundled sample bidders without burning the
// shared API key. Turning it off is a single click in Settings; the choice
// is then persisted in localStorage.
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return true;
  const v = localStorage.getItem(KEY);
  if (v === null) return true; // never set -> default ON
  return v === '1';
}

export function setDemoMode(v: boolean): void {
  localStorage.setItem(KEY, v ? '1' : '0');
}

export function hasExplicitDemoSetting(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) !== null;
}
