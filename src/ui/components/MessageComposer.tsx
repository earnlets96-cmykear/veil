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
} from './icons/index.ts';
import { AttachmentPreviewModal } from './media/AttachmentPreviewModal.tsx';
import { MediaPickerModal, MediaPickerSendOptions } from './media/MediaPickerModal.tsx';
import { PermissionsModal } from './PermissionsModal.tsx';

export const MessageComposer: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { sendMessage, sendAttachment, sendVoiceMessage, replyTarget, setReplyTarget } = useApp();
  const { showToast } = useToast();

  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [stagedFiles, setStagedFiles] = useState<File[] | null>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isPermissionPermanent, setIsPermissionPermanent] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);

  const handleSend = async () => {
    if (!text.trim() || isSending) return;
    const msgText = text.trim();
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsSending(true);

    try {
      await sendMessage(conversationId, msgText);
    } catch (_err) {
      // Offline queue preserves message
    } finally {
      setIsSending(false);
    }
  };

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
    setRecordSeconds(0);
  };

  const handleSendVoice = async () => {
    if (!recorderRef.current) return;
    setIsSending(true);
    try {
      const { audioBlob, durationSeconds, mimeType } = await recorderRef.current.stopRecording();
      setIsRecording(false);
      await sendVoiceMessage(conversationId, durationSeconds, audioBlob, mimeType);
    } catch (err: any) {
      showToast({ type: 'error', message: err?.message || 'Failed to send voice message' });
    } finally {
      setIsSending(false);
      setIsRecording(false);
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

      {/* Quoted Message Reply Banner */}
      {replyTarget && (
        <ReplyPreview
          replyTo={{
            ...resolveReplyReference(replyTarget)!,
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
          /* Live Voice Recording Controls */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: '0.75rem',
              minHeight: '44px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--veil-danger)',
                  boxShadow: '0 0 8px var(--veil-danger)',
                  animation: 'veilPulse 1.2s infinite',
                }}
              />
              <span style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
                Recording {formatTimer(recordSeconds)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelVoice}
                aria-label="Cancel Voice Recording"
              >
                <CloseIcon size={16} />
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
              aria-label="Record Voice Note"
              title="Record Voice Note"
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
              disabled={!text.trim() || isSending}
              aria-label="Send Message"
              title="Send Message"
            >
              {isSending ? <Spinner size="sm" aria-label="Sending..." /> : <SendIcon size={18} color="#ffffff" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
