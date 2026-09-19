/**
 * Web Worker for CPU-heavy media transformations in VEIL.
 *
 * Runs attachment hashing, chunked XChaCha20-Poly1305 encryption/decryption,
 * and Base64 serialization off the main UI thread to prevent UI freezing
 * during large media send/view operations.
 *
 * SECURITY & ARCHITECTURE:
 * - RAM-only processing. No persistent storage (no IndexedDB, no localStorage).
 * - Transferable ArrayBuffer used for zero-copy memory transfer where applicable.
 * - Secret key buffers are zeroized upon operation completion.
 * - Exact same cryptographic algorithms, AAD format, and wire structure as main thread.
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import {
  randomBytes,
  bytesToBase64,
  base64ToBytes,
  bytesToHex,
} from '../crypto/utils.ts';
import { zeroize } from '../crypto/memory.ts';
import { AttachmentMetadata, EncryptedAttachmentChunk } from './types.ts';
import { getOptimalChunkSize } from './attachmentPipeline.ts';

const cancelledRequests = new Set<string>();

self.onmessage = async (event: MessageEvent) => {
  const { type, requestId, payload } = event.data;

  if (type === 'CANCEL') {
    if (requestId) {
      cancelledRequests.add(requestId);
    }
    return;
  }

  if (!requestId) return;

  try {
    if (cancelledRequests.has(requestId)) {
      cancelledRequests.delete(requestId);
      return;
    }

    switch (type) {
      case 'CHUNK_AND_ENCRYPT': {
        const { data, name, mimeType, encryptionKey: keyRaw, chunkSize, existingAttachmentId } = payload;
        const key = new Uint8Array(keyRaw);
        const dataBytes = new Uint8Array(data);
        const attachmentId = existingAttachmentId || `att_${bytesToHex(randomBytes(8))}`;
        const totalBytes = dataBytes.length;
        const effectiveChunkSize = chunkSize || getOptimalChunkSize(totalBytes);
        const chunkCount = Math.max(1, Math.ceil(totalBytes / effectiveChunkSize));
        const fullHash = bytesToHex(sha256(dataBytes));

        const metadata: AttachmentMetadata = {
          attachmentId,
          name,
          mimeType,
          sizeBytes: totalBytes,
          chunkCount,
          chunkSize: effectiveChunkSize,
          sha256Hash: fullHash,
        };

        const chunks: EncryptedAttachmentChunk[] = [];

        for (let i = 0; i < chunkCount; i++) {
          if (cancelledRequests.has(requestId)) {
            cancelledRequests.delete(requestId);
            zeroize(key);
            return;
          }

          const start = i * effectiveChunkSize;
          const end = Math.min(start + effectiveChunkSize, totalBytes);
          const slice = dataBytes.subarray(start, end);

          const aad = new TextEncoder().encode(`${attachmentId}:${i}:${chunkCount}`);
          const encResult = encryptXChaCha20Poly1305(key, slice, aad);

          chunks.push({
            attachmentId,
            chunkIndex: i,
            totalChunks: chunkCount,
            ciphertext: bytesToBase64(encResult.ciphertext),
            nonce: bytesToBase64(encResult.nonce),
          });
        }

        zeroize(key);

        (self as any).postMessage({
          type: 'SUCCESS',
          requestId,
          result: { metadata, chunks },
        });
        break;
      }

      case 'DECRYPT_AND_REASSEMBLE': {
        const { metadata, chunks, encryptionKey: keyRaw } = payload;
        const key = new Uint8Array(keyRaw);

        if (chunks.length !== metadata.chunkCount) {
          throw new Error(`Incomplete attachment: expected ${metadata.chunkCount} chunks, got ${chunks.length}`);
        }

        const sorted: EncryptedAttachmentChunk[] = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
        const decryptedSlices: Uint8Array[] = [];
        let totalSize = 0;

        for (let i = 0; i < sorted.length; i++) {
          if (cancelledRequests.has(requestId)) {
            cancelledRequests.delete(requestId);
            zeroize(key);
            return;
          }

          const chunk = sorted[i];
          if (chunk.chunkIndex !== i) {
            throw new Error(`Missing chunk at index ${i}`);
          }

          const nonce = base64ToBytes(chunk.nonce);
          const ciphertext = base64ToBytes(chunk.ciphertext);
          const aad = new TextEncoder().encode(`${metadata.attachmentId}:${i}:${metadata.chunkCount}`);

          const plaintext = decryptXChaCha20Poly1305(key, nonce, ciphertext, aad);
          decryptedSlices.push(plaintext);
          totalSize += plaintext.length;
        }

        zeroize(key);

        const assembled = new Uint8Array(totalSize);
        let offset = 0;
        for (const slice of decryptedSlices) {
          assembled.set(slice, offset);
          offset += slice.length;
        }

        const calculatedHash = bytesToHex(sha256(assembled));
        if (calculatedHash !== metadata.sha256Hash) {
          throw new Error('Attachment integrity check failed: SHA-256 hash mismatch');
        }

        // Transfer the assembled buffer back to main thread (zero-copy)
        (self as any).postMessage(
          {
            type: 'SUCCESS',
            requestId,
            result: assembled.buffer,
          },
          [assembled.buffer]
        );
        break;
      }

      case 'DECRYPT_PROGRESSIVE': {
        const { metadata, chunks, encryptionKey: keyRaw } = payload;
        const key = new Uint8Array(keyRaw);

        if (chunks.length !== metadata.chunkCount) {
          throw new Error(`Incomplete attachment: expected ${metadata.chunkCount} chunks, got ${chunks.length}`);
        }

        const sorted: EncryptedAttachmentChunk[] = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
        const decryptedSlices: Uint8Array[] = [];
        let totalSize = 0;

        for (let i = 0; i < sorted.length; i++) {
          if (cancelledRequests.has(requestId)) {
            cancelledRequests.delete(requestId);
            zeroize(key);
            return;
          }

          const chunk = sorted[i];
          if (chunk.chunkIndex !== i) {
            throw new Error(`Missing chunk at index ${i}`);
          }

          const nonce = base64ToBytes(chunk.nonce);
          const ciphertext = base64ToBytes(chunk.ciphertext);
          const aad = new TextEncoder().encode(`${metadata.attachmentId}:${i}:${metadata.chunkCount}`);

          const plaintext = decryptXChaCha20Poly1305(key, nonce, ciphertext, aad);
          decryptedSlices.push(plaintext);
          totalSize += plaintext.length;

          // Notify main thread of progress
          (self as any).postMessage({
            type: 'PROGRESS',
            requestId,
            progress: {
              chunkIndex: i,
              totalChunks: sorted.length,
              totalDecryptedSoFar: totalSize,
            },
          });
        }

        zeroize(key);

        const assembled = new Uint8Array(totalSize);
        let offset = 0;
        for (const slice of decryptedSlices) {
          assembled.set(slice, offset);
          offset += slice.length;
        }

        const calculatedHash = bytesToHex(sha256(assembled));
        if (calculatedHash !== metadata.sha256Hash) {
          throw new Error('Attachment integrity check failed: SHA-256 hash mismatch');
        }

        // Transfer the assembled buffer back to main thread (zero-copy)
        (self as any).postMessage(
          {
            type: 'SUCCESS',
            requestId,
            result: assembled.buffer,
          },
          [assembled.buffer]
        );
        break;
      }

      case 'COMPUTE_SHA256': {
        const { data } = payload;
        const dataBytes = new Uint8Array(data);
        const hash = bytesToHex(sha256(dataBytes));
        (self as any).postMessage({
          type: 'SUCCESS',
          requestId,
          result: hash,
        });
        break;
      }

      case 'BYTES_TO_BASE64': {
        const { data } = payload;
        const dataBytes = new Uint8Array(data);
        const base64 = bytesToBase64(dataBytes);
        (self as any).postMessage({
          type: 'SUCCESS',
          requestId,
          result: base64,
        });
        break;
      }

      default:
        throw new Error(`Unknown worker operation: ${type}`);
    }
  } catch (err: any) {
    (self as any).postMessage({
      type: 'ERROR',
      requestId,
      error: err?.message || 'Media worker processing failed',
    });
  }
};
