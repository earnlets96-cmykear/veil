/**
 * Modernized Mobile-First Message Composer Component for VEIL.
 *
 * Implements Telegram-inspired auto-expanding composer, pre-send attachment staging,
 * in-app media picker bottom sheet with per-media privacy options,
 * live voice note recording & sending with waveform pulse, reply quote banners,
 * contextual Android permission handling, and 100% SVG vector iconography.
 */

import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { useApp, resolveReplyReference } from '../app/AppState.tsx';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import { Button, IconButton, ReplyPreview, Spinner, useToast, EmojiDrawer } from './ui/index.ts';
import { StickerItem, telegramStickerService } from '../../media/telegramStickerService.ts';
import {
  SendIcon,
  PaperclipIcon,
  MicIcon,
  CloseIcon,
  StopIcon,
  CheckIcon,
  EditIcon,
  TrashIcon,
  LockIcon,
} from './icons/index.ts';
import { AttachmentPreviewModal } from './media/AttachmentPreviewModal.tsx';
import { MediaPickerModal, MediaPickerSendOptions } from './media/MediaPickerModal.tsx';
import { PermissionsModal } from './PermissionsModal.tsx';

import type { UIMessage } from '../app/types.ts';

interface MessageComposerProps {
  conversationId: string;
  editingMessage?: UIMessage | null;
  onCancelEdit?: () => void;
  onConfirmEdit?: (newText: string) => void;
}

