/**
 * 1-to-1 Conversation Manager for VEIL.
 *
 * Orchestrates End-to-End Encrypted messaging between Spaces:
 * - Asynchronous session establishment via X3DH & PrekeyBundles.
 * - Outgoing message encryption via DoubleRatchetSession -> TransportClient.
 * - Incoming message decryption, deduplication, and local encrypted history persistence.
 */

import { initiateX3DH, receiveX3DH } from '../ratchet/x3dh.ts';
import { DoubleRatchetSession } from '../ratchet/ratchet.ts';
import { PrekeyManager } from '../ratchet/prekeys.ts';
import { PrekeyBundle, RatchetMessage } from '../ratchet/types.ts';
import { RatchetSessionStore } from './sessionStore.ts';
import { TransportClient } from '../transport/client.ts';
import { createTransportEnvelope } from '../transport/envelope.ts';
import { padPayload, unpadPayload } from '../transport/padding.ts';
import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import { SpaceIdentityManager } from '../identity/manager.ts';
import { IdentityDocument } from '../identity/document.ts';

export type MessageDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read';

export interface StoredMessage {
  messageId: string;
  conversationId: string;
  senderIdentityId: string;
  recipientIdentityId: string;
  text: string;
  isOutgoing: boolean;
  timestamp: number;
  status: MessageDeliveryStatus;
}

const MESSAGE_HISTORY_PREFIX = 'veil:messages:conv:';

export class ConversationManager {
  private store: EncryptedSpaceStore;
  private idMgr: SpaceIdentityManager;
  private prekeyMgr: PrekeyManager;
  private sessionStore: RatchetSessionStore;
  private transportClient?: TransportClient;

  constructor(
    store: EncryptedSpaceStore,
    idMgr: SpaceIdentityManager,
    prekeyMgr: PrekeyManager,
    transportClient?: TransportClient
  ) {
    this.store = store;
    this.idMgr = idMgr;
    this.prekeyMgr = prekeyMgr;
    this.sessionStore = new RatchetSessionStore(store);
    this.transportClient = transportClient;
  }

  /**
   * Initiates an asynchronous 1-to-1 conversation with a peer using their PrekeyBundle.
   */
  public establishSession(
    session: SpaceSession,
    peerBundle: PrekeyBundle
  ): DoubleRatchetSession {
    this.assertSession(session);

    const myIdentity = this.idMgr.loadIdentity(session, this.store);
    if (!myIdentity) {
      throw new Error('Cannot establish session: current Space has no identity');
    }

    const peerDoc = peerBundle.identityDocument;

    // 1. Run X3DH initiator key agreement
    const { sharedMasterKey, header, ephemeralKeypair } = initiateX3DH(
      myIdentity.keyAgreementPrivateKey,
      peerBundle
    );

    // 2. Initialize Alice's Double Ratchet
    const peerRatchetPub = base64ToBytes(peerBundle.signedPrekey.publicKey);
    const ratchetSession = DoubleRatchetSession.initAlice(
      `sess_${Date.now()}_${peerDoc.identityId.slice(0, 8)}`,
      peerDoc.identityId,
      peerDoc.signingPublicKey,
      peerDoc.keyAgreementPublicKey,
      sharedMasterKey,
      peerRatchetPub
    );

    // 3. Save initial session state
    this.sessionStore.saveSession(session, ratchetSession);

    return ratchetSession;
  }

  /**
   * Sends an encrypted 1-to-1 message to a peer over the untrusted transport layer.
   */
  public async sendMessage(
    session: SpaceSession,
    peerBundle: PrekeyBundle,
    recipientMailboxId: string,
    text: string
  ): Promise<StoredMessage> {
    this.assertSession(session);

    const peerId = peerBundle.identityDocument.identityId;
    let ratchetSession = this.sessionStore.loadSession(session, peerId);
    let x3dhHeader = undefined;

    // If no existing session, establish new session via X3DH
    if (!ratchetSession) {
      const myIdentity = this.idMgr.loadIdentity(session, this.store);
      if (!myIdentity) throw new Error('Cannot send message: no Space identity');

      const x3dhRes = initiateX3DH(myIdentity.keyAgreementPrivateKey, peerBundle);
      x3dhHeader = x3dhRes.header;

      const peerRatchetPub = base64ToBytes(peerBundle.signedPrekey.publicKey);
      ratchetSession = DoubleRatchetSession.initAlice(
        `sess_${Date.now()}_${peerId.slice(0, 8)}`,
        peerId,
        peerBundle.identityDocument.signingPublicKey,
        peerBundle.identityDocument.keyAgreementPublicKey,
        x3dhRes.sharedMasterKey,
        peerRatchetPub
      );
    }

    // 1. Encrypt plaintext through Double Ratchet
    const ratchetMsg = ratchetSession.ratchetEncrypt(text, x3dhHeader);

    // 2. Package into size-normalized TransportEnvelope
    const jsonBytes = new TextEncoder().encode(JSON.stringify(ratchetMsg));
    const { padded, sizeClass } = padPayload(jsonBytes);

    const transportEnvelope = createTransportEnvelope({
      mailboxId: recipientMailboxId,
      payload: bytesToBase64(padded),
      sizeClass,
    });

    // 3. Persist updated ratchet session state
    this.sessionStore.saveSession(session, ratchetSession);

    // 4. Send via TransportClient if configured (queues in outbox and flushes)
    if (this.transportClient) {
      await this.transportClient.sendEnvelope(session, transportEnvelope, recipientMailboxId);
    }

    // 5. Store in local encrypted message history
    const storedMsg: StoredMessage = {
      messageId: transportEnvelope.envelopeId,
      conversationId: peerId,
      senderIdentityId: this.idMgr.getPublicDocument(session, this.store)!.identityId,
      recipientIdentityId: peerId,
      text,
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'sent',
    };
    this.appendMessage(session, peerId, storedMsg);

    return storedMsg;
  }

