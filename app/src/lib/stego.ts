/**
 * Steganography engine — public surface lives in `./stego/`.
 *
 * This file is a thin re-export shim so existing imports
 * (`import { encodeEmoji } from '$lib/stego'`) keep compiling. Add new
 * exports to `./stego/index.ts`, not here.
 */
export * from './stego/index';
