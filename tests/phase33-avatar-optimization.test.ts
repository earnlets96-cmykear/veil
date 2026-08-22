/**
 * Phase 33 Step 2: Client-Side Avatar Downsampling & Directory Optimization Test Suite
 *
 * Verifies:
 * - calculateTargetDimensions preserves aspect ratio without upscaling
 * - Maximum dimensions never exceed 128x128 pixels
 * - Input validation rejects non-image files and oversized (>10MB) payloads
 * - Downsampled thumbnail produces valid Ed25519 signatures in SignedProfileDocument
 * - Storage & search layers preserve optimized thumbnail correctly
 * - Zero private key leakage
 */

import { describe, it, expect } from 'vitest';
import {
  calculateTargetDimensions,
  validateAvatarInput,
  processAvatarImage,
  MAX_AVATAR_DIMENSION,
  TARGET_MAX_AVATAR_BYTES,
  MAX_INPUT_AVATAR_BYTES,
} from '../src/ui/utils/avatarProcessor.ts';
import { createSignedProfile, verifySignedProfile } from '../src/identity/profile.ts';
import { generateSigningKeypair } from '../src/identity/signing.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { createIdentityDocument } from '../src/identity/document.ts';
import { randomBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import type { PrekeyBundle } from '../src/ratchet/types.ts';

describe('Phase 33 Step 2: Avatar Downsampling & Directory Optimization', () => {
  const signingKeypair = generateSigningKeypair(randomBytes(32));
  const kaKeypair = generateKeyAgreementKeypair(randomBytes(32));
  const idDoc = createIdentityDocument(
    signingKeypair.privateKey,
    signingKeypair.publicKey,
    kaKeypair.publicKey,
    Date.now()
  );

  const prekeyBundle: PrekeyBundle = {
    identityDocument: idDoc,
    signedPrekey: {
      id: 1,
      publicKey: bytesToBase64(randomBytes(32)),
      signature: bytesToBase64(randomBytes(64)),
      createdAt: Date.now(),
    },
  };

  describe('Dimension Calculations & Aspect Ratio Preservation', () => {
    it('downsamples landscape images so width is 128 and aspect ratio is preserved', () => {
      const { width, height } = calculateTargetDimensions(1920, 1080, MAX_AVATAR_DIMENSION);
      expect(width).toBe(128);
      expect(height).toBe(72); // 1080 / 1920 * 128 = 72
    });

    it('downsamples portrait images so height is 128 and aspect ratio is preserved', () => {
      const { width, height } = calculateTargetDimensions(1080, 1920, MAX_AVATAR_DIMENSION);
      expect(height).toBe(128);
      expect(width).toBe(72); // 1080 / 1920 * 128 = 72
    });

    it('downsamples square images to exactly 128x128', () => {
      const { width, height } = calculateTargetDimensions(1024, 1024, MAX_AVATAR_DIMENSION);
      expect(width).toBe(128);
      expect(height).toBe(128);
    });

    it('never upscales images smaller than 128x128', () => {
      const { width, height } = calculateTargetDimensions(64, 48, MAX_AVATAR_DIMENSION);
      expect(width).toBe(64);
      expect(height).toBe(48);
    });

    it('throws on invalid non-positive dimensions', () => {
      expect(() => calculateTargetDimensions(0, 100)).toThrow('Invalid image dimensions');
      expect(() => calculateTargetDimensions(-50, 100)).toThrow('Invalid image dimensions');
    });
  });

  describe('Avatar Input Validation', () => {
    it('accepts valid image file types', () => {
      const validPng = new Blob(['fake_png_data'], { type: 'image/png' });
      expect(() => validateAvatarInput(validPng as File)).not.toThrow();

      const validJpeg = new Blob(['fake_jpeg_data'], { type: 'image/jpeg' });
      expect(() => validateAvatarInput(validJpeg as File)).not.toThrow();

      const validWebp = new Blob(['fake_webp_data'], { type: 'image/webp' });
      expect(() => validateAvatarInput(validWebp as File)).not.toThrow();
    });

    it('rejects non-image files', () => {
      const textFile = new Blob(['hello world'], { type: 'text/plain' });
      expect(() => validateAvatarInput(textFile as File)).toThrow('Selected file is not an image');

      const exeFile = new Blob(['MZ...'], { type: 'application/octet-stream' });
      expect(() => validateAvatarInput(exeFile as File)).toThrow('Selected file is not an image');
    });

    it('rejects files exceeding 10MB input limit', () => {
      const oversizedBlob = {
        size: MAX_INPUT_AVATAR_BYTES + 1024,
        type: 'image/jpeg',
      } as any;
      expect(() => validateAvatarInput(oversizedBlob)).toThrow('Image file is too large');
    });
  });

  describe('Data URI Processing & Fallback Handling', () => {
    it('rejects invalid non-data-uri strings', async () => {
      await expect(processAvatarImage('invalid_url_string')).rejects.toThrow('Invalid image string format');
    });

    it('handles valid data uri string gracefully', async () => {
      const sampleDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const result = await processAvatarImage(sampleDataUri);
      expect(result).toBeDefined();
      expect(result.startsWith('data:image/')).toBe(true);
    });
  });

  describe('Profile Signing with Optimized Avatar', () => {
    it('creates and verifies SignedProfileDocument with downsampled avatar thumbnail', () => {
      const sampleThumbnail = 'data:image/jpeg;base64,' + bytesToBase64(randomBytes(512));
      const profile = createSignedProfile(
        idDoc.identityId,
        signingKeypair.privateKey,
        'optimized_user',
        'Optimized User',
        'mb_opt_01',
        prekeyBundle,
        sampleThumbnail
      );

      expect(profile.avatar).toBe(sampleThumbnail);
      expect(profile.avatarUrl).toBe(sampleThumbnail);
      expect(verifySignedProfile(profile)).toBe(true);
    });

    it('persists and retrieves profile with avatar in MemoryRelayStore', async () => {
      const store = new MemoryRelayStore();
      await store.init();

      const sampleThumbnail = 'data:image/jpeg;base64,' + bytesToBase64(randomBytes(512));
      const profile = createSignedProfile(
        idDoc.identityId,
        signingKeypair.privateKey,
        'store_user',
        'Store User',
        'mb_store_01',
        prekeyBundle,
        sampleThumbnail
      );

      await store.registerProfile(profile);

      const fetched = await store.getProfileByUsername('store_user');
      expect(fetched).not.toBeNull();
      expect(fetched?.avatar).toBe(sampleThumbnail);

      const results = await store.searchProfiles('store');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].avatar).toBe(sampleThumbnail);
    });

    it('ensures no private keys leak into avatar or profile serialization', () => {
      const sampleThumbnail = 'data:image/jpeg;base64,' + bytesToBase64(randomBytes(512));
      const profile = createSignedProfile(
        idDoc.identityId,
        signingKeypair.privateKey,
        'safe_avatar_user',
        'Safe Avatar User',
        'mb_safe_01',
        prekeyBundle,
        sampleThumbnail
      );

      const json = JSON.stringify(profile);
      expect(json).not.toContain(bytesToBase64(signingKeypair.privateKey));
      expect(json).not.toContain(bytesToBase64(kaKeypair.privateKey));
      expect(json).toContain(sampleThumbnail);
    });
  });
});
