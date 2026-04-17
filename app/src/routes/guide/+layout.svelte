<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { cn } from '$lib/utils/cn';
  import { guideByCategory } from '$lib/guide';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';

  let { children } = $props();

  const groups = guideByCategory();

  const pathname = $derived($page.url.pathname);
  const currentSlug = $derived(
    pathname.replace(base, '').replace(/^\/guide\/?/, '').replace(/\/$/, '')
  );

  function hrefFor(slug: string): string {
    return `${base}/guide/${slug}/`;
  }

  function isActive(slug: string): boolean {
    return currentSlug === slug;
  }

  let mobileNavOpen = $state(false);

  const activeEntry = $derived(
    groups.flatMap((g) => g.entries).find((e) => e.slug === currentSlug)
  );
</script>

<svelte:head>
  <title>{activeEntry ? `${activeEntry.meta.title} · Guide · Cryptex` : 'Guide · Cryptex'}</title>
  <meta
    name="description"
    content={activeEntry?.meta.description ??
      'Cryptex guide — tools, recipes, and policy for AI red-teamers.'}
  />
</svelte:head>

<section class="grid gap-8 md:grid-cols-[16rem_1fr] lg:grid-cols-[18rem_1fr]">
  <!-- Left nav — desktop -->
  <aside class="hidden md:block">
    <nav
      aria-label="Guide sections"
      class="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2"
    >
      <div class="space-y-6">
        {#each groups as group (group.category)}
          <div>
            <div
              class="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
              {group.label}
            </div>
            <ul class="space-y-0.5">
              {#each group.entries as entry (entry.slug)}
                {@const active = isActive(entry.slug)}
                <li>
                  <a
                    href={hrefFor(entry.slug)}
                    class={cn(
                      'block rounded-md px-2.5 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {entry.meta.title}
                  </a>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    </nav>
  </aside>

  <!-- Left nav — mobile accordion -->
  <div class="md:hidden">
    <button
      type="button"
      onclick={() => (mobileNavOpen = !mobileNavOpen)}
      class="flex w-full items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2 text-sm font-medium"
      aria-expanded={mobileNavOpen}
      aria-controls="guide-mobile-nav"
    >
      <span>
        {#if activeEntry}
          {activeEntry.meta.title}
        {:else}
          Guide sections
        {/if}
      </span>
      <ChevronDown
        size={16}
        class={cn('transition-transform', mobileNavOpen && 'rotate-180')}
      />
    </button>
    {#if mobileNavOpen}
      <nav
        id="guide-mobile-nav"
        aria-label="Guide sections"
        class="mt-2 rounded-lg border border-border bg-card/60 p-3"
      >
        <div class="space-y-4">
          {#each groups as group (group.category)}
            <div>
              <div
                class="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                {group.label}
              </div>
              <ul class="space-y-0.5">
                {#each group.entries as entry (entry.slug)}
                  {@const active = isActive(entry.slug)}
                  <li>
                    <a
                      href={hrefFor(entry.slug)}
                      onclick={() => (mobileNavOpen = false)}
                      class={cn(
                        'block rounded-md px-2 py-1.5 text-sm transition-colors',
                        active
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                      aria-current={active ? 'page' : undefined}
                    >
                      {entry.meta.title}
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          {/each}
        </div>
      </nav>
    {/if}
  </div>

  <!-- Right content pane -->
  <div class="min-w-0">
    {@render children?.()}
  </div>
</section>
