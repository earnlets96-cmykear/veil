import { describe, it, expect } from 'vitest';
import { MockTransportServer } from '../src/transport/server.ts';
import { generateMailboxId, generateCapability } from '../src/transport/capability.ts';

describe('VEIL Phase 9 Red-Team Audit: Transport & Server Boundary Attacks', () => {
  it('IDOR ACCESS ATTACK: Capability for Mailbox A cannot fetch messages from Mailbox B', async () => {
    const server = new MockTransportServer();

    const mbA = generateMailboxId();
    const capA = generateCapability();
    await server.createMailbox(mbA, capA.verifier);

    const mbB = generateMailboxId();
    const capB = generateCapability();
    await server.createMailbox(mbB, capB.verifier);

    // Attempt to access Mailbox B using Capability A
    await expect(server.fetchEnvelopes(mbB, capA.capability)).rejects.toThrow(/unauthorized/i);
  });
});
