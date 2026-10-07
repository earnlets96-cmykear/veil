import type { UIMessage } from './types.ts';

const INTERRUPTED_UPLOAD_ERROR = 'Upload paused when the app closed. Its saved encrypted copy will resume after Space unlock.';

/**
 * Mark stale timeline transfer indicators as retryable after a process restart.
 * The encrypted media outbox in AppState restores the saved ciphertext after
 * Space unlock and retries the same visible message without reselecting media.
 */
export function recoverInterruptedUploads(
  messagesByConversation: Record<string, UIMessage[]>
): Record<string, UIMessage[]> {
  let changed = false;
  const recovered: Record<string, UIMessage[]> = {};

  for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
    let conversationChanged = false;
    const nextMessages = messages.map((message) => {
      if (!message.isOutgoing) return message;

      const attachments = message.attachments?.map((attachment) => {
        if (attachment.state !== 'UPLOADING' && attachment.state !== 'QUEUED') return attachment;
        conversationChanged = true;
        return { ...attachment, state: 'FAILED', error: INTERRUPTED_UPLOAD_ERROR };
      });
      const attachment = message.attachment &&
        (message.attachment.state === 'UPLOADING' || message.attachment.state === 'QUEUED')
        ? { ...message.attachment, state: 'FAILED', error: INTERRUPTED_UPLOAD_ERROR }
        : message.attachment;

      const hasInterruptedMedia =
        message.status === 'UPLOADING' ||
        message.attachment?.state === 'UPLOADING' ||
        message.attachment?.state === 'QUEUED' ||
        Boolean(message.attachments?.some((item) => item.state === 'UPLOADING' || item.state === 'QUEUED'));
      if (!hasInterruptedMedia) return message;

      conversationChanged = true;
      return {
        ...message,
        status: 'FAILED' as const,
        attachment,
        attachments,
      };
    });

    recovered[conversationId] = conversationChanged ? nextMessages : messages;
    changed ||= conversationChanged;
  }

  return changed ? recovered : messagesByConversation;
}
