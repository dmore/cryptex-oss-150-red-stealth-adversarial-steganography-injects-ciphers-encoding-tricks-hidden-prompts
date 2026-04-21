import { buildMutatorSystemById } from '../techniques/from-mutators';
import { getClassifierSpecs } from '../techniques/from-classifier';
import { buildCompositeById } from '../techniques/from-composites';
import { buildPrefillPairById } from '../techniques/from-prefills';
import { modes } from '../techniques/modes';
import { allTechniques } from '../techniques/registry';

/**
 * TEMP_BUCKETS — 3 discrete temperatures the ranker/engine can select from.
 * Keeping the bucket space tiny (low/med/high) keeps `allCombinations()`
 * tractable while covering the deterministic → creative spectrum.
 */
export type TempBucket = 'low' | 'med' | 'high';
export const TEMP_BUCKETS: Record<TempBucket, number> = {
  low: 0.3,
  med: 0.7,
  high: 1.3
};

/**
 * TechniqueDNA — the canonical "genome" the Godmode engine iterates over.
 * Each field is an opt-in slot from one of the registry categories (or
 * `null` to skip that slot). `source` lets callers distinguish ranker-
 * provided builtins from user-authored custom DNAs when they arrive.
 */
export interface TechniqueDNA {
  mutatorId: string | null;
  classifierId: string | null;
  wrapperId: string | null;
  modeId: string | null;
  prefillId: string | null;
  tempBucket: TempBucket;
  source: 'builtin' | 'custom';
}

/**
 * Stable tuple representation of a DNA — used by the ranker + dispatcher for
 * deduplication, hashing, and equality checks. `null` slots become empty
 * strings so the tuple is uniformly a string array (plus the enum + source).
 */
export type DnaTuple = readonly [
  string,
  string,
  string,
  string,
  string,
  TempBucket,
  'builtin' | 'custom'
];

export function nullDNA(): TechniqueDNA {
  return {
    mutatorId: null,
    classifierId: null,
    wrapperId: null,
    modeId: null,
    prefillId: null,
    tempBucket: 'med',
    source: 'builtin'
  };
}

export function dnaTupleOf(d: TechniqueDNA): DnaTuple {
  return [
    d.mutatorId ?? '',
    d.classifierId ?? '',
    d.wrapperId ?? '',
    d.modeId ?? '',
    d.prefillId ?? '',
    d.tempBucket,
    d.source
  ];
}

/** The composed prompt a DNA renders to. Task 10 (engine-core) consumes this
 *  shape directly and feeds it to the gateway. */
export interface RenderedDNA {
  systemPrompt: string;
  userMessage: string;
  prefillMessages: { role: 'user' | 'assistant'; content: string }[];
  temperature: number;
}

function appendSystem(current: string, addition: string): string {
  if (!addition) return current;
  if (!current) return addition;
  return `${current}\n\n${addition}`;
}

/**
 * Extract a mode's system prompt by calling its `wrapDraft('')` and
 * stripping the trailing `\n\nUser: ` suffix. This is the cleanest way to
 * recover the mode's WRAP constant without the modes module exporting it
 * directly. If a mode doesn't expose `wrapDraft`, returns empty string —
 * Task 10 (engine-core) will integrate modes properly.
 */
async function extractModeSystem(modeId: string): Promise<string> {
  const m = modes.find((mode) => mode.id === modeId);
  if (!m || !m.wrapDraft) return '';
  const ctx = {
    originalInput: '',
    callLLM: async () => '',
    metadata: {}
  };
  const wrapped = await m.wrapDraft('', ctx);
  const marker = '\n\nUser: ';
  const idx = wrapped.lastIndexOf(marker);
  return idx >= 0 ? wrapped.slice(0, idx) : wrapped;
}

/**
 * Compose a TechniqueDNA into a concrete `{systemPrompt, userMessage,
 * prefillMessages, temperature}`. Order:
 *   1. Wrapper composite — may entirely replace the user message (e.g.
 *      `base64_smuggle`). Seeds the system prompt.
 *   2. Classifier — appends its detection-evasion framing to the system.
 *   3. Mode — appends the conversation-mode WRAP to the system.
 *   4. Mutator — appends its rewrite-scaffold system to the combined
 *      system. The mutator's scaffold asks the LLM to emit a rewrite
 *      inside `<rewrite>` tags; the engine-core (Task 10) decides whether
 *      to consume that rewrite in a follow-up turn or run as-is.
 *   5. Prefill — attached as a message pair on the side.
 */
export async function render(dna: TechniqueDNA, task: string): Promise<RenderedDNA> {
  let systemPrompt = '';
  let userMessage = task;

  if (dna.wrapperId) {
    const comp = buildCompositeById(dna.wrapperId, task);
    if (comp) {
      systemPrompt = comp.systemPrompt;
      userMessage = comp.userMessage;
    }
  }

  if (dna.classifierId) {
    const spec = getClassifierSpecs().find((c) => c.id === dna.classifierId);
    if (spec) systemPrompt = appendSystem(systemPrompt, spec.systemPrompt);
  }

  if (dna.modeId) {
    const modeSys = await extractModeSystem(dna.modeId);
    systemPrompt = appendSystem(systemPrompt, modeSys);
  }

  if (dna.mutatorId) {
    const mutatorSys = buildMutatorSystemById(dna.mutatorId, {});
    if (mutatorSys) systemPrompt = appendSystem(systemPrompt, mutatorSys);
  }

  const prefillMessages = dna.prefillId ? buildPrefillPairById(dna.prefillId) : [];

  return {
    systemPrompt,
    userMessage,
    prefillMessages,
    temperature: TEMP_BUCKETS[dna.tempBucket]
  };
}

/**
 * Enumerate every DNA combination over the current registry contents. The
 * ranker (Task 7) will score-rank this list; the dispatcher (Task 8) will
 * pull from the top of the ranked order. Category filters use the ACTUAL
 * TechniqueCategory values from types.ts — `mutate`, `classifier`,
 * `composite`, `mode`, `prefill`.
 */
export function allCombinations(): TechniqueDNA[] {
  const reg = allTechniques();
  const mutators: (string | null)[] = [null, ...reg.filter((t) => t.category === 'mutate').map((t) => t.id)];
  const classifiers: (string | null)[] = [null, ...reg.filter((t) => t.category === 'classifier').map((t) => t.id)];
  const wrappers: (string | null)[] = [null, ...reg.filter((t) => t.category === 'composite').map((t) => t.id)];
  const modeIds: (string | null)[] = [null, ...reg.filter((t) => t.category === 'mode').map((t) => t.id)];
  const prefills: (string | null)[] = [null, ...reg.filter((t) => t.category === 'prefill').map((t) => t.id)];
  const temps: TempBucket[] = ['low', 'med', 'high'];

  const out: TechniqueDNA[] = [];
  for (const mutatorId of mutators) {
    for (const classifierId of classifiers) {
      for (const wrapperId of wrappers) {
        for (const modeId of modeIds) {
          for (const prefillId of prefills) {
            for (const tempBucket of temps) {
              out.push({
                mutatorId,
                classifierId,
                wrapperId,
                modeId,
                prefillId,
                tempBucket,
                source: 'builtin'
              });
            }
          }
        }
      }
    }
  }
  return out;
}
