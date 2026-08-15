/**
 * Message Composer Component for VEIL Phase 15.
 *
 * Implements Enter to send, Shift+Enter for multiline, encrypted file attachment picking,
 * and keyboard accessibility.
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import { useApp } from '../app/AppState.tsx';

export const MessageComposer: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { sendMessage, sendAttachment } = useApp();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="veil-composer" role="region" aria-label="Message Composer">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />

      <button
        type="button"
        className="veil-btn veil-btn-secondary"
        style={{ height: '42px', padding: '0 0.85rem', fontSize: '1.1rem' }}
        onClick={() => fileInputRef.current?.click()}
        title="Attach Encrypted File"
        aria-label="Attach Encrypted File"
      >
        📎
      </button>

      <textarea
        className="veil-composer-input"
        placeholder="Type an end-to-end encrypted message... (Enter to send, Shift+Enter for newline)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
        aria-label="Message Input Field"
      />

      <button
        type="button"
        className="veil-btn veil-btn-primary"
        style={{ height: '42px', padding: '0 1.25rem', fontWeight: 600 }}
        onClick={handleSend}
        disabled={!text.trim() || isSending}
        aria-label="Send Message"
      >
        {isSending ? 'Encrypting...' : 'Send ➤'}
      </button>
    </div>
  );
};
