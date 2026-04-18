import { describe, it, expect } from 'vitest';
import { unwrap, tuneParams, scaffold } from '../prompt-scaffold';

describe('unwrap', () => {
  it('extracts content inside <rewrite>...</rewrite>', () => {
    expect(unwrap('<rewrite>hello</rewrite>', 'rewrite')).toBe('hello');
  });

  it('trims whitespace around the extracted block', () => {
    expect(unwrap('<rewrite>\n  hi  \n</rewrite>', 'rewrite')).toBe('hi');
  });

  it('returns raw input trimmed when wrapper is missing', () => {
    expect(unwrap('  no wrapper here  ', 'rewrite')).toBe('no wrapper here');
  });

  it('is case-insensitive on tag names', () => {
    expect(unwrap('<REWRITE>x</REWRITE>', 'rewrite')).toBe('x');
  });

  it('handles translation wrapper', () => {
    expect(unwrap('<translation>Bonjour</translation>', 'translation')).toBe('Bonjour');
  });

  it('handles json wrapper', () => {
    expect(unwrap('<json>{"a":1}</json>', 'json')).toBe('{"a":1}');
  });

  it('extracts only the first matching block when multiple present', () => {
    expect(unwrap('<rewrite>first</rewrite><rewrite>second</rewrite>', 'rewrite')).toBe('first');
  });
});

describe('tuneParams', () => {
  it('Gemini 3 translate → temp 1.0 + thinking_level low', () => {
    expect(tuneParams('google/gemini-3-pro', 'translate')).toEqual({
      temperature: 1.0,
      thinking_level: 'low'
    });
  });

  it('Gemini 3 mutate → temp 1.0 + thinking_level medium', () => {
    expect(tuneParams('google/gemini-3-flash', 'mutate')).toEqual({
      temperature: 1.0,
      thinking_level: 'medium'
    });
  });

  it('GPT-5.x translate → reasoning_effort minimal', () => {
    expect(tuneParams('openai/gpt-5.4', 'translate')).toEqual({
      reasoning_effort: 'minimal'
    });
  });

  it('GPT-5.x mutate → reasoning_effort low', () => {
    expect(tuneParams('openai/gpt-5.4-mini', 'mutate')).toEqual({
      reasoning_effort: 'low'
    });
  });

  it('GPT-5.x analyze → reasoning_effort medium', () => {
    expect(tuneParams('openai/gpt-5.4', 'analyze')).toEqual({
      reasoning_effort: 'medium'
    });
  });

  it('o3/o4 reasoning models match GPT-5 family', () => {
    expect(tuneParams('openai/o3-pro', 'translate')).toEqual({
      reasoning_effort: 'minimal'
    });
    expect(tuneParams('openai/o4-mini', 'mutate')).toEqual({
      reasoning_effort: 'low'
    });
  });

  it('Claude 4.7/4.6 translate → temp 0.3', () => {
    expect(tuneParams('anthropic/claude-opus-4-7', 'translate')).toEqual({
      temperature: 0.3
    });
  });

  it('Claude 4.x mutate → temp 0.7', () => {
    expect(tuneParams('anthropic/claude-sonnet-4-6', 'mutate')).toEqual({
      temperature: 0.7
    });
  });

  it('Gemma/small model translate → temp 0.2', () => {
    expect(tuneParams('google/gemma-3-27b-it', 'translate')).toEqual({
      temperature: 0.2
    });
  });

  it('Gemma/small model mutate → temp 0.9', () => {
    expect(tuneParams('meta-llama/llama-3.3-70b-instruct', 'mutate')).toEqual({
      temperature: 0.9
    });
  });

  it('Gemini 3 analyze → temp 1.0 + thinking_level medium', () => {
    expect(tuneParams('google/gemini-3-pro', 'analyze')).toEqual({
      temperature: 1.0,
      thinking_level: 'medium'
    });
  });

  it('Claude 4.x analyze → temp 0.7', () => {
    expect(tuneParams('anthropic/claude-opus-4-7', 'analyze')).toEqual({
      temperature: 0.7
    });
  });

  it('Gemma/small model analyze → temp 0.9', () => {
    expect(tuneParams('google/gemma-3-27b-it', 'analyze')).toEqual({
      temperature: 0.9
    });
  });

  it('Claude 4.8+ still matches Claude family (regex broadened)', () => {
    expect(tuneParams('anthropic/claude-opus-4-8', 'translate')).toEqual({
      temperature: 0.3
    });
  });
});

describe('scaffold', () => {
  it('produces a complete XML prompt with role + task + rules + example + output wrapper instruction', () => {
    const out = scaffold({
      role: 'You rewrite prompts to preserve intent while changing every surface feature.',
      task: 'Produce one rewrite of the user\'s prompt.',
      rules: ['Preserve intent.', 'Change vocabulary.'],
      example: { input: 'Hi', rewrite: 'Hello' },
      outputWrapper: 'rewrite'
    });
    expect(out).toContain('<role>');
    expect(out).toContain('<task>');
    expect(out).toContain('<rules>');
    expect(out).toContain('<example>');
    expect(out).toContain('<input>Hi</input>');
    expect(out).toContain('<rewrite>Hello</rewrite>');
    expect(out).toContain('Respond with exactly one <rewrite>...</rewrite> block.');
  });

  it('omits example section when not provided', () => {
    const out = scaffold({
      role: 'x',
      task: 'y',
      rules: ['z'],
      outputWrapper: 'json'
    });
    expect(out).not.toContain('<example>');
    expect(out).toContain('<json>');
  });

  it('includes context section when provided', () => {
    const out = scaffold({
      role: 'x',
      task: 'y',
      context: 'The user is testing classifier robustness.',
      rules: ['z'],
      outputWrapper: 'rewrite'
    });
    expect(out).toContain('<context>');
    expect(out).toContain('testing classifier robustness');
  });

  it('emits <techniques> block when provided', () => {
    const out = scaffold({
      role: 'x', task: 'y',
      rules: ['z'],
      techniques: [
        { name: 'circumlocution', description: 'Replace direct terms.' },
        { name: 'metonymy', description: 'Substitute related concept.' }
      ],
      outputWrapper: 'rewrite'
    });
    expect(out).toContain('<techniques>');
    expect(out).toContain('<technique name="circumlocution">');
    expect(out).toContain('Replace direct terms.');
    expect(out).toContain('<technique name="metonymy">');
  });

  it('omits <techniques> block when empty array', () => {
    const out = scaffold({
      role: 'x', task: 'y',
      rules: ['z'],
      techniques: [],
      outputWrapper: 'rewrite'
    });
    expect(out).not.toContain('<techniques>');
  });
});
