/**
 * Group State Management & Cryptographic Membership Transitions for VEIL.
 *
 * Enforces role-based access control, Ed25519 signature verification on state actions,
 * anti-rollback epoch guarantees, and encrypted group metadata.
 */

import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha256.js';
import {
  GroupState,
  GroupMember,
  GroupRole,
  GroupAction,
  GroupMetadata,
} from './types.ts';
import {
  canonicalizeGroupAction,
  deriveGroupEpochKey,
  deriveGroupMetadataKey,
} from './groupKdf.ts';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { bytesToBase64, base64ToBytes, getRandomBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';

export class GroupStateManager {
  /**
   * Initializes a brand new GroupState with creator role.
   */
  public static createGroup(
    creatorIdentityId: string,
    creatorSigningKeyPub: string,
    creatorSigningKeyPriv: Uint8Array,
    metadata: GroupMetadata,
    groupMasterSecret?: Uint8Array
  ): { state: GroupState; groupMasterSecret: Uint8Array } {
    const rawSecret = groupMasterSecret ? new Uint8Array(groupMasterSecret) : getRandomBytes(32);
    const groupId = `grp_${bytesToBase64(getRandomBytes(16)).replace(/[+/=]/g, '').slice(0, 24)}`;
    const epoch = 1;

    // Encrypt metadata with Epoch 1 metadata key
    const epochKey = deriveGroupEpochKey(rawSecret, epoch);
    const metadataKey = deriveGroupMetadataKey(epochKey);
    const { nonce: metaNonce, ciphertext: metaCipher } = encryptXChaCha20Poly1305(
      metadataKey,
      JSON.stringify(metadata)
    );
    zeroize(epochKey);
    zeroize(metadataKey);

    const members: Record<string, GroupMember> = {
      [creatorIdentityId]: {
        identityId: creatorIdentityId,
        signingPublicKey: creatorSigningKeyPub,
        role: 'CREATOR',
        joinedAtEpoch: epoch,
        addedBy: creatorIdentityId,
      },
    };

    const actionData: Omit<GroupAction, 'signature'> = {
      actionId: `act_${Date.now()}_create`,
      groupId,
      epoch,
      actionType: 'CREATE_GROUP',
      actorIdentityId: creatorIdentityId,
      timestamp: Date.now(),
    };

    const canonicalBytes = canonicalizeGroupAction(actionData);
    const digest = sha256(canonicalBytes);
    const signature = ed25519.sign(digest, creatorSigningKeyPriv);

    const initialAction: GroupAction = {
      ...actionData,
      signature: bytesToBase64(signature),
    };

    const state: GroupState = {
      groupId,
      version: 1,
      epoch,
      creatorIdentityId,
      encryptedMetadata: bytesToBase64(metaCipher),
      metadataNonce: bytesToBase64(metaNonce),
      members,
      actionHistory: [initialAction],
      updatedAt: Date.now(),
    };

    return { state, groupMasterSecret: rawSecret };
  }

  /**
   * Adds a new member to the group state.
   */
  public static addMember(
    state: GroupState,
    adminIdentityId: string,
    adminSigningPriv: Uint8Array,
    newMemberIdentityId: string,
    newMemberSigningPub: string,
    role: GroupRole = 'MEMBER'
  ): GroupAction {
    const admin = state.members[adminIdentityId];
    if (!admin || (admin.role !== 'CREATOR' && admin.role !== 'ADMIN')) {
      throw new Error(`Unauthorized: actor ${adminIdentityId} is not an ADMIN or CREATOR`);
    }

    if (state.members[newMemberIdentityId]) {
      throw new Error(`Member ${newMemberIdentityId} is already in group ${state.groupId}`);
    }

    const actionData: Omit<GroupAction, 'signature'> = {
      actionId: `act_${Date.now()}_add_${newMemberIdentityId.slice(0, 6)}`,
      groupId: state.groupId,
      epoch: state.epoch,
      actionType: 'ADD_MEMBER',
      actorIdentityId: adminIdentityId,
      targetIdentityId: newMemberIdentityId,
      newRole: role,
      timestamp: Date.now(),
    };

    const canonicalBytes = canonicalizeGroupAction(actionData);
    const digest = sha256(canonicalBytes);
    const signature = ed25519.sign(digest, adminSigningPriv);

    const action: GroupAction = {
      ...actionData,
      signature: bytesToBase64(signature),
    };

    state.members[newMemberIdentityId] = {
      identityId: newMemberIdentityId,
      signingPublicKey: newMemberSigningPub,
      role,
      joinedAtEpoch: state.epoch,
      addedBy: adminIdentityId,
    };

    state.actionHistory.push(action);
    state.updatedAt = Date.now();

    return action;
  }

  /**
   * Removes a member from the group and advances the Epoch.
   */
  public static removeMember(
    state: GroupState,
    adminIdentityId: string,
    adminSigningPriv: Uint8Array,
    targetIdentityId: string
  ): GroupAction {
    const admin = state.members[adminIdentityId];
    if (!admin || (admin.role !== 'CREATOR' && admin.role !== 'ADMIN')) {
      throw new Error(`Unauthorized: actor ${adminIdentityId} is not an ADMIN or CREATOR`);
    }

    const target = state.members[targetIdentityId];
    if (!target) {
      throw new Error(`Cannot remove: member ${targetIdentityId} is not in group`);
    }

    if (target.role === 'CREATOR') {
      throw new Error('Cannot remove the group CREATOR');
    }

    if (admin.role === 'ADMIN' && target.role === 'ADMIN') {
      throw new Error('Admins cannot remove other Admins (only Creator can)');
    }

    // Advance Epoch on member removal
    state.epoch += 1;

    const actionData: Omit<GroupAction, 'signature'> = {
      actionId: `act_${Date.now()}_rem_${targetIdentityId.slice(0, 6)}`,
      groupId: state.groupId,
      epoch: state.epoch,
      actionType: 'REMOVE_MEMBER',
      actorIdentityId: adminIdentityId,
      targetIdentityId,
      timestamp: Date.now(),
    };

    const canonicalBytes = canonicalizeGroupAction(actionData);
    const digest = sha256(canonicalBytes);
    const signature = ed25519.sign(digest, adminSigningPriv);

    const action: GroupAction = {
      ...actionData,
      signature: bytesToBase64(signature),
    };

    delete state.members[targetIdentityId];
    state.actionHistory.push(action);
    state.updatedAt = Date.now();

    return action;
  }

  /**
   * Voluntary group departure by a member (advances Epoch).
   */
  public static leaveGroup(
    state: GroupState,
    memberIdentityId: string,
    memberSigningPriv: Uint8Array
  ): GroupAction {
    const member = state.members[memberIdentityId];
    if (!member) {
      throw new Error(`Member ${memberIdentityId} is not in group`);
    }

    // Advance Epoch
    state.epoch += 1;

    const actionData: Omit<GroupAction, 'signature'> = {
      actionId: `act_${Date.now()}_leave_${memberIdentityId.slice(0, 6)}`,
      groupId: state.groupId,
      epoch: state.epoch,
      actionType: 'LEAVE_GROUP',
      actorIdentityId: memberIdentityId,
      timestamp: Date.now(),
    };

    const canonicalBytes = canonicalizeGroupAction(actionData);
    const digest = sha256(canonicalBytes);
    const signature = ed25519.sign(digest, memberSigningPriv);

    const action: GroupAction = {
      ...actionData,
      signature: bytesToBase64(signature),
    };

    delete state.members[memberIdentityId];
    state.actionHistory.push(action);
    state.updatedAt = Date.now();

    return action;
  }

  /**
   * Updates a member's role (promote/demote).
   */
  public static updateRole(
    state: GroupState,
    actorIdentityId: string,
    actorSigningPriv: Uint8Array,
    targetIdentityId: string,
    newRole: GroupRole
  ): GroupAction {
    const actor = state.members[actorIdentityId];
    if (!actor || actor.role !== 'CREATOR') {
      throw new Error('Only the CREATOR can update member roles');
    }

    const target = state.members[targetIdentityId];
    if (!target) {
      throw new Error(`Target ${targetIdentityId} is not a member of the group`);
    }

    const actionData: Omit<GroupAction, 'signature'> = {
      actionId: `act_${Date.now()}_role_${targetIdentityId.slice(0, 6)}`,
      groupId: state.groupId,
      epoch: state.epoch,
      actionType: 'UPDATE_ROLE',
      actorIdentityId,
      targetIdentityId,
      newRole,
      timestamp: Date.now(),
    };

    const canonicalBytes = canonicalizeGroupAction(actionData);
    const digest = sha256(canonicalBytes);
    const signature = ed25519.sign(digest, actorSigningPriv);

    const action: GroupAction = {
      ...actionData,
      signature: bytesToBase64(signature),
    };

    target.role = newRole;
    state.actionHistory.push(action);
    state.updatedAt = Date.now();

    return action;
  }

  /**
   * Verifies and applies a received GroupAction to the local state.
   */
  public static verifyAndApplyAction(
    state: GroupState,
    action: GroupAction,
    actorSigningPublicKey: Uint8Array
  ): void {
    if (action.groupId !== state.groupId) {
      throw new Error(`Action groupId mismatch: ${action.groupId} !== ${state.groupId}`);
    }

    // Rollback protection
    if (action.epoch < state.epoch) {
      throw new Error(`Rollback rejected: received action for epoch ${action.epoch} < current epoch ${state.epoch}`);
    }

    // Verify Ed25519 signature
    const canonicalBytes = canonicalizeGroupAction(action);
    const digest = sha256(canonicalBytes);
    const isSigValid = ed25519.verify(
      base64ToBytes(action.signature),
      digest,
      actorSigningPublicKey
    );
    if (!isSigValid) {
      throw new Error(`Invalid signature for group action ${action.actionId}`);
    }


    switch (action.actionType) {
      case 'ADD_MEMBER': {
        if (!action.targetIdentityId) throw new Error('ADD_MEMBER missing targetIdentityId');
        state.members[action.targetIdentityId] = {
          identityId: action.targetIdentityId,
          signingPublicKey: bytesToBase64(actorSigningPublicKey),
          role: action.newRole || 'MEMBER',
          joinedAtEpoch: action.epoch,
          addedBy: action.actorIdentityId,
        };
        break;
      }
      case 'REMOVE_MEMBER':
      case 'LEAVE_GROUP': {
        const target = action.targetIdentityId || action.actorIdentityId;
        delete state.members[target];
        if (action.epoch > state.epoch) {
          state.epoch = action.epoch;
        }
        break;
      }
      case 'UPDATE_ROLE': {
        if (!action.targetIdentityId || !action.newRole) {
          throw new Error('UPDATE_ROLE missing targetIdentityId or newRole');
        }
        if (state.members[action.targetIdentityId]) {
          state.members[action.targetIdentityId].role = action.newRole;
        }
        break;
      }
    }

    state.actionHistory.push(action);
    state.updatedAt = Date.now();
  }

  /**
   * Decrypts group metadata using the epoch master key.
   */
  public static decryptMetadata(
    state: GroupState,
    groupMasterSecret: Uint8Array
  ): GroupMetadata {
    const epochKey = deriveGroupEpochKey(groupMasterSecret, state.epoch);
    const metadataKey = deriveGroupMetadataKey(epochKey);
    const nonce = base64ToBytes(state.metadataNonce);
    const ciphertext = base64ToBytes(state.encryptedMetadata);

    try {
      const plaintextBytes = decryptXChaCha20Poly1305(metadataKey, nonce, ciphertext);
      const text = new TextDecoder().decode(plaintextBytes);
      return JSON.parse(text) as GroupMetadata;
    } finally {
      zeroize(epochKey);
      zeroize(metadataKey);
    }
  }
}
