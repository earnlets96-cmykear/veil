export interface GalleryAttachmentEntry {
  message: any;
  attachment: any;
  attachmentIndex: number;
  category: 'media' | 'file';
}

/** Flatten singular and grouped message attachments into the gallery's categories. */
export function getGalleryAttachmentEntries(messages: any[]): GalleryAttachmentEntry[] {
  return messages.flatMap((message) => {
    const attachments = Array.isArray(message?.attachments) && message.attachments.length > 0
      ? message.attachments
      : message?.attachment
        ? [message.attachment]
        : [];

    return attachments.flatMap((attachment: any, attachmentIndex: number) => {
      if (!attachment || message?.voice) return [];
      const mimeType = String(attachment.mimeType || '').toLowerCase();
      const category = mimeType.startsWith('image/') || mimeType.startsWith('video/') ? 'media' : 'file';
      return [{ message, attachment, attachmentIndex, category }];
    });
  });
}
