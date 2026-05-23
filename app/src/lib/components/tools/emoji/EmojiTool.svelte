<script lang="ts">
  /**
   * Emoji steganography tool — Wave 1.1.
   *
   * Three encode modes (variation-selectors / tag-block / combining-marks)
   * with any-emoji carriers, a forensics decoder that auto-detects which
   * mode produced a given input, a live cl100k tokenizer cost panel, and
   * a bundled Vault of carrier presets.
   *
   * All state lives in module scope (emojiState) so the tool resumes
   * cleanly after route navigation.
   */
  import {
    encodeEmoji, decodeEmoji,
    encodeTagBlock, decodeTagBlock,
    encodeCombining, decodeCombining,
    detectAndExtract,
    SUGGESTED_CARRIERS, isValidEmojiCarrier,
    estimateTokenCost,
    type StegMode, type DetectionResult
  } from '$lib/stego';
  import { notify } from '$lib/stores/toast.svelte';
  import { history } from '$lib/history/store.svelte';
  import { errorLogger } from '$lib/errors/logger';
  import { Errors, isCryptexError, type CryptexError } from '$lib/errors/types';
  import { cn } from '$lib/utils/cn';
  import Copy from 'lucide-svelte/icons/copy';
  import Eye from 'lucide-svelte/icons/eye';
  import AlertTriangle from 'lucide-svelte/icons/triangle-alert';
  import Check from 'lucide-svelte/icons/check';
  import X from 'lucide-svelte/icons/x';
  import { emojiState, type Direction } from './emoji.state.svelte';
  import ToolShell from '$lib/components/shell/ToolShell.svelte';
  import VaultSection from '$lib/components/vault/VaultSection.svelte';
  import { createVaultStore } from '$lib/vault/store.svelte';
  import { loadBundledSeeds } from '$lib/vault/seed-loader';

  const TOOL_ID = 'emoji';
  const MAX_INPUT_BYTES = 1_048_576; // 1 MB
  const VAULT_PLACEHOLDER =
    '{"emoji":"🐍","mode":"variation-selectors","notes":""}';

  type EmojiSeed = { emoji: string; mode: StegMode; notes: string };
  const vaultStore = createVaultStore<EmojiSeed>(
    TOOL_ID,
    loadBundledSeeds<EmojiSeed>(TOOL_ID)
  );

  const s = emojiState;

  // The tool's transient error (e.g., 1MB cap) — surfaced via ToolShell.
  let toolError = $state<CryptexError | undefined>(undefined);

  // Live tokenizer cost preview for the most-recent output.
  let costPanel = $state<{ cl100k: number; chars: number; bytes: number } | null>(null);
  let costToken = 0;

  // --- size guard --------------------------------------------------------

  function checkSize(s: string): boolean {
    const bytes = new Blob([s]).size;
    if (bytes > MAX_INPUT_BYTES) {
      toolError = Errors.badInput(
        `Input exceeds 1 MB cap (got ${bytes.toLocaleString()} bytes).`
      );
      return false;
    }
    return true;
  }

  // --- encode ------------------------------------------------------------

  function runEncode() {
    const carrier = s.effectiveCarrier;
    const text = s.plaintext;
    if (!checkSize(text)) { s.payload = ''; return; }
    if (!carrier) { s.payload = ''; return; }
    if (!isValidEmojiCarrier(carrier)) {
      toolError = Errors.badInput('Carrier must contain at least one emoji character.');
      s.payload = '';
      return;
    }
    if (!text) { s.payload = ''; toolError = undefined; return; }
    const startedAt = Date.now();
    try {
      let out: string;
      if (s.mode === 'variation-selectors') out = encodeEmoji(carrier, text);
      else if (s.mode === 'tag-block') out = encodeTagBlock(carrier, text);
      else out = encodeCombining(carrier, text);
      s.payload = out;
      toolError = undefined;
      void history.record({
        toolId: TOOL_ID,
        startedAt,
        status: 'done',
        input: text,
        output: out,
        params: { mode: s.mode, carrier, direction: 'encode' }
      });
    } catch (err) {
      const ce = isCryptexError(err) ? err : Errors.tool('Encode failed', err);
      toolError = ce;
      errorLogger.report(ce, { toast: false });
      s.payload = '';
    }
  }

  // --- decode ------------------------------------------------------------

  function runDecode() {
    const payload = s.payloadToDecode;
    if (!checkSize(payload)) { s.decodedText = ''; return; }
    if (!payload) { s.decodedText = ''; toolError = undefined; return; }
    const startedAt = Date.now();
    try {
      let out: string;
      if (s.mode === 'variation-selectors') out = decodeEmoji(payload);
      else if (s.mode === 'tag-block') out = decodeTagBlock(payload);
      else out = decodeCombining(payload);
      s.decodedText = out;
      toolError = undefined;
      if (out) {
        void history.record({
          toolId: TOOL_ID,
          startedAt,
          status: 'done',
          input: payload,
          output: out,
          params: { mode: s.mode, direction: 'decode' }
        });
      }
    } catch (err) {
      const ce = isCryptexError(err) ? err : Errors.tool('Decode failed', err);
      toolError = ce;
      errorLogger.report(ce, { toast: false });
      s.decodedText = '';
    }
  }

  // --- forensics ---------------------------------------------------------

  let forensicsResult = $state<DetectionResult | null>(null);

  function runForensics() {
    const input = s.forensicsInput;
    if (!checkSize(input)) { forensicsResult = null; return; }
    if (!input) { forensicsResult = null; toolError = undefined; return; }
    const startedAt = Date.now();
    try {
      const r = detectAndExtract(input);
      forensicsResult = r;
      toolError = undefined;
      if (r.detected) {
        void history.record({
          toolId: TOOL_ID,
          startedAt,
          status: 'done',
          input,
          output: r.extracted,
          params: { mode: r.detected, direction: 'forensics', confidence: r.confidence }
        });
      }
    } catch (err) {
      const ce = isCryptexError(err) ? err : Errors.tool('Forensics scan failed', err);
      toolError = ce;
      errorLogger.report(ce, { toast: false });
      forensicsResult = null;
    }
  }

  // --- reactive triggers -------------------------------------------------

  $effect(() => {
    if (s.direction === 'encode') {
      void s.mode; void s.plaintext; void s.selectedCarrier; void s.customEmoji;
      runEncode();
    }
  });

  $effect(() => {
    if (s.direction === 'decode') {
      void s.mode; void s.payloadToDecode;
      runDecode();
    }
  });

  $effect(() => {
    if (s.direction === 'forensics') {
      void s.forensicsInput;
      runForensics();
    }
  });

  // Track latest output for the cost panel; debounce via a token.
  $effect(() => {
    const target =
      s.direction === 'encode'
        ? s.payload
        : s.direction === 'decode'
        ? s.decodedText
        : forensicsResult?.extracted ?? '';
    const thisToken = ++costToken;
    if (!target) { costPanel = null; return; }
    void (async () => {
      try {
        const r = await estimateTokenCost(target);
        if (thisToken === costToken) costPanel = r;
      } catch {
        if (thisToken === costToken) costPanel = null;
      }
    })();
  });

  // --- carrier validity indicator (for free-text input) -----------------

  const customValidity = $derived.by(() => {
    const v = s.customEmoji.trim();
    if (!v) return 'empty' as const;
    return isValidEmojiCarrier(v) ? 'valid' : 'invalid';
  });

  // --- copy helper -------------------------------------------------------

  async function copy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      notify.success(`${label} copied`);
    } catch {
      notify.error('Copy failed');
    }
  }

  function useDecodedFromEncoded() {
    s.payloadToDecode = s.payload;
    s.direction = 'decode';
    notify.info('Swapped encoded payload into decoder');
  }

  // --- vault item application -------------------------------------------

  function onVaultUse(payload: EmojiSeed) {
    s.mode = payload.mode;
    s.selectedCarrier = payload.emoji;
    s.customEmoji = '';
    s.direction = 'encode';
    notify.info(`Loaded carrier ${payload.emoji} (${payload.mode})`);
  }

  // --- replay (HistoryFooter) -------------------------------------------

  function onReplay(input: string, params: Record<string, unknown>) {
    const dir = (params['direction'] as Direction | undefined) ?? 'encode';
    const mode = (params['mode'] as StegMode | undefined) ?? s.mode;
    s.mode = mode;
    s.direction = dir;
    if (dir === 'encode') {
      s.plaintext = input;
      const carrier = params['carrier'];
      if (typeof carrier === 'string') {
        s.selectedCarrier = carrier;
        s.customEmoji = '';
      }
    } else if (dir === 'decode') {
      s.payloadToDecode = input;
    } else {
      s.forensicsInput = input;
    }
  }

  const MODE_TABS: Array<{ id: StegMode; label: string }> = [
    { id: 'variation-selectors', label: 'Variation selectors' },
    { id: 'tag-block', label: 'Tag block' },
    { id: 'combining-marks', label: 'Combining marks' }
  ];

  const DIRECTION_TABS: Array<{ id: Direction; label: string }> = [
    { id: 'encode', label: 'Encode' },
    { id: 'decode', label: 'Decode' },
    { id: 'forensics', label: 'Forensics' }
  ];

  const MODE_DESCRIPTIONS: Record<StegMode, string> = {
    'variation-selectors':
      'Per-bit FE0E/FE0F selectors after the carrier. Highest stealth, lowest density (1 bit per selector).',
    'tag-block':
      'Nibble-encoded payload in U+E0020..U+E002F (the Tags block). ~4 bits per codepoint — dense and invisible.',
    'combining-marks':
      'Six-bit-per-mark chain of U+0300..U+033F combining diacriticals. Densest of the three — but RENDERS AS ZALGO TEXT.'
  };
