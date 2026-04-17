/**
 * Port of js/core/transformOptions.js — merges a transformer's option
 * schema defaults with user prefs saved in the `cryptex.transformOptionPrefs`
 * localStorage blob. Shape-identical to the legacy contract so the same
 * transformer `func(text, options)` calls keep working.
 */

import { browser } from '$app/environment';
import type { Transformer } from './registry';

const STORAGE_KEY = 'cryptex.transformOptionPrefs';

type Prefs = Record<string, Record<string, unknown>>;

function readPrefs(): Prefs {
  if (!browser) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Prefs) : {};
  } catch {
    return {};
  }
}

function writePrefs(next: Prefs): void {
  if (!browser) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / disabled — ignore */
  }
}

function schemaDefault(opt: NonNullable<Transformer['configurableOptions']>[number]): unknown {
  if (opt.default !== undefined && opt.default !== null) return opt.default;
  switch (opt.type) {
    case 'boolean': return false;
    case 'select':  return opt.options && opt.options.length ? opt.options[0].value : '';
    case 'number':  return 0;
    default:        return '';
  }
}

export function getMergedTransformOptions(transform: Transformer): Record<string, unknown> {
  if (!transform?.configurableOptions?.length) return {};

  const merged: Record<string, unknown> = {};
  for (const opt of transform.configurableOptions) merged[opt.id] = schemaDefault(opt);

  const all = readPrefs();
  const saved = (transform.name && all[transform.name]) || {};
  return { ...merged, ...saved };
}

export function setTransformOption(
  transformName: string,
  optionId: string,
  value: unknown
): void {
  if (!transformName) return;
  const all = readPrefs();
  all[transformName] = { ...(all[transformName] || {}), [optionId]: value };
  writePrefs(all);
}

export function resetTransformOptions(transformName: string): void {
  const all = readPrefs();
  if (transformName in all) {
    delete all[transformName];
    writePrefs(all);
  }
}
