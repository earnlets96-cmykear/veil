import { describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { Readable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MemoryRelayStore } from '../src/server/storage/memoryRelayStore.ts';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import { NetworkManager } from '../src/network/networkManager.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { buildGenericFcmMessage, FirebasePushSender } from '../src/server/push/firebasePushSender.ts';
import { createFirebaseAccessTokenProvider } from '../src/server/push/firebasePushSender.ts';
import { RelayServer } from '../src/server/relayServer.ts';

async function sendRelayRequest(
  relay: RelayServer,
  method: string,
  url: string,
  body: unknown
): Promise<{ statusCode: number; body: any }> {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]) as any;
  request.method = method;
  request.url = url;
  request.headers = {};
  request.socket = { remoteAddress: '127.0.0.10' };
  const response: any = {
    statusCode: 200,
    headers: {},
    setHeader(key: string, value: string) { this.headers[key] = value; },
    end(payload = '') { this.body = payload; },
  };
  await (relay as any).handleHttpRequest(request, response);
  return { statusCode: response.statusCode, body: response.body ? JSON.parse(response.body) : null };
}

describe('Phase 114: privacy-preserving background push delivery', () => {
  it('creates only a generic notification payload with no message content or mailbox identifiers', () => {
    const message = buildGenericFcmMessage('opaque-device-token');

    expect(message).toEqual({
      message: {
        token: 'opaque-device-token',
        data: { kind: 'message' },
        android: { priority: 'HIGH' },
      },
    });
    expect(JSON.stringify(message)).not.toMatch(/secret|plaintext|mailbox|conversation/i);
  });

  it('uses the configured short-lived server access token and sends to the FCM v1 API', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    const sender = new FirebasePushSender({
      projectId: 'veil-test-project',
      getAccessToken: async () => 'short-lived-token',
      fetcher: fetcher as typeof fetch,
    });

    await sender.send('opaque-device-token');

    expect(fetcher).toHaveBeenCalledWith(
      'https://fcm.googleapis.com/v1/projects/veil-test-project/messages:send',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer short-lived-token' }),
        body: JSON.stringify(buildGenericFcmMessage('opaque-device-token')),
      })
    );
  });

  it('does not disclose device tokens or provider response bodies when delivery fails', async () => {
    const fetcher = vi.fn(async () => new Response('token=provider-secret', { status: 500 }));
    const sender = new FirebasePushSender({
      projectId: 'veil-test-project',
      getAccessToken: async () => 'short-lived-token',
      fetcher: fetcher as typeof fetch,
    });

    await expect(sender.send('private-device-token')).rejects.toThrow('Firebase push request failed (500)');
    await expect(sender.send('private-device-token')).rejects.not.toThrow(/provider-secret|private-device-token/);
  });

  it('moves a device token between mailboxes rather than linking multiple Spaces', async () => {
    const store = new MemoryRelayStore();
    await store.init();
    await store.registerPushToken('space-a-mailbox', 'same-device-token');
    await store.registerPushToken('space-b-mailbox', 'same-device-token');

    expect(await store.listPushTokens('space-a-mailbox')).toEqual([]);
    expect(await store.listPushTokens('space-b-mailbox')).toEqual(['same-device-token']);
  });

  it('persists registrations across relay restarts and retains only one mailbox per device', async () => {
    const directory = fs.mkdtempSync(path.join(process.cwd(), '.veil-push-token-test-'));
    const first = new PersistentFileRelayStore(directory);
    try {
      await first.init();
      await first.createMailbox({ mailboxId: 'mailbox-a', capabilityHash: 'a', createdAt: 1, expiresAt: 99, lastActiveAt: 1 });
      await first.createMailbox({ mailboxId: 'mailbox-b', capabilityHash: 'b', createdAt: 1, expiresAt: 99, lastActiveAt: 1 });
      await first.registerPushToken('mailbox-a', 'device-token');
      await first.close();

      const restarted = new PersistentFileRelayStore(directory);
      await restarted.init();
      expect(await restarted.listPushTokens('mailbox-a')).toEqual(['device-token']);
      await restarted.registerPushToken('mailbox-b', 'device-token');
      expect(await restarted.listPushTokens('mailbox-a')).toEqual([]);
      expect(await restarted.listPushTokens('mailbox-b')).toEqual(['device-token']);
      await restarted.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it('exchanges a signed service-account assertion and caches its short-lived access token', async () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ access_token: 'oauth-token', expires_in: 3600 }), { status: 200 }));
    const provider = createFirebaseAccessTokenProvider({
      client_email: 'relay@example.test',
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    }, fetcher as typeof fetch, () => 1_800_000_000_000);

    await expect(provider()).resolves.toBe('oauth-token');
    await expect(provider()).resolves.toBe('oauth-token');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain('jwt-bearer');
  });

  it('persists the notify hint in the encrypted outbound queue for offline retries', async () => {
    const store = new EncryptedSpaceStore();
    const vault = new SpaceVaultManager();
    const envelope = vault.createSpace({ name: 'Push test', password: 'TestPassword123!', kdfParams: FAST_TEST_KDF_PARAMS });
    const session = vault.unlockSpace('TestPassword123!', envelope.spaceId);
    const manager = new NetworkManager(store, { httpUrl: 'http://127.0.0.1:1', wsUrl: 'ws://127.0.0.1:1/v1/ws' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    try {
      const queued = await manager.sendEnvelope(session, 'recipient-mailbox', 'encrypted-message', undefined, {
        messageId: 'msg-id',
        notifyRecipient: true,
      });
      const persisted = await manager.getQueue().listOutbound(session);
      expect(queued.status).toBe('QUEUED');
      expect(queued.notifyRecipient).toBe(true);
      expect(persisted[0]?.notifyRecipient).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('requires the mailbox capability to register and only pushes after an envelope is queued', async () => {
    const store = new MemoryRelayStore();
    await store.init();
    const send = vi.fn(async () => undefined);
    const relay = new RelayServer({}, store, undefined, undefined, { send } as any);
    try {
      const mailboxResponse = await sendRelayRequest(relay, 'POST', '/v1/mailboxes', {});
      expect(mailboxResponse.statusCode).toBe(201);
      const { mailboxId, capabilityToken } = mailboxResponse.body;

      const denied = await sendRelayRequest(relay, 'POST', '/v1/push/register', {
        mailboxId,
        capabilityToken: 'wrong-capability',
        token: 'opaque-device-token',
      });
      expect(denied.statusCode).toBe(401);

      const registered = await sendRelayRequest(relay, 'POST', '/v1/push/register', {
        mailboxId,
        capabilityToken,
        token: 'opaque-device-token',
      });
      expect(registered.statusCode).toBe(200);

      const invalidHint = await sendRelayRequest(relay, 'POST', '/v1/envelopes', {
        mailboxId,
        payload: 'opaque-encrypted-envelope',
        notifyRecipient: 'true',
      });
      expect(invalidHint.statusCode).toBe(400);

      const controlEnvelope = await sendRelayRequest(relay, 'POST', '/v1/envelopes', {
        mailboxId,
        payload: 'opaque-encrypted-envelope',
      });
      expect(controlEnvelope.statusCode).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(send).not.toHaveBeenCalled();

      const userMessage = await sendRelayRequest(relay, 'POST', '/v1/envelopes', {
        mailboxId,
        payload: 'opaque-encrypted-user-message',
        notifyRecipient: true,
      });
      expect(userMessage.statusCode).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(send).toHaveBeenCalledWith('opaque-device-token');

      const unregistered = await sendRelayRequest(relay, 'POST', '/v1/push/unregister', {
        mailboxId,
        capabilityToken,
        token: 'opaque-device-token',
      });
      expect(unregistered.statusCode).toBe(200);
      expect(await store.listPushTokens(mailboxId)).toEqual([]);
    } finally {
      (relay as any).rateLimiter.close();
    }
  });
});
