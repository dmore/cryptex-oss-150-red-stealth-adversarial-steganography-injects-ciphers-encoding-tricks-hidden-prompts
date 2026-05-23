/**
 * Module-level state for the Emoji steganography tool. Survives tab switches,
 * resets on browser reload (no persistence — privacy-first default).
 *
 * Wave 1.1: extended to support three stego modes (variation-selectors,
 * tag-block, combining-marks) plus a separate forensics panel.
 */
import type { StegMode } from '$lib/stego';
import { SUGGESTED_CARRIERS } from '$lib/stego';

export type Direction = 'encode' | 'decode' | 'forensics';

const DEFAULT_CARRIER = SUGGESTED_CARRIERS[0].emoji;

let mode = $state<StegMode>('variation-selectors');
let direction = $state<Direction>('encode');
let plaintext = $state('Hi!');
let payload = $state('');
let decodedText = $state('');
let payloadToDecode = $state('');
let selectedCarrier = $state<string>(DEFAULT_CARRIER);
let customEmoji = $state('');
/** Forensics tab — separate from encode/decode flow. */
let forensicsInput = $state('');

export const emojiState = {
  get mode() { return mode; },
  set mode(v: StegMode) { mode = v; },

  get direction() { return direction; },
  set direction(v: Direction) { direction = v; },

  get plaintext() { return plaintext; },
  set plaintext(v: string) { plaintext = v; },

  get payload() { return payload; },
  set payload(v: string) { payload = v; },

  get decodedText() { return decodedText; },
  set decodedText(v: string) { decodedText = v; },

  get payloadToDecode() { return payloadToDecode; },
  set payloadToDecode(v: string) { payloadToDecode = v; },

  get selectedCarrier() { return selectedCarrier; },
  set selectedCarrier(v: string) { selectedCarrier = v; },

  get customEmoji() { return customEmoji; },
  set customEmoji(v: string) { customEmoji = v; },

  get forensicsInput() { return forensicsInput; },
  set forensicsInput(v: string) { forensicsInput = v; },

  /** Effective carrier — prefer the free-text override when present. */
  get effectiveCarrier(): string {
    const c = customEmoji.trim();
    return c || selectedCarrier;
  },

  reset() {
    mode = 'variation-selectors';
    direction = 'encode';
    plaintext = 'Hi!';
    payload = '';
    decodedText = '';
    payloadToDecode = '';
    selectedCarrier = DEFAULT_CARRIER;
    customEmoji = '';
    forensicsInput = '';
  }
};
