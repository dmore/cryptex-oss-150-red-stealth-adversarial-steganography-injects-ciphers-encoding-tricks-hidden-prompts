import { browser } from '$app/environment';
import type { ProviderRecord, ProviderId } from './types';
import { getKeyStorage } from './storage-strategy';
import { featureFlags } from '$lib/config/featureFlags';
import { session } from '$lib/auth/session.svelte';
import { listBYOKKeys, storeBYOKKey, storeBYOKKeyWithVaultKey } from '$lib/auth/key-vault';

const STORAGE_KEY = 'cryptex.providers';

// Storage selection is delegated to `storage-strategy.ts` so the user can
// flip between localStorage (default) and sessionStorage (ephemeral, opt-in
// in Settings → Security). Reads check both so a flip mid-session still
// finds existing data.
//
// SIGNED-IN PATH (auth enabled + user signed in):
//   API keys are kept ENCRYPTED in the Supabase `byok_keys` table via the
//   key-vault layer (PBKDF2 600k + AES-GCM, single salt per vault, per-row
//   IV). The `_records` $state holds the in-memory hydrated copy with
//   plaintext apiKey strings — only populated after the vault is unlocked
//   for this session. localStorage gets a STRIPPED metadata-only mirror so
//   the page can hydrate provider IDs / instance IDs / labels without an
//   unlock round-trip on first paint.
//
// UNSIGNED PATH (auth disabled OR user not signed in):
//   Current behavior preserved — plaintext JSON in localStorage (or
//   sessionStorage when the ephemeral toggle is on).

function tryGetLS(key: string): string | null {
  try {
    const primary = getKeyStorage();
    if (primary) {
      const v = primary.getItem(key);
      if (v !== null) return v;
    }
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(key);
      if (v !== null) return v;
    }
    if (typeof sessionStorage !== 'undefined') return sessionStorage.getItem(key);
  } catch { /* ignore */ }
  return null;
}

function trySetLS(key: string, value: string): void {
  try {
    const target = getKeyStorage();
    if (target) target.setItem(key, value);
  } catch { /* ignore */ }
}

/** True when this build / session should write API keys to the encrypted vault. */
function useVaultStorage(): boolean {
  return browser && featureFlags.authEnabled && session.isSignedIn;
}

/** Strip the apiKey field from a record before persisting to localStorage in
 *  the signed-in path. The record stays useful for UI hydration (provider
 *  list, labels, presets) without leaking the credential. */
function stripApiKey(rec: ProviderRecord): ProviderRecord {
  // Use a structural copy so $state mutations on the live record don't bleed
  // into the persisted blob.
  const copy = { ...rec, apiKey: '' } as ProviderRecord;
  return copy;
}

function seedInitial(): ProviderRecord[] {
  // Try to read legacy key from localStorage (works in browser and in test mocks on globalThis)
  const legacyKey = (tryGetLS('cryptex.openrouterApiKey') || '').trim();
  return [{ id: 'openrouter', apiKey: legacyKey, enabled: true }];
}

function loadPersisted(): ProviderRecord[] | null {
  const raw = tryGetLS(STORAGE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as ProviderRecord[]; } catch { return null; }
}

// Module-level state — rune-backed so Svelte components re-render on change
let _records = $state<ProviderRecord[]>(loadPersisted() ?? seedInitial());

function persist(): void {
  // Always write the FULL record (apiKey included). localStorage acts as a
  // write-ahead log: stripping the plaintext only happens AFTER a successful
  // vault write via `purgeApiKeyFromMirror(rec)`.
  //
  // Why: a previous version stripped unconditionally for signed-in users,
  // but if the vault encrypt step failed (network / vault locked / etc.),
  // the apiKey would already be gone from localStorage and only live in
  // _records (in-memory) — a single page reload would lose it. Worse, the
  // legacy-keys migration prompt found nothing because persist had already
  // run during ANY UI interaction (toggling enabled, blurring a field).
  //
  // The post-vault purge is opt-in per row, never blanket.
  trySetLS(STORAGE_KEY, JSON.stringify(_records));
}

/**
 * Strip the apiKey field for a single record from the localStorage mirror.
 * Called only after `storeBYOKKey()` confirms the encrypted ciphertext is
 * safely in the vault. The in-memory _records array keeps its apiKey for
 * the current session so the gateway keeps working.
 */
