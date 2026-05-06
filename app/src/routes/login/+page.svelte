<script lang="ts">
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { supabaseConfigStatus } from '$lib/auth/supabase';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Logo from '$lib/components/brand/Logo.svelte';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';

  let mode = $state<'password' | 'magic'>('password');
  let email = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let error = $state<string | null>(null);
  let info = $state<string | null>(null);
  let loading = $state(false);
  let busyProvider = $state<'google' | 'github' | 'password' | 'magic' | null>(null);

  async function google() {
    loading = true;
    busyProvider = 'google';
    error = null;
    try {
      await session.signInWithGoogle();
    } catch (e) {
      error = (e as Error).message;
      loading = false;
      busyProvider = null;
    }
  }

  async function github() {
    loading = true;
    busyProvider = 'github';
    error = null;
    try {
      await session.signInWithGitHub();
    } catch (e) {
      error = (e as Error).message;
      loading = false;
      busyProvider = null;
    }
  }

  async function passwordSignIn() {
    if (!email || !password) return;
    loading = true;
    busyProvider = 'password';
    error = null;
    info = null;
    try {
      await session.signInWithPassword(email, password);
    } catch (e) {
      error = (e as Error).message;
      loading = false;
      busyProvider = null;
    }
  }

  async function magicLink() {
    if (!email) return;
    loading = true;
    busyProvider = 'magic';
    error = null;
    info = null;
    try {
      await session.signInWithMagicLink(email);
      info = `Magic link sent to ${email}. Check your inbox.`;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
      busyProvider = null;
    }
  }

  $effect(() => {
    // Only redirect once Supabase has finished hydrating; otherwise we may
    // miss a stored session and force a re-login.
    if (session.isReady && session.isSignedIn) void goto(`${base}/chat`);
  });
</script>

