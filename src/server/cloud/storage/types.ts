/**
 * Object Storage Abstraction for VEIL Encrypted Attachments.
 *
 * Provides a clean interface for storing, retrieving, and deleting
 * client-encrypted ciphertext files without exposing provider-specific paths.
 *
 * HARD SECURITY INVARIANT:
 * All stored data MUST be authenticated ciphertext. Plaintext files NEVER touch storage.
 */

export interface ObjectMetadata {
  objectId: string;
  sizeBytes: number;
  sha256Hash: string;
  createdAt: number;
  customMetadata?: Record<string, string>;
}

export interface IObjectStorage {
  init(): Promise<void>;
  close(): Promise<void>;

  /**
   * Uploads an opaque ciphertext buffer under a unique objectId.
   */
  upload(objectId: string, data: Uint8Array, customMetadata?: Record<string, string>): Promise<ObjectMetadata>;

  /**
   * Downloads an encrypted ciphertext buffer by objectId.
   * Returns null if object does not exist.
   */
  download(objectId: string): Promise<Uint8Array | null>;

  /**
   * Deletes an encrypted object by objectId.
   * Returns true if deleted, false if not found.
   */
  delete(objectId: string): Promise<boolean>;

  /**
   * Checks if an object exists by objectId.
   */
  exists(objectId: string): Promise<boolean>;

  /**
   * Retrieves metadata for an object by objectId.
   */
  getMetadata(objectId: string): Promise<ObjectMetadata | null>;
}
