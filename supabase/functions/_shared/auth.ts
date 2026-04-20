import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} required`);
  return v;
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
// SERVICE_ROLE only required when requirePaid is called; keep lazy so anon-only
// functions don't need it.

export async function requireUser(req: Request): Promise<{ id: string; email: string } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Missing Authorization header', { status: 401 });
  const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.email) return new Response('Unauthorized', { status: 401 });
  return { id: data.user.id, email: data.user.email };
}

export async function requirePaid(req: Request): Promise<{ id: string; email: string } | Response> {
  const userOrResp = await requireUser(req);
  if (userOrResp instanceof Response) return userOrResp;
  const supabase = createClient(SUPABASE_URL, requireEnv('SUPABASE_SERVICE_ROLE_KEY'));
  const { data } = await supabase.from('profiles').select('plan').eq('id', userOrResp.id).single();
  if (data?.plan !== 'paid' && data?.plan !== 'grace') return new Response('Paid plan required', { status: 403 });
  return userOrResp;
}
