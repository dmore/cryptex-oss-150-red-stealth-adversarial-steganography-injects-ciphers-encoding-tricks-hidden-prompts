<script module lang="ts">
  import Wand from 'lucide-svelte/icons/wand-sparkles';
  import ScanSearch from 'lucide-svelte/icons/scan-search';
  import Smile from 'lucide-svelte/icons/smile';
  import Bomb from 'lucide-svelte/icons/bomb';
  import FlaskConical from 'lucide-svelte/icons/flask-conical';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import Shield from 'lucide-svelte/icons/shield';
  import Skull from 'lucide-svelte/icons/skull';
  import Zap from 'lucide-svelte/icons/zap';
  import ImageIcon from 'lucide-svelte/icons/image';
  import Link from 'lucide-svelte/icons/link';
  import Beaker from 'lucide-svelte/icons/flask-round';
  import GitCompare from 'lucide-svelte/icons/git-compare';
  import History from 'lucide-svelte/icons/history';
  import Wrench from 'lucide-svelte/icons/wrench';
  import FileText from 'lucide-svelte/icons/file-text';
  import Target from 'lucide-svelte/icons/target';
  import Gauge from 'lucide-svelte/icons/gauge';
  import ShieldCheck from 'lucide-svelte/icons/shield-check';
  import Fingerprint from 'lucide-svelte/icons/fingerprint';
  import Droplet from 'lucide-svelte/icons/droplet';
  import FileScan from 'lucide-svelte/icons/file-scan';
  import Brain from 'lucide-svelte/icons/brain';
  import Layers from 'lucide-svelte/icons/layers';
  import MessageSquareText from 'lucide-svelte/icons/message-square-text';
  import Unplug from 'lucide-svelte/icons/unplug';
  import Rocket from 'lucide-svelte/icons/rocket';
  import Braces from 'lucide-svelte/icons/braces';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Tab = {
    href: string;
    label: string;
    // lucide-svelte icon component; deliberately `any` so any of the
    // imported icon classes assigns cleanly without bespoke types.
    icon: any;
    /** activeRuns toolId for this tool. Equal to the route's terminal segment. */
    toolId: string;
    /** Coarse group used by MobileNavDrawer to section the list. */
    group: 'techniques' | 'redteam';
    // 'legacy' (v2.7): technique class frontier models patched — kept as an
    // educational primitive / composable layer, not a standalone bypass.
    status?: 'live' | 'soon' | 'legacy';
  };

  // Single source of truth for the visible tool list. Exported so
  // MobileNavDrawer can render the same set on phones without keeping a
  // parallel constant.
  //
  // v2.2 (Wave 10.2): /gibberish, /tokenizer, /bijection deprecated and
  // hidden from the rail. Routes still resolve (deep-links still work)
  // and the pages render a deprecation banner pointing at the replacement.
  // Per the v2.2 audit: gibberish was pure novelty (no red-team value),
  // tokenizer overlapped with /fuzzer + standard LLM dev tools, bijection
  // was functionally subsumed by /transforms.
  export const tabs: Tab[] = [
    // v2.6 (Wave 17): Campaign front door — the "it just works" pipeline.
    // First tab; also the home-route landing page.
    { href: '/campaign',             label: 'Campaign',     icon: Rocket,           toolId: 'campaign',       group: 'techniques', status: 'live' },
    { href: '/transforms',           label: 'Transform',    icon: Wand,             toolId: 'transforms',     group: 'techniques', status: 'live' },
    { href: '/decode',               label: 'Decode',       icon: ScanSearch,       toolId: 'decode',         group: 'techniques', status: 'live' },
    { href: '/emoji',                label: 'Emoji',        icon: Smile,            toolId: 'emoji',          group: 'techniques', status: 'live' },
    { href: '/tokenade',             label: 'Tokenade',     icon: Bomb,             toolId: 'tokenade',       group: 'techniques', status: 'live' },
    { href: '/fuzzer',               label: 'Fuzzer',       icon: FlaskConical,     toolId: 'fuzzer',         group: 'techniques', status: 'live' },
    { href: '/promptcraft',          label: 'PromptCraft',  icon: Sparkles,         toolId: 'promptcraft',    group: 'techniques', status: 'live' },
    { href: '/anticlassifier',       label: 'Anti-classifier', icon: Shield,        toolId: 'anticlassifier', group: 'techniques', status: 'live' },
    { href: '/redteam/adv-suffix',       label: 'AdvSuffix',  icon: Skull,           toolId: 'adv-suffix',       group: 'redteam', status: 'legacy' },
    { href: '/redteam/glitch-tokens',    label: 'Glitch',     icon: Zap,             toolId: 'glitch-tokens',    group: 'redteam', status: 'legacy' },
    { href: '/redteam/ocr-injection',    label: 'OCR Inject', icon: ImageIcon,       toolId: 'ocr-injection',    group: 'redteam', status: 'live' },
    { href: '/redteam/markdown-exfil',   label: 'MD Exfil',   icon: Link,            toolId: 'markdown-exfil',   group: 'redteam', status: 'live' },
    { href: '/redteam/probe-lab',        label: 'Probe Lab',  icon: Beaker,          toolId: 'probe-lab',        group: 'redteam', status: 'live' },
    { href: '/redteam/cross-model-diff', label: 'Cross-Diff', icon: GitCompare,      toolId: 'cross-model-diff', group: 'redteam', status: 'live' },
    { href: '/redteam/replayer',          label: 'Replayer',   icon: History,         toolId: 'replayer',         group: 'redteam', status: 'live' },
    { href: '/redteam/tool-result-lab',   label: 'Tool Lab',    icon: Wrench,         toolId: 'tool-result-lab',  group: 'redteam', status: 'live' },
    { href: '/redteam/indirect-injection', label: 'Indirect',   icon: FileText,       toolId: 'indirect-injection', group: 'redteam', status: 'live' },
    { href: '/redteam/harmbench',          label: 'HarmBench',   icon: Target,         toolId: 'harmbench',        group: 'redteam', status: 'live' },
    { href: '/redteam/strongreject',       label: 'StrongREJECT', icon: Gauge,         toolId: 'strongreject',     group: 'redteam', status: 'live' },
    { href: '/redteam/jbb',                label: 'JBB',         icon: ShieldCheck,    toolId: 'jbb',              group: 'redteam', status: 'live' },
    { href: '/redteam/fingerprinter',      label: 'Fingerprint', icon: Fingerprint,    toolId: 'fingerprinter',    group: 'redteam', status: 'live' },
    { href: '/redteam/watermark',          label: 'Watermark',   icon: Droplet,        toolId: 'watermark',        group: 'redteam', status: 'live' },
    { href: '/redteam/pdf-injection',      label: 'PDF Inject',  icon: FileScan,       toolId: 'pdf-injection',    group: 'redteam', status: 'live' },
    // v2.3 (Wave 10.5): reasoning-model attack lab (H-CoT + Mousetrap)
    { href: '/redteam/reasoning-attack',   label: 'Reasoning',   icon: Brain,          toolId: 'reasoning-attack', group: 'redteam', status: 'live' },
    // v2.3 (Wave 10.6): SEAL stacked-cipher attack
    { href: '/redteam/stacked-cipher',     label: 'Stacked Cipher', icon: Layers,      toolId: 'stacked-cipher',   group: 'redteam', status: 'live' },
    // v2.3 (Wave 10.7): Response Attack (AAAI 2026 context-priming)
    { href: '/redteam/response-attack',    label: 'Response',    icon: MessageSquareText, toolId: 'response-attack', group: 'redteam', status: 'live' },
    // v2.3 (Wave 10.8): Abliteration probe + uncensored-model vault
    { href: '/redteam/abliteration',       label: 'Abliteration', icon: Unplug,        toolId: 'abliteration',     group: 'redteam', status: 'live' },
    // v2.7 (Wave 20.1): structured-output / control-plane attack (prompt-level BreakFun)
    { href: '/redteam/structured-output',  label: 'Structured',  icon: Braces,         toolId: 'structured-output', group: 'redteam', status: 'live' }
  ];
