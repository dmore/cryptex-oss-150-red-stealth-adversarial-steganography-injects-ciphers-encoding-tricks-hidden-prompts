<script lang="ts">
  /**
   * Global slide-in drawer for session history. Three tabs:
   *  - Pinned: favorites (persistent across reloads)
   *  - Recent: lastUsed transforms (persistent)
   *  - Session: sessionLog entries (in-memory this session)
   *
   * Download menu at the bottom exports the entire session as JSON or
   * Markdown. Session log is zero disk footprint — the download is the only
   * way to preserve it.
   */
  import { fade, fly } from 'svelte/transition';
  import { sessionLog, downloadText, type SessionEntry } from '$lib/stores/sessionLog.svelte';
  import { favorites } from '$lib/stores/favorites.svelte';
  import { lastUsed } from '$lib/stores/lastUsed.svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { notify } from '$lib/stores/toast.svelte';
  import { cn } from '$lib/utils/cn';
  import X from 'lucide-svelte/icons/x';
  import Star from 'lucide-svelte/icons/star';
  import Clock from 'lucide-svelte/icons/clock';
  import Activity from 'lucide-svelte/icons/activity';
  import Download from 'lucide-svelte/icons/download';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';

  interface Props {
    open: boolean;
    onclose: () => void;
  }
  let { open, onclose }: Props = $props();

  type Tab = 'pinned' | 'recent' | 'session';
  let tab = $state<Tab>('session');

  const sessionEntries = $derived.by(() => [...sessionLog.entries].reverse());
  const pinnedItems = $derived(favorites.items);
  const recentItems = $derived(lastUsed.ordered);

  function dateStamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  }

  function downloadJSON() {
    const json = sessionLog.toJSON({ favorites: favorites.items, lastUsed: lastUsed.records });
    downloadText(json, `cryptex-session-${dateStamp()}.json`, 'application/json;charset=utf-8');
    notify.success('Session downloaded as JSON');
  }

  function downloadMarkdown() {
    const md = sessionLog.toMarkdown();
    downloadText(md, `cryptex-session-${dateStamp()}.md`, 'text/markdown;charset=utf-8');
    notify.success('Session downloaded as Markdown');
  }

  function clearSession() {
    if (sessionLog.size === 0) return;
    if (!confirm(`Clear ${sessionLog.size} session entr${sessionLog.size === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return;
    sessionLog.clear();
    notify.info('Session log cleared');
  }

  function jumpTo(transformName: string) {
    goto(base + '/transforms/');
    onclose();
    notify.info(`Open Transform · pick "${transformName}"`);
  }

  function relativeTime(ts: number): string {
    const delta = Date.now() - ts;
    if (delta < 60_000) return `${Math.max(1, Math.round(delta / 1000))}s ago`;
    if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`;
    return new Date(ts).toLocaleString();
  }

  function truncate(text: string, max = 80): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function entryRoute(entry: SessionEntry): string {
    return `${base}/${entry.tool === 'transform' ? 'transforms' : entry.tool}/`;
  }

  function reopen(entry: SessionEntry) {
    goto(entryRoute(entry));
    onclose();
    notify.info(`Open ${entry.tool} — the input is preserved if still in memory`);
  }
</script>

{#if open}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
    aria-label="Close session history"
    transition:fade={{ duration: 140 }}
    onclick={onclose}
  ></button>

  <div
    class="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-glass"
    transition:fly={{ x: 360, duration: 220, opacity: 1 }}
    role="dialog"
    aria-label="Session history"
    tabindex="-1"
  >
    <header class="flex items-center justify-between border-b border-border/60 px-5 py-3">
      <h2 class="font-serif text-lg">Session</h2>
      <button
        type="button"
        onclick={onclose}
        class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Close history drawer"
      >
        <X size={14} />
      </button>
    </header>

    <!-- Tabs -->
    <div class="flex gap-1 border-b border-border/60 p-1">
      <button
        type="button"
        onclick={() => (tab = 'session')}
        class={cn(
          'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          tab === 'session' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Activity size={12} /> This session
        <span class="ml-1 rounded-full bg-card/30 px-1.5 text-[10px]">{sessionLog.size}</span>
      </button>
      <button
        type="button"
        onclick={() => (tab = 'pinned')}
        class={cn(
          'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          tab === 'pinned' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Star size={12} /> Pinned
        <span class="ml-1 rounded-full bg-card/30 px-1.5 text-[10px]">{pinnedItems.length}</span>
      </button>
      <button
        type="button"
        onclick={() => (tab = 'recent')}
        class={cn(
          'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          tab === 'recent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Clock size={12} /> Recent
        <span class="ml-1 rounded-full bg-card/30 px-1.5 text-[10px]">{recentItems.length}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto px-3 py-2">
      {#if tab === 'session'}
        {#if sessionEntries.length === 0}
          <p class="py-12 text-center text-xs text-muted-foreground">
            No activity yet. Copy an output or run a transform, and it'll appear here.
          </p>
        {:else}
          <ol class="space-y-1.5">
            {#each sessionEntries as e (e.id)}
              <li class="group rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                      {e.tool}
                    </span>
                    <span class="shrink-0 text-[10px] text-muted-foreground">{e.operation}</span>
                    {#if e.label}
                      <span class="truncate text-[11px] text-foreground">· {e.label}</span>
                    {/if}
                  </div>
                  <span class="shrink-0 text-[10px] text-muted-foreground">{relativeTime(e.timestamp)}</span>
                </div>
                {#if e.input}
                  <div class="mt-1 truncate font-mono text-[11px] text-muted-foreground" title={e.input}>
                    in: {truncate(e.input, 100)}
                  </div>
                {/if}
                {#if e.output}
                  <div class="truncate font-mono text-[11px] text-foreground/80" title={e.output}>
                    out: {truncate(e.output, 100)}
                  </div>
                {/if}
                <div class="mt-1 flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onclick={() => reopen(e)}
                    class="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Open tool <ChevronRight size={10} />
                  </button>
                </div>
              </li>
            {/each}
          </ol>
        {/if}
      {:else if tab === 'pinned'}
        {#if pinnedItems.length === 0}
          <p class="py-12 text-center text-xs text-muted-foreground">
            Star a transform in the Transform tab to pin it here.
          </p>
        {:else}
          <ul class="space-y-1">
            {#each pinnedItems as name (name)}
              <li>
                <button
                  type="button"
                  onclick={() => jumpTo(name)}
                  class="flex w-full items-center justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-3 py-2 text-sm hover:border-primary/30 hover:bg-muted"
                >
                  <span class="flex items-center gap-2">
                    <Star size={12} class="text-accent fill-accent" />
                    {name}
                  </span>
                  <ChevronRight size={12} class="text-muted-foreground" />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {:else}
        {#if recentItems.length === 0}
          <p class="py-12 text-center text-xs text-muted-foreground">
            Use a transform and it'll show up here.
          </p>
        {:else}
          <ul class="space-y-1">
            {#each recentItems as name (name)}
              <li>
                <button
                  type="button"
                  onclick={() => jumpTo(name)}
                  class="flex w-full items-center justify-between gap-2 rounded-md border border-border/50 bg-background/40 px-3 py-2 text-sm hover:border-primary/30 hover:bg-muted"
                >
                  <span class="flex items-center gap-2">
                    <Clock size={12} class="text-muted-foreground" />
                    {name}
                  </span>
                  {#if lastUsed.records[name]}
                    <span class="text-[10px] text-muted-foreground">{relativeTime(lastUsed.records[name])}</span>
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>

    <!-- Actions -->
    <footer class="border-t border-border/60 p-3 space-y-2">
      <div class="text-[10px] text-muted-foreground leading-relaxed">
        Session log stays in memory only — it disappears on reload. Download to keep your work.
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          onclick={downloadJSON}
          disabled={sessionLog.size === 0}
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={12} /> JSON
        </button>
        <button
          type="button"
          onclick={downloadMarkdown}
          disabled={sessionLog.size === 0}
          class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download size={12} /> Markdown
        </button>
        <button
          type="button"
          onclick={clearSession}
          disabled={sessionLog.size === 0}
          class="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
          aria-label="Clear session log"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </footer>
  </div>
{/if}
