import type { SpaceSession } from '../spaces/session.ts';
import type { EncryptedSpaceStore } from '../storage/spaceStore.ts';
import type { LocalAttachmentPayload } from './types.ts';
import { MediaCipherCache } from '../ui/utils/mediaCipherCache.ts';

const OUTBOX_KEY = 'veil:media:outbox:v1';

export interface MediaUploadJob {
  jobId: string;
  messageId: string;
  conversationId: string;
  kind?: 'attachment' | 'voice';
  attachment: LocalAttachmentPayload;
  state: 'READY' | 'UPLOADING' | 'FAILED';
  createdAt: number;
  updatedAt: number;
}

/** Stores retry metadata in the authenticated Space store and media bytes as ciphertext only. */
export class MediaOutbox {
  constructor(private readonly store: EncryptedSpaceStore) {}

  async list(session: SpaceSession): Promise<MediaUploadJob[]> {
    return (await this.store.getAsync<MediaUploadJob[]>(session, OUTBOX_KEY)) || [];
  }

  async enqueue(session: SpaceSession, job: MediaUploadJob, ciphertext: Uint8Array): Promise<void> {
    const attachmentId = job.attachment.attachmentId;
    const hash = job.attachment.ciphertextHash;
    if (!attachmentId || !hash || !job.attachment.encryptionKeyBase64) {
      throw new Error('Cannot queue media without authenticated encryption metadata');
    }

    await MediaCipherCache.put(session.spaceId, attachmentId, ciphertext, hash);
    try {
      const jobs = await this.list(session);
      const nextJob = { ...job, attachment: { ...job.attachment, previewUrl: undefined, localPreviewUrl: undefined, thumbnailUrl: undefined } };
      const nextJobs = [...jobs.filter((item) => item.jobId !== job.jobId), nextJob];
      await this.store.setAsync(session, OUTBOX_KEY, nextJobs);
    } catch (error) {
      await MediaCipherCache.delete(session.spaceId, attachmentId);
      throw error;
    }
  }

  async update(session: SpaceSession, jobId: string, patch: Partial<MediaUploadJob>): Promise<void> {
    const jobs = await this.list(session);
    const nextJobs = jobs.map((job) => job.jobId === jobId ? { ...job, ...patch, updatedAt: Date.now() } : job);
    await this.store.setAsync(session, OUTBOX_KEY, nextJobs);
  }

  async getCiphertext(session: SpaceSession, job: MediaUploadJob): Promise<Uint8Array | null> {
    const objectId = job.attachment.attachmentId;
    const hash = job.attachment.ciphertextHash;
    if (!objectId || !hash) return null;
    return MediaCipherCache.get(session.spaceId, objectId, hash);
  }

  async remove(session: SpaceSession, jobId: string): Promise<void> {
    const jobs = await this.list(session);
    const removed = jobs.filter((job) => job.jobId === jobId);
    await this.store.setAsync(session, OUTBOX_KEY, jobs.filter((job) => job.jobId !== jobId));
    for (const job of removed) {
      if (job.attachment.attachmentId) {
        await MediaCipherCache.delete(session.spaceId, job.attachment.attachmentId);
      }
    }
  }

  async removeMessage(session: SpaceSession, messageId: string): Promise<void> {
    const jobs = await this.list(session);
    const removed = jobs.filter((job) => job.messageId === messageId);
    await this.store.setAsync(session, OUTBOX_KEY, jobs.filter((job) => job.messageId !== messageId));
    for (const job of removed) {
      if (job.attachment.attachmentId) {
        await MediaCipherCache.delete(session.spaceId, job.attachment.attachmentId);
      }
    }
  }

  async removeConversation(session: SpaceSession, conversationId: string): Promise<void> {
    const jobs = await this.list(session);
    const removed = jobs.filter((job) => job.conversationId === conversationId);
    if (removed.length === 0) return;
    await this.store.setAsync(session, OUTBOX_KEY, jobs.filter((job) => job.conversationId !== conversationId));
    for (const job of removed) {
      if (job.attachment.attachmentId) {
        await MediaCipherCache.delete(session.spaceId, job.attachment.attachmentId);
      }
    }
  }
}
