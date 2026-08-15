/**
 * BIP-39 Mnemonic Encoder / Decoder & Checksum Verification for VEIL.
 *
 * Provides standard 24-word zero-knowledge Space recovery phrase support.
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { BIP39_WORDLIST } from './wordlist.ts';

export class BIP39 {
  /**
   * Converts 32 bytes (256 bits) of entropy into a 24-word BIP-39 mnemonic phrase.
   */
  public static entropyToMnemonic(entropy: Uint8Array): string {
    if (entropy.length !== 32) {
      throw new Error(`Invalid entropy length: expected 32 bytes (256 bits), got ${entropy.length}`);
    }

    // 1. Calculate 8-bit checksum: SHA-256(entropy)[0]
    const hash = sha256(entropy);
    const checksumByte = hash[0];

    // 2. Build 264-bit array (256 bits entropy + 8 bits checksum)
    const bits: number[] = [];
    for (let i = 0; i < entropy.length; i++) {
      for (let b = 7; b >= 0; b--) {
        bits.push((entropy[i] >> b) & 1);
      }
    }
    for (let b = 7; b >= 0; b--) {
      bits.push((checksumByte >> b) & 1);
    }

    // 3. Slice into 24 groups of 11 bits each
    const words: string[] = [];
    for (let i = 0; i < 24; i++) {
      let index = 0;
      for (let j = 0; j < 11; j++) {
        index = (index << 1) | bits[i * 11 + j];
      }
      words.push(BIP39_WORDLIST[index]);
    }

    return words.join(' ');
  }

  /**
   * Converts a 24-word BIP-39 mnemonic phrase back into 32 bytes of entropy.
   */
  public static mnemonicToEntropy(mnemonic: string): Uint8Array {
    const words = mnemonic.trim().toLowerCase().split(/\s+/);
    if (words.length !== 24) {
      throw new Error(`Invalid mnemonic word count: expected 24 words, got ${words.length}`);
    }

    // 1. Convert words to 11-bit integers
    const bits: number[] = [];
    for (let i = 0; i < words.length; i++) {
      const index = BIP39_WORDLIST.indexOf(words[i]);
      if (index === -1) {
        throw new Error(`Invalid BIP-39 word at position ${i + 1}: "${words[i]}"`);
      }
      for (let b = 10; b >= 0; b--) {
        bits.push((index >> b) & 1);
      }
    }

    // 2. Extract 256 bits entropy + 8 bits checksum
    const entropyBits = bits.slice(0, 256);
    const checksumBits = bits.slice(256, 264);

    const entropy = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      let byte = 0;
      for (let b = 0; b < 8; b++) {
        byte = (byte << 1) | entropyBits[i * 8 + b];
      }
      entropy[i] = byte;
    }

    let checksumByte = 0;
    for (let b = 0; b < 8; b++) {
      checksumByte = (checksumByte << 1) | checksumBits[b];
    }

    // 3. Verify checksum
    const hash = sha256(entropy);
    if (hash[0] !== checksumByte) {
      throw new Error('BIP-39 mnemonic checksum verification failed: phrase is corrupted');
    }

    return entropy;
  }

  /**
   * Validates a mnemonic string.
   */
  public static validateMnemonic(mnemonic: string): boolean {
    try {
      this.mnemonicToEntropy(mnemonic);
      return true;
    } catch (_e) {
      return false;
    }
  }
}
