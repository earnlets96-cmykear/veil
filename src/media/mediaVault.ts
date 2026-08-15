/**
 * Media Vault for VEIL Spaces.
 *
 * Manages encrypted client-side media storage, upload/download orchestration with untrusted relays,
 * and strict cryptographic Space isolation (no auto-leakage to OS galleries).
 */

import { MediaEncryptor } from './mediaEncryptor.ts';
import { IMediaStorageAdapter } from './mediaStorage.ts';
import {
  MediaMetadata,
  EncryptedMediaPackage,
  EncryptedMediaAttachment,
} from './types.ts';
import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import { bytesToBase64, base64ToBytes } from '../crypto/utils.ts';

const MEDIA_CACHE_PREFIX = 'veil:media:cache:';

export interface CachedMediaItem {
  mediaId: string;
  metadata: MediaMetadata;
  plaintextBase64: string;
  cachedAt: number;
}

export class MediaVault {
  private store: EncryptedSpaceStore;

  constructor(store: EncryptedSpaceStore) {
    this.store = store;
  }

  /**
   * Encrypts a media file, uploads ciphertext chunks to the untrusted relay, and caches locally.
   */
  public async prepareAndUploadMedia(
    session: SpaceSession,
    plaintext: Uint8Array,
    metadata: MediaMetadata,
    relay: IMediaStorageAdapter,
    capabilityToken: string
  ): Promise<{ attachment: EncryptedMediaAttachment; pkg: EncryptedMediaPackage }> {
    this.assertSession(session);

    // 1. Locally encrypt media into chunks
    const pkg = MediaEncryptor.encryptMedia(plaintext, metadata);

    // 2. Upload ciphertext chunks to untrusted relay
    await relay.uploadMedia(pkg.mediaId, pkg.chunks, capabilityToken);

    // 3. Cache decrypted media inside the Space's encrypted store
    this.cacheMediaLocally(session, pkg.mediaId, metadata, plaintext);

    // 4. Construct E2EE attachment descriptor
    const attachment: EncryptedMediaAttachment = {
      mediaId: pkg.mediaId,
      mediaKey: pkg.mediaKey,
      plaintextDigest: pkg.plaintextDigest,
      encryptedMetadata: pkg.encryptedMetadata,
      metadataNonce: pkg.metadataNonce,
      totalSize: pkg.totalSize,
      chunkCount: pkg.chunkCount,
      chunkSize: pkg.chunkSize,
    };

    return { attachment, pkg };
  }

  /**
   * Downloads ciphertext chunks from untrusted relay, verifies integrity, and decrypts into memory.
   */
  public async downloadAndDecryptMedia(
    session: SpaceSession,
    attachment: EncryptedMediaAttachment,
    capabilityToken: string,
    relay: IMediaStorageAdapter
  ): Promise<{ plaintext: Uint8Array; metadata: MediaMetadata }> {
    this.assertSession(session);

    // Check local Space cache first
    const cached = this.getCachedMedia(session, attachment.mediaId);
    if (cached) {
      return {
        plaintext: base64ToBytes(cached.plaintextBase64),
        metadata: cached.metadata,
      };
    }

    // Download ciphertext chunks from untrusted relay
    const chunks = await relay.downloadMedia(attachment.mediaId, capabilityToken);
    if (!chunks) {
      throw new Error(`Media not found on relay: ${attachment.mediaId}`);
    }

    // Decrypt and verify chunks
    const decrypted = MediaEncryptor.decryptMedia(attachment, chunks);

    // Cache locally in encrypted Space partition
    this.cacheMediaLocally(session, attachment.mediaId, decrypted.metadata, decrypted.plaintext);

    return decrypted;
  }

  /**
   * Retrieves a cached media item from the active Space partition.
   */
  public getCachedMedia(session: SpaceSession, mediaId: string): CachedMediaItem | null {
    this.assertSession(session);
    return this.store.get<CachedMediaItem>(session, `${MEDIA_CACHE_PREFIX}${mediaId}`);
  }

  private cacheMediaLocally(
    session: SpaceSession,
    mediaId: string,
    metadata: MediaMetadata,
    plaintext: Uint8Array
  ): void {
    const item: CachedMediaItem = {
      mediaId,
      metadata,
      plaintextBase64: bytesToBase64(plaintext),
      cachedAt: Date.now(),
    };
    this.store.set(session, `${MEDIA_CACHE_PREFIX}${mediaId}`, item);
  }

  private assertSession(session: SpaceSession): void {
    if (!session || !session.isActive()) {
      throw new Error('MediaVault rejected: Space session is locked or destroyed');
    }
  }
}
