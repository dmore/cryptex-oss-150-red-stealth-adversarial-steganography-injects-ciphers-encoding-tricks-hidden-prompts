<script lang="ts">
  import { base } from '$app/paths';
  import { guideByCategory } from '$lib/guide';

  const groups = guideByCategory();
</script>

<div class="space-y-10">
  <header class="space-y-3">
    <h1 class="font-serif text-3xl tracking-tight">Guide</h1>
    <p class="max-w-2xl text-muted-foreground leading-relaxed">
      Cryptex is an AI red-teamer's text lab — 162 transforms, a universal decoder,
      emoji steganography, BYOK AI rewrites, and a Unicode abuse catalog. This
      guide walks you through the tools, shows worked recipes, and covers how
      the privacy model works. Pick a topic to get started.
    </p>
  </header>

  {#each groups as group (group.category)}
    <section class="space-y-4">
      <div class="flex items-baseline justify-between">
        <h2 class="font-serif text-xl tracking-tight">{group.label}</h2>
        <span class="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {group.entries.length} {group.entries.length === 1 ? 'topic' : 'topics'}
        </span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {#each group.entries as entry (entry.slug)}
          <a
            href={`${base}/guide/${entry.slug}/`}
            class="group block rounded-xl border border-border bg-card/60 p-4 shadow-glass transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-primary"
          >
            <div class="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
              {group.label}
            </div>
            <div class="font-serif text-lg leading-tight tracking-tight text-foreground">
              {entry.meta.title}
            </div>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
              {entry.meta.description}
            </p>
            <div class="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
              Read →
            </div>
          </a>
        {/each}
      </div>
    </section>
  {/each}
</div>
