/**
 * Session activity log.
 *
 * In-memory ring buffer capturing every explicit user-triggered operation
 * across the 13 tools. Resets on page reload by design — zero disk footprint
 * for adversarial prompts. Exported to JSON or Markdown on demand so users
 * can preserve a session themselves.
 */

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
    const full: SessionEntry = {
      id: nextId++,
      timestamp: entry.timestamp ?? Date.now(),
      tool: entry.tool,
      operation: entry.operation,
      label: entry.label,
      input: entry.input ?? '',
      output: entry.output ?? '',
      options: entry.options
    };
    const next = [...entries, full];
    entries = next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next;
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
