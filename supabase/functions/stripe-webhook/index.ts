import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const sig = req.headers.get('stripe-signature');
  if (!sig) return new Response('Missing stripe-signature', { status: 400, headers: corsHeaders });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) return new Response('Webhook not configured', { status: 500, headers: corsHeaders });
  const body = await req.text();
  // HMAC verification — C11 fills in actual Stripe event handling
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  // Parse "t=...,v1=..." from signature header
  const parts = Object.fromEntries(
    sig.split(',').map((p: string): [string, string] => {
      const i = p.indexOf('=');
      return i < 0 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
    })
  );
  if (!parts.t || !parts.v1) return new Response('Bad signature format', { status: 400, headers: corsHeaders });
  const ts = Number(parts.t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return new Response('Signature expired', { status: 401, headers: corsHeaders });
  }
  const signed = `${parts.t}.${body}`;
  const expected = hexFromBase64(parts.v1);
  const ok = await crypto.subtle.verify('HMAC', key, expected, encoder.encode(signed));
  if (!ok) return new Response('Signature mismatch', { status: 401, headers: corsHeaders });
  return new Response('ok', { status: 200, headers: corsHeaders });
});

function hexFromBase64(b64: string): Uint8Array {
  // Stripe sigs come as hex; decode accordingly
  const bytes = new Uint8Array(b64.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(b64.substr(i * 2, 2), 16);
  return bytes;
}
