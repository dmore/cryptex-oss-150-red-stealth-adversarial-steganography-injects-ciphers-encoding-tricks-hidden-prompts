/**
 * Module-level state for the Tokenade tool. Survives tab switches.
 */
import { DEFAULT_TOKENADE, type TokenadeOptions } from './tokenade';

export type Tab = 'emoji' | 'text';

let activeTab = $state<Tab>('emoji');
let opts = $state<TokenadeOptions>({ ...DEFAULT_TOKENADE });
let autoCopy = $state(true);
let output = $state('');
let tpBase = $state('A');
let tpRepeat = $state(100);
let tpCombining = $state(true);
let tpZW = $state(false);
let textPayload = $state('');

export const tokenadeState = {
  get activeTab() { return activeTab; },
  set activeTab(v: Tab) { activeTab = v; },

  get opts() { return opts; },
  set opts(v: TokenadeOptions) { opts = v; },

  get autoCopy() { return autoCopy; },
  set autoCopy(v: boolean) { autoCopy = v; },

  get output() { return output; },
  set output(v: string) { output = v; },

  get tpBase() { return tpBase; },
  set tpBase(v: string) { tpBase = v; },

  get tpRepeat() { return tpRepeat; },
  set tpRepeat(v: number) { tpRepeat = v; },

  get tpCombining() { return tpCombining; },
  set tpCombining(v: boolean) { tpCombining = v; },

  get tpZW() { return tpZW; },
  set tpZW(v: boolean) { tpZW = v; },

  get textPayload() { return textPayload; },
  set textPayload(v: string) { textPayload = v; },

  reset() {
    activeTab = 'emoji';
    opts = { ...DEFAULT_TOKENADE };
    autoCopy = true;
    output = '';
    tpBase = 'A';
    tpRepeat = 100;
    tpCombining = true;
    tpZW = false;
    textPayload = '';
  }
};