  /**
   * Processes and decrypts an incoming transport payload into the Space's message history.
   */
  public receiveMessage(
    session: SpaceSession,
    senderIdentityDoc: IdentityDocument,
    rawPayloadBase64: string
  ): StoredMessage {
    this.assertSession(session);

    // 1. Unpad transport bytes
    const paddedBytes = base64ToBytes(rawPayloadBase64);
    const unpaddedBytes = unpadPayload(paddedBytes);
    const ratchetMsg: RatchetMessage = JSON.parse(new TextDecoder().decode(unpaddedBytes));

    const senderId = senderIdentityDoc.identityId;
    let ratchetSession = this.sessionStore.loadSession(session, senderId);
    let plaintextBytes: Uint8Array | null = null;

    if (ratchetSession) {
      try {
        plaintextBytes = ratchetSession.ratchetDecrypt(ratchetMsg);
      } catch (err) {
        if (ratchetMsg.header.x3dhHeader) {
          ratchetSession = null;
        } else {
          throw err;
        }
      }
    }

    // 2. If no session exists (or decryption failed) and message contains X3DH header, initialize Bob's session
    if (!ratchetSession) {
      if (!ratchetMsg.header.x3dhHeader) {
        throw new Error('Cannot receive message: no session exists and message lacks X3DH header');
      }

      const myIdentity = this.idMgr.loadIdentity(session, this.store);
      if (!myIdentity) throw new Error('Cannot receive message: Space has no identity');

      const spkPriv = this.prekeyMgr.getSignedPrekeyPrivate(
        session,
        ratchetMsg.header.x3dhHeader.signedPrekeyId
      );
      if (!spkPriv) {
        throw new Error(`Signed prekey ${ratchetMsg.header.x3dhHeader.signedPrekeyId} not found`);
      }

      let opkPriv: Uint8Array | null = null;
      if (ratchetMsg.header.x3dhHeader.oneTimePrekeyId !== undefined) {
        opkPriv = this.prekeyMgr.consumeOneTimePrekey(
          session,
          ratchetMsg.header.x3dhHeader.oneTimePrekeyId
        );
      }

      const senderIdentityPub = base64ToBytes(senderIdentityDoc.keyAgreementPublicKey);
      const sharedMasterKey = receiveX3DH(
        myIdentity.keyAgreementPrivateKey,
        spkPriv,
        opkPriv,
        senderIdentityPub,
        ratchetMsg.header.x3dhHeader
      );

      // Initialize Bob's Double Ratchet with Bob's SPK keypair
      const spkKeypair = {
        privateKey: spkPriv,
        publicKey: base64ToBytes(this.prekeyMgr.getSignedPrekeyPublic(session)!.publicKey),
      };

      ratchetSession = DoubleRatchetSession.initBob(
        `sess_${Date.now()}_${senderId.slice(0, 8)}`,
        senderId,
        senderIdentityDoc.signingPublicKey,
        senderIdentityDoc.keyAgreementPublicKey,
        sharedMasterKey,
        spkKeypair
      );

      plaintextBytes = ratchetSession.ratchetDecrypt(ratchetMsg);
    }

    if (!plaintextBytes) {
      throw new Error('Failed to decrypt ratchet message');
    }

    // 3. Decrypt through Double Ratchet
    const text = new TextDecoder().decode(plaintextBytes);

    // 4. Save updated session state
    this.sessionStore.saveSession(session, ratchetSession);

    // 5. Append to encrypted local conversation history
    const storedMsg: StoredMessage = {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      conversationId: senderId,
      senderIdentityId: senderId,
      recipientIdentityId: this.idMgr.getPublicDocument(session, this.store)!.identityId,
      text,
      isOutgoing: false,
      timestamp: Date.now(),
      status: 'delivered',
    };
    this.appendMessage(session, senderId, storedMsg);

    return storedMsg;
  }

