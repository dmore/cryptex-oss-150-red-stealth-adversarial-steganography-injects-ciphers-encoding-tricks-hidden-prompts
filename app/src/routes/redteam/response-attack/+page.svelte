<script lang="ts">
  /**
   * Response Attack lab (v2.2 Wave 10.7).
   *
   * Implementation of arXiv 2507.21000 (AAAI 2026): "Response Attack:
   * Exploiting Contextual Priming to Jailbreak Large Language Models".
   * Crafts a fake prior assistant turn that primes compliance, then sends
   * the on-goal user query. Reported 94.8% ASR; beat PAIR / ActorAttack /
   * CodeAttack baselines.
   */
  import { onDestroy, untrack } from 'svelte';
  import {
    buildResponseAttack,
    type PrimingStyle,
    type ResponseAttackTurns,
    type ResponseAttackVaultPayload
  } from '$lib/redteam/response-attack';
  import { looksRefused, scoreBypass } from '$lib/components/tools/promptcraft/orchestrators/types';
  import { chat as gatewayChat, hasAnyKey as hasApiKey } from '$lib/ai/gateway';
  import { notify } from '$lib/stores/toast.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { history } from '$lib/history/store.svelte';
  import { createVaultStore } from '$lib/vault/store.svelte';
  import { loadBundledSeeds } from '$lib/vault/seed-loader';
  import { createPersistedState } from '$lib/stores/_persisted.svelte';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import VaultSection from '$lib/components/vault/VaultSection.svelte';
  import ModelPickerV2 from '$lib/components/ai/ModelPickerV2.svelte';
  import NoProviderBanner from '$lib/components/ai/NoProviderBanner.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Play from 'lucide-svelte/icons/play';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import MessageSquareText from 'lucide-svelte/icons/message-square-text';

  const TOOL_ID = 'response-attack';

  const vaultStore = createVaultStore<ResponseAttackVaultPayload>(
    TOOL_ID,
    loadBundledSeeds<ResponseAttackVaultPayload>(TOOL_ID)
  );

  const goal = useToolState<string>(TOOL_ID, 'goal', '');
  const style = useToolState<PrimingStyle>(TOOL_ID, 'style', 'thorough');
  const targetPref = createPersistedState<string>(
    'cryptex.response-attack.target',
    'openrouter:openrouter/auto'
  );

  // Debounce goal so the priming turn doesn't rebuild on every keystroke.
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

  const built = $derived<ResponseAttackTurns>(buildResponseAttack(debouncedGoal, style.value));

  let testRunning = $state(false);
  let testReply = $state('');
  let testError = $state('');
  let testAbort: AbortController | null = null;
  const keyConfigured = $derived(hasApiKey());

  async function testAgainstTarget() {
    if (!built.userQuery) {
      notify.error('Enter a goal first.');
      return;
    }
    if (!keyConfigured) {
      notify.error('No provider configured.');
      return;
    }
    testRunning = true;
    testReply = '';
    testError = '';
    testAbort?.abort();
    const controller = new AbortController();
    testAbort = controller;

    const startedAt = Date.now();
    try {
      const r = await gatewayChat({
        model: targetPref.value,
        messages: [
          { role: 'assistant', content: built.primingAssistantTurn },
          { role: 'user', content: built.userQuery }
        ],
        temperature: 0.7,
        max_tokens: 1024,
        title: 'Cryptex/ResponseAttack',
        signal: controller.signal
      });
      const reply = r.content ?? '';
      testReply = reply;
      const refused = looksRefused(reply);
      const score = scoreBypass(reply);
      void history.record({
        toolId: TOOL_ID,
        startedAt,
        status: 'done',
        input: `[priming]\n${built.primingAssistantTurn}\n\n[user]\n${built.userQuery}`,
        output: reply,
        params: {
          op: 'test',
          style: style.value,
          targetModel: targetPref.value,
          refused,
          score
        }
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      testError = (err as Error).message ?? 'Test failed.';
    } finally {
      testRunning = false;
    }
  }

  async function copyBoth() {
    if (!built.primingAssistantTurn) return;
    const blob = `[ASSISTANT — fake prior turn]\n${built.primingAssistantTurn}\n\n[USER — real query]\n${built.userQuery}`;
    try {
      await navigator.clipboard.writeText(blob);
      notify.success('Both turns copied');
    } catch {
      notify.error('Clipboard write failed');
    }
  }

  function loadVaultEntry(payload: ResponseAttackVaultPayload) {
    untrack(() => {
      style.value = payload.style;
      goal.value = payload.exampleGoal;
    });
  }
</script>

<ToolShell
  toolId={TOOL_ID}
  title="Response Attack"
  accent="Attack"
  description="AAAI 2026 context-priming jailbreak. Craft a fake prior assistant turn, send the on-goal query as the follow-up. Beat PAIR/ActorAttack/CodeAttack at 94.8% ASR."
  usage={{
    title: 'Response Attack · Usage',
    bullets: [
      'Pick a priming style; fake assistant turn is generated.',
      'Real user query is sent after the priming turn.',
      'Target sees two-turn conversation; refusal becomes inconsistent.',
      'Heuristic verdict (looksRefused + scoreBypass), not paper judge.'
    ]
  }}
>
  <div class="space-y-4">
    <div class="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
      <strong>Heuristic implementation, not paper-accurate eval.</strong>
      Response Attack is reimplemented from arXiv 2507.21000 (AAAI 2026).
      The priming turns are our own derivations of the paper's described
      patterns; we do NOT ship the paper's evaluation judge.
    </div>

    <NoProviderBanner context="tool" />

    <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div
        class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start"
      >
        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Priming style</span>
          <select
            bind:value={style.value}
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm"
          >
            <option value="thorough">Thorough · careful walk-through</option>
            <option value="expert">Expert · authoritative practitioner</option>
            <option value="step-by-step">Step-by-step · numbered phases</option>
          </select>
        </div>

        <div class="space-y-1">
          <span class="text-xs text-muted-foreground">Target model</span>
          <ModelPickerV2
            value={targetPref.value}
            onChange={(v) => (targetPref.value = v)}
            recentsKey="cryptex.response-attack.recentTarget"
          />
        </div>

        <div class="border-t border-border/40 pt-3">
          <button
            type="button"
            onclick={testAgainstTarget}
            disabled={!built.userQuery || testRunning || !keyConfigured}
            class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {#if testRunning}<Loader size={14} class="animate-spin" />{:else}<Play size={14} />{/if}
            Test against target
          </button>
        </div>

        {#if testError}<p class="text-xs text-destructive">{testError}</p>{/if}

        <div
          class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground"
        >
          <p class="flex items-center gap-1.5">
            <MessageSquareText size={11} class="text-primary" />
            <span class="font-medium text-foreground">Two-turn shape</span>
          </p>
          <p>
            Sends the priming turn as a fabricated prior <code>assistant</code>
            message, then your goal as a real <code>user</code> turn.
          </p>
        </div>
      </div>

      <div class="space-y-4">
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <label class="block space-y-1">
            <span class="text-xs text-muted-foreground">Goal (the real user query)</span>
            <textarea
              bind:value={goal.value}
              rows="3"
              placeholder="State the underlying request the target should answer..."
              class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            ></textarea>
          </label>
        </div>

        {#if built.primingAssistantTurn}
          <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-sm">
                <span class="rounded-full border border-blue-500/30 bg-blue-500/5 px-2 py-0.5 text-[10px] text-blue-300">assistant (fake prior)</span>
                Priming turn
              </h2>
              <button
                type="button"
                onclick={copyBoth}
                class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy size={11} /> Copy both turns
              </button>
            </div>
            <pre
              class="max-h-[32vh] overflow-auto whitespace-pre-wrap rounded-md border border-input bg-background/40 p-3 font-mono text-[11px] text-foreground">{built.primingAssistantTurn}</pre>
            <p class="text-[11px] italic text-muted-foreground">{built.notes}</p>
          </div>

          <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
            <h2 class="font-serif text-sm">
              <span class="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[10px] text-emerald-300">user (real query)</span>
              On-goal turn
            </h2>
            <pre
              class="overflow-auto whitespace-pre-wrap rounded-md border border-input bg-background/40 p-3 font-mono text-[11px] text-foreground">{built.userQuery}</pre>
          </div>
        {/if}

        {#if testReply}
          <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
            <div class="flex items-center justify-between">
              <h2 class="font-serif text-sm">Target reply</h2>
              <span
                class={`rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                  looksRefused(testReply)
                    ? 'border-red-500/30 bg-red-500/5 text-red-400'
                    : scoreBypass(testReply) >= 0.75
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                      : 'border-amber-500/30 bg-amber-500/5 text-amber-400'
                }`}
              >
                {looksRefused(testReply)
                  ? 'refused'
                  : scoreBypass(testReply) >= 0.75
                    ? 'complied'
                    : 'partial'}
              </span>
            </div>
            <pre
              class="max-h-[40vh] overflow-auto whitespace-pre-wrap rounded-md border border-input bg-background/40 p-3 font-mono text-[11px] text-foreground">{testReply}</pre>
          </div>
        {/if}
      </div>
    </div>
  </div>

  {#snippet vault()}
    <VaultSection store={vaultStore} label="Response Attack Vault" onUse={loadVaultEntry} />
  {/snippet}
</ToolShell>
