import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/ratelimit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  if (!rateLimit(`checkout:${u.id}`, 10, 60_000)) return new Response('Too many requests', { status: 429, headers: corsHeaders });
  // C11 fills in Stripe integration
  return new Response(JSON.stringify({ url: 'https://stripe-stub.example.com' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
