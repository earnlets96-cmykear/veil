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
import { FileSaver } from '../utils/fileSaver.ts';
import { MediaCache } from '../utils/mediaCache.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  EmptyState,
  AttachmentCard,
  VoiceNoteCard,
  MessageBubble,
  ReplyPreview,
  MessageStatus,
  useToast,
} from './ui/index.ts';
import {
  ArrowLeftIcon,
  SearchIcon,
  GridIcon,
  MoreVerticalIcon,
  DownloadIcon,
  CopyIcon,
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
  downloadingAttachmentId: string | null;
  playbackProgress: Record<string, number>;
  playbackCurrentTime: Record<string, number>;
  playingAudioId: string | null;
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
}

const ConversationMessageRow: React.FC<ConversationMessageRowProps> = ({
  msg,
  isUnreadFirst,
  isSelected,
  isSelectionMode,
  isHighlighted,
  downloadingAttachmentId,
  playbackProgress,
  playbackCurrentTime,
  playingAudioId,
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
}) => {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isMedia =
    msg.attachment &&
    (msg.attachment.mimeType?.startsWith('image/') ||
      msg.attachment.mimeType?.startsWith('video/'));
  const isGrouped = Boolean(msg.attachments && msg.attachments.length > 1);
  const hasVisibleTextBubble = Boolean(
    msg.text &&
    !msg.text.startsWith('Attachment:') &&
    !msg.text.includes('Attachment:') &&
    msg.text !== 'Voice Message'
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    longPressTimerRef.current = setTimeout(() => {
      onContextMenu(e as any, msg);
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
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
        } ${isHighlighted ? 'veil-message-highlight' : ''}`}
        onClick={() => {
          if (isSelectionMode) onToggleSelect(msg.id);
        }}
        onContextMenu={(e) => onContextMenu(e, msg)}
        onTouchStart={!hasVisibleTextBubble ? handleTouchStart : undefined}
        onTouchMove={!hasVisibleTextBubble ? handleTouchMove : undefined}
        onTouchEnd={!hasVisibleTextBubble ? handleTouchEnd : undefined}
        onTouchCancel={!hasVisibleTextBubble ? handleTouchEnd : undefined}
        style={{ position: 'relative' }}
      >
        {isSelectionMode && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(msg.id)}
            className="veil-msg-checkbox"
            aria-label="Select message"
          />
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

        <div
          className={`veil-bubble-wrapper ${isSelected ? 'selected' : ''}`}
          style={{
            transform: !hasVisibleTextBubble ? `translateX(${swipeOffset}px)` : undefined,
            transition: !hasVisibleTextBubble && swipeOffset === 0 ? 'transform 0.15s ease-out' : 'none',
          }}
        >
          {/* Quoted Reply Reference for Non-Text Bubbles */}
          {msg.replyTo && !hasVisibleTextBubble && (
            <div style={{ marginBottom: '6px', maxWidth: '320px' }}>
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
                onOpenItem={(idx) => onOpenGroupedMedia(msg, idx)}
              />
              <div className="veil-media-meta-overlay">
                <span className="veil-media-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {msg.isOutgoing && <MessageStatus status={msg.status} />}
              </div>
            </div>
          )}

          {/* Single Media Image / Video Card */}
          {!isGrouped && isMedia && msg.attachment && (
            <div className="veil-media-bubble-container">
              <MediaImage
                attachment={msg.attachment}
                isVideo={msg.attachment.mimeType?.startsWith('video/')}
                onClick={() => {
                  if (!isSelectionMode) onOpenMedia(msg);
                }}
                alt={msg.attachment.name}
              />
              <div className="veil-media-meta-overlay">
                <span className="veil-media-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                {msg.isOutgoing && <MessageStatus status={msg.status} />}
              </div>
            </div>
          )}

          {/* Standard File Attachment Card */}
          {!isGrouped && msg.attachment && !isMedia && (
            <AttachmentCard
              name={msg.attachment.name}
              sizeBytes={msg.attachment.sizeBytes}
              mimeType={msg.attachment.mimeType}
              status={downloadingAttachmentId === msg.id ? 'downloading' : 'ready'}
              onDownload={() => onDownloadAttachment(msg)}
            />
          )}

          {/* Voice Note Card */}
          {msg.voice && (
            <VoiceNoteCard
              durationSeconds={msg.voice.durationSeconds}
              currentTimeSeconds={playbackCurrentTime[msg.id] || 0}
              isOutgoing={msg.isOutgoing}
              playbackState={
                msg.status === 'UPLOADING'
                  ? 'uploading'
                  : msg.status === 'FAILED'
                  ? 'error'
                  : playingAudioId === msg.id
                  ? 'playing'
                  : 'ready'
              }
              currentProgressPercent={playbackProgress[msg.id] || 0}
              onPlayToggle={() => onToggleVoice(msg)}
              onSeek={(percent) => onSeekVoice(msg, percent)}
              onRetry={() => onToggleVoice(msg)}
            />
          )}

          {/* Text Message Bubble */}
          {hasVisibleTextBubble && (
            <MessageBubble
              id={msg.id}
              senderName={msg.senderName}
              isOutgoing={msg.isOutgoing}
              text={msg.text}
              timestamp={msg.timestamp}
              status={msg.status}
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
              onReplyTrigger={() => onReplyTrigger(msg)}
              onRetry={onRetry ? () => onRetry(msg) : undefined}
            />
          )}
        </div>
      </div>
    </React.Fragment>
  );
};

export const ConversationView: React.FC = () => {
  const {
    activeSession,
    activeChatId,
    conversations,
    contacts,
    messages,
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
  } = useApp();

  const { showToast } = useToast();

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);

  // Search & Navigation State
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  // Fullscreen Media Viewer State
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null);
  const [viewerMediaList, setViewerMediaList] = useState<MediaViewerItem[]>([]);

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

  // First unread message index for divider
  const firstUnreadIndex = useMemo(() => {
    if (!activeConversation || activeConversation.unreadCount <= 0) return -1;
    const incoming = activeMessages.map((m, i) => ({ isOut: m.isOutgoing, idx: i })).filter((x) => !x.isOut);
    if (incoming.length === 0) return -1;
    const unreadItems = incoming.slice(-activeConversation.unreadCount);
    return unreadItems.length > 0 ? unreadItems[0].idx : -1;
  }, [activeConversation, activeMessages]);

  // Auto-scroll timeline to bottom on load/new message or to unread divider
  useEffect(() => {
    if (firstUnreadIndex >= 0 && unreadRef.current) {
      unreadRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (timelineEndRef.current) {
      timelineEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChatId, activeMessages.length, firstUnreadIndex]);

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

  // Handle Jump-to-message
  const handleJumpToMessage = useCallback((targetMsgId: string) => {
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
  }, [showToast]);

  // Track playback progress & current time per message
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  const [playbackCurrentTime, setPlaybackCurrentTime] = useState<Record<string, number>>({});

  // Handle Voice Note Playback
  const handleToggleVoice = async (msg: UIMessage) => {
    if (!msg.voice || !activeSession) return;

    if (playingAudioId === msg.id) {
      VoicePlayer.stop();
      setPlayingAudioId(null);
      setPlaybackProgress((prev) => ({ ...prev, [msg.id]: 0 }));
      return;
    }

    try {
      if (!cloudClient.hasAuthenticatedSession()) {
        await ensureCloudSession(activeSession);
      }

      setPlayingAudioId(msg.id);
      await VoicePlayer.playVoiceNote(activeSession, cloudClient, msg.voice, msg.id, {
        onProgress: (percent, currentTime) => {
          setPlaybackProgress((prev) => ({ ...prev, [msg.id]: percent }));
          setPlaybackCurrentTime((prev) => ({ ...prev, [msg.id]: currentTime }));
        },
        onEnded: () => {
          setPlayingAudioId(null);
          setPlaybackProgress((prev) => ({ ...prev, [msg.id]: 0 }));
          setPlaybackCurrentTime((prev) => ({ ...prev, [msg.id]: 0 }));
        },
        onError: (err) => {
          setPlayingAudioId(null);
          setPlaybackProgress((prev) => ({ ...prev, [msg.id]: 0 }));
          setPlaybackCurrentTime((prev) => ({ ...prev, [msg.id]: 0 }));
          showToast({ type: 'error', message: err.message || 'Failed to play voice message' });
        },
      });
    } catch (err: any) {
      setPlayingAudioId(null);
      setPlaybackProgress((prev) => ({ ...prev, [msg.id]: 0 }));
      setPlaybackCurrentTime((prev) => ({ ...prev, [msg.id]: 0 }));
      showToast({ type: 'error', message: err.message || 'Failed to play voice message' });
    }
  };

  // Handle Attachment Download & Saving with Privacy Enforcement
  const handleDownloadAttachment = async (msg: UIMessage) => {
    if (!msg.attachment || !activeSession) return;

    // Check if sender disallowed saving
    if (msg.attachment.allowSave === false && !msg.isOutgoing) {
      showToast({
        type: 'error',
        message: 'Saving disabled by sender for this media item',
      });
      return;
    }

    setDownloadingAttachmentId(msg.id);
    try {
      const key = msg.attachment.objectId || msg.attachment.attachmentId || msg.attachment.name;
      let cached = MediaCache.get(key);

      if (!cached) {
        if (!cloudClient.getSessionToken()) {
          await ensureCloudSession(activeSession);
        }
        cached = await MediaCache.getOrFetch(msg.attachment, activeSession, cloudClient);
      }

      if (cached && cached.data) {
        const saved = await FileSaver.saveFile({
          data: cached.data,
          filename: msg.attachment.name,
          mimeType: msg.attachment.mimeType,
        });
        if (saved) {
          showToast({
            type: 'success',
            message: `Saved ${msg.attachment.name} successfully`,
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
    }
  };

  // Open Fullscreen Media Viewer
  const handleOpenMedia = (msg: UIMessage) => {
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
  };

  const handleOpenGroupedMedia = (msg: UIMessage, index: number) => {
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
  };

  // Context Menu Trigger (Long-press / right click)
  const handleContextMenu = (e: React.MouseEvent, msg: UIMessage) => {
    e.preventDefault();
    if (isSelectionMode) return;
    setContextMenu({
      isOpen: true,
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 280),
      message: msg,
    });
  };

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

  // Selection Mode Actions
  const handleToggleSelectMessage = (msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

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

  // Close context menu on outside click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.isOpen) {
        setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu.isOpen]);

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
    <div className="veil-conversation veil-conversation-view" role="main" aria-label={`Chat with ${conversationName}`}>
      {/* Top Header Bar */}
      {isSelectionMode ? (
        <div className="veil-chat-header veil-selection-header" role="toolbar">
          <div className="veil-selection-info">
            <IconButton
              icon={<CloseIcon size={20} />}
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedMessageIds(new Set());
              }}
              aria-label="Cancel selection"
              variant="ghost"
            />
            <span className="veil-selection-count">
              {selectedMessageIds.size} selected
            </span>
          </div>

          <div className="veil-selection-actions">
            <IconButton
              icon={<CopyIcon size={18} />}
              onClick={handleBatchCopy}
              disabled={selectedMessageIds.size === 0}
              aria-label="Copy selected messages"
              variant="ghost"
            />
            <IconButton
              icon={<TrashIcon size={18} />}
              onClick={handleBatchDelete}
              disabled={selectedMessageIds.size === 0}
              aria-label="Delete selected messages"
              variant="danger"
            />
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

          <div className="veil-chat-header-actions">
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
      >
        {activeMessages.length === 0 ? (
          <div className="veil-timeline-empty">
            <div className="veil-timeline-encryption-shield">
              <ShieldIcon size={44} color="var(--veil-accent-primary)" />
            </div>
            <h3>End-to-End Encrypted Conversation</h3>
            <p>Messages, photos, videos, files, and voice notes are cryptographically protected.</p>
          </div>
        ) : (
          activeMessages.map((msg, index) => {
            const isUnreadFirst = index === firstUnreadIndex;
            const isSelected = selectedMessageIds.has(msg.id);
            const isHighlighted = highlightedMessageId === msg.id;

            return (
              <ConversationMessageRow
                key={msg.id}
                msg={msg}
                isUnreadFirst={isUnreadFirst}
                isSelected={isSelected}
                isSelectionMode={isSelectionMode}
                isHighlighted={isHighlighted}
                downloadingAttachmentId={downloadingAttachmentId}
                playbackProgress={playbackProgress}
                playbackCurrentTime={playbackCurrentTime}
                playingAudioId={playingAudioId}
                unreadRef={unreadRef}
                onToggleSelect={handleToggleSelectMessage}
                onContextMenu={handleContextMenu}
                onReplyTrigger={setReplyTarget}
                onJumpToMessage={handleJumpToMessage}
                onOpenGroupedMedia={handleOpenGroupedMedia}
                onOpenMedia={handleOpenMedia}
                onDownloadAttachment={handleDownloadAttachment}
                onToggleVoice={handleToggleVoice}
                onSeekVoice={(m, percent) => {
                  VoicePlayer.seek(percent, m.id);
                  setPlaybackProgress((prev) => ({ ...prev, [m.id]: percent }));
                  setPlaybackCurrentTime((prev) => ({
                    ...prev,
                    [m.id]: (percent / 100) * (m.voice?.durationSeconds || 1),
                  }));
                }}
                onRetry={(m) => activeChatId && retryFailedMessage(activeChatId, m.id)}
              />
            );
          })
        )}
        <div ref={timelineEndRef} />
      </div>

      {/* Floating Context Menu */}
      {contextMenu.isOpen && contextMenu.message && (
        <div
          className="veil-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
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

          {contextMenu.message.attachment && (
            <button
              type="button"
              className="veil-context-item"
              onClick={() => handleDownloadAttachment(contextMenu.message!)}
            >
              <DownloadIcon size={16} />
              <span>Save to Gallery</span>
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
              onClick={() => handleDeleteForEveryone(contextMenu.message!)}
            >
              <TrashIcon size={16} />
              <span>Delete for Everyone</span>
            </button>
          )}
        </div>
      )}

      {/* Message Composer */}
      <MessageComposer conversationId={activeChatId} />

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
