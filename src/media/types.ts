/**
 * Encrypted Media Vault Types for VEIL.
 */

export interface MediaMetadata {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  caption?: string;
  thumbnailBase64?: string; // Optional Base64 thumbnail
}

export interface EncryptedMediaChunk {
  chunkIndex: number;
  totalChunks: number;
  nonce: string;       // Base64 24-byte nonce
  ciphertext: string;  // Base64 ciphertext + Poly1305 tag
}

export interface EncryptedMediaPackage {
  mediaId: string;
  mediaKey: string;             // Base64 32-byte symmetric key (ONLY in E2EE descriptor)
  plaintextDigest: string;      // Hex SHA-256 of original unencrypted media
  encryptedMetadata: string;    // Base64 encrypted MediaMetadata
  metadataNonce: string;        // Base64 nonce for metadata
  totalSize: number;
  chunkCount: number;
  chunkSize: number;
  chunks: EncryptedMediaChunk[];
}

export interface EncryptedMediaAttachment {
  mediaId: string;
  mediaKey: string;             // Base64 32-byte key
  plaintextDigest: string;      // Hex SHA-256
  encryptedMetadata: string;    // Base64 encrypted metadata
  metadataNonce: string;        // Base64 nonce
  totalSize: number;
  chunkCount: number;
  chunkSize: number;
}

export interface MediaUploadRequest {
  mediaId: string;
  chunks: EncryptedMediaChunk[];
  capabilityToken: string;
}

export interface MediaDownloadResponse {
  mediaId: string;
  chunks: EncryptedMediaChunk[];
}