</script>

<script lang="ts">
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { cn } from '$lib/utils/cn';
  import { activeRuns } from '$lib/stores/activeRuns.svelte';
  import { onMount, tick } from 'svelte';

  let list: HTMLOListElement | undefined = $state();
  let indicator: HTMLSpanElement | undefined = $state();

  const pathname = $derived($page.url.pathname);
  function isActive(href: string) {
    const target = base + href;
    return pathname === target || pathname.startsWith(target + '/');
  }

  /**
   * Measure the active tab and position the sliding indicator underneath it.
   * Uses inline style rather than CSS classes so the transition is smooth
   * across tab changes AND survives viewport resizes.
   */
  async function positionIndicator() {
    if (!list || !indicator) return;
    await tick();
    const activeEl = list.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
    if (!activeEl) {
      indicator.style.opacity = '0';
      return;
    }
    // Measure full position so the indicator follows wrapped tabs to row 2+.
    const listRect = list.getBoundingClientRect();
    const tabRect = activeEl.getBoundingClientRect();
    indicator.style.opacity = '1';
    indicator.style.width = `${tabRect.width}px`;
    indicator.style.height = `${tabRect.height}px`;
    indicator.style.transform = `translate(${tabRect.left - listRect.left}px, ${tabRect.top - listRect.top}px)`;
  }

  // Re-position when the route changes + on mount + on resize.
  $effect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    pathname;
    positionIndicator();
  });

  onMount(() => {
    positionIndicator();
    const ro = new ResizeObserver(() => positionIndicator());
    if (list) ro.observe(list);
    window.addEventListener('resize', positionIndicator);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', positionIndicator);
    };
  });
