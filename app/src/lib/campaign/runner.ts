/**
 * Campaign runner — fans a goal across the selected strategies against one
 * target, judges each result with the shared judge, and streams a graded
 * report into the activeRuns store.
 *
 * Concurrency: a BOUNDED worker-pool (N workers draining one queue), NOT an
 * unbounded Promise.allSettled — an orchestrator strategy can fire dozens of
 * calls, so running every strategy at once would storm provider rate limits.
 * The pool keeps total concurrent strategies small while still completing the
 * whole list.
 *
 * Abort: one AbortController (from activeRuns) threaded into callTarget /
 * callHelper / judge / orchestrators. Cancelling marks in-flight rows
 * `skipped`, drains the queue, and starts nothing new.
 *
 * Budget: the caller computes the pre-run estimate from `estimatedCalls`
 * (see estimateCalls); the runner tracks actual target+helper+judge calls in
 * `totalCalls` for the live meter.
 */
import { activeRuns } from '$lib/stores/activeRuns.svelte';
import { history } from '$lib/history/store.svelte';
import { chat as gatewayChat } from '$lib/ai/gateway';
import { stripEnvelopes, unwrap } from '$lib/ai/prompt-scaffold';
import { makeJudge } from './judge';
import type { VaultPromoter } from '$lib/components/tools/promptcraft/orchestrators/auto-promote';
import type {
  CampaignStrategy,
  CampaignStrategyContext,
  CampaignStrategyKind,
  CampaignStrategyResult,
  ChatTurnLite
} from './strategy';

export const CAMPAIGN_TOOL_ID = 'campaign';
const DEFAULT_CONCURRENCY = 3;
const MAX_CONCURRENCY = 6;

export interface CampaignRow {
  strategyId: string;
  label: string;
  kind: CampaignStrategyKind;
  citation?: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  result?: CampaignStrategyResult;
  error?: string;
  startedAt?: number;
  finishedAt?: number;
}

export interface CampaignData {
  goal: string;
  targetModel: string;
  judgeModel: string;
  rows: CampaignRow[];
  doneCount: number;
  total: number;
  /** Actual target+helper+judge calls so far (live meter). */
  totalCalls: number;
  /** Pre-run sum of estimatedCalls (+1 judge each). */
  estTotalCalls: number;
}

export interface CampaignRunInput {
  goal: string;
  targetModel: string;
  judgeModel: string;
  /** Defaults to targetModel — single-llm techniques generate with this. */
  generatorModel?: string;
  strategies: CampaignStrategy[];
  concurrency?: number;
  vault?: VaultPromoter;
}

/** Pre-run budget estimate: sum of per-strategy estimatedCalls + 1 judge each. */
export function estimateCalls(strategies: readonly CampaignStrategy[]): number {
  return strategies.reduce((n, s) => n + s.estimatedCalls + 1, 0);
}

function summarize(data: CampaignData): string {
  const bypassed = data.rows.filter((r) => r.result?.verdict.verdict === 'bypassed').length;
  const judged = data.rows.filter((r) => r.status === 'done').length;
  const asr = judged > 0 ? Math.round((bypassed / judged) * 100) : 0;
  return `${data.doneCount}/${data.total} · ASR ${asr}% (${bypassed} bypassed)`;
}

