/**
 * Encrypted Attachment Pipeline Types & Wire Boundary for VEIL.
 */

export type AttachmentState =
  | 'QUEUED'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'DOWNLOADING'
  | 'DECRYPTING'
  | 'READY';

export interface AttachmentMetadata {
  attachmentId: string;
  objectId?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  chunkSize: number;
  sha256Hash: string; // Hex hash of plaintext for integrity verification
  ciphertextHash?: string;
  encryptionKeyBase64?: string;
  state?: AttachmentState;
  error?: string;
}

export interface EncryptedAttachmentChunk {
  attachmentId: string;
  chunkIndex: number;
  totalChunks: number;
  ciphertext: string; // Base64
  nonce: string; // Base64
}

export interface AttachmentTransferProgress {
  attachmentId: string;
  transferredChunks: number;
  totalChunks: number;
  percent: number;
}

/**
 * Authoritative, protocol-safe wire representation of an attachment.
 * Stripped of any sender-local memory state (Blob URLs, File instances, DOM state, UI errors).
 */
export interface WireAttachmentPayload {
  attachmentId: string;
  groupId?: string;
  objectId?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  chunkSize: number;
  sha256Hash: string;
  ciphertextHash?: string;
  encryptionKeyBase64: string;
  allowSave?: boolean;
  allowForward?: boolean;
}

/**
 * Local presentation and cache state of an attachment.
 * Contains ephemeral local Blob URLs and fine-grained upload/decrypt progress.
 */
export interface LocalAttachmentPayload {
  attachmentId: string;
  groupId?: string;
  objectId?: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount?: number;
  chunkSize?: number;
  sha256Hash?: string;
  ciphertextHash?: string;
  encryptionKeyBase64?: string;
  previewUrl?: string; // Local preview only
  localPreviewUrl?: string; // Local preview only
  thumbnailUrl?: string; // Local micro-thumbnail only
  state?: AttachmentState;
  error?: string;
  progressPercent?: number;
  allowSave?: boolean;
  allowForward?: boolean;
}

/**
 * Canonical serializer converting local attachment state into a clean, protocol-safe wire payload.
 * EXPLICIT ALLOWLIST ONLY — NEVER SPREADS ...attachment.
 */
export function toWireAttachment(localAttachment: any): WireAttachmentPayload {
  if (!localAttachment || typeof localAttachment !== 'object') {
    throw new Error('Cannot serialize invalid attachment to wire payload');
  }

  const wire: WireAttachmentPayload = {
    attachmentId: String(localAttachment.attachmentId || ''),
    groupId: localAttachment.groupId ? String(localAttachment.groupId) : undefined,
    objectId: localAttachment.objectId ? String(localAttachment.objectId) : undefined,
    name: String(localAttachment.name || 'attachment'),
    mimeType: String(localAttachment.mimeType || 'application/octet-stream'),
    sizeBytes: Number(localAttachment.sizeBytes || 0),
    chunkCount: Number(localAttachment.chunkCount || 1),
    chunkSize: Number(localAttachment.chunkSize || 65536),
    sha256Hash: String(localAttachment.sha256Hash || ''),
    ciphertextHash: localAttachment.ciphertextHash ? String(localAttachment.ciphertextHash) : undefined,
    encryptionKeyBase64: String(localAttachment.encryptionKeyBase64 || ''),
    allowSave: localAttachment.allowSave !== false,
    allowForward: localAttachment.allowForward !== false,
  };

  assertWireSafe(wire, 'wireAttachment');
  return wire;
}

/**
 * Canonical serializer converting local reply reference into a clean, protocol-safe wire reply.
 * EXPLICIT ALLOWLIST ONLY — NEVER SPREADS previewUrl or local state.
 */
export function toWireReplyReference(localReply?: any): { messageId: string; senderName?: string; text: string; attachmentType?: string } | undefined {
  if (!localReply || typeof localReply !== 'object') return undefined;

  const wire = {
    messageId: String(localReply.messageId || ''),
    senderName: localReply.senderName ? String(localReply.senderName) : undefined,
    text: String(localReply.text || ''),
    attachmentType: localReply.attachmentType ? String(localReply.attachmentType) : undefined,
  };

  assertWireSafe(wire, 'wireReply');
  return wire;
}

/**
 * Converts an array of local attachments to an array of wire attachments.
 */
export function toWireAttachments(localAttachments?: any[]): WireAttachmentPayload[] | undefined {
  if (!Array.isArray(localAttachments) || localAttachments.length === 0) return undefined;
  return localAttachments.map((att) => toWireAttachment(att));
}

/**
 * Defensive recursive assertion that guarantees wire payloads contain ZERO local Blob URLs,
 * File/Blob instances, or UI-only preview properties.
 */
export function assertWireSafe(obj: any, path = ''): void {
  if (!obj || typeof obj !== 'object') return;

  if (typeof Blob !== 'undefined' && obj instanceof Blob) {
    throw new Error(`Wire payload violation at ${path || 'root'}: cannot serialize Blob/File instance`);
  }

  for (const [key, val] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;

    if (key === 'previewUrl' || key === 'localPreviewUrl' || key === 'thumbnailUrl') {
      throw new Error(`Wire payload violation at ${currentPath}: ${key} is local-only state and must never cross wire`);
    }

    if (typeof val === 'string' && val.startsWith('blob:')) {
      throw new Error(`Wire payload violation at ${currentPath}: sender blob URL '${val}' cannot cross wire`);
    }

    if (val && typeof val === 'object') {
      assertWireSafe(val, currentPath);
    }
  }
}
