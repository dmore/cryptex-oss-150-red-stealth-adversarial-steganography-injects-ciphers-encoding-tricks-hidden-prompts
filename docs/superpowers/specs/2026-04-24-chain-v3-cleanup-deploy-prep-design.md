# Chain v3 Cleanup + Deploy Prep Design

**Status:** Approved, ready for implementation plan.
**Context:** The Chain Orchestrator v3 work landed 26 commits on master. This task removes the dead code the final reviewer flagged, refreshes stale comments, rewrites the in-app Chain user guide for v3, hardens `.gitignore`, validates the CI-equivalent matrix still passes, and pushes to `origin/master` to trigger auto-deploy to GitHub Pages.

## Goal

Ship the v3 Chain branch to production via the existing `.github/workflows/deploy.yml` → GitHub Pages pipeline WITHOUT breaking it. Leave the repository in a tidy state: no dead symbols, no stale doc references to deleted files, no scratch-file pollution in `git status`.

## Non-goals

- New feature work.
- Pre-existing test flake remediation beyond what's needed to land a green CI run (fix-skip-quarantine ladder below).
- Docker image publishing (`docker.yml` builds + smoke-tests the container but does not push).
- User-facing migration UX for old persisted sessions (Dexie v4 backfill from Task 1 already handles this).

---

## Section 1 — Validated dead code removal

Each deletion is gated by a `grep` validation step executed BEFORE the removal. If grep surfaces any live consumer outside the deletion set, halt and escalate.

| # | Artifact | Validation command | Live-consumer policy |
|---|---|---|---|
| 1a | `app/src/lib/chat/customPresets.svelte.ts` | `grep -rn "customPresets" app/src` | Hits must be limited to the file itself + its test |
| 1b | `app/src/lib/chat/__tests__/customPresets.test.ts` | (paired with 1a) | — |
| 2 | `runOrchestrator` export + `OrchestratorContext` type in `app/src/lib/chat/chain/orchestrator.ts` | `grep -rn "runOrchestrator\|OrchestratorContext" app/src` | Hits must be limited to `orchestrator.ts` + `orchestrator.test.ts` (where `AttackSessionContext` is imported directly, so `OrchestratorContext` should surface zero hits) |
| 3 | `OrchEvent` variant `'pivoted'` — delete the union member in `types.ts`, the engine emission in `orchestrator.ts`, the no-op case in `AttackChainTab.svelte`'s `applyEvent` | `grep -rn "'pivoted'" app/src` and `grep -rn "type: 'pivoted'" app/src` | Internal-only expected |

All four land in **one commit**: `chore(chain): remove dead code flagged by v3 review`. Commit body enumerates the grep results to document the validation that gated each removal.

**Risk check**: After deletion, `npm run check` and the chain test suite must still be green (52/52). If they aren't, restore the deletion that broke them and escalate.

---

## Section 2 — Stale comment + guide rewrite

### 2a. Source-file comment refresh

- `app/src/lib/chat/attack-chain-refusal.ts` — header JSDoc currently claims consumers: `attack-chain.ts`, `LayerResult.svelte`, `live.smoke.test.ts` + self. First two are deleted. Rewrite to list actual consumers: `orchestrator-score.ts` (via `scoreResponse`), `techniques/__tests__/anti-trigger.test.ts`, `techniques/__tests__/prompt-style.test.ts`, `techniques/__tests__/smoke/live.smoke.test.ts`, Godmode, self.
- `app/src/lib/chat/__tests__/attack-chain-refusal.test.ts` — if header comment parrots the stale list, apply the same refresh.

### 2b. In-app user guide rewrite (v3 Chain architecture)

Seven files under `app/src/lib/guide/chat/` contain ~129 total references to v1/v2 layer-stacking terminology. Treatment varies by density:

