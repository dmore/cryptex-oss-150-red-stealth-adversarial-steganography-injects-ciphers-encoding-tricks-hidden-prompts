# Godmode Engine v2 — Design Spec

**Date:** 2026-04-22
**Subsystem:** A (first of five in the ULTRA-GODMODE rewire; see `GODMODE-rewire.md` for the source blueprint)
**Status:** Design — awaiting user review before plan
**Authors:** brainstormed with superpowers:brainstorming

---

## 1. Purpose

Replace the current `godmode` technique stub (`app/src/lib/chat/techniques/godmode/jb_v0_stub.ts`) with a server-side engine that, per authenticated paid request:

1. Generates K ranked candidate prompts from a composable "TechniqueDNA" grammar drawn from the existing technique registry (162 transformers + 9 mutators + 9 classifiers + 3 modes + composites + 3 new prefill entries).
2. Dispatches all K candidates in parallel through a server-owned provider-key pool.
3. Scores each response through a tiered hybrid detector (regex fast path + Haiku 4.5 judge for borderline cases).
4. Writes outcomes to two-ring Postgres memory — per-user private + anonymized global — so rankings compound across attempts.
5. Streams progress + the winner back to the browser over SSE.

This design covers **Subsystem A phase 1 only**. Subsystems B (Prompt Synthesizer), C (Attempt Memory), D (Custom-prompt UI + API), and E (Streaming polish) are out of scope except where A defines contracts they consume.

## 2. Non-goals

- Attack Chain (`attack-chain.ts`) UX and orchestration are not modified. Existing layered chain stays exactly as-is.
- The 162 transformers, 9 mutators, 9 classifiers, 3 modes, and all composites are not modified. Engine consumes them by registry ID.
- No new chat-streaming transport work. SSE for godmode is greenfield; the broken chat-streaming path (Subsystem E) uses the same primitive later but is not fixed here.
- No mutation/retry rounds across candidate batches. Phase 1 is single-round render-all; mutation lands in phase 2 without schema change.
- No embedding-based task clustering. Memory keys are shallow `(model_family, dna_tuple)` only.

## 3. Design decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| D1 | Godmode v2 ships as a **new technique row + `/godmode` slash command** alongside the existing Attack Chain. Attack Chain UX untouched. | Preserves manual-chain users while delivering one-click engine experience. |
| D2 | Technique vocabulary = **tuple of existing registry IDs** + 3 new prefill entries + 1 new composite (`base64_smuggle`) + temperature as a first-class DNA field. | Inherits the `033328c` shibboleth-purge automatically. Subsystem B can inject new registry rows without touching engine code. |
| D3 | Execution is **server-only** in a new Supabase edge function `godmode-engine`. Provider keys vaulted in env (`OPENROUTER_API_KEY_N`, `ANTHROPIC_API_KEY_N`). Paid-auth only via existing `requirePaid`. | Matches "secure API-style scalable service" brief. BYOK browser keys stay for all other tools (README promise intact for everything except godmode). |
| D4 | **Candidate budget = user-selectable K slider** (3 / 6 / 12, default medium=6). **Dispatch policy = render-all** per round. | Blueprint-faithful. Maximum user transparency on cost. |
| D5 | **Scoring = tiered enum** `{refusal, evasive, partial, substantive, compliant}`. **Detection = hybrid** regex fast path → Haiku 4.5 judge on borderline. **`attack-chain-refusal.ts` is extended in place** (new `scoreResponse()` export; existing `detectRefusal()` becomes a thin wrapper). | Five buckets = enough resolution to rank, not so much that false precision leaks into memory. Single source of truth for refusal patterns. |
| D6 | **Memory key = shallow** `(model_family, dna_tuple)` where `dna_tuple = (mutatorId, classifierId, wrapperId, modeId, prefillId, tempBucket)`. **Policy = two-ring**: per-user private table + anonymized global table. User-private writes include task text; global writes never include task text or user id. | Matches blueprint logic, zero embedding infra, defensible privacy stance. |

## 4. Architecture

