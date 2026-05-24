/**
 * History v2 — hybrid persistent run log.
 *
 * Storage layout:
 *  - `cryptex.history.index.v2` (localStorage): array of ToolRun records with
 *    truncated input/output summaries. Used as the fast-search index.
 *  - IndexedDB `cryptex-history.runs`: full input/output payloads keyed by
 *    run id, so the index stays small and we can recover full text on demand.
 *  - `cryptex.history.fallback.v2` (localStorage): when IDB is unavailable
 *    (private mode, Safari quirks, jsdom test env), we fall back to a capped
 *    50-entry localStorage list carrying full payloads.
 *
 * The reactive `_runs` $state holds the index. Components read via
 * `history.all` (or `list()` / `search()`). Mutations persist synchronously
 * to localStorage; IDB writes are async but fire-and-forget — we don't await
 * them on the tool's hot path.
 */
import { browser } from '$app/environment';
import type { ToolRun, HistoryQuery } from './types';
import { Errors, isCryptexError } from '$lib/errors/types';
import { errorLogger } from '$lib/errors/logger';
import { isOverSoftQuota } from './quota';
import { notify } from '$lib/stores/toast.svelte';

const INDEX_KEY = 'cryptex.history.index.v2';
const LS_FALLBACK_KEY = 'cryptex.history.fallback.v2';
const LS_FALLBACK_CAP = 50;
const IDB_NAME = 'cryptex-history';
const IDB_STORE = 'runs';

/** True if IndexedDB is reachable in this browser. */
let _idbProbed = false;
let _idbAvailable = false;

async function probeIdb(): Promise<boolean> {
  if (_idbProbed) return _idbAvailable;
  _idbProbed = true;
  if (!browser || typeof indexedDB === 'undefined') {
    _idbAvailable = false;
    return false;
  }
  try {
    const req = indexedDB.open(IDB_NAME, 1);
    await new Promise<void>((res, rej) => {
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        req.result.close();
        res();
      };
      req.onerror = () => rej(req.error);
    });
    _idbAvailable = true;
  } catch {
    _idbAvailable = false;
  }
  return _idbAvailable;
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

function loadIndex(): ToolRun[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ToolRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIndex(index: ToolRun[]): void {
  if (!browser) return;
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    errorLogger.report(
      isCryptexError(err) ? err : Errors.storageQuota('History index full.', err)
    );
  }
}