function purgeApiKeyFromMirror(matcher: (rec: ProviderRecord) => boolean): void {
  if (!useVaultStorage()) return;
  const stripped = _records.map((r) => (matcher(r) ? stripApiKey(r) : r));
  trySetLS(STORAGE_KEY, JSON.stringify(stripped));
}

// Public functions are synchronous and work in both SSR and browser environments.
// Svelte components can read _records directly via listProviders(); $state ensures
// reactive re-renders whenever a mutating function replaces the array.

export function listProviders(): ProviderRecord[] {
  return _records;
}

export function getProvider(id: ProviderId, instanceId?: string): ProviderRecord | undefined {
  return _records.find((p) => {
    if (p.id !== id) return false;
    if (id === 'openai-compat' && instanceId) return (p as { instanceId: string }).instanceId === instanceId;
    return true;
  });
}

// Lazy import to avoid circular dependency: catalog.svelte.ts imports listProviders from here.
async function triggerCatalogRefresh(): Promise<void> {
  try {
    const { refreshCatalog } = await import('./catalog.svelte');
    refreshCatalog(true).catch((err) => console.warn('[providers] catalog refresh failed:', err));
  } catch (err) {
    console.warn('[providers] could not load catalog module:', err);
  }
}

/**
 * Encrypt + store the apiKey for a single record in the byok_keys vault.
 *
 * - When `passphrase` is provided, derives a fresh key (used for the FIRST
 *   key write — seeds the canonical salt). After this call the vault key
 *   is cached in session, so subsequent calls can omit the passphrase.
 * - When `passphrase` is omitted, uses the already-cached vault key. Only
 *   works when the vault is unlocked AND has at least one existing row.
 *
 * Throws "Vault locked" / "Vault empty" / "Auth not enabled" when the
 * required preconditions aren't met. Caller should prompt for passphrase
 * and retry with the passphrase form.
 */
export async function persistKeyToVault(
  rec: ProviderRecord,
  passphrase?: string
): Promise<void> {
  if (!useVaultStorage()) return;
  const instanceId = rec.id === 'openai-compat' ? (rec as { instanceId: string }).instanceId : null;
  const label = rec.id === 'openai-compat' ? (rec as { name: string }).name : rec.id;
  if (passphrase) {
    await storeBYOKKey(rec.id, instanceId, rec.apiKey, label, passphrase);
  } else {
    await storeBYOKKeyWithVaultKey(rec.id, instanceId, rec.apiKey, label);
  }
  // Vault write succeeded → it's safe to remove the plaintext apiKey from
  // the localStorage mirror. The in-memory _records keeps its apiKey for
  // the current session so the gateway can keep using the key.
  purgeApiKeyFromMirror((r) => {
    if (r.id !== rec.id) return false;
    if (r.id === 'openai-compat') {
      return (r as { instanceId: string }).instanceId === instanceId;
    }
    return true;
  });
}

export function addProvider(record: ProviderRecord): void {
  _records = [..._records, record];
  persist();
  triggerCatalogRefresh();
}

export function updateProvider(
  id: ProviderId,
  patch: Partial<ProviderRecord>,
  instanceId?: string
): void {
  _records = _records.map((p) => {
    if (p.id !== id) return p;
    if (id === 'openai-compat' && instanceId && (p as { instanceId: string }).instanceId !== instanceId) return p;
    return { ...p, ...patch } as ProviderRecord;
  });
  persist();
  triggerCatalogRefresh();
}

export function removeProvider(id: ProviderId, instanceId?: string): void {
  _records = _records.filter((p) => {
    if (p.id !== id) return true;
    if (id === 'openai-compat' && instanceId) return (p as { instanceId: string }).instanceId !== instanceId;
    return false;
  });
  persist();
  triggerCatalogRefresh();
}

export function hasAnyKey(): boolean {
  return _records.some((p) => p.enabled && 'apiKey' in p && Boolean(p.apiKey));
}

/**
 * Hydrate records with decrypted apiKey strings from the encrypted vault.
 * Called by ProvidersPanel after the vault has been unlocked (either via
 * the AddProviderDialog passphrase prompt or an existing unlocked session).
 *
 * Strategy: fetch every byok_keys row → match against existing _records by
 * (providerId, instanceId) → fill in apiKey on the matched record. New
 * vault rows that don't have a corresponding metadata record get appended
 * (cross-device sync case: user added a key on device A; device B sees it
 * after unlock).
 */
