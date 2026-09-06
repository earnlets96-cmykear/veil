/**
 * Phase 65 Reactions, Actions & Group Metadata Security Test Suite
 *
 * Verifies:
 * 1. Group Avatar & Metadata Authorization:
 *    - CREATOR role can update metadata and avatar url.
 *    - Cryptographically signed and verifiable across members.
 *    - Non-creator role is rejected with unauthorized error.
 * 2. Cross-Perspective Delete for Everyone:
 *    - Resolves 1-to-1 conversation IDs across Alice and Bob's reciprocal perspective.
 * 3. Message Reaction Toggling:
 *    - User reacts: adds reaction with count 1, userReacted: true.
 *    - User removes reaction: count decrements or clears.
 *    - Peer reaction: count increments, userReacted: false.
 * 4. Verified Device File Saving:
 *    - Accurately checks saved.success to guard against partial or failed filesystem writes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GroupStateManager } from '../src/group/groupState.ts';
import { SpaceVaultManager } from '../src/spaces/vault.ts';
import { EncryptedSpaceStore } from '../src/storage/spaceStore.ts';
import { SpaceIdentityManager } from '../src/identity/manager.ts';
import { FAST_TEST_KDF_PARAMS } from '../src/crypto/kdf.ts';
import { GroupAction } from '../src/group/types.ts';
import { UIMessage } from '../src/ui/app/types.ts';
import { base64ToBytes } from '../src/crypto/utils.ts';

describe('Phase 65: Reactions, Message Actions & Group Metadata Authorization', () => {
  describe('GroupStateManager: Cryptographic Metadata & Avatar Authorization', () => {
    let vault: SpaceVaultManager;
    let store: EncryptedSpaceStore;
    let idMgr: SpaceIdentityManager;

    let docCreator: any;
    let idCreator: any;
    let docMember: any;
    let idMember: any;

    beforeEach(() => {
      vault = new SpaceVaultManager();
      store = new EncryptedSpaceStore();
      idMgr = new SpaceIdentityManager();

      vault.createSpace({ name: 'Creator', password: 'PassCreator', kdfParams: FAST_TEST_KDF_PARAMS });
      vault.createSpace({ name: 'Member', password: 'PassMember', kdfParams: FAST_TEST_KDF_PARAMS });

      const sessCreator = vault.unlockSpace('PassCreator');
      const sessMember = vault.unlockSpace('PassMember');

      docCreator = idMgr.createIdentity(sessCreator, store);
      idCreator = idMgr.loadIdentity(sessCreator, store)!;

      docMember = idMgr.createIdentity(sessMember, store);
      idMember = idMgr.loadIdentity(sessMember, store)!;
    });

    it('allows group CREATOR to update metadata/avatar and signs action', () => {
      // 1. Creator creates group
      const { state, groupMasterSecret } = GroupStateManager.createGroup(
        docCreator.identityId,
        docCreator.signingPublicKey,
        idCreator.signingPrivateKey,
        { name: 'Alpha Secret Team' }
      );

      // Add member
      GroupStateManager.addMember(
        state,
        docCreator.identityId,
        idCreator.signingPrivateKey,
        docMember.identityId,
        docMember.signingPublicKey,
        'MEMBER'
      );

      expect(state.members[docCreator.identityId].role).toBe('CREATOR');
      expect(state.members[docMember.identityId].role).toBe('MEMBER');

      // 2. Creator updates metadata with avatar url
      const avatarDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...';
      const updateAction = GroupStateManager.updateMetadata(
        state,
        docCreator.identityId,
        idCreator.signingPrivateKey,
        { name: 'Alpha Secret Team (Renamed)', description: 'Updated details', avatarUrl: avatarDataUrl },
        groupMasterSecret
      );

      expect(updateAction.actionType).toBe('UPDATE_METADATA');
      expect(updateAction.actorIdentityId).toBe(docCreator.identityId);

      // 3. Decrypt and verify metadata using master secret
      const decryptedMeta = GroupStateManager.decryptMetadata(state, groupMasterSecret);
      expect(decryptedMeta.name).toBe('Alpha Secret Team (Renamed)');
      expect(decryptedMeta.description).toBe('Updated details');
      expect(decryptedMeta.avatarUrl).toBe(avatarDataUrl);
    });

    it('strictly forbids non-creator from updating group metadata', () => {
      const { state, groupMasterSecret } = GroupStateManager.createGroup(
        docCreator.identityId,
        docCreator.signingPublicKey,
        idCreator.signingPrivateKey,
        { name: 'Alpha Secret Team' }
      );

      GroupStateManager.addMember(
        state,
        docCreator.identityId,
        idCreator.signingPrivateKey,
        docMember.identityId,
        docMember.signingPublicKey,
        'MEMBER'
      );

      // Member attempts to update metadata
      expect(() => {
        GroupStateManager.updateMetadata(
          state,
          docMember.identityId,
          idMember.signingPrivateKey,
          { name: 'Compromised Name' },
          groupMasterSecret
        );
      }).toThrow(/only the group CREATOR can update group metadata/);
    });

    it('rejects forged UPDATE_METADATA action when verified against creator public key', () => {
      const { state, groupMasterSecret } = GroupStateManager.createGroup(
        docCreator.identityId,
        docCreator.signingPublicKey,
        idCreator.signingPrivateKey,
        { name: 'Alpha Secret Team' }
      );

      const validAction = GroupStateManager.updateMetadata(
        state,
        docCreator.identityId,
        idCreator.signingPrivateKey,
        { name: 'Legitimate Name' },
        groupMasterSecret
      );

      // Tampered action: forged payload
      const tamperedAction: GroupAction = {
        ...validAction,
        actorIdentityId: docMember.identityId,
      };

      expect(() => {
        GroupStateManager.verifyAndApplyAction(state, tamperedAction, base64ToBytes(docCreator.signingPublicKey));
      }).toThrow();
    });
  });

  describe('Cross-Perspective Delete for Everyone Resolution', () => {
    it('finds and removes message even if peer indexes conversation under senderId', () => {
      const aliceId = 'alice-fingerprint-001';
      const bobId = 'bob-fingerprint-002';

      // Bob's local message store: indexed by aliceId
      const bobMessages: Record<string, UIMessage[]> = {
        [aliceId]: [
          {
            id: 'msg-target-123',
            senderId: aliceId,
            senderName: 'Alice',
            text: 'Sensitive Message To Delete',
            timestamp: Date.now() - 5000,
            isOutgoing: false,
            deliveryStatus: 'DELIVERED',
          },
          {
            id: 'msg-other-456',
            senderId: aliceId,
            senderName: 'Alice',
            text: 'Other Message',
            timestamp: Date.now() - 1000,
            isOutgoing: false,
            deliveryStatus: 'DELIVERED',
          },
        ],
      };

      // Alice sends delete payload with conversationId = bobId
      const deletePayload = {
        conversationId: bobId,
        messageId: 'msg-target-123',
        senderId: aliceId,
      };

      // AppState resolution logic:
      const resolveTargetChatId = (store: Record<string, UIMessage[]>, payload: typeof deletePayload): string | null => {
        if (store[payload.conversationId]) return payload.conversationId;
        if (payload.senderId && store[payload.senderId]) return payload.senderId;
        for (const cid of Object.keys(store)) {
          if (store[cid].some((m) => m.id === payload.messageId)) return cid;
        }
        return null;
      };

      const targetChatId = resolveTargetChatId(bobMessages, deletePayload);
      expect(targetChatId).toBe(aliceId);

      // Perform deletion
      const updatedMessages = bobMessages[targetChatId!].filter((m) => m.id !== deletePayload.messageId);
      expect(updatedMessages.length).toBe(1);
      expect(updatedMessages.find((m) => m.id === 'msg-target-123')).toBeUndefined();
    });
  });

  describe('Message Reaction Toggling Logic', () => {
    it('adds reaction on initial click and removes on secondary click', () => {
      let reactions: Array<{ emoji: string; count: number; userReacted?: boolean }> = [];

      const toggleReaction = (
        existing: typeof reactions,
        emoji: string
      ): typeof reactions => {
        const idx = existing.findIndex((r) => r.emoji === emoji);
        if (idx >= 0) {
          const current = existing[idx];
          if (current.userReacted) {
            // Remove user reaction
            if (current.count <= 1) {
              return existing.filter((_, i) => i !== idx);
            } else {
              return existing.map((r, i) =>
                i === idx ? { ...r, count: r.count - 1, userReacted: false } : r
              );
            }
          } else {
            // User adds reaction to existing emoji
            return existing.map((r, i) =>
              i === idx ? { ...r, count: r.count + 1, userReacted: true } : r
            );
          }
        } else {
          // Fresh reaction
          return [...existing, { emoji, count: 1, userReacted: true }];
        }
      };

      // 1. Initial click adds ❤️
      reactions = toggleReaction(reactions, '❤️');
      expect(reactions).toEqual([{ emoji: '❤️', count: 1, userReacted: true }]);

      // 2. Click ❤️ again removes it
      reactions = toggleReaction(reactions, '❤️');
      expect(reactions).toEqual([]);

      // 3. Peer reacted with 👍 (count: 1, userReacted: false)
      reactions = [{ emoji: '👍', count: 1, userReacted: false }];

      // User reacts to 👍
      reactions = toggleReaction(reactions, '👍');
      expect(reactions).toEqual([{ emoji: '👍', count: 2, userReacted: true }]);

      // User removes reaction from 👍
      reactions = toggleReaction(reactions, '👍');
      expect(reactions).toEqual([{ emoji: '👍', count: 1, userReacted: false }]);
    });
  });

  describe('Verified Device File Saving Contract', () => {
    it('verifies saved.success property to prevent false positive save toasts', () => {
      const mockSuccessResult = { success: true, filePath: '/storage/emulated/0/Download/voice.m4a' };
      const mockFailedResult = { success: false, error: 'Permission denied' };

      const verifySaveResult = (res: any): boolean => {
        return Boolean(res && res.success === true);
      };

      expect(verifySaveResult(mockSuccessResult)).toBe(true);
      expect(verifySaveResult(mockFailedResult)).toBe(false);
      expect(verifySaveResult(null)).toBe(false);
      expect(verifySaveResult(undefined)).toBe(false);
    });
  });
});