function loadFallback(): ToolRun[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(LS_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ToolRun[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFallback(runs: ToolRun[]): void {
  if (!browser) return;
  const trimmed = runs.slice(0, LS_FALLBACK_CAP);
  try {
    localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(trimmed));
  } catch (err) {
    errorLogger.report(
      isCryptexError(err) ? err : Errors.storageQuota('History fallback full.', err)
    );
  }
}

let _runs = $state<ToolRun[]>(loadIndex());

/**
 * One-shot toast guard: once we warn the user we've crossed the soft cap,
 * don't pester them again this session. Reset on full clear() so a fresh
 * session can warn again.
 */
let _quotaToastFired = false;

function genId(): string {
  return `r_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function truncate(s: string, max = 2048): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

export interface RecordInput {
  toolId: string;
  startedAt: number;
  finishedAt?: number;
  status: ToolRun['status'];
  input: string;
  output: string;
  params: Record<string, unknown>;
  errorCategory?: string;
  errorMessage?: string;
}

export async function record(init: RecordInput): Promise<ToolRun> {
  const finishedAt = init.finishedAt ?? Date.now();
  const sizeBytes = (init.input.length + init.output.length) * 2;
  const run: ToolRun = {
    id: genId(),
    schemaVersion: 1,
    toolId: init.toolId,
    startedAt: init.startedAt,
    finishedAt,
    durationMs: finishedAt - init.startedAt,
    status: init.status,
    inputSummary: truncate(init.input),
    outputSummary: truncate(init.output),
    params: init.params,
    sizeBytes,
    errorCategory: init.errorCategory,
    errorMessage: init.errorMessage
  };
  _runs = [run, ..._runs];
  saveIndex(_runs);

  // Persist full payload to IDB if available
  if (await probeIdb()) {
    try {
      const db = await openIdb();
      await new Promise<void>((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put({ id: run.id, input: init.input, output: init.output });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    } catch (err) {
      errorLogger.report(err, { toast: false });
    }
  } else {
    // Fallback: cap at 50 entries, store full input/output in the summary fields
    // so getPayload() can hand them back without losing data.
    const cur = loadFallback();
    saveFallback([
      { ...run, inputSummary: init.input, outputSummary: init.output },
      ...cur
    ]);
  }

  // Auto-prune oldest non-pinned if soft quota exceeded
  if (isOverSoftQuota() && _runs.length > 200) {
    const pinned = _runs.filter((r) => r.pinned);
    const unpinned = _runs.filter((r) => !r.pinned).slice(0, 150);
    _runs = [...pinned, ...unpinned].sort((a, b) => b.startedAt - a.startedAt);
    saveIndex(_runs);
    // One soft-cap warning per session — auto-prune just fired and we are
    // still over the cap (pinned runs alone can exceed it).
    if (!_quotaToastFired && isOverSoftQuota()) {
      _quotaToastFired = true;
      try {
        notify.warn('History over soft cap — auto-pruned to 150 latest unpinned runs.');
      } catch {
        // Toast store may be unreachable in non-browser test envs; ignore.
      }
    }
  }

  return run;
}

export function list(toolId?: string, limit = 100): ToolRun[] {
  let out = _runs;
  if (toolId) out = out.filter((r) => r.toolId === toolId);
  return out.slice(0, limit);
}

export function search(q: HistoryQuery): ToolRun[] {
  let out = _runs;
  if (q.toolId) out = out.filter((r) => r.toolId === q.toolId);
  if (q.status) out = out.filter((r) => r.status === q.status);
  if (q.pinnedOnly) out = out.filter((r) => r.pinned);
  if (q.since !== undefined) {
    const since = q.since;
    out = out.filter((r) => r.startedAt >= since);
  }
  if (q.until !== undefined) {
    const until = q.until;
    out = out.filter((r) => r.startedAt <= until);
  }
  if (q.text) {
    const n = q.text.toLowerCase();
    out = out.filter((r) =>
      [r.inputSummary, r.outputSummary, r.annotation ?? ''].some((s) =>
        s.toLowerCase().includes(n)
      )
    );
  }
  return out.slice(0, q.limit ?? 200);
}

/** Load the full payload (from IDB or fallback). */
export async function getPayload(id: string): Promise<{ input: string; output: string } | null> {
  if (await probeIdb()) {
    try {
      const db = await openIdb();
      const result = await new Promise<{
        id: string;
        input: string;
        output: string;
      } | null>((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(id);
        req.onsuccess = () =>
          res(
            (req.result as { id: string; input: string; output: string } | undefined) ?? null
          );
        req.onerror = () => rej(req.error);
      });
      db.close();
      if (result) return { input: result.input, output: result.output };
    } catch (err) {
      errorLogger.report(err, { toast: false });
    }
  }
  // Fallback: read full payload from the side-table (we stash uncut text there).
  const fb = loadFallback().find((r) => r.id === id);
  if (fb) {
    return {
      input: fb.inputSummary.replace(/…$/, ''),
      output: fb.outputSummary.replace(/…$/, '')
    };
  }
  return null;
}

export function pin(id: string): void {
  const idx = _runs.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const cur = _runs[idx];
  const next = [..._runs];
  next[idx] = { ...cur, pinned: !cur.pinned };
  _runs = next;
  saveIndex(_runs);
}

export function annotate(id: string, text: string): void {
  const idx = _runs.findIndex((r) => r.id === id);
  if (idx < 0) return;
  const next = [..._runs];
  next[idx] = { ..._runs[idx], annotation: text || undefined };
  _runs = next;
  saveIndex(_runs);
}

export function clear(toolId?: string): void {
  if (!toolId) {
    _runs = [];
    saveIndex([]);
    if (browser) localStorage.removeItem(LS_FALLBACK_KEY);
    return;
  }
  _runs = _runs.filter((r) => r.toolId !== toolId);
  saveIndex(_runs);
}

export function exportJson(): string {
  return JSON.stringify(_runs, null, 2);
}

/**
 * Markdown export — grouped by toolId, newest-first within each group.
 * Mirrors the legacy sessionLog.toMarkdown() shape so users can keep using
 * the same destination format after the migration.
 */
export function exportMarkdown(): string {
  const grouped: Record<string, ToolRun[]> = {};
  for (const r of _runs) (grouped[r.toolId] ||= []).push(r);
  for (const g of Object.values(grouped)) g.sort((a, b) => b.startedAt - a.startedAt);

  const lines: string[] = [];
  const now = new Date();
  lines.push(`# Cryptex history · ${now.toISOString()}`, '');
  const toolCount = Object.keys(grouped).length;
  lines.push(
    `**${_runs.length} run${_runs.length === 1 ? '' : 's'}** across ${toolCount} tool${toolCount === 1 ? '' : 's'}.`,
    ''
  );
  for (const [toolId, items] of Object.entries(grouped)) {
    lines.push(`## ${toolId} · ${items.length}`, '');
    for (const r of items) {
      const when = new Date(r.startedAt).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
      const op =
        typeof r.params.operation === 'string'
          ? (r.params.operation as string)
          : r.status;
      const label = typeof r.params.label === 'string' ? ` · ${r.params.label}` : '';
      lines.push(`### ${op}${label} · \`${when}\` · ${r.status}`, '');
      if (r.pinned) lines.push('_pinned_', '');
      if (r.annotation) lines.push(`> ${r.annotation}`, '');
      if (r.inputSummary) {
        lines.push('**Input**', '', '```', r.inputSummary, '```', '');
      }
      if (r.outputSummary) {
        lines.push('**Output**', '', '```', r.outputSummary, '```', '');
      }
      if (r.errorMessage) {
        lines.push(`**Error** · \`${r.errorCategory ?? 'unknown'}\` — ${r.errorMessage}`, '');
      }
      const ps = { ...r.params } as Record<string, unknown>;
      delete ps.operation;
      delete ps.label;
      if (Object.keys(ps).length > 0) {
        lines.push(`**Params** · \`${JSON.stringify(ps)}\``, '');
      }
      lines.push('---', '');
    }
  }
  return lines.join('\n');
}

/** Reset module state — TEST-ONLY. Production code should never call this. */
export function _resetForTests(): void {
  _runs = [];
  _idbProbed = false;
  _idbAvailable = false;
  _quotaToastFired = false;
  if (browser) {
    localStorage.removeItem(INDEX_KEY);
    localStorage.removeItem(LS_FALLBACK_KEY);
  }
}

/** Reactive accessor for components. */
export const history = {
  get all(): ToolRun[] {
    return _runs;
  },
  record,
  list,
  search,
  getPayload,
  pin,
  annotate,
  clear,
  exportJson,
  exportMarkdown
};
