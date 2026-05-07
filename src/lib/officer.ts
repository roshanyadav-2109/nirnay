const KEY = 'nirnay_officer_name';
const FALLBACK = 'officer';

export function getOfficerName(): string {
  if (typeof window === 'undefined') return FALLBACK;
  const v = localStorage.getItem(KEY);
  return v && v.trim() ? v.trim() : FALLBACK;
}

export function setOfficerName(name: string): void {
  const v = name.trim();
  if (!v) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, v);
}

export function hasOfficerName(): boolean {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(KEY);
  return !!(v && v.trim());
}
