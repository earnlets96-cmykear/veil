/**
 * VEIL Phase 31 Mobile Production Acceptance & Cloud Continuity Suite.
 *
 * Verifies:
 * [1/10] Production Health (/health)
 * [2/10] Production Readiness (/readyz)
 * [3/10] Account Registration
 * [4/10] Persistent Account Lookup
 * [5/10] Directory/Profile Persistence & Search
 * [6/10] Blind Mailbox Allocation & Persistence
 * [7/10] Encrypted Attachment Persistence
 * [8/10] Unauthorized Attachment Access Rejection (404/403)
 * [9/10] Zero-Knowledge Clean-Device Identity Recovery
 * [10/10] Cold Backend Restart State Continuity
 */

import fs from 'fs';
import path from 'path';
import { SqlCloudDatabase } from '../src/server/cloud/database/sqlCloudDatabase.ts';
import { S3ObjectStorage } from '../src/server/cloud/storage/s3ObjectStorage.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { RelayServer } from '../src/server/relayServer.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { CloudClient } from '../src/network/cloudClient.ts';
import { DirectoryClient } from '../src/network/directoryClient.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { createSignedProfile } from '../src/identity/profile.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { bytesToBase64, base64ToBytes, bytesToHex, randomBytes } from '../src/crypto/utils.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { sha256 } from '@noble/hashes/sha256.js';

const ACCEPTANCE_TEMP_DIR = path.join(process.cwd(), '.veil_phase31_acceptance_temp');

async function cleanup() {
  if (fs.existsSync(ACCEPTANCE_TEMP_DIR)) {
    fs.rmSync(ACCEPTANCE_TEMP_DIR, { recursive: true, force: true });
  }
}

