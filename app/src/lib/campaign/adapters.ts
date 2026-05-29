/**
 * Campaign strategy adapters — wrap each existing Cryptex attack family in
 * the uniform `CampaignStrategy` contract (see strategy.ts).
 *
 * Three archetypes, one contract:
 *   - single-local : reasoning kinds, cipher presets, response-attack,
 *                    local-template mutators. Build a prompt synchronously,
 *                    `callTarget` once, `judge`.
 *   - single-llm   : registry mutators that need an LLM to generate the
 *                    transformed prompt. `callHelper` to generate, then
 *                    `callTarget` + `judge`.
 *   - orchestrator : TAP/PAIR/Crescendo/Many-Shot. Run the existing
 *                    orchestrator (it drives its own adaptive target
 *                    conversation), extract the best prompt+response, then
 *                    re-judge with the shared judge so the orchestrator's
 *                    heuristic self-score is upgraded to the campaign verdict.
 *
 * Abliteration is deliberately NOT a campaign strategy — it's a model-
 * profiling probe suite (20 adversarial + 10 control probes), not a single-
 * goal attack. It stays a standalone tool. Do not "complete the set" by
 * adding it here.
 */
import {
  ATTACK_KIND_ROTATION,
  buildReasoningAttack,
  kindLabel,
  type ReasoningAttackKind
} from '$lib/redteam/reasoning-attack';
import { STACK_PRESETS, buildStackedCipherPayload, type CipherLayer } from '$lib/redteam/stacked-cipher';
import { buildResponseAttack, PRIMING_STYLES } from '$lib/redteam/response-attack';
import { byCategory } from '$lib/techniques/registry';
import { applyTechniqueForVariant } from '$lib/components/tools/promptcraft/strategies';
import { runTap } from '$lib/components/tools/promptcraft/orchestrators/tap';
import { runPair } from '$lib/components/tools/promptcraft/orchestrators/pair';
import { runCrescendo } from '$lib/components/tools/promptcraft/orchestrators/crescendo';
import { runManyShot } from '$lib/components/tools/promptcraft/orchestrators/many_shot';
import type { OrchestratorConfig } from '$lib/components/tools/promptcraft/orchestrators/types';
import type { CampaignStrategy } from './strategy';

const REASONING_CITATION: Record<string, string> = {
  hcot: 'arXiv:2502.12893',
  mousetrap: 'arXiv:2502.15806',
  dra: 'arXiv:2402.18104'
};

// ---------------------------------------------------------------------------
// single-local: reasoning-model attack kinds
// ---------------------------------------------------------------------------
function reasoningAdapters(): CampaignStrategy[] {
  return ATTACK_KIND_ROTATION.map((kind: ReasoningAttackKind) => ({
    id: `reasoning:${kind}`,
    label: `Reasoning · ${kindLabel(kind)}`,
    kind: 'single-local' as const,
    estimatedCalls: 1,
    citation: REASONING_CITATION[kind],
    async run(ctx) {
      const { payload } = buildReasoningAttack(ctx.goal, kind);
      const targetResponse = await ctx.callTarget([{ role: 'user', content: payload }]);
      const verdict = await ctx.judge(ctx.goal, targetResponse);
      return { payloadSent: payload, targetResponse, verdict, callCount: 1 };
    }
  }));
}

// ---------------------------------------------------------------------------
// single-local: SEAL stacked-cipher presets
// ---------------------------------------------------------------------------
function cipherAdapters(): CampaignStrategy[] {
  return STACK_PRESETS.map((preset) => ({
    id: `cipher:${preset.id}`,
    label: `Cipher · ${preset.label}`,
    kind: 'single-local' as const,
    estimatedCalls: 1,
    citation: 'arXiv:2505.16241',
    async run(ctx) {
      const { framedPrompt } = buildStackedCipherPayload(ctx.goal, preset.stack as CipherLayer[]);
      const targetResponse = await ctx.callTarget([{ role: 'user', content: framedPrompt }]);
      const verdict = await ctx.judge(ctx.goal, targetResponse);
      return { payloadSent: framedPrompt, targetResponse, verdict, callCount: 1 };
    }
  }));
}

