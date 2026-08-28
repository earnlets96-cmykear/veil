/**
 * Telegram-Inspired Conversation View Component for VEIL Phase 33.
 *
 * Implements:
 * - Direct inline decrypted image & video thumbnails with smooth loading skeleton
 * - Fullscreen Media Viewer for photos & videos (zoom, pan, gallery nav, HTML5 video player)
 * - In-chat Shared Media Gallery browser (Photos, Videos, Files, Voice Notes)
 * - Native Android & Web file saving via FileSaver utility
 * - Interactive voice note playback with animated waveform scrubber
 * - Multi-message selection mode and rich contextual action sheets
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
import { MediaViewer, MediaViewerItem, MediaGalleryModal, MediaImage } from './media/index.ts';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  message: UIMessage | null;
}

export const ConversationView: React.FC = () => {
  const {
    activeSession,
    activeChatId,
    conversations,
    contacts,
    messages,
    sendMessage,
    sendAttachment,
    selectConversation,
    openModal,
    cloudClient,
    ensureCloudSession,
    setReplyTarget,
    deleteMessage,
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
      contacts.find((c) => c.identityId === activeChatId) ||
      contacts.find((c) => c.name === activeChatId) ||
      null
    );
  }, [activeChatId, contacts]);

  const conversationName =
    activeConversation?.name || activeContact?.name || activeChatId || 'Encrypted Chat';
  const isGroup = activeConversation?.type === 'group';

  // Active Messages
  const activeMessages: UIMessage[] = useMemo(() => {
    if (!activeChatId) return [];
    const directList = messages[activeChatId] || [];
    if (directList.length > 0) return directList;

    if (activeContact?.name && messages[activeContact.name]) {
      return messages[activeContact.name];
    }
    if (activeContact?.identityId && messages[activeContact.identityId]) {
      return messages[activeContact.identityId];
    }
    return [];
  }, [activeChatId, activeContact, messages]);

  // First Unread Index for Divider
  const firstUnreadIndex = useMemo(() => {
    const unreadCount = activeConversation?.unreadCount || 0;
    if (unreadCount <= 0 || activeMessages.length === 0) return -1;
    return Math.max(0, activeMessages.length - unreadCount);
  }, [activeConversation, activeMessages]);

  // Auto-scroll to bottom or unread divider
  useEffect(() => {
    if (unreadRef.current) {
      unreadRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (timelineEndRef.current) {
      timelineEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeChatId, activeMessages.length]);

  // Track playback progress per message
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});

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
      if (!cloudClient.getSessionToken()) {
        await ensureCloudSession(activeSession);
      }

      setPlayingAudioId(msg.id);
      await VoicePlayer.playVoiceNote(activeSession, cloudClient, msg.voice, msg.id, {
        onProgress: (percent) => {
          setPlaybackProgress((prev) => ({ ...prev, [msg.id]: percent }));
        },
        onEnded: () => {
          setPlayingAudioId(null);
          setPlaybackProgress((prev) => ({ ...prev, [msg.id]: 0 }));
        },
        onError: (err) => {
          setPlayingAudioId(null);
          setPlaybackProgress((prev) => ({ ...prev, [msg.id]: 0 }));
          showToast({ type: 'error', message: err.message || 'Failed to play voice message' });
        },
      });
    } catch (err: any) {
      setPlayingAudioId(null);
      setPlaybackProgress((prev) => ({ ...prev, [msg.id]: 0 }));
      showToast({ type: 'error', message: err.message || 'Failed to play voice message' });
    }
  };

  // Handle Attachment Download & Local Storage Save
  const handleDownloadAttachment = async (msg: UIMessage) => {
    if (!msg.attachment || !activeSession) return;
    setDownloadingAttachmentId(msg.id);

    try {
      if (!cloudClient.getSessionToken()) {
        await ensureCloudSession(activeSession);
      }

      // Check MediaCache first
      const key = msg.attachment.objectId || msg.attachment.attachmentId || msg.attachment.name;
      let plaintextBytes: Uint8Array;

      const cached = MediaCache.get(key);
      if (cached && cached.data && cached.data.length > 0) {
        plaintextBytes = cached.data;
      } else {
        const decrypted = await MediaCache.getOrFetch(msg.attachment, activeSession, cloudClient);
        plaintextBytes = decrypted.data;
      }

      // Save via unified FileSaver engine
      const saveResult = await FileSaver.saveFile({
        filename: msg.attachment.name,
        data: plaintextBytes,
        mimeType: msg.attachment.mimeType,
        triggerShare: true,
      });

      if (saveResult.success) {
        showToast({
          type: 'success',
          title: 'File Saved',
          message: `Saved ${msg.attachment.name} to ${saveResult.location}`,
        });
      } else {
        showToast({
          type: 'error',
          message: saveResult.error || 'Failed to save file',
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        message: `Attachment download error: ${err.message || 'Failed to download file'}`,
      });
    } finally {
      setDownloadingAttachmentId(null);
    }
  };

  // Open Media in Fullscreen Viewer
  const handleOpenMedia = (msg: UIMessage) => {
    if (!msg.attachment) return;

    const allMediaMessages = activeMessages.filter(
      (m) =>
        m.attachment &&
        (m.attachment.mimeType?.startsWith('image/') || m.attachment.mimeType?.startsWith('video/'))
    );

    const items: MediaViewerItem[] = allMediaMessages.map((m) => {
      const key = m.attachment!.objectId || m.attachment!.attachmentId || m.attachment!.name;
      const cached = MediaCache.get(key);
      return {
        id: m.id,
        type: m.attachment!.mimeType?.startsWith('video/') ? 'video' : 'image',
        url: cached?.blobUrl || m.attachment!.previewUrl || m.attachment!.url || '',
        name: m.attachment!.name,
        sizeBytes: m.attachment!.sizeBytes,
        mimeType: m.attachment!.mimeType,
        timestamp: m.timestamp,
        senderName: m.senderName,
        data: cached?.data,
      };
    });

    const currentIdx = items.findIndex((i) => i.id === msg.id);
    setViewerMediaList(items);
    setViewerItem(items[currentIdx >= 0 ? currentIdx : 0]);
  };

  // Context Menu Trigger (Long-press / right click)
  const handleContextMenu = (e: React.MouseEvent, msg: UIMessage) => {
    e.preventDefault();
    if (isSelectionMode) return;
    setContextMenu({
      isOpen: true,
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: Math.min(e.clientY, window.innerHeight - 240),
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

  const handleDeleteContextMessage = (msg: UIMessage) => {
    if (activeChatId) {
      deleteMessage(activeChatId, msg.id);
      showToast({ type: 'info', message: 'Message deleted' });
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
      deleteMessage(activeChatId, id);
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
    <div className="veil-conversation" role="main" aria-label={`Conversation with ${conversationName}`}>
      {/* Selection Mode Header Toolbar */}
      {isSelectionMode ? (
        <div className="veil-selection-toolbar" role="toolbar" aria-label="Selection toolbar">
          <div className="veil-selection-info">
            <IconButton
              icon={<CloseIcon size={18} />}
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedMessageIds(new Set());
              }}
              aria-label="Cancel selection"
              variant="ghost"
            />
            <span style={{ fontWeight: 600 }}>{selectedMessageIds.size} selected</span>
          </div>
          <div className="veil-selection-actions">
            <IconButton
              icon={<CopyIcon size={18} />}
              onClick={handleBatchCopy}
              disabled={selectedMessageIds.size === 0}
              aria-label="Copy selected"
              variant="ghost"
            />
            <IconButton
              icon={<TrashIcon size={18} />}
              onClick={handleBatchDelete}
              disabled={selectedMessageIds.size === 0}
              aria-label="Delete selected"
              variant="danger"
            />
          </div>
        </div>
      ) : (
        /* Standard Telegram-Style Conversation Header */
        <div className="veil-conversation-header">
          <div className="veil-conversation-header-left">
            <IconButton
              icon={<ArrowLeftIcon size={20} />}
              className="veil-btn-mobile-back"
              onClick={() => selectConversation(null)}
              aria-label="Back to conversations list"
              variant="ghost"
            />

            <div
              className="veil-header-profile-trigger"
              onClick={() => {
                if (isGroup) {
                  openModal({ type: 'groupDetails', conversationId: activeChatId });
                } else {
                  openModal({ type: 'contactDetails', conversationId: activeChatId });
                }
              }}
              role="button"
              tabIndex={0}
              title="View details"
            >
              <Avatar
                name={conversationName}
                imageUrl={activeConversation?.avatar || activeContact?.avatar}
                size="md"
                isGroup={isGroup}
                aria-label={`${conversationName} profile`}
              />
              <div className="veil-header-text">
                <div className="veil-header-title">{conversationName}</div>
                <div className="veil-header-subtitle">
                  {isGroup ? (
                    'Group • End-to-End Encrypted'
                  ) : activeContact?.verificationStatus === 'MISMATCH' ? (
                    <span style={{ color: 'var(--veil-danger)' }}>Key Changed</span>
                  ) : activeContact?.verificationStatus === 'VERIFIED' || activeConversation?.isVerified || activeContact?.verified ? (
                    <span style={{ color: 'var(--veil-success)' }}>Verified (Ed25519)</span>
                  ) : (
                    'End-to-End Encrypted'
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="veil-conversation-header-right">
            <IconButton
              icon={<SearchIcon size={18} />}
              onClick={() => setIsSearchingInChat(!isSearchingInChat)}
              aria-label="Search inside chat"
              variant="ghost"
            />
            <IconButton
              icon={<GridIcon size={18} />}
              onClick={() => setShowGallery(true)}
              aria-label="Shared media gallery"
              variant="ghost"
            />
            <IconButton
              icon={<InfoIcon size={18} />}
              onClick={() => {
                if (isGroup) {
                  openModal({ type: 'groupDetails', conversationId: activeChatId });
                } else {
                  openModal({ type: 'contactDetails', conversationId: activeChatId });
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
            const isMedia =
              msg.attachment &&
              (msg.attachment.mimeType?.startsWith('image/') ||
                msg.attachment.mimeType?.startsWith('video/'));

            return (
              <React.Fragment key={msg.id}>
                {isUnreadFirst && (
                  <div ref={unreadRef} className="veil-unread-divider" role="separator">
                    <span>Unread Messages</span>
                  </div>
                )}

                <div
                  className={`veil-msg-row ${msg.isOutgoing ? 'outgoing' : 'incoming'} ${
                    isSelectionMode ? 'veil-msg-selectable' : ''
                  }`}
                  onClick={() => {
                    if (isSelectionMode) handleToggleSelectMessage(msg.id);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, msg)}
                >
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectMessage(msg.id)}
                      className="veil-msg-checkbox"
                      aria-label="Select message"
                    />
                  )}

                  <div className={`veil-bubble-wrapper ${isSelected ? 'selected' : ''}`}>
                    {/* Media Image / Video Card */}
                    {isMedia && msg.attachment && (
                      <div className="veil-media-bubble-container">
                        <MediaImage
                          attachment={msg.attachment}
                          isVideo={msg.attachment.mimeType?.startsWith('video/')}
                          onClick={() => {
                            if (!isSelectionMode) handleOpenMedia(msg);
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
                          {msg.isOutgoing && <MessageStatus status={msg.deliveryStatus as any} />}
                        </div>
                      </div>
                    )}

                    {/* Standard File Attachment Card */}
                    {msg.attachment && !isMedia && (
                      <AttachmentCard
                        name={msg.attachment.name}
                        sizeBytes={msg.attachment.sizeBytes}
                        mimeType={msg.attachment.mimeType}
                        status={downloadingAttachmentId === msg.id ? 'downloading' : 'ready'}
                        onDownload={() => handleDownloadAttachment(msg)}
                      />
                    )}

                    {/* Voice Note Card */}
                    {msg.voice && (
                      <VoiceNoteCard
                        durationSeconds={msg.voice.durationSeconds}
                        playbackState={playingAudioId === msg.id ? 'playing' : 'idle'}
                        currentProgressPercent={playbackProgress[msg.id] || 0}
                        onPlayToggle={() => handleToggleVoice(msg)}
                        onSeek={(percent) => {
                          if (playingAudioId === msg.id) {
                            VoicePlayer.seek(percent);
                            setPlaybackProgress((prev) => ({ ...prev, [msg.id]: percent }));
                          }
                        }}
                      />
                    )}

                    {/* Text Message Bubble (Rendered if message has text and isn't raw media placeholder) */}
                    {msg.text && !msg.text.startsWith('📎 Attachment:') && !msg.text.startsWith('Attachment:') && msg.text !== 'Voice Message' && (
                      <MessageBubble
                        messageId={msg.id}
                        senderName={msg.senderName}
                        isOutgoing={msg.isOutgoing}
                        text={msg.text}
                        timestamp={msg.timestamp}
                        status={msg.deliveryStatus as any}
                        onReplyClick={() => setReplyTarget(msg)}
                      />
                    )}
                  </div>
                </div>
              </React.Fragment>
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
              <span>Save to Device</span>
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
            onClick={() => handleDeleteContextMessage(contextMenu.message!)}
          >
            <TrashIcon size={16} />
            <span>Delete Message</span>
          </button>
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
            const targetMsg = activeMessages.find((m) => m.id === item.id);
            if (targetMsg) handleDownloadAttachment(targetMsg);
          }}
          onShare={async (item) => {
            const targetMsg = activeMessages.find((m) => m.id === item.id);
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
    </div>
  );
};
