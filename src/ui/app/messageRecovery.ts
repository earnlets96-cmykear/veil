import type { UIMessage } from './types.ts';

const INTERRUPTED_UPLOAD_ERROR = 'Upload was interrupted when the app closed. Please send it again.';

/**
 * Outgoing uploads are owned by the live AppState worker and cannot survive a
 * process restart. Turn persisted in-flight states into an actionable failure
 * so the timeline never shows an upload spinner with no worker behind it.
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
