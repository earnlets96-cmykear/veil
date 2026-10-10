/**
 * Modernized Mobile-First Message Composer Component for VEIL.
 *
 * Implements Telegram-inspired auto-expanding composer, pre-send attachment staging,
 * in-app media picker bottom sheet with per-media privacy options,
 * live voice note recording & sending with waveform pulse, reply quote banners,
 * contextual Android permission handling, and 100% SVG vector iconography.
 */

import React, { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { useComposer, resolveReplyReference } from '../app/AppState.tsx';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import { IconButton, ReplyPreview, Spinner, useToast, EmojiDrawer } from './ui/index.ts';
import { StickerItem, telegramStickerService } from '../../media/telegramStickerService.ts';
import {
  SendIcon,
  PaperclipIcon,
  MicIcon,
  CloseIcon,
  CheckIcon,
  EditIcon,
  TrashIcon,
  LockIcon,
} from './icons/index.ts';
import { AttachmentPreviewModal } from './media/AttachmentPreviewModal.tsx';
import { MediaPickerModal, MediaPickerSendOptions } from './media/MediaPickerModal.tsx';
import { PermissionsModal } from './PermissionsModal.tsx';
import { BackButtonManager } from '../utils/backButtonManager.ts';
import { useTextareaAutoResize } from '../hooks/useTextareaAutoResize.ts';

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
  } = useComposer();
  const { showToast } = useToast();

  const activeConv = conversations.find((c) => c.id === conversationId);
  const activeContact = contacts.find((c) => c.identityId === conversationId);
  const peerName = activeContact?.name || activeConv?.name;
  const selfName = myProfile?.displayName || myProfile?.username;

  const textValueRef = useRef('');
  const hasTextRef = useRef(false);
  const [hasText, setHasText] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [stagedFiles, setStagedFiles] = useState<File[] | null>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const lastMediaPickerClosedAtRef = useRef<number>(0);
  const [isEmojiDrawerOpen, setIsEmojiDrawerOpen] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isPermissionPermanent, setIsPermissionPermanent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeTextarea = useTextareaAutoResize(textareaRef);
  const recorderRef = useRef<VoiceRecorder | null>(null);

  const updateComposerText = useCallback((nextText: string) => {
    textValueRef.current = nextText;
    if (textareaRef.current && textareaRef.current.value !== nextText) {
      textareaRef.current.value = nextText;
    }
    resizeTextarea();

    const nextHasText = Boolean(nextText.trim());
    if (nextHasText !== hasTextRef.current) {
      hasTextRef.current = nextHasText;
      setHasText(nextHasText);
    }
  }, [resizeTextarea]);

  const handleSend = () => {
    const msgText = textValueRef.current.trim();
    if (!msgText) return;
    updateComposerText('');

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
      updateComposerText(editingMessage.text);
      // Auto-focus and resize textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 50);
    }
  }, [editingMessage, updateComposerText]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter in desktop browsers; mobile layouts and native apps keep newlines.
    if (e.key === 'Enter' && !e.shiftKey && typeof window !== 'undefined' && window.innerWidth > 768 && !Capacitor.isNativePlatform()) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    textValueRef.current = e.currentTarget.value;
    resizeTextarea();
    const nextHasText = Boolean(textValueRef.current.trim());
    if (nextHasText !== hasTextRef.current) {
      hasTextRef.current = nextHasText;
      setHasText(nextHasText);
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
  const handleInsertEmoji = useCallback((emoji: string) => {
    const prev = textValueRef.current;
    const textarea = textareaRef.current;
    if (!textarea) {
      updateComposerText(prev + emoji);
      return;
    }
    const start = textarea.selectionStart ?? prev.length;
    const end = textarea.selectionEnd ?? prev.length;
    const nextText = prev.slice(0, start) + emoji + prev.slice(end);
    updateComposerText(nextText);
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = start + emoji.length;
        try {
          textareaRef.current.setSelectionRange(newPos, newPos);
        } catch {
          // Ignore if setSelectionRange is not supported
        }
      }
    }, 0);
  }, [updateComposerText]);

  const handleEmojiBackspace = useCallback(() => {
    const prev = textValueRef.current;
    if (!prev) return;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? prev.length;
    const end = textarea?.selectionEnd ?? prev.length;
    if (start !== end) {
      const nextText = prev.slice(0, start) + prev.slice(end);
      updateComposerText(nextText);
      setTimeout(() => {
        if (textareaRef.current) {
          try {
            textareaRef.current.setSelectionRange(start, start);
          } catch {
            // Ignore
          }
        }
      }, 0);
      return;
    }
    if (start === 0) return;
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
      updateComposerText(nextText);
      setTimeout(() => {
        if (textareaRef.current) {
          try {
            textareaRef.current.setSelectionRange(newPos, newPos);
          } catch {
            // Ignore
          }
        }
      }, 0);
      return;
    }
    updateComposerText(prev.slice(0, -1));
  }, [updateComposerText]);

  const handleCloseEmojiDrawer = useCallback(() => {
    setIsEmojiDrawerOpen(false);
  }, []);

  // Register Priority 30: Emoji/Sticker drawer OR Media Picker
  useEffect(() => {
    if (!isEmojiDrawerOpen && !isMediaPickerOpen) return;

    return BackButtonManager.register('composer:drawers', 30, () => {
      if (isEmojiDrawerOpen) {
        setIsEmojiDrawerOpen(false);
        return true;
      }
      if (isMediaPickerOpen) {
        setIsMediaPickerOpen(false);
        return true;
      }
      return false;
    });
  }, [isEmojiDrawerOpen, isMediaPickerOpen]);

  // Sticker selection handler (Double Ratchet E2EE dispatch)
  const handleSelectSticker = useCallback(
    async (sticker: StickerItem) => {
      try {
        const blob = await telegramStickerService.fetchStickerBlob(sticker.url, { allowSyntheticFallback: false });
        const isSvg = sticker.url.startsWith('data:image/svg') || (blob.type && blob.type.includes('svg'));
        const mimeType = isSvg ? 'image/svg+xml' : 'image/webp';
        const ext = isSvg ? 'svg' : 'webp';
        const safePackId = sticker.packId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'custom';
        const file = new File([blob], `${safePackId}__${sticker.id}.sticker.${ext}`, { type: mimeType });
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
  };

  const handleSendVoice = async () => {
    if (!recorderRef.current) return;
    setIsSending(true);
    try {
      const { audioBlob, durationSeconds, mimeType } = await recorderRef.current.stopRecording();
      setIsRecording(false);
      setIsLocked(false);
      await sendVoiceMessage(conversationId, durationSeconds, audioBlob, mimeType);
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message || 'Failed to send voice message' });
    } finally {
      setIsSending(false);
      setIsRecording(false);
      setIsLocked(false);
      recorderRef.current = null;
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
              updateComposerText('');
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
      <div className="veil-composer veil-composer-stateful" role="region" aria-label="Message Composer">
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
            role="group"
            aria-label="Voice recording controls"
          >
            {/* Trash button to cancel */}
            <button
              type="button"
              className="veil-recording-trash-btn"
              onTouchEnd={(event) => event.stopPropagation()}
              onMouseUp={(event) => event.stopPropagation()}
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

            <div className={isLocked ? 'veil-recording-locked-hint' : 'veil-recording-hint'} role="status" aria-live="polite">
              {isLocked ? <><LockIcon size={13} /><span>Recording locked</span></> : <span>Recording</span>}
            </div>

            <div className="veil-recording-actions">
              <button
                type="button"
                className={`veil-recording-lock-btn${isLocked ? ' is-locked' : ''}`}
                onClick={() => setIsLocked((locked) => !locked)}
                aria-label={isLocked ? 'Unlock recording' : 'Lock recording'}
                aria-pressed={isLocked}
                title={isLocked ? 'Unlock recording' : 'Lock recording'}
              >
                <LockIcon size={17} />
              </button>
              <button
                type="button"
                className="veil-btn-composer-send veil-btn-composer-recording-active"
                onClick={handleSendVoice}
                disabled={isSending}
                aria-label="Send voice recording"
                title="Send voice recording"
              >
                {isSending ? <Spinner size="xs" /> : <SendIcon size={18} color="#ffffff" />}
              </button>
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
            {hasText || editingMessage ? (
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
                aria-label="Record Voice Note"
                title="Record a voice note"
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
        onClose={handleCloseEmojiDrawer}
      />
    </div>
  );
};

export const MessageComposer = React.memo(MessageComposerComponent);
