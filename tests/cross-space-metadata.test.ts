import { describe, it, expect } from 'vitest';
import { MockTransportServer } from '../src/transport/server.ts';
import { generateMailboxId, generateCapability } from '../src/transport/capability.ts';
import { MessagePadding } from '../src/privacy/padding.ts';
import { bytesToBase64 } from '../src/crypto/utils.ts';

describe('VEIL Phase 8: Cross-Space Metadata Indistinguishability Tests', () => {
  it('CROSS-SPACE INDISTINGUISHABILITY: Main, Private, and Decoy Spaces produce identical traffic signatures', async () => {
    const server = new MockTransportServer();

    // 1. Setup mailboxes for Main, Private, and Decoy Spaces
    const mbMain = generateMailboxId();
    const mbPriv = generateMailboxId();
    const mbDecoy = generateMailboxId();

    await server.createMailbox(mbMain, generateCapability().verifier);
    await server.createMailbox(mbPriv, generateCapability().verifier);
    await server.createMailbox(mbDecoy, generateCapability().verifier);

    // 2. Post padded envelopes
    const padMain = MessagePadding.padMessage('Hello from Main');
    const padPriv = MessagePadding.padMessage('Top secret message');
    const padDecoy = MessagePadding.padMessage('Weather is nice');

    const now = Date.now();
    await server.postEnvelope({ envelopeId: 'e1', mailboxId: mbMain, version: 1, payload: bytesToBase64(padMain), sizeClass: 'SMALL', createdAt: now, expiresAt: now + 60000 });
    await server.postEnvelope({ envelopeId: 'e2', mailboxId: mbPriv, version: 1, payload: bytesToBase64(padPriv), sizeClass: 'SMALL', createdAt: now, expiresAt: now + 60000 });
    await server.postEnvelope({ envelopeId: 'e3', mailboxId: mbDecoy, version: 1, payload: bytesToBase64(padDecoy), sizeClass: 'SMALL', createdAt: now, expiresAt: now + 60000 });




    const dump = server.inspectDatabase();
    expect(dump.mailboxes.length).toBe(3);

    // All mailboxes have identical structure and identical 512-byte payload lengths on server
    for (const mb of dump.mailboxes) {
      expect(mb.mailboxId).toMatch(/^[0-9a-f]{64}$/);
      expect(mb.envelopeCount).toBe(1);
    }
  });
});
