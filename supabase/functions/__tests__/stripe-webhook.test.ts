// NOTE: This is a Deno test, not a Vitest test. It is NOT executed by
// `npm run test:unit`. To run it: start `npx supabase functions serve` in one
// shell and `deno test supabase/functions/__tests__` in another. CI wires this
// up in C12.
import { assertEquals } from 'https://deno.land/std@0.220.0/assert/mod.ts';

Deno.test('stripe-webhook rejects missing signature', async () => {
  const resp = await fetch('http://127.0.0.1:54321/functions/v1/stripe-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'checkout.session.completed' })
  });
  assertEquals(resp.status, 400);
  await resp.text(); // drain
});

Deno.test('stripe-webhook rejects bad signature', async () => {
  const resp = await fetch('http://127.0.0.1:54321/functions/v1/stripe-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=badhex' },
    body: JSON.stringify({ type: 'checkout.session.completed' })
  });
  // Either 400 (bad format) or 401 (signature mismatch) — both prove the check fires
  if (resp.status !== 400 && resp.status !== 401) throw new Error(`unexpected ${resp.status}`);
  await resp.text();
});
