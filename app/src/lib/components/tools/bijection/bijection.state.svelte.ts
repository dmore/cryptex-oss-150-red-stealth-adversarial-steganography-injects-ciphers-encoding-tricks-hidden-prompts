/**
 * Module-level state for the Bijection tool. Survives tab switches.
 */
import { DEFAULT_BIJECTION, type BijectionOptions, type BijectionPayload } from './bijection';

let input = $state('');
let opts = $state<BijectionOptions>({ ...DEFAULT_BIJECTION });
let autoCopy = $state(false);
let outputs = $state<BijectionPayload[]>([]);

export const bijectionState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get opts() { return opts; },
  set opts(v: BijectionOptions) { opts = v; },

  get autoCopy() { return autoCopy; },
  set autoCopy(v: boolean) { autoCopy = v; },

  get outputs() { return outputs; },
  set outputs(v: BijectionPayload[]) { outputs = v; },

  reset() {
    input = '';
    opts = { ...DEFAULT_BIJECTION };
    autoCopy = false;
    outputs = [];
  }
};
