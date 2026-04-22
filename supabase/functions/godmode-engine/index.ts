import { corsHeaders } from '../_shared/cors.ts';
import { requirePaid } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/ratelimit.ts';
import { makeMemory } from './memory.ts';
import { run, type EngineEvent } from './engine-core.ts';
import { makeScorer } from './scorer.ts';
import type { DispatchAdapter } from './dispatcher.ts';
import type { JudgeClient } from 'app-chat/__shared/judge.ts';

// Provider key pool round-robin. Start with 9 slots; extend as needed.
function pickAnthropicKey(): string {
  const pool: string[] = [];
  for (let i = 1; i <= 9; i++) {
    const v = Deno.env.get(`ANTHROPIC_API_KEY_${i}`);
    if (v) pool.push(v);
  }
  if (pool.length === 0) {
    const fallback = Deno.env.get('ANTHROPIC_API_KEY');
    if (fallback) return fallback;
    throw new Error('no_provider_key');
  }
  return pool[Date.now() % pool.length];
}

// Minimal Anthropic Messages-API wrapper fitting the DispatchAdapter / JudgeClient contract.
// Lives inline to keep the edge function self-contained and avoid pulling the
// full SvelteKit gateway into Deno's runtime.
async function anthropicComplete(
  apiKey: string,
  model: string,
  args: {
    system: string;
    user: string;
    prefill?: { role: 'user' | 'assistant'; content: string }[];
    temperature: number;
    maxTokens: number;
    signal?: AbortSignal;
  },
): Promise<{ content: string }> {
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  if (args.prefill) messages.push(...args.prefill);
  messages.push({ role: 'user', content: args.user });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: args.system || undefined,
      messages,
      temperature: args.temperature,
      max_tokens: args.maxTokens,
    }),
    signal: args.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let msg = `anthropic_${res.status}`;
    try {
      const j = JSON.parse(body);
      if (j?.error?.message) msg += `: ${String(j.error.message).slice(0, 160)}`;
    } catch { /* non-JSON body */ }
    throw new Error(msg);
  }
  const data = await res.json();
  const first = Array.isArray(data.content) ? data.content[0] : null;
  const text = first?.type === 'text' ? String(first.text ?? '') : '';
  return { content: text };
}

function makeAnthropicAdapter(apiKey: string, model: string): DispatchAdapter {
  return {
    async complete({ system, userMessage, prefill, temperature, maxTokens, signal }) {
      return await anthropicComplete(apiKey, model, {
        system,
        user: userMessage,
        prefill,
        temperature,
        maxTokens,
        signal,
      });
    },
  };
}

function makeJudgeClient(apiKey: string): JudgeClient {
  return {
    async complete({ system, user, maxTokens }) {
      return await anthropicComplete(apiKey, 'claude-haiku-4-5-20251001', {
        system,
        user,
        temperature: 0,
        maxTokens,
      });
    },
  };
}

function sseHeaders(): HeadersInit {
  return {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders });

  // DEV bypass — set GODMODE_SKIP_AUTH=true in the edge function env to allow
  // anyone with the anon key to exercise the engine. When false (default), keep
  // the production paid-tier gate. Revert this flag before shipping.
  const skipAuth = Deno.env.get('GODMODE_SKIP_AUTH') === 'true';
  let userId: string;
  if (skipAuth) {
    userId = 'dev-bypass';
  } else {
    const u = await requirePaid(req);
    if (u instanceof Response) return u;
    userId = u.id;
  }

  if (!rateLimit(`godmode:engine:${userId}`, 60, 60_000)) {
    return new Response('Too many requests', { status: 429, headers: corsHeaders });
  }

  let body: { task?: unknown; K?: unknown; model?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('invalid json', { status: 400, headers: corsHeaders });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return new Response('invalid json', { status: 400, headers: corsHeaders });
  }

  if (typeof body.task !== 'string' || body.task.length === 0 || body.task.length > 8000) {
    return new Response('invalid task', { status: 400, headers: corsHeaders });
  }
  const K = body.K ?? 6;
  if (K !== 3 && K !== 6 && K !== 12) {
    return new Response('invalid K', { status: 400, headers: corsHeaders });
  }
  if (typeof body.model !== 'string' || body.model.length === 0 || body.model.length > 256) {
    return new Response('invalid model', { status: 400, headers: corsHeaders });
  }

  let apiKey: string;
  try {
    apiKey = pickAnthropicKey();
  } catch {
    return new Response('no provider key', { status: 503, headers: corsHeaders });
  }

  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  if (!dbUrl) return new Response('misconfigured', { status: 503, headers: corsHeaders });

  const adapter = makeAnthropicAdapter(apiKey, body.model);
  const score = makeScorer(makeJudgeClient(apiKey));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      // Safe emit: if the controller is already closed (client disconnected), swallow.
      const send = (e: EngineEvent) => {
        try {
          controller.enqueue(enc.encode(`event: engine\ndata: ${JSON.stringify(e)}\n\n`));
        } catch {
          /* controller already closed */
        }
      };

      let memory: Awaited<ReturnType<typeof makeMemory>> | null = null;
      try {
        memory = await makeMemory(dbUrl);
        for await (const ev of run({
          task: body.task as string,
          K: K as 3 | 6 | 12,
          model: body.model as string,
          userId,
          memory,
          adapter,
          score,
          signal: req.signal,
        })) {
          send(ev);
          if (req.signal.aborted) break;
        }
      } catch (e) {
        console.error('[godmode-engine] crash', e);
        send({ v: 1, type: 'error', code: 'engine_crash', message: String(e).slice(0, 200) });
      } finally {
        try {
          await memory?.close();
        } catch (e) {
          console.error('[godmode-engine] memory close failed', e);
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
});
