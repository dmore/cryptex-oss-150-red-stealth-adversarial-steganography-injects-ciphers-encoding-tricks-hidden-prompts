<script lang="ts">
  import ChatShell from '$lib/components/chat/ChatShell.svelte';
  import RouteShell from '$lib/components/chat/workspace/RouteShell.svelte';
  import { onMount } from 'svelte';
  import { installChatShortcuts } from '$lib/stores/chatShortcuts.svelte';
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  let { children } = $props();
  onMount(() => installChatShortcuts());

  // Auth gate: when auth is enabled in this build and session has hydrated
  // and the user isn't signed in, redirect to /login. Falls back to no gate
  // when authEnabled is false (local-only deploys without Supabase).
  // We MUST wait for session.isReady — otherwise a signed-in user reloading
  // /chat sees their localStorage session hydrate after first paint, and we
  // briefly redirect them to /login before Supabase tells us they're signed in.
  $effect(() => {
    if (featureFlags.authEnabled && session.isReady && !session.isSignedIn) {
      void goto(`${base}/login`, { replaceState: true });
    }
  });
</script>

{#if featureFlags.authEnabled && !session.isReady}
  <!-- Hydrating Supabase session — show a tiny loading state to avoid the
       flash of unauthenticated UI between first paint and the auth resolve. -->
  <p class="m-auto mt-24 text-center text-sm text-muted-foreground">Loading…</p>
{:else if featureFlags.authEnabled && !session.isSignedIn}
  <!-- Brief redirect placeholder — the $effect above is navigating to /login. -->
  <p class="m-auto mt-24 text-center text-sm text-muted-foreground">Redirecting to sign in…</p>
{:else}
  <RouteShell skeleton="chat">
    <ChatShell>{@render children?.()}</ChatShell>
  </RouteShell>
{/if}