```
Browser                                  Supabase Edge Function                     Postgres
───────                                  ──────────────────────                     ────────
/godmode panel                           godmode-engine/
  ├─ slider (K=3/6/12)  ──POST──►          ├─ index.ts  (HTTP + SSE + auth)         attempt_memory_private
  ├─ target-model picker                    ├─ engine-core.ts                         (per-user, task text kept)
  ├─ task input              ◄──SSE──      ├─ candidate-ranker.ts
  └─ live candidate stream                 ├─ dna.ts  (schema + composer)            attempt_memory_global
                                           ├─ dispatcher.ts                            (anon, no task, no user id)
                                           ├─ scorer.ts
                                           ├─ memory.ts                              custom_techniques
                                           └─ _shared/judge.ts                        (added in A, populated by B)
```

## 5. Module responsibilities

### Server side — `supabase/functions/godmode-engine/`

| Module | Exports | Responsibilities |
|---|---|---|
| `index.ts` | HTTP handler | Auth (`requirePaid`), rate limit (`rateLimit(userId, 60, 60_000)`), parse + validate body, open SSE, invoke `engine-core.run()`, forward `EngineEvent`s as SSE lines, detect client disconnect → cancel. |
| `engine-core.ts` | `run({task, K, model, userId, adapters, memory}) → AsyncIterable<EngineEvent>` | Pure orchestrator. Fetches memory rows, calls ranker → dispatcher → scorer, writes memory, emits events. Takes adapters + memory as dependency-injected ports (for test isolation). |
| `dna.ts` | `TechniqueDNA`, `allCombinations()`, `render(dna, task)` | Defines the DNA schema. Composes prompts by calling `buildMutatorSystemById`, `buildClassifierSystemById`, composite builders from the registry. Returns `{systemPrompt, prefillMessages, userMessage, temperature}`. |
| `candidate-ranker.ts` | `pickTopK(memory, K, modelFamily) → TechniqueDNA[]` | Queries memory (private + global), scores each DNA = `0.7 × privateRate + 0.3 × globalRate + explorationBonus`, applies diversity filter (no two candidates share the same framing axis), returns top K. |
| `dispatcher.ts` | `dispatchParallel(dnas, task, adapter, onEvent) → AttemptResult[]` | Renders K DNAs, fires K API calls via shared provider adapters, enforces 30s per-call timeout, yields per-candidate start/fail/complete events, supports `AbortSignal` for graceful cancel. |
| `scorer.ts` | `score(response, task, judgeClient) → {tier, score, confidence}` | Thin wrapper over `app/src/lib/chat/attack-chain-refusal.ts::scoreResponse()`. Fast-path regex → borderline → judge call → fallback to heuristic if judge fails. |
| `memory.ts` | `queryUser(userId, modelFamily)`, `queryGlobal(modelFamily)`, `recordBoth(userId, modelFamily, dna, tier, score, failureReason)` | Two-ring Postgres. Single transaction per attempt writes one row to each table. |
| `_shared/judge.ts` | `classifyWithJudge(response, task) → {tier, reason}` | Haiku 4.5 call with JSON-schema output. Used by `scorer.ts` for borderline-only. |

### Shared with the SvelteKit app (imported, not duplicated)

| Path | Change |
|---|---|
| `app/src/lib/chat/techniques/registry.ts` | **Extended by one line.** `build()` spreads in `...prefillTechniques()` alongside the existing six sources. No structural change; registry continues to be the single aggregation point. |
| `app/src/lib/chat/techniques/from-prefills.ts` | **New.** Exports 3 prefill techniques (`prefill_agreement`, `prefill_developer_override`, `prefill_roleplay`). Each returns `{role, content}[]` pair injected before the task in API messages. Strings pass the `033328c` Cherny-minimal purge criteria. |
| `app/src/lib/chat/techniques/from-composites.ts` | **Extended.** Adds `base64_smuggle` composite = existing `encoding/base64` transformer + decoder-framing classifier text. |
| `app/src/lib/chat/attack-chain-refusal.ts` | **Extended.** New exports: `scoreResponse(text, task?, judgeClient?) → Promise<ScoredResponse>`, `REFUSAL_TIERS`, `heuristicQualityScore(text)`. Existing `detectRefusal()` becomes `return (await scoreResponse(text)).tier === 'refusal'`. |
| `app/src/lib/ai/adapters/*` | **Unchanged.** Imported server-side via Deno `npm:` specifier. |