/** Start a campaign. Returns immediately; progress streams via activeRuns. */
export function startCampaign(input: CampaignRunInput): void {
  const generatorModel = input.generatorModel ?? input.targetModel;
  const initial: CampaignData = {
    goal: input.goal,
    targetModel: input.targetModel,
    judgeModel: input.judgeModel,
    rows: input.strategies.map((s) => ({
      strategyId: s.id,
      label: s.label,
      kind: s.kind,
      citation: s.citation,
      status: 'pending'
    })),
    doneCount: 0,
    total: input.strategies.length,
    totalCalls: 0,
    estTotalCalls: estimateCalls(input.strategies)
  };

  const run = activeRuns.start<CampaignData>(CAMPAIGN_TOOL_ID, initial, `0 / ${input.strategies.length}`);
  const signal = run.controller.signal;

  const patchRow = (id: string, patch: Partial<CampaignRow>) => {
    activeRuns.update<CampaignData>(CAMPAIGN_TOOL_ID, (d) => {
      const rows = d.rows.map((r) => (r.strategyId === id ? { ...r, ...patch } : r));
      const doneCount = rows.filter((r) => r.status === 'done' || r.status === 'error' || r.status === 'skipped').length;
      return { ...d, rows, doneCount };
    });
  };
  const bumpCalls = (n: number) => {
    activeRuns.update<CampaignData>(CAMPAIGN_TOOL_ID, (d) => ({ ...d, totalCalls: d.totalCalls + n }));
  };

  const judge = makeJudge(input.judgeModel, signal);

  async function callTarget(messages: ChatTurnLite[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
    const r = await gatewayChat({
      model: input.targetModel,
      messages,
      temperature: opts?.temperature ?? 0.7,
      maxOutputTokens: opts?.maxTokens ?? 1536,
      title: 'Cryptex/Campaign/Target',
      signal
    });
    bumpCalls(1);
    return stripEnvelopes(r.content ?? '');
  }

  async function callHelper(req: { system?: string; user: string; temperature?: number }): Promise<string> {
    const messages: ChatTurnLite[] = [];
    if (req.system) messages.push({ role: 'system', content: req.system });
    messages.push({ role: 'user', content: req.user });
    const r = await gatewayChat({
      model: generatorModel,
      messages,
      temperature: req.temperature ?? 0.9,
      maxOutputTokens: 1024,
      title: 'Cryptex/Campaign/Generator',
      signal
    });
    bumpCalls(1);
    return unwrap(r.content ?? '', 'rewrite');
  }

  // Judge wrapper that also increments the live call meter.
  const judgeCounted: CampaignStrategyContext['judge'] = async (forbidden, response) => {
    const v = await judge(forbidden, response);
    bumpCalls(1);
    return v;
  };

  void (async () => {
    const queue = [...input.strategies];
    const conc = Math.min(Math.max(input.concurrency ?? DEFAULT_CONCURRENCY, 1), MAX_CONCURRENCY);

    async function worker(): Promise<void> {
      for (;;) {
        if (signal.aborted) return;
        const strat = queue.shift();
        if (!strat) return;
        patchRow(strat.id, { status: 'running', startedAt: Date.now() });
        try {
          const ctx: CampaignStrategyContext = {
            goal: input.goal,
            targetModel: input.targetModel,
            callTarget,
            callHelper,
            judge: judgeCounted,
            signal,
            vault: input.vault
            // onProgress omitted: row-level status streaming is sufficient for
            // v2.6.0; intermediate orchestrator notes are a future nicety.
          };
          const result = await strat.run(ctx);
          patchRow(strat.id, { status: 'done', result, finishedAt: Date.now() });
        } catch (err) {
          if ((err as Error)?.name === 'AbortError' || signal.aborted) {
            patchRow(strat.id, { status: 'skipped', finishedAt: Date.now() });
            return;
          }
          patchRow(strat.id, { status: 'error', error: (err as Error)?.message ?? 'strategy failed', finishedAt: Date.now() });
        }
      }
    }

    await Promise.allSettled(Array.from({ length: conc }, () => worker()));

    if (signal.aborted) {
      activeRuns.cancel(CAMPAIGN_TOOL_ID);
      return;
    }

    const data = activeRuns.get<CampaignData>(CAMPAIGN_TOOL_ID)?.data;
    if (data) {
      const bypassed = data.rows.filter((r) => r.result?.verdict.verdict === 'bypassed').length;
      void history.record({
        toolId: CAMPAIGN_TOOL_ID,
        startedAt: run.startedAt,
        status: 'done',
        input: input.goal,
        output: JSON.stringify(
          {
            target: input.targetModel,
            judge: input.judgeModel,
            asr: data.rows.length ? bypassed / data.rows.filter((r) => r.status === 'done').length || 0 : 0,
            rows: data.rows.map((r) => ({
              strategy: r.strategyId,
              status: r.status,
              verdict: r.result?.verdict.verdict,
              score: r.result?.verdict.score
            }))
          },
          null,
          2
        ),
        params: { op: 'campaign', target: input.targetModel, judge: input.judgeModel, strategies: data.total, bypassed }
      });
      activeRuns.finish(CAMPAIGN_TOOL_ID, summarize(data));
    } else {
      activeRuns.finish(CAMPAIGN_TOOL_ID);
    }
  })();
}

/** Cancel the running campaign (if any). */
export function cancelCampaign(): void {
  activeRuns.cancel(CAMPAIGN_TOOL_ID);
}
