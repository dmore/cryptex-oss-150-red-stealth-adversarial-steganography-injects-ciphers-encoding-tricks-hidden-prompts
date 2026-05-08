<script lang="ts">
  import { base } from '$app/paths';
  import { guideByCategory } from '$lib/guide';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import Wrench from 'lucide-svelte/icons/wrench';
  import BookOpen from 'lucide-svelte/icons/book-open';
  import Shield from 'lucide-svelte/icons/shield';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import Bolt from 'lucide-svelte/icons/zap';
  import Lock from 'lucide-svelte/icons/lock';

  const groups = guideByCategory();

  const categoryIcons: Record<string, typeof Sparkles> = {
    intro: Sparkles,
    tools: Wrench,
    recipes: BookOpen,
    policy: Shield
  };

  const categoryAccents: Record<string, string> = {
    intro: 'from-primary/15 via-primary/5',
    tools: 'from-sky-500/10 via-sky-500/5',
    recipes: 'from-amber-500/10 via-amber-500/5',
    policy: 'from-rose-500/10 via-rose-500/5'
  };

  const stats: Array<{ label: string; value: string; icon: typeof Bolt }> = [
    { label: 'Transforms',     value: '162', icon: Bolt },
    { label: 'Mutators',       value: '36',  icon: Sparkles },
    { label: 'Red-team tools', value: '26',  icon: Wrench },
    { label: 'Telemetry',      value: 'Zero', icon: Lock }
  ];
</script>

<div class="space-y-10">
  <!-- ===== Hero ===== -->
  <header class="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 shadow-glass sm:p-8">
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-30 blur-3xl"
      style="background: radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 65%);"
    ></div>
    <div class="relative space-y-4">
      <div class="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <Sparkles size={10} class="text-primary" />
        <span>Field manual</span>
      </div>
      <h1 class="font-serif text-2xl tracking-tight text-balance sm:text-3xl lg:text-4xl">
        The AI red-teamer's <span class="text-primary italic">field manual</span>
      </h1>
      <p class="max-w-2xl text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
        Practical recipes, technique catalogs, and end-to-end attack chains for security
        researchers evaluating LLM robustness.
      </p>
      <div class="flex flex-wrap gap-2 pt-1">
        <a
          href={`${base}/guide/getting-started/`}
          class="group inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5"
        >
          Start in 4 steps
          <ArrowRight size={12} class="transition-transform group-hover:translate-x-0.5" />
        </a>
        <a
          href={`${base}/guide/redteam-workbenches/`}
          class="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3.5 text-[13px] font-medium transition-colors hover:bg-muted/40"
        >
          Browse workbenches
        </a>
      </div>

      <!-- Stat strip -->
      <div class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {#each stats as s}
          <div class="rounded-lg border border-border/60 bg-background/40 p-2.5">
            <div class="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <s.icon size={10} class="text-primary" />
              {s.label}
            </div>
            <div class="mt-0.5 font-mono text-xl font-semibold tracking-tight text-foreground">
              {s.value}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </header>

  <!-- ===== Quickstart triplet ===== -->
  <section class="grid gap-2.5 sm:grid-cols-3">
    <a
      href={`${base}/guide/getting-started/`}
      class="group rounded-lg border border-border bg-card/60 p-3.5 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div class="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Sparkles size={13} />
      </div>
      <div class="font-serif text-[14px]">Getting started</div>
      <p class="mt-0.5 text-[11px] text-muted-foreground">
        First steps: key setup, transforms, red-team workbenches.
      </p>
    </a>
    <a
      href={`${base}/guide/transform/`}
      class="group rounded-lg border border-border bg-card/60 p-3.5 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div class="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Wrench size={13} />
      </div>
      <div class="font-serif text-[14px]">Tools deep-dive</div>
      <p class="mt-0.5 text-[11px] text-muted-foreground">
        159 transforms, decoder, encoder pipelines.
      </p>
    </a>
    <a
      href={`${base}/guide/jailbreak-bank/`}
      class="group rounded-lg border border-border bg-card/60 p-3.5 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div class="mb-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
        <BookOpen size={13} />
      </div>
      <div class="font-serif text-[14px]">Jailbreak bank</div>
      <p class="mt-0.5 text-[11px] text-muted-foreground">
        Curated chains with expected outputs and analysis.
      </p>
    </a>
  </section>

  <!-- ===== All topics by category ===== -->
  {#each groups as group (group.category)}
    {@const Icon = categoryIcons[group.category] ?? BookOpen}
    {@const accent = categoryAccents[group.category] ?? 'from-muted/10 via-transparent'}
    <section class="space-y-3">
      <div class={'flex items-baseline justify-between rounded-lg border border-border/40 bg-gradient-to-r ' + accent + ' to-transparent px-3 py-2'}>
        <div class="flex items-center gap-2">
          <span class="inline-flex h-6 w-6 items-center justify-center rounded-md bg-card/60 text-primary">
            <Icon size={12} />
          </span>
          <h2 class="font-serif text-base tracking-tight">{group.label}</h2>
        </div>
        <span class="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {group.entries.length} {group.entries.length === 1 ? 'topic' : 'topics'}
        </span>
      </div>
      <div class="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {#each group.entries as entry (entry.slug)}
          <a
            href={`${base}/guide/${entry.slug}/`}
            class="group block rounded-lg border border-border bg-card/60 p-3 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40"
          >
            <div class="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-primary/80">
              {group.label}
            </div>
            <div class="font-serif text-[14px] leading-tight tracking-tight text-foreground">
              {entry.meta.title}
            </div>
            <p class="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {entry.meta.description}
            </p>
          </a>
        {/each}
      </div>
    </section>
  {/each}
</div>
