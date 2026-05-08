<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Wordmark from '$lib/components/brand/Wordmark.svelte';
  import Logo from '$lib/components/brand/Logo.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import Settings from 'lucide-svelte/icons/settings';
  import History from 'lucide-svelte/icons/history';
  import HelpCircle from 'lucide-svelte/icons/circle-help';
  import LogOut from 'lucide-svelte/icons/log-out';
  import Loader from 'lucide-svelte/icons/loader-circle';
  import { sessionLog } from '$lib/stores/sessionLog.svelte';
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { notify } from '$lib/stores/toast.svelte';

  let signingOut = $state(false);
  async function signOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      await session.signOut();
      notify.success('Signed out');
      void goto(`${base}/login`);
    } catch {
      notify.error('Could not sign out. Try again.');
    } finally {
      signingOut = false;
    }
  }

  interface Props {
    onopenHistory: () => void;
  }
  let { onopenHistory }: Props = $props();

  // Guide icon is context-aware: on a specific tool route it opens that
  // tool's guide page; otherwise it opens the top-level /guide index.
  const guideHref = $derived.by(() => {
    const path = $page.url.pathname;
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

  // Auth routes (/login, /signup, /auth/*) hide the heavy nav controls
  // (history, guide, settings) so the page can focus on the form.
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
          href={base + '/settings/'}
          class="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Settings"
        >
          <Settings size={16} />
        </a>
        {#if featureFlags.authEnabled && session.isSignedIn}
          <button
            type="button"
            onclick={signOut}
            disabled={signingOut}
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card/50 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40 disabled:opacity-50"
            aria-label="Sign out"
            title={signingOut ? 'Signing out…' : 'Sign out'}
          >
            {#if signingOut}
              <Loader size={16} class="animate-spin" />
            {:else}
              <LogOut size={16} />
            {/if}
          </button>
        {/if}
      {/if}
      <ThemeToggle />
    </div>
  </div>
</header>
