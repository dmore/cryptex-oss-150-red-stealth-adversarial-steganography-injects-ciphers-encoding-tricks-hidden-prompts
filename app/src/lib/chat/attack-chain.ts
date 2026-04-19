import type { TechniqueContext } from './techniques/types';
import { buildMutatorSystemById } from './techniques/from-mutators';
import { detectRefusal } from './attack-chain-refusal';

export type LayerResultRow = {
  layerIndex: number;
  /** Retry index within the same layer slot. 0 = first attempt (the user's
   *  picked technique), 1+ = fallback retries triggered by refusal detection. */
  attempt?: number;
  techniqueId: string;
  techniqueName: string;
  input: string;
  output: string;
  startedAt: number;
  durationMs: number;
  error?: string;
  finalPrompt?: string;
};

export type FinalExecutionOptions = {
  enabled: boolean;
  systemPrompt?: string; // optional system message for the final turn
};

export type RetryOptions = {
  enabled: boolean;
  /** Hard cap on attempts per layer (including the primary). Default 4. */
  maxAttemptsPerLayer?: number;
};

/**
 * Curated fallback order — techniques most likely to bypass 2026-trained
 * refusals, ordered by expected effectiveness. When auto-retry is on and a
 * layer's output is detected as a refusal, the runner walks this list
 * (skipping the already-tried primary) to pick the next technique.
 *
 * IDs here must exist in the registry (see from-mutators.ts + from-classifier.ts).
 */
const FALLBACK_ORDER: readonly string[] = [
  'academic_framing',       // classifier technique — strong across models
  'roleplay',               // literary persona
  'red_team_persona',       // authorized security practitioner framing
  'ctf_framing',            // concrete CTF event
  'step_back',              // principle-first
  'rfc_style',              // technical specification framing
  'chain_of_verification',  // draft + verify + synthesize
  'hypothetical_world',     // fictional universe
  'in_context_compliance',  // many-shot priming
  'deep_inception',         // nested narrative
  'payload_split',          // semantic decomposition
  'json_schema_coerce',     // strict output schema
  'rephrase',
  'obfuscate',
  'fragment',
  'technical_register',     // classifier — scientific register
  'semantic_decomposition'  // classifier — functional decomposition
];

/**
 * Build the exact scaffolded system+user prompt that `runChain` would pass
 * to the LLM for a given technique + input + metadata. Used by the UI's
 * "Preview final prompt" / "show prompt" affordances.
 *
 * Returns null for techniques whose prompt is dynamically assembled and
 * cannot be cheaply previewed — currently cipher_encode_bypass, composites,
 * and classifier techniques (which live outside the mutator spec table).
 */
export function buildLayerPrompt(
  techniqueId: string,
  input: string,
  metadata: Record<string, unknown> = {}
): string | null {
  const system = buildMutatorSystemById(techniqueId, metadata);
  if (!system) return null;
  return `SYSTEM:\n${system}\n\nUSER:\n${input}`;
}

/**
 * Run a layered technique chain. `layerMetadata[i]` merges into the per-layer
 * ctx.metadata (allowing per-layer persona / event / chain overrides);
 * `layerOverrides[i]` (when non-null) replaces the input to layer i,
 * enabling the user to edit an intermediate output and re-run from there.
 *
 * When `retry.enabled`, the runner checks each layer's output for refusal
 * signals (see attack-chain-refusal.ts) and, on detection, re-runs the layer
 * with the next technique from FALLBACK_ORDER — up to `maxAttemptsPerLayer`.
 * Each attempt yields its own row (with `attempt` incremented) so the UI can
 * show the retry history; only the successful (non-refusal) attempt's output
 * is forwarded to the next layer.
 */
