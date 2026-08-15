import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { RatchetSessionStore } from '../src/messaging/sessionStore.ts';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { randomBytes } from '../src/crypto/utils.ts';

describe('VEIL Phase 4: Session Persistence & Lock Lifecycle Tests', () => {
  let vault: SpaceVaultManager;
  let store: EncryptedSpaceStore;
  let sessionStore: RatchetSessionStore;

  beforeEach(() => {
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore();
    sessionStore = new RatchetSessionStore(store);
  });

  it('should persist and reload Double Ratchet session state across Space lock/unlock', () => {
    const env = vault.createSpace({ name: 'Main', password: 'Pass', kdfParams: FAST_TEST_KDF_PARAMS });
    const session1 = vault.unlockSpace('Pass');

    const bobKp = generateKeyAgreementKeypair(randomBytes(32));
    const aliceRatchet = DoubleRatchetSession.initAlice(
      'sess-1',
      'bob-identity-123',
      'bob-sign-pub',
      'bob-ka-pub',
      randomBytes(32),
      bobKp.publicKey
    );

    // Alice sends a message to advance ratchet counters
    const msg1 = aliceRatchet.ratchetEncrypt('Persisted test message');

    // Save session in SpaceStore
    sessionStore.saveSession(session1, aliceRatchet);

    // Lock the space
    vault.lockSpace(env.spaceId);

    // Re-unlock Space
    const session2 = vault.unlockSpace('Pass');
    const restored = sessionStore.loadSession(session2, 'bob-identity-123');

    expect(restored).not.toBeNull();
    expect(restored!.sessionId).toBe('sess-1');
    expect(restored!.peerIdentityId).toBe('bob-identity-123');

    // Restored session can continue encrypting subsequent messages
    const msg2 = restored!.ratchetEncrypt('Subsequent message after restore');
    expect(msg2.header.sequenceNum).toBe(1); // sequence advanced from 0 to 1
  });
});