  /**
   * Encrypts a message using Double Ratchet and packages it into a size-padded wire payload.
   */
  public async encryptAndPackWireMessage(
    session: SpaceSession,
    peerBundle: PrekeyBundle,
    text: string,
    attachment?: {
      attachmentId?: string;
      name: string;
      sizeBytes: number;
      mimeType: string;
      objectId?: string;
      ciphertextHash?: string;
      chunkCount?: number;
      chunkSize?: number;
      sha256Hash?: string;
      encryptionKeyBase64?: string;
    },
    replyTo?: { messageId: string; senderName?: string; text: string; attachmentType?: string },
    voice?: { durationSeconds: number; sizeBytes: number; objectId: string; mimeType: string; ciphertextHash: string; encryptionKeyBase64: string; nonceBase64: string }
  ): Promise<{ wirePayloadBase64: string; deliveryId: string; storedMessage: StoredMessage }> {
    this.assertSession(session);

    const peerId = peerBundle.identityDocument.identityId;
    let ratchetSession = this.sessionStore.loadSession(session, peerId);
    let x3dhHeader = undefined;

    const myIdentity = this.idMgr.loadIdentity(session, this.store);
    if (!myIdentity) throw new Error('Cannot send message: no Space identity');
    const myDoc = this.idMgr.getPublicDocument(session, this.store)!;

    // If no existing session, establish new session via X3DH
    if (!ratchetSession) {
      const x3dhRes = initiateX3DH(myIdentity.keyAgreementPrivateKey, peerBundle);
      x3dhHeader = x3dhRes.header;

      const peerRatchetPub = base64ToBytes(peerBundle.signedPrekey.publicKey);
      ratchetSession = DoubleRatchetSession.initAlice(
        `sess_${Date.now()}_${peerId.slice(0, 8)}`,
        peerId,
        peerBundle.identityDocument.signingPublicKey,
        peerBundle.identityDocument.keyAgreementPublicKey,
        x3dhRes.sharedMasterKey,
        peerRatchetPub
      );
    }

    // 1. Encrypt plaintext through Double Ratchet
    const ratchetMsg = ratchetSession.ratchetEncrypt(text, x3dhHeader);
    const deliveryId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 2. Package into WirePayload
    const binding = this.store.get<{ mailboxId: string }>(session, 'net_mailbox_binding');
    const wireObj = {
      version: 1 as const,
      deliveryId,
      senderIdentityId: myDoc.identityId,
      senderDocument: myDoc,
      senderMailboxId: binding?.mailboxId,
      ratchetMessage: ratchetMsg,
      attachment,
      replyTo,
      voice,
    };

    // 3. Size-normalize & Pad
    const jsonBytes = new TextEncoder().encode(JSON.stringify(wireObj));
    const { padded } = padPayload(jsonBytes);
    const wirePayloadBase64 = bytesToBase64(padded);

    // 4. Save updated ratchet session state
    this.sessionStore.saveSession(session, ratchetSession);

    // 5. Save in local message history
    const storedMessage: StoredMessage = {
      messageId: deliveryId,
      conversationId: peerId,
      senderIdentityId: myDoc.identityId,
      recipientIdentityId: peerId,
      text,
      isOutgoing: true,
      timestamp: Date.now(),
      status: 'sent',
    };
    this.appendMessage(session, peerId, storedMessage);

    return { wirePayloadBase64, deliveryId, storedMessage };
  }