### Browser side — `app/src/lib/chat/godmode/`

| Path | Change |
|---|---|
| `jb_v0_stub.ts` | **Deleted.** |
| `index.ts` | Rewritten. Exports `godmodes = [engineBackedGodmode]` where `engineBackedGodmode.dispatch` posts to the edge function via `client.ts::runGodmode()`. |
| `client.ts` | **New.** ~60 lines. `runGodmode({task, K, model, signal}) → AsyncIterable<EngineEvent>`. Uses `fetch` + `ReadableStream` for cancel-ability (not `EventSource`). Parses SSE lines, validates event schema version. |
| `panel.svelte` | **New.** Small picker surface for the technique row: K slider (3/6/12 pills), target model selector (reuses `$lib/ai/catalog.svelte.ts`), live candidate-status display. |
| `__tests__/dna.test.ts` | **New.** `allCombinations()` count, render stability, tuple hash stability. |
| `__tests__/scorer.test.ts` | **New.** Fast-path regex tiers, borderline routing, heuristic fallback. |
| `__tests__/client.test.ts` | **New.** SSE parsing with mocked fetch, failure-mode handling. |

## 6. Data model

### DNA schema

```ts
type TempBucket = 'low' | 'med' | 'high'; // → 0.3 / 0.7 / 1.3 concrete values

interface TechniqueDNA {
  mutatorId: string | null;      // registry ID from from-mutators.ts or null
  classifierId: string | null;   // registry ID from from-classifier.ts or null
  wrapperId: string | null;      // transformer ID (e.g. 'encoding/base64') or composite ID or null
  modeId: string | null;         // registry ID from modes/ or null
  prefillId: string | null;      // registry ID from from-prefills.ts or null
  tempBucket: TempBucket;
  source: 'builtin' | 'custom';  // discriminator for Subsystem B integration
}

type DnaTuple = [
  mutatorId: string,    // '' for null
  classifierId: string,
  wrapperId: string,
  modeId: string,
  prefillId: string,
  tempBucket: TempBucket,
  source: 'builtin' | 'custom',
];
```

Null-DNA (all fields null) is a valid candidate — represents "bare task with no framing" as a control baseline.

### Combination cardinality

`allCombinations()` = `(9+1) × (9+1) × (162+5+1) × (3+1) × (3+1) × 3 × 1` ≈ **400 000** `builtin` DNAs. Ranker + diversity filter cuts this to K per request. Memory stores only DNAs that actually ran.

### Postgres schemas

