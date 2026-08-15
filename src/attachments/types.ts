/**
 * Encrypted Attachment Pipeline Types for VEIL.
 */

export interface AttachmentMetadata {
  attachmentId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  chunkSize: number;
  sha256Hash: string; // Hex hash of plaintext for integrity verification
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
