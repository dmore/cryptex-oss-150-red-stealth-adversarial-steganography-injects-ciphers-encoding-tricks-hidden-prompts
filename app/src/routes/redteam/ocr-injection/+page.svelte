<script lang="ts">
  import {
    renderOcrPayload,
    OCR_PRESETS,
    DEFAULT_OCR_OPTIONS,
    type OcrMode,
    type OcrPayloadPreset
  } from '$lib/redteam/ocr-injection';
  import { notify } from '$lib/stores/toast.svelte';
  import { useToolState } from '$lib/stores/tool-state.svelte';
  import { onMount } from 'svelte';
  import { MAX_INPUT_BYTES } from '$lib/workers/runInWorker';
  import { errorLogger } from '$lib/errors/logger';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import Copy from 'lucide-svelte/icons/copy';
  import Download from 'lucide-svelte/icons/download';
  import ImageIcon from 'lucide-svelte/icons/image';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';

  // Form state — persisted across tab switches
  const payload = useToolState<string>('ocr-injection', 'payload', OCR_PRESETS[0].text);
  const mode = useToolState<OcrMode>('ocr-injection', 'mode', OCR_PRESETS[0].recommendedMode);
  const decoyText = useToolState<string>('ocr-injection', 'decoyText', 'A photograph of a quiet park at dawn.');
  const width = useToolState<number>('ocr-injection', 'width', DEFAULT_OCR_OPTIONS.width);
  const height = useToolState<number>('ocr-injection', 'height', DEFAULT_OCR_OPTIONS.height);
  const fontSize = useToolState<number>('ocr-injection', 'fontSize', DEFAULT_OCR_OPTIONS.fontSize);
  let imageDataUrl = $state<string | null>(null);
  let busy = $state(false);
  let errorMsg = $state<string>('');
  let isBrowser = $state(false);

  onMount(() => {
    isBrowser = true;
    void generate();
  });

  function applyPreset(preset: OcrPayloadPreset) {
    payload.value = preset.text;
    mode.value = preset.recommendedMode;
    void generate();
  }

  async function generate() {
    if (!isBrowser) return;
    if (!payload.value.trim()) {
      imageDataUrl = null;
      return;
    }
    if (payload.value.length > MAX_INPUT_BYTES) {
      imageDataUrl = null;
      errorMsg = 'Input exceeds 1 MB cap.';
      errorLogger.report(
        new Error('Input exceeds 1 MB cap. Trim the payload or split into batches.'),
        { toastMessage: 'Input exceeds 1 MB cap. Trim the payload or split into batches.' }
      );
      return;
    }
    busy = true;
    errorMsg = '';
    try {
      imageDataUrl = renderOcrPayload({
        text: payload.value,
        mode: mode.value,
        decoyText: mode.value === 'typographic' ? decoyText.value : undefined,
        width: width.value,
        height: height.value,
        fontSize: fontSize.value
      });
    } catch (e) {
      errorMsg = (e as Error).message;
    } finally {
      busy = false;
    }
  }

  async function copyDataUrl() {
    if (!imageDataUrl) return;
    try {
      await navigator.clipboard.writeText(imageDataUrl);
      notify.success('Data URL copied');
    } catch {
      notify.error('Copy failed');
    }
  }

  function downloadPng() {
    if (!imageDataUrl) return;
    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `ocr-payload-${mode.value}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success('Downloaded');
  }

  const modeOptions: { value: OcrMode; label: string; hint: string }[] = [
    { value: 'covert', label: 'Covert', hint: 'Light gray text on white — invisible to humans, OCR reads.' },
    { value: 'overt', label: 'Overt', hint: 'Pure black text on white — fully visible.' },
    { value: 'typographic', label: 'Typographic', hint: 'Decoy on top + fainter payload below.' },
    { value: 'micro', label: 'Micro', hint: 'Tiny font (~6px) — humans skim past, OCR reads.' },
    { value: 'edge', label: 'Edge', hint: 'Single-row band at the canvas bottom edge.' }
  ];
</script>

<ToolShell
  toolId="ocr-injection"
  title="OCR injection generator"
  accent="injection"
  description="Renders adversarial text into a PNG that vision-capable models OCR + execute. Use covert or typographic mode to hide the instruction from a human reviewing the image; the OCR layer of vision LLMs still picks it up."
  usage={{
    title: 'OCR injection · Usage',
    bullets: [
      'Pick a mode: overt → typographic → micro → edge → covert.',
      'Adversarial text is rendered into a PNG via Canvas.',
      'Vision-capable models OCR the image and may execute the instruction.',
      'Covert / typographic / micro modes hide the text from human review.',
      '1 MB input cap on the payload text.'
    ]
  }}
>
  <div class="grid gap-4 lg:grid-cols-[320px_1fr]">
    <!-- Sidebar — controls -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass lg:sticky lg:top-20 lg:self-start">
      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Render mode</span>
        <select
          bind:value={mode.value}
          onchange={generate}
          class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {#each modeOptions as m}
            <option value={m.value}>{m.label}</option>
          {/each}
        </select>
        <span class="text-[10px] text-muted-foreground">
          {modeOptions.find((m) => m.value === mode.value)?.hint}
        </span>
      </label>

      {#if mode.value === 'typographic'}
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Decoy text (visible)</span>
          <input
            bind:value={decoyText.value}
            oninput={generate}
            type="text"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      {/if}

      <div class="grid grid-cols-2 gap-2">
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Width</span>
          <input
            bind:value={width.value}
            onchange={generate}
            type="number"
            min="256"
            max="4096"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label class="block space-y-1">
          <span class="text-xs text-muted-foreground">Height</span>
          <input
            bind:value={height.value}
            onchange={generate}
            type="number"
            min="64"
            max="2048"
            class="w-full rounded-md border border-input bg-background/70 px-2 py-1 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      </div>

      <label class="block space-y-1">
        <span class="text-xs text-muted-foreground">Font size: {fontSize.value}px</span>
        <input
          type="range"
          min="6"
          max="64"
          step="1"
          bind:value={fontSize.value}
          oninput={generate}
          class="w-full accent-primary"
        />
      </label>

      <button
        type="button"
        onclick={generate}
        disabled={busy}
        class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {#if busy}
          <RefreshCw size={14} class="animate-spin" /> Rendering…
        {:else}
          <ImageIcon size={14} /> Re-render
        {/if}
      </button>

      {#if errorMsg}
        <p class="text-xs text-destructive">{errorMsg}</p>
      {/if}

      <div class="space-y-1.5 rounded-md border border-border/40 bg-background/40 p-2 text-[11px] leading-relaxed text-muted-foreground">
        <p class="flex items-center gap-1.5">
          <ImageIcon size={11} class="text-primary" />
          <span class="font-medium text-foreground">Usage</span>
        </p>
        <p>
          Save the PNG and attach to a chat with a vision-capable model. The model OCRs the image
          and may execute the embedded instruction.
        </p>
      </div>
    </div>

    <!-- Right — payload editor + image preview -->
    <div class="space-y-4">
      <!-- Presets -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Payload presets</h2>
        <div class="flex flex-wrap gap-1.5">
          {#each OCR_PRESETS as preset}
            <button
              type="button"
              onclick={() => applyPreset(preset)}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 px-2 py-1 text-[11px] text-muted-foreground hover:border-border/70 hover:bg-muted hover:text-foreground"
              title={preset.text}
            >
              {preset.label}
              <span class="rounded bg-muted/40 px-1 font-mono text-[9px]">{preset.recommendedMode}</span>
            </button>
          {/each}
        </div>
      </div>

      <!-- Editor -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Adversarial text payload</h2>
        <textarea
          bind:value={payload.value}
          oninput={generate}
          rows="5"
          placeholder="Adversarial instruction to embed in the image…"
          class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ></textarea>
      </div>

      <!-- Preview -->
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Image preview</h2>
          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={downloadPng}
              disabled={!imageDataUrl}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Download size={11} /> PNG
            </button>
            <button
              type="button"
              onclick={copyDataUrl}
              disabled={!imageDataUrl}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Copy size={11} /> Data URL
            </button>
          </div>
        </div>
        {#if imageDataUrl}
          <div class="rounded-lg border border-input bg-background/70 p-2">
            <img
              src={imageDataUrl}
              alt="OCR injection preview"
              class="block max-w-full rounded border border-border/40"
            />
          </div>
          <p class="text-[10px] text-muted-foreground">
            Mode: <code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[10px]">{mode.value}</code> · {width.value}×{height.value}px · {fontSize.value}px font
          </p>
        {:else}
          <div class="rounded-lg border border-dashed border-border/40 bg-background/20 p-6 text-center text-xs text-muted-foreground">
            Enter payload text in the editor above. Image renders automatically.
          </div>
        {/if}
      </div>
    </div>
  </div>
</ToolShell>