// ---------------------------------------------------------------------------
// single-local: Response Attack priming styles (deterministic multi-turn)
// ---------------------------------------------------------------------------
function responseAttackAdapters(): CampaignStrategy[] {
  return PRIMING_STYLES.map((style) => ({
    id: `response:${style.id}`,
    label: `Response · ${style.label}`,
    kind: 'single-local' as const,
    estimatedCalls: 1,
    citation: 'arXiv:2507.21000',
    async run(ctx) {
      const built = buildResponseAttack(ctx.goal, { style: style.id });
      const targetResponse = await ctx.callTarget(built.turns);
      const verdict = await ctx.judge(ctx.goal, targetResponse);
      const payloadSent = built.turns.map((t) => `[${t.role}]\n${t.content}`).join('\n\n---\n\n');
      return { payloadSent, targetResponse, verdict, callCount: 1 };
    }
  }));
}

// ---------------------------------------------------------------------------
// single-local / single-llm: registry mutators
// ---------------------------------------------------------------------------
function mutatorAdapters(): CampaignStrategy[] {
  const mutators = byCategory('mutate').filter((t) => t.id !== 'custom'); // custom needs user input
  return mutators.map((t) => {
    const isLocal = typeof t.localTemplate === 'function';
    return {
      id: `mut:${t.id}`,
      label: `Mutate · ${t.name}`,
      kind: isLocal ? ('single-local' as const) : ('single-llm' as const),
      estimatedCalls: isLocal ? 1 : 2,
      async run(ctx) {
        const { system, user } = applyTechniqueForVariant(t.id, ctx.goal, '');
        let payload: string;
        let genCalls = 0;
        if (isLocal) {
          payload = user; // local template already applied
        } else {
          payload = await ctx.callHelper({ system, user });
          genCalls = 1;
        }
        const targetResponse = await ctx.callTarget([{ role: 'user', content: payload }]);
        const verdict = await ctx.judge(ctx.goal, targetResponse);
        return { payloadSent: payload, targetResponse, verdict, callCount: 1 + genCalls };
      }
    };
  });
}

