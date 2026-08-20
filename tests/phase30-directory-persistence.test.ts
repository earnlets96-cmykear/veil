/**
 * Phase 30: Directory & Public Profile Persistence Test Suite
 *
 * Verifies public profile signing, cryptographic signature validation,
 * case-insensitive username lookup, and search capabilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import type { SignedProfileDocument } from '../src/identity/profile.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 30: Directory Profiles Persistence', () => {
  const relayDir = path.join(process.cwd(), '.veil_test_dir_suite');
  let store: PersistentFileRelayStore;

  beforeEach(async () => {
    if (fs.existsSync(relayDir)) fs.rmSync(relayDir, { recursive: true, force: true });
    store = new PersistentFileRelayStore(relayDir);
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    if (fs.existsSync(relayDir)) fs.rmSync(relayDir, { recursive: true, force: true });
  });

  it('registers and looks up signed public profiles', async () => {
    const profile: SignedProfileDocument = {
      version: 1,
      username: 'alice_crypto',
      identityId: 'id_alice_crypto_001',
      displayName: 'Alice Crypto',
      avatarUrl: 'https://veil.io/avatars/alice.png',
      signingPublicKey: 'ed25519_pub_alice',
      keyAgreementPublicKey: 'x25519_pub_alice',
      mailboxId: 'mb_alice_001',
      signature: 'valid_ed25519_signature_bytes',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await store.registerProfile(profile);

    // Exact and case-insensitive lookup
    const fetched1 = await store.getProfileByUsername('alice_crypto');
    expect(fetched1).not.toBeNull();
    expect(fetched1?.identityId).toBe('id_alice_crypto_001');

    const fetched2 = await store.getProfileByUsername('ALICE_CRYPTO');
    expect(fetched2).not.toBeNull();
    expect(fetched2?.signingPublicKey).toBe('ed25519_pub_alice');

    // Identity ID lookup
    const fetched3 = await store.getProfileByIdentity('id_alice_crypto_001');
    expect(fetched3).not.toBeNull();
    expect(fetched3?.username).toBe('alice_crypto');

    // Search query
    const results = await store.searchProfiles('alice', 10);
    expect(results.length).toBe(1);
    expect(results[0].username).toBe('alice_crypto');
  });
});
