<script lang="ts">
  /**
   * Structured-output / control-plane attack lab (v2.7 SOTA upgrade).
   *
   * Builds the prompt-level slice of BreakFun ("Trojan Schema", arXiv:2510.17904):
   * an innocent extraction framing + a CoT distraction + a schema the model
   * auto-completes into compliance. Two kinds:
   *   - trojan-schema    (4 schema formats: JSON-Schema / Python / TS / function-call)
   *   - schema-coercion  (strict output contract; refusal = invalid output)
   *
   * Auto-pivot: if a run gets refused, rotate to the next kind and re-fire.
   *
   * EnumAttack / DictAttack (true constrained-decoding) are NOT here — the chat
   * gateway has no response_format passthrough. Deferred to v2.9.
   */
  import { onDestroy } from 'svelte';
  import { untrack } from 'svelte';
  import {
    buildStructuredOutputPayload,
    nextStructuredKind,
    kindLabel,
    kindUsesSchema,
    schemaFormatLabel,
    STRUCTURED_OUTPUT_KINDS,
    SCHEMA_FORMATS,
    type StructuredOutputKind,
    type StructuredOutputPayload,
    type StructuredOutputVaultPayload,
    type SchemaFormat
  } from '$lib/redteam/structured-output';
  import { looksRefused, scoreBypass } from '$lib/components/tools/promptcraft/orchestrators/types';
  import { chat as gatewayChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import { stripEnvelopes } from '$lib/ai/prompt-scaffold';
  import { notify } from '$lib/stores/toast.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { history } from '$lib/history/store.svelte';
  import { createVaultStore } from '$lib/vault/store.svelte';
  import { loadBundledSeeds } from '$lib/vault/seed-loader';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import VaultSection from '$lib/components/vault/VaultSection.svelte';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import ContextBridge from '$lib/components/shell/ContextBridge.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Play from 'lucide-svelte/icons/play';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import Braces from 'lucide-svelte/icons/braces';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';

  const TOOL_ID = 'structured-output';

  const vaultStore = createVaultStore<StructuredOutputVaultPayload>(
    TOOL_ID,
    loadBundledSeeds<StructuredOutputVaultPayload>(TOOL_ID)
  );

  const goal = useToolState<string>(TOOL_ID, 'goal', '');
  const kind = useToolState<StructuredOutputKind>(TOOL_ID, 'kind', 'trojan-schema');
  const schemaFormat = useToolState<SchemaFormat>(TOOL_ID, 'schemaFormat', 'json-schema');
  const cotDistraction = useToolState<boolean>(TOOL_ID, 'cotDistraction', true);
  const fieldCount = useToolState<number>(TOOL_ID, 'fieldCount', 5);
  const autoPivotMax = useToolState<number>(TOOL_ID, 'autoPivotMax', 2);

  const targetPref = createPersistedState<string>(
    'cryptex.structured-output.target',
    'openrouter:openrouter/auto'
  );

  // Debounce the goal so heavy template construction doesn't run per-keystroke.
  let debouncedGoal = $state(goal.value);
  let dt: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const next = goal.value;
    if (dt) clearTimeout(dt);
    dt = setTimeout(() => (debouncedGoal = next), 200);
    return () => {
      if (dt) clearTimeout(dt);
    };
  });
  onDestroy(() => {
    if (dt) clearTimeout(dt);
  });

  const built = $derived.by<StructuredOutputPayload>(() =>
    buildStructuredOutputPayload(debouncedGoal, kind.value, {
      schemaFormat: schemaFormat.value,
      cotDistraction: cotDistraction.value,
      fieldCount: fieldCount.value
    })
  );

  type Attempt = {
    kind: StructuredOutputKind;
    payload: string;
    reply: string;
    refused: boolean;
    score: number;
  };

  let attempts = $state<Attempt[]>([]);
  let testRunning = $state(false);
  let pivoting = $state(false);
  let testError = $state('');
  let testAbort: AbortController | null = null;
  const keyConfigured = $derived(hasApiKey());

  async function singleShot(payload: string): Promise<string> {
    if (!keyConfigured) throw new Error('No provider configured.');
    if (!payload) throw new Error('Empty payload.');
    const controller = testAbort ?? new AbortController();
    testAbort = controller;
    const r = await gatewayChat({
      model: targetPref.value,
      messages: [{ role: 'user', content: payload }],
      temperature: 0.7,
      max_tokens: 1536,
      title: 'Cryptex/StructuredOutput',
      signal: controller.signal
    });
    return stripEnvelopes(r.content ?? '');
  }

  function recordAttempt(
    attempt: Attempt,
    payload: string,
    startedAt: number,
    extra: Record<string, unknown>
  ) {
    void history.record({
      toolId: TOOL_ID,
      startedAt,
      status: 'done',
      input: payload,
      output: attempt.reply,
      params: {
        op: 'test',
        kind: attempt.kind,
        targetModel: targetPref.value,
        refused: attempt.refused,
        score: attempt.score,
        ...extra
      }
    });
  }

  async function testAgainstTarget() {
    if (!built.payload) {
      notify.error('Enter a goal first.');
      return;
    }
    if (!keyConfigured) {
      notify.error('No provider configured.');
      return;
    }
    testRunning = true;
    testError = '';
    attempts = [];
    testAbort?.abort();
    testAbort = new AbortController();

    const startedAt = Date.now();
    try {
      const reply = await singleShot(built.payload);
      const refused = looksRefused(reply);
      const score = scoreBypass(reply);
      const attempt: Attempt = { kind: kind.value, payload: built.payload, reply, refused, score };
      attempts = [attempt];
      recordAttempt(attempt, built.payload, startedAt, {
        schemaFormat: kindUsesSchema(kind.value) ? schemaFormat.value : undefined,
        cotDistraction: kindUsesSchema(kind.value) ? cotDistraction.value : undefined,
        fieldCount: kindUsesSchema(kind.value) ? fieldCount.value : undefined
      });
    } catch (err) {
      if (testAbort?.signal.aborted) return;
      testError = (err as Error).message ?? 'Test failed.';
    } finally {
      testRunning = false;
    }
  }

  async function autoPivot() {
    if (attempts.length === 0) {
      notify.error('Run a baseline first.');
      return;
    }
    if (!keyConfigured) {
      notify.error('No provider configured.');
      return;
    }
    pivoting = true;
    testError = '';
    testAbort?.abort();
    testAbort = new AbortController();

    try {
      let currentKind = attempts[attempts.length - 1].kind;
      let pivotsLeft = Math.max(1, Math.min(autoPivotMax.value, 4));

      while (
        pivotsLeft > 0 &&
        attempts.length > 0 &&
        attempts[attempts.length - 1].refused &&
        !testAbort.signal.aborted
      ) {
        const nextKind = nextStructuredKind(currentKind);
        const startedAt = Date.now();
        const newBuilt = buildStructuredOutputPayload(debouncedGoal, nextKind, {
          schemaFormat: schemaFormat.value,
          cotDistraction: cotDistraction.value,
          fieldCount: fieldCount.value
        });
        if (!newBuilt.payload) break;
        const reply = await singleShot(newBuilt.payload);
        const refused = looksRefused(reply);
        const score = scoreBypass(reply);
        const attempt: Attempt = {
          kind: nextKind,
          payload: newBuilt.payload,
          reply,
          refused,
          score
        };
        attempts = [...attempts, attempt];
        recordAttempt(attempt, newBuilt.payload, startedAt, {
          op: 'auto-pivot',
          pivotIndex: attempts.length - 1
        });
        currentKind = nextKind;
        pivotsLeft -= 1;
      }
    } catch (err) {
      if (testAbort?.signal.aborted) return;
      testError = (err as Error).message ?? 'Pivot failed.';
    } finally {
      pivoting = false;
    }
  }

  function cancelRun() {
    testAbort?.abort();
    testRunning = false;
    pivoting = false;
  }

  async function copyPayload() {
    if (!built.payload) return;
    try {
      await navigator.clipboard.writeText(built.payload);
      notify.success('Payload copied');
    } catch {
      notify.error('Clipboard write failed');
    }
  }

  function loadVaultEntry(payload: StructuredOutputVaultPayload) {
    untrack(() => {
      kind.value = payload.kind;
      goal.value = payload.exampleGoal;
      if (payload.schemaFormat) schemaFormat.value = payload.schemaFormat;
      if (payload.cotDistraction !== undefined) cotDistraction.value = payload.cotDistraction;
      if (payload.fieldCount !== undefined) fieldCount.value = payload.fieldCount;
    });
  }

  function verdictClass(refused: boolean, score: number): string {
    if (refused) return 'border-red-500/30 bg-red-500/5 text-red-400';
    if (score >= 0.75) return 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400';
    return 'border-amber-500/30 bg-amber-500/5 text-amber-400';
  }
  function verdictLabel(refused: boolean, score: number): string {
    if (refused) return 'refused';
    if (score >= 0.75) return 'complied';
    return 'partial';
  }

  const lastAttempt = $derived(attempts.length > 0 ? attempts[attempts.length - 1] : null);
  const lastWasRefused = $derived(lastAttempt?.refused ?? false);
