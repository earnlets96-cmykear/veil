/**
 * Polished Conversation View Component for VEIL Phase 31 Step 5B.
 *
 * Implements:
 * - Robust unread state tracking, unread divider, and auto-scroll to first unread
 * - Consecutive message grouping (5-minute window, same sender, same date)
 * - State-aware context menu (FAILED vs normal messages)
 * - Duplicate-safe failed message retry with loading spinner
 * - Meaningful toast notifications via useToast() without leaking secrets
 * - In-conversation search and selection toolbar
 * - Zero cryptographic or protocol regressions.
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
  useToast,
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

  const isKeyChanged = activeContact?.verificationStatus === 'MISMATCH';
  const isVerifiedContact = Boolean(
    activeConv?.isVerified || activeContact?.verificationStatus === 'VERIFIED'
  );

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
      showToast({
        type: 'error',
        message: `Audio playback error: ${err.message || 'Failed to decrypt voice note'}`,
      });
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
        showToast({
          type: 'success',
          message: `Downloaded ${msg.attachment.name}`,
        });
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

  // Safe failed message retry handler
  const handleRetryMessage = async (messageId: string) => {
    if (!activeChatId || retryingMessageIds.has(messageId)) return;

    setRetryingMessageIds((prev) => new Set(prev).add(messageId));
    try {
      await retryFailedMessage(activeChatId, messageId);
      showToast({ type: 'success', message: 'Message sent successfully' });
    } catch (_err) {
      showToast({ type: 'error', message: 'Failed to send message. Stored locally.' });
    } finally {
      setRetryingMessageIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  // Context Menu Handlers
  const handleOpenContextMenu = (e: React.MouseEvent, msg: UIMessage) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 175;
    const menuHeight = 220;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenu({ isOpen: true, x, y, message: msg });
  };

  const handleCopyMessageText = (msg?: UIMessage | null) => {
    const target = msg || contextMenu.message;
    if (target && target.text && navigator.clipboard) {
      navigator.clipboard.writeText(target.text);
      showToast({ type: 'info', message: 'Message copied to clipboard' });
    }
  };

  const handleDeleteMessage = async (msg?: UIMessage | null) => {
    const target = msg || contextMenu.message;
    if (target && activeChatId) {
      await deleteMessageLocally(activeChatId, target.id);
      showToast({ type: 'info', message: 'Message deleted locally' });
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
      showToast({ type: 'info', message: `${selectedMessageIds.size} messages copied` });
    }
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  };

  const handleDeleteSelected = async () => {
    if (activeChatId && selectedMessageIds.size > 0) {
      const count = selectedMessageIds.size;
      await deleteMessagesLocally(activeChatId, Array.from(selectedMessageIds));
      showToast({ type: 'info', message: `${count} messages deleted locally` });
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

  // Consecutive Message Grouping Helpers
  const isSameSender = (m1?: UIMessage | null, m2?: UIMessage | null) => {
    if (!m1 || !m2) return false;
    return m1.isOutgoing === m2.isOutgoing && m1.senderId === m2.senderId;
  };

  const isWithinTimeWindow = (m1?: UIMessage | null, m2?: UIMessage | null) => {
    if (!m1 || !m2) return false;
    return Math.abs(m1.timestamp - m2.timestamp) <= 300000; // 5 minutes
  };

  const isSameDate = (m1?: UIMessage | null, m2?: UIMessage | null) => {
    if (!m1 || !m2) return false;
    return new Date(m1.timestamp).toDateString() === new Date(m2.timestamp).toDateString();
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

            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
              onClick={() => {
                if (activeConv.type === 'direct') {
                  openModal({ type: 'profile', peerId: activeConv.id });
                } else {
                  openModal({ type: 'groupDetails', conversationId: activeConv.id });
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  if (activeConv.type === 'direct') {
                    openModal({ type: 'profile', peerId: activeConv.id });
                  } else {
                    openModal({ type: 'groupDetails', conversationId: activeConv.id });
                  }
                }
              }}
              title={`View ${activeConv.name} Profile`}
            >
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
                  {isKeyChanged ? (
                    <Badge variant="danger">🚨 Key Changed</Badge>
                  ) : isVerifiedContact ? (
                    <Badge variant="secure">✓ Verified</Badge>
                  ) : null}
                </div>
                <StatusIndicator
                  status="secure"
                  label={activeConv.type === 'group' ? 'Encrypted Group Ratchet' : '🔒 Double Ratchet E2EE'}
                />
              </div>
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
                variant={isKeyChanged ? 'danger' : isVerifiedContact ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => openModal({ type: 'contactDetails', conversationId: activeConv.id })}
              >
                {isKeyChanged
                  ? '🚨 Review Key'
                  : isVerifiedContact
                  ? '🛡️ Safety Number'
                  : 'Verify Identity'}
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

            // Grouping calculations
            const prevMsg = index > 0 ? activeMessages[index - 1] : null;
            const nextMsg = index < activeMessages.length - 1 ? activeMessages[index + 1] : null;

            const isGroupedWithPrev =
              isSameSender(msg, prevMsg) && isWithinTimeWindow(msg, prevMsg) && isSameDate(msg, prevMsg);
            const isGroupedWithNext =
              isSameSender(msg, nextMsg) && isWithinTimeWindow(msg, nextMsg) && isSameDate(msg, nextMsg);

            // Date separator calculation
            const showDateSeparator =
              !prevMsg ||
              new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

            // Unread divider calculation
            const showUnreadDivider = firstUnreadIndex > 0 && index === firstUnreadIndex;

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

                {showUnreadDivider && (
                  <div ref={unreadRef} className="veil-unread-divider">
                    New Messages
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
                  onRetry={() => handleRetryMessage(msg.id)}
                  isRetrying={retryingMessageIds.has(msg.id)}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedMessageIds.has(msg.id)}
                  onSelectToggle={() => toggleSelectMessage(msg.id)}
                  onContextMenu={(e) => handleOpenContextMenu(e, msg)}
                  onLongPress={() => {
                    setIsSelectionMode(true);
                    toggleSelectMessage(msg.id);
                  }}
                  isHighlighted={highlightedMessageId === msg.id}
                  isGroupedWithPrevious={isGroupedWithPrev}
                  isGroupedWithNext={isGroupedWithNext}
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

      {/* State-Aware Context Menu Popup */}
      {contextMenu.isOpen && contextMenu.message && (
        <div
          className="veil-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          role="menu"
          aria-label="Message Actions"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Reply only available on non-failed messages */}
          {contextMenu.message.status !== 'FAILED' && (
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
          )}

          {/* Copy available whenever text exists */}
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

          {/* Retry only available on failed messages */}
          {contextMenu.message.status === 'FAILED' && (
            <button
              type="button"
              className="veil-context-menu-item"
              role="menuitem"
              onClick={() => {
                if (contextMenu.message) handleRetryMessage(contextMenu.message.id);
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
