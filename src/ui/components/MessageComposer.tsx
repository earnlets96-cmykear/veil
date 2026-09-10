/**
 * Modernized Mobile-First Message Composer Component for VEIL.
 *
 * Implements Telegram-inspired auto-expanding composer, pre-send attachment staging,
 * in-app media picker bottom sheet with per-media privacy options,
 * live voice note recording & sending with waveform pulse, reply quote banners,
 * contextual Android permission handling, and 100% SVG vector iconography.
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import { useApp, resolveReplyReference } from '../app/AppState.tsx';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import { Button, IconButton, ReplyPreview, Spinner, useToast } from './ui/index.ts';
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

  // Confirm sending staged files (non-blocking)
  const handleConfirmSendFiles = async (filesToSend: File[], caption?: string) => {
    setStagedFiles(null);
    try {
      if (filesToSend.length === 1) {
        sendAttachment(conversationId, filesToSend[0]);
      } else if (filesToSend.length > 1) {
        sendAttachments(conversationId, filesToSend);
      }
      if (caption && caption.trim()) {
        await sendMessage(conversationId, caption.trim());
      }
    } catch (_err) {
      // Background queue preserves messages
    }
  };

  // Handle send from In-App Media Picker
  const handleMediaPickerSend = async (options: MediaPickerSendOptions) => {
    try {
      if (options.files.length === 1) {
        sendAttachment(conversationId, options.files[0]);
      } else if (options.files.length > 1) {
        sendAttachments(conversationId, options.files);
      }
      if (options.caption && options.caption.trim()) {
        await sendMessage(conversationId, options.caption.trim());
      }
    } catch (_err) {
      // Background queue preserves messages
    }
  };

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
          onClose={() => setIsMediaPickerOpen(false)}
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

      {/* Quoted Message Reply Banner */}
      {replyTarget && !editingMessage && (
        <ReplyPreview
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
          /* Live Voice Recording Controls with Telegram Gestures */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: '0.75rem',
              minHeight: '44px',
              position: 'relative',
              overflow: 'visible',
            }}
            onTouchMove={handleMicTouchMove}
            onMouseMove={handleMicTouchMove}
            onTouchEnd={handleMicTouchEnd}
            onMouseUp={handleMicTouchEnd}
          >
            {/* Timer & Pulsing Red Indicator with Soundwave Bars */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--veil-danger, #ef4444)',
                  boxShadow: '0 0 8px var(--veil-danger, #ef4444)',
                  animation: 'veilPulse 1.2s infinite',
                }}
              />
              <span style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm, 14px)', color: 'var(--veil-text-primary)' }}>
                {formatTimer(recordSeconds)}
              </span>

              {/* Soundwave animation bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '14px', marginLeft: '4px' }}>
                <span style={{ width: '3px', height: '8px', backgroundColor: 'var(--veil-danger, #ef4444)', borderRadius: '2px' }} />
                <span style={{ width: '3px', height: '14px', backgroundColor: 'var(--veil-danger, #ef4444)', borderRadius: '2px' }} />
                <span style={{ width: '3px', height: '6px', backgroundColor: 'var(--veil-danger, #ef4444)', borderRadius: '2px' }} />
                <span style={{ width: '3px', height: '12px', backgroundColor: 'var(--veil-danger, #ef4444)', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Middle: Slide to Cancel Hint (when dragging/holding and not locked) */}
            {!isLocked ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: isCancelling ? 'var(--veil-danger, #ef4444)' : 'var(--veil-text-muted, #94a3b8)',
                  fontSize: '13px',
                  fontWeight: 500,
                  transform: `translateX(${dragOffset.x * 0.4}px)`,
                  transition: isCancelling ? 'all 0.15s ease' : 'none',
                  userSelect: 'none',
                }}
              >
                <TrashIcon
                  size={16}
                  color={isCancelling ? 'var(--veil-danger, #ef4444)' : 'currentColor'}
                  style={{
                    transform: isCancelling ? 'scale(1.25) rotate(-10deg)' : 'scale(1)',
                    transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  }}
                />
                <span>{isCancelling ? 'Release to cancel' : '‹ Slide to cancel'}</span>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--veil-accent-primary, #14b8a6)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
              >
                <LockIcon size={14} />
                <span>Hands-free locked</span>
              </div>
            )}

            {/* Right Side Controls */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {isLocked ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleCancelVoice}
                    aria-label="Cancel Voice Recording"
                    style={{ color: 'var(--veil-danger, #ef4444)' }}
                  >
                    <TrashIcon size={16} />
                    <span>Cancel</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSendVoice}
                    disabled={isSending}
                    aria-label="Send Voice Message"
                  >
                    {isSending ? <Spinner size="xs" /> : <SendIcon size={16} />}
                    <span>Send</span>
                  </Button>
                </>
              ) : (
                /* Active Dragging / Hold Mic Indicator */
                <div style={{ position: 'relative' }}>
                  {/* Floating Lock indicator pill emerging above mic */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '-38px',
                      left: '50%',
                      transform: `translateX(-50%) translateY(${dragOffset.y * 0.4}px)`,
                      background: 'var(--veil-bg-surface, #1e293b)',
                      borderRadius: '14px',
                      padding: '3px 7px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      opacity: dragOffset.y < -10 ? 1 : 0.7,
                      fontSize: '9px',
                      color: 'var(--veil-text-secondary, #cbd5e1)',
                      pointerEvents: 'none',
                      transition: 'opacity 0.2s ease',
                    }}
                  >
                    <LockIcon size={12} color="var(--veil-accent-primary, #14b8a6)" />
                    <span style={{ fontSize: '8px', lineHeight: 1 }}>^</span>
                  </div>

                  <button
                    type="button"
                    className="veil-btn-composer-send"
                    style={{
                      background: 'var(--veil-danger, #ef4444)',
                      transform: `translate(${dragOffset.x}px, ${dragOffset.y}px) scale(1.08)`,
                      transition: dragOffset.x === 0 && dragOffset.y === 0 ? 'transform 0.2s ease' : 'none',
                      boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
                    }}
                    onClick={handleSendVoice}
                    aria-label="Send Voice Recording"
                  >
                    <MicIcon size={20} color="#ffffff" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Standard Message & Attachment Controls */
          <>
            <IconButton
              icon={<PaperclipIcon size={20} />}
              variant="ghost"
              onClick={() => setIsMediaPickerOpen(true)}
              aria-label="Attach Encrypted File"
              title="Attach Encrypted File"
            />

            <IconButton
              icon={<MicIcon size={20} />}
              variant="ghost"
              onClick={handleStartVoice}
              onTouchStart={handleMicTouchStart}
              onMouseDown={handleMicTouchStart}
              aria-label="Record Voice Note"
              title="Hold to record, slide left to cancel, slide up to lock"
            />

            <textarea
              ref={textareaRef}
              className="veil-composer-input"
              placeholder="Type an encrypted message..."
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Message Input Field"
            />

            <button
              type="button"
              className="veil-btn-composer-send"
              onClick={handleSend}
              disabled={!text.trim()}
              aria-label={editingMessage ? 'Confirm Edit' : 'Send Message'}
              title={editingMessage ? 'Confirm Edit' : 'Send Message'}
              style={editingMessage ? { background: 'var(--veil-accent-primary, #14b8a6)' } : undefined}
            >
              {editingMessage ? <CheckIcon size={18} color="#ffffff" /> : <SendIcon size={18} color="#ffffff" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export const MessageComposer = React.memo(MessageComposerComponent);
