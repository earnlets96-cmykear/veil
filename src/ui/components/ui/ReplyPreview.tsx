/**
 * Reusable ReplyPreview Component for VEIL Message Quotes.
 * Uses SVG vector iconography.
 */

import React from 'react';
import { MicIcon, PaperclipIcon, ImageIcon, VideoIcon, CloseIcon } from '../icons/index.ts';

export interface ReplyPreviewData {
  messageId: string;
  senderName?: string;
  text?: string;
  attachmentType?: 'file' | 'voice' | 'image' | 'video' | 'grouped' | string;
  thumbnailUrl?: string;
  isSelfReply?: boolean;
}

export interface ReplyPreviewProps {
  replyTo: ReplyPreviewData;
  onDismiss?: () => void;
  onClick?: () => void;
  className?: string;
  isSelfReply?: boolean;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  replyTo,
  onDismiss,
  onClick,
  className = '',
  isSelfReply,
}) => {
  const isSelf = isSelfReply ?? replyTo.isSelfReply ?? false;

  const getPreviewSnippet = () => {
    if (replyTo.attachmentType === 'voice') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <MicIcon size={14} color="var(--veil-accent-primary)" /> {replyTo.text || 'Voice note'}
        </span>
      );
    }
    if (replyTo.attachmentType === 'video') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <VideoIcon size={14} color="var(--veil-accent-primary)" /> {replyTo.text || 'Video'}
        </span>
      );
    }
    if (replyTo.attachmentType === 'image') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ImageIcon size={14} color="var(--veil-accent-primary)" /> {replyTo.text || 'Photo'}
        </span>
      );
    }
    if (replyTo.attachmentType === 'grouped') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ImageIcon size={14} color="var(--veil-accent-primary)" /> {replyTo.text || 'Media'}
        </span>
      );
    }
    if (replyTo.attachmentType === 'file') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <PaperclipIcon size={14} color="var(--veil-accent-primary)" /> {replyTo.text || 'File attachment'}
        </span>
      );
    }
    return replyTo.text || '';
  };

  const defaultSender = isSelf ? 'You' : 'Contact';
  const effectiveSender = replyTo.senderName || defaultSender;

  return (
    <div
      className={`veil-reply-preview ${isSelf ? 'veil-reply-self' : 'veil-reply-peer'} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : 'region'}
      tabIndex={onClick ? 0 : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      aria-label={`Replying to ${effectiveSender}`}
    >
      {replyTo.thumbnailUrl && (
        <img
          src={replyTo.thumbnailUrl}
          alt="Reply preview"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: 'var(--veil-radius-xs, 4px)',
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      )}

      <div className="veil-reply-content" style={{ flex: 1, minWidth: 0 }}>
        <div className="veil-reply-sender">
          {effectiveSender}
        </div>
        <div className="veil-reply-snippet">
          {getPreviewSnippet()}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          className="veil-btn-icon"
          style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          aria-label="Cancel reply quote"
        >
          <CloseIcon size={16} />
        </button>
      )}
    </div>
  );
};
