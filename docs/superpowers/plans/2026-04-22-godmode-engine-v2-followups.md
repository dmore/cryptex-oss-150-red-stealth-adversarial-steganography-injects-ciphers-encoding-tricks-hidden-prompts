# Godmode Engine v2 — Deferred Follow-ups

> Chronological plan for the 6 deferred items surfaced by the whole-implementation review of Subsystem A. Not a full superpowers plan — these are small, mostly-independent follow-ups that can land post-merge without blocking Subsystem B.

**Parent subsystem:** Subsystem A of the ULTRA-GODMODE rewire (see [`2026-04-22-godmode-engine-v2-design.md`](../specs/2026-04-22-godmode-engine-v2-design.md) and [`2026-04-22-godmode-engine-v2.md`](./2026-04-22-godmode-engine-v2.md)).

**Current state:** Subsystem A phase 1 shipped on branch `claude/nice-thompson-d2896d`. Engine reachable via direct POST to `/functions/v1/godmode-engine`, but panel not yet mounted in the chat UI. 17 commits. Final review: approve, ship-with-flag.

---

## Phase F1 — UX unblock (priority: high, ~1 day)

Goal: make Godmode reachable from the chat composer.

### F1.1 Mount `panel.svelte` in ChatComposer

**Files to modify (est):**
- `app/src/lib/components/chat/ChatComposer.svelte` (or the actual technique-dispatch site — grep to confirm)
- `app/src/lib/chat/dispatch.ts` (maybe — only if the current dispatch site routes all categories uniformly)

**What to do:**
1. Locate where the technique picker dispatches on selection. `rg "category === 'godmode'" app/src` — if no hit, the mount point is wherever `dispatch.ts` currently routes techniques. The common pattern in Svelte 5 apps is: picker sets a `$state` ref → a `{#if}` block in the composer renders the right panel.
2. Add a branch: `{#if selectedTechnique?.category === 'godmode'}<GodmodePanel />{/if}`.
3. Wire the panel's events into the chat's message timeline so the winner's response lands as an assistant message (matching how other techniques' outputs are shown). Current `panel.svelte` just logs events inline — extend it to emit a callback `onWinner(response)` that the composer subscribes to.

**Gate:** clicking the Godmode technique pill opens the panel. Running it produces a user + assistant turn in the chat, matching the UX of existing techniques.

### F1.2 Resolve `PUBLIC_GODMODE_ENGINE_ENABLED`

The env var is documented in `.env.example` but nothing reads it. Two acceptable paths:

- **(a) Wire a reader.** In `app/src/lib/chat/techniques/godmode/index.ts`:
  ```ts
  const ENABLED = import.meta.env.PUBLIC_GODMODE_ENGINE_ENABLED !== 'false';
  export const godmodes: Technique[] = ENABLED ? [engineGodmode] : [];
  ```
  This hides the technique from the picker when the flag is off — useful for CI and staging.

- **(b) Delete the var from `.env.example`.** If gating isn't needed, drop documentation to avoid confusion.

Recommendation: **(a)**, paired with F1.1 so the gate is meaningful.

**Commit both as one PR:** `feat(godmode): mount panel in composer + wire feature flag`.

---

### F1.3 Production-grade drawer UI polish

The F1 drawer (committed in `fab254a`) wires the panel correctly but is dev-grade visually: raw textarea + plain text input + JSON-dump event log. For shippable UX the drawer needs:

- **Model picker instead of text input** — reuse `ModelPickerV2.svelte` (already used by ChatHeader) with a "Godmode target model" scope + `cryptex.godmode.recentModels` recents key.
- **Event list → structured progress view** — per-candidate row showing DNA summary (mutator/classifier/wrapper IDs), running spinner → score tier badge → latency ms. `plan` / `error` / `done` events render as status strip, not dumped JSON.
- **Winner card** — dedicated block at the bottom: tier badge, response rendered with markdown + copy-to-clipboard button + "Send to composer" action (dispatches the existing `composer:insert` custom event).
- **K pill styling** — match the existing `ModePills.svelte` pattern in the composer (rounded, primary accent when selected).
- **Empty state** — while `events.length === 0 && !running`, show a brief explainer: "Type a task, pick K, run. The engine races N framings and returns the strongest response."
- **Keyboard shortcut** — `Cmd/Ctrl+Enter` in the task textarea triggers Run.
- **Status header** — while running, the sticky header shows a progress pill (e.g. `3 running · 1 scored`) so users know the request is alive even if events are slow.

**Scope:** UI-only inside `panel.svelte` + potentially extracted into smaller components (`CandidateRow.svelte`, `WinnerCard.svelte`). No changes to engine, types, or event contract.

**Effort:** ~1 day. Land as its own commit on top of F1 for a cleaner review diff.

---

## Phase F2 — Type-drift cleanup (priority: medium, ~half day)

Goal: eliminate the two "type redeclared on both sides" seams before Subsystem B extends them.

### F2.1 Unify `EngineEvent` across Deno + browser

Two deployment runtimes read the same shape:
- Server: `supabase/functions/godmode-engine/engine-core.ts` declares `EngineEvent`.
- Browser: `app/src/lib/chat/godmode/types.ts` re-declares it.

Options:

- **(a) Single source via Deno import map.** Move the canonical declaration into `app/src/lib/chat/godmode/types.ts`; have the edge function `import { type EngineEvent } from 'app-chat/godmode/types.ts'`. The `app-chat/` alias already exists in `supabase/functions/godmode-engine/deno.json`. **Cheapest fix, 2-line diff.**
- **(b) Codegen from a zod schema.** More robust but introduces a build step.
- **(c) Keep redeclared + add a structural-equality test that fails if they drift.** Lightweight guardrail, less invasive.

