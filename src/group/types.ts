/**
 * Group Messaging Types & Data Models for VEIL.
 */

export type GroupRole = 'CREATOR' | 'ADMIN' | 'MEMBER';

export type GroupActionType =
  | 'CREATE_GROUP'
  | 'ADD_MEMBER'
  | 'REMOVE_MEMBER'
  | 'LEAVE_GROUP'
  | 'UPDATE_ROLE'
  | 'UPDATE_METADATA';

export interface GroupMetadata {
  name: string;
  description?: string;
  avatarUrl?: string;
}

export interface GroupMember {
  identityId: string;
  signingPublicKey: string; // Base64 Ed25519 public key
  role: GroupRole;
  joinedAtEpoch: number;
  addedBy: string;
  username?: string;
  displayName?: string;
  joinedAt?: number;
  mailboxId?: string;
}

export interface GroupAction {
  actionId: string;
  groupId: string;
  epoch: number;
  actionType: GroupActionType;
  actorIdentityId: string;
  targetIdentityId?: string;
  newRole?: GroupRole;
  encryptedMetadataPayload?: string; // Base64 ciphertext if updating metadata
  timestamp: number;
  signature: string; // Base64 Ed25519 signature by actor
}

export interface GroupState {
  groupId: string;
  version: 1;
  epoch: number;
  creatorIdentityId: string;
  encryptedMetadata: string; // Base64 encrypted metadata
  metadataNonce: string;    // Base64 nonce
  members: Record<string, GroupMember>;
  actionHistory: GroupAction[];
  updatedAt: number;
}

export interface SenderKeyDistributionMessage {
  groupId: string;
  epoch: number;
  senderIdentityId: string;
  chainKey: string;     // Base64 32-byte chain key
  sequenceNum: number;  // Current sequence index
  signature: string;    // Base64 Ed25519 signature of the distribution
}

export interface GroupMessageHeader {
  version: 1;
  groupId: string;
  epoch: number;
  senderIdentityId: string;
  sequenceNum: number;
  signature: string; // Base64 Ed25519 signature over (header AAD + ciphertext)
}

export interface GroupMessagePayload {
  header: GroupMessageHeader;
  nonce: string;       // Base64 24-byte nonce
  ciphertext: string;  // Base64 ciphertext + Poly1305 auth tag
}

export interface DecryptedGroupMessage {
  messageId: string;
  groupId: string;
  epoch: number;
  senderIdentityId: string;
  text: string;
  timestamp: number;
  isOutgoing: boolean;
  attachment?: any;
}
