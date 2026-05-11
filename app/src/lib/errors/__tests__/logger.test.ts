import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks: capture spies for notify.error so we can assert calls.
const notifySpies = vi.hoisted(() => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}));

vi.mock('$lib/stores/toast.svelte', () => ({
  notify: notifySpies,
  toasts: {
    get items() {
      return [];
    },
    push: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn()
  }
}));

// sessionLog mock — recordError is intentionally optional (Wave 4 will add it)
const sessionLogMock = vi.hoisted(() => ({
  recordError: vi.fn()
}));

vi.mock('$lib/stores/sessionLog.svelte', () => ({
  sessionLog: sessionLogMock,
  downloadText: vi.fn()
}));

beforeEach(() => {
  notifySpies.info.mockClear();
  notifySpies.success.mockClear();
  notifySpies.error.mockClear();
  notifySpies.warn.mockClear();
  sessionLogMock.recordError.mockClear();
});

describe('errorLogger.report', () => {
  it('calls notify.error once for a plain Error', async () => {
    const { report } = await import('../logger');
    report(new Error('boom'));
    expect(notifySpies.error).toHaveBeenCalledTimes(1);
    expect(notifySpies.error).toHaveBeenCalledWith('boom');
  });

  it('does not call notify when toast option is false', async () => {
    const { report } = await import('../logger');
    report(new Error('silent'), { toast: false });
    expect(notifySpies.error).not.toHaveBeenCalled();
  });

  it('returns a CryptexError of category unknown for plain Error', async () => {
    const { report } = await import('../logger');
    const ce = report(new Error('boom'), { toast: false });
    expect(ce.category).toBe('unknown');
    expect(ce.userMessage).toBe('boom');
    expect(ce.retryable).toBe(false);
  });

  it('uses toastMessage override when provided', async () => {
    const { report } = await import('../logger');
    report(new Error('raw'), { toastMessage: 'friendly' });
    expect(notifySpies.error).toHaveBeenCalledWith('friendly');
  });

  it('calls sessionLog.recordError by default', async () => {
    const { report } = await import('../logger');
    report(new Error('audit me'), { toast: false });
    expect(sessionLogMock.recordError).toHaveBeenCalledTimes(1);
    const entry = sessionLogMock.recordError.mock.calls[0][0];
    expect(entry.category).toBe('unknown');
    expect(entry.message).toBe('audit me');
    expect(typeof entry.timestamp).toBe('number');
  });

  it('skips sessionLog.recordError when session option is false', async () => {
    const { report } = await import('../logger');
    report(new Error('no audit'), { toast: false, session: false });
    expect(sessionLogMock.recordError).not.toHaveBeenCalled();
  });

  it('re-throws AbortError instead of reporting', async () => {
    const { report } = await import('../logger');
    const abort = new DOMException('aborted', 'AbortError');
    expect(() => report(abort)).toThrow();
    expect(notifySpies.error).not.toHaveBeenCalled();
  });
});