| File | Ref count | Treatment |
|---|---|---|
| `attack-chain.md` | 30 | **Full rewrite.** New content describes the v3 engine: objective-first flow, 12-strategy rotation order, 3-turn Crescendo per strategy, refineTurn LLM polish, template fallback, dossier phase (only when browsing model picked), engine-controlled termination, send-to-main-chat promote. ~250 words. |
| `attack-chain-recipes.md` | 27 | **Full rewrite.** 3 v3-era recipes: (i) simple run with aligned target model, (ii) sonar-reasoning-pro orchestrator with dossier, (iii) high-attempts mode + hints. Drops all layer-stacking recipes. |
| `orchestrating-jailbreaks.md` | 19 | **Targeted update** — replace layer-specific sections with strategy-rotation + Crescendo-escalation descriptions; keep conceptual content (shibboleth avoidance, persona strength, etc.). |
| `refusal-troubleshooting.md` | 11 | **Targeted update** — add new v3 symptoms: "orchestrator LLM refused, attack still ran via template", "dossier_failed in error banner" → fixes. |
| `technique-catalog.md` | 19 | **Verify only** — techniques are still the 160-transform registry + 12 strategies + 9 mutators; this file may be mostly accurate already. Fix refs to deleted items only. |
| `chat-basics.md` | 1 | **Drive-by** — single stale ref, fix in place. |
| `slash-commands.md` | 3 | **Drive-by** — verify refs. |

### 2c. Root-level docs drive-by

- `docs/CHAT-PLAYGROUND.md` — if it mentions Chain, update to v3.
- `docs/UI-COMPONENTS.md` — same.
- Others under `docs/*.md` — grep for "attack-chain", "layer-stack", "runChain" and update any hits.

Commits in Section 2:

1. `chore(chain): refresh stale source comments for post-v3 consumers`
2. `docs(guide): rewrite v3 Chain user guide`  (attack-chain.md + attack-chain-recipes.md)
3. `docs(guide): targeted update of orchestration + troubleshooting` (orchestrating-jailbreaks.md + refusal-troubleshooting.md + catalog fixes + drive-bys)
4. `docs: refresh root-level Chain mentions` (if anything surfaces)

---

## Section 3 — `.gitignore` hardening + untracked file triage

### Added to `.gitignore`

```
# graphify knowledge-graph cache
graphify-out/
.graphify_detect.json
.graphify_python

# playwright-mcp local session state
.playwright-mcp/

# local scratch research notes
GODMODE-rewire.md
Offense-Defense-reseasrch.md
```

### Untracked file disposition

| Path | Action | Rationale |
|---|---|---|
| `.playwright-mcp/` | gitignore | Local MCP state |
| `graphify-out/` | gitignore | Local knowledge-graph cache |
| `.graphify_detect.json`, `.graphify_python` | gitignore | Local graphify scratch |
| `GODMODE-rewire.md`, `Offense-Defense-reseasrch.md` | gitignore + leave on disk | User's local scratch; neither is structured enough to belong in docs/ |
| `docs/superpowers/plans/2026-04-18-byok-gateway-plan.md` | LEAVE UNTRACKED (user decides later) | Predates v2; was not part of v2 or v3 workflow |
| `templates/hermes-agent/` | LEAVE UNTRACKED | Unknown — appears to be user-authored work-in-progress unrelated to this cleanup |

Commit: `chore: gitignore graphify + playwright-mcp + local scratch notes`.

---

## Section 4 — CI/deploy verification

### Pre-push matrix (executed locally, matching `.github/workflows/deploy.yml`)

1. `npm ci` at repo root
2. `npm run test:all` — legacy transformer tests (4 files)
3. `cd app; npm ci`
4. `cd app; npm run test:unit` — full Vitest suite
5. `cd app; npm run check` — svelte-check (must be 0 errors)
6. `cd app; npm run build` — SvelteKit production build
7. Verify: `app/build/index.html`, `app/build/gibberish/index.html`, `app/build/favicon.svg` all exist

### Flake handling ladder

If step 4 surfaces failures:

1. **(a) Fix the root cause.** Preferred. Most Dexie isolation issues in this codebase are one-line fixes (`vi.resetModules()` / `indexedDB.deleteDatabase()` in `beforeEach`). A 2-line fix applied to the failing file is acceptable.
2. **(b) Skip with tracking note.** If the root cause is genuinely non-trivial (e.g. requires Godmode subsystem rework), mark the specific test with `.skip` + a TODO comment pointing at a follow-up note. Skipped tests don't fail CI.
3. **(c) Quarantine via env gate.** Only if (a) and (b) aren't appropriate — wrap the whole file with a conditional `describe.skipIf(process.env.VITEST_CI_STRICT === '1')` and document the rationale. Not preferred.

Budget: ≤ 4 tests may be touched this way. If more than 4 fail, pause and reassess — that's a signal I'm missing something structural.

Commit (if any CI fixes): `ci: stabilize <specific tests> for deploy pipeline`.

### Docker pipeline sanity

`.github/workflows/docker.yml` is path-filtered; it will fire since we touch `app/**`. Validation:
- `docker-compose.yml` + `Dockerfile` + `nginx.conf` still reference only paths that exist post-cleanup (no references to deleted components etc.).
- Grep for legacy component names in Docker assets to rule out.
- No need to run `docker build` locally — CI validates.