// ---------------------------------------------------------------------------
// orchestrator: TAP / PAIR / Crescendo / Many-Shot
// ---------------------------------------------------------------------------
function orchestratorAdapters(): CampaignStrategy[] {
  const tap: CampaignStrategy = {
    id: 'orch:tap',
    label: 'Orchestrator · TAP (tree of attacks)',
    kind: 'orchestrator',
    estimatedCalls: 20,
    citation: 'arXiv:2312.02119',
    async run(ctx) {
      const config: OrchestratorConfig = {
        targetModel: ctx.targetModel,
        params: { maxDepth: 3, branchingFactor: 2, pruningThreshold: 2, baseGoal: ctx.goal }
      };
      const tree = await runTap(config, ctx.signal, () => ctx.onProgress?.('exploring tree'), ctx.vault);
      const best = tree.bestLeafId ? tree.nodes.get(tree.bestLeafId) : undefined;
      const payloadSent = best?.prompt ?? ctx.goal;
      const targetResponse = best?.response ?? '';
      const verdict = await ctx.judge(ctx.goal, targetResponse);
      return { payloadSent, targetResponse, verdict, detail: { kind: 'tap', tree }, callCount: tree.nodes.size };
    }
  };

  const pair: CampaignStrategy = {
    id: 'orch:pair',
    label: 'Orchestrator · PAIR (iterative refine)',
    kind: 'orchestrator',
    estimatedCalls: 8,
    citation: 'arXiv:2310.08419',
    async run(ctx) {
      const config: OrchestratorConfig = {
        targetModel: ctx.targetModel,
        params: { initialPrompt: ctx.goal, goal: ctx.goal, maxRounds: 4 }
      };
      const trace = await runPair(config, ctx.signal, () => ctx.onProgress?.('refining'), ctx.vault);
      const last = [...trace.steps].reverse().find((s) => s.response) ?? trace.steps[trace.steps.length - 1];
      const payloadSent = last?.prompt ?? ctx.goal;
      const targetResponse = last?.response ?? '';
      const verdict = await ctx.judge(ctx.goal, targetResponse);
      return { payloadSent, targetResponse, verdict, detail: { kind: 'pair', trace }, callCount: trace.steps.length };
    }
  };

  const crescendo: CampaignStrategy = {
    id: 'orch:crescendo',
    label: 'Orchestrator · Crescendo (escalation)',
    kind: 'orchestrator',
    estimatedCalls: 12,
    citation: 'arXiv:2404.01833',
    async run(ctx) {
      const config: OrchestratorConfig = {
        targetModel: ctx.targetModel,
        params: { goal: ctx.goal, escalationSteps: 5 }
      };
      const thread = await runCrescendo(
        config,
        ctx.signal,
        (t) => ctx.onProgress?.(`turn ${t.turns.length}`),
        ctx.vault
      );
      const lastAssistant = [...thread.turns].reverse().find((t) => t.role === 'assistant');
      const userChain = thread.turns.filter((t) => t.role === 'user').map((t) => t.text).join('\n\n');
      const targetResponse = lastAssistant?.text ?? '';
      const verdict = await ctx.judge(ctx.goal, targetResponse);
      return { payloadSent: userChain, targetResponse, verdict, detail: { kind: 'crescendo', thread }, callCount: thread.turns.length };
    }
  };

  const manyShot: CampaignStrategy = {
    id: 'orch:many_shot',
    label: 'Orchestrator · Many-Shot (context flooding)',
    kind: 'orchestrator',
    estimatedCalls: 26,
    citation: 'Anil et al. 2024',
    async run(ctx) {
      const config: OrchestratorConfig = {
        targetModel: ctx.targetModel,
        params: { finalQuery: ctx.goal, shotCount: 24 }
      };
      // Many-Shot only BUILDS the stack (it has no live-target verdict by
      // construction). The adapter sends the assembled block to the target
      // exactly once, then judges.
      const stack = await runManyShot(config, ctx.signal, () => ctx.onProgress?.('building shots'), ctx.vault);
      const assembled = stack.shots.map((s) => s.shot).join('\n\n') + '\n\n' + stack.finalQuery;
      const targetResponse = await ctx.callTarget([{ role: 'user', content: assembled }]);
      const verdict = await ctx.judge(ctx.goal, targetResponse);
      return { payloadSent: assembled, targetResponse, verdict, detail: { kind: 'many_shot', stack }, callCount: stack.shots.length + 1 };
    }
  };

  return [tap, pair, crescendo, manyShot];
}

/** Build the full set of campaign strategies (stable order). Cached per module load. */
let _all: CampaignStrategy[] | null = null;
export function allCampaignStrategies(): CampaignStrategy[] {
  if (!_all) {
    _all = [
      ...reasoningAdapters(),
      ...cipherAdapters(),
      ...responseAttackAdapters(),
      ...mutatorAdapters(),
      ...orchestratorAdapters()
    ];
  }
  return _all;
}

/**
 * Resolve a list of strategy ids to strategies, de-duplicated, in adapter
 * order. Supports:
 *   - `'*'`           → every strategy
 *   - `'reasoning:*'` → every strategy whose id starts with `reasoning:`
 *   - exact ids       → that strategy if it exists (unknown ids are dropped)
 */
export function resolveStrategies(ids: readonly string[]): CampaignStrategy[] {
  const all = allCampaignStrategies();
  if (ids.includes('*')) return [...all];

  const wanted = new Set<string>();
  for (const id of ids) {
    if (id.endsWith(':*')) {
      const prefix = id.slice(0, -1); // keep the trailing ':' → 'reasoning:'
      for (const s of all) if (s.id.startsWith(prefix)) wanted.add(s.id);
    } else {
      wanted.add(id);
    }
  }
  // Preserve adapter order, drop unknowns, de-dupe.
  return all.filter((s) => wanted.has(s.id));
}
