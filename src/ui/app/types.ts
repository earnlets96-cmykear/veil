/**
 * UI State and View Models for VEIL React Application.
 */

import { IdentityDocument } from '../../identity/document.ts';
import { GroupState } from '../../group/types.ts';
import { DeliveryStatus } from '../../network/types.ts';

export interface UIConversation {
  id: string; // Peer identity ID or Group ID
  type: 'direct' | 'group';
  name: string;
  avatarSeed: string;
  avatar?: string;
  fingerprint?: string;
  isVerified?: boolean;
  lastMessage?: string;
  timestamp?: number;
  unreadCount: number;
  peerDoc?: IdentityDocument;
  groupState?: GroupState;
}

export interface UIMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  text: string;
  isOutgoing: boolean;
  timestamp: number;
  status: DeliveryStatus;
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
    previewUrl?: string;
    localPreviewUrl?: string;
    state?: string;
    error?: string;
    allowSave?: boolean;
    allowForward?: boolean;
  };
  attachments?: Array<{
    attachmentId: string;
    name: string;
    sizeBytes: number;
    mimeType: string;
    objectId?: string;
    ciphertextHash?: string;
    chunkCount?: number;
    chunkSize?: number;
    sha256Hash?: string;
    encryptionKeyBase64?: string;
    previewUrl?: string;
    localPreviewUrl?: string;
    state?: string;
    error?: string;
    allowSave?: boolean;
    allowForward?: boolean;
  }>;
  voice?: {
    durationSeconds: number;
    sizeBytes: number;
    objectId: string;
    mimeType: string;
    ciphertextHash: string;
    encryptionKeyBase64: string;
    nonceBase64: string;
  };
  replyTo?: ReplyReference;
  privacy?: {
    allowSave?: boolean;
    allowForward?: boolean;
  };
}

export interface ReplyReference {
  messageId: string;
  senderName?: string;
  text: string;
  attachmentType?: 'image' | 'video' | 'file' | 'voice' | 'grouped' | string;
  thumbnailUrl?: string;
}

import { DirectorySearchResult } from '../../server/types.ts';

export interface UserPrivacySettings {
  phoneVisibility: 'nobody' | 'contacts' | 'everyone';
  profileVisibility: 'nobody' | 'contacts' | 'everyone';
  lastSeenVisibility?: 'nobody' | 'contacts' | 'everyone';
  readReceiptsEnabled?: boolean;
  phoneNumber?: string;
  bio?: string;
  avatar?: string;
}

export type ActiveModal =
  | { type: 'createSpace' }
  | { type: 'restoreAccount' }
  | { type: 'accountSettings' }
  | { type: 'newChat' }
  | { type: 'newGroup' }
  | { type: 'groupDetails'; conversationId: string }
  | { type: 'contactDetails'; conversationId: string }
  | { type: 'contactRequests' }
  | { type: 'findUser' }
  | { type: 'settings' }
  | { type: 'profile'; peerId?: string; peerUsername?: string; searchResult?: DirectorySearchResult }
  | { type: 'panicLock' }
  | null;
