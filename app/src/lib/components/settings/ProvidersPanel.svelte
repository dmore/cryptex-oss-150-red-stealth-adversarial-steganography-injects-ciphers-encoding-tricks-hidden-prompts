<script lang="ts">
  import {
    listProviders,
    hasLegacyPlaintextKeys,
    migrateLegacyKeysToVault,
    hydrateFromVault
  } from '$lib/ai/providers.svelte';
  import {
    isEphemeralStorage,
    setEphemeralStorage,
    BYOK_STORAGE_KEYS
  } from '$lib/ai/storage-strategy';
  import { featureFlags } from '$lib/config/featureFlags';
  import { session } from '$lib/auth/session.svelte';
  import { notify } from '$lib/stores/toast.svelte';
  import ProviderCard from './ProviderCard.svelte';
  import AddProviderDialog from './AddProviderDialog.svelte';
  import Plus from 'lucide-svelte/icons/plus';
  import ShieldAlert from 'lucide-svelte/icons/shield-alert';
  import KeyRound from 'lucide-svelte/icons/key-round';

  let dialogOpen = $state(false);
  // $derived re-reads the rune-backed list so this section re-renders on changes
  const providers = $derived(listProviders());

  // Local mirror of the persistent ephemeral-storage toggle.
  // Initialised from the helper (reads localStorage) at mount.
  let ephemeral = $state(isEphemeralStorage());

  function toggleEphemeral(next: boolean) {
    setEphemeralStorage(next, [...BYOK_STORAGE_KEYS]);
    ephemeral = next;
  }

  // ----- Encrypt-keys-into-vault prompt -----
  // For signed-in users whose `cryptex.providers` localStorage value still
  // carries plaintext apiKey strings, offer a one-click encrypt-into-vault
  // upgrade. The card is framed as a positive feature (encrypt your keys),
  // not a security warning.
  const useVault = $derived(featureFlags.authEnabled && session.isSignedIn);
  let showMigrate = $state(false);
  let migratePassphrase = $state('');
  let migrateConfirm = $state('');
  let migrateError = $state<string | null>(null);
  let migrating = $state(false);
  const passphraseValid = $derived(migratePassphrase.length >= 8);
  const passphrasesMatch = $derived(
    migratePassphrase.length > 0 && migratePassphrase === migrateConfirm
  );

  $effect(() => {
    if (!useVault) {
      showMigrate = false;
      return;
    }
    // Re-evaluate whenever auth state flips.
    showMigrate = hasLegacyPlaintextKeys();
  });

  // Auto-hydrate _records from the vault when the panel mounts and the
  // vault is already unlocked (e.g. user added a key earlier this session).
  $effect(() => {
    if (useVault && session.vaultUnlocked) {
      void hydrateFromVault();
    }
  });

  async function runMigration() {
    if (!passphraseValid) {
      migrateError = 'Passphrase must be at least 8 characters.';
      return;
    }
    if (!passphrasesMatch) {
      migrateError = 'Passphrases do not match.';
      return;
    }
    migrating = true;
    migrateError = null;
    try {
      const n = await migrateLegacyKeysToVault(migratePassphrase);
      if (n > 0) {
        notify.success(`Encrypted ${n} key${n === 1 ? '' : 's'} into the vault`);
        showMigrate = false;
        migratePassphrase = '';
        migrateConfirm = '';
      } else {
        migrateError = 'No plaintext keys found to encrypt. Reload the page if you just added a key.';
      }
    } catch (err) {
      migrateError = (err as Error).message || 'Could not write to the vault. Try again.';
    } finally {
      migrating = false;
    }
  }
</script>

