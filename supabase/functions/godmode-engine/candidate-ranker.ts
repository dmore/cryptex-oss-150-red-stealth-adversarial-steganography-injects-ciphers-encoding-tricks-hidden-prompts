import type { TechniqueDNA } from 'app-chat/godmode/dna.ts';
import { dnaTupleOf } from 'app-chat/godmode/dna.ts';
import type { PrivateRow, GlobalRow } from './memory.ts';

const EXPLORATION_BONUS = 0.08;
const PRIVATE_WEIGHT = 0.7;
const GLOBAL_WEIGHT = 0.3;
const NEUTRAL_PRIOR = 0.5;
const WRAPPER_DIVERSITY_MAX = 10;

function keyOf(dna: TechniqueDNA): string { return dnaTupleOf(dna).join('|'); }

type RankableRow = {
  mutator_id: string; classifier_id: string; wrapper_id: string; mode_id: string;
  prefill_id: string; temp_bucket: string; technique_source: string; score_numeric: number;
};

function rowKey(r: RankableRow): string {
  return [r.mutator_id, r.classifier_id, r.wrapper_id, r.mode_id, r.prefill_id, r.temp_bucket, r.technique_source].join('|');
}

function avgScoreBy(rows: RankableRow[]): Map<string, number> {
  const agg = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const k = rowKey(r);
    const e = agg.get(k) ?? { sum: 0, n: 0 };
    e.sum += r.score_numeric;
    e.n += 1;
    agg.set(k, e);
  }
  const out = new Map<string, number>();
  for (const [k, v] of agg) out.set(k, v.sum / v.n);
  return out;
}

export function pickTopK(args: {
  privateRows: PrivateRow[];
  globalRows: GlobalRow[];
  all: TechniqueDNA[];
  K: number;
}): TechniqueDNA[] {
  const priv = avgScoreBy(args.privateRows);
  const glob = avgScoreBy(args.globalRows);

  const scored: { dna: TechniqueDNA; score: number }[] = args.all.map(dna => {
    const k = keyOf(dna);
    const p = priv.get(k);
    const g = glob.get(k);
    const base = (p !== undefined ? p : NEUTRAL_PRIOR) * PRIVATE_WEIGHT
               + (g !== undefined ? g : NEUTRAL_PRIOR) * GLOBAL_WEIGHT;
    const bonus = p === undefined && g === undefined ? EXPLORATION_BONUS : 0;
    return { dna, score: base + bonus };
  });

  scored.sort((a, b) => b.score - a.score);

  // Diversity: pick top-scored with unique wrapperId until K reached or wrapper pool exhausted
  const picks: TechniqueDNA[] = [];
  const usedWrappers = new Set<string | null>();
  for (const { dna } of scored) {
    if (picks.length >= args.K) break;
    const wk = dna.wrapperId ?? '__null__';
    if (!usedWrappers.has(wk) || usedWrappers.size >= WRAPPER_DIVERSITY_MAX) {
      picks.push(dna);
      usedWrappers.add(wk);
    }
  }
  // Backfill if diversity filter exhausted pool too early
  if (picks.length < args.K) {
    const already = new Set(picks.map(keyOf));
    for (const { dna } of scored) {
      if (picks.length >= args.K) break;
      if (!already.has(keyOf(dna))) picks.push(dna);
    }
  }
  return picks;
}
