<script lang="ts">
  import { base } from '$app/paths';
  import { transformerCount, categories } from '$lib/transformers/registry';
  import { mutatorTechniques } from '$lib/techniques/from-mutators';
  import { classifierTechniques } from '$lib/techniques/from-classifier';
  import { compositeTechniques } from '$lib/techniques/from-composites';
  import Lock from 'lucide-svelte/icons/lock';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import Cpu from 'lucide-svelte/icons/cpu';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import Wand from 'lucide-svelte/icons/wand-sparkles';
  import ScanSearch from 'lucide-svelte/icons/scan-search';
  import Smile from 'lucide-svelte/icons/smile';
  import Hash from 'lucide-svelte/icons/hash';
  import Bomb from 'lucide-svelte/icons/bomb';
  import FlaskConical from 'lucide-svelte/icons/flask-conical';
  import Shield from 'lucide-svelte/icons/shield';
  import Skull from 'lucide-svelte/icons/skull';
  import Target from 'lucide-svelte/icons/target';
  import Zap from 'lucide-svelte/icons/zap';
  import MessageSquare from 'lucide-svelte/icons/message-square';
  import Bolt from 'lucide-svelte/icons/zap';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import Fingerprint from 'lucide-svelte/icons/fingerprint';
  import Globe from 'lucide-svelte/icons/globe';
  import Layers from 'lucide-svelte/icons/layers';
  import ArrowLeftRight from 'lucide-svelte/icons/arrow-left-right';

  const mutatorCount = mutatorTechniques().length;
  const classifierCount = classifierTechniques().length;
  const compositeCount = compositeTechniques().length;
  const toolsCount = 25;

  const stats = [
    { label: 'Transforms',     value: transformerCount, icon: Wand,       blurb: 'Encodings, ciphers, Unicode lookalikes, ancient scripts.' },
    { label: 'Mutators',       value: mutatorCount,     icon: Sparkles,   blurb: 'Single-prompt rewriters from 2024-2026 literature.' },
    { label: 'Workbenches',    value: toolsCount,       icon: FlaskConical, blurb: 'Specialized red-team UIs, each one tab in the rail.' },
    { label: 'Classifiers',    value: classifierCount,  icon: Fingerprint, blurb: 'Detection-evasion paraphrase strategies.' },
    { label: 'Composites',     value: compositeCount,   icon: Layers,     blurb: 'Pre-built attack chains.' },
    { label: 'Categories',     value: categories.length, icon: Globe,     blurb: 'Transformer family taxonomies.' }
  ];

  const features = [
    { icon: Lock,         title: 'Local-first',          body: 'Tool inputs and state stay in your browser. No telemetry on tool surfaces.' },
    { icon: KeyRound,     title: 'Bring your own key',   body: 'Direct browser-to-provider calls. Keys live in localStorage.' },
    { icon: Bolt,         title: 'Browser-only',         body: 'Static site. Deploys anywhere; runs everywhere.' },
    { icon: Globe,        title: 'Multi-provider',       body: 'OpenRouter, Anthropic direct, OpenAI-compatible endpoints.' },
    { icon: Cpu,          title: 'Built to be audited',  body: 'Every transformer, mutator, and judge is inspectable.' },
    { icon: Sparkles,     title: 'Production-grade',     body: 'Real apps deploy this. Static, hardened, MIT-licensed.' }
  ];

  const surfaces = [
    { icon: Wand,         label: 'Transform',     desc: '159 encoders / decoders' },
    { icon: ScanSearch,   label: 'Decode',        desc: 'Universal cipher detector' },
    { icon: Smile,        label: 'Emoji',         desc: 'Variation-selector stego' },
    { icon: ArrowLeftRight, label: 'Bijection',  desc: 'Alphapr cipher generator' },
    { icon: MessageSquare, label: 'Gibberish',    desc: 'Dictionary + removal puzzles' },
    { icon: Hash,         label: 'Tokenizer',     desc: 'BPE visualizer' },
    { icon: Bomb,         label: 'Tokenade',      desc: 'Token-cost stress payloads' },
    { icon: FlaskConical, label: 'Fuzzer',        desc: 'Mutation strategies' },
    { icon: Sparkles,     label: 'PromptCraft',   desc: 'All mutators, parallel variants' },
    { icon: Shield,       label: 'AntiClassifier', desc: 'Paraphrase rewrites' },
    { icon: Skull,        label: 'Red-team labs', desc: '15 specialized workbenches' },
    { icon: Target,       label: 'Benchmarks',    desc: 'HarmBench / StrongREJECT / JBB' }
  ];
</script>

<svelte:head>
  <title>About · Cryptex</title>
  <meta
    name="description"
    content="Cryptex — a browser-only text lab for AI red-teamers. Local-first, BYOK, audited."
  />
</svelte:head>

