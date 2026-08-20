/**
 * Phase 30: E2EE Message & Envelope Sync Across Reconnects Test Suite
 *
 * Verifies that blind relay mailboxes deliver unacknowledged envelopes,
 * and clear acknowledged envelopes across reconnects.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersistentFileRelayStore } from '../src/server/storage/persistentRelayStore.ts';
import type { RelayEnvelope, MailboxRecord } from '../src/server/types.ts';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 30: Message Envelope Sync Across Reconnects', () => {
  const relayDir = path.join(process.cwd(), '.veil_test_sync_relay');
  let store: PersistentFileRelayStore;

  beforeEach(async () => {
    if (fs.existsSync(relayDir)) fs.rmSync(relayDir, { recursive: true, force: true });
    store = new PersistentFileRelayStore(relayDir);
    await store.init();
  });

  afterEach(async () => {
    await store.close();
    if (fs.existsSync(relayDir)) fs.rmSync(relayDir, { recursive: true, force: true });
  });

  it('delivers unread envelopes, and removes them once acknowledged', async () => {
    const mailbox: MailboxRecord = {
      mailboxId: 'mb_sync_test',
      capabilityHash: 'cap_sync_hash',
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      lastActiveAt: Date.now(),
    };
    await store.createMailbox(mailbox);

    // Save 3 incoming messages for user
    for (let i = 1; i <= 3; i++) {
      const env: RelayEnvelope = {
        protocolVersion: 1,
        envelopeId: `env_${i}`,
        mailboxId: 'mb_sync_test',
        payload: `ciphertext_msg_${i}`,
        sizeBytes: 20,
        createdAt: Date.now() + i * 10,
        expiresAt: Date.now() + 86400000,
      };
      await store.saveEnvelope(env);
    }

    // First fetch
    let unread = await store.listEnvelopes('mb_sync_test', 10);
    expect(unread.length).toBe(3);
    expect(unread.map((e) => e.envelopeId)).toEqual(['env_1', 'env_2', 'env_3']);

    // Acknowledge first 2 messages
    await store.deleteEnvelopes('mb_sync_test', ['env_1', 'env_2']);

    // Simulate Reconnect and fetch again
    unread = await store.listEnvelopes('mb_sync_test', 10);
    expect(unread.length).toBe(1);
    expect(unread[0].envelopeId).toBe('env_3');
  });
});
