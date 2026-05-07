const KEY = 'nirnay_demo_mode';

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEY) === '1';
}

export function setDemoMode(v: boolean): void {
  localStorage.setItem(KEY, v ? '1' : '0');
}
