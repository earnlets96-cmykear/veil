/**
 * Group Manager for VEIL.
 *
 * Orchestrates multi-party group lifecycle, membership, SenderKey ratcheting,
 * pairwise key distribution, message encryption/decryption, and encrypted Space persistence.
 */

import { GroupStateManager } from './groupState.ts';
import { SenderKeySession } from './senderKey.ts';
import {
  GroupState,
  GroupMetadata,
  GroupRole,
  GroupAction,
  GroupMessagePayload,
  SenderKeyDistributionMessage,
  DecryptedGroupMessage,
} from './types.ts';
import { ConversationManager } from '../messaging/conversationManager.ts';
import { SpaceIdentityManager } from '../identity/manager.ts';
import { PrekeyBundle } from '../ratchet/types.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import { base64ToBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';

const GROUP_STATE_PREFIX = 'veil:group:state:';
const SENDERKEY_PREFIX = 'veil:group:senderkey:';
const GROUP_SECRET_PREFIX = 'veil:group:secret:';
const GROUP_MESSAGES_PREFIX = 'veil:group:messages:';

export class GroupManager {
  private store: EncryptedSpaceStore;
  private idMgr: SpaceIdentityManager;
  private convMgr?: ConversationManager;

  // In-memory active sender key sessions: Map<spaceId + groupId, SenderKeySession>
  private activeSessions = new Map<string, SenderKeySession>();

  constructor(
    store: EncryptedSpaceStore,
    idMgr: SpaceIdentityManager,
    convMgr?: ConversationManager
  ) {
    this.store = store;
    this.idMgr = idMgr;
    this.convMgr = convMgr;
  }

  /**
   * Creates a new group conversation with the active Space as CREATOR.
   */
  public createGroup(
    session: SpaceSession,
    metadata: GroupMetadata
  ): { state: GroupState; senderSession: SenderKeySession; groupMasterSecret: Uint8Array } {
    this.assertSession(session);

    const identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) throw new Error('Cannot create group: Space has no identity');

    const myIdentityDoc = this.idMgr.getPublicDocument(session, this.store)!;

    const { state, groupMasterSecret } = GroupStateManager.createGroup(
      myIdentityDoc.identityId,
      myIdentityDoc.signingPublicKey,
      identity.signingPrivateKey,
      metadata
    );

    // Initialize Creator's SenderKeySession
    const senderSession = new SenderKeySession(
      state.groupId,
      state.epoch,
      myIdentityDoc.identityId
    );

    // Persist GroupState, Master Secret, and SenderKeySession into Space store
    this.saveGroupState(session, state);
    this.saveGroupSecret(session, state.groupId, groupMasterSecret);
    this.saveSenderKeySession(session, senderSession);

