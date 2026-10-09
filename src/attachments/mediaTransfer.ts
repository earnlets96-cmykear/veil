import { bytesToBase64, randomBytes } from '../crypto/utils.ts';
import { AttachmentPipeline } from './attachmentPipeline.ts';
import type { LocalAttachmentPayload } from './types.ts';

export interface PreparedMediaUpload {
  attachment: LocalAttachmentPayload & { encryptionKeyBase64: string; ciphertextHash: string };
  ciphertext: Uint8Array;
}

/** Encrypts media with the existing authenticated chunk format before cloud upload. */
export async function prepareMediaUpload(
  plaintext: Uint8Array,
  input: { name: string; mimeType: string; attachmentId: string }
): Promise<PreparedMediaUpload> {
  const encryptionKey = randomBytes(32);
  try {
    const { metadata, chunks } = await AttachmentPipeline.chunkAndEncryptAsync(
      plaintext,
      input.name,
      input.mimeType,
      encryptionKey,
      undefined,
      input.attachmentId
    );
    const ciphertext = new TextEncoder().encode(JSON.stringify(chunks));
    const ciphertextHash = await AttachmentPipeline.computeSha256Async(ciphertext);

    return {
      attachment: {
        attachmentId: metadata.attachmentId,
        name: metadata.name,
        mimeType: metadata.mimeType,
        sizeBytes: metadata.sizeBytes,
        chunkCount: metadata.chunkCount,
        chunkSize: metadata.chunkSize,
        sha256Hash: metadata.sha256Hash,
        ciphertextHash,
        encryptionKeyBase64: bytesToBase64(encryptionKey),
      },
      ciphertext,
    };
  } finally {
    encryptionKey.fill(0);
  }
}