export async function* runChain(
  input: string,
  layerIds: string[],
  layerMetadata: Array<Record<string, unknown>>,
  ctx: TechniqueContext,
  signal: AbortSignal,
  layerOverrides?: Array<string | null>,
  finalExecution?: FinalExecutionOptions,
  retry?: RetryOptions
): AsyncGenerator<LayerResultRow> {
  // Dynamic import to avoid circular deps with the registry module
  const { find } = await import('./techniques/registry');

  const maxAttempts = Math.max(1, retry?.maxAttemptsPerLayer ?? 4);
  const retryEnabled = retry?.enabled ?? false;

  // Techniques already tried across the whole chain — we don't repeat them on
  // retry even for a later layer, since the same technique producing a
  // refusal once is unlikely to succeed on a similar input.
  const tried = new Set<string>();

  let current = input;

  for (let i = 0; i < layerIds.length; i++) {
    if (signal.aborted) return;

    const primaryId = layerIds[i];

    // User-supplied override for this layer's input (e.g. after editing the
    // previous layer's output). Non-empty strings replace `current`.
    const override = layerOverrides?.[i];
    if (typeof override === 'string' && override.length > 0) {
      current = override;
    }

    const meta = { ...(ctx.metadata ?? {}), ...(layerMetadata[i] ?? {}) };
    const layerCtx: TechniqueContext = { ...ctx, metadata: meta, signal };

    // Build the attempt sequence: primary first, then fallbacks that aren't
    // already tried elsewhere in the chain and aren't the primary itself.
    const fallbacks = retryEnabled
      ? FALLBACK_ORDER.filter((id) => id !== primaryId && !tried.has(id))
      : [];
    const attempts = [primaryId, ...fallbacks].slice(0, maxAttempts);

    let layerResolved = false;

    for (let a = 0; a < attempts.length; a++) {
      if (signal.aborted) return;

      const attemptId = attempts[a];
      tried.add(attemptId);
      const t = find(attemptId);
      const startedAt = Date.now();

      if (!t) {
        yield {
          layerIndex: i,
          attempt: a,
          techniqueId: attemptId,
          techniqueName: attemptId,
          input: current,
          output: '',
          startedAt,
          durationMs: 0,
          error: 'technique not found'
        };
        continue; // try next fallback
      }

      const finalPrompt = buildLayerPrompt(attemptId, current, meta) ?? undefined;

      try {
        const r = await t.apply(current, layerCtx);
        const refusal = detectRefusal(r.output);
        const durationMs = Date.now() - startedAt;

        if (refusal.detected && retryEnabled && a < attempts.length - 1) {
          // Surface this attempt so the UI can show the retry history, but
          // mark it as a refusal and continue to the next fallback.
          yield {
            layerIndex: i,
            attempt: a,
            techniqueId: attemptId,
            techniqueName: t.name,
            input: current,
            output: r.output,
            startedAt,
            durationMs,
            error: `refusal detected (${refusal.reason}) — retrying with fallback technique`,
            finalPrompt
          };
          continue;
        }

        // Success path (or refusal but we exhausted attempts — either way,
        // emit the final row and move on so the user can see what happened).
        yield {
          layerIndex: i,
          attempt: a,
          techniqueId: attemptId,
          techniqueName: t.name,
          input: current,
          output: r.output,
          startedAt,
          durationMs,
          error: refusal.detected ? `refusal detected (${refusal.reason}) — fallbacks exhausted` : undefined,
          finalPrompt
        };
        if (!refusal.detected) {
          current = r.output;
          layerResolved = true;
        }
        break;
      } catch (err) {
        yield {
          layerIndex: i,
          attempt: a,
          techniqueId: attemptId,
          techniqueName: t.name,
          input: current,
          output: '',
          startedAt,
          durationMs: Date.now() - startedAt,
          error: (err as Error).message,
          finalPrompt
        };
        if (!retryEnabled || a >= attempts.length - 1) return;
        // Otherwise fall through to the next attempt.
      }
    }

    if (!layerResolved) {
      // Every attempt either errored or returned a refusal — abort the chain
      // rather than propagating garbage to the next layer.
      return;
    }
  }

  // After all mutator layers succeed (no abort, no early-return error),
  // optionally fire one more isolated LLM call that passes the fully-mutated
  // prompt as user content plus an optional system header. This captures the
  // target model's actual response — bypassing chat history so prior refusal
  // context can't re-pollute the call.
  if (finalExecution?.enabled && !signal.aborted) {
    const startedAt = Date.now();
    try {
      const response = await ctx.callLLM({
        system: finalExecution.systemPrompt,
        user: current
      });
      yield {
        layerIndex: layerIds.length,
        techniqueId: '__execute__',
        techniqueName: 'Model response',
        input: current,
        output: response,
        startedAt,
        durationMs: Date.now() - startedAt
      };
    } catch (err) {
      yield {
        layerIndex: layerIds.length,
        techniqueId: '__execute__',
        techniqueName: 'Model response',
        input: current,
        output: '',
        startedAt,
        durationMs: Date.now() - startedAt,
        error: (err as Error).message
      };
    }
  }
}
