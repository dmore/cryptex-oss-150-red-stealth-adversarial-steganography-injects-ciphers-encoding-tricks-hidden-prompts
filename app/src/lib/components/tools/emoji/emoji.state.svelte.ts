/**
 * Module-level state for the Emoji steganography tool. Survives tab switches,
 * resets on browser reload (no persistence — privacy-first default).
 */
import { carriers, type Carrier } from '$lib/stego';

export type Mode = 'emoji' | 'invisible';
export type Direction = 'encode' | 'decode';

let mode = $state<Mode>('emoji');
let direction = $state<Direction>('encode');
let plaintext = $state('Hi!');
let payload = $state('');
let decodedText = $state('');
let payloadToDecode = $state('');
let selectedCarrier = $state<Carrier>(carriers[0]);
let customEmoji = $state('');

export const emojiState = {
  get mode() { return mode; },
  set mode(v: Mode) { mode = v; },

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
  set selectedCarrier(v: Carrier) { selectedCarrier = v; },

  get customEmoji() { return customEmoji; },
  set customEmoji(v: string) { customEmoji = v; },

  reset() {
    mode = 'emoji';
    direction = 'encode';
    plaintext = 'Hi!';
    payload = '';
    decodedText = '';
    payloadToDecode = '';
    selectedCarrier = carriers[0];
    customEmoji = '';
  }
};
