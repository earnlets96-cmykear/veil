import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 14: UI Privacy & Security Invariant Tests', () => {
  let vault: SpaceVaultManager;
  let adapter: MemoryStorageAdapter;
  let store: EncryptedSpaceStore;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.init();
    vault = new SpaceVaultManager();
    store = new EncryptedSpaceStore(adapter);
  });

  it('GENERIC CREDENTIAL REJECTION: Wrong password does not disclose whether a Space exists', () => {
    const env = vault.createSpace({ name: 'Secret Vault', password: 'CorrectPass123!', kdfParams: FAST_TEST_KDF_PARAMS });

    expect(() => {
      vault.unlockSpace('WrongPass999!');
    }).toThrow(/invalid credentials or corrupted envelope/i);
  });


  it('NO PLAINTEXT STORAGE: UI messages stored in adapter are fully encrypted', async () => {
    const env = vault.createSpace({ name: 'Main', password: 'Pass123!Secure', kdfParams: FAST_TEST_KDF_PARAMS });
    await vault.saveEnvelopeToStorage(env, adapter);

    const session = vault.unlockSpace('Pass123!Secure', env.spaceId);

    const secretText = 'TOP_SECRET_UI_MESSAGE_12345';
    const msg = {
      id: 'm1',
      conversationId: 'bob',
      senderId: session.spaceId,
      text: secretText,
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'SENT_TO_RELAY' as const,
    };

    await store.setAsync(session, 'veil:ui:messages', { bob: [msg] });

    // Inspect raw stored records in memory adapter
    const allRecords = await adapter.listRecords(session.spaceId);
    expect(allRecords).toHaveLength(1);

    // Stored record ciphertext must NOT contain plaintext secretText
    expect(allRecords[0].ciphertext).not.toContain(secretText);
  });
});
