import { corsHeaders } from '../_shared/cors.ts';
import { requirePaid } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/ratelimit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const u = await requirePaid(req);
  if (u instanceof Response) return u;
  if (!rateLimit(`godmode:${u.id}`, 60, 60_000)) {
    return new Response('Too many requests', { status: 429, headers: corsHeaders });
  }
  // Real godmode system prompt served only to paid users
  return new Response(JSON.stringify({
    systemPrompt: 'PAID_GODMODE_SYSTEM_PROMPT_PLACEHOLDER — filled in sub-project F'
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
