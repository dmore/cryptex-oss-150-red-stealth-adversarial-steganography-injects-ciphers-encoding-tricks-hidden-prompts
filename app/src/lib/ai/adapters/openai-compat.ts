import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Adapter } from './base';
import type { Model, ProviderRecord } from '../types';
import { translateError } from '../errors';

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
    } catch {
      // Body wasn't JSON — leave it alone.
    }
  }
  return fetch(input as RequestInfo, init);
}

export function openaiCompatAdapter(record: Extract<ProviderRecord, { id: 'openai-compat' }>): Adapter {
  const key = (record.apiKey || '').trim();

  const provider = createOpenAICompatible({
    name: record.name || 'openai-compat',
    baseURL: record.baseURL,
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
        resp = await fetch(`${record.baseURL}/chat/completions`, {
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
      let resp: Response;
      try {
        resp = await fetch(`${record.baseURL}/models`, {
          method: 'GET',
          headers: key ? { Authorization: `Bearer ${key}` } : {},
          signal
        });
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') throw e;
        return []; // silent fallback — user will type model ids manually
      }
      if (!resp.ok) return [];
      let body: { data?: Array<Record<string, unknown>> };
      try { body = (await resp.json()) as typeof body; } catch { return []; }
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
      out.sort((a, b) => a.name.localeCompare(b.name));
      return out;
    }
  };
}
