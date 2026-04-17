<script lang="ts">
  import { transformerCount, categories } from '$lib/transformers/registry';
  import Wordmark from '$lib/components/brand/Wordmark.svelte';
  import Logo from '$lib/components/brand/Logo.svelte';
</script>

<svelte:head><title>About · Cryptex</title></svelte:head>

<section class="space-y-10 max-w-2xl">
  <header class="space-y-4">
    <div class="flex items-center gap-3">
      <Logo size={40} />
      <Wordmark size="lg" />
    </div>
    <p class="text-muted-foreground text-lg leading-relaxed text-balance">
      A local-first text lab for encodings, ciphers, Unicode styles, ancient scripts, and steganography.
      Everything runs in your browser — no accounts, no telemetry.
    </p>
  </header>

  <div class="grid gap-3 sm:grid-cols-3">
    <div class="rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <div class="text-3xl font-serif text-primary">{transformerCount}</div>
      <div class="text-xs text-muted-foreground uppercase tracking-wider">Transforms</div>
    </div>
    <div class="rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <div class="text-3xl font-serif text-primary">{categories.length}</div>
      <div class="text-xs text-muted-foreground uppercase tracking-wider">Categories</div>
    </div>
    <div class="rounded-xl border border-border bg-card/60 p-4 shadow-glass">
      <div class="text-3xl font-serif text-primary">12</div>
      <div class="text-xs text-muted-foreground uppercase tracking-wider">Tools</div>
    </div>
  </div>

  <div class="space-y-3">
    <h2 class="font-serif text-xl">What's inside</h2>
    <ul class="space-y-2 text-sm text-muted-foreground">
      <li><strong class="text-foreground">Transform.</strong> Every encoding, cipher, and Unicode-style transform, searchable and pinnable.</li>
      <li><strong class="text-foreground">Decode.</strong> Paste anything, get ranked candidates with confidence scoring.</li>
      <li><strong class="text-foreground">Emoji.</strong> Hide messages in variation selectors or the Unicode Tags block.</li>
      <li><strong class="text-foreground">Gibberish.</strong> Dictionary-mapped gibberish and letter-removal puzzle variants.</li>
      <li><strong class="text-foreground">Splitter + Tokenizer.</strong> Chunk by size / word / sentence / token; visualize BPE segmentation.</li>
      <li><strong class="text-foreground">Tokenade + Fuzzer.</strong> Generate token-heavy payloads and mutation variants for testing.</li>
      <li><strong class="text-foreground">Bijection.</strong> Character-to-token mapping payloads for research prompts.</li>
      <li><strong class="text-foreground">PromptCraft + Anti-Classifier + Translate.</strong> Optional AI features via your own OpenRouter key.</li>
    </ul>
  </div>

  <div class="space-y-3 rounded-xl border border-border bg-card/40 p-5">
    <h2 class="font-serif text-xl">Privacy</h2>
    <p class="text-sm text-muted-foreground leading-relaxed">
      Core tools work entirely offline — no network calls for any transform, decoder, or steganography
      operation. The AI-powered tools (PromptCraft, Anti-Classifier, Translate, optional decoder translate)
      call OpenRouter directly from your browser using a key you provide. Your key is stored only in
      <code class="font-mono text-xs bg-muted px-1 rounded">localStorage</code> and never sent elsewhere.
    </p>
  </div>

  <div class="space-y-1 text-xs text-muted-foreground">
    <div>
      Built by
      <a
        href="https://github.com/m4xx101"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary underline underline-offset-2 hover:text-primary/80"
      >@m4xx101</a>.
      Source on
      <a
        href="https://github.com/m4xx101/cryptex"
        target="_blank"
        rel="noopener noreferrer"
        class="text-primary underline underline-offset-2 hover:text-primary/80"
      >GitHub</a>.
    </div>
    <div>Cryptex is a rebrand and SvelteKit rewrite of the original P4RS3LT0NGV3 project.</div>
  </div>
</section>
