<script lang="ts">
  import { session } from '$lib/auth/session.svelte';
  import { featureFlags } from '$lib/config/featureFlags';
  import { notify } from '$lib/stores/toast.svelte';
  import Shield from 'lucide-svelte/icons/shield';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import Check from 'lucide-svelte/icons/check';
  import X from 'lucide-svelte/icons/x';

  let currentPassword = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let showPassword = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);

  // Whether the user has a password set on their account. Supabase records
  // this in the user object's `identities` — an "email" identity present
  // means a password was set; missing means they signed up via OAuth /
  // magic-link only and have no password yet (so no current-password check).
  const hasPassword = $derived.by(() => {
    const identities = session.supabaseSession?.user?.identities ?? [];
    return identities.some((i) => i.provider === 'email');
  });

  const rules = $derived([
    { label: 'At least 8 characters', ok: newPassword.length >= 8 },
    { label: 'Contains a letter', ok: /[A-Za-z]/.test(newPassword) },
    { label: 'Contains a number', ok: /[0-9]/.test(newPassword) },
    { label: 'Different from current', ok: !hasPassword || (newPassword.length > 0 && newPassword !== currentPassword) }
  ]);

  const passwordsMatch = $derived(
    newPassword.length > 0 && newPassword === confirmPassword
  );

  const canSubmit = $derived(
    !busy &&
    rules.every((r) => r.ok) &&
    passwordsMatch &&
    (!hasPassword || currentPassword.length > 0)
  );

  async function submit() {
    if (!canSubmit) return;
    busy = true;
    error = null;
    try {
      // Re-auth check first when a password already exists. Without this,
      // an attacker who hijacks an existing logged-in session could change
      // the password and lock the real user out.
      if (hasPassword) {
        await session.verifyCurrentPassword(currentPassword);
      }
      await session.updatePassword(newPassword);
      notify.success(hasPassword ? 'Password updated' : 'Password set');
      currentPassword = '';
      newPassword = '';
      confirmPassword = '';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

{#if featureFlags.authEnabled && session.isSignedIn}
  <div class="space-y-3 rounded-xl border border-border bg-card/60 p-5 shadow-glass">
    <div class="flex items-center gap-2">
      <Shield size={16} class="text-primary" />
      <h2 class="font-serif text-lg">Account security</h2>
    </div>
    <p class="text-sm text-muted-foreground">
      Signed in as <strong class="text-foreground">{session.current?.email ?? '…'}</strong>.
      {hasPassword
        ? 'Change your password below — you\'ll need your current one to confirm.'
        : 'You signed in via magic link or OAuth. Set a password below so you can sign in with email + password too.'}
    </p>

    <form
      onsubmit={(e) => { e.preventDefault(); void submit(); }}
      class="flex flex-col gap-3 max-w-sm"
    >
      {#if hasPassword}
        <label class="flex flex-col gap-1.5 text-xs">
          <span class="font-medium text-foreground">Current password</span>
          <div class="relative">
            <input
              bind:value={currentPassword}
              type={showPassword ? 'text' : 'password'}
              required
              autocomplete="current-password"
              placeholder="Your existing password"
              class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-10 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onclick={() => (showPassword = !showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {#if showPassword}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
            </button>
          </div>
        </label>
      {/if}

      <label class="flex flex-col gap-1.5 text-xs">
        <span class="font-medium text-foreground">{hasPassword ? 'New password' : 'New password'}</span>
        <div class="relative">
          <input
            bind:value={newPassword}
            type={showPassword ? 'text' : 'password'}
            required
            minlength="8"
            autocomplete="new-password"
            placeholder="At least 8 characters"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 pr-10 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            type="button"
            onclick={() => (showPassword = !showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            {#if showPassword}<EyeOff size={14} />{:else}<Eye size={14} />{/if}
          </button>
        </div>
        {#if newPassword.length > 0}
          <ul class="mt-1 flex flex-col gap-0.5 text-[11px]">
            {#each rules as rule}
              <li class={rule.ok ? 'flex items-center gap-1 text-foreground' : 'flex items-center gap-1 text-muted-foreground'}>
                {#if rule.ok}
                  <Check size={12} class="text-emerald-500" />
                {:else}
                  <X size={12} class="text-muted-foreground/60" />
                {/if}
                <span>{rule.label}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </label>

      <label class="flex flex-col gap-1.5 text-xs">
        <span class="font-medium text-foreground">Confirm new password</span>
        <input
          bind:value={confirmPassword}
          type={showPassword ? 'text' : 'password'}
          required
          autocomplete="new-password"
          placeholder="Repeat the new password"
          class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {#if confirmPassword.length > 0 && !passwordsMatch}
          <span class="text-[11px] text-destructive">Passwords don't match.</span>
        {/if}
      </label>

      <div>
        <button
          type="submit"
          disabled={!canSubmit}
          class="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >{busy ? 'Saving…' : (hasPassword ? 'Update password' : 'Set password')}</button>
      </div>

      {#if error}
        <p
          role="alert"
          class="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive"
        >{error}</p>
      {/if}
    </form>

    <p class="text-[11px] text-muted-foreground">
      For security, you'll stay signed in on this device. Other devices will need to sign in again next time their token refreshes.
    </p>
  </div>
{/if}
