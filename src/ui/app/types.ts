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
    name: string;
    sizeBytes: number;
    mimeType: string;
  };
}

export type ActiveModal =
  | { type: 'createSpace' }
  | { type: 'newChat' }
  | { type: 'newGroup' }
  | { type: 'groupDetails'; conversationId: string }
  | { type: 'contactDetails'; conversationId: string }
  | { type: 'settings' }
  | { type: 'panicLock' }
  | null;