Recommendation: **(a)** — just remove the server-side declaration and import. Later, if the contract grows complex, consider (b).

### F2.2 Unify `DnaTuple` / `DnaTupleArr`

- Server: `supabase/functions/godmode-engine/memory.ts` declares `DnaTupleArr` (mutable).
- Browser: `app/src/lib/chat/godmode/dna.ts` declares `DnaTuple` (readonly).
- Engine-core currently bridges with `[...dnaTupleOf(r.dna)] as DnaTupleArr`.

Fix: drop `DnaTupleArr` from `memory.ts`, import `DnaTuple` from `app-chat/godmode/dna.ts`, and update `Attempt.dnaTuple: readonly DnaTuple`. Remove the spread-and-cast at the two `recordBoth` call sites in `engine-core.ts`.

**Commit both as one PR:** `refactor(godmode): unify event + dna-tuple types across runtimes`.

---

## Phase F3 — Provider expansion (priority: medium, additive, 1 day per adapter)

Goal: light up OpenRouter + OpenAI-compat providers so Godmode isn't Anthropic-only.

### F3.1 OpenRouter adapter

- Extend `index.ts::pickAnthropicKey()` → `pickProviderKey(providerId)` with env pool lookup by provider prefix (`OPENROUTER_API_KEY_N`, `OPENAI_API_KEY_N`).
- Add a provider-routing step: inspect `body.model` to decide which pool + adapter factory to use. Model-id conventions already in the app: OpenRouter model ids contain `/` (e.g. `anthropic/claude-sonnet-4.5`), Anthropic direct starts with `claude-` without slash.
- Factor `anthropicComplete` + a new `openrouterComplete` (OpenAI-compatible chat completions shape) behind a common call site. Both satisfy the existing `DispatchAdapter` interface unchanged.
- Extend `.env.example` with `OPENROUTER_API_KEY_{1..9}` pool.

### F3.2 OpenAI-compatible adapter (Groq, Together, Fireworks, etc.)

- Mirror F3.1 pattern. Read provider base URL + key from env.
- Gate by a new `model` prefix convention (e.g. `groq:llama-3.3-70b`). Match the existing app's `openai-compat:<instance>/<model>` pattern from `gateway.ts`.

**Commits:** one PR per adapter (`feat(godmode): openrouter adapter`, `feat(godmode): openai-compat adapter`). Each PR updates smoke tests with a per-provider assertion gated on provider-specific env.

---

## Phase F4 — Performance (priority: low, conditional)

Monitor first; ship only if metrics warrant.

### F4.1 Counter-based round-robin

Current: `Date.now() % pool.length` — not truly round-robin under concurrent load. Swap for:

```ts
let keyCursor = 0;
function pickAnthropicKey() {
  // ... pool collection unchanged ...
  return pool[keyCursor++ % pool.length];
}
```

**Trigger for shipping:** if per-key 429 rate exceeds 1% over a 24h window on the `attempt_memory_private` failure_reason='api_error' count.

### F4.2 `allCombinations()` memoization

`candidate-ranker.pickTopK()` calls `allCombinations()` per request — ~63K DNAs allocated each time. Cheap memoization (module-scope cache guarded by a registry version hash) would drop this to one allocation per process.

**Trigger:** server p99 latency > 200ms on ranker.

---

## Phase F5 — Task 3 carried notes (priority: low, mostly done)

From the original Task 3 review: the scorer's **regex-tier thresholds + heuristic constants are inline literals**. Hoist to module-level constants if they need tuning later:

```ts
const MIN_WORDS = 20;
const SUBSTANTIVE_WORDS = 150;
const COMPLIANT_WORDS = 400;
const HEURISTIC_LENGTH_NORMALIZER = 200;
const HEURISTIC_KEYWORD_PENALTY = 0.15;
const TIER_CUTOFFS = { refusal: 0.2, evasive: 0.4, partial: 0.6, substantive: 0.85 };
```

**Trigger:** when Task 14's smoke data shows systematic misclassification at a specific cutoff, tune that constant.

---

## Execution order (chronological)

| # | Phase | Effort | Depends on | Triggering condition |
|---|---|---|---|---|
| 1 | F1.1/F1.2 (UX unblock) | ~1 day | — | Required for user-facing launch — **LANDED in `fab254a`** |
| 2 | F1.3 (drawer UI polish) | ~1 day | F1.1/1.2 | Before external users see Godmode |
| 3 | F2 (type cleanup) | ~half day | Subsystem A merged | Before Subsystem B extends types |
| 4 | F3.1 (OpenRouter) | ~1 day | F2 | First paying customer asks for a non-Claude model |
| 5 | F3.2 (OAI-compat) | ~1 day | F3.1 | Groq/Together demand |
| 6 | F5 (scorer constants) | ~2 hours | Smoke data | Tuning-driven |
| 7 | F4.1 (round-robin) | ~1 hour | Metrics | 429 rate > 1% |
| 8 | F4.2 (memoization) | ~2 hours | Metrics | p99 > 200ms |

**Net:** phases 1–4 are the "launch path" (~3.5 days). 5–7 are data-driven tuning that happen when signals warrant.

---

## Cross-cutting hygiene

- Each phase lands as its own PR off the Subsystem A merge base, **not** stacked on this branch. Keeps Subsystem B's branch independent of follow-up noise.
- Live smoke (`godmode-engine.smoke.test.ts`) should be run after every phase lands, with the phase's env vars populated.
- Phases F1 + F2 are non-user-visible (F1 is UI wiring, F2 is refactor); F3 is additive provider support; F4 is silent perf. None should require design-spec revisions.
