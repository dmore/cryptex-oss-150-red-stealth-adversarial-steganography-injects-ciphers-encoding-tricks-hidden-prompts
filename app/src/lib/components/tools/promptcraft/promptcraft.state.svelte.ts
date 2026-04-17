/**
 * Module-level state for the PromptCraft tool. Survives tab switches.
 * Loading/error flags remain component-local.
 */
import type { StrategyId } from './strategies';

let input = $state('');
let strategy = $state<StrategyId>('rephrase');
let customInstruction = $state('');
let count = $state(3);
let outputs = $state<string[]>([]);

export const promptcraftState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get strategy() { return strategy; },
  set strategy(v: StrategyId) { strategy = v; },

  get customInstruction() { return customInstruction; },
  set customInstruction(v: string) { customInstruction = v; },

  get count() { return count; },
  set count(v: number) { count = v; },

  get outputs() { return outputs; },
  set outputs(v: string[]) { outputs = v; },

  reset() {
    input = '';
    strategy = 'rephrase';
    customInstruction = '';
    count = 3;
    outputs = [];
  }
};
