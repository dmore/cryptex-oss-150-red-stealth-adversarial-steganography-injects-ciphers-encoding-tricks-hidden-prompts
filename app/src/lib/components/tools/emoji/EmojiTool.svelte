<script lang="ts">
  import {
    encodeEmoji, decodeEmoji, encodeInvisible, decodeInvisible,
    carriers
  } from '$lib/stego';
  import { notify } from '$lib/stores/toast.svelte';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import { cn } from '$lib/utils/cn';
  import Copy from 'lucide-svelte/icons/copy';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import { emojiState } from './emoji.state.svelte';

  const s = emojiState;

  $effect(() => {
    if (s.mode !== 'emoji') return;
    const carrier = s.customEmoji.trim() || s.selectedCarrier.emoji;
    if (s.direction !== 'encode') return;
    if (!s.plaintext) { s.payload = ''; return; }
    try {
      s.payload = encodeEmoji(carrier, s.plaintext);
    } catch (err) {
      console.error('encodeEmoji failed', err);
      s.payload = '';
    }
  });

  $effect(() => {
    if (s.mode !== 'emoji') return;
    if (s.direction !== 'decode') return;
    if (!s.payloadToDecode) { s.decodedText = ''; return; }
    try {
      s.decodedText = decodeEmoji(s.payloadToDecode);
    } catch {
      s.decodedText = '';
    }
  });

  $effect(() => {
    if (s.mode !== 'invisible') return;
    if (s.direction === 'encode') {
      s.payload = s.plaintext ? encodeInvisible(s.plaintext) : '';
    } else {
      s.decodedText = s.payloadToDecode ? decodeInvisible(s.payloadToDecode) : '';
    }
  });

  async function copy(text: string, label: string) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const input = s.direction === 'encode' ? s.plaintext : s.payloadToDecode;
      sessionLog.record({
        tool: 'emoji',
        operation: `${s.mode}-${s.direction}`,
        label: s.mode === 'emoji' ? (s.customEmoji.trim() || s.selectedCarrier.emoji) : 'tags',
        input,
        output: text
      });
      notify.success(`${label} copied`);
    } catch {
      notify.error('Copy failed');
    }
  }

  function useSample() {
    s.payloadToDecode = s.payload;
    s.direction = 'decode';
    notify.info('Swapped encoded payload into decoder');
  }
</script>

<section class="space-y-6">
  <header class="space-y-2">
    <h1 class="font-serif text-3xl sm:text-4xl tracking-tight text-balance">
      Emoji <span class="text-primary italic">steganography</span>
    </h1>
    <p class="text-muted-foreground max-w-2xl text-sm sm:text-base">
      Hide a secret message inside a single emoji using Unicode variation selectors,
      or encode with the invisible Tags block. Fully offline — payloads never leave this page.
    </p>
  </header>

  <!-- Mode + direction switches -->
  <div class="flex flex-wrap items-center gap-3">
    <div class="inline-flex gap-0.5 rounded-lg border border-border bg-card/40 p-1">
      <button
        type="button"
        onclick={() => (s.mode = 'emoji')}
        class={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          s.mode === 'emoji' ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Sparkles size={12} class="inline -mt-0.5 mr-1" /> Emoji carrier
      </button>
      <button
        type="button"
        onclick={() => (s.mode = 'invisible')}
        class={cn(
          'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
          s.mode === 'invisible' ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <EyeOff size={12} class="inline -mt-0.5 mr-1" /> Invisible text
      </button>
    </div>
    <div class="inline-flex gap-0.5 rounded-md border border-border bg-card/40 p-0.5">
      <button
        type="button"
        onclick={() => (s.direction = 'encode')}
        class={cn(
          'rounded px-2.5 py-1 text-xs font-medium transition-colors',
          s.direction === 'encode' ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Encode
      </button>
      <button
        type="button"
        onclick={() => (s.direction = 'decode')}
        class={cn(
          'rounded px-2.5 py-1 text-xs font-medium transition-colors',
          s.direction === 'decode' ? 'bg-primary text-primary-foreground shadow-primary' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Decode
      </button>
    </div>
  </div>

  {#if s.mode === 'emoji' && s.direction === 'encode'}
    <!-- Carrier selection -->
    <div class="space-y-3 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <h2 class="font-serif text-sm">Carrier</h2>
      <div class="flex flex-wrap items-center gap-2">
        {#each carriers as c (c.name)}
          <button
            type="button"
            onclick={() => { s.selectedCarrier = c; s.customEmoji = ''; }}
            class={cn(
              'group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all',
              (s.selectedCarrier.emoji === c.emoji && !s.customEmoji)
                ? 'border-primary/50 bg-primary/5 shadow-primary'
                : 'border-border bg-card/40 hover:border-primary/30'
            )}
          >
            <span class="text-xl">{c.emoji}</span>
            <span class="text-xs font-medium">{c.name}</span>
          </button>
        {/each}
        <label class="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-1.5">
          <span class="text-xs text-muted-foreground">Custom:</span>
          <input
            type="text"
            bind:value={s.customEmoji}
            maxlength="4"
            placeholder="🎉"
            class="w-14 bg-transparent text-lg focus:outline-none"
          />
        </label>
      </div>
    </div>
  {/if}

  <!-- Encode / decode panels -->
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
          {s.plaintext.length.toLocaleString()} chars · {new TextEncoder().encode(s.plaintext).length} bytes UTF-8
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
              onclick={useSample}
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
          placeholder={s.mode === 'emoji' ? 'Pick a carrier above' : 'Invisible payload appears here'}
          class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
        ></textarea>
        <div class="text-xs text-muted-foreground">
          {s.payload.length.toLocaleString()} code points
          {#if s.mode === 'emoji' && s.payload}
            · carrier: {s.customEmoji || s.selectedCarrier.emoji}
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="space-y-2 rounded-xl border border-border bg-card/60 p-4 shadow-glass">
        <h2 class="font-serif text-sm">Encoded payload</h2>
        <textarea
          bind:value={s.payloadToDecode}
          rows="6"
          placeholder={s.mode === 'emoji' ? 'Paste emoji-carrier payload' : 'Paste invisible Unicode payload'}
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
          placeholder={s.payloadToDecode ? 'Could not recover any hidden message' : 'Decoded message will appear here'}
          class="w-full rounded-lg border border-input bg-background/40 px-3 py-2 font-mono text-sm"
        ></textarea>
        <div class="text-xs text-muted-foreground">{s.decodedText.length.toLocaleString()} chars recovered</div>
      </div>
    </div>
  {/if}
</section>