```sql
-- Migration: 20260422_000001_godmode_memory.sql

CREATE TABLE attempt_memory_private (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_family    TEXT NOT NULL,           -- 'claude' | 'gpt' | 'gemini' | 'llama' | 'kimi' | 'unknown'
  mutator_id      TEXT NOT NULL DEFAULT '',
  classifier_id   TEXT NOT NULL DEFAULT '',
  wrapper_id      TEXT NOT NULL DEFAULT '',
  mode_id         TEXT NOT NULL DEFAULT '',
  prefill_id      TEXT NOT NULL DEFAULT '',
  temp_bucket     TEXT NOT NULL,           -- 'low' | 'med' | 'high'
  technique_source TEXT NOT NULL DEFAULT 'builtin', -- 'builtin' | 'custom'
  task_text       TEXT,                    -- nullable for forward-compat; phase-1 always populated. Subsystem D may add a per-user opt-out toggle that writes NULL here.
  tier            TEXT NOT NULL,           -- 'refusal'|'evasive'|'partial'|'substantive'|'compliant'
  score_numeric   REAL NOT NULL,           -- 0.0–1.0, derived from tier + latency
  failure_reason  TEXT,                    -- nullable; 'timeout'|'api_error'|'cancelled' when infra failed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '90 days')
);

CREATE INDEX idx_priv_user_model_dna ON attempt_memory_private
  (user_id, model_family, mutator_id, classifier_id, wrapper_id, mode_id, prefill_id, temp_bucket)
  WHERE failure_reason IS NULL;

CREATE INDEX idx_priv_expires ON attempt_memory_private (expires_at);

CREATE TABLE attempt_memory_global (
  id              BIGSERIAL PRIMARY KEY,
  model_family    TEXT NOT NULL,
  mutator_id      TEXT NOT NULL DEFAULT '',
  classifier_id   TEXT NOT NULL DEFAULT '',
  wrapper_id      TEXT NOT NULL DEFAULT '',
  mode_id         TEXT NOT NULL DEFAULT '',
  prefill_id      TEXT NOT NULL DEFAULT '',
  temp_bucket     TEXT NOT NULL,
  technique_source TEXT NOT NULL DEFAULT 'builtin',
  tier            TEXT NOT NULL,
  score_numeric   REAL NOT NULL,
  failure_reason  TEXT,
  created_day     DATE NOT NULL DEFAULT CURRENT_DATE  -- day-granularity only, not a full timestamp
  -- NOTE: no user_id column. Defense-in-depth against PII leaks.
  -- NOTE: no task_text column. Defense-in-depth.
);

CREATE INDEX idx_glob_model_dna ON attempt_memory_global
  (model_family, mutator_id, classifier_id, wrapper_id, mode_id, prefill_id, temp_bucket)
  WHERE failure_reason IS NULL;

-- Daily cron job deletes rows from attempt_memory_private where expires_at < now().
-- Global table has no expiration.

CREATE TABLE custom_techniques (
  -- Stub for Subsystem B. Rows are empty in phase 1. Engine reads from it on every run
  -- so Subsystem B can drop rows in without engine code changes.
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL,        -- 'mutator' | 'classifier' | 'prefill' | 'wrapper' | 'mode'
  owner_user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public       BOOLEAN NOT NULL DEFAULT false,
  system_prompt   TEXT,                 -- for mutator/classifier/mode/prefill
  user_message    TEXT,                 -- for wrapper with {task} placeholder
  prefill_pair    JSONB,                -- for prefill: {role,content}[] pair
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### SSE event vocabulary

```ts
type EngineEvent =
  | { v: 1; type: 'plan';              dnas: TechniqueDNA[] }
  | { v: 1; type: 'candidate_started'; idx: number; dna: TechniqueDNA }
  | { v: 1; type: 'candidate_failed';  idx: number; reason: 'timeout'|'api_error'|'cancelled'; detail?: string }
  | { v: 1; type: 'candidate_scored';  idx: number; tier: RefusalTier; score: number; preview: string; confidence: 'high'|'low' }
  | { v: 1; type: 'winner';            idx: number; response: string; dna: TechniqueDNA; tier: RefusalTier; attempts: number }
  | { v: 1; type: 'done' }
  | { v: 1; type: 'error';             code: string; message: string };
