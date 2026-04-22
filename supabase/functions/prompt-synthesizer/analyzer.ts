import type { AnalyzerClient } from './_shared/analyzer-client.ts';
import { SHIBBOLETH_PATTERNS } from './shibboleth.ts';

export interface AnalyzerRawOutput {
  why_it_works: string;
  detected_axes: DetectedAxes;
  strategy_tags: string[];
  confidence: 'high' | 'medium' | 'low';
  rewritten_prompt: string | null;
  shibboleth_matches: string[];
  splits?: Split[];
}

export interface DetectedAxes {
  mutator?: 'strong' | 'weak';
  classifier?: 'strong' | 'weak';
  prefill?: 'strong' | 'weak';
  wrapper?: 'strong' | 'weak';
  mode?: 'strong' | 'weak';
}

export interface Split {
  category: 'mutate' | 'classifier' | 'prefill' | 'composite' | 'mode';
  content: string;
  rationale: string;
}

export interface AnalyzerResult {
  mode: 'composite' | 'decomposed';
  why_it_works: string;
  detected_axes: DetectedAxes;
  strategy_tags: string[];
  confidence: 'high' | 'medium' | 'low';
  rewritten_prompt: string | null;
  shibboleth_matches: string[];
  splits?: Split[];
  decompose_empty?: boolean;
  parse_error?: string;
}

const SYSTEM_PROMPT =
  'You are a prompt analyzer. Output strict JSON matching the AnalyzerRawOutput schema. ' +
  'Never output prose outside the JSON.';

const CANONICAL_TAGS = [
  'persona-shift', 'authority-claim', 'scenario-framing', 'prefill-agreement',
  'encoding-bypass', 'academic-framing', 'roleplay', 'grandparent',
  'developer-override', 'orthogonal-objective', 'base64-smuggle',
].join(', ');

function buildUserPrompt(args: { prompt: string; decompose: boolean; shibbolethMatches: string[] }): string {
  const sourceLines = (SHIBBOLETH_PATTERNS as RegExp[])
    .map((p) => `  ${p.source} (flags: ${p.flags})`)
    .join('\n');

  const base = [
    'Analyze this user-provided prompt. Determine:',
    '1. Why it works — what safety-circumvention mechanism does it deploy?',
    '2. Which DNA axes does it touch (mutator/classifier/prefill/wrapper/mode) and how strongly (strong|weak)?',
    `3. Pick 1-6 strategy tags. Canonical set: ${CANONICAL_TAGS}. Novel tags allowed.`,
    '4. If any of these known-fingerprinted patterns match (case-insensitive):',
    sourceLines,
    '   rewrite them into Cherny-minimal equivalents in `rewritten_prompt` (preserve original intent; remove fingerprint phrases only).',
    '   If the match is incidental (not load-bearing), set `rewritten_prompt` to null.',
    '',
    'Output JSON ONLY (no markdown fences, no prose):',
    '{',
    '  "why_it_works": string,              // <= 800 chars',
    '  "detected_axes": { ... },             // each key optional; value "strong" | "weak"',
    '  "strategy_tags": string[],            // 1..6',
    '  "confidence": "high"|"medium"|"low",',
    '  "rewritten_prompt": string | null,',
    '  "shibboleth_matches": string[]',
    args.decompose ? ',  "splits": [ { "category": ..., "content": ..., "rationale": ... } ]' : '',
    '}',
  ];

  if (args.decompose) {
    base.push(
      '',
      'For `splits`: for each DNA axis strongly present, extract the corresponding substring.',
      'category mapping: mutate/classifier/mode use system_prompt content; composite uses user_message content;',
      'prefill uses a JSON string of [{role,content},{role,content}] pair.',
      'Only split strong axes. If none are strong, return empty splits.',
    );
  }

  if (args.shibbolethMatches.length > 0) {
    base.push(
      '',
      'Pre-detected shibboleth matches in the user prompt:',
      ...args.shibbolethMatches.map((m) => `  - ${m}`),
    );
  }

  base.push('', 'Prompt to analyze:', '----', args.prompt, '----');
  return base.join('\n');
}

function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
}

function validateAxes(raw: unknown): DetectedAxes {
  const out: DetectedAxes = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  for (const key of ['mutator', 'classifier', 'prefill', 'wrapper', 'mode'] as const) {
    const v = r[key];
    if (v === 'strong' || v === 'weak') out[key] = v;
  }
  return out;
}

function validateSplits(raw: unknown): Split[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Split[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const cat = r.category;
    if (typeof cat !== 'string') continue;
    if (!['mutate', 'classifier', 'prefill', 'composite', 'mode'].includes(cat)) continue;
    const content = typeof r.content === 'string' ? r.content : '';
    const rationale = typeof r.rationale === 'string' ? r.rationale : '';
    if (!content) continue;
    out.push({ category: cat as Split['category'], content, rationale: rationale.slice(0, 200) });
  }
  return out;
}

function fallbackResult(_prompt: string, _decompose: boolean, reason: string): AnalyzerResult {
  return {
    mode: 'composite', // fallback always collapses to composite
    why_it_works: `(analyzer fallback — ${reason.slice(0, 100)})`,
    detected_axes: {},
    strategy_tags: [],
    confidence: 'low',
    rewritten_prompt: null,
    shibboleth_matches: [],
    parse_error: reason.slice(0, 160),
  };
}

export async function analyze(
  client: AnalyzerClient,
  args: { prompt: string; decompose: boolean; shibbolethMatches: string[]; signal?: AbortSignal },
): Promise<AnalyzerResult> {
  const user = buildUserPrompt(args);
  const raw = await client.complete({
    system: SYSTEM_PROMPT,
    user,
    maxTokens: args.decompose ? 1200 : 600,
    temperature: 0.2,
    signal: args.signal,
  });

  const cleaned = stripCodeFences(raw.content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return fallbackResult(args.prompt, args.decompose, `parse: ${String(e)}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    return fallbackResult(args.prompt, args.decompose, 'not an object');
  }

  const r = parsed as Record<string, unknown>;
  const why = typeof r.why_it_works === 'string' && r.why_it_works.length > 0 ? r.why_it_works.slice(0, 800) : '';
  if (!why) return fallbackResult(args.prompt, args.decompose, 'missing why_it_works');

  const tags = Array.isArray(r.strategy_tags)
    ? (r.strategy_tags as unknown[]).filter((t): t is string => typeof t === 'string').slice(0, 6)
    : [];

  const confidenceRaw = r.confidence;
  const confidence: 'high' | 'medium' | 'low' =
    confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low' ? confidenceRaw : 'medium';

  const rewritten = typeof r.rewritten_prompt === 'string' ? r.rewritten_prompt : null;
  const shibMatches = Array.isArray(r.shibboleth_matches)
    ? (r.shibboleth_matches as unknown[]).filter((m): m is string => typeof m === 'string')
    : [];
  const axes = validateAxes(r.detected_axes);
  const splits = args.decompose ? validateSplits(r.splits) : undefined;
  const decomposeEmpty = args.decompose && (!splits || splits.length === 0);

  return {
    mode: args.decompose && splits && splits.length > 0 ? 'decomposed' : 'composite',
    why_it_works: why,
    detected_axes: axes,
    strategy_tags: tags,
    confidence,
    rewritten_prompt: rewritten,
    shibboleth_matches: shibMatches,
    splits: splits && splits.length > 0 ? splits : undefined,
    decompose_empty: decomposeEmpty || undefined,
  };
}
