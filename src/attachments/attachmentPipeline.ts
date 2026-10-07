/**
 * Encrypted Attachment Pipeline for VEIL.
 *
 * Implements authenticated chunking with XChaCha20-Poly1305, SHA-256 integrity
 * verification, resumable reassembly, and ephemeral Blob lifecycle management.
 */

import { AttachmentMetadata, EncryptedAttachmentChunk } from './types.ts';
import { sha256 } from '@noble/hashes/sha256.js';
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from '../crypto/aead.ts';
import {
  randomBytes,
  bytesToBase64,
  base64ToBytes,
  bytesToHex,
} from '../crypto/utils.ts';
import { MediaWorkerPool } from './mediaWorkerPool.ts';

export const DEFAULT_CHUNK_SIZE = 64 * 1024; // 64 KiB
export const FAST_PATH_THRESHOLD_BYTES = 0; // All payload sizes use a worker when supported.

/**
 * Calculates bounded optimal chunk size based on payload byte length.
 * Drastically reduces chunk count, base64 inflation, and object allocations
 * for large media (videos/archives) while preserving forward/backward compatibility.
 */
export function getOptimalChunkSize(totalBytes: number): number {
  if (totalBytes <= 1024 * 1024) {
    return 64 * 1024; // 64 KiB for <= 1 MB
  } else if (totalBytes <= 10 * 1024 * 1024) {
    return 256 * 1024; // 256 KiB for 1-10 MB
  } else if (totalBytes <= 50 * 1024 * 1024) {
    return 512 * 1024; // 512 KiB for 10-50 MB
  } else {
    return 1024 * 1024; // 1 MiB for > 50 MB
  }
}

export class AttachmentPipeline {
  private static activeBlobUrls: Set<string> = new Set();

  /**
   * Chunks and encrypts a file buffer with adaptive chunking.
   */
  public static chunkAndEncrypt(
    data: Uint8Array,
    name: string,
    mimeType: string,
    encryptionKey: Uint8Array,
    chunkSize?: number,
    existingAttachmentId?: string
  ): { metadata: AttachmentMetadata; chunks: EncryptedAttachmentChunk[] } {
    const attachmentId = existingAttachmentId || `att_${bytesToHex(randomBytes(8))}`;
    const totalBytes = data.length;
    const effectiveChunkSize = chunkSize || getOptimalChunkSize(totalBytes);
    const chunkCount = Math.max(1, Math.ceil(totalBytes / effectiveChunkSize));
    const fullHash = bytesToHex(sha256(data));

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
      const start = i * effectiveChunkSize;
      const end = Math.min(start + effectiveChunkSize, totalBytes);
      const slice = data.subarray(start, end);

      const aad = new TextEncoder().encode(`${attachmentId}:${i}:${chunkCount}`);
      const encResult = encryptXChaCha20Poly1305(encryptionKey, slice, aad);

      chunks.push({
        attachmentId,
        chunkIndex: i,
        totalChunks: chunkCount,
        ciphertext: bytesToBase64(encResult.ciphertext),
        nonce: bytesToBase64(encResult.nonce),
      });
    }

