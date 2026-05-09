import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Adapter } from './base';
import type { Model, ProviderRecord } from '../types';
import { translateError } from '../errors';
import { getPreset } from '../presets';
import { effectiveBaseURL } from '../proxy-url';

/**
 * OpenAI reasoning & GPT-5 models reject `max_tokens` in favor of
 * `max_completion_tokens`. The `@ai-sdk/openai-compatible` package
 * is generic and always sends `max_tokens`, so requests against
 * `o1*`, `o3*`, `o4*`, and `gpt-5*` on the OpenAI endpoint (or any
 * OpenAI-compat instance that mirrors OpenAI's strict validation)
 * fail with "Unsupported parameter". We patch the request body on
 * the way out via the fetch middleware hook. Other models get the
 * body untouched — Groq, Together, Fireworks, etc. still accept
 * `max_tokens` normally.
 */
const REASONING_MODEL_RE = /^(o\d+(?:[-.].*)?|gpt-5(?:[-.].*)?)$/i;

function needsCompletionTokensRewrite(modelId: unknown): boolean {
  return typeof modelId === 'string' && REASONING_MODEL_RE.test(modelId);
}

/**
 * DeepSeek-reasoner shares the reasoning-budget problem with OpenAI's o-series
 * (default max_tokens consumed by internal chain-of-thought, empty visible
 * output) but uses plain `max_tokens` rather than `max_completion_tokens`.
 * Bump the floor without swapping the field name. DeepSeek silently ignores
 * unsupported params (temperature, top_p, etc.) so we don't strip them.
 */
const DEEPSEEK_REASONER_RE = /^deepseek-reasoner(?:[-.].*)?$/i;

function needsDeepseekReasonerFloor(modelId: unknown): boolean {
  return typeof modelId === 'string' && DEEPSEEK_REASONER_RE.test(modelId);
}

/**
 * Reasoning + GPT-5 models budget BOTH internal reasoning tokens and visible
 * output tokens against max_completion_tokens. The app's default cap (4096)
 * is too small — models often spend the entire budget on reasoning and emit
 * zero visible output ("empty assistant bubble" bug). Raise the floor to
 * something big enough for real responses; user can override explicitly.
 */
const REASONING_MIN_BUDGET = 32000;

async function patchedFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  if (init?.method === 'POST' && typeof init.body === 'string') {
    try {
      const body = JSON.parse(init.body);
      if (needsCompletionTokensRewrite(body?.model)) {
        if ('max_tokens' in body) {
          body.max_completion_tokens = body.max_tokens;
          delete body.max_tokens;
        }
        // Raise the floor so the model has room to emit visible output after
        // its internal reasoning. If the caller already asked for more, keep
        // their number.
        if (typeof body.max_completion_tokens !== 'number' || body.max_completion_tokens < REASONING_MIN_BUDGET) {
          body.max_completion_tokens = REASONING_MIN_BUDGET;
        }
        // Strip every param OpenAI reasoning models reject outright. Leaving
        // them sends the request through, but OpenAI 400s with "unsupported
        // parameter" OR (worse) silently ignores them + returns empty output.
        // Only `temperature: 1` is valid; strip any other value.
        if ('temperature' in body && body.temperature !== 1) delete body.temperature;
        delete body.top_p;
        delete body.presence_penalty;
        delete body.frequency_penalty;
        delete body.logit_bias;
        delete body.logprobs;
        delete body.top_logprobs;
        init = { ...init, body: JSON.stringify(body) };
      }
      if (needsDeepseekReasonerFloor(body?.model)) {
        if (typeof body.max_tokens !== 'number' || body.max_tokens < REASONING_MIN_BUDGET) {
          body.max_tokens = REASONING_MIN_BUDGET;
        }
        init = { ...init, body: JSON.stringify(body) };
      }
    } catch {
      // Body wasn't JSON — leave it alone.
    }
  }
  return fetch(input as RequestInfo, init);
}

