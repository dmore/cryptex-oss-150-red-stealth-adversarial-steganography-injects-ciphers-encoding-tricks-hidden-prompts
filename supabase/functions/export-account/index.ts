import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';
import { rateLimit } from '../_shared/ratelimit.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  if (!rateLimit(`export:${u.id}`, 10, 86400_000)) return new Response('Too many requests', { status: 429, headers: corsHeaders });
  // C10 fills in bundle generation
  return new Response(JSON.stringify({ signedUrl: 'https://export-stub.example.com' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
