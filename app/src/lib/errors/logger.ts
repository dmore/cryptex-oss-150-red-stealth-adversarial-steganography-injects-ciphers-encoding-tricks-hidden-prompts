import { browser } from '$app/environment';
import { notify } from '$lib/stores/toast.svelte';
import { sessionLog } from '$lib/stores/sessionLog.svelte';
import type { CryptexError } from './types';
import { toCryptexError } from './translate';

export interface ReportOptions {
  /** If false, no toast is shown. Default true. */
  toast?: boolean;
  /** If false, no sessionLog entry is recorded. Default true. */
  session?: boolean;
  /** Override the toast message. Default uses err.userMessage. */
  toastMessage?: string;
}

/**
 * Single funnel for every caught error in the codebase. Always returns the
 * normalized CryptexError so callers can render it in an ErrorPanel.
 */
export function report(err: unknown, opts: ReportOptions = {}): CryptexError {
  const ce = toCryptexError(err);

  // Dev console
  if (browser && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(`[cryptex:${ce.category}]`, ce.userMessage, ce.cause ?? ce);
  }

  // Toast (user-visible)
  if (opts.toast !== false) {
    notify.error(opts.toastMessage ?? ce.userMessage);
  }

  // Session log (audit)
  if (opts.session !== false) {
    try {
      const sl = sessionLog as unknown as {
        recordError?: (entry: {
          category: string;
          message: string;
          context?: Record<string, unknown>;
          timestamp: number;
        }) => void;
      };
      sl.recordError?.({
        category: ce.category,
        message: ce.userMessage,
        context: ce.context,
        timestamp: Date.now()
      });
    } catch {
      // sessionLog may not have recordError yet — Wave 4 adds it. Ignore for now.
    }
  }

  return ce;
}

export const errorLogger = { report };
