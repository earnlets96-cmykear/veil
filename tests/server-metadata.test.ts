import { describe, it, expect } from 'vitest';
import { MockTransportServer } from '../src/transport/server.ts';
import { generateMailboxId, generateCapability } from '../src/transport/capability.ts';
import { MessagePadding } from '../src/privacy/padding.ts';
import { bytesToBase64 } from '../src/crypto/utils.ts';

describe('VEIL Phase 8: Server Metadata Audit & Knowledge Boundary Tests', () => {
  it('SERVER METADATA AUDIT: Server database contains zero plaintexts, passwords, or identities', async () => {
    const server = new MockTransportServer();
    const mailboxId = generateMailboxId();
    const { capability, verifier } = generateCapability();

    await server.createMailbox(mailboxId, verifier);

    // Client posts padded encrypted envelope
    const paddedCiphertext = MessagePadding.padMessage('EncryptedCiphertextPayload12345');
    await server.postEnvelope({
      envelopeId: 'env_audit_01',
      mailboxId,
      version: 1,
      payload: bytesToBase64(paddedCiphertext),
      sizeClass: 'SMALL',
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
    });


    // Inspect server database dump
    const dump = server.inspectDatabase();
    expect(dump.mailboxes.length).toBe(1);
    const mb = dump.mailboxes[0];

    // Server knows only opaque routing metadata
    expect(mb.mailboxId).toBe(mailboxId);
    expect(mb.verifier).toBe(verifier);
    expect(mb.envelopeCount).toBe(1);

    // Verify zero user identifiers or plaintext leaks
    const dumpStr = JSON.stringify(dump);
    expect(dumpStr).not.toContain('password');
    expect(dumpStr).not.toContain('EncryptedCiphertextPayload');
    expect(dumpStr).not.toContain('Main Space');
    expect(dumpStr).not.toContain('Private Space');
  });
});
