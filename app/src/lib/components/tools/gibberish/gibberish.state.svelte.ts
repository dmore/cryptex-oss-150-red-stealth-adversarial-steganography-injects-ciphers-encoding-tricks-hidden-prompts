/**
 * Module-level state for the Gibberish tool. Survives tab switches.
 */
export type TopMode = 'dictionary' | 'removal';
export type RemovalMode = 'random' | 'specific';

let topMode = $state<TopMode>('dictionary');
let removalMode = $state<RemovalMode>('random');

// Dictionary mode
let gibberishInput = $state('');
let gibberishSeed = $state('');
let gibberishChars = $state('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
let gibberishOutput = $state('');
let gibberishDictionary = $state('');

// Random removal
let removalInput = $state('');
let removalVariations = $state(10);
let removalMinLetters = $state(1);
let removalMaxLetters = $state(3);
let removalSeed = $state('');
let removalOutputs = $state<string[]>([]);

// Specific removal
let removalSpecificInput = $state('');
let removalCharsToRemove = $state('');
let removalSpecificOutput = $state('');

export const gibberishState = {
  get topMode() { return topMode; },
  set topMode(v: TopMode) { topMode = v; },

  get removalMode() { return removalMode; },
  set removalMode(v: RemovalMode) { removalMode = v; },

  get gibberishInput() { return gibberishInput; },
  set gibberishInput(v: string) { gibberishInput = v; },

  get gibberishSeed() { return gibberishSeed; },
  set gibberishSeed(v: string) { gibberishSeed = v; },

  get gibberishChars() { return gibberishChars; },
  set gibberishChars(v: string) { gibberishChars = v; },

  get gibberishOutput() { return gibberishOutput; },
  set gibberishOutput(v: string) { gibberishOutput = v; },

  get gibberishDictionary() { return gibberishDictionary; },
  set gibberishDictionary(v: string) { gibberishDictionary = v; },

  get removalInput() { return removalInput; },
  set removalInput(v: string) { removalInput = v; },

  get removalVariations() { return removalVariations; },
  set removalVariations(v: number) { removalVariations = v; },

  get removalMinLetters() { return removalMinLetters; },
  set removalMinLetters(v: number) { removalMinLetters = v; },

  get removalMaxLetters() { return removalMaxLetters; },
  set removalMaxLetters(v: number) { removalMaxLetters = v; },

  get removalSeed() { return removalSeed; },
  set removalSeed(v: string) { removalSeed = v; },

  get removalOutputs() { return removalOutputs; },
  set removalOutputs(v: string[]) { removalOutputs = v; },

  get removalSpecificInput() { return removalSpecificInput; },
  set removalSpecificInput(v: string) { removalSpecificInput = v; },

  get removalCharsToRemove() { return removalCharsToRemove; },
  set removalCharsToRemove(v: string) { removalCharsToRemove = v; },

  get removalSpecificOutput() { return removalSpecificOutput; },
  set removalSpecificOutput(v: string) { removalSpecificOutput = v; },

  reset() {
    topMode = 'dictionary';
    removalMode = 'random';
    gibberishInput = '';
    gibberishSeed = '';
    gibberishChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    gibberishOutput = '';
    gibberishDictionary = '';
    removalInput = '';
    removalVariations = 10;
    removalMinLetters = 1;
    removalMaxLetters = 3;
    removalSeed = '';
    removalOutputs = [];
    removalSpecificInput = '';
    removalCharsToRemove = '';
    removalSpecificOutput = '';
  }
};
