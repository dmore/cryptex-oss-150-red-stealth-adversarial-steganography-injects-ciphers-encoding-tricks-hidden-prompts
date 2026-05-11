import { browser } from '$app/environment';

const SOFT_QUOTA_BYTES = 4 * 1024 * 1024; // 4 MB warn
const HARD_QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB hard cap browsers enforce

/** Estimate localStorage usage (bytes) attributable to Cryptex keys. */
export function estimateUsage(): number {
  if (!browser) return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('cryptex.')) continue;
    const v = localStorage.getItem(k) ?? '';
    total += k.length + v.length;
  }
  // UTF-16 → 2 bytes per char
  return total * 2;
}

export function isOverSoftQuota(): boolean {
  return estimateUsage() > SOFT_QUOTA_BYTES;
}

export const QUOTA_SOFT = SOFT_QUOTA_BYTES;
export const QUOTA_HARD = HARD_QUOTA_BYTES;
