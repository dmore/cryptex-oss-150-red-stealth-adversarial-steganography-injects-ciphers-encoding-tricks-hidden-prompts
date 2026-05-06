import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { featureFlags } from '$lib/config/featureFlags';

/** Diagnostic snapshot of what the build saw for the Supabase env vars.
 *  Read by the /login + /signup pages so the browser can show a precise
 *  banner ("KEY missing", "URL malformed", etc.) without forcing the user
 *  to open DevTools. The boolean values are NOT secrets — they only say
 *  whether the var was present and well-formed at build time. */
export type SupabaseConfigStatus =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'auth-flag-off'
        | 'url-missing'
        | 'key-missing'
        | 'url-malformed'
        | 'key-malformed';
      detail: string;
    };

function inspect(): SupabaseConfigStatus {
  if (!featureFlags.authEnabled) {
    return {
      ok: false,
      reason: 'auth-flag-off',
      detail: 'VITE_AUTH_ENABLED is not "true" in this build.'
    };
  }
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  if (!url || url === 'undefined') {
    return {
      ok: false,
      reason: 'url-missing',
      detail: 'PUBLIC_SUPABASE_URL was not present at build time.'
    };
  }
  if (!key || key === 'undefined') {
    return {
      ok: false,
      reason: 'key-missing',
      detail: 'PUBLIC_SUPABASE_ANON_KEY was not present at build time.'
    };
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)/i.test(url)) {
    return {
      ok: false,
      reason: 'url-malformed',
      detail: `PUBLIC_SUPABASE_URL does not look like a Supabase project URL (got: "${url.slice(0, 60)}…"). It should look like https://abcdefgh.supabase.co.`
    };
  }
  // Anon keys are JWTs (3 dot-separated base64 segments). Very loose check —
  // just enough to catch "pasted the project URL into the key field" mistakes.
  if (!/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    return {
      ok: false,
      reason: 'key-malformed',
      detail: 'PUBLIC_SUPABASE_ANON_KEY does not look like a Supabase anon JWT (should start with "eyJ" and contain two dots). Make sure you copied the "anon public" key, not the project URL or the service_role key.'
    };
  }
  return { ok: true };
}

export const supabaseConfigStatus: SupabaseConfigStatus = inspect();

/** Null when VITE_AUTH_ENABLED is off OR when the URL/KEY pair is missing
 *  / malformed. Callers MUST null-check before use; the /login + /signup
 *  pages additionally surface `supabaseConfigStatus` so the browser can
 *  explain exactly what went wrong without forcing DevTools. */
export const supabase: SupabaseClient | null = (() => {
  if (!supabaseConfigStatus.ok) {
    if (supabaseConfigStatus.reason !== 'auth-flag-off') {
      console.error(`[auth] ${supabaseConfigStatus.detail}`);
    }
    return null;
  }
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
