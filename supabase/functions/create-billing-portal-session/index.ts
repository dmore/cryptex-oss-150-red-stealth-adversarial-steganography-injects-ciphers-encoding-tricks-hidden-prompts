import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  return new Response(JSON.stringify({ url: 'https://billing-portal-stub.example.com' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
