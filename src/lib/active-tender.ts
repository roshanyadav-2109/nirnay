const KEY = 'nirnay_active_tender_id';

export function getActiveTenderId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setActiveTenderId(id: string | null): void {
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
}
