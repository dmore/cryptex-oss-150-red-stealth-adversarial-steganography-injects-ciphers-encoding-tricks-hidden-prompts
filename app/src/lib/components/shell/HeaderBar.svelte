<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import Wordmark from '$lib/components/brand/Wordmark.svelte';
  import Logo from '$lib/components/brand/Logo.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import ModePill from './ModePill.svelte';
  import Github from 'lucide-svelte/icons/github';
  import Settings from 'lucide-svelte/icons/settings';
  import History from 'lucide-svelte/icons/history';
  import HelpCircle from 'lucide-svelte/icons/circle-help';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';

  interface Props {
    onopenHistory: () => void;
  }
  let { onopenHistory }: Props = $props();

  // Guide icon is context-aware: on /chat routes it opens the Chat guide
  // landing entry; on a specific tool route it opens that tool's guide page;
  // otherwise it opens the top-level /guide index.
  const guideHref = $derived.by(() => {
    const path = $page.url.pathname;
    if (path.startsWith(base + '/chat')) return `${base}/guide/chat-basics/`;
    const toolMap: Record<string, string> = {
      transforms: 'transform',
      promptcraft: 'promptcraft',
      anticlassifier: 'anticlassifier',
      decode: 'decode',
      emoji: 'emoji'
    };
    for (const [route, slug] of Object.entries(toolMap)) {
      if (path.startsWith(base + '/' + route)) return `${base}/guide/${slug}/`;
    }
    return `${base}/guide/`;
  });

  // Auth routes (/login, /signup, /auth/*) get a stripped header — no Chat /
  // Tools mode toggle, no history drawer, no nav-y icons. Just the brand
  // wordmark and the theme toggle. Keeps the page focused on the form.
  const isAuthRoute = $derived.by(() => {
    const p = $page.url.pathname;
    const trimmed = p.endsWith('/') ? p.slice(0, -1) : p;
    return (
      trimmed === `${base}/login` ||
      trimmed === `${base}/signup` ||
      trimmed.startsWith(`${base}/auth/`)
    );
  });
</script>

<header class="sticky top-0 z-30 border-b border-border/60 glass backdrop-saturate-150">
  <div class="container flex h-14 items-center justify-between gap-4">
    <div class="flex items-center gap-3">
      <a href={base + '/'} class="flex items-center gap-2.5 transition-opacity hover:opacity-85">
        <Logo size={26} />
        <Wordmark size="md" />
      </a>
      {#if !isAuthRoute}
        <ModePill />
      {/if}
    </div>

    <div class="flex items-center gap-2">
      {#if !isAuthRoute}
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
          href={guideHref}
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
      {/if}
      <ThemeToggle />
    </div>
  </div>
</header>
