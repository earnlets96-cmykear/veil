import { describe, it, expect, beforeEach } from 'vitest';
import { MockTransportServer } from '../src/transport/server.ts';
import { generateMailboxCapability, deriveCapabilityVerifier } from '../src/transport/capability.ts';
import { createTransportEnvelope, validateTransportEnvelope } from '../src/transport/envelope.ts';

describe('VEIL Phase 3: TTL & Envelope Expiration Tests', () => {
  let server: MockTransportServer;

  beforeEach(() => {
    server = new MockTransportServer();
  });

  it('should post and retrieve valid unexpired envelopes', async () => {
    const { mailboxId, capability } = generateMailboxCapability();
    await server.createMailbox(mailboxId, deriveCapabilityVerifier(capability));

    const env = createTransportEnvelope({
      mailboxId,
      payload: 'PAYLOAD_ACTIVE',
      sizeClass: 'SMALL',
      ttlMs: 60000, // 1 min
    });

    await server.postEnvelope(env);
    const fetched = await server.fetchEnvelopes(mailboxId, capability);
    expect(fetched.length).toBe(1);
    expect(fetched[0].envelopeId).toBe(env.envelopeId);
  });

  it('should filter out and purge expired envelopes on fetch', async () => {
    const { mailboxId, capability } = generateMailboxCapability();
    await server.createMailbox(mailboxId, deriveCapabilityVerifier(capability));

    // Create an envelope with negative/immediate expiration
    const now = Date.now();
    const expiredEnv = {
      version: 1 as const,
      envelopeId: 'expired-env-1',
      mailboxId,
      payload: 'EXPIRED_DATA',
      sizeClass: 'SMALL' as const,
      createdAt: now - 10000,
      expiresAt: now - 1000, // expired 1s ago
    };

    // Low level post bypassing client validation
    await server.postEnvelope(expiredEnv);

    // Fetch should return 0 envelopes because expired item was purged
    const fetched = await server.fetchEnvelopes(mailboxId, capability);
    expect(fetched.length).toBe(0);
  });

  it('should purge expired envelopes across all mailboxes using purgeExpired()', async () => {
    const mb1 = generateMailboxCapability();
    const mb2 = generateMailboxCapability();
    await server.createMailbox(mb1.mailboxId, deriveCapabilityVerifier(mb1.capability));
    await server.createMailbox(mb2.mailboxId, deriveCapabilityVerifier(mb2.capability));

    const now = Date.now();
    const envExpired1 = {
      version: 1 as const,
      envelopeId: 'exp-1',
      mailboxId: mb1.mailboxId,
      payload: 'P1',
      sizeClass: 'SMALL' as const,
      createdAt: now,
      expiresAt: now + 500, // expires in 500ms
    };
    const envValid2 = {
      version: 1 as const,
      envelopeId: 'valid-2',
      mailboxId: mb2.mailboxId,
      payload: 'P2',
      sizeClass: 'SMALL' as const,
      createdAt: now,
      expiresAt: now + 50000,
    };

    await server.postEnvelope(envExpired1);
    await server.postEnvelope(envValid2);

    // Advance time past envExpired1 expiration (now + 1000)
    const purgedCount = server.purgeExpired(now + 1000);
    expect(purgedCount).toBe(1);

    // Valid envelope in mb2 remains
    const fetched = await server.fetchEnvelopes(mb2.mailboxId, mb2.capability);
    expect(fetched.length).toBe(1);
  });

  it('validateTransportEnvelope correctly flags expired envelopes', () => {
    const now = Date.now();
    const env = {
      version: 1 as const,
      envelopeId: 'env-1',
      mailboxId: 'mb-1',
      payload: 'P',
      sizeClass: 'SMALL' as const,
      createdAt: now - 10000,
      expiresAt: now - 100,
    };

    expect(validateTransportEnvelope(env, now)).toBe(false);
  });
});
