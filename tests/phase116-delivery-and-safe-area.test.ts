import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { MemoryStorageAdapter } from '../src/storage/memoryAdapter.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { applyPlatformViewportInsets } from '../src/ui/mobileViewportInsets.ts';
import { parseLegacyInboundPayload } from '../src/network/legacyInboundPayload.ts';

describe('Phase 116 delivery recovery and Android insets', () => {
  it('keeps failed inbound messages on the relay and retries the persisted envelope', async () => {
    const vault = new SpaceVaultManager();
    const envelope = vault.createSpace({ name: 'Recipient', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', envelope.spaceId);
    const network = new NetworkManager(new EncryptedSpaceStore(new MemoryStorageAdapter()));
    const binding = {
      spaceId: session.spaceId,
      mailboxId: 'mailbox-recipient',
      capabilityToken: 'capability-token',
      expiresAt: Date.now() + 60_000,
      lastSyncAt: Date.now(),
    };
    vi.spyOn(network as any, 'getMailboxBinding').mockResolvedValue(binding);
    const incoming = {
      protocolVersion: 'v1' as const,
      envelopeId: 'env-retry-001',
      mailboxId: binding.mailboxId,
      payload: 'opaque-ciphertext',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      sizeBytes: 17,
    };
    vi.spyOn(network.getHttp(), 'fetchEnvelopes').mockResolvedValue({
      protocolVersion: 'v1',
      envelopes: [incoming],
      count: 1,
    } as any);
    const ack = vi.spyOn(network.getHttp(), 'ackEnvelopes').mockResolvedValue({ acknowledged: 1 } as any);

    await network.syncMailbox(session, async () => {
      throw new Error('temporary local persistence failure');
    });
    expect(ack).not.toHaveBeenCalled();

    const receive = vi.fn(async () => {});
    const processed = await network.syncMailbox(session, receive);

    expect(receive).toHaveBeenCalledWith('opaque-ciphertext');
    expect(processed).toBe(1);
    expect(ack).toHaveBeenCalledWith(binding.mailboxId, binding.capabilityToken, ['env-retry-001']);
    expect(await network.getQueue().listPendingInbound(session)).toHaveLength(0);
    session.destroy();
  });

  it('does not acknowledge an unprocessed WebSocket duplicate', async () => {
    const vault = new SpaceVaultManager();
    const envelope = vault.createSpace({ name: 'Recipient', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', envelope.spaceId);
    const network = new NetworkManager(new EncryptedSpaceStore(new MemoryStorageAdapter()));
    const binding = {
      spaceId: session.spaceId,
      mailboxId: 'mailbox-recipient',
      capabilityToken: 'capability-token',
      expiresAt: Date.now() + 60_000,
      lastSyncAt: Date.now(),
    };
    const incoming = {
      protocolVersion: 'v1' as const,
      envelopeId: 'env-ws-pending-001',
      mailboxId: binding.mailboxId,
      payload: 'opaque-ciphertext',
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
      sizeBytes: 17,
    };
    await network.getQueue().enqueueInbound(session, {
      queueId: 'existing-pending',
      spaceId: session.spaceId,
      mailboxId: binding.mailboxId,
      envelopeId: incoming.envelopeId,
      payload: incoming.payload,
      status: 'QUEUED',
      receivedAt: Date.now(),
    });
    const sendAck = vi.fn(() => true);

    await (network as any).processInboundEnvelope(session, incoming, { sendAck });

    expect(sendAck).not.toHaveBeenCalled();
    session.destroy();
  });

  it('processes one persisted envelope only once during overlapping mailbox syncs', async () => {
    const vault = new SpaceVaultManager();
    const envelope = vault.createSpace({ name: 'Recipient', password: 'Pass123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('Pass123!', envelope.spaceId);
    const network = new NetworkManager(new EncryptedSpaceStore(new MemoryStorageAdapter()));
    const binding = {
      spaceId: session.spaceId,
      mailboxId: 'mailbox-recipient',
      capabilityToken: 'capability-token',
      expiresAt: Date.now() + 60_000,
      lastSyncAt: Date.now(),
    };
    vi.spyOn(network as any, 'getMailboxBinding').mockResolvedValue(binding);
    vi.spyOn(network.getHttp(), 'fetchEnvelopes').mockResolvedValue({
      protocolVersion: 'v1',
      envelopes: [{
        protocolVersion: 'v1',
        envelopeId: 'env-overlap-001',
        mailboxId: binding.mailboxId,
        payload: 'opaque-ciphertext',
        createdAt: Date.now(),
        expiresAt: Date.now() + 60_000,
        sizeBytes: 17,
      }],
      count: 1,
    } as any);
    const ack = vi.spyOn(network.getHttp(), 'ackEnvelopes').mockResolvedValue({ acknowledged: 1 } as any);
    const receive = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    await Promise.all([
      network.syncMailbox(session, receive),
      network.syncMailbox(session, receive),
    ]);

    expect(receive).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);
    session.destroy();
  });

  it('does not classify undecryptable ciphertext as a successfully handled legacy message', () => {
    expect(parseLegacyInboundPayload('not-json-ciphertext')).toBeNull();
    expect(parseLegacyInboundPayload('{"conversationId":"peer","text":"hello"}')).toMatchObject({
      conversationId: 'peer',
      text: 'hello',
    });
  });

  it('reserves Android status-bar space when the WebView reports no safe-area inset', () => {
    const classes = new Set<string>();
    applyPlatformViewportInsets('android', { classList: { add: (name: string) => classes.add(name) } } as any);
    expect(classes.has('veil-android-native')).toBe(true);

    const css = readFileSync(resolve(process.cwd(), 'src/styles/veil-design-system.css'), 'utf8');
    expect(css).toMatch(/\.veil-android-native\s*\{[^}]*--veil-safe-top:\s*max\(env\(safe-area-inset-top,\s*0px\),\s*24px\)/s);
  });
});
