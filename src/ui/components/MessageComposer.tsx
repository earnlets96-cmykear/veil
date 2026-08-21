/**
 * Modernized Message Composer Component for VEIL Phase 31.
 *
 * Implements Enter to send, Shift+Enter for multiline, encrypted file attachment picking,
 * live voice note recording & sending, and message reply quote banners using
 * VEIL reusable component primitives.
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import { useApp } from '../app/AppState.tsx';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import { Button, IconButton, ReplyPreview } from './ui/index.ts';

export const MessageComposer: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { sendMessage, sendAttachment, sendVoiceMessage, replyTarget, setReplyTarget } = useApp();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);

  const handleSend = async () => {
    if (!text.trim() || isSending) return;
    const msgText = text;
    setText('');
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    try {
      await sendAttachment(conversationId, file);
    } catch (_e) {}
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Voice recording controls
  const handleStartVoice = async () => {
    try {
      const rec = new VoiceRecorder();
      recorderRef.current = rec;
      setRecordSeconds(0);
      setIsRecording(true);
      await rec.startRecording((seconds) => setRecordSeconds(seconds));
    } catch (err: any) {
      alert(`Microphone error: ${err.message || 'Permission denied or unsupported'}`);
      setIsRecording(false);
    }
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
      alert(`Voice message error: ${err.message || 'Failed to send'}`);
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
      {/* Quoted Message Reply Banner */}
      {replyTarget && (
        <ReplyPreview
          replyTo={{
            messageId: replyTarget.id,
            senderName: replyTarget.senderName || (replyTarget.isOutgoing ? 'yourself' : 'Peer'),
            text: replyTarget.text,
            attachmentType: replyTarget.voice ? 'voice' : replyTarget.attachment ? 'file' : undefined,
          }}
          onDismiss={() => setReplyTarget(null)}
        />
      )}

      {/* Composer Input Row */}
      <div className="veil-composer" role="region" aria-label="Message Composer">
        <input
          type="file"
          ref={fileInputRef}
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
              padding: '0 0.5rem',
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
                disabled={isSending}
              >
                ✕ Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendVoice}
                isLoading={isSending}
              >
                ✔ Send Voice
              </Button>
            </div>
          </div>
        ) : (
          /* Standard Message & Attachment Controls */
          <>
            <IconButton
              icon="📎"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach Encrypted File"
              title="Attach Encrypted File"
            />

            <IconButton
              icon="🎙️"
              variant="secondary"
              onClick={handleStartVoice}
              aria-label="Record Voice Note"
              title="Record Voice Note"
            />

            <textarea
              className="veil-composer-input"
              placeholder="Type an encrypted message... (Enter to send, Shift+Enter for newline)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Message Input Field"
            />

            <Button
              variant="primary"
              size="md"
              onClick={handleSend}
              disabled={!text.trim() || isSending}
              isLoading={isSending}
              aria-label="Send Message"
            >
              Send ➤
            </Button>
          </>
        )}
      </div>
    </div>
  );
};