const MessageComposerComponent: React.FC<MessageComposerProps> = ({
  conversationId,
  editingMessage = null,
  onCancelEdit,
  onConfirmEdit,
}) => {
  const {
    sendMessage,
    sendAttachment,
    sendAttachments,
    sendVoiceMessage,
    replyTarget,
    setReplyTarget,
    myProfile,
    contacts,
    conversations,
  } = useApp();
  const { showToast } = useToast();

  const activeConv = conversations.find((c) => c.id === conversationId);
  const activeContact = contacts.find((c) => c.identityId === conversationId);
  const peerName = activeContact?.name || activeConv?.name;
  const selfName = myProfile?.displayName || myProfile?.username;

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isCancelling, setIsCancelling] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [stagedFiles, setStagedFiles] = useState<File[] | null>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const lastMediaPickerClosedAtRef = useRef<number>(0);
  const [isEmojiDrawerOpen, setIsEmojiDrawerOpen] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isPermissionPermanent, setIsPermissionPermanent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const hapticCancelledRef = useRef<boolean>(false);
  const hapticLockedRef = useRef<boolean>(false);

  const handleSend = () => {
    if (!text.trim()) return;
    const msgText = text.trim();
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // If editing, confirm the edit instead of sending a new message
    if (editingMessage && onConfirmEdit) {
      onConfirmEdit(msgText);
      return;
    }

    // Fire-and-forget: AppState optimistically displays the message in 0ms
    // while Double Ratchet encryption and relay transport proceed in the background.
    sendMessage(conversationId, msgText).catch((_err) => {
      // Offline queue preserves message
    });
  };

  // Pre-fill text when entering edit mode
  React.useEffect(() => {
    if (editingMessage && editingMessage.text) {
      setText(editingMessage.text);
      // Auto-focus and resize textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
        }
      }, 50);
    }
  }, [editingMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift) on desktop; allow normal newline on mobile keyboards
    if (e.key === 'Enter' && !e.shiftKey && typeof window !== 'undefined' && window.innerWidth > 768) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow textarea up to 140px max height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  };

  // Stage files for pre-send preview modal
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setStagedFiles(fileArray);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Confirm sending staged files (Telegram-style single message with caption)
  const handleConfirmSendFiles = async (filesToSend: File[], caption?: string) => {
    setStagedFiles(null);
    try {
      const trimmedCaption = caption?.trim() || undefined;
      if (filesToSend.length === 1) {
        sendAttachment(conversationId, filesToSend[0], { caption: trimmedCaption });
      } else if (filesToSend.length > 1) {
        sendAttachments(conversationId, filesToSend, { caption: trimmedCaption });
      }
    } catch (_err) {
      // Background queue preserves messages
    }
  };

  // Handle send from In-App Media Picker (Telegram-style single message with caption)
  const handleMediaPickerSend = async (options: MediaPickerSendOptions) => {
    try {
      const trimmedCaption = options.caption?.trim() || undefined;
      if (options.files.length === 1) {
        sendAttachment(conversationId, options.files[0], { caption: trimmedCaption });
      } else if (options.files.length > 1) {
        sendAttachments(conversationId, options.files, { caption: trimmedCaption });
      }
    } catch (_err) {
      // Background queue preserves messages
    }
  };

  // Emoji insertion and backspace handlers
  const handleInsertEmoji = (emoji: string) => {
    setText((prev) => {
      const textarea = textareaRef.current;
      if (!textarea) return prev + emoji;
      const start = textarea.selectionStart ?? prev.length;
      const end = textarea.selectionEnd ?? prev.length;
      const nextText = prev.slice(0, start) + emoji + prev.slice(end);
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = start + emoji.length;
          try {
            textareaRef.current.setSelectionRange(newPos, newPos);
          } catch {
            // Ignore if setSelectionRange is not supported
          }
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
        }
      }, 0);
      return nextText;
    });
  };

  const handleEmojiBackspace = () => {
    setText((prev) => {
      if (!prev) return '';
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? prev.length;
      const end = textarea?.selectionEnd ?? prev.length;
      if (start !== end) {
        const nextText = prev.slice(0, start) + prev.slice(end);
        setTimeout(() => {
          if (textareaRef.current) {
            try {
              textareaRef.current.setSelectionRange(start, start);
            } catch {
              // Ignore
            }
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
          }
        }, 0);
        return nextText;
      }
      if (start === 0) return prev;
      const chars = Array.from(prev);
      let runningLength = 0;
      let deleteIdx = -1;
      for (let i = 0; i < chars.length; i++) {
        runningLength += chars[i].length;
        if (runningLength >= start) {
          deleteIdx = i;
          break;
        }
      }
      if (deleteIdx >= 0) {
        chars.splice(deleteIdx, 1);
        const nextText = chars.join('');
        const newPos = Math.max(0, start - (prev.length - nextText.length));
        setTimeout(() => {
          if (textareaRef.current) {
            try {
              textareaRef.current.setSelectionRange(newPos, newPos);
            } catch {
              // Ignore
            }
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
          }
        }, 0);
        return nextText;
      }
      return prev.slice(0, -1);
    });
  };

  // Sticker selection handler (Double Ratchet E2EE dispatch)
  const handleSelectSticker = useCallback(
    async (sticker: StickerItem) => {
      try {
        setIsEmojiDrawerOpen(false);
        const blob = await telegramStickerService.fetchStickerBlob(sticker.url);
        const isSvg = sticker.url.startsWith('data:image/svg') || (blob.type && blob.type.includes('svg'));
        const mimeType = isSvg ? 'image/svg+xml' : 'image/webp';
        const ext = isSvg ? 'svg' : 'webp';
        const file = new File([blob], `${sticker.id}.sticker.${ext}`, { type: mimeType });
        (file as any).isSticker = true;
        await sendAttachment(conversationId, file, { isSticker: true } as any);
      } catch (err: any) {
        showToast({
          type: 'error',
          message: err?.message || 'Failed to send sticker',
        });
      }
    },
    [conversationId, sendAttachment, showToast]
  );

  // Voice recording controls with runtime permission management
  const startRecordingFlow = async () => {
    try {
      const rec = new VoiceRecorder();
      recorderRef.current = rec;
      setRecordSeconds(0);
      setIsRecording(true);
      await rec.startRecording((seconds) => setRecordSeconds(seconds));
      setShowPermissionModal(false);
    } catch (err: any) {
      setIsRecording(false);
      const errMsg = (err?.message || '').toLowerCase();
      const isDenied = errMsg.includes('denied') || errMsg.includes('not allowed') || errMsg.includes('permission');
      if (isDenied) {
        setIsPermissionPermanent(true);
        setShowPermissionModal(true);
      } else {
        showToast({
          type: 'error',
          message: err?.message || 'Microphone not supported or unavailable',
        });
      }
    }
  };

  const handleStartVoice = async () => {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'microphone' as any });
        if (perm.state === 'denied') {
          setIsPermissionPermanent(true);
          setShowPermissionModal(true);
          return;
        } else if (perm.state === 'prompt') {
          // Show permission explanation before prompting
          setIsPermissionPermanent(false);
          setShowPermissionModal(true);
          return;
        }
      } catch (_e) {
        // Fall through to standard getUserMedia request
      }
    }
    await startRecordingFlow();
  };

  const handleCancelVoice = () => {
    if (recorderRef.current) {
      recorderRef.current.cancelRecording();
      recorderRef.current = null;
    }
    setIsRecording(false);
    setIsLocked(false);
    setRecordSeconds(0);
    setDragOffset({ x: 0, y: 0 });
    setIsCancelling(false);
    touchStartRef.current = null;
    hapticCancelledRef.current = false;
    hapticLockedRef.current = false;
  };

  const handleSendVoice = async () => {
    if (!recorderRef.current) return;
    setIsSending(true);
    try {
      const { audioBlob, durationSeconds, mimeType } = await recorderRef.current.stopRecording();
      setIsRecording(false);
      setIsLocked(false);
      setDragOffset({ x: 0, y: 0 });
      setIsCancelling(false);
      await sendVoiceMessage(conversationId, durationSeconds, audioBlob, mimeType);
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message || 'Failed to send voice message' });
    } finally {
      setIsSending(false);
      setIsRecording(false);
      setIsLocked(false);
      setDragOffset({ x: 0, y: 0 });
      setIsCancelling(false);
      recorderRef.current = null;
      touchStartRef.current = null;
    }
  };

  const handleMicTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (isRecording) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    touchStartRef.current = { x: clientX, y: clientY };
    recordStartTimeRef.current = Date.now();
    hapticCancelledRef.current = false;
    hapticLockedRef.current = false;
    setIsCancelling(false);
    setDragOffset({ x: 0, y: 0 });
    startRecordingFlow();
  };

  const handleMicTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isRecording || isLocked || !touchStartRef.current) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const dx = clientX - touchStartRef.current.x;
    const dy = clientY - touchStartRef.current.y;

    const clampedX = Math.min(0, Math.max(-140, dx));
    const clampedY = Math.min(0, Math.max(-100, dy));
    setDragOffset({ x: clampedX, y: clampedY });

    // Slide left to cancel threshold: dx < -70px
    if (dx < -70) {
      if (!isCancelling) {
        setIsCancelling(true);
        if (!hapticCancelledRef.current && typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(12); } catch (_e) {}
          hapticCancelledRef.current = true;
        }
      }
    } else {
      if (isCancelling) {
        setIsCancelling(false);
        hapticCancelledRef.current = false;
      }
    }

    // Slide up to lock threshold: dy < -60px
    if (dy < -60) {
      setIsLocked(true);
      setDragOffset({ x: 0, y: 0 });
      setIsCancelling(false);
      if (!hapticLockedRef.current && typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([10, 30, 10]); } catch (_e) {}
        hapticLockedRef.current = true;
      }
    }
  };

  const handleMicTouchEnd = () => {
    if (!isRecording) return;
    if (isLocked) {
      // In locked mode, releasing keeps hands-free recording active
      return;
    }

    if (isCancelling || dragOffset.x < -70) {
      handleCancelVoice();
      return;
    }

    const elapsed = Date.now() - recordStartTimeRef.current;
    if (elapsed >= 600) {
      // Hold & release sends immediately
      handleSendVoice();
    } else {
      // Quick tap keeps recording open so user can speak and tap Send
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Pre-send Attachment Preview Modal */}
      {stagedFiles && (
        <AttachmentPreviewModal
          files={stagedFiles}
          onConfirmSend={handleConfirmSendFiles}
          onCancel={() => setStagedFiles(null)}
        />
      )}

      {/* In-App Media & File Picker Bottom Sheet */}
      {isMediaPickerOpen && (
        <MediaPickerModal
          isOpen={isMediaPickerOpen}
          onClose={() => {
            lastMediaPickerClosedAtRef.current = Date.now();
            setIsMediaPickerOpen(false);
          }}
          onSend={handleMediaPickerSend}
        />
      )}

      {/* Permission Explanation Modal */}
      {showPermissionModal && (
        <PermissionsModal
          type="microphone"
          isPermanentlyDenied={isPermissionPermanent}
          onAllow={startRecordingFlow}
          onCancel={() => setShowPermissionModal(false)}
        />
      )}

      {/* Editing Message Banner */}
      {editingMessage && (
        <div
          className="veil-edit-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: 'rgba(20, 184, 166, 0.08)',
            borderLeft: '3px solid var(--veil-accent-primary, #14b8a6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <EditIcon size={14} color="var(--veil-accent-primary)" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--veil-accent-primary)', marginBottom: '2px' }}>Editing message</div>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--veil-text-secondary, rgba(255,255,255,0.6))',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {editingMessage.text}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (onCancelEdit) onCancelEdit();
              setText('');
              if (textareaRef.current) textareaRef.current.style.height = 'auto';
            }}
            style={{
              appearance: 'none',
              background: 'none',
              border: 'none',
              color: 'var(--veil-text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              display: 'inline-flex',
            }}
            aria-label="Cancel edit"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      )}

      {/* Quoted Message Reply Banner (Screenshot 2 floating banner) */}
      {replyTarget && !editingMessage && (
        <ReplyPreview
          className="veil-composer-reply-banner"
          replyTo={{
            ...resolveReplyReference(replyTarget, selfName, peerName)!,
            thumbnailUrl:
              replyTarget.attachment?.previewUrl ||
              replyTarget.attachment?.localPreviewUrl ||
              replyTarget.attachments?.[0]?.previewUrl ||
              replyTarget.attachments?.[0]?.localPreviewUrl,
          }}
          onDismiss={() => setReplyTarget(null)}
        />
      )}

      {/* Composer Input Row */}
      <div className="veil-composer" role="region" aria-label="Message Composer">
        <input
          type="file"
          ref={fileInputRef}
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-hidden="true"
        />

        {isRecording ? (
          /* Live Voice Recording Controls (Screenshot 4) */
          <div
            className="veil-recording-pill"
            onTouchMove={handleMicTouchMove}
            onMouseMove={handleMicTouchMove}
            onTouchEnd={handleMicTouchEnd}
            onMouseUp={handleMicTouchEnd}
          >
            {/* Trash button to cancel */}
            <button
              type="button"
              className="veil-recording-trash-btn"
              onClick={handleCancelVoice}
              aria-label="Cancel recording"
            >
              <TrashIcon size={18} color="var(--veil-text-secondary, #94a3b8)" />
            </button>

            {/* Timer & Pulsing Red Indicator */}
            <div className="veil-recording-timer-group">
              <span className="veil-recording-dot" />
              <span className="veil-recording-timer-text">
                {formatTimer(recordSeconds)}
              </span>
            </div>

            {/* Dynamic Soundwave animation bars */}
            <div className="veil-recording-soundwave">
              <span className="veil-soundwave-bar bar-1" />
              <span className="veil-soundwave-bar bar-2" />
              <span className="veil-soundwave-bar bar-3" />
              <span className="veil-soundwave-bar bar-4" />
              <span className="veil-soundwave-bar bar-5" />
              <span className="veil-soundwave-bar bar-6" />
              <span className="veil-soundwave-bar bar-7" />
              <span className="veil-soundwave-bar bar-8" />
            </div>

            {/* Cancel slide hint */}
            {!isLocked ? (
              <div
                className="veil-recording-cancel-hint"
                style={{
                  transform: `translateX(${dragOffset.x * 0.4}px)`,
                  color: isCancelling ? 'var(--veil-danger, #ef4444)' : 'var(--veil-text-secondary, #94a3b8)',
                }}
              >
                <span>{isCancelling ? 'Release to cancel' : '‹ Cancel'}</span>
              </div>
            ) : (
              <div className="veil-recording-locked-hint">
                <LockIcon size={13} />
                <span>Locked</span>
              </div>
            )}

            {/* Right Side Mic / Actions */}
            <div className="veil-recording-mic-wrapper">
              {!isLocked && (
                <div
                  className="veil-recording-lock-pill"
                  style={{
                    transform: `translateX(-50%) translateY(${dragOffset.y * 0.4}px)`,
                    opacity: dragOffset.y < -10 ? 1 : 0.85,
                  }}
                >
                  <LockIcon size={12} color="var(--veil-accent-primary, #14b8a6)" />
                  <span>Slide up to lock</span>
                  <svg className="veil-lock-arrow-bounce" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </div>
              )}

              {isLocked ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelVoice}
                    aria-label="Cancel Voice Recording"
                    style={{ color: 'var(--veil-danger, #ef4444)', padding: '4px 8px' }}
                  >
                    <TrashIcon size={15} />
                  </Button>
                  <button
                    type="button"
                    className="veil-btn-composer-send"
                    onClick={handleSendVoice}
                    disabled={isSending}
                    aria-label="Send Voice Message"
                  >
                    {isSending ? <Spinner size="xs" /> : <SendIcon size={16} color="#ffffff" />}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="veil-btn-composer-send veil-btn-composer-recording-active"
                  style={{
                    transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.06)`,
                    transition: dragOffset.x === 0 && dragOffset.y === 0 ? 'transform 0.2s ease' : 'none',
                  }}
                  onClick={handleSendVoice}
                  aria-label="Send Voice Recording"
                >
                  <SendIcon size={18} color="#ffffff" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Standard Message & Attachment Controls (Screenshot 2 & 5) */
          <>
            {/* Plus button to open media / files */}
            <button
              type="button"
              className="veil-composer-plus-btn"
              onClick={() => {
                if (Date.now() - lastMediaPickerClosedAtRef.current < 350) return;
                setIsMediaPickerOpen(true);
              }}
              aria-label="Attach Encrypted File"
              title="Attach File or Media"
            >
              <span style={{ fontSize: '20px', fontWeight: 300, lineHeight: 1 }}>+</span>
            </button>

            {/* Center Message Box Island (contains textarea and inline emoji button) */}
            <div className="veil-composer-input-island">
              {/* Auto-expanding textarea */}
              <textarea
                ref={textareaRef}
                className="veil-composer-input"
                placeholder="Message..."
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (isEmojiDrawerOpen) setIsEmojiDrawerOpen(false);
                }}
                onClick={() => {
                  if (isEmojiDrawerOpen) setIsEmojiDrawerOpen(false);
                }}
                rows={1}
                aria-label="Type an encrypted message..."
              />

              {/* Inline emoji smiley button inside the message box */}
              <button
                type="button"
                className={`veil-composer-emoji-btn ${isEmojiDrawerOpen ? 'veil-composer-emoji-btn-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (!isEmojiDrawerOpen && textareaRef.current) {
                    textareaRef.current.blur();
                  }
                  setIsEmojiDrawerOpen((prev) => !prev);
                }}
                aria-label="Toggle emoji picker"
                title="Toggle emoji picker"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </button>
            </div>

            {/* Dynamic Send / Mic Action Button */}
            {text.trim() || editingMessage ? (
              <button
                type="button"
                className="veil-btn-composer-send"
                onClick={handleSend}
                aria-label={editingMessage ? 'Confirm Edit' : 'Send Message'}
                title={editingMessage ? 'Confirm Edit' : 'Send Message'}
              >
                {editingMessage ? (
                  <CheckIcon size={18} color="#ffffff" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                )}
              </button>
            ) : (
              <button
                type="button"
                className="veil-btn-composer-send veil-btn-composer-mic"
                onClick={handleStartVoice}
                onTouchStart={handleMicTouchStart}
                onMouseDown={handleMicTouchStart}
                aria-label="Record Voice Note"
                title="Hold to record, slide left to cancel, slide up to lock"
              >
                <MicIcon size={20} color="#ffffff" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Slide-up Emoji Drawer */}
      <EmojiDrawer
        isOpen={isEmojiDrawerOpen}
        onSelectEmoji={handleInsertEmoji}
        onSelectSticker={handleSelectSticker}
        onBackspace={handleEmojiBackspace}
        onClose={() => setIsEmojiDrawerOpen(false)}
      />
    </div>
  );
};

export const MessageComposer = React.memo(MessageComposerComponent);
