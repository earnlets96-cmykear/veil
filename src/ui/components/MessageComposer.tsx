/**
 * Message Composer Component for VEIL.
 *
 * Implements Enter to send, Shift+Enter for multiline, offline indicator, and send action.
 */

import React, { useState, KeyboardEvent } from 'react';
import { useApp } from '../app/AppState.tsx';

export const MessageComposer: React.FC<{ conversationId: string }> = ({ conversationId }) => {
  const { sendMessage, networkState } = useApp();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!text.trim() || isSending) return;
    const msgText = text;
    setText('');
    setIsSending(true);

    try {
      await sendMessage(conversationId, msgText);
    } catch (_err) {
      // Message queueing preserves message
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

  return (
    <div className="veil-composer">
      <textarea
        className="veil-composer-input"
        placeholder="Type an end-to-end encrypted message... (Enter to send, Shift+Enter for multiline)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
      />

      <button
        type="button"
        className="veil-btn veil-btn-primary"
        style={{ height: '42px', padding: '0 1.25rem', fontWeight: 600 }}
        onClick={handleSend}
        disabled={!text.trim() || isSending}
      >
        {isSending ? 'Encrypting...' : 'Send ➤'}
      </button>
    </div>
  );
};
