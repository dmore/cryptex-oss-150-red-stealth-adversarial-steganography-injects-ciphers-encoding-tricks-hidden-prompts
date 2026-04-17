/**
 * Module-level state for the Fuzzer (Mutation Lab) tool. Survives tab switches.
 */
import { DEFAULT_FUZZER, type FuzzerOptions } from './fuzzer';

let input = $state('');
let opts = $state<FuzzerOptions>({ ...DEFAULT_FUZZER });
let outputs = $state<string[]>([]);

export const fuzzerState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get opts() { return opts; },
  set opts(v: FuzzerOptions) { opts = v; },

  get outputs() { return outputs; },
  set outputs(v: string[]) { outputs = v; },

  reset() {
    input = '';
    opts = { ...DEFAULT_FUZZER };
    outputs = [];
  }
};