    return { metadata, chunks };
  }

  /**
   * Decrypts and reassembles chunks into original plaintext buffer.
   */
  public static decryptAndReassemble(
    metadata: AttachmentMetadata,
    chunks: EncryptedAttachmentChunk[],
    encryptionKey: Uint8Array
  ): Uint8Array {
    if (chunks.length !== metadata.chunkCount) {
      throw new Error(`Incomplete attachment: expected ${metadata.chunkCount} chunks, got ${chunks.length}`);
    }

    const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const decryptedSlices: Uint8Array[] = [];
    let totalSize = 0;

    for (let i = 0; i < sorted.length; i++) {
      const chunk = sorted[i];
      if (chunk.chunkIndex !== i) {
        throw new Error(`Missing chunk at index ${i}`);
      }

      const nonce = base64ToBytes(chunk.nonce);
      const ciphertext = base64ToBytes(chunk.ciphertext);
      const aad = new TextEncoder().encode(`${metadata.attachmentId}:${i}:${metadata.chunkCount}`);

      const plaintext = decryptXChaCha20Poly1305(encryptionKey, nonce, ciphertext, aad);
      decryptedSlices.push(plaintext);
      totalSize += plaintext.length;
    }

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

    return assembled;
  }

  /**
   * Decrypts a single chunk independently with authenticating aad.
   */
  public static decryptSingleChunk(
    metadata: AttachmentMetadata,
    chunk: EncryptedAttachmentChunk,
    encryptionKey: Uint8Array
  ): Uint8Array {
    const nonce = base64ToBytes(chunk.nonce);
    const ciphertext = base64ToBytes(chunk.ciphertext);
    const aad = new TextEncoder().encode(`${metadata.attachmentId}:${chunk.chunkIndex}:${metadata.chunkCount}`);
    return decryptXChaCha20Poly1305(encryptionKey, nonce, ciphertext, aad);
  }

  public static yieldHookForTesting?: () => void;
  private static readonly YIELD_CHUNK_INTERVAL = 8;

  /**
   * Cooperative yield to the event loop so the UI thread remains responsive
   * during intensive cryptographic chunk decryption.
   */
  private static async yieldToEventLoop(): Promise<void> {
    if (this.yieldHookForTesting) {
      try { this.yieldHookForTesting(); } catch (_e) {}
    }
    if (typeof (globalThis as any).scheduler !== 'undefined' && typeof (globalThis as any).scheduler.yield === 'function') {
      try {
        await (globalThis as any).scheduler.yield();
        return;
      } catch (_e) {}
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Decrypts chunks progressively, invoking onChunkReady as each chunk is decrypted,
   * returning the fully assembled buffer verified with SHA-256.
   */
  public static async decryptProgressive(
    metadata: AttachmentMetadata,
    chunks: EncryptedAttachmentChunk[],
    encryptionKey: Uint8Array,
    onPlayableChunk?: (chunkIndex: number, decryptedSlice: Uint8Array, totalDecryptedSoFar: number) => void
  ): Promise<Uint8Array> {
    if (chunks.length !== metadata.chunkCount) {
      throw new Error(`Incomplete attachment: expected ${metadata.chunkCount} chunks, got ${chunks.length}`);
    }

    const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const decryptedSlices: Uint8Array[] = [];
    let totalSize = 0;

    for (let i = 0; i < sorted.length; i++) {
      const chunk = sorted[i];
      if (chunk.chunkIndex !== i) {
        throw new Error(`Missing chunk at index ${i}`);
      }

      const slice = this.decryptSingleChunk(metadata, chunk, encryptionKey);
      decryptedSlices.push(slice);
      totalSize += slice.length;

      if (onPlayableChunk) {
        try {
          onPlayableChunk(i, slice, totalSize);
        } catch (_e) {}
      }

      // Cooperatively yield every YIELD_CHUNK_INTERVAL chunks to unblock UI thread
      if ((i + 1) % this.YIELD_CHUNK_INTERVAL === 0 && i < sorted.length - 1) {
        await this.yieldToEventLoop();
      }
    }

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

    return assembled;
  }

  /**
   * Asynchronously chunks and encrypts media using a Web Worker for large payloads
   * to avoid blocking the main UI thread. Falls back to synchronous execution
   * for small media (< 128 KiB) or in environments where Web Workers are unavailable.
   */
  public static async chunkAndEncryptAsync(
    data: Uint8Array,
    name: string,
    mimeType: string,
    encryptionKey: Uint8Array,
    chunkSize?: number,
    existingAttachmentId?: string
  ): Promise<{ metadata: AttachmentMetadata; chunks: EncryptedAttachmentChunk[] }> {
    const totalBytes = data.length;
    const pool = MediaWorkerPool.getInstance();

    if (!pool.isWorkerSupported()) {
      return this.chunkAndEncrypt(data, name, mimeType, encryptionKey, chunkSize, existingAttachmentId);
    }

    try {
      const bufferToTransfer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const { promise } = pool.execute<{ metadata: AttachmentMetadata; chunks: EncryptedAttachmentChunk[] }>(
        'CHUNK_AND_ENCRYPT',
        {
          data: bufferToTransfer,
          name,
          mimeType,
          encryptionKey: Array.from(encryptionKey),
          chunkSize,
          existingAttachmentId,
        },
        [bufferToTransfer]
      );
      return await promise;
    } catch (_workerErr) {
      return this.chunkAndEncrypt(data, name, mimeType, encryptionKey, chunkSize, existingAttachmentId);
    }
  }

  /**
   * Asynchronously decrypts and reassembles chunks using a Web Worker.
   */
  public static async decryptAndReassembleAsync(
    metadata: AttachmentMetadata,
    chunks: EncryptedAttachmentChunk[],
    encryptionKey: Uint8Array
  ): Promise<Uint8Array> {
    const pool = MediaWorkerPool.getInstance();

    if (!pool.isWorkerSupported()) {
      return this.decryptAndReassemble(metadata, chunks, encryptionKey);
    }

    try {
      const { promise } = pool.execute<ArrayBuffer>(
        'DECRYPT_AND_REASSEMBLE',
        {
          metadata,
          chunks,
          encryptionKey: Array.from(encryptionKey),
        }
      );
      const buffer = await promise;
      return new Uint8Array(buffer);
    } catch (_workerErr) {
      return this.decryptAndReassemble(metadata, chunks, encryptionKey);
    }
  }

  /**
   * Asynchronously decrypts chunks progressively, forwarding progress to onPlayableChunk.
   */
  public static async decryptProgressiveAsync(
    metadata: AttachmentMetadata,
    chunks: EncryptedAttachmentChunk[],
    encryptionKey: Uint8Array,
    onPlayableChunk?: (chunkIndex: number, decryptedSlice: Uint8Array, totalDecryptedSoFar: number) => void
  ): Promise<Uint8Array> {
    const pool = MediaWorkerPool.getInstance();

    if (!pool.isWorkerSupported()) {
      return this.decryptProgressive(metadata, chunks, encryptionKey, onPlayableChunk);
    }

    try {
      const { promise } = pool.execute<ArrayBuffer>(
        'DECRYPT_PROGRESSIVE',
        {
          metadata,
          chunks,
          encryptionKey: Array.from(encryptionKey),
        },
        [],
        (progress) => {
          if (onPlayableChunk) {
            try {
              onPlayableChunk(progress.chunkIndex, new Uint8Array(0), progress.totalDecryptedSoFar);
            } catch (_e) {}
          }
        }
      );
      const buffer = await promise;
      return new Uint8Array(buffer);
    } catch (_workerErr) {
      return this.decryptProgressive(metadata, chunks, encryptionKey, onPlayableChunk);
    }
  }

  /**
   * Computes SHA-256 digest asynchronously off the main thread for large buffers.
   */
  public static async computeSha256Async(data: Uint8Array): Promise<string> {
    const pool = MediaWorkerPool.getInstance();

    if (!pool.isWorkerSupported()) {
      return bytesToHex(sha256(data));
    }

    try {
      const bufferToTransfer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const { promise } = pool.execute<string>(
        'COMPUTE_SHA256',
        { data: bufferToTransfer },
        [bufferToTransfer]
      );
      return await promise;
    } catch (_workerErr) {
      return bytesToHex(sha256(data));
    }
  }

  /**
   * Encodes binary buffer to Base64 asynchronously off the main thread for large buffers.
   */
  public static async bytesToBase64Async(data: Uint8Array): Promise<string> {
    const pool = MediaWorkerPool.getInstance();

    if (!pool.isWorkerSupported()) {
      return bytesToBase64(data);
    }

    try {
      const bufferToTransfer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const { promise } = pool.execute<string>(
        'BYTES_TO_BASE64',
        { data: bufferToTransfer },
        [bufferToTransfer]
      );
      return await promise;
    } catch (_workerErr) {
      return bytesToBase64(data);
    }
  }

  public static createEphemeralBlobUrl(data: Uint8Array, mimeType: string): string {
    if (typeof URL === 'undefined' || typeof Blob === 'undefined') {
      return '';
    }
    const blob = new Blob([new Uint8Array(data)], { type: mimeType });
    const url = URL.createObjectURL(blob);
    this.activeBlobUrls.add(url);
    return url;
  }

  public static revokeAllEphemeralBlobUrls(): void {
    if (typeof URL !== 'undefined') {
      for (const url of this.activeBlobUrls) {
        try {
          URL.revokeObjectURL(url);
        } catch (_e) {}
      }
    }
    this.activeBlobUrls.clear();
  }
}