    return { state, senderSession, groupMasterSecret };
  }

  /**
   * Adds a new member to an existing group and exports SenderKey distribution.
   */
  public addMember(
    session: SpaceSession,
    groupId: string,
    newMemberIdentityId: string,
    newMemberSigningPub: string,
    role: GroupRole = 'MEMBER'
  ): { action: GroupAction; distribution: SenderKeyDistributionMessage } {
    this.assertSession(session);

    const state = this.loadGroupState(session, groupId);
    if (!state) throw new Error(`Group ${groupId} not found`);

    const identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) throw new Error('No active Space identity');

    const myIdentityDoc = this.idMgr.getPublicDocument(session, this.store)!;

    const action = GroupStateManager.addMember(
      state,
      myIdentityDoc.identityId,
      identity.signingPrivateKey,
      newMemberIdentityId,
      newMemberSigningPub,
      role
    );

    const senderSession = this.getOrLoadSenderKeySession(session, groupId, state.epoch);
    const distribution = senderSession.exportDistribution(identity.signingPrivateKey);

    this.saveGroupState(session, state);
    this.saveSenderKeySession(session, senderSession);

    return { action, distribution };
  }

  /**
   * Removes a member from a group, advancing the epoch and forcing a fresh SenderKey.
   */
  public removeMember(
    session: SpaceSession,
    groupId: string,
    targetIdentityId: string
  ): { action: GroupAction; distribution: SenderKeyDistributionMessage } {
    this.assertSession(session);

    const state = this.loadGroupState(session, groupId);
    if (!state) throw new Error(`Group ${groupId} not found`);

    const identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) throw new Error('No active Space identity');

    const myIdentityDoc = this.idMgr.getPublicDocument(session, this.store)!;

    const action = GroupStateManager.removeMember(
      state,
      myIdentityDoc.identityId,
      identity.signingPrivateKey,
      targetIdentityId
    );

    // Advance local sender key session to new epoch (resets chain key)
    const senderSession = this.getOrLoadSenderKeySession(session, groupId, state.epoch - 1);
    senderSession.resetOutboundKey(state.epoch);

    const distribution = senderSession.exportDistribution(identity.signingPrivateKey);

    this.saveGroupState(session, state);
    this.saveSenderKeySession(session, senderSession);

    return { action, distribution };
  }

  /**
   * Voluntary departure from group.
   */
  public leaveGroup(
    session: SpaceSession,
    groupId: string
  ): GroupAction {
    this.assertSession(session);

    const state = this.loadGroupState(session, groupId);
    if (!state) throw new Error(`Group ${groupId} not found`);

    const identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) throw new Error('No active Space identity');

    const myIdentityDoc = this.idMgr.getPublicDocument(session, this.store)!;

    const action = GroupStateManager.leaveGroup(
      state,
      myIdentityDoc.identityId,
      identity.signingPrivateKey
    );

    this.saveGroupState(session, state);
    return action;
  }

  /**
   * Receives and processes a peer's SenderKeyDistributionMessage.
   */
  public processSenderKeyDistribution(
    session: SpaceSession,
    dist: SenderKeyDistributionMessage,
    senderSigningPublicKey: Uint8Array | string
  ): void {
    this.assertSession(session);

    const state = this.loadGroupState(session, dist.groupId);
    if (!state) throw new Error(`Group ${dist.groupId} not found`);

    const keyBytes = typeof senderSigningPublicKey === 'string'
      ? base64ToBytes(senderSigningPublicKey)
      : senderSigningPublicKey;

    const senderSession = this.getOrLoadSenderKeySession(session, dist.groupId, state.epoch);
    senderSession.processDistribution(dist, keyBytes);

    this.saveSenderKeySession(session, senderSession);
  }

  /**
   * Exports the current outbound SenderKeyDistributionMessage for a group.
   */
  public exportSenderKeyDistribution(
    session: SpaceSession,
    groupId: string
  ): SenderKeyDistributionMessage | null {
    this.assertSession(session);
    const state = this.loadGroupState(session, groupId);
    if (!state) return null;
    const identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) return null;
    const senderSession = this.getOrLoadSenderKeySession(session, groupId, state.epoch);
    return senderSession.exportDistribution(identity.signingPrivateKey);
  }

  /**
   * Encrypts and logs an outgoing group message.
   */
  public encryptGroupMessage(
    session: SpaceSession,
    groupId: string,
    text: string,
    attachment?: any
  ): { payload: GroupMessagePayload; storedMessage: DecryptedGroupMessage } {
    this.assertSession(session);

    const state = this.loadGroupState(session, groupId);
    if (!state) throw new Error(`Group ${groupId} not found`);

    const identity = this.idMgr.loadIdentity(session, this.store);
    if (!identity) throw new Error('No active Space identity');

    const myIdentityDoc = this.idMgr.getPublicDocument(session, this.store)!;

    const senderSession = this.getOrLoadSenderKeySession(session, groupId, state.epoch);

    const messageData = JSON.stringify({
      text,
      attachment,
      timestamp: Date.now(),
    });

    const payload = senderSession.encryptMessage(messageData, identity.signingPrivateKey);
    this.saveSenderKeySession(session, senderSession);

    const storedMessage: DecryptedGroupMessage = {
      messageId: `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      groupId,
      epoch: state.epoch,
      senderIdentityId: myIdentityDoc.identityId,
      text,
      timestamp: Date.now(),
      isOutgoing: true,
      attachment,
    };

    this.appendMessage(session, groupId, storedMessage);

    return { payload, storedMessage };
  }

  /**
   * Decrypts and stores an incoming group message.
   */
  public decryptGroupMessage(
    session: SpaceSession,
    payload: GroupMessagePayload,
    senderSigningPublicKey: Uint8Array | string
  ): DecryptedGroupMessage {
    this.assertSession(session);

    const groupId = payload.header.groupId;
    const state = this.loadGroupState(session, groupId);
    if (!state) throw new Error(`Group ${groupId} not found`);

    // Verify sender is in group state
    const sender = state.members[payload.header.senderIdentityId];
    if (!sender) {
      throw new Error(`Sender ${payload.header.senderIdentityId} is not a member of group ${groupId}`);
    }

    const keyBytes = typeof senderSigningPublicKey === 'string'
      ? base64ToBytes(senderSigningPublicKey)
      : senderSigningPublicKey;

    const senderSession = this.getOrLoadSenderKeySession(session, groupId, state.epoch);
    const plaintextBytes = senderSession.decryptMessage(payload, keyBytes);
    this.saveSenderKeySession(session, senderSession);

    const parsed = JSON.parse(new TextDecoder().decode(plaintextBytes));

    const storedMessage: DecryptedGroupMessage = {
      messageId: `gmsg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      groupId,
      epoch: payload.header.epoch,
      senderIdentityId: payload.header.senderIdentityId,
      text: parsed.text || '',
      timestamp: parsed.timestamp || Date.now(),
      isOutgoing: false,
      attachment: parsed.attachment,
    };

    this.appendMessage(session, groupId, storedMessage);

    return storedMessage;
  }

  /**
   * Retrieves message history for a group.
   */
  public getGroupMessages(session: SpaceSession, groupId: string): DecryptedGroupMessage[] {
    this.assertSession(session);
    const key = `${GROUP_MESSAGES_PREFIX}${groupId}`;
    const raw = this.store.get<DecryptedGroupMessage[]>(session, key);
    return Array.isArray(raw) ? raw : [];
  }

  public loadGroupState(session: SpaceSession, groupId: string): GroupState | null {
    this.assertSession(session);
    return this.store.get<GroupState>(session, `${GROUP_STATE_PREFIX}${groupId}`);
  }

  public saveGroupState(session: SpaceSession, state: GroupState): void {
    this.assertSession(session);
    this.store.set(session, `${GROUP_STATE_PREFIX}${state.groupId}`, state);
  }

  public getOrLoadSenderKeySession(
    session: SpaceSession,
    groupId: string,
    epoch: number
  ): SenderKeySession {
    this.assertSession(session);
    const cacheKey = `${session.spaceId}:${groupId}`;
    let senderSession = this.activeSessions.get(cacheKey);

    if (!senderSession) {
      const persisted = this.store.get<any>(session, `${SENDERKEY_PREFIX}${groupId}`);
      if (persisted) {
        senderSession = SenderKeySession.deserialize(persisted);
      } else {
        const myIdentityDoc = this.idMgr.getPublicDocument(session, this.store)!;
        senderSession = new SenderKeySession(groupId, epoch, myIdentityDoc.identityId);
      }
      this.activeSessions.set(cacheKey, senderSession);
    }

    if (senderSession.epoch < epoch) {
      senderSession.epoch = epoch;
    }

    return senderSession;

  }

  public saveSenderKeySession(session: SpaceSession, senderSession: SenderKeySession): void {
    this.assertSession(session);
    const cacheKey = `${session.spaceId}:${senderSession.groupId}`;
    this.activeSessions.set(cacheKey, senderSession);
    this.store.set(session, `${SENDERKEY_PREFIX}${senderSession.groupId}`, senderSession.serialize());
  }

  private saveGroupSecret(session: SpaceSession, groupId: string, secret: Uint8Array): void {
    this.store.set(session, `${GROUP_SECRET_PREFIX}${groupId}`, Array.from(secret));
  }

  public loadGroupSecret(session: SpaceSession, groupId: string): Uint8Array | null {
    this.assertSession(session);
    const raw = this.store.get<number[]>(session, `${GROUP_SECRET_PREFIX}${groupId}`);
    return raw ? new Uint8Array(raw) : null;
  }

  private appendMessage(session: SpaceSession, groupId: string, msg: DecryptedGroupMessage): void {
    const messages = this.getGroupMessages(session, groupId);
    messages.push(msg);
    this.store.set(session, `${GROUP_MESSAGES_PREFIX}${groupId}`, messages);
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('GroupManager rejected: Space session is locked or destroyed');
    }
  }
}
