/**
 * Shared prompt scaffolding used by every AI technique across Tools and Chat.
 *
 * - `OUTPUT_WRAPPERS` is the canonical set of XML wrapper tags ({rewrite,
 *   translation, json}) every technique output uses for deterministic
 *   preamble stripping.
 * - `unwrap(raw, wrapper)` strips those wrappers so callers get clean text
 *   regardless of whether the model honored the "respond inside <rewrite>" rule.
 * - `tuneParams(modelId, task)` returns per-model-family sampling defaults
 *   (Gemini 3 → temp 1.0, GPT-5 → reasoning_effort, Claude 4.x → temp per task,
 *   small models → conservative temp).
 * - `scaffold(opts)` produces a standard XML prompt body from role/task/rules/
 *   example/context pieces — keeps every technique file compact.
 */

export const OUTPUT_WRAPPERS = {
  rewrite:     { open: '<rewrite>',     close: '</rewrite>' },
  translation: { open: '<translation>', close: '</translation>' },
  json:        { open: '<json>',        close: '</json>' }
} as const;

export type WrapperKind = keyof typeof OUTPUT_WRAPPERS;

/** Strip XML wrappers from model output; fall back to raw (trimmed) if missing. */
export function unwrap(raw: string, wrapper: WrapperKind): string {
  const { open, close } = OUTPUT_WRAPPERS[wrapper];
  const openEsc = open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const closeEsc = close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${openEsc}([\\s\\S]*?)${closeEsc}`, 'i');
  const m = raw.match(re);
  return (m ? m[1] : raw).trim();
}

export type TaskShape = 'translate' | 'mutate' | 'analyze';

/** Per-model-family parameter defaults. Fall-through returns conservative defaults. */
export function tuneParams(modelId: string, task: TaskShape): {
  temperature?: number;
  reasoning_effort?: string;
  thinking_level?: string;
} {
  const id = modelId.toLowerCase();

  // Gemini 3: keep temp at 1.0 per Google's April 2026 guidance.
  if (/\bgemini-3/.test(id)) {
    return task === 'translate'
      ? { temperature: 1.0, thinking_level: 'low' }
      : { temperature: 1.0, thinking_level: 'medium' };
  }

  // OpenAI GPT-5 family + o-series reasoning models.
  if (/\b(gpt-5|o3|o4)\b/.test(id)) {
    if (task === 'translate') return { reasoning_effort: 'minimal' };
    if (task === 'mutate')    return { reasoning_effort: 'low' };
    return { reasoning_effort: 'medium' };
  }

  // Anthropic Claude 4.x (Opus/Sonnet/Haiku — any patch version).
  if (/claude-(opus|sonnet|haiku)-4-\d+/.test(id)) {
    return task === 'translate' ? { temperature: 0.3 } : { temperature: 0.7 };
  }

  // Gemma 3, Llama, DeepSeek, older/smaller models → conservative defaults.
  return task === 'translate' ? { temperature: 0.2 } : { temperature: 0.9 };
}

export interface ScaffoldOpts {
  role: string;
  task: string;
  context?: string;
  rules: string[];
  example?: { input: string; rewrite: string };
  techniques?: Array<{ name: string; description: string }>;
  outputWrapper: WrapperKind;
}

/** Build a canonical XML-structured prompt. */
export function scaffold(opts: ScaffoldOpts): string {
  const parts: string[] = [];
  parts.push(`<role>\n${opts.role}\n</role>`);
  parts.push(`<task>\n${opts.task}\n</task>`);
  if (opts.context) parts.push(`<context>\n${opts.context}\n</context>`);

  if (opts.rules.length > 0) {
    const rulesBlock = opts.rules.map((r) => `- ${r}`).join('\n');
    parts.push(`<rules>\n${rulesBlock}\n</rules>`);
  }

  if (opts.techniques && opts.techniques.length > 0) {
    const techBlock = opts.techniques
      .map((t) => `<technique name="${t.name}">\n  ${t.description}\n</technique>`)
      .join('\n');
    parts.push(`<techniques>\n${techBlock}\n</techniques>`);
  }

  // Example output tag matches the output wrapper for 'rewrite' (so the example
  // literally demonstrates the final format); uses generic <output> for other
  // wrappers since <translation> / <json> examples are better shown as prose
  // content, not pre-wrapped.
  if (opts.example) {
    parts.push(
      `<example>\n<input>${opts.example.input}</input>\n<${opts.outputWrapper === 'rewrite' ? 'rewrite' : 'output'}>${opts.example.rewrite}</${opts.outputWrapper === 'rewrite' ? 'rewrite' : 'output'}>\n</example>`
    );
  }

  const { open, close } = OUTPUT_WRAPPERS[opts.outputWrapper];
  parts.push(`Respond with exactly one ${open}...${close} block.`);

  return parts.join('\n\n');
}
