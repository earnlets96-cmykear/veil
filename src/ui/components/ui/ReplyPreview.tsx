/**
 * Reusable ReplyPreview Component for VEIL Message Quotes.
 */

import React from 'react';

export interface ReplyPreviewData {
  messageId: string;
  senderName?: string;
  text?: string;
  attachmentType?: 'file' | 'voice' | 'image';
}

export interface ReplyPreviewProps {
  replyTo: ReplyPreviewData;
  onDismiss?: () => void;
  onClick?: () => void;
  className?: string;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  replyTo,
  onDismiss,
  onClick,
  className = '',
}) => {
  const getPreviewSnippet = () => {
    if (replyTo.attachmentType === 'voice') return '🎙️ Voice note';
    if (replyTo.attachmentType === 'file') return '📎 File attachment';
    if (replyTo.attachmentType === 'image') return '🖼️ Image';
    return replyTo.text || '';
  };

  return (
    <div
      className={`veil-reply-preview ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : 'region'}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      aria-label={`Replying to ${replyTo.senderName || 'Peer'}`}
    >
      <div className="veil-reply-content">
        <div className="veil-reply-sender">
          {replyTo.senderName || 'Peer'}
        </div>
        <div className="veil-reply-snippet">
          {getPreviewSnippet()}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          className="veil-btn-icon"
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 4px' }}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Cancel reply quote"
        >
          ✕
        </button>
      )}
    </div>
  );
};