No commits expected in this section unless Docker config references a deleted path.

---

## Section 5 — README update

Single-line addition to the feature table at `README.md:28-42`, inserted between existing rows:

```
| **Chain Orchestrator** | Engine-driven multi-turn red-team loop — 12 strategies × Crescendo escalation, optional dossier phase when orchestrator model has native web browsing (Perplexity Sonar / :online variants / Grok-4 / Gemini 2.5 / 3 / GPT-5 Pro), engine-controlled termination. Fails gracefully to template fallback on LLM refusal. |
```

Optionally add a brief `### 5. Chain Orchestrator — autonomous multi-turn jailbreak` recipe to the "Example red-team workflows" section if time allows; skip if not.

Commit: `docs: add Chain Orchestrator row to README`.

---

## Section 6 — Final commit sequence + push

Target sequence, in order:

1. `chore(chain): remove dead code flagged by v3 review`
2. `chore(chain): refresh stale source comments for post-v3 consumers`
3. `docs(guide): rewrite v3 Chain user guide`
4. `docs(guide): targeted update of orchestration + troubleshooting`
5. `chore: gitignore graphify + playwright-mcp + local scratch notes`
6. `docs: refresh root-level Chain mentions` (optional — only if Section 2c surfaces hits)
7. `ci: <flake fix>` (optional — only if Section 4 surfaces failures)
8. `docs: add Chain Orchestrator row to README`

Final step: `git push origin master`. Auto-deploy workflow fires.

Post-push validation:
- Watch `gh run list --workflow=deploy.yml --limit 1` for the new run.
- If build fails: diagnose via `gh run view --log-failed`, fix, push, repeat.
- If build passes: GitHub Pages deployment is automatic. The URL pattern is `https://m4xx101101.github.io/cryptex/` per the repo name.
- Docker workflow runs in parallel; check its status too.

---

## File surface summary

### Modified (no deletions)
- `app/src/lib/chat/attack-chain-refusal.ts` — JSDoc refresh
- `app/src/lib/chat/__tests__/attack-chain-refusal.test.ts` — JSDoc refresh if needed
- `app/src/lib/chat/types.ts` — drop `pivoted` OrchEvent variant
- `app/src/lib/chat/chain/orchestrator.ts` — drop `runOrchestrator` alias, `OrchestratorContext` type, and `pivoted` emission
- `app/src/lib/components/chat/attack-chain/AttackChainTab.svelte` — drop `pivoted` no-op case
- `app/src/lib/guide/chat/attack-chain.md` — full rewrite
- `app/src/lib/guide/chat/attack-chain-recipes.md` — full rewrite
- `app/src/lib/guide/chat/orchestrating-jailbreaks.md` — targeted update
- `app/src/lib/guide/chat/refusal-troubleshooting.md` — targeted update
- `app/src/lib/guide/chat/technique-catalog.md` — targeted update (if needed)
- `app/src/lib/guide/chat/chat-basics.md` — drive-by
- `app/src/lib/guide/chat/slash-commands.md` — drive-by
- `.gitignore`
- `README.md`
- Up to 4 app tests (Section 4 flakes if surfaced)
- Root docs (only if Section 2c surfaces hits)

### Deleted
- `app/src/lib/chat/customPresets.svelte.ts`
- `app/src/lib/chat/__tests__/customPresets.test.ts`

### Scope coverage

| Requirement | Implementing section |
|---|---|
| Remove dead code after validation | Section 1 |
| Refresh stale comments | Section 2a |
| Rewrite in-app user guide for v3 | Section 2b |
| Root docs refresh | Section 2c |
| Gitignore scratch noise | Section 3 |
| CI green before push | Section 4 |
| README reflects v3 Chain | Section 5 |
| Ship to GitHub Pages | Section 6 |

## Out of scope

- Any new feature work.
- Performance polish (e.g. debouncing Dexie writes in `AttackChainTab.svelte`) — flagged as a v3 follow-up.
- Engine follow-ups (stream-error circuit breaker, multi-model support, cost budgets).
- Docker image publishing / registry push.
- Moving `GODMODE-rewire.md` / `Offense-Defense-reseasrch.md` into tracked docs (left as local-only scratch).
- Fixing `docs/superpowers/plans/2026-04-18-byok-gateway-plan.md`'s tracking state (left to user discretion).
