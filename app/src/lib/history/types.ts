/**
 * History v2 — persistent per-tool run records, searchable and replayable.
 *
 * Each ToolRun captures the inputs/outputs and metadata of a single tool
 * invocation. `inputSummary` and `outputSummary` are truncated to 2 KB each
 * so the localStorage index stays small; the full payload lives in
 * IndexedDB (or the truncated copies, if IDB is unavailable).
 */
export interface ToolRun {
  readonly id: string;
  readonly schemaVersion: 1;
  readonly toolId: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly durationMs: number;
  readonly status: 'done' | 'error' | 'cancelled';
  /** First 2 KB of input as displayable string. */
  readonly inputSummary: string;
  /** First 2 KB of output as displayable string. */
  readonly outputSummary: string;
  /** Tool params (model id, options, etc.). Small. */
  readonly params: Record<string, unknown>;
  /** Approximate full payload size (for storage management). */
  readonly sizeBytes: number;
  readonly pinned?: boolean;
  readonly annotation?: string;
  /** Optional error category if status === 'error'. */
  readonly errorCategory?: string;
  /** Optional error message if status === 'error'. */
  readonly errorMessage?: string;
}

export interface HistoryQuery {
  readonly toolId?: string;
  readonly status?: ToolRun['status'];
  readonly text?: string; // matches inputSummary/outputSummary/annotation
  readonly pinnedOnly?: boolean;
  readonly since?: number; // epoch ms
  readonly until?: number;
  readonly limit?: number;
}