```

## 7. Request lifecycle

Happy path, K=6, medium slider, Claude target:

1. Browser POSTs `{task, K, model, slider}` + Supabase session JWT.
2. Edge function: `requirePaid()` → userId. `rateLimit(userId, 60, 60_000)` → 429 if exceeded.
3. Resolve provider adapter + key from env pool (round-robin by `Date.now() % N`).
4. Set SSE headers; open `ReadableStream`.
5. `memory.queryUser(userId, 'claude')` + `memory.queryGlobal('claude')` in parallel.
6. `candidate-ranker.pickTopK(memoryRows, 6, 'claude')` — diversity-filtered.
7. Emit `plan {dnas}`.
8. `dispatcher.dispatchParallel(dnas, task, adapter, emit)`:
   - For each `dna`, render `{systemPrompt, prefill, userMessage, temperature}` via `dna.render()`.
   - Fire provider API call with 30s timeout.
   - On start: emit `candidate_started {idx, dna}`.
   - On response: `scorer.score(response, task, judgeClient)` → `{tier, score, confidence}`.
   - On complete: emit `candidate_scored {idx, tier, score, preview, confidence}`. `recordBoth(...)` fires in the background (not awaited before next event).
   - On timeout: emit `candidate_failed {idx, reason: 'timeout'}`. `recordBoth(...)` with `failure_reason` set.
9. After all K settled (or any scored `compliant`): pick winner by `(-tierRank, latencyMs)`. Emit `winner {idx, response, dna, tier, attempts}`.
10. Emit `done`. Close stream.

Client disconnect mid-flight: AbortController on the ReadableStream → dispatcher cancels in-flight requests → memory rows for completed attempts are still persisted; in-flight ones are not.

## 8. Failure modes

| Failure | Where | Handling |
|---|---|---|
| Auth missing / not paid | `requirePaid()` | 401 before any cost. |
| Rate limit | `rateLimit()` | 429 before any LLM call. |
| All env keys 401 | adapter init | Emit `error {code: 'no_provider_key'}`, close SSE. |
| Single API call 500/timeout | dispatcher per-task | Catch, emit `candidate_failed`, siblings unaffected, `recordBoth(failure_reason=...)`. |
| Judge call fails | `scorer.ts` | Fallback `heuristicQualityScore()`; emit `candidate_scored {confidence: 'low'}`. |
| Stream disconnects | client abort | Server detects closed controller, cancels pending dispatcher tasks, persists completed memory rows only. |
| All K fail infra-level | `engine-core` | Emit `error {code: 'all_failed'}`, `done`. No winner. |
| All K refuse (no infra failure) | `engine-core` | Normal winner event with best-available `tier`. Memory rows written — ranker learns this pool is weak for this model. |
| Malformed body | index.ts validation | 400 before any cost. |
| Invalid `model` id | adapter resolution | 400. Empty validation list is conservative; accept only models present in `catalog.svelte.ts`. |

## 9. Testing strategy

### Unit (pure logic, no I/O) — Vitest in `app/src/lib/chat/godmode/__tests__/`
- `dna.ts`: render stability, allCombinations cardinality, tuple hash determinism.
- `scorer.ts`: regex-path tier assignment for 20+ fixture responses; borderline routing; heuristic fallback.
- `candidate-ranker.ts`: cold-start returns diverse candidates via exploration bonus; non-cold-start honors memory; diversity filter prevents same-framing duplicates.

### Unit (edge function) — `deno test` in `supabase/functions/godmode-engine/__tests__/`
- `engine-core.ts` with mocked adapter + stub memory: event ordering, cancellation propagation, winner selection tie-breakers.
- `memory.ts` against local Postgres: `recordBoth` writes exactly one row per table, anon table never contains task text or user id (schema + code-level assertion), TTL column populated.
- SSE round-trip: event stream encodes + decodes correctly.

### Integration — Vitest in `app/src/lib/chat/godmode/__tests__/client.test.ts`
- `runGodmode()` parses mixed success + failure events.
- `AbortController` cancellation propagates to fetch.
- Missing-event types surface as `error` code.

### Live smoke — extends existing smoke harness from commit `c77ab12`
- Manual-run only in phase 1 (costs real $).
- Lives at `app/src/lib/chat/techniques/__tests__/smoke/godmode-engine.smoke.test.ts` (alongside the existing `live.smoke.test.ts`, matching vitest + `.skipIf()` convention — the plan's stub reference to `tests/live-smoke/` predates that harness location).
- Hits deployed edge function with a borderline prompt. Asserts only **code-path** invariants: SSE sequence well-formed (`plan` first, ≥K `candidate_started`, at least one `candidate_scored|candidate_failed`, terminating `done`). Winner tier is **logged, not asserted** — per commit `f656622` ("silent-refusal is data, not test failure"), model behavior is a data point, not a pass/fail criterion.
- Run: `cd app && LIVE_SMOKE=1 TEST_PAID_JWT=<token> PUBLIC_SUPABASE_URL=<url> npm run test:unit -- --run src/lib/chat/techniques/__tests__/smoke/godmode-engine.smoke.test.ts`. Skips cleanly if any of the three env vars is unset.

### Critical tests that must exist before merge
1. `dna.allCombinations()` cardinality matches formula.
2. Scorer parity with `attack-chain-refusal.detectRefusal()` on its existing fixtures.
3. Ranker cold-start correctness.
4. Dispatcher cancellation does not corrupt siblings.
5. Memory writes: anon row has no task text, no user id. Private row has task text.
6. SSE disconnect persists completed attempts, drops in-flight.

## 10. Deprecation + migration

Single atomic PR. No gradual rollout; feature flag optional via `PUBLIC_GODMODE_ENGINE_ENABLED` env var defaulting `true` in prod, `false` in CI.

Steps:
1. Add migration `supabase/migrations/20260422_000001_godmode_memory.sql`.
2. Create `supabase/functions/godmode-engine/`.
3. Create `app/src/lib/chat/techniques/from-prefills.ts`.
4. Extend `app/src/lib/chat/techniques/from-composites.ts` with `base64_smuggle`.
5. Merge `prefillTechniques()` into `registry.ts::build()`.
6. Extend `app/src/lib/chat/attack-chain-refusal.ts` with `scoreResponse()`, `REFUSAL_TIERS`, `heuristicQualityScore()`. Rewrite `detectRefusal()` as a wrapper.
7. Delete `app/src/lib/chat/techniques/godmode/jb_v0_stub.ts`.
8. Rewrite `app/src/lib/chat/techniques/godmode/index.ts` to export the engine-backed technique.
9. Add `app/src/lib/chat/godmode/client.ts` and `panel.svelte`.
10. Deploy edge function + run migration. Browser-side change lands in same PR.

`supabase/functions/godmode-prompt/` stays alongside `godmode-engine/` — it will be repurposed by Subsystem D to serve user-custom GODMODE prompts. Not deleted in this PR.

## 11. Subsystem B integration contract

When Subsystem B (Prompt Synthesizer) ships it must not touch Subsystem A code. The contract:

- B writes new technique rows into `custom_techniques` via Subsystem D's UI (admin endpoint).
- Engine's `dna.ts::allCombinations()` reads the static registry AND `SELECT * FROM custom_techniques WHERE owner_user_id = $userId OR is_public = true` per request. Merge happens at run time.
- DNAs sourced from `custom_techniques` carry `source: 'custom'`. Memory key includes `source` discriminator so memory compounds correctly per technique origin.
- Ranker applies a small cold-start exploration bonus to `source: 'custom'` entries so newly-published techniques get tried.

This contract requires only **one additive code change** when B lands: the `allCombinations()` database read. Everything else — schema, memory keys, ranker, scorer — is already A-complete.

## 12. Open items for the plan

These are implementation details, not design questions. They belong in the plan, not further brainstorming:

- Exact Cherny-minimal strings for the 3 prefill techniques. Needs a short review loop against the commit `033328c` purge criteria.
- Exact judge prompt for Haiku 4.5. Five-tier JSON-schema output; need one-page prompt.
- Concrete `score_numeric` formula (currently: `tier_ordinal × 0.2 + (1 − latency_normalized) × 0.05`).
- Exploration-bonus constant in ranker.
- Round-robin pool size for env keys (start with N=3).
- Exact rate-limit numbers (current `godmode-prompt` is 60/60s; keep parity).

## 13. References

- `GODMODE-rewire.md` — source blueprint (Python-style; this spec ports principles, not code).
- `templates/hermes-agent/` — inspiration for gateway patterns; no code imported.
- `app/src/lib/chat/attack-chain.ts` — unchanged, shows existing retry semantics.
- `app/src/lib/chat/attack-chain-refusal.ts` — extended in place (see §5).
- `app/src/lib/chat/techniques/registry.ts` — vocabulary source of truth.
- `supabase/functions/godmode-prompt/index.ts` — reused `requirePaid` + `rateLimit` patterns.
- Commit `033328c` — "neutralize shibboleth-laden defaults" — the single most important prior lesson encoded in this design.
- Commits `a47e00a`, `8d14b87`, `f656622` — refusal-detector tightening history that `scoreResponse()` inherits.
