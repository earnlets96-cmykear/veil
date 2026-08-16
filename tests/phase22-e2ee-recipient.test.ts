import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { PrekeyManager } from '../src/ratchet/prekeys.ts';
import { ConversationManager } from '../src/messaging/conversationManager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 22: Recipient E2EE Session Binding Tests', () => {
  it('establishes bidirectional Double Ratchet messaging session from PrekeyBundle', async () => {
    // 1. Setup Alice
    const vaultA = new SpaceVaultManager();
    const envA = vaultA.createSpace({ name: 'Alice', password: 'PassA123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionA = vaultA.unlockSpace('PassA123!', envA.spaceId);
    const storeA = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrA = new SpaceIdentityManager();
    const docA = idMgrA.createIdentity(sessionA, storeA);
    const prekeysA = new PrekeyManager(storeA, idMgrA);
    prekeysA.generateSignedPrekey(sessionA);
    prekeysA.generateOneTimePrekeys(sessionA, 5);
    const bundleA = prekeysA.createPrekeyBundle(sessionA);
    const convA = new ConversationManager(storeA, idMgrA, prekeysA);

    // 2. Setup Bob
    const vaultB = new SpaceVaultManager();
    const envB = vaultB.createSpace({ name: 'Bob', password: 'PassB123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const sessionB = vaultB.unlockSpace('PassB123!', envB.spaceId);
    const storeB = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const idMgrB = new SpaceIdentityManager();
    const docB = idMgrB.createIdentity(sessionB, storeB);
    const prekeysB = new PrekeyManager(storeB, idMgrB);
    prekeysB.generateSignedPrekey(sessionB);
    prekeysB.generateOneTimePrekeys(sessionB, 5);
    const bundleB = prekeysB.createPrekeyBundle(sessionB);
    const convB = new ConversationManager(storeB, idMgrB, prekeysB);

    // 3. Alice -> Bob: Encrypt & Pack
    const msg1 = 'Hello Bob, this is Alice!';
    const { wirePayloadBase64: wire1 } = await convA.encryptAndPackWireMessage(sessionA, bundleB, msg1);

    // 4. Bob processes inbound wire payload
    const res1 = await convB.processInboundWirePayload(sessionB, wire1);
    expect(res1.storedMessage.text).toBe(msg1);
    expect(res1.storedMessage.senderIdentityId).toBe(docA.identityId);

    // 5. Bob replies -> Alice: Encrypt & Pack
    const msg2 = 'Hello Alice, Bob received your message!';
    const { wirePayloadBase64: wire2 } = await convB.encryptAndPackWireMessage(sessionB, bundleA, msg2);

    // 6. Alice processes inbound wire payload
    const res2 = await convA.processInboundWirePayload(sessionA, wire2);
    expect(res2.storedMessage.text).toBe(msg2);
    expect(res2.storedMessage.senderIdentityId).toBe(docB.identityId);

    // 7. Exchange 10 consecutive messages across established ratchet
    for (let i = 0; i < 10; i++) {
      const textA = `Alice count ${i}`;
      const { wirePayloadBase64: wireA } = await convA.encryptAndPackWireMessage(sessionA, bundleB, textA);
      const decB = await convB.processInboundWirePayload(sessionB, wireA);
      expect(decB.storedMessage.text).toBe(textA);

      const textB = `Bob reply ${i}`;
      const { wirePayloadBase64: wireB } = await convB.encryptAndPackWireMessage(sessionB, bundleA, textB);
      const decA = await convA.processInboundWirePayload(sessionA, wireB);
      expect(decA.storedMessage.text).toBe(textB);
    }
  });
});
