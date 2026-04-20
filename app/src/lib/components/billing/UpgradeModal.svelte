<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/auth/supabase';
  import X from 'lucide-svelte/icons/x';

  let open = $state(false);
  let feature = $state('this feature');
  let loading = $state(false);
  let error = $state<string | null>(null);

  onMount(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ feature: string }>).detail;
      feature = detail?.feature ?? 'this feature';
      open = true;
      error = null;
    };
    window.addEventListener('billing:show-upgrade', handler);
    return () => window.removeEventListener('billing:show-upgrade', handler);
  });

  async function checkout() {
    loading = true; error = null;
    try {
      if (!supabase) throw new Error('Auth not enabled');
      const { data, error: fnErr } = await supabase.functions.invoke('create-checkout-session');
      if (fnErr) throw fnErr;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        error = 'Checkout unavailable — please try again later.';
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
    <div class="glass w-full max-w-md space-y-4 rounded-xl border border-border p-5">
      <div class="flex items-center justify-between">
        <h2 class="font-serif text-lg">Upgrade to unlock {feature}</h2>
        <button type="button" onclick={() => (open = false)} aria-label="Close"><X size={14} /></button>
      </div>
      <p class="text-sm text-muted-foreground">
        Godmode jailbreak chains are available on the Cryptex Paid plan. Every other feature stays free.
      </p>
      {#if error}<p class="text-xs text-destructive">{error}</p>{/if}
      <div class="flex justify-end gap-2">
        <button type="button" onclick={() => (open = false)} class="px-3 py-1.5 text-sm">Not now</button>
        <button type="button" onclick={checkout} disabled={loading} class="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50">
          {loading ? 'Redirecting…' : 'Upgrade'}
        </button>
      </div>
    </div>
  </div>
{/if}