</script>

<ToolShell
  toolId={TOOL_ID}
  title="Emoji steganography"
  accent="steganography"
  usage={{
    title: 'Emoji steganography · Usage',
    bullets: [
      'Pick a mode: variation-selectors (stealthy), tag-block (dense), or combining-marks (visible zalgo).',
      'Choose any emoji as carrier — flags, ZWJ families, skin-tone modifiers all work.',
      'Forensics tab auto-detects which mode produced a given input and recovers the plaintext.',
      'Tokenizer cost preview shows how many cl100k tokens the payload consumes.'
    ]
  }}
  error={toolError}
  onErrorDismiss={() => (toolError = undefined)}
  {onReplay}
>
  <div class="space-y-6">
    <!-- Mode + direction tabs -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="inline-flex gap-0.5 rounded-lg border border-border bg-card/40 p-1">
        {#each MODE_TABS as t (t.id)}
          <button
            type="button"
            onclick={() => (s.mode = t.id)}
            class={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              s.mode === t.id ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        {/each}
      </div>
      <div class="inline-flex gap-0.5 rounded-md border border-border bg-card/40 p-0.5">
        {#each DIRECTION_TABS as t (t.id)}
          <button
            type="button"
            onclick={() => (s.direction = t.id)}
            class={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              s.direction === t.id ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Mode description + zalgo warning -->
    <div class="rounded-md border border-border/40 bg-card/30 px-3 py-2 text-xs text-muted-foreground">
      {MODE_DESCRIPTIONS[s.mode]}
    </div>
    {#if s.mode === 'combining-marks'}
      <div class="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
        <AlertTriangle size={14} class="flex-none mt-0.5" />
        <div>
          May render as visible diacritics on some fonts/platforms (zalgo effect). Use only for forensics research, not stealth.
        </div>
      </div>
    {/if}

    {#if s.direction !== 'forensics'}
      <!-- Carrier picker (encode + decode share the visible-carrier widget) -->
      <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-sm">Carrier</h2>
          {#if customValidity === 'valid'}
            <span class="inline-flex items-center gap-1 text-xs text-emerald-300"><Check size={12} /> valid</span>
          {:else if customValidity === 'invalid'}
            <span class="inline-flex items-center gap-1 text-xs text-red-300"><X size={12} /> not an emoji</span>
          {/if}
        </div>
        <div class="flex flex-wrap items-center gap-2">
          {#each SUGGESTED_CARRIERS as c (c.emoji)}
            <button
              type="button"
              onclick={() => { s.selectedCarrier = c.emoji; s.customEmoji = ''; }}
              class={cn(
                'group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all',
                s.selectedCarrier === c.emoji && !s.customEmoji
                  ? 'border-primary/50 bg-primary/5 shadow-primary'
                  : 'border-border bg-card/40 hover:border-primary/30'
              )}
              title={c.name}
            >
              <span class="text-xl">{c.emoji}</span>
              <span class="text-xs font-medium">{c.name}</span>
            </button>
          {/each}
        </div>
        <label class="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-1.5">
          <span class="text-xs text-muted-foreground whitespace-nowrap">Or paste your own emoji</span>
          <input
            type="text"
            bind:value={s.customEmoji}
            maxlength="32"
            placeholder="🎉  /  👨‍👩‍👧  /  🇺🇸"
            class="flex-1 bg-transparent text-lg focus:outline-none"
          />
        </label>
      </div>
    {/if}

    <!-- Encode panel -->
    {#if s.direction === 'encode'}
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <h2 class="font-serif text-sm">Plaintext</h2>
          <textarea
            bind:value={s.plaintext}
            rows="6"
            placeholder="Message to hide…"
            class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>
          <div class="text-xs text-muted-foreground">
            {s.plaintext.length.toLocaleString()} chars · {new Blob([s.plaintext]).size.toLocaleString()} bytes UTF-8
          </div>
        </div>

        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-sm">Encoded payload</h2>
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onclick={() => copy(s.payload, 'Payload')}
                disabled={!s.payload}
                class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
              >
                <Copy size={11} /> Copy
              </button>
              <button
                type="button"
                onclick={useDecodedFromEncoded}
                disabled={!s.payload}
                class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                title="Send this payload to the decoder to verify the round-trip"
              >
                <Eye size={11} /> Test decode
              </button>
            </div>
          </div>
          <textarea
            readonly
            value={s.payload}
            rows="6"
            placeholder="Pick a carrier and type to generate"
            class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
          ></textarea>
          <div class="text-xs text-muted-foreground">
            {s.payload.length.toLocaleString()} code points
            {#if s.payload}· carrier: {s.effectiveCarrier}{/if}
          </div>
        </div>
      </div>
    {:else if s.direction === 'decode'}
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <h2 class="font-serif text-sm">Encoded payload</h2>
          <textarea
            bind:value={s.payloadToDecode}
            rows="6"
            placeholder="Paste payload encoded with the current mode"
            class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>
          <div class="text-xs text-muted-foreground">{s.payloadToDecode.length.toLocaleString()} chars</div>
        </div>

        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-sm">Recovered plaintext</h2>
            <button
              type="button"
              onclick={() => copy(s.decodedText, 'Plaintext')}
              disabled={!s.decodedText}
              class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Copy size={11} /> Copy
            </button>
          </div>
          <textarea
            readonly
            value={s.decodedText}
            rows="6"
            placeholder={s.payloadToDecode ? 'Could not recover any hidden message — try a different mode' : 'Decoded message will appear here'}
            class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
          ></textarea>
          <div class="text-xs text-muted-foreground">{s.decodedText.length.toLocaleString()} chars recovered</div>
        </div>
      </div>
    {:else}
      <!-- Forensics panel -->
      <div class="space-y-4">
        <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
          <h2 class="font-serif text-sm">Suspicious input</h2>
          <textarea
            bind:value={s.forensicsInput}
            rows="6"
            placeholder="Paste any string — the forensics decoder will try all three modes."
            class="w-full rounded-lg border border-input bg-background/70 px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          ></textarea>
          <div class="text-xs text-muted-foreground">{s.forensicsInput.length.toLocaleString()} chars</div>
        </div>

        {#if forensicsResult}
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
              <h2 class="font-serif text-sm">Detection</h2>
              {#if forensicsResult.detected}
                <div class="flex items-center gap-2 text-sm">
                  <span class="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {forensicsResult.detected}
                  </span>
                  <span class="text-xs text-muted-foreground">
                    confidence: <strong class="text-foreground">{forensicsResult.confidence}</strong>
                  </span>
                </div>
                <div class="text-xs text-muted-foreground space-y-0.5">
                  <div>Hidden codepoints: <span class="font-mono">{forensicsResult.hiddenCharCount.toLocaleString()}</span></div>
                  {#if forensicsResult.carrier}
                    <div>Visible carrier: <span class="text-xl align-middle">{forensicsResult.carrier}</span></div>
                  {/if}
                </div>
              {:else}
                <div class="text-sm text-muted-foreground">
                  No stego pattern detected.
                </div>
              {/if}
            </div>
            <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
              <div class="flex items-center justify-between">
                <h2 class="font-serif text-sm">Extracted plaintext</h2>
                <button
                  type="button"
                  onclick={() => copy(forensicsResult?.extracted ?? '', 'Plaintext')}
                  disabled={!forensicsResult?.extracted}
                  class="inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
                >
                  <Copy size={11} /> Copy
                </button>
              </div>
              <textarea
                readonly
                value={forensicsResult.extracted}
                rows="6"
                class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
              ></textarea>
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Tokenizer cost panel -->
    {#if costPanel && (s.payload || s.decodedText || forensicsResult?.extracted)}
      <div class="flex flex-wrap items-center gap-4 rounded-md border border-border/40 bg-card/30 px-4 py-2 text-xs">
        <span class="text-muted-foreground">Token cost</span>
        <span><strong class="text-foreground">{costPanel.cl100k.toLocaleString()}</strong> cl100k tokens</span>
        <span class="text-muted-foreground">·</span>
        <span><strong class="text-foreground">{costPanel.chars.toLocaleString()}</strong> chars</span>
        <span class="text-muted-foreground">·</span>
        <span><strong class="text-foreground">{costPanel.bytes.toLocaleString()}</strong> bytes</span>
      </div>
    {/if}
  </div>

  {#snippet vault()}
    <VaultSection
      store={vaultStore}
      label="Carrier vault"
      onUse={(payload) => onVaultUse(payload)}
      payloadPlaceholder={VAULT_PLACEHOLDER}
    />
  {/snippet}
</ToolShell>
