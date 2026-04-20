// In-memory rate limiter scoped to a single function instance.
// For production, Supabase recommends upstash/redis; this is the v1 floor.
const buckets = new Map<string, number[]>();
const MAX_BUCKETS = 10_000;

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const stamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= max) {
    buckets.set(key, stamps);
    return false;
  }
  stamps.push(now);
  buckets.set(key, stamps);
  // LRU-ish cap: if we blew past the ceiling, evict the oldest key.
  if (buckets.size > MAX_BUCKETS) {
    const firstKey = buckets.keys().next().value;
    if (firstKey !== undefined) buckets.delete(firstKey);
  }
  return true;
}
