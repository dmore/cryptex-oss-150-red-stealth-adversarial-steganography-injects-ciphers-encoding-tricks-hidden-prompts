/**
 * PromptCraft strategies — thin adapter over the chat technique registry.
 *
 * PromptCraft no longer owns its own hardcoded list of 9 strategies; instead
 * it reuses the same registry-defined mutator + composite techniques that
 * power the chat slash commands. For LLM-generative techniques,
 * `getSystemPrompt(techniqueId, customInstruction)` returns the scaffolded
 * system prompt. For local-template techniques, `applyTechniqueForVariant()`
 * applies the template locally, then sends the templated output as the user
 * message with a variation-only system prompt so PromptCraft can still
 * generate variance without forcing the meta-LLM to re-evaluate the
 * template content from scratch.
 */

import { getMutatorSpecs } from '$lib/chat/techniques/from-mutators';
import { buildMutatorSystem } from '$lib/chat/techniques/from-mutators';
import { find as findTechnique, byCategory } from '$lib/chat/techniques/registry';

/**
 * @deprecated Use `getSystemPrompt(techniqueId, customInstruction)` directly,
 * referencing any technique id from the registry (mutator or composite). The
 * old StrategyId union is preserved here for backwards-compat imports.
 */
export type StrategyId =
  | 'rephrase'
  | 'obfuscate'
  | 'roleplay'
  | 'multilingual'
  | 'expand'
  | 'compress'
  | 'metaphor'
  | 'fragment'
  | 'custom';

/**
 * @deprecated The hardcoded STRATEGIES list is retained for callers that still
 * expect a static preset. New UI should use `listPromptCraftTechniques()`.
 */
export type Strategy = { id: StrategyId; name: string; desc: string };

export const STRATEGIES: ReadonlyArray<Strategy> = Object.freeze([
  { id: 'rephrase',     name: 'Rephrase',        desc: 'Reword while preserving intent' },
  { id: 'obfuscate',    name: 'Obfuscate',       desc: 'Obscure meaning through indirection' },
  { id: 'roleplay',     name: 'Role-play wrap',  desc: 'Embed in a fictional scenario' },
  { id: 'multilingual', name: 'Multi-language',  desc: 'Mix multiple languages together' },
  { id: 'expand',       name: 'Expand',          desc: 'Elaborate with more detail and context' },
  { id: 'compress',     name: 'Compress',        desc: 'Minimize to fewest possible tokens' },
  { id: 'metaphor',     name: 'Metaphor',        desc: 'Express through analogy and metaphor' },
  { id: 'fragment',     name: 'Fragment',        desc: 'Split across disjointed fragments' },
  { id: 'custom',       name: 'Custom',          desc: 'Your own mutation instruction' }
]);

/** Shape returned by listPromptCraftTechniques() — Combobox-ready. */
export type PromptCraftTechnique = {
  id: string;
  name: string;
  desc: string;
  group: 'Mutators' | 'Composites' | 'Utility';
};

/**
 * List all registry techniques eligible for PromptCraft: mutators + composites.
 * Classifier techniques are intentionally excluded (they belong to the Anti-
 * Classifier tool). The return shape is Combobox-ready — see PromptCraftTool
 * for consumption.
 */
export function listPromptCraftTechniques(): PromptCraftTechnique[] {
  const mutators = byCategory('mutate');
  const composites = byCategory('composite');

  const out: PromptCraftTechnique[] = [];

  // Ensure 'custom' is at the top of Mutators for discoverability (it is the
  // one strategy that requires additional user input).
  const customFirst = [...mutators].sort((a, b) => (a.id === 'custom' ? -1 : b.id === 'custom' ? 1 : 0));
  for (const t of customFirst) {
    out.push({ id: t.id, name: t.name, desc: t.description, group: 'Mutators' });
  }
  for (const t of composites) {
    out.push({ id: t.id, name: t.name, desc: t.description, group: 'Composites' });
  }
  return out;
}

/**
 * Build the system prompt PromptCraft should send for a given technique id.
 *
 * - `custom` -> returns the user's own instruction text (trimmed).
 * - Any mutator id -> returns the scaffolded XML prompt from the MutatorSpec
 *   (same scaffolding used by the chat-side Technique.apply()).
 * - Any composite id -> returns a simple "rewrite using {technique.name}"
 *   instruction since composites are chains and their per-call prompts are
 *   selected internally at dispatch time.
 * - Unknown id -> empty string (caller falls back or surfaces an error).
 *
 * NOTE: for local-template techniques (roleplay, step_back, ctf_framing, ...)
 * this path returns the GENERATIVE system prompt — the one the registry uses
 * as a fallback for non-local apply. For variance generation over a
 * local-template technique, use `applyTechniqueForVariant()` instead, which
 * applies the template locally then asks the LLM only to vary the wrapping
 * context.
 */
export function getSystemPrompt(techniqueId: string, customInstruction: string): string {
  if (techniqueId === 'custom') return customInstruction.trim();

  // Mutator spec? Reconstruct the scaffolded system prompt.
  const spec = getMutatorSpecs().find((m) => m.id === techniqueId);
  if (spec) return buildMutatorSystem(spec);

  // Composite? Fall back to a concise rewrite directive.
  const t = findTechnique(techniqueId);
  if (t && t.category === 'composite') {
    return `Rewrite the user's text using the "${t.name}" technique: ${t.description} Output only the rewrite, inside <rewrite> tags.`;
  }

  // Other registry categories (classifier / transform / mode / godmode) are
  // not PromptCraft-eligible; the UI already filters them out, but we keep a
  // defensive empty-string fallback so callers can detect the mis-dispatch.
  if (t) {
    return `Rewrite the user's text using the "${t.name}" technique: ${t.description} Output only the rewrite, inside <rewrite> tags.`;
  }
  return '';
}

/**
 * Build the exact {system, user} pair PromptCraft should send for a given
 * technique + input. Correctly routes around the LLM for local-template
 * techniques:
 *
 * - Local-template technique: applies the template to the user's input
 *   locally, then asks the LLM only to produce a structural variation of
 *   the already-templated output. The user's original question stays
 *   verbatim inside the templated wrapping; only the surrounding context
 *   prose changes.
 * - LLM-generative technique: returns the scaffolded system prompt from
 *   `getSystemPrompt()` and the raw user input, preserving the prior
 *   behavior for rephrase / obfuscate / multilingual / crescendo.
 * - Unknown id: returns `{system: '', user: input}` so the caller can
 *   detect the mis-dispatch.
 *
 * This is the function PromptCraftTool.svelte should call when generating
 * variants — it correctly handles both local and generative techniques in
 * a single unified path.
 */
export function applyTechniqueForVariant(
  techniqueId: string,
  userInput: string,
  customInstruction: string
): { system: string; user: string } {
  if (techniqueId === 'custom') {
    return { system: customInstruction.trim(), user: userInput };
  }

  const technique = findTechnique(techniqueId);
  if (technique && typeof technique.localTemplate === 'function') {
    const meta: Record<string, unknown> = customInstruction.trim()
      ? { instruction: customInstruction.trim() }
      : {};
    const templated = technique.localTemplate(userInput, meta);
    return {
      system: `You will receive a template-wrapped question. Produce one variation of the wrapped version that preserves its structure (frame, register, scaffold ending) but uses different phrasing for the surrounding context. The user's original question (wherever it appears inside quotes or inline) must remain verbatim. Do not answer the question; only produce the varied wrapping. Output ONLY the variation inside <rewrite> tags.`,
      user: templated
    };
  }

  return {
    system: getSystemPrompt(techniqueId, customInstruction),
    user: userInput
  };
}