</script>

<ToolShell
  toolId={TOOL_ID}
  title="Structured-output attack"
  accent="structured"
  description="Prompt-level BreakFun (arXiv:2510.17904). Trojan Schema decomposes a goal into schema fields the model auto-completes into compliance (JSON-Schema / Python / TypeScript / function-call); schema-coercion frames refusals as output-validation failures. Auto-pivot rotates kinds on refusal."
  usage={{
    title: 'Structured-output · Usage',
    bullets: [
      'Trojan Schema: an extraction framing + a schema the model populates; filling fields reads as formatting, not advice.',
      '4 schema surfaces: JSON-Schema draft-07, Python dataclass, TypeScript interface, function-call args.',
      'Schema-coercion: a strict output contract where prose / hedges / refusals are framed as invalid output.',
      'Test against target sends one shot; auto-pivot rotates kinds on refusal.',
      'Heuristic verdict only — confirm complied/partial replies by hand.'
    ]
  }}
>
  <div class="space-y-4">
    <NoProviderBanner context="tool" />

    <div class="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div
        class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start"
      >
        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Attack kind</span>
          <select
            bind:value={kind.value}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-xs"
          >
            {#each STRUCTURED_OUTPUT_KINDS as k}
              <option value={k}>{kindLabel(k)}</option>
            {/each}
          </select>
        </div>

        {#if kindUsesSchema(kind.value)}
          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">Schema format</span>
            <select
              bind:value={schemaFormat.value}
              class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-xs"
            >
              {#each SCHEMA_FORMATS as f}
                <option value={f}>{schemaFormatLabel(f)}</option>
              {/each}
            </select>
          </div>
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Schema fields: {fieldCount.value}</span>
            <input
              type="range"
              min="3"
              max="8"
              step="1"
              bind:value={fieldCount.value}
              class="w-full accent-primary"
            />
          </label>
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              bind:checked={cotDistraction.value}
              class="accent-primary"
            />
            CoT distraction block
          </label>
        {/if}

        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Target model</span>
          <ModelPickerV2
            value={targetPref.value}
            onChange={(v) => (targetPref.value = v)}
            recentsKey="cryptex.structured-output.recentTarget"
          />
        </div>

        <ContextBridge
          goal={goal.value}
          targetModel={targetPref.value}
          onHydrate={({ goal: g, targetModel: t }) => {
            if (g) goal.value = g;
            if (t) targetPref.value = t;
          }}
        />

        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Auto-pivot max: {autoPivotMax.value}</span>
          <input
            type="range"
            min="1"
            max="4"
            step="1"
            bind:value={autoPivotMax.value}
            class="w-full accent-primary"
          />
        </label>

        <div class="border-t border-border/40 pt-3">
          {#if testRunning || pivoting}
            <button
              type="button"
              onclick={cancelRun}
              class="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-3.5 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Loader size={14} class="animate-spin" /> Cancel
            </button>
          {:else}
            <div class="flex gap-2">
              <button
                type="button"
                onclick={testAgainstTarget}
                disabled={!built.payload || !keyConfigured}
                class="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Play size={14} /> Test
              </button>
              {#if attempts.length > 0 && lastWasRefused}
                <button
                  type="button"
                  onclick={autoPivot}
                  disabled={!keyConfigured}
                  title="Rotate attack kind and re-fire until comply or max pivots reached"
                  class="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={12} /> Auto-pivot
                </button>
              {/if}
            </div>
          {/if}
        </div>

        {#if testError}<p class="text-xs text-destructive">{testError}</p>{/if}

        <div
          class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground"
        >
          <p class="flex items-center gap-1.5">
            <Braces size={11} class="text-primary" />
            <span class="font-medium text-foreground">Control-plane framing</span>
          </p>
          <p>
            The schema makes compliance read as a formatting task. Strongest on
            models that aggressively honor structured-output and tool-call
            contracts. Pair with the <code>trojan_schema</code> mutator in
            PromptCraft for the single-prompt variant.
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Goal</span>
            <textarea
              bind:value={goal.value}
              rows="3"
              placeholder="State the underlying research or task the target should populate the schema for..."
              class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            ></textarea>
          </label>
        </div>

        {#if built.payload}
          <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-sm">Built payload · {kindLabel(kind.value)}</h2>
              <button
                type="button"
                onclick={copyPayload}
                class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy size={11} /> Copy
              </button>
            </div>
            <pre
              class="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md border border-input bg-background/40 p-3 font-mono text-[11px] text-foreground">{built.payload}</pre>
            <p class="text-[11px] italic text-muted-foreground">{built.notes}</p>
          </div>
        {/if}

        {#if attempts.length > 0}
          <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-sm">
                Run history ({attempts.length} attempt{attempts.length === 1 ? '' : 's'})
              </h2>
              {#if attempts.length > 1}
                <span class="text-[10px] uppercase tracking-wider text-muted-foreground">
                  pivot trail
                </span>
              {/if}
            </div>
            <ul class="flex flex-col gap-2">
              {#each attempts as a, idx (idx)}
                <li class="rounded-lg border border-input bg-background/70 p-2.5">
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[10px] text-muted-foreground">#{idx + 1}</span>
                    <code class="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">{a.kind}</code>
                    <span
                      class={`ml-auto rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${verdictClass(a.refused, a.score)}`}
                    >
                      {verdictLabel(a.refused, a.score)}
                    </span>
                  </div>
                  <pre
                    class="mt-1 max-h-[20vh] overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{a.reply.slice(0, 1500)}{a.reply.length > 1500 ? '\n…' : ''}</pre>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#snippet vault()}
    <VaultSection
      store={vaultStore}
      label="Structured-Output Vault"
      onUse={loadVaultEntry}
    />
  {/snippet}
</ToolShell>
