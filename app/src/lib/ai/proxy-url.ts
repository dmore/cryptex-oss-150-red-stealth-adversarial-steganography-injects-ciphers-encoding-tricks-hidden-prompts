/**
 * Dev-vs-prod URL resolution for provider API requests.
 *
 * In dev (`npm run dev`), route requests through the Vite dev server's proxy
 * at `/api/_proxy/<presetId>` so we sidestep:
 *   - Browser CORS on `/v1/models` (most providers don't allow cross-origin)
 *   - Local-server CORS misconfig (e.g. Ollama without OLLAMA_ORIGINS=*)
 * The proxy is configured in `app/vite.config.ts` and forwards server-to-server
 * to the provider host, with no CORS friction.
 *
 * In production (static deploy), the proxy doesn't exist. Requests go direct
 * to the provider URL — `/chat/completions` works for most providers via
 * direct CORS, and `/models` falls back to per-preset model lists shipped in
 * `presets.ts`.
 *
 * The `custom` preset is intentionally NOT proxied — the user-supplied URL
 * isn't known at vite.config.ts build time.
 *
 * Verified providers (proxy → live `/v1/models` returns OpenAI-shape):
 *   - openai, gemini, groq, together, fireworks, deepinfra, cerebras,
 *     deepseek, sambanova, nvidia
 *   - ollama (`/v1/models` is OpenAI-compat shape; native `/api/tags` is richer)
 *   - lmstudio, vllm, llamacpp (all OpenAI-compat servers)
 *   - openrouter, anthropic (dedicated adapters, but proxy for uniform dev)
 */

const PROXY_PATH = '/api/_proxy';

/**
 * Preset ids whose requests should be proxied in dev mode. Must match the
 * keys in vite.config.ts `server.proxy`. Adding a new preset to that config
 * also requires adding the id here.
 */
const PROXIED_PRESETS = new Set<string>([
  'openai', 'gemini', 'groq', 'together', 'fireworks', 'deepinfra',
  'cerebras', 'deepseek', 'sambanova', 'nvidia',
  'ollama', 'lmstudio', 'vllm', 'llamacpp'
]);

/**
 * Build the proxy URL prefix. In a browser, anchor it to the current origin
 * so callers receive an ABSOLUTE URL — the @ai-sdk/openai-compatible and
 * @ai-sdk/anthropic SDKs internally call `new URL(baseURL + path)` which
 * requires an absolute URL. In SSR/test contexts (no `window`), fall back to
 * a relative path; if a caller does `new URL()` on it without a base, that
 * caller is mis-using the helper outside the dev-server runtime.
 */
function proxyBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${PROXY_PATH}`;
  }
  return PROXY_PATH;
}

/**
 * Resolve the effective base URL for a provider request.
 *
 * @param presetId - The preset id (e.g. 'openai', 'lmstudio', 'custom') or
 *                   undefined for direct adapters.
 * @param originalBaseURL - The provider's true base URL as configured in the
 *                          ProviderRecord (e.g. 'https://api.openai.com/v1').
 * @returns The proxied URL in dev for known presets, or the original URL
 *          otherwise (prod, custom preset, unknown preset).
 *
 * @example
 *   effectiveBaseURL('openai', 'https://api.openai.com/v1')
 *   // → '/api/_proxy/openai/v1' (dev)
 *   // → 'https://api.openai.com/v1' (prod)
 *
 *   effectiveBaseURL('custom', 'https://my-server.com/v1')
 *   // → 'https://my-server.com/v1' (always — custom is not proxied)
 */
export function effectiveBaseURL(
  presetId: string | undefined,
  originalBaseURL: string
): string {
  if (!import.meta.env.DEV) return originalBaseURL;
  if (!presetId || !PROXIED_PRESETS.has(presetId)) return originalBaseURL;
  try {
    const u = new URL(originalBaseURL);
    // URL.pathname is '/' for bare hosts, '/v1' for /v1, '/v1/' for /v1/.
    // Strip trailing slash so callers can append `/chat/completions` without
    // creating `//chat/completions`. For bare-host inputs that means the
    // proxied URL has no path component (e.g. '/api/_proxy/anthropic').
    const path = u.pathname.replace(/\/$/, '');
    return `${proxyBase()}/${presetId}${path}`;
  } catch {
    // Malformed URL — fall through to direct so the user sees a real error.
    return originalBaseURL;
  }
}

/**
 * Resolve the effective base URL for a fixed-host adapter (Anthropic,
 * OpenRouter). These adapters know their host at build time, so they pass the
 * proxy id directly rather than going through a presetId lookup.
 *
 * @param proxyId - The proxy id (e.g. 'anthropic', 'openrouter').
 * @param directBaseURL - The provider's true base URL.
 * @returns The proxied URL in dev, or the original URL in prod.
 *
 * @example
 *   effectiveDirectBaseURL('anthropic', 'https://api.anthropic.com')
 *   // → '/api/_proxy/anthropic' (dev)
 *   // → 'https://api.anthropic.com' (prod)
 */
export function effectiveDirectBaseURL(
  proxyId: 'anthropic' | 'openrouter',
  directBaseURL: string
): string {
  if (!import.meta.env.DEV) return directBaseURL;
  try {
    const u = new URL(directBaseURL);
    const path = u.pathname.replace(/\/$/, '');
    return `${proxyBase()}/${proxyId}${path}`;
  } catch {
    return directBaseURL;
  }
}
