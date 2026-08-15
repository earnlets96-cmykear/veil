/**
 * Untrusted Media Blob Storage Adapter & Relay Interface for VEIL.
 */

import { EncryptedMediaChunk } from './types.ts';

export interface IMediaStorageAdapter {
  uploadMedia(mediaId: string, chunks: EncryptedMediaChunk[], capabilityToken: string): Promise<boolean>;
  downloadMedia(mediaId: string, capabilityToken: string): Promise<EncryptedMediaChunk[] | null>;
  deleteMedia(mediaId: string, capabilityToken: string): Promise<boolean>;
}

export class InMemoryMediaRelay implements IMediaStorageAdapter {
  private blobStore = new Map<string, { chunks: EncryptedMediaChunk[]; token: string; uploadedAt: number }>();

  public async uploadMedia(
    mediaId: string,
    chunks: EncryptedMediaChunk[],
    capabilityToken: string
  ): Promise<boolean> {
    if (!capabilityToken || capabilityToken.trim().length === 0) {
      throw new Error('Upload rejected: missing capability authorization token');
    }
    if (!chunks || chunks.length === 0) {
      throw new Error('Upload rejected: empty chunks array');
    }

    this.blobStore.set(mediaId, {
      chunks: chunks.map(c => ({ ...c })),
      token: capabilityToken,
      uploadedAt: Date.now(),
    });
    return true;
  }

  public async downloadMedia(
    mediaId: string,
    capabilityToken: string
  ): Promise<EncryptedMediaChunk[] | null> {
    const entry = this.blobStore.get(mediaId);
    if (!entry) return null;

    // Verify capability authorization token
    if (entry.token !== capabilityToken) {
      throw new Error(`Download rejected: unauthorized capability token for media ${mediaId}`);
    }

    return entry.chunks.map(c => ({ ...c }));
  }

  public async deleteMedia(
    mediaId: string,
    capabilityToken: string
  ): Promise<boolean> {
    const entry = this.blobStore.get(mediaId);
    if (!entry) return false;

    if (entry.token !== capabilityToken) {
      throw new Error(`Delete rejected: unauthorized capability token for media ${mediaId}`);
    }

    return this.blobStore.delete(mediaId);
  }

  /**
   * For test injection / malicious server simulation.
   */
  public getRawEntry(mediaId: string) {
    return this.blobStore.get(mediaId);
  }

  public corruptChunkCiphertext(mediaId: string, chunkIndex: number, newCiphertext: string): void {
    const entry = this.blobStore.get(mediaId);
    if (entry && entry.chunks[chunkIndex]) {
      entry.chunks[chunkIndex].ciphertext = newCiphertext;
    }
  }

  public truncateChunks(mediaId: string, retainCount: number): void {
    const entry = this.blobStore.get(mediaId);
    if (entry) {
      entry.chunks = entry.chunks.slice(0, retainCount);
    }
  }
}