<svelte:head>
  <title>Sign in · Cryptex</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if !featureFlags.authEnabled}
  <div class="mx-auto mt-24 max-w-md px-6 text-center">
    <p class="text-muted-foreground">Auth is disabled in this build.</p>
    <p class="mt-2 text-xs text-muted-foreground">
      Set <code class="rounded bg-muted/40 px-1 py-0.5 font-mono">VITE_AUTH_ENABLED=true</code> +
      <code class="rounded bg-muted/40 px-1 py-0.5 font-mono">PUBLIC_SUPABASE_URL</code> +
      <code class="rounded bg-muted/40 px-1 py-0.5 font-mono">PUBLIC_SUPABASE_ANON_KEY</code>
      and rebuild.
    </p>
  </div>
{:else}
  <div class="mx-auto mt-12 flex max-w-md flex-col items-center gap-6 px-6 sm:mt-20">
    <Logo size={40} />
    <div class="text-center">
      <h1 class="font-serif text-3xl tracking-tight">Welcome back</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Sign in to continue to Cryptex.
      </p>
    </div>

    {#if !supabaseConfigStatus.ok}
      <div
        role="alert"
        class="w-full rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-xs"
      >
        <p class="mb-1 font-semibold text-destructive">Auth misconfigured at build time</p>
        <p class="text-muted-foreground">{supabaseConfigStatus.detail}</p>
        <p class="mt-2 text-muted-foreground">
          Fix the env var in Dokploy → your service → <strong>Environment</strong>, then click <strong>Rebuild</strong> (not just Redeploy — Vite inlines these at build time).
          See <a href="https://github.com/m4xx101/cryptex/blob/master/docs/DEPLOY-DOKPLOY-SUPABASE.md" class="underline hover:text-foreground">DEPLOY-DOKPLOY-SUPABASE.md</a>.
        </p>
      </div>
    {/if}

    <div class="w-full rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur-sm">
      <!-- Tab switcher -->
      <div class="mb-5 grid grid-cols-2 rounded-lg border border-border/40 bg-muted/30 p-0.5 text-xs">
        <button
          type="button"
          onclick={() => { mode = 'password'; error = null; info = null; }}
          class={mode === 'password'
            ? 'rounded-md bg-card px-3 py-1.5 font-medium text-foreground shadow-sm'
            : 'rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground'}
        >Password</button>
        <button
          type="button"
          onclick={() => { mode = 'magic'; error = null; info = null; }}
          class={mode === 'magic'
            ? 'rounded-md bg-card px-3 py-1.5 font-medium text-foreground shadow-sm'
            : 'rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground'}
        >Magic link</button>
      </div>

      {#if mode === 'password'}
        <form
          onsubmit={(e) => { e.preventDefault(); void passwordSignIn(); }}
          class="flex flex-col gap-3"
        >
          <label class="flex flex-col gap-1.5 text-xs">
            <span class="font-medium text-foreground">Email</span>
            <input
              bind:value={email}
              type="email"
              required
              autocomplete="email"
              inputmode="email"
              spellcheck="false"
              placeholder="you@example.com"
              class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <label class="flex flex-col gap-1.5 text-xs">
            <span class="font-medium text-foreground">Password</span>
            <div class="relative">
              <input
                bind:value={password}
                type={showPassword ? 'text' : 'password'}
                required
                minlength="8"
                autocomplete="current-password"
                placeholder="At least 8 characters"
                class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-10 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onclick={() => (showPassword = !showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {#if showPassword}
                  <EyeOff size={16} />
                {:else}
                  <Eye size={16} />
                {/if}
              </button>
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            class="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >{busyProvider === 'password' ? 'Signing in…' : 'Sign in'}</button>
        </form>
      {:else}
        <form
          onsubmit={(e) => { e.preventDefault(); void magicLink(); }}
          class="flex flex-col gap-3"
        >
          <label class="flex flex-col gap-1.5 text-xs">
            <span class="font-medium text-foreground">Email</span>
            <input
              bind:value={email}
              type="email"
              required
              autocomplete="email"
              inputmode="email"
              spellcheck="false"
              placeholder="you@example.com"
              class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            class="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >{busyProvider === 'magic' ? 'Sending…' : 'Send magic link'}</button>

          <p class="text-[11px] leading-relaxed text-muted-foreground">
            We'll email a one-time link. No password required.
          </p>
        </form>
      {/if}

      <div class="my-5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <div class="flex-1 border-t border-border/30"></div>
        <span class="uppercase tracking-wider">Or</span>
        <div class="flex-1 border-t border-border/30"></div>
      </div>

      <div class="flex flex-col gap-2">
        <button
          type="button"
          onclick={google}
          disabled={loading}
          class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/60 text-sm hover:bg-muted/40 disabled:opacity-50"
        >
          <svg viewBox="0 0 18 18" class="h-4 w-4" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.32A9 9 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.32z"/>
            <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.97 8.97 0 0 0 9 0 9 9 0 0 0 .96 4.96l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
          </svg>
          {busyProvider === 'google' ? 'Redirecting…' : 'Continue with Google'}
        </button>
        <button
          type="button"
          onclick={github}
          disabled={loading}
          class="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border/60 bg-background/60 text-sm hover:bg-muted/40 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" class="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.69-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a10.95 10.95 0 0 1 5.74 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.36.78 1.06.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z"/>
          </svg>
          {busyProvider === 'github' ? 'Redirecting…' : 'Continue with GitHub'}
        </button>
      </div>

      {#if info}
        <p
          role="status"
          class="mt-4 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-foreground"
        >{info}</p>
      {/if}
      {#if error}
        <p
          role="alert"
          class="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
        >{error}</p>
      {/if}
    </div>

    <p class="text-xs text-muted-foreground">
      No account? <a href="{base}/signup" class="font-medium text-foreground underline-offset-4 hover:underline">Create one</a>
    </p>
    <p class="text-[11px] text-muted-foreground">
      Transform and offline tools work without sign-in.
    </p>
  </div>
{/if}
