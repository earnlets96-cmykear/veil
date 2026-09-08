/**
 * Reusable MessageBubble Component for VEIL Messaging Interface.
 *
 * Handles incoming/outgoing alignment, reply quote rendering, attachment previews,
 * voice player embedding, delivery receipts, selection checkboxes, context menu triggers,
 * retry actions on failure, consecutive grouping, timestamp formatting, and swipe-to-reply gesture.
 */

import React, { ReactNode, useRef, useState } from 'react';
import { ReplyPreview, ReplyPreviewData } from './ReplyPreview.tsx';
import { MessageStatus, DeliveryStatus } from './MessageStatus.tsx';
import { MessageTimestamp } from './MessageTimestamp.tsx';
import { Spinner } from './Spinner.tsx';
import { RefreshCwIcon, ReplyIcon, ForwardIcon } from '../icons/index.ts';

export interface MessageBubbleProps {
  id?: string;
  messageId?: string;
  senderName?: string;
  showSenderName?: boolean;
  forwarded?: boolean;
  forwardedFrom?: string;
  isOutgoing: boolean;
  text?: string;
  timestamp: number | Date;
  status?: DeliveryStatus;
  deliveryStatus?: DeliveryStatus;
  replyTo?: ReplyPreviewData;
  onReplyClick?: (messageId: string) => void;
  onReplyTrigger?: () => void;
  onReply?: () => void;
  attachmentElement?: ReactNode;
  voiceElement?: ReactNode;
  reactions?: Array<{ emoji: string; count: number; userReacted?: boolean }>;
  onReactionClick?: (emoji: string) => void;
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
  messageId,
  senderName,
  showSenderName = true,
  forwarded = false,
  forwardedFrom,
  isOutgoing,
  text,
  timestamp,
  status,
  deliveryStatus,
  replyTo,
  onReplyClick,
  onReplyTrigger,
  onReply,
  attachmentElement,
  voiceElement,
  reactions,
  onReactionClick,
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
  const effectiveId = id || messageId || 'msg';
  const effectiveStatus: DeliveryStatus = status || deliveryStatus || 'DELIVERED_TO_RECIPIENT';
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Swipe-to-reply touch gesture tracking
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        onLongPress();
      }, 500);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || !e.touches || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    // If scrolling vertically, cancel swipe-to-reply
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      setSwipeOffset(0);
      return;
    }

    const triggerReply = onReplyTrigger || onReply;

    // Swiping left (negative deltaX)
    if (deltaX < 0 && triggerReply && !isSelectionMode) {
      // Cancel long press if user is actively swiping
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      setSwipeOffset(Math.max(-50, deltaX));
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    const triggerReply = onReplyTrigger || onReply;
    if (swipeOffset < -35 && triggerReply) {
      triggerReply();
    }

    setSwipeOffset(0);
    touchStartRef.current = null;
  };

  const triggerReply = onReplyTrigger || onReply;
  const isFailed = effectiveStatus === 'FAILED';
  const isMobilePlatform = typeof window !== 'undefined' && (
    Boolean((window as any).Capacitor?.getPlatform() === 'android') ||
    /Android/i.test(navigator.userAgent)
  );
  const hasReactions = Boolean(reactions && reactions.length > 0);
  const canReply = Boolean(!isSelectionMode && triggerReply && !isFailed);
  const showDesktopReply = canReply && !isMobilePlatform;
  const shouldRenderActionRow = hasReactions || showDesktopReply;

  const groupedClass = `${isGroupedWithPrevious ? 'veil-message-grouped-prev' : ''} ${
    isGroupedWithNext ? 'veil-message-grouped-next' : ''
  }`.trim();

  return (
    <div
      id={`msg-${effectiveId}`}
      className={`veil-message-row ${isOutgoing ? 'outgoing' : 'incoming'} ${groupedClass} ${className}`.trim()}
      onClick={isSelectionMode && onSelectToggle ? onSelectToggle : undefined}
      onContextMenu={onContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        cursor: isSelectionMode ? 'pointer' : undefined,
        position: 'relative',
      }}
    >
      {isSelectionMode && (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px' }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelectToggle}
            aria-label={`Select message ${effectiveId}`}
            style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--veil-accent-primary)' }}
          />
        </div>
      )}

      {/* Visual Swipe-to-reply icon indicator */}
      {swipeOffset < -15 && (
        <div
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--veil-accent-primary)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            opacity: Math.min(1, Math.abs(swipeOffset) / 35),
            transition: 'opacity 0.1s ease',
            zIndex: 5,
          }}
          aria-hidden="true"
        >
          <ReplyIcon size={14} />
        </div>
      )}

      <div
        className={`veil-message-bubble ${isOutgoing ? 'outgoing' : 'incoming'} ${
          isSelected ? 'veil-message-selected' : ''
        } ${isHighlighted ? 'veil-message-highlight' : ''}`}
        style={{
          transform: swipeOffset !== 0 ? `translateX(${swipeOffset}px)` : undefined,
          transition: swipeOffset === 0 ? 'transform 0.15s ease-out' : 'none',
        }}
      >
        {forwarded && (
          <div
            className="veil-message-forwarded-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              color: 'var(--veil-text-muted, #94a3b8)',
              fontStyle: 'italic',
              marginBottom: '4px',
              userSelect: 'none',
              opacity: 0.85,
            }}
          >
            <ForwardIcon size={12} style={{ opacity: 0.8 }} />
            <span>{forwardedFrom ? `Forwarded from ${forwardedFrom}` : 'Forwarded message'}</span>
          </div>
        )}

        {!isOutgoing && senderName && showSenderName && (
          <div
            className="veil-message-sender-tag"
            style={{
              fontWeight: 700,
              fontSize: '0.75rem',
              color: 'var(--veil-accent-primary, #14b8a6)',
              marginBottom: '4px',
              letterSpacing: '0.02em',
              userSelect: 'none',
            }}
          >
            {senderName}
          </div>
        )}

        {replyTo && (
          <div className="veil-message-reply-container" style={{ width: '100%', minWidth: 0, marginBottom: '6px' }}>
            <ReplyPreview
              replyTo={replyTo}
              onClick={onReplyClick ? () => onReplyClick(replyTo.messageId) : undefined}
            />
          </div>
        )}

        <div className="veil-message-body" style={{ minWidth: 0, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {voiceElement ? (
            <div style={{ padding: '2px 0' }}>{voiceElement}</div>
          ) : attachmentElement ? (
            <div style={{ padding: '2px 0' }}>{attachmentElement}</div>
          ) : (
            <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{text}</div>
          )}
        </div>

        <div className="veil-message-meta">
          {isFailed && onRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="veil-btn-retry"
              disabled={isRetrying}
              aria-label="Retry sending failed message"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                background: 'transparent',
                border: 'none',
                color: 'var(--veil-danger)',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: 0,
              }}
            >
              {isRetrying ? (
                <Spinner size="xs" color="var(--veil-danger)" />
              ) : (
                <RefreshCwIcon size={12} color="var(--veil-danger)" />
              )}
              <span>{isRetrying ? 'Retrying...' : 'Retry'}</span>
            </button>
          )}

          <MessageTimestamp timestamp={timestamp} />
          {isOutgoing && <MessageStatus status={effectiveStatus} />}
        </div>

        {shouldRenderActionRow && (
          <div
            className="veil-message-action-row"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              marginTop: '6px',
              gap: '8px',
              boxSizing: 'border-box',
            }}
          >
            {hasReactions ? (
              <div className="veil-message-reactions" role="group" aria-label="Reactions">
                {reactions!.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`veil-reaction-pill ${r.userReacted ? 'user-reacted' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onReactionClick?.(r.emoji);
                    }}
                    aria-label={`Reaction ${r.emoji} count ${r.count}`}
                  >
                    <span className="veil-reaction-emoji">{r.emoji}</span>
                    <span className="veil-reaction-count">{r.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="veil-action-row-spacer" />
            )}

            {showDesktopReply && (
              <button
                type="button"
                className="veil-message-reply-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  opacity: 0.75,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginLeft: 'auto',
                  flexShrink: 0,
                  transition: 'opacity 0.15s ease',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  triggerReply!();
                }}
                aria-label="Reply to this message"
              >
                <ReplyIcon size={12} />
                <span>Reply</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
