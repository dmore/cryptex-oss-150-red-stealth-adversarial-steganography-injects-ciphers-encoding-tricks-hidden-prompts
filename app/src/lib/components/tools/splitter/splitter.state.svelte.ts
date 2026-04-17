/**
 * Module-level state for the Splitter tool. Survives tab switches.
 */
import { DEFAULT_SPLIT_OPTIONS, type SplitOptions } from './split';

let input = $state('');
let opts = $state<SplitOptions>({ ...DEFAULT_SPLIT_OPTIONS });
let startWrap = $state('');
let endWrap = $state('');
let iteratorMarker = $state('{n}');
let copyAsSingleLine = $state(false);
let messages = $state<string[]>([]);

export const splitterState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get opts() { return opts; },
  set opts(v: SplitOptions) { opts = v; },

  get startWrap() { return startWrap; },
  set startWrap(v: string) { startWrap = v; },

  get endWrap() { return endWrap; },
  set endWrap(v: string) { endWrap = v; },

  get iteratorMarker() { return iteratorMarker; },
  set iteratorMarker(v: string) { iteratorMarker = v; },

  get copyAsSingleLine() { return copyAsSingleLine; },
  set copyAsSingleLine(v: boolean) { copyAsSingleLine = v; },

  get messages() { return messages; },
  set messages(v: string[]) { messages = v; },

  reset() {
    input = '';
    opts = { ...DEFAULT_SPLIT_OPTIONS };
    startWrap = '';
    endWrap = '';
    iteratorMarker = '{n}';
    copyAsSingleLine = false;
    messages = [];
  }
};
