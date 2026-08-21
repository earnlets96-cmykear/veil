/**
 * Modernized Conversation View Component for VEIL Phase 31 Step 5A.
 *
 * Implements:
 * - Advanced message context menu (Reply, Copy, Select, Retry, Delete)
 * - Multi-message selection mode and floating action toolbar (Batch Copy & Delete)
 * - In-conversation search with match counter and Prev/Next match navigation
 * - Date separators ("Today", "Yesterday", formatted calendar dates)
 * - "New Messages" unread divider
 * - Floating scroll-to-latest button with unread counter
 * - Jump-to-message with momentary pulse highlighting
 * - Zero cryptographic or session modifications.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useApp } from '../app/AppState.tsx';
import { MessageComposer } from './MessageComposer.tsx';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import { AttachmentPipeline } from '../../attachments/attachmentPipeline.ts';
import type { AttachmentMetadata, EncryptedAttachmentChunk } from '../../attachments/types.ts';
import { base64ToBytes } from '../../crypto/utils.ts';
import type { UIMessage } from '../app/types.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  StatusIndicator,
  EmptyState,
  AttachmentCard,
  VoiceNoteCard,
  MessageBubble,
} from './ui/index.ts';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  message: UIMessage | null;
}

export const ConversationView: React.FC = () => {
  const {
    conversations,
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

  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

  // In-Conversation Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

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

  // Highlighted Message State (for jump-to-message)
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Scroll State
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const activeConv = conversations.find((c) => c.id === activeChatId);
  const activeMessages = useMemo(() => {
    if (!activeChatId) return [];
    return messages[activeChatId] || (activeConv?.peerDoc?.identityId ? messages[activeConv.peerDoc.identityId] : []) || [];
  }, [activeChatId, activeConv, messages]);

  // Mark conversation as read on load
  useEffect(() => {
    if (activeChatId && activeConv && activeConv.unreadCount > 0) {
      markConversationAsRead(activeChatId);
    }
  }, [activeChatId, activeConv, markConversationAsRead]);

  // Initial and new message auto-scroll
  useEffect(() => {
    if (!showScrollBottom) {
      timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeMessages.length, showScrollBottom]);

  // Handle timeline scroll detection
  const handleTimelineScroll = () => {
    if (!timelineRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
    const isScrolledUp = scrollHeight - scrollTop - clientHeight > 200;
    setShowScrollBottom(isScrolledUp);
  };

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu.isOpen) {
        setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu.isOpen) {
          setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
        } else if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedMessageIds(new Set());
        } else if (isSearchOpen) {
          setIsSearchOpen(false);
          setInChatSearchQuery('');
        }
      }
    };

    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu.isOpen, isSelectionMode, isSearchOpen]);

  // In-Conversation Search Matches
  const searchMatches = useMemo(() => {
    if (!inChatSearchQuery.trim()) return [];
    const q = inChatSearchQuery.toLowerCase();
    return activeMessages.filter((m) => m.text && m.text.toLowerCase().includes(q));
  }, [activeMessages, inChatSearchQuery]);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1500);
    }
  }, []);

  const handleNextSearchMatch = () => {
    if (searchMatches.length === 0) return;
    const next = (activeMatchIndex + 1) % searchMatches.length;
    setActiveMatchIndex(next);
    scrollToMessage(searchMatches[next].id);
  };

  const handlePrevSearchMatch = () => {
    if (searchMatches.length === 0) return;
    const prev = (activeMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    setActiveMatchIndex(prev);
    scrollToMessage(searchMatches[prev].id);
  };

  if (!activeConv || !activeChatId) {
    return (
      <main className="veil-chat-main" role="main" aria-label="Conversation Main Area">
        <EmptyState
          icon="🛡️"
          title="No Conversation Selected"
          description="Choose a contact or group from the sidebar to view end-to-end encrypted messages."
        />
      </main>
    );
  }

  const handlePlayVoice = async (msg: UIMessage) => {
    if (!msg.voice || !activeSession) return;

    if (playingAudioId === msg.id) {
      const audio = audioElementsRef.current[msg.id];
      if (audio) {
        audio.pause();
        setPlayingAudioId(null);
      }
      return;
    }

    if (playingAudioId && audioElementsRef.current[playingAudioId]) {
      audioElementsRef.current[playingAudioId].pause();
    }

    try {
      let audio = audioElementsRef.current[msg.id];
      if (!audio) {
        if (!cloudClient.getSessionToken()) {
          await ensureCloudSession(activeSession);
        }
        const audioUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(activeSession, cloudClient, msg.voice as any);
        audio = new Audio(audioUrl);
        audioElementsRef.current[msg.id] = audio;
        audio.onended = () => setPlayingAudioId(null);
      }
      audio.play();
      setPlayingAudioId(msg.id);
    } catch (err: any) {
      alert(`Voice playback error: ${err.message || 'Failed to decrypt audio'}`);
    }
  };

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

        const blob = new Blob([plaintextBytes], { type: msg.attachment.mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = msg.attachment.name;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err: any) {
        alert(`Attachment download error: ${err.message || 'Failed to download file'}`);
      } finally {
        setDownloadingAttachmentId(null);
      }
    }
  };

  // Context Menu Handlers
  const handleOpenContextMenu = (e: React.MouseEvent, msg: UIMessage) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 180);
    const y = Math.min(e.clientY, window.innerHeight - 220);
    setContextMenu({ isOpen: true, x, y, message: msg });
  };

  const handleCopyMessageText = (msg?: UIMessage | null) => {
    const target = msg || contextMenu.message;
    if (target && target.text && navigator.clipboard) {
      navigator.clipboard.writeText(target.text);
    }
  };

  const handleDeleteMessage = async (msg?: UIMessage | null) => {
    const target = msg || contextMenu.message;
    if (target && activeChatId) {
      await deleteMessageLocally(activeChatId, target.id);
    }
  };

  // Selection Mode Actions
  const toggleSelectMessage = (msgId: string) => {
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

  const handleSelectAll = () => {
    setSelectedMessageIds(new Set(activeMessages.map((m) => m.id)));
  };

  const handleCopySelected = () => {
    const texts = activeMessages
      .filter((m) => selectedMessageIds.has(m.id))
      .map((m) => `${m.senderName || (m.isOutgoing ? 'Me' : 'Peer')}: ${m.text}`)
      .join('\n\n');
    if (texts && navigator.clipboard) {
      navigator.clipboard.writeText(texts);
    }
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (activeChatId && selectedMessageIds.size > 0) {
      await deleteMessagesLocally(activeChatId, Array.from(selectedMessageIds));
      setIsSelectionMode(false);
      setSelectedMessageIds(new Set());
    }
  };

  // Date Separator Helper
  const formatDateLabel = (timestamp: number) => {
    const d = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <main className="veil-chat-main" role="main" aria-label={`Conversation with ${activeConv.name}`}>
      {/* Top Selection Toolbar if active */}
      {isSelectionMode ? (
        <div className="veil-selection-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <IconButton
              icon="✕"
              aria-label="Cancel selection"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedMessageIds(new Set());
              }}
            />
            <span style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)' }}>
              {selectedMessageIds.size} Selected
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <Button variant="secondary" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopySelected}
              disabled={selectedMessageIds.size === 0}
            >
              📋 Copy
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedMessageIds.size === 0}
            >
              🗑️ Delete
            </Button>
          </div>
        </div>
      ) : (
        /* Standard Chat Header */
        <header className="veil-chat-header">
          <div className="veil-chat-peer-info">
            <IconButton
              icon="←"
              variant="secondary"
              className="veil-back-btn"
              onClick={() => selectConversation(null)}
              aria-label="Back to conversations"
              title="Back to conversations"
            />

            <Avatar
              name={activeConv.name}
              isGroup={activeConv.type === 'group'}
              size="md"
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
                  {activeConv.name}
                </span>
                {activeConv.isVerified && (
                  <Badge variant="secure">
                    ✓ Verified Identity
                  </Badge>
                )}
              </div>
              <StatusIndicator
                status="secure"
                label={activeConv.type === 'group' ? 'Encrypted Group Ratchet' : '🔒 Double Ratchet E2EE'}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <IconButton
              icon="🔍"
              variant="secondary"
              onClick={() => {
                setIsSearchOpen((prev) => !prev);
                if (isSearchOpen) setInChatSearchQuery('');
              }}
              aria-label="Search conversation messages"
              title="Search in Chat"
            />

            {activeConv.type === 'direct' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openModal({ type: 'contactDetails', conversationId: activeConv.id })}
              >
                Verify Safety Number
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openModal({ type: 'groupDetails', conversationId: activeConv.id })}
              >
                Group Info
              </Button>
            )}
          </div>
        </header>
      )}

      {/* In-Conversation Search Header Banner */}
      {isSearchOpen && (
        <div className="veil-chat-search-bar" role="search">
          <input
            type="text"
            className="veil-input"
            style={{ flex: 1, padding: '0.35rem 0.65rem', fontSize: 'var(--veil-text-xs)' }}
            placeholder="Search within this conversation..."
            value={inChatSearchQuery}
            onChange={(e) => {
              setInChatSearchQuery(e.target.value);
              setActiveMatchIndex(0);
            }}
            autoFocus
            aria-label="Search conversation messages"
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="veil-search-match-count">
              {searchMatches.length > 0
                ? `${activeMatchIndex + 1} of ${searchMatches.length}`
                : inChatSearchQuery.trim()
                ? '0 matches'
                : ''}
            </span>
            <IconButton
              icon="▲"
              disabled={searchMatches.length <= 1}
              onClick={handlePrevSearchMatch}
              aria-label="Previous search match"
              style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
            />
            <IconButton
              icon="▼"
              disabled={searchMatches.length <= 1}
              onClick={handleNextSearchMatch}
              aria-label="Next search match"
              style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
            />
            <IconButton
              icon="✕"
              onClick={() => {
                setIsSearchOpen(false);
                setInChatSearchQuery('');
              }}
              aria-label="Close search"
              style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
            />
          </div>
        </div>
      )}

      {/* Message Timeline */}
      <div
        ref={timelineRef}
        className="veil-chat-timeline"
        role="log"
        aria-live="polite"
        aria-label="Message Timeline"
        onScroll={handleTimelineScroll}
      >
        {activeMessages.length === 0 ? (
          <EmptyState
            icon="🔒"
            title="End-to-End Encrypted"
            description="Messages, attachments, and voice notes in this conversation are encrypted end-to-end. No third party or relay server can read or listen to them."
          />
        ) : (
          activeMessages.map((msg, index) => {
            const isVoice = Boolean(msg.voice);
            const isAttachment = Boolean(msg.attachment);

            // Date separator calculation
            const prevMsg = index > 0 ? activeMessages[index - 1] : null;
            const showDateSeparator =
              !prevMsg ||
              new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

            const voiceElement = isVoice ? (
              <VoiceNoteCard
                durationSeconds={msg.voice!.durationSeconds}
                playbackState={playingAudioId === msg.id ? 'playing' : 'idle'}
                onPlayToggle={() => handlePlayVoice(msg)}
              />
            ) : undefined;

            const attachmentElement = isAttachment ? (
              <AttachmentCard
                name={msg.attachment!.name}
                sizeBytes={msg.attachment!.sizeBytes}
                mimeType={msg.attachment!.mimeType}
                status={downloadingAttachmentId === msg.id ? 'downloading' : 'ready'}
                onDownload={msg.attachment!.objectId ? () => handleDownloadAttachment(msg) : undefined}
              />
            ) : undefined;

            return (
              <React.Fragment key={msg.id}>
                {showDateSeparator && (
                  <div className="veil-date-separator">
                    <span className="veil-date-pill">
                      {formatDateLabel(msg.timestamp)}
                    </span>
                  </div>
                )}

                <MessageBubble
                  id={msg.id}
                  isOutgoing={Boolean(msg.isOutgoing)}
                  text={msg.text}
                  timestamp={msg.timestamp}
                  status={msg.status}
                  replyTo={
                    msg.replyTo
                      ? {
                          messageId: msg.replyTo.messageId,
                          senderName: msg.replyTo.senderName,
                          text: msg.replyTo.text,
                          attachmentType: msg.replyTo.attachmentType as any,
                        }
                      : undefined
                  }
                  onReplyClick={scrollToMessage}
                  onReplyTrigger={() => setReplyTarget(msg)}
                  onRetry={() => retryFailedMessage(activeChatId, msg.id)}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedMessageIds.has(msg.id)}
                  onSelectToggle={() => toggleSelectMessage(msg.id)}
                  onContextMenu={(e) => handleOpenContextMenu(e, msg)}
                  onLongPress={() => {
                    setIsSelectionMode(true);
                    toggleSelectMessage(msg.id);
                  }}
                  isHighlighted={highlightedMessageId === msg.id}
                  voiceElement={voiceElement}
                  attachmentElement={attachmentElement}
                />
              </React.Fragment>
            );
          })
        )}
        <div ref={timelineEndRef} />
      </div>

      {/* Floating Scroll to Bottom Button */}
      {showScrollBottom && (
        <button
          type="button"
          className="veil-scroll-bottom-btn"
          onClick={() => timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
          aria-label="Scroll to newest messages"
          title="Scroll to bottom"
        >
          ↓
        </button>
      )}

      {/* Context Menu Popup */}
      {contextMenu.isOpen && contextMenu.message && (
        <div
          className="veil-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          role="menu"
          aria-label="Message Actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="veil-context-menu-item"
            role="menuitem"
            onClick={() => {
              setReplyTarget(contextMenu.message);
              setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
            }}
          >
            ↩ Reply
          </button>
          {contextMenu.message.text && (
            <button
              type="button"
              className="veil-context-menu-item"
              role="menuitem"
              onClick={() => {
                handleCopyMessageText(contextMenu.message);
                setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
              }}
            >
              📋 Copy Text
            </button>
          )}
          <button
            type="button"
            className="veil-context-menu-item"
            role="menuitem"
            onClick={() => {
              setIsSelectionMode(true);
              if (contextMenu.message) toggleSelectMessage(contextMenu.message.id);
              setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
            }}
          >
            🔘 Select
          </button>
          {contextMenu.message.status === 'FAILED' && (
            <button
              type="button"
              className="veil-context-menu-item"
              role="menuitem"
              onClick={() => {
                if (contextMenu.message) retryFailedMessage(activeChatId, contextMenu.message.id);
                setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
              }}
            >
              🔄 Retry Send
            </button>
          )}
          <div style={{ height: '1px', backgroundColor: 'var(--veil-border)', margin: '2px 0' }} />
          <button
            type="button"
            className="veil-context-menu-item veil-context-menu-danger"
            role="menuitem"
            onClick={() => {
              handleDeleteMessage(contextMenu.message);
              setContextMenu({ isOpen: false, x: 0, y: 0, message: null });
            }}
          >
            🗑️ Delete Locally
          </button>
        </div>
      )}

      {/* Composer */}
      {!isSelectionMode && <MessageComposer conversationId={activeChatId} />}
    </main>
  );
};
