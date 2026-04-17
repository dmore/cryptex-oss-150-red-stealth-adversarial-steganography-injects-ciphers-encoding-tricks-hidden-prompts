<script lang="ts">
  import { base } from '$app/paths';
  import Wordmark from '$lib/components/brand/Wordmark.svelte';
  import Logo from '$lib/components/brand/Logo.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import Github from 'lucide-svelte/icons/github';
  import Settings from 'lucide-svelte/icons/settings';
  import History from 'lucide-svelte/icons/history';
  import HelpCircle from 'lucide-svelte/icons/circle-help';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';

  interface Props {
    onopenHistory: () => void;
  }
  let { onopenHistory }: Props = $props();
</script>

<header class="sticky top-0 z-30 border-b border-border/60 glass backdrop-saturate-150">
  <div class="container flex h-14 items-center justify-between gap-4">
    <a href={base + '/'} class="flex items-center gap-2.5 transition-opacity hover:opacity-85">
      <Logo size={26} />
      <Wordmark size="md" />
      <span
        class="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary"
      >
        <span class="h-1 w-1 rounded-full bg-primary" aria-hidden="true"></span>
        red-team
      </span>
    </a>

    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={onopenHistory}
        class="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Open session history"
        title="Session history (favorites, recent, activity)"
      >
        <History size={16} />
        {#if sessionLog.size > 0}
          <span
            class="absolute -top-1 -right-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground"
            aria-label={`${sessionLog.size} session entries`}
          >
            {sessionLog.size > 99 ? '99+' : sessionLog.size}
          </span>
        {/if}
      </button>
      <a
        href={base + '/guide/'}
        class="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Open guide"
        title="Guide"
      >
        <HelpCircle size={16} />
      </a>
      <a
        href="https://github.com/m4xx101/cryptex"
        target="_blank"
        rel="noopener noreferrer"
        class="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Source on GitHub"
      >
        <Github size={16} />
      </a>
      <a
        href={base + '/settings/'}
        class="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Settings"
      >
        <Settings size={16} />
      </a>
      <ThemeToggle />
    </div>
  </div>
</header>