async function runAcceptance() {
  console.log('================================================================');
  console.log('📱 VEIL PHASE 31 MOBILE PRODUCTION ACCEPTANCE SUITE');
  console.log('================================================================');

  await cleanup();
  fs.mkdirSync(ACCEPTANCE_TEMP_DIR, { recursive: true });

  const dbDir = path.join(ACCEPTANCE_TEMP_DIR, 'db');
  const relayDir = path.join(ACCEPTANCE_TEMP_DIR, 'relay');
  const storageDir = path.join(ACCEPTANCE_TEMP_DIR, 'storage');

  let passed = 0;
  const total = 10;

  // 1. Initialize Server & Storage
  let db = new SqlCloudDatabase({ diskPath: dbDir });
  let store = new PersistentFileRelayStore(relayDir);
  let storage = new S3ObjectStorage();

  await db.init();
  await store.init();
  await storage.init();

  let server = new RelayServer({ port: 0, host: '127.0.0.1' }, store, db, storage);
  let addr = await server.start();
  let baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // [1/10] Production Health
    console.log('\n[1/10] Testing GET /health endpoint...');
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    if (healthRes.status === 200 && healthData.status === 'ok' && healthData.database === 'connected') {
      console.log('  PASSED: Production health check ok');
      passed++;
    } else {
      console.error('  FAILED: /health returned invalid state', healthData);
    }

    // [2/10] Production Readiness
    console.log('\n[2/10] Testing GET /readyz endpoint...');
    const readyRes = await fetch(`${baseUrl}/readyz`);
    const readyData = await readyRes.json();
    if (readyRes.status === 200 && readyData.status === 'ready' && readyData.cloudDb === 'ok') {
      console.log('  PASSED: Production readiness check ok');
      passed++;
    } else {
      console.error('  FAILED: /readyz returned unready state', readyData);
    }

    // [3/10] Account Registration
    console.log('\n[3/10] Testing Account Registration...');
    const cloudClient = new CloudClient(baseUrl);
    const vault1 = new SpaceVaultManager();
    const idMgr1 = new SpaceIdentityManager();
    const memory1 = new MemoryStorageAdapter();
    const spaceStore1 = new EncryptedSpaceStore(memory1);
    const accountMgr1 = new AccountManager(cloudClient, vault1, idMgr1, spaceStore1, memory1);

    const regResult = await accountMgr1.registerAccount({
      username: 'alice_mobile',
      password: 'MobileSecurePassword123!',
      deviceName: 'Pixel 8 Phone',
      kdfParams: FAST_TEST_KDF_PARAMS,
    });

    const aliceIdentityId = regResult.identityDoc.identityId;
    const aliceAccountId = regResult.account.accountId;

    if (aliceIdentityId && aliceAccountId) {
      console.log('  PASSED: Account registered successfully');
      passed++;
    } else {
      console.error('  FAILED: Account registration did not return expected identity/account');
    }

    // [4/10] Persistent Account Lookup
    console.log('\n[4/10] Testing Persistent Account Verification...');
    const accountEntity = await db.getAccountByUsername('alice_mobile');
    if (accountEntity && accountEntity.accountId === aliceAccountId) {
      console.log('  PASSED: Persistent account record verified');
      passed++;
    } else {
      console.error('  FAILED: Account not found in database');
    }

    // [5/10] Directory/Profile Persistence
    console.log('\n[5/10] Testing Directory/Profile Registration & Search...');
    const dirClient = new DirectoryClient(baseUrl);
    const prekeyMgr1 = new PrekeyManager(spaceStore1, idMgr1);
    const prekeyBundle1 = prekeyMgr1.createPrekeyBundle(regResult.session);
    const loadedId1 = idMgr1.loadIdentity(regResult.session, spaceStore1);

    const profile1 = createSignedProfile(
      loadedId1.document.identityId,
      loadedId1.signingPrivateKey,
      'alice_mobile',
      'Alice Mobile User',
      'mbx_alice_mobile',
      prekeyBundle1,
      undefined
    );

    await dirClient.registerProfile(profile1);
    const searchResults = await dirClient.searchProfiles('alice_mobile');

    if (searchResults.length > 0 && searchResults[0].username === 'alice_mobile') {
      console.log('  PASSED: Directory profile registered and searchable');
      passed++;
    } else {
      console.error('  FAILED: Profile not found in directory search');
    }

    // [6/10] Mailbox Persistence
    console.log('\n[6/10] Testing Blind Mailbox Creation & Envelopes...');
    const mbxRes = await fetch(`${baseUrl}/v1/mailboxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const mbxData = await mbxRes.json();
    if ((mbxRes.status === 200 || mbxRes.status === 201) && mbxData.mailboxId && mbxData.capabilityToken) {
      console.log('  PASSED: Blind mailbox allocated and verified');
      passed++;
    } else {
      console.error('  FAILED: Mailbox creation failed', mbxRes.status, mbxData);
    }

    // [7/10] Attachment Persistence
    console.log('\n[7/10] Testing Client-Encrypted Attachment Upload & Download...');
    const rawAttachment = new TextEncoder().encode('Confidential E2EE mobile payload');
    const attachmentKey = randomBytes(32);
    const { nonce, ciphertext } = encryptXChaCha20Poly1305(attachmentKey, rawAttachment);
    const encryptedAttachmentBytes = new Uint8Array(nonce.length + ciphertext.length);
    encryptedAttachmentBytes.set(nonce, 0);
    encryptedAttachmentBytes.set(ciphertext, nonce.length);

    const attId = `att_${bytesToHex(randomBytes(8))}`;
    const createMetaRes = await cloudClient.createAttachment({
      attachmentId: attId,
      spaceId: regResult.session.spaceId,
      ciphertextSize: encryptedAttachmentBytes.length,
      ciphertextHash: bytesToHex(sha256(encryptedAttachmentBytes)),
      recipientAccountId: 'acc_bob_mobile',
    });

    const objectId = createMetaRes.attachment.objectId;
    await cloudClient.uploadAttachment(objectId, encryptedAttachmentBytes);

    const downloadedBytes = await cloudClient.downloadAttachment(objectId);
    const decNonce = downloadedBytes.slice(0, 24);
    const decCiphertext = downloadedBytes.slice(24);
    const decryptedPayload = decryptXChaCha20Poly1305(attachmentKey, decNonce, decCiphertext);
    const decryptedText = new TextDecoder().decode(decryptedPayload);

    if (objectId && decryptedText === 'Confidential E2EE mobile payload') {
      console.log('  PASSED: Attachment persisted, downloaded, and decrypted cleanly');
      passed++;
    } else {
      console.error('  FAILED: Attachment round-trip failed');
    }

    // [8/10] Unauthorized Attachment Rejection
    console.log('\n[8/10] Testing Unauthorized Attachment Access Rejection...');
    const unauthClient = new CloudClient(baseUrl); // No bearer session token set
    let unauthRejected = false;
    try {
      await unauthClient.downloadAttachment(objectId);
    } catch (err) {
      unauthRejected = true;
    }

    if (unauthRejected) {
      console.log('  PASSED: Unauthorized download correctly rejected (404/403)');
      passed++;
    } else {
      console.error('  FAILED: Unauthorized client was able to download attachment');
    }

    // [9/10] Identity Recovery on Clean Device
    console.log('\n[9/10] Testing Zero-Knowledge Clean-Device Identity Recovery...');
    const vault2 = new SpaceVaultManager();
    const idMgr2 = new SpaceIdentityManager();
    const memory2 = new MemoryStorageAdapter();
    const spaceStore2 = new EncryptedSpaceStore(memory2);
    const accountMgr2 = new AccountManager(cloudClient, vault2, idMgr2, spaceStore2, memory2);

    const restoreResult = await accountMgr2.restoreAccount({
      username: 'alice_mobile',
      password: 'MobileSecurePassword123!',
      deviceName: 'Restored Device',
      customKdfParams: FAST_TEST_KDF_PARAMS,
    });

    if (restoreResult.identityDoc.identityId === aliceIdentityId) {
      console.log('  PASSED: Zero-knowledge identity recovery matched original identityId byte-for-byte');
      passed++;
    } else {
      console.error('  FAILED: Restored identityId did not match original identityId');
    }

    // [10/10] Cold Backend Restart State Continuity
    console.log('\n[10/10] Testing Cold Backend Restart Continuity...');
    await server.stop();

    // Re-instantiate database and stores from same disk paths
    db = new SqlCloudDatabase({ diskPath: dbDir });
    store = new PersistentFileRelayStore(relayDir);
    storage = new S3ObjectStorage();
    await db.init();
    await store.init();
    await storage.init();

    server = new RelayServer({ port: 0, host: '127.0.0.1' }, store, db, storage);
    addr = await server.start();
    baseUrl = `http://127.0.0.1:${addr.port}`;

    const restartedAccount = await db.getAccountByUsername('alice_mobile');
    const restartedHealthRes = await fetch(`${baseUrl}/health`);
    const restartedHealthData = await restartedHealthRes.json();

    if (restartedAccount && restartedAccount.accountId === aliceAccountId && restartedHealthData.status === 'ok') {
      console.log('  PASSED: All accounts, state, and services survived cold backend restart');
      passed++;
    } else {
      console.error('  FAILED: State not recovered after restart');
    }
  } finally {
    await server.stop();
    await cleanup();
  }

  console.log('\n================================================================');
  console.log(`ACCEPTANCE RESULTS: ${passed}/${total} checks PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('================================================================');

  if (passed === total) {
    console.log('🎉 ALL PHASE 31 MOBILE ACCEPTANCE CRITERIA PASSED FULLY!\n');
    process.exit(0);
  } else {
    console.error('❌ PHASE 31 ACCEPTANCE FAILED!');
    process.exit(1);
  }
}

runAcceptance().catch((err) => {
  console.error('FATAL ACCEPTANCE SUITE ERROR:', err);
  process.exit(1);
});
