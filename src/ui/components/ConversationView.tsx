/**
 * Telegram-Inspired Conversation View Component for VEIL Phase 40.
 *
 * Implements:
 * - Direct inline decrypted image & video thumbnails with smooth loading skeleton
 * - Adaptive Grouped Media Grid for multi-photo / multi-video messages
 * - Fullscreen Media Viewer for photos & videos (zoom, pan, gallery nav, HTML5 video player)
 * - In-chat Shared Media Gallery browser (Photos, Videos, Files, Voice Notes)
 * - Native Android & Web file saving with per-media privacy checks (allowSave / allowForward)
 * - Interactive voice note playback with animated waveform scrubber
 * - Multi-message selection mode and rich contextual action sheets
 * - Interactive swipe-to-reply gesture with jump-to-original message animation
 * - Media Information Inspector Modal
 * - 100% SVG vector iconography and zero secret leakage.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../app/AppState.tsx';
import { MessageComposer } from './MessageComposer.tsx';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import { VoicePlayer } from '../../attachments/voicePlayer.ts';
import { AttachmentPipeline } from '../../attachments/attachmentPipeline.ts';
import type { AttachmentMetadata, EncryptedAttachmentChunk } from '../../attachments/types.ts';
import { base64ToBytes } from '../../crypto/utils.ts';
import type { UIMessage } from '../app/types.ts';
import { useVisualViewport } from '../hooks/useVisualViewport.ts';
import { FileSaver } from '../utils/fileSaver.ts';
import { MediaCache } from '../utils/mediaCache.ts';
import { CHAT_BACK_EDGE_PX, shouldCompleteConversationBackSwipe } from '../utils/mobileGesturePhysics.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  EmptyState,
  AttachmentCard,
  AudioPlayerCard,
  VoiceNoteCard,
  MessageBubble,
  ReplyPreview,
  MessageStatus,
  useToast,
  EmojiPickerModal,
  ProgressCircle,
} from './ui/index.ts';
import {
  ArrowLeftIcon,
  SearchIcon,
  GridIcon,
  MoreVerticalIcon,
  DownloadIcon,
  CopyIcon,
  ForwardIcon,
  ReplyIcon,
  TrashIcon,
  CheckIcon,
  CloseIcon,
  PlayIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  ShareIcon,
  ShieldIcon,
  AlertCircleIcon,
  InfoIcon,
  PhoneIcon,
  EditIcon,
  ChevronRightIcon,
  StarIcon,
} from './icons/index.ts';
import {
  MediaViewer,
  MediaViewerItem,
  MediaGalleryModal,
  MediaImage,
  GroupedMediaGrid,
  MediaInfoModal,
  MediaInfoData,
} from './media/index.ts';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  message: UIMessage | null;
}

interface ConversationMessageRowProps {
  msg: UIMessage;
  isUnreadFirst: boolean;
  isSelected: boolean;
  isSelectionMode: boolean;
  isHighlighted: boolean;
  isContextActive?: boolean;
  isGroupedWithPrevious?: boolean;
  isGroupedWithNext?: boolean;
  downloadingAttachmentId?: string | null;
  downloadProgress?: Record<string, { percent: number; loaded: number; total: number }>;
  downloadPercent?: number;
  downloadLoadedBytes?: number;
  uploadProgress?: Record<string, { percent: number; loaded: number; total: number }>;
  uploadPercent?: number;
  uploadLoadedBytes?: number;
  playbackProgress?: Record<string, number>;
  playbackCurrentTime?: Record<string, number>;
  currentPlaybackProgress?: number;
  currentPlaybackTime?: number;
  playingAudioId?: string | null;
  isAudioPlaying?: boolean;
  unreadRef: React.RefObject<HTMLDivElement | null>;
  onToggleSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, msg: UIMessage) => void;
  onReplyTrigger: (msg: UIMessage) => void;
  onJumpToMessage: (id: string) => void;
  onOpenGroupedMedia: (msg: UIMessage, idx: number) => void;
  onOpenMedia: (msg: UIMessage) => void;
  onDownloadAttachment: (msg: UIMessage) => void;
  onToggleVoice: (msg: UIMessage) => void;
  onSeekVoice: (msg: UIMessage, percent: number) => void;
  onRetry?: (msg: UIMessage) => void;
  peerAvatar?: string;
  onReactionClick?: (msg: UIMessage, emoji: string) => void;
  isGroup?: boolean;
}

const ConversationMessageRowComponent: React.FC<ConversationMessageRowProps> = ({
  msg,
  isUnreadFirst,
  isSelected,
  isSelectionMode,
  isHighlighted,
  isContextActive,
  isGroupedWithPrevious,
  isGroupedWithNext,
  isGroup = false,
  downloadingAttachmentId,
  downloadProgress,
  downloadPercent,
  downloadLoadedBytes,
  uploadProgress,
  uploadPercent,
  uploadLoadedBytes,
  playbackProgress,
  playbackCurrentTime,
  currentPlaybackProgress,
  currentPlaybackTime,
  playingAudioId,
  isAudioPlaying,
  unreadRef,
  onToggleSelect,
  onContextMenu,
  onReplyTrigger,
  onJumpToMessage,
  onOpenGroupedMedia,
  onOpenMedia,
  onDownloadAttachment,
  onToggleVoice,
  onSeekVoice,
  onRetry,
  peerAvatar,
  onReactionClick,
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isAudioAttachment = Boolean(
    msg.attachment &&
    (msg.attachment.mimeType?.startsWith('audio/') ||
      msg.attachment.name?.endsWith('.mp3') ||
      msg.attachment.name?.endsWith('.m4a') ||
      msg.attachment.name?.endsWith('.wav') ||
      msg.attachment.name?.endsWith('.ogg') ||
      msg.attachment.name?.endsWith('.flac') ||
      msg.attachment.name?.endsWith('.aac'))
  );

  const isSticker = Boolean(
    (msg as any).isSticker ||
    (msg.attachment as any)?.isSticker ||
    msg.attachment?.name?.endsWith('.sticker.webp') ||
    msg.attachment?.mimeType?.includes('sticker')
  );

  const isMedia =
    msg.attachment &&
    !isAudioAttachment &&
    !isSticker &&
    (msg.attachment.mimeType?.startsWith('image/') ||
      msg.attachment.mimeType?.startsWith('video/'));
  const isGrouped = Boolean(msg.attachments && msg.attachments.length > 1);

  const hasMediaOrFileCard = isMedia || isSticker || isGrouped || isAudioAttachment || Boolean(msg.attachment) || Boolean(msg.voice);

  const hasVisibleTextBubble = Boolean(
    msg.text &&
    !hasMediaOrFileCard &&
    !msg.text.startsWith('Attachment:') &&
    !msg.text.includes('Attachment:') &&
    msg.text !== 'Voice Message'
  );

  const isCurrentlyPlaying = isAudioPlaying ?? (playingAudioId === msg.id);
  const isCurrentlyDownloading = downloadingAttachmentId === msg.id;
  const currentProgress = currentPlaybackProgress ?? (playbackProgress ? playbackProgress[msg.id] || 0 : 0);
  const currentTime = currentPlaybackTime ?? (playbackCurrentTime ? playbackCurrentTime[msg.id] || 0 : 0);
  const dlPercent = downloadPercent ?? (downloadProgress ? downloadProgress[msg.id]?.percent : undefined);
  const dlLoaded = downloadLoadedBytes ?? (downloadProgress ? downloadProgress[msg.id]?.loaded : undefined);

  const effectiveUploadPercent =
    uploadPercent ??
    (uploadProgress ? uploadProgress[msg.id]?.percent : undefined) ??
    (msg.attachment?.attachmentId && uploadProgress ? uploadProgress[msg.attachment.attachmentId]?.percent : undefined) ??
    (msg.attachment?.objectId && uploadProgress ? uploadProgress[msg.attachment.objectId]?.percent : undefined) ??
    msg.uploadProgress;

  const effectiveUploadLoaded =
    uploadLoadedBytes ??
    (uploadProgress ? uploadProgress[msg.id]?.loaded : undefined) ??
    (msg.attachment?.attachmentId && uploadProgress ? uploadProgress[msg.attachment.attachmentId]?.loaded : undefined) ??
    (msg.attachment?.objectId && uploadProgress ? uploadProgress[msg.attachment.objectId]?.loaded : undefined);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, textarea, a, [data-no-swipe="true"]')) {
      return;
    }
    if (e.touches && e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    longPressTimerRef.current = setTimeout(() => {
      onContextMenu(e as any, msg);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('.veil-waveform-container, .veil-voicenote-card, [data-no-swipe="true"]')) {
      return;
    }
    if (!touchStartRef.current || !e.touches || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    // Vertical scroll cancels swipe
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      setSwipeOffset(0);
      return;
    }

    if (deltaX < 0 && !isSelectionMode) {
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
    if (swipeOffset < -35) {
      onReplyTrigger(msg);
    }
    setSwipeOffset(0);
    touchStartRef.current = null;
  };

  const handlePlayToggle = useCallback(() => onToggleVoice(msg), [onToggleVoice, msg]);
  const handleSeek = useCallback((percent: number) => onSeekVoice(msg, percent), [onSeekVoice, msg]);
  const handleDownload = useCallback(() => onDownloadAttachment(msg), [onDownloadAttachment, msg]);
  const handleMediaClick = useCallback(() => {
    if (!isSelectionMode) onOpenMedia(msg);
  }, [isSelectionMode, onOpenMedia, msg]);
  const handleGroupedMedia = useCallback((idx: number) => onOpenGroupedMedia(msg, idx), [onOpenGroupedMedia, msg]);
  const handleReplyTriggerAction = useCallback(() => onReplyTrigger(msg), [onReplyTrigger, msg]);
  const handleRetryAction = useCallback(() => {
    if (onRetry) onRetry(msg);
  }, [onRetry, msg]);
  const handleReactionAction = useCallback((emoji: string) => {
    if (onReactionClick) onReactionClick(msg, emoji);
  }, [onReactionClick, msg]);
  const handleContextMenuAction = useCallback((e: React.MouseEvent) => {
    onContextMenu(e, msg);
  }, [onContextMenu, msg]);
  const handleLongPress = useCallback(() => {
    const el = document.getElementById(`msg-${msg.id}`);
    const rect = el?.getBoundingClientRect();
    const fakeEvent = {
      preventDefault: () => {},
      stopPropagation: () => {},
      clientX: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      clientY: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
    } as React.MouseEvent;
    onContextMenu(fakeEvent, msg);
  }, [msg, onContextMenu]);

  return (
    <React.Fragment>
      {isUnreadFirst && (
        <div ref={unreadRef} className="veil-unread-divider" role="separator">
          <span>Unread Messages</span>
        </div>
      )}

      <div
        id={`msg-${msg.id}`}
        className={`veil-msg-row ${msg.isOutgoing ? 'outgoing' : 'incoming'} ${
          isSelectionMode ? 'veil-msg-selectable' : ''
        } ${isHighlighted ? 'veil-message-highlight' : ''} ${
          isContextActive ? 'veil-context-active-message' : ''
        }`}
        onClick={(e) => {
          if (isSelectionMode) {
            onToggleSelect(msg.id);
            return;
          }
          const target = e.target as HTMLElement | null;
          const isInteractive = target?.closest(
            'button, a, input, textarea, select, [role="checkbox"], .veil-reactions-bar, .veil-reaction-chip, .veil-reaction-pill, .veil-msg-checkbox'
          );
          if (!isInteractive && (!window.getSelection || window.getSelection()?.toString().length === 0)) {
            onContextMenu(e, msg);
          }
        }}
        onContextMenu={(e) => onContextMenu(e, msg)}
        onTouchStart={!hasVisibleTextBubble ? handleTouchStart : undefined}
        onTouchMove={!hasVisibleTextBubble ? handleTouchMove : undefined}
        onTouchEnd={!hasVisibleTextBubble ? handleTouchEnd : undefined}
        onTouchCancel={!hasVisibleTextBubble ? handleTouchEnd : undefined}
        style={{ position: 'relative' }}
      >
        {isSelectionMode && !msg.isOutgoing && (
          <button
            type="button"
            className={`veil-selection-checkbox veil-selection-left ${isSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(msg.id);
            }}
            aria-label={isSelected ? 'Deselect message' : 'Select message'}
          >
            {isSelected && <CheckIcon size={12} color="#ffffff" />}
          </button>
        )}

        {/* Visual Swipe-to-reply icon indicator for non-text bubbles */}
        {!hasVisibleTextBubble && swipeOffset < -15 && (
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

        {isGroup && !msg.isOutgoing && (
          <div
            style={{
              flexShrink: 0,
              marginRight: '8px',
              alignSelf: 'flex-end',
              marginBottom: '2px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            {!isGroupedWithNext ? (
              <Avatar
                src={msg.senderAvatar || peerAvatar}
                seed={msg.senderId || msg.senderName || 'peer'}
                name={msg.senderName}
                size={28}
              />
            ) : null}
          </div>
        )}

        <div
          className={`veil-bubble-wrapper ${isSticker ? 'veil-bubble-wrapper-sticker' : ''} ${isSelected ? 'selected' : ''}`}
          style={{
            transform: !hasVisibleTextBubble ? `translateX(${swipeOffset}px)` : undefined,
            transition: !hasVisibleTextBubble && swipeOffset === 0 ? 'transform 0.15s ease-out' : 'none',
          }}
        >
          {/* Forwarded Attribution Header for Non-Text Bubbles */}
          {msg.forwarded && !hasVisibleTextBubble && (
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
                padding: '0 4px',
              }}
            >
              <ForwardIcon size={12} style={{ opacity: 0.8 }} />
              <span>{msg.forwardedFrom ? `Forwarded from ${msg.forwardedFrom}` : 'Forwarded message'}</span>
            </div>
          )}

          {/* Quoted Reply Reference for Non-Text Bubbles */}
          {msg.replyTo && !hasVisibleTextBubble && (
            <div style={{ marginBottom: '6px', maxWidth: '320px', width: '100%', minWidth: 0 }}>
              <ReplyPreview
                replyTo={{
                  messageId: msg.replyTo.messageId,
                  senderName: msg.replyTo.senderName,
                  text: msg.replyTo.text,
                  attachmentType: msg.replyTo.attachmentType,
                  thumbnailUrl: msg.replyTo.thumbnailUrl,
                  isSelfReply: msg.replyTo.isSelfReply,
                }}
                onClick={() => onJumpToMessage(msg.replyTo!.messageId)}
              />
            </div>
          )}

          {/* Grouped Multi-Media Gallery Grid */}
          {isGrouped && msg.attachments && (
            <div className="veil-media-bubble-container">
              <GroupedMediaGrid
                attachments={msg.attachments}
                onOpenItem={handleGroupedMedia}
              />
              {msg.text && !msg.text.startsWith('Attachment:') && msg.text !== 'Voice Message' && (
                <div className="veil-media-caption-text">
                  {msg.text}
                </div>
              )}
              <div className="veil-media-meta-overlay">
                <span className="veil-media-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {msg.isOutgoing && <MessageStatus status={msg.status} uploadProgress={effectiveUploadPercent} />}
              </div>
            </div>
          )}

          {/* Frameless Telegram Sticker Display */}
          {!isGrouped && isSticker && msg.attachment && (
            <div className="veil-sticker-bubble-container" style={{ position: 'relative', display: 'inline-block' }}>
              <MediaImage
                attachment={msg.attachment}
                onClick={handleMediaClick}
                alt={msg.attachment.name || 'Sticker'}
                className="veil-message-sticker-img"
              />
              <div
                className="veil-media-meta-overlay"
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <span className="veil-media-time" style={{ fontSize: '0.68rem', color: '#ffffff' }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {msg.isOutgoing && <MessageStatus status={msg.status} uploadProgress={effectiveUploadPercent} />}
              </div>
            </div>
          )}

          {/* Single Media Image / Video Card */}
          {!isGrouped && isMedia && msg.attachment && (
            <div className="veil-media-bubble-container" style={{ position: 'relative' }}>
              <MediaImage
                attachment={msg.attachment}
                isVideo={msg.attachment.mimeType?.startsWith('video/')}
                onClick={handleMediaClick}
                alt={msg.attachment.name}
              />
              {msg.text && !msg.text.startsWith('Attachment:') && msg.text !== 'Voice Message' && (
                <div className="veil-media-caption-text">
                  {msg.text}
                </div>
              )}
              {(isCurrentlyDownloading || msg.status === 'UPLOADING' || (msg.attachment as any)?.state === 'UPLOADING') && (
                <div
                  className="veil-media-download-progress-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0, 0, 0, 0.55)',
                    borderRadius: 'var(--veil-radius-md, 12px)',
                    zIndex: 4,
                  }}
                >
                  <ProgressCircle
                    size={52}
                    percent={
                      isCurrentlyDownloading
                        ? (dlPercent ?? 0)
                        : (effectiveUploadPercent ?? 0)
                    }
                    totalBytes={msg.attachment.sizeBytes}
                    loadedBytes={isCurrentlyDownloading ? dlLoaded : effectiveUploadLoaded}
                    variant={msg.status === 'UPLOADING' || (msg.attachment as any)?.state === 'UPLOADING' ? 'upload' : 'download'}
                  />
                </div>
              )}
              <div className="veil-media-meta-overlay">
                <span className="veil-media-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {msg.isOutgoing && <MessageStatus status={msg.status} uploadProgress={effectiveUploadPercent} />}
              </div>
            </div>
          )}

          {/* Dedicated In-Line Music / Audio Player Card */}
          {!isGrouped && msg.attachment && isAudioAttachment && (
            <AudioPlayerCard
              messageId={msg.id}
              name={msg.attachment.name}
              sizeBytes={msg.attachment.sizeBytes}
              mimeType={msg.attachment.mimeType}
              blobUrl={msg.attachment.previewUrl || msg.attachment.localPreviewUrl}
              isOutgoing={msg.isOutgoing}
              status={
                isCurrentlyDownloading
                  ? 'downloading'
                  : msg.status === 'UPLOADING' || (msg.attachment.state as any)?.toLowerCase() === 'uploading'
                  ? 'uploading'
                  : (msg.attachment.state as any)?.toLowerCase() || 'ready'
              }
              progressPercent={isCurrentlyDownloading ? dlPercent : effectiveUploadPercent}
              loadedBytes={isCurrentlyDownloading ? dlLoaded : effectiveUploadLoaded}
              onDownload={handleDownload}
            />
          )}

          {/* Standard File Attachment Card */}
          {!isGrouped && msg.attachment && !isMedia && !isAudioAttachment && !isSticker && (
            <AttachmentCard
              name={msg.attachment.name}
              sizeBytes={msg.attachment.sizeBytes}
              mimeType={msg.attachment.mimeType}
              status={
                isCurrentlyDownloading
                  ? 'downloading'
                  : msg.status === 'UPLOADING' || (msg.attachment.state as any)?.toLowerCase() === 'uploading'
                  ? 'uploading'
                  : (msg.attachment.state as any)?.toLowerCase() || 'ready'
              }
              progressPercent={isCurrentlyDownloading ? dlPercent : effectiveUploadPercent}
              loadedBytes={isCurrentlyDownloading ? dlLoaded : effectiveUploadLoaded}
              onDownload={handleDownload}
            />
          )}

          {/* Caption for Audio or File Attachment if present */}
          {!isGrouped && msg.attachment && (isAudioAttachment || !isMedia) && !isSticker && msg.text && !msg.text.startsWith('Attachment:') && msg.text !== 'Voice Message' && (
            <div className="veil-media-caption-text" style={{ padding: '4px 10px 6px' }}>
              {msg.text}
            </div>
          )}

          {/* Voice Note Card */}
          {msg.voice && (
            <VoiceNoteCard
              messageId={msg.id}
              durationSeconds={msg.voice.durationSeconds}
              currentTimeSeconds={currentTime}
              isOutgoing={msg.isOutgoing}
              playbackState={
                msg.status === 'UPLOADING'
                  ? 'uploading'
                  : msg.status === 'FAILED'
                  ? 'error'
                  : isCurrentlyPlaying && VoicePlayer.isPlaying(msg.id)
                  ? 'playing'
                  : isCurrentlyPlaying && VoicePlayer.isPaused(msg.id)
                  ? 'paused'
                  : 'ready'
              }
              currentProgressPercent={currentProgress}
              onPlayToggle={handlePlayToggle}
              onSeek={handleSeek}
              onRetry={handlePlayToggle}
            />
          )}

          {/* Text Message Bubble */}
          {hasVisibleTextBubble && (
            <MessageBubble
              id={msg.id}
              isHighlighted={isHighlighted}
              senderName={msg.senderName}
              showSenderName={isGroup}
              forwarded={msg.forwarded}
              forwardedFrom={msg.forwardedFrom}
              isOutgoing={msg.isOutgoing}
              text={msg.text}
              timestamp={msg.timestamp}
              status={msg.status}
              uploadProgress={effectiveUploadPercent}
              replyTo={
                msg.replyTo
                  ? {
                      messageId: msg.replyTo.messageId,
                      senderName: msg.replyTo.senderName,
                      text: msg.replyTo.text,
                      attachmentType: msg.replyTo.attachmentType,
                      thumbnailUrl: msg.replyTo.thumbnailUrl,
                      isSelfReply: msg.replyTo.isSelfReply,
                    }
                  : undefined
              }
              onReplyClick={onJumpToMessage}
              onReplyTrigger={handleReplyTriggerAction}
              onRetry={onRetry ? handleRetryAction : undefined}
              isGroupedWithPrevious={isGroupedWithPrevious}
              isGroupedWithNext={isGroupedWithNext}
              reactions={undefined}
              edited={msg.edited}
              onReactionClick={onReactionClick ? handleReactionAction : undefined}
              onContextMenu={handleContextMenuAction}
            />
          )}

          {/* Universal Floating Reactions Badge for all message types (Text, Voice, Media, File, Sticker) */}
          {(msg as any).reactions && (msg as any).reactions.length > 0 && (
            <div className="veil-floating-reaction-badge" role="group" aria-label="Reactions">
              {((msg as any).reactions as Array<{ emoji: string; count: number; userReacted?: boolean }>).map((r, i) => (
                <button
                  key={i}
                  type="button"
                  className={`veil-reaction-pill ${r.userReacted ? 'user-reacted' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onReactionClick?.(msg, r.emoji);
                  }}
                  aria-label={`Reaction ${r.emoji} count ${r.count}`}
                >
                  <span className="veil-reaction-emoji">{r.emoji}</span>
                  <span className="veil-reaction-count">{r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {isSelectionMode && msg.isOutgoing && (
          <button
            type="button"
            className={`veil-selection-checkbox veil-selection-right ${isSelected ? 'selected' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(msg.id);
            }}
            aria-label={isSelected ? 'Deselect message' : 'Select message'}
          >
            {isSelected && <CheckIcon size={12} color="#ffffff" />}
          </button>
        )}
      </div>
    </React.Fragment>
  );
};

export const ConversationMessageRow = React.memo(ConversationMessageRowComponent);

export const ConversationView: React.FC = () => {
  const {
    activeSession,
    activeChatId,
    conversations,
    contacts,
    messages,
    uploadProgress,
    myProfile,
    sendMessage,
    sendAttachment,
    selectConversation,
    openModal,
    cloudClient,
    ensureCloudSession,
    setReplyTarget,
    deleteMessageLocally,
    deleteMessageForEveryone,
    markConversationAsRead,
    retryFailedMessage,
    editMessage,
    pinMessage,
    unpinMessage,
    forwardMessage,
    toggleMessageReaction,
  } = useApp();

  const { showToast } = useToast();

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);
  const chatBackTouchRef = useRef<{ x: number; y: number; direction: 'ltr' | 'rtl' } | null>(null);

  // Dynamic Visual Viewport & Keyboard State
  const { isKeyboardOpen, visualViewportHeight } = useVisualViewport();

  // Search & Navigation State
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  // Fullscreen Media Viewer State
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null);
  const [viewerMediaList, setViewerMediaList] = useState<MediaViewerItem[]>([]);
  const [chatBackOffset, setChatBackOffset] = useState(0);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // Jump-to-message Highlight State
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Media Info Inspector State
  const [mediaInfoTarget, setMediaInfoTarget] = useState<MediaInfoData | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    message: null,
  });
  const [forwardingMessage, setForwardingMessage] = useState<UIMessage | null>(null);
  const [includeAttribution, setIncludeAttribution] = useState<boolean>(true);
  const [deleteForEveryoneConfirm, setDeleteForEveryoneConfirm] = useState<UIMessage | null>(null);

  // Message Editing State
  const [editingMessage, setEditingMessage] = useState<UIMessage | null>(null);

  // Emoji Picker State
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [emojiTargetMessage, setEmojiTargetMessage] = useState<UIMessage | null>(null);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('veil:ui:recentEmojis');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Context Menu Ref for edge protection
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const menuOpenedAtRef = useRef<number>(0);

  // Download progress state
  const [downloadProgress, setDownloadProgress] = useState<Record<string, { percent: number; loaded: number; total: number }>>({});

  // Current Active Conversation Info
  const activeConversation = useMemo(() => {
    if (!activeChatId) return null;
    return conversations.find((c) => c.id === activeChatId) || null;
  }, [activeChatId, conversations]);

  const activeContact = useMemo(() => {
    if (!activeChatId) return null;
    return (
      contacts.find((c) => c.identityId === activeChatId || c.name === activeChatId) || null
    );
  }, [activeChatId, contacts]);

  const conversationName =
    activeConversation?.name ||
    activeContact?.name ||
    (activeChatId ? `@${activeChatId.slice(0, 10)}` : 'Chat');

  const handleChatBackTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (viewerItem || isSelectionMode || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const direction = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
    const edgeBoundary = Math.max(CHAT_BACK_EDGE_PX, 32);
    const startsAtEdge = direction === 'rtl'
      ? touch.clientX >= window.innerWidth - edgeBoundary
      : touch.clientX <= edgeBoundary;
    if (!startsAtEdge) return;

    chatBackTouchRef.current = { x: touch.clientX, y: touch.clientY, direction };
  }, [isSelectionMode, viewerItem]);

  const handleChatBackTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = chatBackTouchRef.current;
    if (!start || event.touches.length !== 1) return;

    const deltaX = event.touches[0].clientX - start.x;
    const deltaY = event.touches[0].clientY - start.y;
    const logicalDelta = start.direction === 'rtl' ? -deltaX : deltaX;
    if (logicalDelta <= 0 || Math.abs(deltaY) >= Math.abs(deltaX)) {
      setChatBackOffset(0);
      return;
    }

    event.preventDefault();
    // Smooth responsive translation following finger
    setChatBackOffset(Math.min(window.innerWidth * 0.85, logicalDelta));
  }, []);

  const finishChatBackSwipe = useCallback((event?: React.TouchEvent<HTMLDivElement>) => {
    const start = chatBackTouchRef.current;
    chatBackTouchRef.current = null;
    if (!start || !event || event.changedTouches.length !== 1) {
      setChatBackOffset(0);
      return;
    }

    const deltaX = event.changedTouches[0].clientX - start.x;
    const deltaY = event.changedTouches[0].clientY - start.y;
    const logicalDelta = start.direction === 'rtl' ? -deltaX : deltaX;

    const thresholdMet = logicalDelta >= Math.min(100, window.innerWidth * 0.3) || shouldCompleteConversationBackSwipe({
      startX: start.x,
      viewportWidth: window.innerWidth,
      deltaX,
      deltaY,
      direction: start.direction,
    });

    if (thresholdMet) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(10); } catch (_e) {}
      }
      selectConversation(null);
    }
    setChatBackOffset(0);
  }, [selectConversation]);

  const activeMessages = useMemo(() => {
    if (!activeChatId) return [];
    let list: UIMessage[] =
      messages[activeChatId] ||
      (activeContact?.name ? messages[activeContact.name] : []) ||
      (activeContact?.identityId ? messages[activeContact.identityId] : []) ||
      [];

    if (localSearchQuery.trim()) {
      const q = localSearchQuery.toLowerCase();
      list = list.filter(
        (m) =>
          (m.text && m.text.toLowerCase().includes(q)) ||
          (m.attachment?.name && m.attachment.name.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeChatId, activeContact, messages, localSearchQuery]);

  const pinnedMessage = useMemo(() => {
    if (!activeConversation?.pinnedMessageId) return null;
    return activeMessages.find((m) => m.id === activeConversation.pinnedMessageId) || null;
  }, [activeConversation?.pinnedMessageId, activeMessages]);

  // First unread message index for divider
  const firstUnreadIndex = useMemo(() => {
    if (!activeConversation || activeConversation.unreadCount <= 0) return -1;
    const incoming = activeMessages.map((m, i) => ({ isOut: m.isOutgoing, idx: i })).filter((x) => !x.isOut);
    if (incoming.length === 0) return -1;
    const unreadItems = incoming.slice(-activeConversation.unreadCount);
    return unreadItems.length > 0 ? unreadItems[0].idx : -1;
  }, [activeConversation, activeMessages]);

  // Incremental timeline windowing for smooth rendering of large conversations
  const INITIAL_MESSAGE_WINDOW = 60;
  const WINDOW_INCREMENT = 40;
  const [renderedCount, setRenderedCount] = useState<number>(INITIAL_MESSAGE_WINDOW);

  useEffect(() => {
    setRenderedCount(INITIAL_MESSAGE_WINDOW);
  }, [activeChatId]);

  const displayedMessages = useMemo(() => {
    if (activeMessages.length <= renderedCount) return activeMessages;
    return activeMessages.slice(-renderedCount);
  }, [activeMessages, renderedCount]);

  const handleTimelineScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop < 100 && renderedCount < activeMessages.length) {
      const prevScrollHeight = el.scrollHeight;
      const prevScrollTop = el.scrollTop;
      setRenderedCount((prev) => Math.min(activeMessages.length, prev + WINDOW_INCREMENT));
      requestAnimationFrame(() => {
        if (timelineRef.current) {
          const newScrollHeight = timelineRef.current.scrollHeight;
          timelineRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
        }
      });
    }
  }, [renderedCount, activeMessages.length]);

  const lastChatIdRef = useRef<string | null>(null);

  // Auto-scroll timeline to bottom on load/new message or to unread divider
  // Uses instantaneous 'auto' scroll on conversation switch and 'smooth' for live messages
  useEffect(() => {
    const isChatSwitch = lastChatIdRef.current !== activeChatId;
    lastChatIdRef.current = activeChatId;
    const scrollBehavior: ScrollBehavior = isChatSwitch ? 'auto' : 'smooth';

    if (firstUnreadIndex >= 0 && unreadRef.current) {
      unreadRef.current.scrollIntoView({ behavior: scrollBehavior, block: 'center' });
    } else if (timelineEndRef.current) {
      timelineEndRef.current.scrollIntoView({ behavior: scrollBehavior });
    }
  }, [activeChatId, activeMessages.length, firstUnreadIndex]);

  // Keep latest message visible above keyboard when keyboard opens or visual viewport shrinks
  useEffect(() => {
    if (isKeyboardOpen && timelineEndRef.current) {
      const timer = setTimeout(() => {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isKeyboardOpen, visualViewportHeight]);

  // Auto-clear unread messages counter and dispatch read receipts when active
  useEffect(() => {
    if (activeChatId) {
      const hasUnread = (activeConversation && activeConversation.unreadCount > 0) || false;
      const hasInbound = activeMessages.some((m) => !m.isOutgoing);
      if (hasUnread || hasInbound) {
        markConversationAsRead(activeChatId);
      }
    }
  }, [activeChatId, activeConversation?.unreadCount, activeMessages.length, markConversationAsRead]);

  // Handle Jump-to-message with automatic window expansion
  const handleJumpToMessage = useCallback((targetMsgId: string) => {
    const targetIdx = activeMessages.findIndex((m) => m.id === targetMsgId);
    if (targetIdx >= 0 && targetIdx < activeMessages.length - renderedCount) {
      const neededCount = activeMessages.length - targetIdx + 20;
      setRenderedCount(neededCount);
      requestAnimationFrame(() => {
        const element = document.getElementById(`msg-${targetMsgId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedMessageId(targetMsgId);
          setTimeout(() => {
            setHighlightedMessageId((current) => (current === targetMsgId ? null : current));
          }, 2500);
        }
      });
      return;
    }

    const element = document.getElementById(`msg-${targetMsgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(targetMsgId);
      setTimeout(() => {
        setHighlightedMessageId((current) => (current === targetMsgId ? null : current));
      }, 2500);
    } else {
      showToast({ type: 'info', message: 'Original message not found in timeline' });
    }
  }, [activeMessages, renderedCount, showToast]);

  // Track playback progress & current time per message
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState<Record<string, number>>({});

  // Handle Voice Note Playback
  const handleToggleVoice = useCallback(async (msg: UIMessage) => {
    if (!msg.voice || !activeSession) return;

    // 1. If currently playing this message, PAUSE immediately
    //    Keep playingAudioId set so VoiceNoteCard receives 'paused' state (not 'ready')
    if (VoicePlayer.isPlaying(msg.id)) {
      VoicePlayer.pause();
      return;
    }

    // 2. If this message is paused, RESUME immediately
    if (VoicePlayer.getPlayingId() === msg.id && VoicePlayer.isPaused(msg.id)) {
      setPlayingAudioId(msg.id);
      await VoicePlayer.resume();
      return;
    }

    // 3. Otherwise start playback
    try {
      if (!cloudClient.hasAuthenticatedSession()) {
        await ensureCloudSession(activeSession);
      }

      setPlayingAudioId(msg.id);
      await VoicePlayer.playVoiceNote(activeSession, cloudClient, msg.voice, msg.id, {
        onEnded: () => {
          setPlayingAudioId(null);
          setPlaybackProgress((prev) => ({ ...prev, [msg.id]: 0 }));
          setPlaybackCurrentTime((prev) => ({ ...prev, [msg.id]: 0 }));
        },
        onError: (err) => {
          setPlayingAudioId(null);
          showToast({ type: 'error', message: err.message || 'Failed to play voice message' });
        },
      });
    } catch (err: any) {
      setPlayingAudioId(null);
      showToast({ type: 'error', message: err.message || 'Failed to play voice message' });
    }
  }, [activeSession, cloudClient, ensureCloudSession, showToast]);

  const handleSeekVoice = useCallback((m: UIMessage, percent: number) => {
    VoicePlayer.seek(percent, m.id, m.voice?.durationSeconds);
  }, []);

  const handleRetryMessage = useCallback((m: UIMessage) => {
    if (activeChatId) retryFailedMessage(activeChatId, m.id);
  }, [activeChatId, retryFailedMessage]);

  const handleReactionClick = useCallback((m: UIMessage, emoji: string) => {
    if (activeChatId) toggleMessageReaction(activeChatId, m.id, emoji);
  }, [activeChatId, toggleMessageReaction]);

  // Handle Attachment Download & Saving with Privacy Enforcement
  const handleDownloadAttachment = useCallback(async (msg: UIMessage) => {
    if ((!msg.attachment && !msg.voice) || !activeSession) return;

    // Check if sender disallowed saving
    if (msg.attachment && msg.attachment.allowSave === false && !msg.isOutgoing) {
      showToast({
        type: 'error',
        message: 'Saving disabled by sender for this media item',
      });
      return;
    }

    const totalBytes = msg.attachment?.sizeBytes || (msg.voice ? msg.voice.sizeBytes || 64 * 1024 : 0);
    setDownloadingAttachmentId(msg.id);
    setDownloadProgress((prev) => ({
      ...prev,
      [msg.id]: { percent: 0, loaded: 0, total: totalBytes },
    }));

    const onDownloadProgress = (loaded: number, total: number) => {
      const effectiveTotal = total > 0 ? total : totalBytes;
      const percent = effectiveTotal > 0 ? Math.min(100, Math.round((loaded / effectiveTotal) * 100)) : 0;
      setDownloadProgress((prev) => ({
        ...prev,
        [msg.id]: { percent, loaded, total: effectiveTotal },
      }));
    };

    try {
      let data: Uint8Array | null = null;
      let filename = msg.attachment?.name || `file_${msg.id.slice(0, 8)}`;
      let mimeType = msg.attachment?.mimeType || 'application/octet-stream';

      if (msg.voice) {
        filename = msg.text && (msg.text.endsWith('.m4a') || msg.text.endsWith('.mp3'))
          ? msg.text
          : `voice_note_${msg.id.slice(0, 8)}.m4a`;
        mimeType = msg.voice.mimeType || 'audio/m4a';

        const cached = MediaCache.get(msg.voice.objectId);
        if (cached && cached.data) {
          data = cached.data;
        } else {
          if (!cloudClient.getSessionToken()) {
            await ensureCloudSession(activeSession);
          }
          const blobUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(activeSession, cloudClient, msg.voice, onDownloadProgress);
          const res = await fetch(blobUrl);
          const buf = await res.arrayBuffer();
          data = new Uint8Array(buf);
        }
      } else if (msg.attachment) {
        const key = msg.attachment.objectId || msg.attachment.attachmentId || msg.attachment.name;
        let cached = MediaCache.get(key);

        if (!cached) {
          if (!cloudClient.getSessionToken()) {
            await ensureCloudSession(activeSession);
          }
          cached = await MediaCache.getOrFetch(msg.attachment, activeSession, cloudClient, onDownloadProgress);
        }

        if (cached && cached.data) {
          data = cached.data;
        }
      }

      if (data) {
        setDownloadProgress((prev) => ({
          ...prev,
          [msg.id]: { percent: 100, loaded: totalBytes, total: totalBytes },
        }));
        // Use gallery save for images/videos, regular save for other files
        const isGalleryMedia = mimeType.startsWith('image/') || mimeType.startsWith('video/');
        const saved = isGalleryMedia
          ? await FileSaver.saveToGallery({ data, filename, mimeType })
          : await FileSaver.saveFile({ data, filename, mimeType, triggerShare: true });
        if (saved && saved.success) {
          showToast({
            type: 'success',
            message: `Saved ${filename} to ${saved.location || 'storage'}`,
          });
        } else {
          showToast({
            type: 'error',
            message: saved?.error || 'Failed to save file on device',
          });
        }
      } else {
        throw new Error('Decrypted file data not available');
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        message: err.message || 'Failed to download file',
      });
    } finally {
      setDownloadingAttachmentId(null);
      setDownloadProgress((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
    }
  }, [activeSession, cloudClient, ensureCloudSession, showToast]);

  // Open Fullscreen Media Viewer
  const handleOpenMedia = useCallback((msg: UIMessage) => {
    if (!msg.attachment && (!msg.attachments || msg.attachments.length === 0)) return;

    const allMediaMessages = activeMessages.filter(
      (m) =>
        (m.attachment && (m.attachment.mimeType?.startsWith('image/') || m.attachment.mimeType?.startsWith('video/'))) ||
        (m.attachments && m.attachments.length > 0)
    );

    const items: MediaViewerItem[] = [];
    for (const m of allMediaMessages) {
      if (m.attachments && m.attachments.length > 0) {
        for (let i = 0; i < m.attachments.length; i++) {
          const att = m.attachments[i];
          const key = att.objectId || att.attachmentId || att.name;
          const cached = MediaCache.get(key);
          items.push({
            id: `${m.id}_${i}`,
            type: att.mimeType?.startsWith('video/') ? 'video' : 'image',
            url: cached?.blobUrl || (att as any).previewUrl || '',
            name: att.name,
            sizeBytes: att.sizeBytes,
            mimeType: att.mimeType,
            timestamp: m.timestamp,
            senderName: m.senderName,
            attachment: att,
            data: cached?.data,
          });
        }
      } else if (m.attachment) {
        const key = m.attachment.objectId || m.attachment.attachmentId || m.attachment.name;
        const cached = MediaCache.get(key);
        items.push({
          id: m.id,
          type: m.attachment.mimeType?.startsWith('video/') ? 'video' : 'image',
          url: cached?.blobUrl || (m.attachment as any)!.previewUrl || (m.attachment as any)!.url || '',
          name: m.attachment.name,
          sizeBytes: m.attachment.sizeBytes,
          mimeType: m.attachment.mimeType,
          timestamp: m.timestamp,
          senderName: m.senderName,
          attachment: m.attachment,
          data: cached?.data,
        });
      }
    }

    const currentIdx = items.findIndex((i) => i.id === msg.id || i.id.startsWith(`${msg.id}_`));
    setViewerMediaList(items);
    setViewerItem(items[currentIdx >= 0 ? currentIdx : 0]);
  }, [activeMessages]);

  const handleOpenGroupedMedia = useCallback((msg: UIMessage, index: number) => {
    if (!msg.attachments || msg.attachments.length === 0) return;
    const items: MediaViewerItem[] = msg.attachments.map((att, i) => {
      const key = att.objectId || att.attachmentId || att.name;
      const cached = MediaCache.get(key);
      return {
        id: `${msg.id}_${i}`,
        type: att.mimeType?.startsWith('video/') ? 'video' : 'image',
        url: cached?.blobUrl || (att as any).previewUrl || '',
        name: att.name,
        sizeBytes: att.sizeBytes,
        mimeType: att.mimeType,
        timestamp: msg.timestamp,
        senderName: msg.senderName,
        attachment: att,
        data: cached?.data,
      };
    });
    setViewerMediaList(items);
    setViewerItem(items[index] || items[0]);
  }, []);

  // Keyboard Escape listener to dismiss context menu and modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu.isOpen) {
          setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
        }
        if (forwardingMessage) {
          setForwardingMessage(null);
        }
        if (deleteForEveryoneConfirm) {
          setDeleteForEveryoneConfirm(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [contextMenu.isOpen, forwardingMessage, deleteForEveryoneConfirm]);

  // Dismiss context menu & floating reactions on any outside pointer, touch, mouse, scroll, or resize
  useEffect(() => {
    if (!contextMenu.isOpen) return;

    const handleOutsideDismiss = (e: Event) => {
      const target = e.target as HTMLElement | null;
      // Allow interactions within context menu, floating reactions pill, or emoji picker modal
      if (
        target?.closest('.veil-context-menu') ||
        target?.closest('.veil-floating-reactions-pill') ||
        target?.closest('.veil-emoji-picker-modal')
      ) {
        return;
      }

      // Ignore if event fired within 60ms of menu opening (prevent initial open event from dismissing)
      if (Date.now() - menuOpenedAtRef.current < 60) {
        return;
      }

      // Absorb outside interaction completely so underlying elements (media, audio, inputs, swipe) do not trigger
      if (
        e.type === 'pointerdown' ||
        e.type === 'mousedown' ||
        e.type === 'touchstart' ||
        e.type === 'click' ||
        e.type === 'contextmenu'
      ) {
        if (e.cancelable) {
          e.preventDefault();
        }
        e.stopPropagation();
        (e as any).stopImmediatePropagation?.();
      }

      setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
    };

    // Capture phase listeners intercept outside interaction BEFORE any child element can stop propagation
    window.addEventListener('pointerdown', handleOutsideDismiss, { capture: true });
    window.addEventListener('mousedown', handleOutsideDismiss, { capture: true });
    window.addEventListener('touchstart', handleOutsideDismiss, { capture: true, passive: false });
    window.addEventListener('click', handleOutsideDismiss, { capture: true });
    window.addEventListener('contextmenu', handleOutsideDismiss, { capture: true });
    window.addEventListener('scroll', handleOutsideDismiss, { capture: true, passive: true });
    window.addEventListener('resize', handleOutsideDismiss, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleOutsideDismiss, { capture: true });
      window.removeEventListener('mousedown', handleOutsideDismiss, { capture: true });
      window.removeEventListener('touchstart', handleOutsideDismiss, { capture: true });
      window.removeEventListener('click', handleOutsideDismiss, { capture: true });
      window.removeEventListener('contextmenu', handleOutsideDismiss, { capture: true });
      window.removeEventListener('scroll', handleOutsideDismiss, { capture: true });
      window.removeEventListener('resize', handleOutsideDismiss);
    };
  }, [contextMenu.isOpen]);

  // Context Menu Trigger (Long-press / right click)
  const handleContextMenu = useCallback((e: React.MouseEvent, msg: UIMessage) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSelectionMode) return;

    const menuWidth = 240;
    const menuHeight = 360;
    const margin = 12;

    let targetX = e.clientX;
    let targetY = e.clientY;

    // If triggered from touch or keyboard without mouse coordinates
    if (!targetX && !targetY) {
      const el = document.getElementById(`msg-${msg.id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        targetX = msg.isOutgoing ? rect.right - menuWidth : rect.left;
        targetY = rect.top;
      }
    }

    // Horizontal positioning: clamp within viewport
    let x = targetX;
    if (x + menuWidth > window.innerWidth - margin) {
      x = window.innerWidth - menuWidth - margin;
    }
    if (x < margin) {
      x = margin;
    }

    // Vertical positioning: check available space below vs above
    let y = targetY;
    const spaceBelow = window.innerHeight - targetY;
    const spaceAbove = targetY;

    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      // Flip above
      y = Math.max(margin, targetY - menuHeight);
    } else {
      // Place below, clamp bottom
      y = Math.min(targetY, window.innerHeight - menuHeight - margin);
    }
    if (y < margin) y = margin;

    menuOpenedAtRef.current = Date.now();
    setContextMenu({
      isOpen: true,
      x,
      y,
      message: msg,
    });
  }, [isSelectionMode]);

  // Edge protection: re-clamp context menu after render using its actual dimensions
  useEffect(() => {
    if (!contextMenu.isOpen || !contextMenuRef.current) return;
    const el = contextMenuRef.current;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    let needsUpdate = false;
    let newX = contextMenu.x;
    let newY = contextMenu.y;

    if (rect.right > window.innerWidth - margin) {
      newX = window.innerWidth - rect.width - margin;
      needsUpdate = true;
    }
    if (rect.left < margin) {
      newX = margin;
      needsUpdate = true;
    }
    if (rect.bottom > window.innerHeight - margin) {
      newY = window.innerHeight - rect.height - margin;
      needsUpdate = true;
    }
    if (rect.top < margin) {
      newY = margin;
      needsUpdate = true;
    }

    if (needsUpdate) {
      setContextMenu((prev) => ({ ...prev, x: Math.max(margin, newX), y: Math.max(margin, newY) }));
    }
  }, [contextMenu.isOpen, contextMenu.x, contextMenu.y]);

  // Handle message editing
  const handleStartEdit = (msg: UIMessage) => {
    setEditingMessage(msg);
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleConfirmEdit = async (newText: string) => {
    if (!editingMessage || !activeChatId) return;
    await editMessage(activeChatId, editingMessage.id, newText);
    setEditingMessage(null);
  };

  // Track recent emojis for smart reaction bar
  const handleUpdateRecentEmojis = (emoji: string) => {
    setRecentEmojis((prev) => {
      const filtered = prev.filter((e) => e !== emoji);
      const updated = [emoji, ...filtered].slice(0, 20);
      try {
        localStorage.setItem('veil:ui:recentEmojis', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Default 5 emojis initially on the pill bubble of reactions (standard top 5)
  // Retains full 7-emoji sequence for test regression compatibility
  const DEFAULT_REACTION_EMOJIS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F64F}', '\u{1F525}'];
  const displayEmojis = useMemo(() => {
    const combined = [...recentEmojis, ...DEFAULT_REACTION_EMOJIS];
    return [...new Set(combined)].slice(0, 5);
  }, [recentEmojis]);

  // Context Menu Actions
  const handleCopyText = (text?: string) => {
    if (text && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      showToast({ type: 'success', message: 'Message copied to clipboard' });
    }
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  const handleReplyToMessage = (msg: UIMessage) => {
    setReplyTarget(msg);
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  const handleViewInfo = (msg: UIMessage) => {
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
    const info: MediaInfoData = {
      name: msg.attachment?.name || msg.voice?.objectId || 'Encrypted Message',
      mimeType: msg.attachment?.mimeType || msg.voice?.mimeType || 'text/plain',
      sizeBytes: msg.attachment?.sizeBytes || msg.voice?.sizeBytes,
      durationSeconds: msg.voice?.durationSeconds || (msg.attachment as any)?.duration,
      width: (msg.attachment as any)?.width,
      height: (msg.attachment as any)?.height,
      timestamp: msg.timestamp,
      senderName: msg.senderName || (msg.isOutgoing ? (activeSession?.name || myProfile?.displayName || 'You') : (activeContact?.name || conversationName || 'Contact')),
      status: msg.status,
      allowSave: msg.attachment?.allowSave ?? (msg.voice as any)?.allowSave ?? true,
      allowForward: msg.attachment?.allowForward ?? (msg.voice as any)?.allowForward ?? true,
    };
    setMediaInfoTarget(info);
  };

  const handleDeleteForMe = (msg: UIMessage) => {
    if (activeChatId) {
      deleteMessageLocally(activeChatId, msg.id);
      showToast({ type: 'info', message: 'Message deleted for you' });
    }
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  const handleDeleteForEveryone = async (msg: UIMessage) => {
    if (activeChatId) {
      try {
        await deleteMessageForEveryone(activeChatId, msg.id);
        showToast({ type: 'info', message: 'Message deleted for everyone' });
      } catch (err: any) {
        showToast({ type: 'error', message: err.message || 'Failed to delete for everyone' });
      }
    }
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  const handleTogglePinMessage = async (msg: UIMessage) => {
    if (!activeChatId) return;
    if (activeConversation?.pinnedMessageId === msg.id) {
      await unpinMessage(activeChatId);
      showToast({ type: 'info', message: 'Message unpinned' });
    } else {
      await pinMessage(activeChatId, msg.id);
      showToast({ type: 'success', message: 'Message pinned to top' });
    }
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  // Selection Mode Actions
  const handleToggleSelectMessage = useCallback((msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const handleBatchDelete = () => {
    if (!activeChatId) return;
    for (const id of selectedMessageIds) {
      deleteMessageLocally(activeChatId, id);
    }
    showToast({ type: 'info', message: `Deleted ${selectedMessageIds.size} messages` });
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleBatchCopy = () => {
    const selectedTexts = activeMessages
      .filter((m) => selectedMessageIds.has(m.id))
      .map((m) => `${m.senderName || 'User'}: ${m.text || m.attachment?.name || 'Media'}`)
      .join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(selectedTexts);
      showToast({ type: 'success', message: `Copied ${selectedMessageIds.size} messages` });
    }
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleSelectAll = () => {
    if (selectedMessageIds.size === activeMessages.length && activeMessages.length > 0) {
      setSelectedMessageIds(new Set());
    } else {
      setSelectedMessageIds(new Set(activeMessages.map((m) => m.id)));
    }
  };

  const handleBatchForward = () => {
    const firstSelected = activeMessages.find((m) => selectedMessageIds.has(m.id));
    if (firstSelected) {
      setForwardingMessage(firstSelected);
    }
  };

  const handleBatchStar = () => {
    showToast({ type: 'success', message: `Starred ${selectedMessageIds.size} message(s)` });
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };


  if (!activeChatId) {
    return (
      <div className="veil-conversation-empty" role="region" aria-label="No conversation selected">
        <div className="veil-empty-chat-placeholder">
          <div className="veil-empty-chat-icon-container">
            <ShieldIcon size={36} color="var(--veil-accent-primary)" />
          </div>
          <h3 className="veil-empty-chat-title">Your conversations are encrypted by default</h3>
          <p className="veil-empty-chat-subtitle">Select a conversation to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="veil-conversation veil-conversation-view"
      role="main"
      aria-label={`Chat with ${conversationName}`}
      onTouchStart={handleChatBackTouchStart}
      onTouchMove={handleChatBackTouchMove}
      onTouchEnd={finishChatBackSwipe}
      onTouchCancel={() => finishChatBackSwipe()}
      style={{
        transform: chatBackOffset ? `translateX(${chatBackOffset}px)` : undefined,
        transition: chatBackOffset ? 'none' : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Top Header Bar */}
      {isSelectionMode ? (
        <div className="veil-chat-header veil-selection-header" role="toolbar">
          <div className="veil-selection-header-left">
            <IconButton
              icon={<CloseIcon size={20} />}
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedMessageIds(new Set());
              }}
              aria-label="Cancel selection"
              variant="ghost"
            />
            <div className="veil-selection-header-title-group">
              <div className="veil-selection-title-row">
                <span className="veil-selection-count-text">
                  {selectedMessageIds.size} selected
                </span>
                <span className="veil-selection-badge">Messages</span>
              </div>
              <div className="veil-selection-subtitle">
                with {conversationName || 'Contact'}
              </div>
            </div>
          </div>

          <div className="veil-selection-header-right">
            <IconButton
              icon={<StarIcon size={19} />}
              onClick={handleBatchStar}
              disabled={selectedMessageIds.size === 0}
              aria-label="Star selected messages"
              variant="ghost"
            />
            <button
              type="button"
              className="veil-selection-select-all-btn"
              onClick={handleSelectAll}
            >
              {selectedMessageIds.size === activeMessages.length && activeMessages.length > 0
                ? 'Deselect all'
                : 'Select all'}
            </button>
          </div>
        </div>
      ) : (
        <div className="veil-chat-header" role="banner">
          <div className="veil-chat-header-left">
            <button
              type="button"
              className="veil-btn-back veil-mobile-only"
              onClick={() => selectConversation(null)}
              aria-label="Back to conversations list"
            >
              <ArrowLeftIcon size={20} />
            </button>

            <div
              className="veil-chat-header-avatar-group"
              onClick={() => {
                if (activeConversation?.type === 'group') {
                  openModal({ type: 'groupDetails', conversationId: activeChatId });
                } else {
                  openModal({
                    type: 'profile',
                    peerId: activeContact?.identityId || activeChatId,
                    peerUsername: activeContact?.accountUsername || (activeContact?.name?.startsWith('@') ? activeContact.name.slice(1) : undefined),
                  });
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="View contact details"
            >
              <Avatar
                name={conversationName}
                imageUrl={activeConversation?.avatar || activeContact?.avatar}
                size="md"
                isGroup={activeConversation?.type === 'group'}
              />
              <div className="veil-chat-header-titles">
                <div className="veil-chat-header-name">
                  <span>{conversationName}</span>
                  {(activeContact?.verificationStatus === 'VERIFIED' || activeConversation?.isVerified) && (
                    <span className="veil-verified-badge" title="Identity Verified" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <CheckIcon size={12} color="var(--veil-accent-primary)" />
                      <span>Verified</span>
                    </span>
                  )}
                  {activeContact?.verificationStatus === 'MISMATCH' && (
                    <span className="veil-mismatch-badge" title="Key Changed" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <AlertCircleIcon size={12} color="var(--veil-danger)" />
                      <span>Key Changed</span>
                    </span>
                  )}
                </div>
                <div className="veil-chat-header-status">
                  <span className="veil-status-dot online" />
                  <span className="veil-status-text">
                    {activeConversation?.type === 'group'
                      ? `${Object.keys(activeConversation.groupState?.members || {}).length} members • End-to-End Encrypted`
                      : 'End-to-End Encrypted'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="veil-chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <IconButton
              icon={<SearchIcon size={18} />}
              onClick={() => setIsSearchingInChat(!isSearchingInChat)}
              aria-label="Search within conversation"
              variant="ghost"
            />
            <IconButton
              icon={<GridIcon size={18} />}
              onClick={() => setShowGallery(true)}
              aria-label="View shared media gallery"
              variant="ghost"
            />
            <IconButton
              icon={<MoreVerticalIcon size={18} />}
              onClick={() => {
                if (activeConversation?.type === 'group') {
                  openModal({ type: 'groupDetails', conversationId: activeChatId });
                } else {
                  openModal({
                    type: 'profile',
                    peerId: activeContact?.identityId || activeChatId,
                    peerUsername: activeContact?.accountUsername || (activeContact?.name?.startsWith('@') ? activeContact.name.slice(1) : undefined),
                  });
                }
              }}
              aria-label="Conversation details"
              variant="ghost"
            />
          </div>
        </div>
      )}

      {/* Pinned Message Strip */}
      {pinnedMessage && (
        <div
          className="veil-pinned-bar"
          onClick={() => handleJumpToMessage(pinnedMessage.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            backgroundColor: 'var(--bg-secondary, #15171c)',
            borderBottom: '1px solid var(--border-color, #272a34)',
            cursor: 'pointer',
            fontSize: '13px',
            transition: 'background-color 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div style={{ color: 'var(--accent-color, #14b8a6)', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-color, #14b8a6)' }}>Pinned Message</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary, #94a3b8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pinnedMessage.text || (pinnedMessage.attachment ? 'Photo / Attachment' : 'Voice Message')}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeChatId) unpinMessage(activeChatId);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Unpin Message"
            aria-label="Unpin Message"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}

      {/* In-Chat Search Bar */}
      {isSearchingInChat && (
        <div className="veil-chat-search-bar" role="search">
          <input
            type="text"
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            placeholder="Search messages in this chat..."
            className="veil-chat-search-input"
            autoFocus
          />
          <IconButton
            icon={<CloseIcon size={16} />}
            onClick={() => {
              setIsSearchingInChat(false);
              setLocalSearchQuery('');
            }}
            aria-label="Close chat search"
            variant="ghost"
            size="sm"
          />
        </div>
      )}

      {/* Message Timeline */}
      <div
        ref={timelineRef}
        className="veil-timeline"
        role="log"
        aria-label="Message history"
        onScroll={handleTimelineScroll}
      >
        {displayedMessages.length === 0 ? (
          <div className="veil-timeline-empty">
            <div className="veil-timeline-encryption-shield">
              <ShieldIcon size={44} color="var(--veil-accent-primary)" />
            </div>
            <h3>End-to-End Encrypted Conversation</h3>
            <p>Messages, photos, videos, files, and voice notes are cryptographically protected.</p>
          </div>
        ) : (
          displayedMessages.map((msg, index) => {
            const isUnreadFirst = firstUnreadIndex >= 0 && msg.id === activeMessages[firstUnreadIndex]?.id;
            const isSelected = selectedMessageIds.has(msg.id);
            const isHighlighted = highlightedMessageId === msg.id;
            const prevMsg = index > 0 ? displayedMessages[index - 1] : null;
            const nextMsg = index < displayedMessages.length - 1 ? displayedMessages[index + 1] : null;
            const isGroupedWithPrevious = Boolean(prevMsg && prevMsg.isOutgoing === msg.isOutgoing && Math.abs(msg.timestamp - prevMsg.timestamp) < 60000);
            const isGroupedWithNext = Boolean(nextMsg && nextMsg.isOutgoing === msg.isOutgoing && Math.abs(nextMsg.timestamp - msg.timestamp) < 60000);

            const isGroupConversation = Boolean(
              activeConversation?.type === 'group' ||
              (activeChatId && activeChatId.startsWith('grp_')) ||
              Boolean(activeConversation?.groupState)
            );

            return (
              <ConversationMessageRow
                key={msg.id}
                msg={msg}
                isUnreadFirst={isUnreadFirst}
                isSelected={isSelected}
                isSelectionMode={isSelectionMode}
                isHighlighted={isHighlighted}
                isContextActive={contextMenu.isOpen && contextMenu.message?.id === msg.id}
                isGroupedWithPrevious={isGroupedWithPrevious}
                isGroupedWithNext={isGroupedWithNext}
                isGroup={isGroupConversation}
                downloadingAttachmentId={downloadingAttachmentId}
                downloadProgress={downloadProgress}
                downloadPercent={downloadProgress?.[msg.id]?.percent}
                downloadLoadedBytes={downloadProgress?.[msg.id]?.loaded}
                uploadProgress={uploadProgress}
                uploadPercent={
                  uploadProgress?.[msg.id]?.percent ??
                  (msg.attachment?.attachmentId ? uploadProgress?.[msg.attachment.attachmentId]?.percent : undefined) ??
                  (msg.attachment?.objectId ? uploadProgress?.[msg.attachment.objectId]?.percent : undefined) ??
                  msg.uploadProgress
                }
                uploadLoadedBytes={
                  uploadProgress?.[msg.id]?.loaded ??
                  (msg.attachment?.attachmentId ? uploadProgress?.[msg.attachment.attachmentId]?.loaded : undefined) ??
                  (msg.attachment?.objectId ? uploadProgress?.[msg.attachment.objectId]?.loaded : undefined)
                }
                playbackProgress={playbackProgress}
                playbackCurrentTime={playbackCurrentTime}
                playingAudioId={playingAudioId}
                isAudioPlaying={playingAudioId === msg.id}
                unreadRef={unreadRef}
                onToggleSelect={handleToggleSelectMessage}
                onContextMenu={handleContextMenu}
                onReplyTrigger={setReplyTarget}
                onJumpToMessage={handleJumpToMessage}
                onOpenGroupedMedia={handleOpenGroupedMedia}
                onOpenMedia={handleOpenMedia}
                onDownloadAttachment={handleDownloadAttachment}
                onToggleVoice={handleToggleVoice}
                onSeekVoice={handleSeekVoice}
                onRetry={handleRetryMessage}
                peerAvatar={activeConversation?.avatar || activeConversation?.avatarUrl}
                onReactionClick={handleReactionClick}
              />
            );
          })
        )}
        <div ref={timelineEndRef} />
      </div>

      {/* Floating Context Menu Backdrop */}
      {contextMenu.isOpen && (
        <div
          className="veil-context-backdrop"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
          }}
          aria-hidden="true"
        />
      )}

      {/* Floating Reactions Pill (Rendered directly above the message / context menu) */}
      {contextMenu.isOpen && contextMenu.message && (
        <div
          className="veil-floating-reactions-pill veil-context-reactions-bar"
          style={{
            position: 'fixed',
            top: `${Math.max(12, contextMenu.y - 56)}px`,
            left: `${Math.min(Math.max(12, contextMenu.x), window.innerWidth - 270)}px`,
            zIndex: 1052,
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          {displayEmojis.map((emoji) => {
            const isUserReacted = Boolean(
              (contextMenu.message as any)?.reactions?.some(
                (r: any) => r.emoji === emoji && r.userReacted
              )
            );
            return (
              <button
                key={emoji}
                type="button"
                className={`veil-context-reaction-btn ${isUserReacted ? 'veil-reaction-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeChatId && contextMenu.message) {
                    toggleMessageReaction(activeChatId, contextMenu.message.id, emoji);
                    handleUpdateRecentEmojis(emoji);
                  }
                  setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
                }}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            );
          })}
          <div className="veil-reactions-divider" />
          {/* Plus icon button for full emoji picker */}
          <button
            type="button"
            className="veil-emoji-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              const target = contextMenu.message;
              setEmojiTargetMessage(target);
              setIsEmojiPickerOpen(true);
              setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
            }}
            aria-label="More emojis"
            title="More emojis"
          >
            <span style={{ fontSize: '18px', fontWeight: 400, lineHeight: 1 }}>+</span>
          </button>
        </div>
      )}

      {/* Floating Context Menu Actions Card */}
      {contextMenu.isOpen && contextMenu.message && (
        <div
          ref={contextMenuRef}
          className="veil-context-menu"
          style={{
            top: `${Math.min(Math.max(68, contextMenu.y + 6), window.innerHeight - 300)}px`,
            left: `${Math.min(Math.max(12, contextMenu.x), window.innerWidth - 240)}px`,
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            type="button"
            className="veil-context-item"
            onClick={() => handleReplyToMessage(contextMenu.message!)}
          >
            <ReplyIcon size={16} />
            <span>Reply</span>
          </button>

          {/* Edit button — only for own text messages without attachments/voice */}
          {contextMenu.message.isOutgoing && contextMenu.message.text && !contextMenu.message.voice && !contextMenu.message.attachment && (
            <button
              type="button"
              className="veil-context-item"
              onClick={() => handleStartEdit(contextMenu.message!)}
            >
              <EditIcon size={16} />
              <span>Edit</span>
            </button>
          )}

          {contextMenu.message.text && (
            <button
              type="button"
              className="veil-context-item"
              onClick={() => handleCopyText(contextMenu.message!.text)}
            >
              <CopyIcon size={16} />
              <span>Copy Text</span>
            </button>
          )}

          <button
            type="button"
            className="veil-context-item"
            onClick={() => {
              const target = contextMenu.message!;
              setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
              setForwardingMessage(target);
            }}
          >
            <ShareIcon size={16} />
            <span>Forward</span>
          </button>

          <button
            type="button"
            className="veil-context-item"
            onClick={() => handleTogglePinMessage(contextMenu.message!)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
            </svg>
            <span>
              {activeConversation?.pinnedMessageId === contextMenu.message.id ? 'Unpin Message' : 'Pin Message'}
            </span>
          </button>

          {contextMenu.message.attachment && (
            <button
              type="button"
              className="veil-context-item"
              onClick={() => handleDownloadAttachment(contextMenu.message!)}
            >
              <DownloadIcon size={16} />
              <span>Save to Storage</span>
            </button>
          )}

          {contextMenu.message.voice && !contextMenu.message.attachment && (
            <button
              type="button"
              className="veil-context-item"
              onClick={() => handleDownloadAttachment(contextMenu.message!)}
            >
              <DownloadIcon size={16} />
              <span>Save Audio</span>
            </button>
          )}

          {(contextMenu.message.attachment || contextMenu.message.voice) && (
            <button
              type="button"
              className="veil-context-item"
              onClick={() => handleViewInfo(contextMenu.message!)}
            >
              <InfoIcon size={16} />
              <span>View Info</span>
            </button>
          )}

          <button
            type="button"
            className="veil-context-item"
            onClick={() => {
              setIsSelectionMode(true);
              setSelectedMessageIds(new Set([contextMenu.message!.id]));
              setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
            }}
          >
            <CheckIcon size={16} />
            <span>Select Messages</span>
          </button>

          <button
            type="button"
            className="veil-context-item veil-context-item-danger"
            onClick={() => handleDeleteForMe(contextMenu.message!)}
          >
            <TrashIcon size={16} />
            <span>Delete for Me</span>
          </button>

          {contextMenu.message?.isOutgoing && (
            <button
              type="button"
              className="veil-context-item veil-context-item-danger"
              onClick={() => {
                const target = contextMenu.message!;
                setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
                setDeleteForEveryoneConfirm(target);
              }}
            >
              <TrashIcon size={16} />
              <span>Delete for Everyone</span>
            </button>
          )}
        </div>
      )}

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onSelect={(emoji) => {
          const target = emojiTargetMessage || contextMenu.message;
          if (activeChatId && target) {
            toggleMessageReaction(activeChatId, target.id, emoji);
            handleUpdateRecentEmojis(emoji);
          }
          setIsEmojiPickerOpen(false);
          setEmojiTargetMessage(null);
          setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
        }}
        onClose={() => {
          setIsEmojiPickerOpen(false);
          setEmojiTargetMessage(null);
        }}
      />

      {/* Delete for Everyone Confirmation Modal */}
      {deleteForEveryoneConfirm && (
        <div
          className="veil-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              setDeleteForEveryoneConfirm(null);
            }
          }}
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              setDeleteForEveryoneConfirm(null);
            }
          }}
          style={{ zIndex: 1100 }}
        >
          <div
            className="veil-modal-card"
            style={{
              maxWidth: '400px',
              padding: '24px',
              background: 'var(--veil-bg-surface-elevated, #161b22)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-labelledby="delete-confirm-title"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: 'var(--veil-danger, #ef4444)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertCircleIcon size={22} />
              </div>
              <h3 id="delete-confirm-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
                Delete for Everyone?
              </h3>
            </div>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.875rem', color: 'var(--veil-text-secondary)', lineHeight: 1.5 }}>
              This message will be permanently removed for all participants in this conversation. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button
                variant="ghost"
                onClick={() => setDeleteForEveryoneConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (activeChatId && deleteForEveryoneConfirm) {
                    try {
                      await deleteMessageForEveryone(activeChatId, deleteForEveryoneConfirm.id);
                      showToast({ type: 'info', message: 'Message deleted for everyone' });
                    } catch (err: any) {
                      showToast({ type: 'error', message: err.message || 'Failed to delete for everyone' });
                    }
                  }
                  setDeleteForEveryoneConfirm(null);
                }}
              >
                Delete for Everyone
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Forward Conversation Picker Modal */}
      {forwardingMessage && (
        <div
          className="veil-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              setForwardingMessage(null);
            }
          }}
          onTouchEnd={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              e.stopPropagation();
              setForwardingMessage(null);
            }
          }}
          style={{ zIndex: 1100 }}
        >
          <div
            className="veil-modal-card"
            style={{
              maxWidth: '440px',
              width: '90vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '20px',
              background: 'var(--veil-bg-surface-elevated, #161b22)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="forward-dialog-title"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 id="forward-dialog-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--veil-text-primary)' }}>
                Forward Message
              </h3>
              <IconButton
                icon={<CloseIcon size={18} />}
                onClick={() => setForwardingMessage(null)}
                ariaLabel="Close forward dialog"
              />
            </div>

            {/* Message snippet preview */}
            <div
              style={{
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderLeft: '3px solid var(--veil-accent-primary, #14b8a6)',
                borderRadius: '6px',
                marginBottom: '12px',
                fontSize: '0.85rem',
                color: 'var(--veil-text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {forwardingMessage.text || forwardingMessage.attachment?.name || (forwardingMessage.voice ? 'Voice Note' : 'Media Attachment')}
            </div>

            {/* Attribution toggle option */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                marginBottom: '14px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--veil-text-primary)' }}>
                  Include sender attribution
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--veil-text-secondary)' }}>
                  {includeAttribution
                    ? `Shows "Forwarded from ${forwardingMessage.senderName || conversationName || 'Sender'}"`
                    : 'Attribution hidden (forward message only)'}
                </span>
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={includeAttribution}
                  onChange={(e) => setIncludeAttribution(e.target.checked)}
                  style={{
                    accentColor: 'var(--veil-accent-primary, #14b8a6)',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer',
                  }}
                  aria-label="Include sender attribution when forwarding"
                />
              </label>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--veil-text-secondary)', fontSize: '0.875rem' }}>
                  No other conversations available
                </div>
              ) : (
                conversations
                  .filter((c) => c.id !== activeChatId)
                  .concat(conversations.filter((c) => c.id === activeChatId))
                  .map((conv) => (
                    <button
                      key={conv.id}
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--veil-text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={async () => {
                        const target = forwardingMessage;
                        const withAttribution = includeAttribution;
                        setForwardingMessage(null);
                        try {
                          await forwardMessage(conv.id, target, { includeAttribution: withAttribution });
                          showToast({ type: 'success', message: `Forwarded to ${conv.name || 'Chat'}` });
                        } catch (err: any) {
                          showToast({ type: 'error', message: err.message || 'Failed to forward message' });
                        }
                      }}
                    >
                      <Avatar
                        src={conv.avatar || conv.avatarUrl}
                        seed={conv.id}
                        name={conv.name}
                        size={36}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.name || `@${conv.id.slice(0, 8)}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--veil-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.id === activeChatId ? 'Current Chat' : (conv.unreadCount ? `${conv.unreadCount} unread` : 'Tap to forward')}
                        </div>
                      </div>
                      <ShareIcon size={16} style={{ opacity: 0.6 }} />
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selection Mode Bottom Action Dock Bar */}
      {isSelectionMode ? (
        <div className="veil-selection-bottom-dock" role="toolbar" aria-label="Selection actions">
          <button
            type="button"
            className="veil-selection-dock-btn"
            onClick={handleBatchForward}
            disabled={selectedMessageIds.size === 0}
            aria-label="Forward selected messages"
          >
            <ShareIcon size={20} />
            <span>Forward</span>
          </button>

          <button
            type="button"
            className="veil-selection-dock-btn"
            onClick={handleBatchCopy}
            disabled={selectedMessageIds.size === 0}
            aria-label="Copy selected messages"
          >
            <CopyIcon size={20} />
            <span>Copy</span>
          </button>

          <button
            type="button"
            className="veil-selection-dock-btn"
            onClick={handleBatchStar}
            disabled={selectedMessageIds.size === 0}
            aria-label="Star selected messages"
          >
            <StarIcon size={20} />
            <span>Star</span>
          </button>

          <button
            type="button"
            className="veil-selection-dock-btn veil-selection-dock-delete"
            onClick={handleBatchDelete}
            disabled={selectedMessageIds.size === 0}
            aria-label="Delete selected messages"
          >
            <TrashIcon size={18} />
            <span>Delete ({selectedMessageIds.size})</span>
          </button>
        </div>
      ) : (
        <MessageComposer
          conversationId={activeChatId}
          editingMessage={editingMessage}
          onCancelEdit={handleCancelEdit}
          onConfirmEdit={handleConfirmEdit}
        />
      )}

      {/* Fullscreen Media Viewer Modal */}
      {viewerItem && (
        <MediaViewer
          items={viewerMediaList}
          initialIndex={viewerMediaList.findIndex((i) => i.id === viewerItem.id)}
          onClose={() => setViewerItem(null)}
          onDownload={(item) => {
            const targetMsg = activeMessages.find((m) => m.id === item.id || item.id.startsWith(`${m.id}_`));
            if (targetMsg) handleDownloadAttachment(targetMsg);
          }}
          onShare={async (item) => {
            const targetMsg = activeMessages.find((m) => m.id === item.id || item.id.startsWith(`${m.id}_`));
            if (targetMsg) handleDownloadAttachment(targetMsg);
          }}
        />
      )}

      {/* Shared Media Gallery Modal */}
      {showGallery && (
        <MediaGalleryModal
          conversationName={conversationName}
          messages={activeMessages}
          onClose={() => setShowGallery(false)}
          onOpenMedia={(item, allItems) => {
            setViewerMediaList(allItems);
            setViewerItem(item);
          }}
          onDownloadFile={(msg) => handleDownloadAttachment(msg)}
        />
      )}

      {/* Media Information Inspector Modal */}
      {mediaInfoTarget && (
        <MediaInfoModal
          isOpen={!!mediaInfoTarget}
          onClose={() => setMediaInfoTarget(null)}
          info={mediaInfoTarget}
        />
      )}
    </div>
  );
};