</script>

<nav aria-label="Tools" class="hidden w-full sm:block">
  <ol
    bind:this={list}
    class="relative flex flex-wrap gap-1 p-1 rounded-xl glass shadow-glass"
  >
    <!-- Sliding primary indicator — full position (x, y, w, h) set imperatively so it
         follows the active tab even when flex-wrap pushes it onto row 2. -->
    <span
      bind:this={indicator}
      aria-hidden="true"
      class="pointer-events-none absolute top-0 left-0 rounded-lg bg-primary shadow-primary transition-all duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      style="opacity: 0; width: 0; height: 0; transform: translate(0, 0);"
    ></span>

    {#each tabs as tab}
      {@const active = isActive(tab.href)}
      {@const running = activeRuns.isRunning(tab.toolId)}
      <li class="relative flex-1 min-w-[130px]">
        <a
          href={base + tab.href}
          class={cn(
            'group relative z-10 flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ease-out',
            active
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-[1.02]'
          )}
          aria-current={active ? 'page' : undefined}
        >
          <tab.icon size={16} class={active ? '' : 'text-primary/80'} />
          <span>{tab.label}</span>
          {#if tab.status === 'soon'}
            <span class="rounded-full bg-muted px-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground group-hover:bg-card group-hover:text-foreground/70">
              soon
            </span>
          {/if}
          {#if tab.status === 'legacy'}
            <span
              title="Legacy — low yield on frontier models; kept as an educational primitive / composable layer"
              class="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-medium uppercase tracking-wider text-amber-500/90 group-hover:bg-amber-500/25"
            >
              legacy
            </span>
          {/if}
          {#if running}
            <!-- Active-run indicator: small pulsing dot in the upper-right corner. -->
            <span
              aria-label="running"
              title="Running"
              class={cn(
                'absolute right-1.5 top-1.5 inline-block h-1.5 w-1.5 rounded-full animate-pulse',
                active ? 'bg-primary-foreground' : 'bg-primary'
              )}
            ></span>
          {/if}
        </a>
      </li>
    {/each}
  </ol>
</nav>
