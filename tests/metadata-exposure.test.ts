import { describe, it, expect } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { TransportClient } from '../src/transport/client.ts';
import { MockTransportServer } from '../src/transport/server.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { generateMailboxCapability } from '../src/transport/capability.ts';
import { createTransportEnvelope } from '../src/transport/envelope.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';

describe('VEIL Phase 3: Adversarial Metadata Exposure & Server Audit Tests', () => {
  it('SERVER DATABASE AUDIT: server storage contains ZERO passwords, SMKs, private keys, or plaintexts', async () => {
    const vault = new SpaceVaultManager();
    const store = new EncryptedSpaceStore();
    const idMgr = new SpaceIdentityManager();
    const server = new MockTransportServer();
    const client = new TransportClient({ adapter: server, store });

    const passwordA = 'VerySecretPasswordA_123!';
    const passwordB = 'VerySecretPasswordB_456!';

    vault.createSpace({ name: 'Main', password: passwordA, kdfParams: FAST_TEST_KDF_PARAMS });
    vault.createSpace({ name: 'Private', password: passwordB, kdfParams: FAST_TEST_KDF_PARAMS });

    const sessionA = vault.unlockSpace(passwordA);
    const sessionB = vault.unlockSpace(passwordB);

    const docA = idMgr.createIdentity(sessionA, store);
    const docB = idMgr.createIdentity(sessionB, store);

    const capA = generateMailboxCapability();
    const capB = generateMailboxCapability();

    await client.registerMailbox(sessionA, capA);
    await client.registerMailbox(sessionB, capB);

    const plaintextMsg = 'This is confidential plaintext between Alice and Bob';
    const env = createTransportEnvelope({
      mailboxId: capB.mailboxId,
      payload: Buffer.from('ENCRYPTED_OPAQUE_CIPHERTEXT').toString('base64'),
      sizeClass: 'SMALL',
    });

    await client.sendEnvelope(sessionA, env, capB.mailboxId);

    // DUMP SERVER DATABASE
    const dump = server.inspectDatabase();
    const dumpStr = JSON.stringify(dump);

    // 1. MUST NOT CONTAIN PASSWORDS
    expect(dumpStr).not.toContain(passwordA);
    expect(dumpStr).not.toContain(passwordB);

    // 2. MUST NOT CONTAIN SPACE NAMES
    expect(dumpStr).not.toContain('Main');
    expect(dumpStr).not.toContain('Private');

    // 3. MUST NOT CONTAIN PLAINTEXT MESSAGE
    expect(dumpStr).not.toContain(plaintextMsg);

    // 4. MUST NOT CONTAIN CAPABILITY SECRETS (Server stores only verifiers)
    expect(dumpStr).not.toContain(capA.capability);
    expect(dumpStr).not.toContain(capB.capability);

    // 5. MUST NOT CONTAIN IDENTITY IDs OR SIGNING KEYS
    expect(dumpStr).not.toContain(docA.identityId);
    expect(dumpStr).not.toContain(docB.identityId);
    expect(dumpStr).not.toContain(docA.signingPublicKey);
    expect(dumpStr).not.toContain(docB.signingPublicKey);
  });
});