<article class="space-y-12 pb-16">
  <!-- ===== Hero — restored, slightly tightened ===== -->
  <header class="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 shadow-glass sm:p-8">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full opacity-30 blur-3xl"
      style="background: radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 65%);"
    ></div>
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -bottom-24 -left-12 h-64 w-64 rounded-full opacity-20 blur-3xl"
      style="background: radial-gradient(circle, hsl(var(--accent) / 0.35), transparent 65%);"
    ></div>

    <div class="relative space-y-4">
      <div class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Sparkles size={10} class="text-primary" />
        <span>AI red-team research platform</span>
      </div>

      <h1 class="font-serif text-2xl tracking-tight text-balance sm:text-3xl lg:text-4xl">
        The text lab that <span class="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent italic">runs in your browser</span>.
      </h1>
      <p class="max-w-2xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
        {transformerCount} transforms. {mutatorCount} mutators. {toolsCount} red-team workbenches. Bring your own key,
        drop in any prompt — and never ship a single byte to a server we control.
      </p>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <a
          href={`${base}/transforms/`}
          class="group inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
        >
          Open the lab
          <ArrowRight size={12} class="transition-transform group-hover:translate-x-0.5" />
        </a>
        <a
          href={`${base}/guide/`}
          class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3.5 text-[13px] font-medium transition-colors hover:bg-muted/40"
        >
          Read the guide
        </a>
      </div>
    </div>
  </header>

  <!-- ===== Stats ===== -->
  <section class="space-y-3">
    <div class="flex items-end justify-between gap-3 border-b border-border/40 pb-2">
      <div>
        <h2 class="font-serif text-lg tracking-tight">By the numbers</h2>
        <p class="text-[12px] text-muted-foreground">Live counts from the registries shipped with this build.</p>
      </div>
    </div>

    <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {#each stats as s}
        <div class="group relative overflow-hidden rounded-xl border border-border bg-card/60 p-3.5 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40">
          <div
            aria-hidden="true"
            class="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-25"
            style="background: radial-gradient(circle, hsl(var(--primary) / 0.55), transparent 70%);"
          ></div>
          <div class="relative">
            <div class="flex items-center justify-between">
              <span class="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                <s.icon size={13} />
              </span>
              <span class="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{s.label}</span>
            </div>
            <div class="mt-1.5 font-mono text-3xl font-bold tracking-tight text-foreground tabular-nums">
              {s.value}
            </div>
            <p class="mt-0.5 text-[11px] leading-snug text-muted-foreground">{s.blurb}</p>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ===== Surfaces ===== -->
  <section class="space-y-3">
    <div>
      <h2 class="font-serif text-lg tracking-tight">Surfaces</h2>
      <p class="text-[12px] text-muted-foreground">Twenty-five tabs in the rail. One unified shell.</p>
    </div>
    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {#each surfaces as item}
        <div class="group flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/40 p-3 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/80">
          <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <item.icon size={15} />
          </span>
          <div class="min-w-0 flex-1">
            <div class="font-serif text-[13px] text-foreground">{item.label}</div>
            <div class="mt-0.5 text-[11px] leading-snug text-muted-foreground">{item.desc}</div>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ===== Why ===== -->
  <section class="space-y-3">
    <div>
      <h2 class="font-serif text-lg tracking-tight">Why it's built this way</h2>
      <p class="text-[12px] text-muted-foreground">Six commitments baked into the architecture.</p>
    </div>
    <div class="grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
      {#each features as f}
        <article class="group relative overflow-hidden rounded-xl border border-border bg-card/60 p-4 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40">
          <div class="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary transition-all group-hover:rotate-3 group-hover:bg-primary group-hover:text-primary-foreground">
            <f.icon size={14} />
          </div>
          <h3 class="mb-1 font-serif text-[14px] leading-tight">{f.title}</h3>
          <p class="text-[12px] leading-relaxed text-muted-foreground">{f.body}</p>
        </article>
      {/each}
    </div>
  </section>

  <!-- ===== Privacy callout ===== -->
  <section class="rounded-2xl border border-border/60 bg-gradient-to-br from-card/60 via-card/30 to-transparent p-5 shadow-glass">
    <div class="grid gap-4 lg:grid-cols-[auto_1fr] lg:items-center">
      <div class="flex h-14 w-14 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
        <Lock size={22} />
      </div>
      <div class="space-y-1.5">
        <h2 class="font-serif text-lg tracking-tight">Privacy is the architecture</h2>
        <p class="text-[13px] leading-relaxed text-muted-foreground">
          AI calls go directly from your browser to whichever provider you configured. Cryptex is not in the
          request path. API keys and tool state live in <code class="rounded bg-muted/40 px-1.5 py-0.5 font-mono text-[11px]">localStorage</code>.
          See the <a href="{base}/privacy/" class="font-medium text-primary underline-offset-2 hover:underline">privacy policy</a>.
        </p>
      </div>
    </div>
  </section>

  <!-- ===== CTA ===== -->
  <section class="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 shadow-primary sm:p-7">
    <div class="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
      <div class="space-y-1.5">
        <h2 class="font-serif text-xl tracking-tight">Ready to break things, ethically?</h2>
        <p class="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Pick a workbench. Drop in a prompt. The decoder runs offline; the AI tools run against your own key.
        </p>
      </div>
      <div class="flex flex-col gap-1.5 sm:flex-row lg:flex-col">
        <a
          href={`${base}/transforms/`}
          class="group inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
        >
          Launch the lab
          <ArrowRight size={12} class="transition-transform group-hover:translate-x-0.5" />
        </a>
        <a
          href={`${base}/redteam/`}
          class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background/60 px-4 text-[13px] font-medium transition-colors hover:bg-muted/40"
        >
          <Zap size={12} /> Red-team tools
        </a>
      </div>
    </div>
  </section>

  <!-- ===== Quiet credit ===== -->
  <section class="border-t border-border/40 pt-6 text-center">
    <p class="font-serif text-[13px] italic text-muted-foreground">
      Vibecoded with stubborn hands and a strong cup of coffee. ☕
    </p>
    <p class="mt-1 text-[11px] text-muted-foreground/60">
      © {new Date().getFullYear()} Cryptex
    </p>
  </section>
</article>
