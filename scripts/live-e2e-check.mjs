/**
 * VEIL Live 2-Client E2EE Diagnostic Tool.
 *
 * Simulates real end-to-end messaging between Client A (Android persona) and
 * Client B (Desktop persona) over target relay.
 */

import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { DoubleRatchetSession } from '../src/ratchet/ratchet.ts';
import { randomBytes } from '../src/crypto/utils.ts';
import { generateKeyAgreementKeypair } from '../src/identity/keyAgreement.ts';

async function runLiveE2ECheck() {
  console.log('🚀 Running VEIL Live 2-Client E2EE Check...');

  // Start internal relay on port 8789
  const server = new RelayServer({ port: 8789 });
  await server.start();
  const netConfig = {
    httpUrl: 'http://127.0.0.1:8789',
    wsUrl: 'ws://127.0.0.1:8789/v1/ws',
  };

  try {
    // 1. Client A (Android)
    const vaultA = new SpaceVaultManager();
    const envA = vaultA.createSpace({ name: 'Android Personal', password: 'PassA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionA = vaultA.unlockSpace('PassA123!', envA.spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const netA = new NetworkManager(storeA, netConfig);
    const mbA = await netA.getOrCreateMailbox(sessionA);

    // 2. Client B (Desktop)
    const vaultB = new SpaceVaultManager();
    const envB = vaultB.createSpace({ name: 'Desktop Personal', password: 'PassB123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionB = vaultB.unlockSpace('PassB123!', envB.spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const netB = new NetworkManager(storeB, netConfig);
    const mbB = await netB.getOrCreateMailbox(sessionB);

    // 3. E2EE Ratchet setup
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

    // Alice -> Bob: "Hello from Android."
    const msg = 'Hello from Android.';
    const enc = alice.ratchetEncrypt(msg);

    // Transmit over relay to Bob's mailbox
    await netA.sendEnvelope(sessionA, mbB.mailboxId, JSON.stringify(enc));

    // Bob syncs from relay
    const fetched = await netB.syncMailbox(sessionB, mbB.mailboxId, mbB.capabilityToken);
    if (fetched.length !== 1) throw new Error('Bob did not receive envelope');

    // Bob decrypts
    const receivedEnc = JSON.parse(fetched[0].payload);
    const decryptedBytes = bob.ratchetDecrypt(receivedEnc);
    const decryptedText = new TextDecoder().decode(decryptedBytes);
    if (decryptedText !== msg) throw new Error('Decrypted text mismatch');

    console.log(`✅ Live E2EE Verified: "${decryptedText}" successfully delivered across platforms!`);
  } finally {
    await server.stop();
  }
}

runLiveE2ECheck().catch((err) => {
  console.error('❌ Live E2E Check Failed:', err);
  process.exit(1);
});
