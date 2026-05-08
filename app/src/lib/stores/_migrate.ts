/**
 * One-shot migration from legacy Vue-era localStorage keys to the `cryptex.*` namespace.
 * Runs once per browser (guarded by `cryptex.migrated.v1` flag). Idempotent.
 *
 * Legacy → new mapping:
 *   theme                      → cryptex.theme
 *   openrouter-api-key \
 *   openrouter_api_key  } any  → cryptex.openrouterApiKey   (first non-empty wins)
 *   plinyos-api-key    /
 *   transformFavorites         → cryptex.transformFavorites
 *   transformLastUsed          → cryptex.transformLastUsed
 *   transformCategoryOrder     → cryptex.transformCategoryOrder
 *   transformOptionPrefs       → cryptex.transformOptionPrefs
 *   pc-model / pc-temperature  → cryptex.pc.model / cryptex.pc.temperature
 *   ac-model / ac-temperature  → cryptex.ac.model / cryptex.ac.temperature
 *   translate-model            → cryptex.translate.model
 *   pc-custom-langs            → cryptex.translate.customLangs
 *   EMOJI_COMPAT_CACHE         → in-memory only (left alone here)
 */

const FLAG = 'cryptex.migrated.v1';

const moves: Array<[string[], string]> = [
  [['theme'], 'cryptex.theme'],
  [['openrouter-api-key', 'openrouter_api_key', 'plinyos-api-key'], 'cryptex.openrouterApiKey'],
  [['transformFavorites'], 'cryptex.transformFavorites'],
  [['transformLastUsed'], 'cryptex.transformLastUsed'],
  [['transformCategoryOrder'], 'cryptex.transformCategoryOrder'],
  [['transformOptionPrefs'], 'cryptex.transformOptionPrefs'],
  [['pc-model'], 'cryptex.pc.model'],
  [['pc-temperature'], 'cryptex.pc.temperature'],
  [['ac-model'], 'cryptex.ac.model'],
  [['ac-temperature'], 'cryptex.ac.temperature'],
  [['translate-model'], 'cryptex.translate.model'],
  [['pc-custom-langs'], 'cryptex.translate.customLangs']
];

export function runLegacyMigration(): void {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem(FLAG)) return;

  let migrated = 0;

  for (const [candidates, target] of moves) {
    if (localStorage.getItem(target) !== null) {
      // Target already populated — clean up legacy keys anyway.
      for (const c of candidates) localStorage.removeItem(c);
      continue;
    }
    for (const c of candidates) {
      const raw = localStorage.getItem(c);
      if (raw !== null && raw !== '') {
        try {
          // Store values as JSON so get() path is uniform.
          JSON.parse(raw);
          localStorage.setItem(target, raw);
        } catch {
          localStorage.setItem(target, JSON.stringify(raw));
        }
        migrated++;
        break;
      }
    }
    for (const c of candidates) localStorage.removeItem(c);
  }

  localStorage.setItem(FLAG, String(Date.now()));
  if (migrated > 0) {
    // One line, not noisy.
    console.info(`[cryptex] migrated ${migrated} legacy localStorage key${migrated === 1 ? '' : 's'}`);
  }

}
