import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { Tokens } from 'marked';
import CodeBlock from '../CodeBlock.svelte';

function makeToken(lang: string, text: string): Tokens.Code {
  return {
    type: 'code',
    raw: '```' + lang + '\n' + text + '\n```',
    lang,
    text
  } as Tokens.Code;
}

describe('CodeBlock', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true
    });
  });

  it('renders the language label from token.lang (uppercased)', () => {
    const token = makeToken('php', '<?php echo "hi"; ?>');
    const { getByText } = render(CodeBlock, { token, id: 'c1' });
    // The class makes it uppercase visually; text content is still lowercase 'php'
    expect(getByText('php')).toBeTruthy();
  });

  it('renders token.text verbatim inside the <pre>', () => {
    const text = 'line one\n  indented line\nthird';
    const token = makeToken('js', text);
    const { container } = render(CodeBlock, { token, id: 'c2' });
    const pre = container.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre!.textContent).toBe(text);
  });

  it('copy button calls navigator.clipboard.writeText with token.text', async () => {
    const text = 'console.log("hello");';
    const token = makeToken('js', text);
    const { getByLabelText } = render(CodeBlock, { token, id: 'c3' });
    const btn = getByLabelText('Copy code');
    await fireEvent.click(btn);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(text);
  });

  it('falls back to "text" label when token.lang is empty', () => {
    const token = makeToken('', 'plain payload');
    const { getByText } = render(CodeBlock, { token, id: 'c4' });
    expect(getByText('text')).toBeTruthy();
  });
});
