/**
 * Encrypted Attachment Pipeline Types for VEIL.
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
