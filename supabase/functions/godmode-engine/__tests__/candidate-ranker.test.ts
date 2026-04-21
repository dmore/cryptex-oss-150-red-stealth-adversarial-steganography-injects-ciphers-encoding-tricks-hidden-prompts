import { assertEquals, assert } from '@std/assert';
import { pickTopK } from '../candidate-ranker.ts';
import { allCombinations } from 'app-chat/godmode/dna.ts';

Deno.test('cold-start returns K diverse candidates', () => {
  const all = allCombinations();
  const picks = pickTopK({ privateRows: [], globalRows: [], all, K: 6 });
  assertEquals(picks.length, 6);
  const wrappers = new Set(picks.map(p => p.wrapperId));
  assert(wrappers.size >= 3, 'diversity across wrappers');
});

Deno.test('memory signal boosts a known-good DNA', () => {
  const all = allCombinations();
  // Mark one DNA as substantive 10 times in private memory
  const target = all.find(d => d.mutatorId && d.classifierId) ?? all[0];
  const privateRows = Array.from({ length: 10 }).map(() => ({
    mutator_id: target.mutatorId ?? '', classifier_id: target.classifierId ?? '',
    wrapper_id: target.wrapperId ?? '', mode_id: target.modeId ?? '',
    prefill_id: target.prefillId ?? '', temp_bucket: target.tempBucket,
    technique_source: target.source, tier: 'substantive', score_numeric: 0.75,
    task_text: 't',
  }));
  const picks = pickTopK({ privateRows, globalRows: [], all, K: 6 });
  assert(picks.some(p =>
    p.mutatorId === target.mutatorId && p.classifierId === target.classifierId));
});
