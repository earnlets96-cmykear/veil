/**
 * Reusable MessageBubble Component for VEIL Messaging Interface.
 *
 * Handles incoming/outgoing alignment, reply quote rendering, attachment previews,
 * voice player embedding, delivery receipts, selection checkboxes, context menu triggers,
 * retry actions on failure, consecutive grouping, and timestamp formatting.
 */

import React, { ReactNode, useRef } from 'react';
import { ReplyPreview, ReplyPreviewData } from './ReplyPreview.tsx';
import { MessageStatus, DeliveryStatus } from './MessageStatus.tsx';
import { MessageTimestamp } from './MessageTimestamp.tsx';
import { Spinner } from './Spinner.tsx';

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
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onSelectToggle?: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onLongPress?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
  isHighlighted?: boolean;
  isGroupedWithPrevious?: boolean;
  isGroupedWithNext?: boolean;
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
  isSelected = false,
  isSelectionMode = false,
  onSelectToggle,
  onContextMenu,
  onLongPress,
  onRetry,
  isRetrying = false,
  isHighlighted = false,
  isGroupedWithPrevious = false,
  isGroupedWithNext = false,
  className = '',
}) => {
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = () => {
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress();
      }, 500);
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const isFailed = status === 'FAILED';
  const groupedClass = `${isGroupedWithPrevious ? 'veil-message-grouped-prev' : ''} ${
    isGroupedWithNext ? 'veil-message-grouped-next' : ''
  }`.trim();

  return (
    <div
      id={`msg-${id}`}
      className={`veil-message-row ${isOutgoing ? 'outgoing' : 'incoming'} ${groupedClass} ${className}`.trim()}
      onClick={isSelectionMode && onSelectToggle ? onSelectToggle : undefined}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ cursor: isSelectionMode ? 'pointer' : undefined }}
    >
      {isSelectionMode && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelectToggle}
            aria-label={`Select message ${id}`}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--veil-accent-primary)' }}
          />
        </div>
      )}

      <div
        className={`veil-message-bubble ${isOutgoing ? 'outgoing' : 'incoming'} ${
          isSelected ? 'veil-message-selected' : ''
        } ${isHighlighted ? 'veil-message-highlight' : ''}`}
      >
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
          {!isSelectionMode && onReplyTrigger && !isFailed && (
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
              onClick={(e) => {
                e.stopPropagation();
                onReplyTrigger();
              }}
              aria-label="Reply to this message"
            >
              ↩ Reply
            </button>
          )}

          {isFailed && onRetry && (
            <button
              type="button"
              style={{
                background: 'var(--veil-danger-bg)',
                border: '1px solid var(--veil-danger-border)',
                color: 'var(--veil-danger)',
                borderRadius: 'var(--veil-radius-sm)',
                fontSize: '0.7rem',
                cursor: isRetrying ? 'not-allowed' : 'pointer',
                padding: '1px 6px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
              disabled={isRetrying}
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              aria-label="Retry sending failed message"
            >
              {isRetrying ? (
                <>
                  <Spinner size="sm" aria-label="Retrying..." />
                  <span>Retrying...</span>
                </>
              ) : (
                '🔄 Retry'
              )}
            </button>
          )}

          <MessageTimestamp timestamp={timestamp} />

          {isOutgoing && <MessageStatus status={status} />}
        </div>
      </div>
    </div>
  );
};
