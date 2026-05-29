/**
 * Campaign strategy adapter interface.
 *
 * The 26 Cryptex tools collapse into THREE strategy archetypes with
 * incompatible signatures:
 *   - single-local : pure synchronous builders (reasoning kinds, cipher
 *                     presets, response-attack, local-template mutators).
 *                     Produce a prompt; the campaign sends it + judges.
 *   - single-llm   : registry techniques whose generation needs an LLM
 *                     (a generator round-trip), then send + judge.
 *   - orchestrator : TAP/PAIR/Crescendo/Many-Shot — own their adaptive
 *                     target conversation; return a completed run whose
 *                     best prompt the campaign re-judges with the shared
 *                     judge.
 *
 * The adapter erases the difference behind ONE `run(ctx)` contract: every
 * strategy receives the target as a closure (`callTarget`) and always emits
 * the same `CampaignStrategyResult`, so the report treats all strategies
 * uniformly.
 */
import type { Judge, JudgeResult } from './judge';
import type { VaultPromoter } from '$lib/components/tools/promptcraft/orchestrators/auto-promote';

export type ChatRole = 'system' | 'user' | 'assistant';
export interface ChatTurnLite {
  role: ChatRole;
  content: string;
}

export type CampaignStrategyKind = 'single-local' | 'single-llm' | 'orchestrator';

/** Everything the runner hands a strategy. */
export interface CampaignStrategyContext {
  goal: string;
  targetModel: string;
  /**
   * Send one prompt (or a turn list) to the TARGET model and get its reply.
   * Centralizes gateway wiring, title tagging, abort, and envelope-stripping
   * so a strategy never imports the gateway directly.
   */
  callTarget: (
    messages: ChatTurnLite[],
    opts?: { temperature?: number; maxTokens?: number }
  ) => Promise<string>;
  /**
   * Helper-model call for single-llm techniques that must GENERATE the
   * transformed prompt. Routed to the generator model (defaults to target).
   */
  callHelper: (req: { system?: string; user: string; temperature?: number }) => Promise<string>;
  /** The shared judge (LLM-default, heuristic fallback). */
  judge: Judge;
  signal: AbortSignal;
  /** Optional Vault for auto-promotion of orchestrator winners. */
  vault?: VaultPromoter;
  /** Streaming hook so multi-turn strategies can surface intermediate progress. */
  onProgress?: (note: string) => void;
}

export interface CampaignStrategyResult {
  /** The exact prompt / transcript sent to the target (for the I/O pair + Vault). */
  payloadSent: string;
  /** The target's raw reply (envelope-stripped). */
  targetResponse: string;
  /** Verdict from the shared judge. */
  verdict: JudgeResult;
  /** Optional structured run (tree/trace/thread/stack) for "expand details". */
  detail?: unknown;
  /** Per-strategy target+helper call count (judge calls counted separately by the runner). */
  callCount: number;
}

export interface CampaignStrategy {
  /** Stable unique id, e.g. 'reasoning:hcot', 'cipher:classic-rot-b64', 'orch:crescendo'. */
  id: string;
  /** Human label for the report row. */
  label: string;
  kind: CampaignStrategyKind;
  /** Rough upper bound on target+helper calls, for the pre-run budget estimate. */
  estimatedCalls: number;
  /** Optional paper citation, echoed into the report + Vault. */
  citation?: string;
  run: (ctx: CampaignStrategyContext) => Promise<CampaignStrategyResult>;
}
