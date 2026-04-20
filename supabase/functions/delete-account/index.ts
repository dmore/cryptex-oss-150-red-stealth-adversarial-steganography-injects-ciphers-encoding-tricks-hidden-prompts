import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/ratelimit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  if (!rateLimit(`delete:${u.id}`, 3, 3600_000)) return new Response('Too many requests', { status: 429, headers: corsHeaders });
  const body = await req.json().catch(() => ({}));
  if (body.confirmEmail !== u.email) return new Response('Email mismatch', { status: 400, headers: corsHeaders });
  // C10 fills in actual cascade-delete via service role
  return new Response(JSON.stringify({ status: 'pending' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
