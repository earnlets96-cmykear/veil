import { describe, it, expect } from 'vitest';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';

describe('VEIL Phase 21: Cross-Platform Live Relay E2EE Tests', () => {
  it('E2EE RELAY CONVERSATION: Full asynchronous message exchange between Web persona and Android persona', async () => {
    const server = new RelayServer({ port: 8791 });
    await server.start();
    const netConfig = {
      httpUrl: 'http://127.0.0.1:8791',
      wsUrl: 'ws://127.0.0.1:8791/v1/ws',
    };

    try {
      // 1. Client A (Android)
      const vaultA = new SpaceVaultManager();
      const envA = vaultA.createSpace({ name: 'Android User', password: 'PassA123!', kdfParams: FAST_TEST_KDF_PARAMS });
      const sessionA = vaultA.unlockSpace('PassA123!', envA.spaceId);
      const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
      const netA = new NetworkManager(storeA, netConfig);
      const mbA = await netA.getOrCreateMailbox(sessionA);

      // 2. Client B (Desktop)
      const vaultB = new SpaceVaultManager();
      const envB = vaultB.createSpace({ name: 'Desktop User', password: 'PassB123!', kdfParams: FAST_TEST_KDF_PARAMS });
      const sessionB = vaultB.unlockSpace('PassB123!', envB.spaceId);
      const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
      const netB = new NetworkManager(storeB, netConfig);
      const mbB = await netB.getOrCreateMailbox(sessionB);

      // 3. E2EE Ratchet Initialization
      const sharedSecret = randomBytes(32);
      const bobRatchetKeypair = generateKeyAgreementKeypair(randomBytes(32));

      const alice = DoubleRatchetSession.initAlice(
        'sess-android',
        'web-id',
        'web-sign-pub',
        'web-ka-pub',
        sharedSecret,
        bobRatchetKeypair.publicKey
      );

      const bob = DoubleRatchetSession.initBob(
        'sess-web',
        'android-id',
        'android-sign-pub',
        'android-ka-pub',
        sharedSecret,
        bobRatchetKeypair
      );

      // Alice (Android) -> Bob (Desktop)
      const msg1 = 'Hello from Android Client!';
      const enc1 = alice.ratchetEncrypt(msg1);
      await netA.sendEnvelope(sessionA, mbB.mailboxId, JSON.stringify(enc1));

      // Bob syncs from relay & decrypts
      await netB.syncMailbox(sessionB, async (payload) => {
        const receivedEnc = JSON.parse(payload);
        const dec = bob.ratchetDecrypt(receivedEnc);
        expect(new TextDecoder().decode(dec)).toBe(msg1);
      });

      // Bob (Desktop) -> Alice (Android)
      const msg2 = 'Hello from Desktop Web Client!';
      const enc2 = bob.ratchetEncrypt(msg2);
      await netB.sendEnvelope(sessionB, mbA.mailboxId, JSON.stringify(enc2));

      // Alice syncs from relay & decrypts
      await netA.syncMailbox(sessionA, async (payload) => {
        const receivedEnc = JSON.parse(payload);
        const dec = alice.ratchetDecrypt(receivedEnc);
        expect(new TextDecoder().decode(dec)).toBe(msg2);
      });
    } finally {
      await server.stop();
    }
  });
});
