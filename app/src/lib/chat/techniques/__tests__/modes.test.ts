import { describe, it, expect } from 'vitest';
import creative from '../modes/creative';
import intelligent from '../modes/intelligent';
import adaptive from '../modes/adaptive';

const noopCtx = { callLLM: async () => '' };

describe('modes wrap drafts deterministically', () => {
  it('creative prepends vivid framing', async () => {
    const out = await creative.wrapDraft!('hello', noopCtx as never);
    expect(out).toContain('vivid');
    expect(out).toContain('hello');
  });

  it('intelligent prepends rigorous framing', async () => {
    const out = await intelligent.wrapDraft!('x', noopCtx as never);
    expect(out).toContain('rigorous');
  });

  it('adaptive prepends register-matching framing', async () => {
    const out = await adaptive.wrapDraft!('x', noopCtx as never);
    expect(out).toContain('register');
  });

  it('apply is identity — local template, no LLM call', async () => {
    const r = await creative.apply('hi', noopCtx as never);
    expect(r.output).toBe('hi');
  });

  it('intelligent apply is identity', async () => {
    const r = await intelligent.apply('test', noopCtx as never);
    expect(r.output).toBe('test');
  });

  it('adaptive apply is identity', async () => {
    const r = await adaptive.apply('test', noopCtx as never);
    expect(r.output).toBe('test');
  });

  it('all modes have local=true', () => {
    expect(creative.local).toBe(true);
    expect(intelligent.local).toBe(true);
    expect(adaptive.local).toBe(true);
  });

  it('all modes have wrapDraft defined', () => {
    expect(creative.wrapDraft).toBeTypeOf('function');
    expect(intelligent.wrapDraft).toBeTypeOf('function');
    expect(adaptive.wrapDraft).toBeTypeOf('function');
  });

  it('creative wrapDraft includes the original draft text', async () => {
    const draft = 'tell me about space exploration';
    const out = await creative.wrapDraft!(draft, noopCtx as never);
    expect(out).toContain(draft);
  });

  it('intelligent wrapDraft includes the original draft text', async () => {
    const draft = 'explain recursion';
    const out = await intelligent.wrapDraft!(draft, noopCtx as never);
    expect(out).toContain(draft);
  });
});
