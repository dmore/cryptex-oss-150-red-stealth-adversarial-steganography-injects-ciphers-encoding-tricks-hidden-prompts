/**
 * Module-level state for the Tokenizer tool. Survives tab switches.
 */
export type Engine = 'byte' | 'word' | 'cl100k' | 'o200k' | 'p50k' | 'r50k';
export type Token = { id?: number; text: string };

let input = $state('The quick brown fox jumps over the lazy dog.');
let engine = $state<Engine>('cl100k');
let tokens = $state<Token[]>([]);

export const tokenizerState = {
  get input() { return input; },
  set input(v: string) { input = v; },

  get engine() { return engine; },
  set engine(v: Engine) { engine = v; },

  get tokens() { return tokens; },
  set tokens(v: Token[]) { tokens = v; },

  reset() {
    input = 'The quick brown fox jumps over the lazy dog.';
    engine = 'cl100k';
    tokens = [];
  }
};
