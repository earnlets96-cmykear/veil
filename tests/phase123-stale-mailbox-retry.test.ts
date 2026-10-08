import { describe, expect, it, vi } from 'vitest';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { NetworkManager } from '../src/network/networkManager.ts';

describe('Phase 123: stale recipient mailbox recovery', () => {
  it('re-resolves a stale mailbox and retries the same queued payload', async () => {
    const vault = new SpaceVaultManager();
    const header = vault.createSpace({ name: 'Test', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', header.spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const network = new NetworkManager(store);
    const sent: Array<{ mailboxId: string; payload: string }> = [];

    vi.spyOn(network.getHttp(), 'sendEnvelope').mockImplementation(async (mailboxId, payload) => {
      sent.push({ mailboxId, payload });
      if (mailboxId === 'expired-mailbox') {
        const error = new Error('Mailbox expired');
        error.name = 'MailboxRevokedError';
        throw error;
      }
      return { envelopeId: 'env-1', queued: true } as any;
    });
    network.setOutboundMailboxResolver(async (_activeSession, identityId) =>
      identityId === 'peer-identity' ? 'current-mailbox' : null
    );

    const payload = 'opaque-e2ee-payload';
    const result = await network.sendEnvelope(session, 'expired-mailbox', payload, undefined, {
      conversationId: 'peer-identity',
      messageId: 'message-1',
    });

    expect(result.status).toBe('SENT_TO_RELAY');
    expect(sent).toEqual([
      { mailboxId: 'expired-mailbox', payload },
      { mailboxId: 'current-mailbox', payload },
    ]);
    expect(await network.getQueue().listOutbound(session)).toEqual([]);
  });

  it('re-resolves persisted failed routes when the app reconnects', async () => {
    const vault = new SpaceVaultManager();
    const header = vault.createSpace({ name: 'Test', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', header.spaceId);
    const store = new EncryptedSpaceStore(new MemoryStorageAdapter());
    const network = new NetworkManager(store);
    const sent: string[] = [];
    vi.spyOn(network.getHttp(), 'sendEnvelope').mockImplementation(async (mailboxId) => {
      sent.push(mailboxId);
      if (mailboxId === 'expired-mailbox') {
        const error = new Error('Mailbox expired');
        error.name = 'MailboxRevokedError';
        throw error;
      }
      return { envelopeId: 'env-2', queued: true } as any;
    });
    await network.getQueue().enqueueOutbound(session, {
      queueId: 'queued-1',
      spaceId: session.spaceId,
      mailboxId: 'expired-mailbox',
      payload: 'persisted-e2ee-payload',
      status: 'QUEUED',
      createdAt: Date.now(),
      retryCount: 0,
      conversationId: 'peer-identity',
      messageId: 'message-2',
    });
    network.setOutboundMailboxResolver(async () => 'current-mailbox');

    expect(await network.flushOutboundQueue(session)).toBe(1);
    expect(sent).toEqual(['expired-mailbox', 'current-mailbox']);
    expect(await network.getQueue().listOutbound(session)).toEqual([]);
  });

  it('passes legacy queued control payloads to the resolver when route metadata is missing', async () => {
    const vault = new SpaceVaultManager();
    const header = vault.createSpace({ name: 'Test', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', header.spaceId);
    const network = new NetworkManager(new EncryptedSpaceStore(new MemoryStorageAdapter()));
    const sent: string[] = [];
    vi.spyOn(network.getHttp(), 'sendEnvelope').mockImplementation(async (mailboxId) => {
      sent.push(mailboxId);
      if (mailboxId === 'expired-mailbox') {
        const error = new Error('Mailbox expired');
        error.name = 'MailboxRevokedError';
        throw error;
      }
      return { envelopeId: 'env-3', queued: true } as any;
    });
    await network.getQueue().enqueueOutbound(session, {
      queueId: 'queued-legacy',
      spaceId: session.spaceId,
      mailboxId: 'expired-mailbox',
      payload: JSON.stringify({ type: 'CONTACT_RESPONSE', requestId: 'request-1' }),
      status: 'QUEUED',
      createdAt: Date.now(),
      retryCount: 0,
    });
    network.setOutboundMailboxResolver(async (_session, identityId, item) =>
      !identityId && JSON.parse(item.payload).requestId === 'request-1' ? 'current-mailbox' : null
    );

    expect(await network.flushOutboundQueue(session)).toBe(1);
    expect(sent).toEqual(['expired-mailbox', 'current-mailbox']);
  });

  it('keeps ciphertext queued if no verified replacement route is available', async () => {
    const vault = new SpaceVaultManager();
    const header = vault.createSpace({ name: 'Test', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', header.spaceId);
    const network = new NetworkManager(new EncryptedSpaceStore(new MemoryStorageAdapter()));
    vi.spyOn(network.getHttp(), 'sendEnvelope').mockRejectedValue(Object.assign(new Error('Mailbox expired'), {
      name: 'MailboxRevokedError',
    }));
    await network.getQueue().enqueueOutbound(session, {
      queueId: 'queued-retained',
      spaceId: session.spaceId,
      mailboxId: 'expired-mailbox',
      payload: 'encrypted-payload',
      status: 'QUEUED',
      createdAt: Date.now(),
      retryCount: 0,
      conversationId: 'peer-identity',
    });
    network.setOutboundMailboxResolver(async () => null);

    expect(await network.flushOutboundQueue(session)).toBe(0);
    const [pending] = await network.getQueue().listOutbound(session);
    expect(pending.mailboxId).toBe('expired-mailbox');
    expect(pending.payload).toBe('encrypted-payload');
    expect(pending.status).toBe('QUEUED');
  });
});