<section class="space-y-4" id="providers">
  <header>
    <h2 class="font-serif text-xl font-semibold">Providers</h2>
    <p class="text-sm text-muted-foreground">Use your own API keys. Keys are stored only in your browser.</p>
  </header>

  {#if showMigrate}
    <!-- Encrypt-keys-into-vault upgrade card. Framed as a positive
         feature, not a security warning. Matches the rest of the panel's
         neutral/glass treatment instead of amber-warning chrome. -->
    <div class="space-y-4 rounded-xl border border-border bg-card/60 p-5 shadow-sm">
      <div class="flex items-start gap-3">
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <KeyRound size={16} />
        </div>
        <div class="space-y-1">
          <h3 class="font-serif text-base font-semibold leading-tight">Encrypt your provider keys</h3>
          <p class="text-xs leading-relaxed text-muted-foreground">
            Your API keys are stored in plain text on this device. Encrypt them
            with a passphrase to lock the keys behind your master phrase — only
            ciphertext leaves your browser, the encrypted vault never sees the
            plaintext. Use the same passphrase to unlock keys on any device
            where you're signed in.
          </p>
        </div>
      </div>

      <ul class="space-y-1.5 pl-12 text-[11px] text-muted-foreground">
        <li class="flex items-start gap-2">
          <span class="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-primary"></span>
          <span>End-to-end encrypted with PBKDF2 (600,000 iterations) + AES-GCM.</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-primary"></span>
          <span>Same passphrase unlocks every signed-in device.</span>
        </li>
        <li class="flex items-start gap-2">
          <span class="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-primary"></span>
          <span>Required to use AI tools after sign-in. Keep it safe — there's no recovery.</span>
        </li>
      </ul>

      <div class="space-y-2 pl-12">
        <label class="flex flex-col gap-1.5 text-[11px]">
          <span class="font-medium text-foreground">Vault passphrase</span>
          <input
            type="password"
            bind:value={migratePassphrase}
            placeholder="At least 8 characters"
            autocomplete="new-password"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            onkeydown={(e) => { if (e.key === 'Enter' && passphrasesMatch) runMigration(); }}
          />
        </label>
        <label class="flex flex-col gap-1.5 text-[11px]">
          <span class="font-medium text-foreground">Confirm passphrase</span>
          <input
            type="password"
            bind:value={migrateConfirm}
            placeholder="Repeat passphrase"
            autocomplete="new-password"
            class="w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            onkeydown={(e) => { if (e.key === 'Enter' && passphrasesMatch) runMigration(); }}
          />
          {#if migrateConfirm.length > 0 && !passphrasesMatch}
            <span class="text-[11px] text-destructive">Passphrases don't match.</span>
          {/if}
        </label>
      </div>

      {#if migrateError}
        <p
          role="alert"
          class="ml-12 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive"
        >{migrateError}</p>
      {/if}

      <div class="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
        <button
          type="button"
          class="px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onclick={() => { showMigrate = false; migratePassphrase = ''; migrateConfirm = ''; }}
        >
          Not now
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          onclick={runMigration}
          disabled={migrating || !passphraseValid || !passphrasesMatch}
        >
          <KeyRound size={12} />
          {migrating ? 'Encrypting…' : 'Encrypt my keys'}
        </button>
      </div>
    </div>
  {/if}

  <label
    class="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card/40 p-3 transition-colors hover:bg-card/60"
  >
    <input
      type="checkbox"
      class="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
      checked={ephemeral}
      onchange={(e) => toggleEphemeral((e.target as HTMLInputElement).checked)}
    />
    <span class="space-y-1 text-sm">
      <span class="flex items-center gap-1.5 font-medium">
        <ShieldAlert size={13} class="text-primary" />
        Clear keys when I close this tab
      </span>
      <span class="block text-xs text-muted-foreground">
        Stricter compartmentalization for shared / borrowed machines. Keys move to
        <code class="rounded bg-muted px-1 py-0.5 text-[10px]">sessionStorage</code>
        and are wiped when this tab closes — you'll re-paste them next session. Default
        is <code class="rounded bg-muted px-1 py-0.5 text-[10px]">localStorage</code>
        (keys persist across browser sessions).
      </span>
    </span>
  </label>

  {#if providers.length === 0}
    <div class="glass rounded-lg border border-dashed border-white/15 p-6 text-center text-sm text-muted-foreground">
      No providers configured yet. Add one to start using AI tools.
    </div>
  {/if}

  {#each providers as record (record.id + ((record as { instanceId?: string }).instanceId ?? ''))}
    <ProviderCard {record} />
  {/each}

  <button
    type="button"
    onclick={() => dialogOpen = true}
    class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-4 py-6 text-sm text-muted-foreground hover:bg-white/5"
  >
    <Plus class="h-4 w-4" /> Add provider
  </button>
</section>

<AddProviderDialog open={dialogOpen} onClose={() => dialogOpen = false} />
