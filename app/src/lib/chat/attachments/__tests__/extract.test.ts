import { describe, it, expect } from 'vitest';
import { extractAttachment } from '../extract';

describe('extractAttachment', () => {
  it('routes text files to text branch', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const r = await extractAttachment(file);
    expect(r.kind).toBe('text');
    expect(r.extractedText).toBe('hello');
  });

  it('returns "other" for unknown types', async () => {
    const file = new File([new ArrayBuffer(4)], 'weird.xyz', { type: 'application/x-unknown' });
    const r = await extractAttachment(file);
    expect(r.kind).toBe('other');
  });
});