export function openaiCompatAdapter(record: Extract<ProviderRecord, { id: 'openai-compat' }>): Adapter {
  const key = (record.apiKey || '').trim();

  // In dev, route through the Vite proxy at /api/_proxy/<presetId> so /v1/models
  // and /chat/completions both sidestep browser CORS. In prod, this is the
  // provider's URL unchanged. See ../proxy-url.ts for full rationale.
  const baseURL = effectiveBaseURL(record.presetId, record.baseURL);

  const provider = createOpenAICompatible({
    name: record.name || 'openai-compat',
    baseURL,
    headers: key ? { Authorization: `Bearer ${key}` } : {},
    fetch: patchedFetch
  });

  return {
    id: 'openai-compat',
    instanceId: record.instanceId,
    // baseURL check handles Custom preset before user fills it in; preset-backed records always have a non-empty baseURL.
    isConfigured: () => Boolean(key && record.baseURL),
    resolveModel: (modelId) => provider(modelId),
    validateKey: async (candidate, signal) => {
      // Explicit "Verify" path — POST /chat/completions with 1-token probe using test model.
      // testModel is populated from preset.defaultTestModel at record creation; fallback only fires for fresh Custom endpoints before the user sets one.
      const testModel = record.testModel || 'gpt-3.5-turbo';
      // Reasoning / GPT-5 models reject `max_tokens`; use `max_completion_tokens` for them.
      const probeBody: Record<string, unknown> = {
        model: testModel,
        messages: [{ role: 'user', content: '.' }]
      };
      if (needsCompletionTokensRewrite(testModel)) {
        probeBody.max_completion_tokens = 1;
      } else {
        probeBody.max_tokens = 1;
      }
      let resp: Response;
      try {
        resp = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Authorization: `Bearer ${candidate}` },
          body: JSON.stringify(probeBody),
          signal
        });
      } catch (e) {
        // Fetch throwing TypeError "Failed to fetch" in the browser is ambiguous:
        // it can mean a CORS block, a DNS/TLS failure, transient network drop, or
        // a browser extension intercepting the request. Prior code flagged all of
        // these as CORS — which is misleading for preset providers that demonstrably
        // support browser CORS (Groq, Together, Fireworks, DeepInfra, Cerebras,
        // SambaNova — verified via OPTIONS preflight). Only flag as CORS when the
        // endpoint is a user-entered 'custom' preset where we truly don't know.
        const suspectCors = !record.presetId || record.presetId === 'custom';
        throw translateError(e, 'openai-compat', { suspectCors });
      }
      if (resp.ok) return { label: record.name };
      const body = await resp.text().catch(() => '');
      throw translateError({ status: resp.status, message: body || `HTTP ${resp.status}` }, 'openai-compat');
    },
    fetchCatalog: async (signal) => {
      // Build the fallback Model[] from the preset's defaultModels list. This
      // is what we return when the live `/v1/models` endpoint fails for any
      // reason — CORS block (DeepSeek's /models doesn't return CORS headers),
      // auth refusal, server outage, or just an empty response. Cloud presets
      // ship with curated lists; local presets (Ollama, LM Studio, vLLM, etc.)
      // leave defaultModels undefined and the user types their own model IDs
      // via the picker's free-text input.
      const preset = record.presetId ? getPreset(record.presetId) : undefined;
      const fallbackIds = preset?.defaultModels ?? [];
      const fallbackModels: Model[] = fallbackIds.map((id) => ({
        id,
        qualifiedId: `openai-compat:${record.instanceId}/${id}`,
        name: id,
        provider: 'openai-compat',
        providerInstanceId: record.instanceId,
        upstreamProvider: record.name,
        capabilities: { streaming: true, tools: true }
      }));

      // Report status back to the catalog. Lazy import keeps the adapter
      // testable in isolation — if the catalog module isn't loaded (e.g. in
      // a unit test that imports the adapter directly), report is a no-op.
      const statusKey = `openai-compat:${record.instanceId}`;
      const reportStatus = async (s: 'ok' | 'fallback' | 'error') => {
        try {
          const mod = await import('../catalog.svelte');
          mod.reportCatalogStatus(statusKey, s);
        } catch { /* catalog not loaded — ignore */ }
      };

      let resp: Response;
      try {
        resp = await fetch(`${baseURL}/models`, {
          method: 'GET',
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          signal
        });
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        // Network / CORS / DNS / TLS failure — return curated fallback so the
        // model picker is never empty for cloud providers, even when /models
        // is CORS-blocked but /chat/completions works.
        console.warn(`[openai-compat:${record.presetId ?? 'custom'}] /models fetch failed, using fallback list:`, e);
        await reportStatus(fallbackModels.length > 0 ? 'fallback' : 'error');
        return fallbackModels;
      }
      if (!resp.ok) {
        console.warn(`[openai-compat:${record.presetId ?? 'custom'}] /models returned ${resp.status}, using fallback list`);
        await reportStatus(fallbackModels.length > 0 ? 'fallback' : 'error');
        return fallbackModels;
      }
      let body: { data?: Array<Record<string, unknown>> };
      try { body = (await resp.json()) as typeof body; } catch {
        await reportStatus(fallbackModels.length > 0 ? 'fallback' : 'error');
        return fallbackModels;
      }
      const raw = body.data ?? [];
      const out: Model[] = [];
      for (const r of raw) {
        const id = r.id;
        if (typeof id !== 'string') continue;
        out.push({
          id,
          qualifiedId: `openai-compat:${record.instanceId}/${id}`,
          name: (typeof r.name === 'string' && r.name) || id,
          provider: 'openai-compat',
          providerInstanceId: record.instanceId,
          upstreamProvider: record.name,
          contextLength: typeof r.context_window === 'number' ? r.context_window : (typeof r.context_length === 'number' ? r.context_length : undefined),
          capabilities: { streaming: true, tools: true }
        });
      }
      // Some providers return `{data: []}` (e.g. when auth is wrong but the
      // endpoint is still reachable). Treat empty live data the same as a
      // failed fetch and surface the curated fallback list.
      if (out.length === 0) {
        await reportStatus(fallbackModels.length > 0 ? 'fallback' : 'error');
        return fallbackModels;
      }
      await reportStatus('ok');
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    }
  };
}