export async function hydrateFromVault(): Promise<void> {
  if (!useVaultStorage()) return;
  const decrypted = await listBYOKKeys();
  if (decrypted.length === 0) return;

  // Match by (providerId, instanceId) — fill apiKey on existing rows.
  const next = _records.map((rec) => {
    const matchInstanceId = rec.id === 'openai-compat'
      ? (rec as { instanceId: string }).instanceId
      : null;
    const match = decrypted.find((d) => d.providerId === rec.id && d.instanceId === matchInstanceId);
    if (!match) return rec;
    return { ...rec, apiKey: match.apiKey } as ProviderRecord;
  });

  // Append vault rows that aren't reflected in _records (cross-device sync).
  for (const d of decrypted) {
    const exists = next.some((r) => {
      if (r.id !== d.providerId) return false;
      if (r.id === 'openai-compat') {
        return (r as { instanceId: string }).instanceId === d.instanceId;
      }
      return true;
    });
    if (exists) continue;
    if (d.providerId === 'openrouter' || d.providerId === 'anthropic') {
      next.push({ id: d.providerId, apiKey: d.apiKey, enabled: true } as ProviderRecord);
    }
    // openai-compat needs more metadata (baseURL, name, presetId) than the
    // vault row carries — those land via cross-device sync of the metadata
    // mirror, not the vault. Skip if the metadata isn't present locally.
  }

  _records = next;
}

/**
 * Returns true when at least one record carries a key whose plaintext is
 * still in the localStorage mirror (legacy plaintext) and could be migrated
 * to the encrypted vault. ProvidersPanel calls this on mount to show the
 * "Move keys to encrypted vault" prompt.
 */
export function hasLegacyPlaintextKeys(): boolean {
  if (!useVaultStorage()) return false;
  // Re-read raw localStorage to inspect persisted state — _records may
  // already have been stripped via persist().
  const raw = tryGetLS(STORAGE_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as ProviderRecord[];
    return parsed.some((r) => 'apiKey' in r && typeof r.apiKey === 'string' && r.apiKey.length > 0);
  } catch {
    return false;
  }
}

/**
 * Bulk-migrate any plaintext apiKey values from localStorage to the
 * encrypted vault, then strip them from the localStorage mirror. Caller
 * MUST have unlocked the vault first; the passphrase is required to
 * encrypt the new rows.
 */
export async function migrateLegacyKeysToVault(passphrase: string): Promise<number> {
  if (!useVaultStorage()) return 0;
  const raw = tryGetLS(STORAGE_KEY);
  if (!raw) return 0;
  let parsed: ProviderRecord[];
  try { parsed = JSON.parse(raw) as ProviderRecord[]; } catch { return 0; }

  let migrated = 0;
  // Surface the LAST encryption error so the UI can show something more
  // useful than the generic "No keys to migrate" when the issue is actually
  // a vault write failure (network, RLS, schema). Plaintext is preserved
  // by `persist()` either way — nothing is lost.
  let lastError: Error | null = null;
  for (const rec of parsed) {
    if (!('apiKey' in rec) || typeof rec.apiKey !== 'string' || rec.apiKey.length === 0) continue;
    const instanceId = rec.id === 'openai-compat'
      ? (rec as { instanceId: string }).instanceId
      : null;
    const label = rec.id === 'openai-compat'
      ? (rec as { name: string }).name
      : rec.id;
    try {
      await storeBYOKKey(rec.id, instanceId, rec.apiKey, label, passphrase);
      // Per-row strip — only the rows that successfully encrypted lose
      // their plaintext mirror. Failed rows keep their plaintext so the
      // user can retry without re-entering keys.
      purgeApiKeyFromMirror((r) => {
        if (r.id !== rec.id) return false;
        if (r.id === 'openai-compat') {
          return (r as { instanceId: string }).instanceId === instanceId;
        }
        return true;
      });
      migrated++;
    } catch (err) {
      lastError = err as Error;
      console.warn('[providers] migrateLegacyKeysToVault: failed to encrypt row', rec.id, err);
    }
  }

  if (migrated > 0) {
    // Refresh in-memory records from the vault so any cross-device rows
    // (e.g. keys added on a different browser) appear too.
    await hydrateFromVault();
  } else if (lastError) {
    // No rows encrypted but we DID attempt at least one — surface the
    // failure so the UI can show "Could not write to the vault" instead
    // of a confusing "no keys" message.
    throw lastError;
  }

  return migrated;
}

// Provider records are backed by $state (see _records above); Svelte components
// re-render automatically when any mutating function (addProvider, updateProvider,
// removeProvider) assigns a new array to _records.
