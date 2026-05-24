/**
 * Session activity log.
 *
 * In-memory ring buffer capturing every explicit user-triggered operation
 * across the 13 tools. Resets on page reload by design — zero disk footprint
 * for adversarial prompts. Exported to JSON or Markdown on demand so users
 * can preserve a session themselves.
 *
 * Wave 4.2 compat shim: every `record()` and `recordError()` call also
 * fans-out to the persistent history v2 store (`$lib/history/store.svelte`)
 * as a fire-and-forget side effect. The legacy in-memory API surface is
 * unchanged so the 13 existing callers stay working without edits.
 */
import { history } from '$lib/history/store.svelte';

export type ToolId =
  | 'transform'
  | 'decode'
  | 'emoji'
  | 'gibberish'
  | 'splitter'
  | 'tokenizer'
  | 'tokenade'
  | 'bijection'
  | 'fuzzer'
  | 'promptcraft'
  | 'anticlassifier'
  | 'translate';

export type SessionEntry = {
  id: number;
  timestamp: number;
  tool: ToolId;
  operation: string;          // 'encode' | 'decode' | 'generate' | 'translate' | 'copy' | ...
  label?: string;             // transform name, language, strategy, etc.
  input: string;
  output: string;
  options?: Record<string, unknown>;
};

const MAX_ENTRIES = 500;

let nextId = 1;
let entries = $state<SessionEntry[]>([]);

export const sessionLog = {
  /** Read-only entries, most-recent-last (chronological insertion order). */
  get entries(): ReadonlyArray<SessionEntry> { return entries; },

  /** Count of entries currently held in memory. */
  get size(): number { return entries.length; },

  /** Record a user operation. Drops oldest if ring buffer is full. */
  record(entry: Omit<SessionEntry, 'id' | 'timestamp'> & { timestamp?: number }): void {
    const timestamp = entry.timestamp ?? Date.now();
    const full: SessionEntry = {
      id: nextId++,
      timestamp,
      tool: entry.tool,
      operation: entry.operation,
      label: entry.label,
      input: entry.input ?? '',
      output: entry.output ?? '',
      options: entry.options
    };
    const next = [...entries, full];
    entries = next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;

    // Fan-out to persistent history v2. Fire-and-forget; never let a
    // history store failure (storage quota, IDB error, etc.) regress the
    // in-memory record path callers rely on.
    try {
      const params: Record<string, unknown> = { operation: entry.operation };
      if (entry.label !== undefined) params.label = entry.label;
      if (entry.options) {
        for (const [k, v] of Object.entries(entry.options)) params[k] = v;
      }
      void history.record({
        toolId: entry.tool,
        startedAt: timestamp,
        finishedAt: timestamp,
        status: 'done',
        input: full.input,
        output: full.output,
        params
      });
    } catch {
      // Swallow — legacy in-memory ring is the source of truth for this API.
    }
  },

  /**
   * Record an error entry. Used by `errorLogger.report()` for audit. Only
   * persists to history v2 — does not add to the in-memory ring (the ring
   * is for user-driven operations; errors land in History under status:'error').
   */
  recordError(entry: {
    category: string;
    message: string;
    context?: Record<string, unknown>;
    timestamp: number;
  }): void {
    try {
      const params: Record<string, unknown> = { category: entry.category };
      if (entry.context) {
        for (const [k, v] of Object.entries(entry.context)) params[k] = v;
      }
      void history.record({
        toolId: typeof params.toolId === 'string' ? (params.toolId as string) : 'system',
        startedAt: entry.timestamp,
        finishedAt: entry.timestamp,
        status: 'error',
        input: entry.message,
        output: '',
        params,
        errorCategory: entry.category,
        errorMessage: entry.message
      });
    } catch {
      // Audit failures must never crash the error logger itself.
    }
  },

  /** Clear the in-memory log. */
  clear(): void {
    entries = [];
  },

  /** Entries grouped by tool, each group sorted newest-first. */
  byTool(): Record<ToolId, SessionEntry[]> {
    const groups: Partial<Record<ToolId, SessionEntry[]>> = {};
    for (const e of entries) (groups[e.tool] ||= []).push(e);
    for (const g of Object.values(groups)) g!.sort((a, b) => b.timestamp - a.timestamp);
    return groups as Record<ToolId, SessionEntry[]>;
  },

  /** JSON export — full structure. */
  toJSON(meta: { favorites?: ReadonlyArray<string>; lastUsed?: Readonly<Record<string, number>> } = {}): string {
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        entryCount: entries.length,
        favorites: meta.favorites ?? [],
        lastUsed: meta.lastUsed ?? {},
        entries
      },
      null,
      2
    );
  },

  /** Markdown export — grouped by tool, fenced code for input/output. */
  toMarkdown(): string {
    const grouped = this.byTool();
    const toolOrder: ToolId[] = [
      'transform', 'decode', 'emoji', 'gibberish', 'splitter', 'tokenizer',
      'tokenade', 'bijection', 'fuzzer', 'promptcraft', 'anticlassifier', 'translate'
    ];

    const lines: string[] = [];
    const now = new Date();
    lines.push(`# Cryptex session · ${now.toISOString()}`, '');
    lines.push(`**${entries.length} operation${entries.length === 1 ? '' : 's'}** across ${Object.keys(grouped).length} tool${Object.keys(grouped).length === 1 ? '' : 's'}.`, '');

    for (const tool of toolOrder) {
      const items = grouped[tool];
      if (!items || items.length === 0) continue;
      const title = tool[0].toUpperCase() + tool.slice(1);
      lines.push(`## ${title} · ${items.length}`, '');
      for (const e of items) {
        const when = new Date(e.timestamp).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
        const header = e.label ? `### ${e.operation} · ${e.label} · \`${when}\`` : `### ${e.operation} · \`${when}\``;
        lines.push(header, '');
        if (e.input) {
          lines.push('**Input**', '', '```', e.input, '```', '');
        }
        if (e.output) {
          lines.push('**Output**', '', '```', e.output, '```', '');
        }
        if (e.options && Object.keys(e.options).length > 0) {
          lines.push(`**Options** · \`${JSON.stringify(e.options)}\``, '');
        }
        lines.push('---', '');
      }
    }
    return lines.join('\n');
  }
};

/**
 * Trigger a browser download for arbitrary string content. Kept here so tools
 * don't have to duplicate the Blob + a.click dance.
 */
export function downloadText(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 250);
}
