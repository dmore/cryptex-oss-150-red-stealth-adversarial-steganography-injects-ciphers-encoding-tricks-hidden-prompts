<script lang="ts">
  import {
    buildExfilPayload,
    PAYLOAD_TYPES,
    PAYLOAD_TYPE_LABELS,
    DEFAULT_HIDDEN_INSTRUCTION,
    type ExfilPayloadType,
    type ExfilResult
  } from '$lib/redteam/markdown-exfil';
  import { notify } from '$lib/stores/toast.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { MAX_INPUT_BYTES } from '$lib/workers/runInWorker';
  import { errorLogger } from '$lib/errors/logger';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Link from 'lucide-svelte/icons/link';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';

  const hiddenInstruction = useToolState<string>('markdown-exfil', 'hiddenInstruction', DEFAULT_HIDDEN_INSTRUCTION);
  const canaryUrl = useToolState<string>('markdown-exfil', 'canaryUrl', 'https://canary.example.test');
  const payloadType = useToolState<ExfilPayloadType>('markdown-exfil', 'payloadType', 'image-canary');
  const token = useToolState<string>('markdown-exfil', 'token', '');
  let result = $state<ExfilResult | null>(null);
  let lastReportedOversize = '';

  function regenerate() {
    if (!hiddenInstruction.value.trim()) {
      result = null;
      return;
    }
    if (hiddenInstruction.value.length > MAX_INPUT_BYTES) {
      result = null;
      const key = `${hiddenInstruction.value.length}:${hiddenInstruction.value.slice(0, 24)}`;
      if (key !== lastReportedOversize) {
        lastReportedOversize = key;
        errorLogger.report(
          new Error('Input exceeds 1 MB cap. Trim the input or split into batches.'),
          { toastMessage: 'Input exceeds 1 MB cap. Trim the input or split into batches.' }
        );
      }
      return;
    }
    lastReportedOversize = '';
    result = buildExfilPayload({
      hiddenInstruction: hiddenInstruction.value,
      canaryUrl: canaryUrl.value.trim() || undefined,
      token: token.value.trim() || undefined,
      payloadType: payloadType.value
    });
  }

  // Auto-regenerate on input changes.
  $effect(() => {
    void hiddenInstruction.value;
    void canaryUrl.value;
    void payloadType.value;
    void token.value;
    regenerate();
  });

  async function copyPayload() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.payload);
      notify.success('Payload copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function rerollToken() {
    token.value = '';
    regenerate();
  }
</script>

<ToolShell
  toolId="markdown-exfil"
  title="Markdown exfil lab"
  accent="exfil"
  description="Synthesize indirect-injection payloads — markdown, HTML, citation blocks, document bodies, CSV cells, data: URIs. Tests whether a downstream chat UI fetches embedded images on render (data exfil), or whether a summarizer re-emits hidden instructions when paraphrasing content."
  usage={{
    title: 'Markdown exfil · Usage',
    bullets: [
      'Pick a payload type — image-canary, link-tooltip, citation, data-URI, etc.',
      'Each tests a different exfil channel.',
      'Render the result in your downstream chat UI to verify behaviour.',
      'Watch your canary endpoint logs — fetches mean exfil succeeded.',
      '1 MB input cap on the hidden instruction.'
    ]
  }}
>
  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Payload type</span>
        <select
          bind:value={payloadType.value}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each PAYLOAD_TYPES as t}
            <option value={t}>{PAYLOAD_TYPE_LABELS[t]}</option>
          {/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Canary URL</span>
        <input
          bind:value={canaryUrl.value}
          type="url"
          placeholder="https://your-canary.example"
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span class="text-[10px] text-muted-foreground">
          Use a domain you control (canarytokens.org / your subdomain) to log fetch requests.
        </span>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Token (optional)</span>
        <div class="flex gap-1">
          <input
            bind:value={token.value}
            type="text"
            placeholder="auto-generate"
            class="flex-1 rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onclick={rerollToken}
            title="Re-roll token"
            class="inline-flex items-center justify-center rounded-md border border-border bg-card/60 px-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        <span class="text-[10px] text-muted-foreground">
          Logged with the canary fetch; identifies which payload fired.
        </span>
      </label>

      <div class="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <Link size={11} class="text-primary" />
          <span class="font-medium text-foreground">Usage</span>
        </p>
        <p>
          Paste the synthesized payload into a chat composer or attach as document content.
          If the canary URL gets hit, the renderer auto-fetches markdown images (exfil-capable).
        </p>
        <p>
          The <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">markdown_exfil</code> + <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">doc_injection</code> chain mutators reference this builder.
        </p>
      </div>
    </div>

    <!-- Right — instruction editor + result -->
    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Hidden instruction</h2>
        <textarea
          bind:value={hiddenInstruction.value}
          rows="4"
          placeholder="Adversarial instruction to embed in the payload…"
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Synthesized payload</h2>
          {#if result}
            <button
              type="button"
              onclick={copyPayload}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Copy size={11} /> Copy
            </button>
          {/if}
        </div>

        {#if !result}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Enter a hidden instruction above. Payload regenerates automatically.
          </div>
        {:else}
          <pre class="whitespace-pre-wrap break-all rounded-lg border border-input bg-background/40 p-3 font-mono text-xs leading-relaxed text-foreground">{result.payload}</pre>
          <div class="text-[11px] text-muted-foreground">
            <span class="font-medium text-foreground">Token:</span>
            <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">{result.token}</code>
            <span class="mx-1.5">·</span>
            <span class="font-medium text-foreground">Type:</span>
            <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">{payloadType.value}</code>
          </div>
          <p class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] italic leading-relaxed text-muted-foreground">
            {result.notes}
          </p>
        {/if}
      </div>
    </div>
  </div>
</ToolShell>
