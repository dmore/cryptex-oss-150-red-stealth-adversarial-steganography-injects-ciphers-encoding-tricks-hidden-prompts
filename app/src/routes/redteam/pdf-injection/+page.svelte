<script lang="ts">
  import {
    buildPdfPayload,
    TRACK_LIST,
    TRACK_LABELS,
    DEFAULT_INSTRUCTION,
    type PdfPayloadTrack,
    type PdfInjectionResult
  } from '$lib/redteam/pdf-meta-injection';
  import { notify } from '$lib/stores/toast.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { MAX_INPUT_BYTES } from '$lib/workers/runInWorker';
  import { errorLogger } from '$lib/errors/logger';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import FileScan from 'lucide-svelte/icons/file-scan';

  const track = useToolState<PdfPayloadTrack>('pdf-injection', 'track', 'body-with-meta');
  const title = useToolState<string>('pdf-injection', 'title', 'Q1 2026 Quarterly Operations Report');
  const author = useToolState<string>('pdf-injection', 'author', 'Strategy Office');
  const hiddenInstruction = useToolState<string>('pdf-injection', 'hiddenInstruction', DEFAULT_INSTRUCTION);
  const coverBody = useToolState<string>('pdf-injection', 'coverBody', '');
  let result = $state<PdfInjectionResult | null>(null);
  let lastReportedOversize = '';

  function regenerate() {
    if (!hiddenInstruction.value.trim()) {
      result = null;
      return;
    }
    // The composite payload is hidden instruction + cover body; cap the sum.
    const totalSize = hiddenInstruction.value.length + coverBody.value.length;
    if (totalSize > MAX_INPUT_BYTES) {
      result = null;
      const key = `${totalSize}:${hiddenInstruction.value.slice(0, 24)}`;
      if (key !== lastReportedOversize) {
        lastReportedOversize = key;
        errorLogger.report(
          new Error('Input exceeds 1 MB cap. Trim the instruction / cover body or split into batches.'),
          { toastMessage: 'Input exceeds 1 MB cap. Trim the instruction / cover body or split into batches.' }
        );
      }
      return;
    }
    lastReportedOversize = '';
    result = buildPdfPayload({
      track: track.value,
      hiddenInstruction: hiddenInstruction.value,
      title: title.value || undefined,
      author: author.value || undefined,
      coverBody: coverBody.value.trim() || undefined
    });
  }

  $effect(() => {
    void track.value; void title.value; void author.value; void hiddenInstruction.value; void coverBody.value;
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
</script>

<ToolShell
  toolId="pdf-injection"
  title="PDF metadata injection"
  accent="injection"
  description="Synthesize PDF-extracted-text representations with adversarial instructions in /Title, /Subject, /Author metadata, visible body, or invisible-text layers. Tests PDF-summarization + RAG agents that ingest extracted text via pdfminer / pdfplumber / pdfjs."
  usage={{
    title: 'PDF metadata injection · Usage',
    bullets: [
      'Pick a track: metadata-only / body-with-meta / invisible-text.',
      'Hidden instruction goes into /Title /Subject /Author or invisible-text layer.',
      'Copy the synthesized PDF-extracted-text representation.',
      'Feed to a PDF-summarization or RAG agent to test compliance.',
      '1 MB cap on (hidden instruction + cover body).'
    ]
  }}
>
  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Injection track</span>
        <select bind:value={track.value} class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {#each TRACK_LIST as t}<option value={t}>{TRACK_LABELS[t]}</option>{/each}
        </select>
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Document title</span>
        <input bind:value={title.value} type="text" class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Author</span>
        <input bind:value={author.value} type="text" class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </label>

      {#if track.value !== 'metadata-only'}
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Cover body (optional)</span>
          <textarea bind:value={coverBody.value} rows="4" placeholder="Leave empty for default Q1 report…" class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-xs focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
        </label>
      {/if}

      {#if result}
        <div class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
          <p class="flex items-center gap-1.5">
            <FileScan size={11} class="text-primary" />
            <span class="font-medium text-foreground">Test hint</span>
          </p>
          <p>{result.hint}</p>
        </div>
      {/if}
    </div>

    <div class="space-y-4">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Hidden instruction</h2>
        <textarea bind:value={hiddenInstruction.value} rows="3" placeholder="Adversarial directive embedded in metadata / hidden layer…" class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"></textarea>
      </div>

      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Synthesized PDF text-extraction</h2>
          {#if result}
            <button type="button" onclick={copyPayload} class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"><Copy size={11} /> Copy</button>
          {/if}
        </div>
        {#if !result}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Enter a hidden instruction. Payload regenerates automatically.
          </div>
        {:else}
          <pre class="max-h-[calc(100vh-30rem)] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-input bg-background/40 p-3 font-mono text-xs leading-relaxed text-foreground cryptex-scroll">{result.payload}</pre>
          <p class="rounded-md border border-border/40 bg-background/40 p-2 text-[11px] italic leading-relaxed text-muted-foreground">{result.notes}</p>
        {/if}
      </div>
    </div>
  </div>
</ToolShell>
