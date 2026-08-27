/**
 * Telegram-Inspired Conversation View Component for VEIL.
 *
 * Implements:
 * - Telegram-style message bubbles (rounded geometry, delivery ticks, media embeds)
 * - In-app Fullscreen Media Viewer for photos & videos (zoom, pan, gallery nav)
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
import { AttachmentPipeline } from '../../attachments/attachmentPipeline.ts';
import type { AttachmentMetadata, EncryptedAttachmentChunk } from '../../attachments/types.ts';
import { base64ToBytes } from '../../crypto/utils.ts';
import type { UIMessage } from '../app/types.ts';
import { FileSaver } from '../utils/fileSaver.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  EmptyState,
  AttachmentCard,
  VoiceNoteCard,
  MessageBubble,
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
} from './icons/index.ts';
import { MediaViewer, MediaViewerItem } from './media/MediaViewer.tsx';
import { MediaGalleryModal } from './media/MediaGalleryModal.tsx';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  message: UIMessage | null;
}

export const ConversationView: React.FC = () => {
  const {
    conversations,
    contacts,
    activeChatId,
    messages,
    openModal,
    selectConversation,
    setReplyTarget,
    activeSession,
    cloudClient,
    ensureCloudSession,
    deleteMessageLocally,
    deleteMessagesLocally,
    retryFailedMessage,
    markConversationAsRead,
  } = useApp();

  const { showToast } = useToast();

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef<HTMLDivElement>(null);
  const hasAutoScrolledUnreadRef = useRef<string | null>(null);

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);
  const [retryingMessageIds, setRetryingMessageIds] = useState<Set<string>>(new Set());

  // In-Conversation Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // Fullscreen Media Viewer State
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null);
  const [viewerMediaList, setViewerMediaList] = useState<MediaViewerItem[]>([]);

  // Shared Media Gallery Modal State
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    message: null,
  });

  // Highlighted Message State (for jump-to-message)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Scroll State
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const activeConv = conversations.find((c) => c.id === activeChatId);
  const activeContact = useMemo(() => {
    if (!activeConv || activeConv.type !== 'direct') return null;
    return contacts.find((c) => c.identityId === activeConv.id) || null;
  }, [activeConv, contacts]);

  const activeMessages = useMemo(() => {
    if (!activeChatId) return [];
    return messages[activeChatId] || (activeConv?.peerDoc?.identityId ? messages[activeConv.peerDoc.identityId] : []) || [];
  }, [activeChatId, activeConv, messages]);

  // First unread message calculation
  const unreadCount = activeConv?.unreadCount || 0;
  const firstUnreadIndex = useMemo(() => {
    if (unreadCount <= 0 || activeMessages.length === 0) return -1;
    return Math.max(0, activeMessages.length - unreadCount);
  }, [unreadCount, activeMessages.length]);

  // Auto-scroll to first unread message or timeline end on chat selection
  useEffect(() => {
    if (!activeChatId) return;

    if (hasAutoScrolledUnreadRef.current !== activeChatId) {
      hasAutoScrolledUnreadRef.current = activeChatId;
      if (firstUnreadIndex > 0 && unreadRef.current) {
        unreadRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [activeChatId, firstUnreadIndex]);

  // New message auto-scroll when at bottom
  useEffect(() => {
    if (!showScrollBottom) {
      timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages.length, showScrollBottom]);

  // Handle timeline scroll detection & mark as read at bottom
  const handleTimelineScroll = () => {
    if (!timelineRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isScrolledUp);

    // Mark as read when scrolled near bottom
    if (!isScrolledUp && activeChatId && activeConv && activeConv.unreadCount > 0) {
      markConversationAsRead(activeChatId);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      if (contextMenu.isOpen) {
        setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [contextMenu.isOpen]);

  // Voice note play/pause handler
  const handleToggleVoice = async (msg: UIMessage) => {
    if (!msg.voice || !activeSession) return;

    // Pause currently playing audio if it's the same
    if (playingAudioId === msg.id) {
      const existing = audioElementsRef.current[msg.id];
      if (existing) {
        existing.pause();
        setPlayingAudioId(null);
      }
      return;
    }

    // Stop any other playing audio
    if (playingAudioId && audioElementsRef.current[playingAudioId]) {
      audioElementsRef.current[playingAudioId].pause();
    }

    let audio = audioElementsRef.current[msg.id];
    if (!audio) {
      try {
        if (!cloudClient.getSessionToken()) {
          await ensureCloudSession(activeSession);
        }
        const audioUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(activeSession, cloudClient, msg.voice as any);
        audio = new Audio(audioUrl);
        audioElementsRef.current[msg.id] = audio;

        audio.onended = () => setPlayingAudioId(null);
        audio.onerror = () => {
          showToast({ type: 'error', message: 'Could not play voice note' });
          setPlayingAudioId(null);
        };
      } catch (err: any) {
        showToast({ type: 'error', message: `Voice playback error: ${err.message || 'Decryption failed'}` });
        return;
      }
    }

    audio.play();
    setPlayingAudioId(msg.id);
  };

  // Unified File Download & Android Saving Handler
  const handleDownloadAttachment = async (msg: UIMessage) => {
    if (!msg.attachment || !activeSession) return;
    if (msg.attachment.objectId) {
      setDownloadingAttachmentId(msg.id);
      try {
        if (!cloudClient.getSessionToken()) {
          await ensureCloudSession(activeSession);
        }
        const rawCiphertext = await cloudClient.downloadAttachment(msg.attachment.objectId);
        let plaintextBytes: Uint8Array;

        if (msg.attachment.encryptionKeyBase64) {
          const encryptionKey = base64ToBytes(msg.attachment.encryptionKeyBase64);
          const chunks: EncryptedAttachmentChunk[] = JSON.parse(new TextDecoder().decode(rawCiphertext));
          const meta: AttachmentMetadata = {
            attachmentId: msg.attachment.attachmentId || msg.attachment.objectId,
            name: msg.attachment.name,
            mimeType: msg.attachment.mimeType,
            sizeBytes: msg.attachment.sizeBytes,
            chunkCount: msg.attachment.chunkCount || chunks.length,
            chunkSize: msg.attachment.chunkSize || (64 * 1024),
            sha256Hash: msg.attachment.sha256Hash || '',
          };
          plaintextBytes = AttachmentPipeline.decryptAndReassemble(meta, chunks, encryptionKey);
        } else {
          plaintextBytes = rawCiphertext;
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
    }
  };

  // Open Media in Fullscreen Viewer
  const handleOpenMedia = (msg: UIMessage) => {
    if (!msg.attachment) return;

    const allMediaMessages = activeMessages.filter(
      (m) => m.attachment && (m.attachment.mimeType?.startsWith('image/') || m.attachment.mimeType?.startsWith('video/'))
    );

    const items: MediaViewerItem[] = allMediaMessages.map((m) => ({
      id: m.id,
      type: m.attachment!.mimeType?.startsWith('video/') ? 'video' : 'image',
      url: m.attachment!.previewUrl || m.attachment!.url || '',
      name: m.attachment!.name,
      sizeBytes: m.attachment!.sizeBytes,
      mimeType: m.attachment!.mimeType,
      timestamp: m.timestamp,
      senderName: m.senderName,
    }));

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

  const handleReplyMessage = (msg: UIMessage) => {
    setReplyTarget(msg);
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  const handleDeleteMessage = (msg: UIMessage) => {
    if (activeChatId) {
      deleteMessageLocally(activeChatId, msg.id);
      showToast({ type: 'info', message: 'Message deleted from local device' });
    }
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  const handleEnterSelectionMode = (initialId?: string) => {
    setIsSelectionMode(true);
    if (initialId) {
      setSelectedMessageIds(new Set([initialId]));
    }
    setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
  };

  const handleToggleSelectMessage = (msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      if (next.size === 0) setIsSelectionMode(false);
      return next;
    });
  };

  const handleBatchDelete = () => {
    if (activeChatId && selectedMessageIds.size > 0) {
      deleteMessagesLocally(activeChatId, Array.from(selectedMessageIds));
      showToast({ type: 'info', message: `Deleted ${selectedMessageIds.size} messages` });
      setIsSelectionMode(false);
      setSelectedMessageIds(new Set());
    }
  };

  const handleBatchCopy = () => {
    const selectedMsgs = activeMessages.filter((m) => selectedMessageIds.has(m.id));
    const combined = selectedMsgs.map((m) => m.text).filter(Boolean).join('\n');
    if (combined && navigator.clipboard) {
      navigator.clipboard.writeText(combined);
      showToast({ type: 'success', message: `Copied ${selectedMsgs.length} messages` });
    }
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  if (!activeChatId || !activeConv) {
    return (
      <main className="veil-conversation-empty" role="main">
        <EmptyState
          title="No Conversation Selected"
          description="Select a chat from the sidebar or start a new encrypted direct/group message."
          action={
            <Button variant="primary" size="md" onClick={() => openModal({ type: 'newChat' })}>
              New Chat
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="veil-conversation" role="main">
      {/* Fullscreen Media Viewer Overlay */}
      {viewerItem && (
        <MediaViewer
          items={viewerMediaList}
          initialIndex={viewerMediaList.findIndex((i) => i.id === viewerItem.id)}
          onClose={() => setViewerItem(null)}
          onDownload={(item) => {
            const originalMsg = activeMessages.find((m) => m.id === item.id);
            if (originalMsg) handleDownloadAttachment(originalMsg);
          }}
        />
      )}

      {/* Shared Media Gallery Modal */}
      {isGalleryOpen && (
        <MediaGalleryModal
          conversationName={activeConv.name}
          messages={activeMessages}
          onClose={() => setIsGalleryOpen(false)}
          onOpenMedia={(item, allItems) => {
            setIsGalleryOpen(false);
            setViewerMediaList(allItems);
            setViewerItem(item);
          }}
          onDownloadFile={(msg) => handleDownloadAttachment(msg)}
        />
      )}

      {/* Selection Mode Action Bar */}
      {isSelectionMode ? (
        <div className="veil-selection-bar" role="toolbar" aria-label="Selection Actions">
          <div className="veil-selection-count">
            {selectedMessageIds.size} Selected
          </div>
          <div className="veil-selection-actions">
            <Button variant="secondary" size="sm" onClick={handleBatchCopy} disabled={selectedMessageIds.size === 0}>
              <CopyIcon size={16} />
              <span>Copy</span>
            </Button>
            <Button variant="danger" size="sm" onClick={handleBatchDelete} disabled={selectedMessageIds.size === 0}>
              <TrashIcon size={16} />
              <span>Delete</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setIsSelectionMode(false); setSelectedMessageIds(new Set()); }}>
              <CloseIcon size={16} />
            </Button>
          </div>
        </div>
      ) : (
        /* Standard Conversation Header */
        <div className="veil-conversation-header">
          <div className="veil-header-left">
            <button
              className="veil-btn veil-btn-ghost veil-btn-sm veil-mobile-back"
              onClick={() => selectConversation(null as any)}
              aria-label="Back to conversations"
            >
              <ArrowLeftIcon size={20} />
            </button>

            <div
              className="veil-header-peer-info"
              onClick={() => {
                if (activeConv.type === 'group') {
                  openModal({ type: 'groupDetails', conversationId: activeConv.id });
                } else {
                  openModal({ type: 'contactDetails', conversationId: activeConv.id });
                }
              }}
              role="button"
              tabIndex={0}
            >
              <Avatar
                name={activeConv.name}
                size="md"
                isGroup={activeConv.type === 'group'}
              />
              <div className="veil-header-peer-details">
                <div className="veil-header-peer-name-row">
                  <span className="veil-header-peer-name">{activeConv.name}</span>
                  {activeContact?.verificationStatus === 'MISMATCH' && <Badge variant="danger">Key Changed</Badge>}
                  {(activeConv.isVerified || activeContact?.verificationStatus === 'VERIFIED') && activeContact?.verificationStatus !== 'MISMATCH' && (
                    <Badge variant="secure">Verified</Badge>
                  )}
                </div>
                <div className="veil-header-peer-meta">
                  {activeConv.type === 'group'
                    ? `${activeConv.participants?.length || 0} members • End-to-End Encrypted`
                    : 'End-to-End Encrypted Double Ratchet'}
                </div>
              </div>
            </div>
          </div>

          <div className="veil-header-actions">
            <IconButton
              icon={<SearchIcon size={20} />}
              onClick={() => setIsSearchOpen((prev) => !prev)}
              aria-label="Search in conversation"
              variant="ghost"
            />
            <IconButton
              icon={<GridIcon size={20} />}
              onClick={() => setIsGalleryOpen(true)}
              aria-label="Shared media gallery"
              variant="ghost"
            />
            <IconButton
              icon={<MoreVerticalIcon size={20} />}
              onClick={() => {
                if (activeConv.type === 'group') {
                  openModal({ type: 'groupDetails', conversationId: activeConv.id });
                } else {
                  openModal({ type: 'contactDetails', conversationId: activeConv.id });
                }
              }}
              aria-label="Conversation details"
              variant="ghost"
            />
          </div>
        </div>
      )}

      {/* Message Timeline */}
      <div
        ref={timelineRef}
        className="veil-timeline"
        onScroll={handleTimelineScroll}
        role="log"
        aria-label="Message history"
      >
        {activeMessages.length === 0 ? (
          <div className="veil-timeline-empty">
            <div className="veil-timeline-encryption-shield">
              <span style={{ fontSize: '1.75rem' }}>🛡️</span>
            </div>
            <h3>End-to-End Encrypted Conversation</h3>
            <p>Messages, photos, videos, files, and voice notes are cryptographically protected.</p>
          </div>
        ) : (
          activeMessages.map((msg, index) => {
            const isUnreadFirst = index === firstUnreadIndex;
            const isSelected = selectedMessageIds.has(msg.id);

            return (
              <React.Fragment key={msg.id}>
                {isUnreadFirst && (
                  <div ref={unreadRef} className="veil-unread-divider" role="separator">
                    <span>Unread Messages</span>
                  </div>
                )}

                <div
                  className={`veil-msg-row ${msg.isOutgoing ? 'outgoing' : 'incoming'} ${isSelectionMode ? 'veil-msg-selectable' : ''}`}
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
                    {msg.attachment && (msg.attachment.mimeType?.startsWith('image/') || msg.attachment.mimeType?.startsWith('video/')) ? (
                      <div
                        className="veil-media-bubble"
                        onClick={(e) => {
                          if (!isSelectionMode) {
                            e.stopPropagation();
                            handleOpenMedia(msg);
                          }
                        }}
                      >
                        {msg.attachment.previewUrl ? (
                          <img
                            src={msg.attachment.previewUrl}
                            alt={msg.attachment.name}
                            className="veil-media-bubble-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="veil-media-bubble-placeholder">
                            {msg.attachment.mimeType?.startsWith('video/') ? <VideoIcon size={32} /> : <ImageIcon size={32} />}
                          </div>
                        )}
                        {msg.attachment.mimeType?.startsWith('video/') && (
                          <div className="veil-media-play-overlay">
                            <PlayIcon size={24} />
                          </div>
                        )}
                      </div>
                    ) : null}

                    {/* Standard File Attachment Card */}
                    {msg.attachment && !msg.attachment.mimeType?.startsWith('image/') && !msg.attachment.mimeType?.startsWith('video/') ? (
                      <AttachmentCard
                        name={msg.attachment.name}
                        sizeBytes={msg.attachment.sizeBytes}
                        mimeType={msg.attachment.mimeType}
                        status={downloadingAttachmentId === msg.id ? 'downloading' : 'ready'}
                        onDownload={() => handleDownloadAttachment(msg)}
                      />
                    ) : null}

                    {/* Voice Note Card */}
                    {msg.voice ? (
                      <VoiceNoteCard
                        durationSeconds={msg.voice.durationSeconds}
                        playbackState={playingAudioId === msg.id ? 'playing' : 'idle'}
                        onPlayToggle={() => handleToggleVoice(msg)}
                      />
                    ) : null}

                    {/* Text Message Bubble */}
                    {msg.text && (
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
          <button className="veil-context-item" onClick={() => handleReplyMessage(contextMenu.message!)}>
            <ReplyIcon size={16} />
            <span>Reply</span>
          </button>

          {contextMenu.message.text && (
            <button className="veil-context-item" onClick={() => handleCopyText(contextMenu.message!.text)}>
              <CopyIcon size={16} />
              <span>Copy Text</span>
            </button>
          )}

          {contextMenu.message.attachment && (
            <button className="veil-context-item" onClick={() => {
              handleDownloadAttachment(contextMenu.message!);
              setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
            }}>
              <DownloadIcon size={16} />
              <span>Download File</span>
            </button>
          )}

          <button className="veil-context-item" onClick={() => handleEnterSelectionMode(contextMenu.message!.id)}>
            <CheckIcon size={16} />
            <span>Select Messages</span>
          </button>

          <button className="veil-context-item veil-context-item-danger" onClick={() => handleDeleteMessage(contextMenu.message!)}>
            <TrashIcon size={16} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Message Composer Footer */}
      <MessageComposer conversationId={activeChatId} />
    </main>
  );
};
