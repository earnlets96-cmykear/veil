import { describe, expect, it } from 'vitest';
import { isConversationDeletedAt, mergeConversationTombstones } from '../src/sync/conversationTombstones.ts';
import { AccountManager } from '../src/account/accountManager.ts';
import { SpaceSession } from '../src/spaces/session.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../src/crypto/aead.ts';
import { base64ToBytes, bytesToBase64 } from '../src/crypto/utils.ts';
import type { StoredRecord } from '../src/storage/types.ts';

function record(session: SpaceSession, key: string, value: unknown): StoredRecord {
  const encrypted = encryptXChaCha20Poly1305(session.getStorageKey(), JSON.stringify(value));
  return {
    spaceId: session.spaceId,
    key,
    nonce: bytesToBase64(encrypted.nonce),
    ciphertext: bytesToBase64(encrypted.ciphertext),
    updatedAt: 1,
  };
}

function value<T>(session: SpaceSession, row: StoredRecord): T {
  const plain = decryptXChaCha20Poly1305(session.getStorageKey(), base64ToBytes(row.nonce), base64ToBytes(row.ciphertext));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

describe('conversation deletion tombstones', () => {
  it('merges Space tombstones using the newest deletion timestamp', () => {
    expect(mergeConversationTombstones(
      [{ conversationId: 'peer-a', deletedAt: 20 }],
      [{ conversationId: 'peer-a', deletedAt: 15 }, { conversationId: 'group-a', deletedAt: 8 }]
    )).toEqual([
      { conversationId: 'peer-a', deletedAt: 20 },
      { conversationId: 'group-a', deletedAt: 8 },
    ]);
  });

  it('filters messages at or before deletion and keeps later messages', () => {
    const tombstone = { conversationId: 'peer-a', deletedAt: 20 };
    expect(isConversationDeletedAt(tombstone, 19)).toBe(true);
    expect(isConversationDeletedAt(tombstone, 20)).toBe(true);
    expect(isConversationDeletedAt(tombstone, 21)).toBe(false);
  });

  it('prevents deleted direct and group histories from reappearing in a recovery merge', () => {
    const session = new SpaceSession('space-test', 'Test', false, new Uint8Array(32).fill(5));
    const manager = new AccountManager({} as any, {} as any, {} as any, {} as any, {} as any);
    const merged = (manager as any).mergeRecordsForSpace(session, [
      record(session, 'veil:ui:deleted_conversations', [{ conversationId: 'peer-a', deletedAt: 20 }, { conversationId: 'group-a', deletedAt: 20 }]),
      record(session, 'veil:ui:conversations', [
        { id: 'peer-a', timestamp: 19 }, { id: 'group-a', timestamp: 20 }, { id: 'peer-b', timestamp: 5 },
      ]),
      record(session, 'veil:ui:messages', {
        'peer-a': [{ id: 'old', timestamp: 19 }, { id: 'new', timestamp: 21, text: 'later' }],
        'group-a': [{ id: 'group-old', timestamp: 20 }],
      }),
      record(session, 'veil:messages:conv:peer-a', [{ id: 'old', timestamp: 19 }, { id: 'new', timestamp: 21, text: 'later' }]),
      record(session, 'veil:group:messages:group-a', [{ id: 'group-old', timestamp: 20 }]),
    ], [] as StoredRecord[]);
    const byKey = new Map<string, StoredRecord>(merged.map((row: StoredRecord) => [row.key, row]));

    expect(value<any[]>(session, byKey.get('veil:ui:conversations')!)).toEqual([
      { id: 'peer-a', timestamp: 21, lastMessage: 'later' },
      { id: 'peer-b', timestamp: 5 },
    ]);
    expect(value<any>(session, byKey.get('veil:ui:messages')!)).toEqual({ 'peer-a': [{ id: 'new', timestamp: 21, text: 'later' }], 'group-a': [] });
    expect(value<any[]>(session, byKey.get('veil:messages:conv:peer-a')!)).toEqual([{ id: 'new', timestamp: 21, text: 'later' }]);
    expect(value<any[]>(session, byKey.get('veil:group:messages:group-a')!)).toEqual([]);
    session.destroy();
  });
});