  /**
   * Processes, decrypts, and persists an incoming wire payload from a peer.
   */
  public async processInboundWirePayload(
    session: SpaceSession,
    rawPayloadBase64: string
  ): Promise<{
    storedMessage: StoredMessage;
    senderDoc: IdentityDocument;
    senderMailboxId?: string;
    attachment?: any;
    replyTo?: any;
    voice?: any;
  }> {
    this.assertSession(session);

    let wireObj: any;
    try {
      // 1. Unpad transport bytes
      const paddedBytes = base64ToBytes(rawPayloadBase64);
      const unpaddedBytes = unpadPayload(paddedBytes);
      wireObj = JSON.parse(new TextDecoder().decode(unpaddedBytes));
    } catch (_e) {
      // Fallback if raw JSON
      try {
        wireObj = JSON.parse(rawPayloadBase64);
      } catch (err) {
        throw new Error('Failed to decode incoming wire payload');
      }
    }

    if (!wireObj || !wireObj.ratchetMessage || !wireObj.senderDocument) {
      throw new Error('Malformed wire payload: missing required E2EE fields');
    }

    const senderDoc: IdentityDocument = wireObj.senderDocument;
    const senderId = senderDoc.identityId;
    const ratchetMsg: RatchetMessage = wireObj.ratchetMessage;

    let ratchetSession = this.sessionStore.loadSession(session, senderId);
    let plaintextBytes: Uint8Array | null = null;

    if (ratchetSession) {
      try {
        plaintextBytes = ratchetSession.ratchetDecrypt(ratchetMsg);
      } catch (err) {
        if (ratchetMsg.header.x3dhHeader) {
          ratchetSession = null;
        } else {
          throw err;
        }
      }
    }

    // 2. If no session exists (or decryption failed) and message contains X3DH header, initialize Bob's session
    if (!ratchetSession) {
      if (!ratchetMsg.header.x3dhHeader) {
        throw new Error('Cannot receive message: no session exists and message lacks X3DH header');
      }

      const myIdentity = this.idMgr.loadIdentity(session, this.store);
      if (!myIdentity) throw new Error('Cannot receive message: Space has no identity');

      const spkPriv = this.prekeyMgr.getSignedPrekeyPrivate(
        session,
        ratchetMsg.header.x3dhHeader.signedPrekeyId
      );
      if (!spkPriv) {
        throw new Error(`Signed prekey ${ratchetMsg.header.x3dhHeader.signedPrekeyId} not found`);
      }

      let opkPriv: Uint8Array | null = null;
      if (ratchetMsg.header.x3dhHeader.oneTimePrekeyId !== undefined) {
        opkPriv = this.prekeyMgr.consumeOneTimePrekey(
          session,
          ratchetMsg.header.x3dhHeader.oneTimePrekeyId
        );
      }

      const senderIdentityPub = base64ToBytes(senderDoc.keyAgreementPublicKey);
      const sharedMasterKey = receiveX3DH(
        myIdentity.keyAgreementPrivateKey,
        spkPriv,
        opkPriv,
        senderIdentityPub,
        ratchetMsg.header.x3dhHeader
      );

      // Initialize Bob's Double Ratchet with Bob's SPK keypair
      const spkKeypair = {
        privateKey: spkPriv,
        publicKey: base64ToBytes(this.prekeyMgr.getSignedPrekeyPublic(session)!.publicKey),
      };

      ratchetSession = DoubleRatchetSession.initBob(
        `sess_${Date.now()}_${senderId.slice(0, 8)}`,
        senderId,
        senderDoc.signingPublicKey,
        senderDoc.keyAgreementPublicKey,
        sharedMasterKey,
        spkKeypair
      );

      plaintextBytes = ratchetSession.ratchetDecrypt(ratchetMsg);
    }

    if (!plaintextBytes) {
      throw new Error('Failed to decrypt ratchet message');
    }

    // 3. Decrypt through Double Ratchet
    const text = new TextDecoder().decode(plaintextBytes);

    // 4. Save updated session state
    this.sessionStore.saveSession(session, ratchetSession);

    // 5. Append to encrypted local conversation history
    const deliveryId = wireObj.deliveryId || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const myDoc = this.idMgr.getPublicDocument(session, this.store);
    const storedMessage: StoredMessage = {
      messageId: deliveryId,
      conversationId: senderId,
      senderIdentityId: senderId,
      recipientIdentityId: myDoc?.identityId || 'local_user',
      text,
      isOutgoing: false,
      timestamp: Date.now(),
      status: 'delivered',
    };
    this.appendMessage(session, senderId, storedMessage);

    return {
      storedMessage,
      senderDoc,
      senderMailboxId: wireObj.senderMailboxId,
      attachment: wireObj.attachment,
      replyTo: wireObj.replyTo,
      voice: wireObj.voice,
    };
  }

  /**
   * Retrieves message history for a conversation from the Space's encrypted store.
   */
  public getMessages(session: SpaceSession, conversationId: string): StoredMessage[] {
    this.assertSession(session);
    const key = `${MESSAGE_HISTORY_PREFIX}${conversationId}`;
    const raw = this.store.get<StoredMessage[]>(session, key);
    return Array.isArray(raw) ? raw : [];
  }

  private appendMessage(session: SpaceSession, conversationId: string, msg: StoredMessage): void {
    const messages = this.getMessages(session, conversationId);
    messages.push(msg);
    const key = `${MESSAGE_HISTORY_PREFIX}${conversationId}`;
    this.store.set(session, key, messages);
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('ConversationManager rejected: Space session is locked or destroyed');
    }
  }
}
