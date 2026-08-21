/**
 * Reusable MessageBubble Component for VEIL Messaging Interface.
 *
 * Handles incoming/outgoing alignment, reply quote rendering, attachment previews,
 * voice player embedding, delivery receipts, and timestamp formatting.
 */

import React, { ReactNode } from 'react';
import { ReplyPreview, ReplyPreviewData } from './ReplyPreview.tsx';
import { MessageStatus, DeliveryStatus } from './MessageStatus.tsx';
import { MessageTimestamp } from './MessageTimestamp.tsx';

export interface MessageBubbleProps {
  id: string;
  isOutgoing: boolean;
  text?: string;
  timestamp: number | Date;
  status?: DeliveryStatus;
  replyTo?: ReplyPreviewData;
  onReplyClick?: (messageId: string) => void;
  onReplyTrigger?: () => void;
  attachmentElement?: ReactNode;
  voiceElement?: ReactNode;
  className?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  id,
  isOutgoing,
  text,
  timestamp,
  status = 'DELIVERED_TO_RECIPIENT',
  replyTo,
  onReplyClick,
  onReplyTrigger,
  attachmentElement,
  voiceElement,
  className = '',
}) => {
  return (
    <div
      id={`msg-${id}`}
      className={`veil-message-row ${isOutgoing ? 'outgoing' : 'incoming'} ${className}`.trim()}
    >
      <div className="veil-message-bubble">
        {replyTo && (
          <ReplyPreview
            replyTo={replyTo}
            onClick={onReplyClick ? () => onReplyClick(replyTo.messageId) : undefined}
          />
        )}

        {voiceElement ? (
          <div style={{ padding: '2px 0' }}>{voiceElement}</div>
        ) : attachmentElement ? (
          <div style={{ padding: '2px 0' }}>{attachmentElement}</div>
        ) : (
          <div style={{ wordBreak: 'break-word' }}>{text}</div>
        )}

        <div className="veil-message-meta">
          {onReplyTrigger && (
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                opacity: 0.65,
                fontSize: '0.7rem',
                cursor: 'pointer',
                padding: '0 2px',
              }}
              onClick={onReplyTrigger}
              aria-label="Reply to this message"
            >
              ↩ Reply
            </button>
          )}

          <MessageTimestamp timestamp={timestamp} />

          {isOutgoing && <MessageStatus status={status} />}
        </div>
      </div>
    </div>
  );
};
