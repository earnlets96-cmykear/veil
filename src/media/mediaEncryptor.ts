/**
 * Client-Side Symmetric Media Encryption for VEIL.
 *
 * Implements chunked authenticated encryption with XChaCha20-Poly1305,
 * random per-media symmetric keys, AAD chunk binding, and SHA-256 integrity verification.
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import { bytesToBase64, base64ToBytes, bytesToHex, getRandomBytes } from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import {
  MediaMetadata,
  EncryptedMediaChunk,
  EncryptedMediaPackage,
  EncryptedMediaAttachment,
} from './types.ts';

export const DEFAULT_MEDIA_CHUNK_SIZE = 64 * 1024; // 64 KiB

export class MediaEncryptor {
  /**
   * Encrypts a media file into authenticated chunks and an encrypted metadata package.
   */
  public static encryptMedia(
    plaintext: Uint8Array,
    metadata: MediaMetadata,
    customKey?: Uint8Array,
    chunkSize = DEFAULT_MEDIA_CHUNK_SIZE
  ): EncryptedMediaPackage {
    const mediaKey = customKey ? new Uint8Array(customKey) : getRandomBytes(32);
    const mediaId = `med_${bytesToBase64(getRandomBytes(16)).replace(/[+/=]/g, '').slice(0, 24)}`;

    // 1. Calculate unencrypted plaintext SHA-256 digest
    const digestBytes = sha256(plaintext);
    const plaintextDigest = bytesToHex(digestBytes);

    // 2. Partition plaintext into chunks
    const totalSize = plaintext.length;
    const chunkCount = Math.max(1, Math.ceil(totalSize / chunkSize));
    const chunks: EncryptedMediaChunk[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunkBytes = plaintext.slice(start, end);

      const aad = new TextEncoder().encode(
        JSON.stringify({
          mediaId,
          chunkIndex: i,
          totalChunks: chunkCount,
          isLast: i === chunkCount - 1,
        })
      );

      const { nonce, ciphertext } = encryptXChaCha20Poly1305(mediaKey, chunkBytes, aad);

      chunks.push({
        chunkIndex: i,
        totalChunks: chunkCount,
        nonce: bytesToBase64(nonce),
        ciphertext: bytesToBase64(ciphertext),
      });
    }

    // 3. Encrypt MediaMetadata
    const metadataJson = JSON.stringify(metadata);
    const metaAad = new TextEncoder().encode(JSON.stringify({ mediaId, type: 'metadata' }));
    const { nonce: metaNonce, ciphertext: metaCipher } = encryptXChaCha20Poly1305(
      mediaKey,
      metadataJson,
      metaAad
    );

    return {
      mediaId,
      mediaKey: bytesToBase64(mediaKey),
      plaintextDigest,
      encryptedMetadata: bytesToBase64(metaCipher),
      metadataNonce: bytesToBase64(metaNonce),
      totalSize,
      chunkCount,
      chunkSize,
      chunks,
    };
  }

  /**
   * Verifies chunk integrity, reassembles chunks, and decrypts the media payload.
   */
  public static decryptMedia(
    attachment: EncryptedMediaAttachment,
    chunks: EncryptedMediaChunk[]
  ): { plaintext: Uint8Array; metadata: MediaMetadata } {
    if (!chunks || chunks.length !== attachment.chunkCount) {
      throw new Error(`Chunk count mismatch: expected ${attachment.chunkCount}, got ${chunks?.length}`);
    }

    // 1. Verify chunk order and indices
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].chunkIndex !== i) {
        throw new Error(`Chunk reordering or missing chunk detected at index ${i} (got chunk ${chunks[i].chunkIndex})`);
      }
      if (chunks[i].totalChunks !== attachment.chunkCount) {
        throw new Error(`Chunk totalChunks mismatch in chunk ${i}`);
      }
    }

    const mediaKey = base64ToBytes(attachment.mediaKey);

    try {
      // 2. Decrypt each chunk with AAD verification
      const decryptedChunks: Uint8Array[] = [];
      let totalDecryptedLength = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const aad = new TextEncoder().encode(
          JSON.stringify({
            mediaId: attachment.mediaId,
            chunkIndex: i,
            totalChunks: attachment.chunkCount,
            isLast: i === attachment.chunkCount - 1,
          })
        );

        const nonceBytes = base64ToBytes(chunk.nonce);
        const cipherBytes = base64ToBytes(chunk.ciphertext);

        const chunkPlaintext = decryptXChaCha20Poly1305(mediaKey, nonceBytes, cipherBytes, aad);
        decryptedChunks.push(chunkPlaintext);
        totalDecryptedLength += chunkPlaintext.length;
      }

      // 3. Assemble combined plaintext
      const combinedPlaintext = new Uint8Array(totalDecryptedLength);
      let offset = 0;
      for (const piece of decryptedChunks) {
        combinedPlaintext.set(piece, offset);
        offset += piece.length;
      }

      // 4. Verify SHA-256 digest
      const actualDigestHex = bytesToHex(sha256(combinedPlaintext));
      if (actualDigestHex !== attachment.plaintextDigest) {
        throw new Error(`Media digest verification failed: expected ${attachment.plaintextDigest}, computed ${actualDigestHex}`);
      }

      // 5. Decrypt metadata
      const metaAad = new TextEncoder().encode(JSON.stringify({ mediaId: attachment.mediaId, type: 'metadata' }));
      const metaNonceBytes = base64ToBytes(attachment.metadataNonce);
      const metaCipherBytes = base64ToBytes(attachment.encryptedMetadata);
      const metaPlaintextBytes = decryptXChaCha20Poly1305(mediaKey, metaNonceBytes, metaCipherBytes, metaAad);
      const metadata = JSON.parse(new TextDecoder().decode(metaPlaintextBytes)) as MediaMetadata;

      return { plaintext: combinedPlaintext, metadata };
    } finally {
      zeroize(mediaKey);
    }
  }
}
