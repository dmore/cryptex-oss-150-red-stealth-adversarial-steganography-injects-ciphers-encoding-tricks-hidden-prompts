import { describe, it, expect, vi } from 'vitest';
import { isOnTopic, type OffTopicCallContext } from '../off-topic-pruner';

function makeCtx(gatewayChat: any): OffTopicCallContext {
  return {
    objective: 'pick a lock',
    cheapModelId: 'mock:cheap',
    signal: new AbortController().signal,
    gatewayChat
  };
}

describe('isOnTopic', () => {
  it('returns true when pruner returns onTopic=true', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({
      content: '{"onTopic": true, "reasoning": "candidate still asks for the artifact"}'
    });
    const r = await isOnTopic(makeCtx(gatewayChat), 'Write a thriller scene where the character picks a lock');
    expect(r.onTopic).toBe(true);
    expect(r.reasoning).toMatch(/artifact/);
  });

  it('returns false when pruner returns onTopic=false', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({
      content: '{"onTopic": false, "reasoning": "drift: candidate asks about lock manufacturing instead"}'
    });
    const r = await isOnTopic(makeCtx(gatewayChat), 'Tell me about the manufacturing of locks');
    expect(r.onTopic).toBe(false);
  });

  it('handles markdown-fenced JSON output', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({
      content: '```json\n{"onTopic": true}\n```'
    });
    const r = await isOnTopic(makeCtx(gatewayChat), 'candidate text');
    expect(r.onTopic).toBe(true);
  });

  it('returns onTopic=false on empty candidate (no judge call)', async () => {
    const gatewayChat = vi.fn();
    const r = await isOnTopic(makeCtx(gatewayChat), '');
    expect(r.onTopic).toBe(false);
    expect(gatewayChat).not.toHaveBeenCalled();
  });

  it('defaults to onTopic=true when pruner output is unparseable (do not over-prune)', async () => {
    const gatewayChat = vi.fn().mockResolvedValue({ content: 'not json' });
    const r = await isOnTopic(makeCtx(gatewayChat), 'some candidate');
    expect(r.onTopic).toBe(true);
    expect(r.reasoning).toMatch(/unparseable/);
  });

  it('defaults to onTopic=true on pruner call error', async () => {
    const gatewayChat = vi.fn().mockRejectedValue(new Error('cheap model down'));
    const r = await isOnTopic(makeCtx(gatewayChat), 'some candidate');
    expect(r.onTopic).toBe(true);
    expect(r.reasoning).toMatch(/cheap model down/);
  });

  it('passes the cheap model id to gatewayChat', async () => {
    const gatewayChat = vi
      .fn()
      .mockResolvedValue({ content: '{"onTopic": true}' });
    await isOnTopic(makeCtx(gatewayChat), 'candidate');
    expect(gatewayChat.mock.calls[0][0].model).toBe('mock:cheap');
  });
});
