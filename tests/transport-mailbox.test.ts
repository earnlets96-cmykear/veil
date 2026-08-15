import { describe, it, expect, beforeEach } from 'vitest';
import { MockTransportServer } from '../src/transport/server.ts';
import {
  generateMailboxId,
  generateMailboxCapability,
  deriveCapabilityVerifier,
} from '../src/transport/capability.ts';

describe('VEIL Phase 3: Transport Mailbox Lifecycle Tests', () => {
  let server: MockTransportServer;

  beforeEach(() => {
    server = new MockTransportServer();
  });

  it('should create a mailbox with a valid ID and capability verifier', async () => {
    const { mailboxId, capability } = generateMailboxCapability();
    const verifier = deriveCapabilityVerifier(capability);

    const success = await server.createMailbox(mailboxId, verifier);
    expect(success).toBe(true);

    // Verify status
    const status = await server.getMailboxStatus(mailboxId, capability);
    expect(status).not.toBeNull();
    expect(status!.mailboxId).toBe(mailboxId);
    expect(status!.envelopeCount).toBe(0);
  });

  it('should generate unique, high-entropy mailbox IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const id = generateMailboxId();
      expect(id.length).toBe(64); // 32 bytes hex = 64 chars
      expect(/^[0-9a-f]{64}$/.test(id)).toBe(true);
      ids.add(id);
    }
    expect(ids.size).toBe(100);
  });

  it('should reject re-registering an already existing mailbox', async () => {
    const { mailboxId, capability } = generateMailboxCapability();
    const verifier = deriveCapabilityVerifier(capability);

    const first = await server.createMailbox(mailboxId, verifier);
    expect(first).toBe(true);

    const second = await server.createMailbox(mailboxId, verifier);
    expect(second).toBe(false);
  });

  it('should delete a mailbox when provided with valid capability', async () => {
    const { mailboxId, capability } = generateMailboxCapability();
    const verifier = deriveCapabilityVerifier(capability);

    await server.createMailbox(mailboxId, verifier);
    const deleted = await server.deleteMailbox(mailboxId, capability);
    expect(deleted).toBe(true);

    // Status query on deleted mailbox returns null
    const status = await server.getMailboxStatus(mailboxId, capability);
    expect(status).toBeNull();
  });

  it('should reject mailbox deletion with wrong capability', async () => {
    const mb1 = generateMailboxCapability();
    const mb2 = generateMailboxCapability();

    await server.createMailbox(mb1.mailboxId, deriveCapabilityVerifier(mb1.capability));

    // Try deleting mb1 using mb2's capability
    await expect(server.deleteMailbox(mb1.mailboxId, mb2.capability)).rejects.toThrow(/unauthorized/);
  });
});
