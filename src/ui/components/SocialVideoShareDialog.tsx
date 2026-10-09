import React, { useState } from 'react';
import { SocialVideoLink } from '../../media/socialVideoLinks.ts';
import { UIConversation } from '../app/types.ts';

interface SocialVideoShareDialogProps {
  link: SocialVideoLink;
  conversations: UIConversation[];
  onSend: (conversationId: string, url: string) => Promise<void>;
  onClose: () => void;
}

export const SocialVideoShareDialog: React.FC<SocialVideoShareDialogProps> = ({
  link,
  conversations,
  onSend,
  onClose,
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const providerName = link.provider === 'tiktok' ? 'TikTok' : 'Instagram';

  const handleSend = async () => {
    if (!selectedConversationId || isSending) return;
    setIsSending(true);
    setSendFailed(false);
    try {
      await onSend(selectedConversationId, link.canonicalUrl);
      onClose();
    } catch {
      setSendFailed(true);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="veil-modal-overlay veil-social-share-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="veil-social-share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="veil-social-share-title"
      >
        <header className="veil-social-share-header">
          <div>
            <h2 id="veil-social-share-title">Share video</h2>
            <p>Choose who receives this {providerName} link.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close share dialog">Close</button>
        </header>

        <div className="veil-social-share-link" aria-label="Video link">
          <span>{providerName} video</span>
          <code>{link.canonicalUrl}</code>
        </div>

        {conversations.length > 0 ? (
          <div className="veil-social-share-list" role="radiogroup" aria-label="Select a conversation">
            {conversations.map((conversation) => {
              const selected = selectedConversationId === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className={selected ? 'veil-social-share-recipient selected' : 'veil-social-share-recipient'}
                  onClick={() => setSelectedConversationId(conversation.id)}
                >
                  <span className="veil-social-share-recipient-name">{conversation.name}</span>
                  <span className="veil-social-share-recipient-type">{conversation.type === 'group' ? 'Group' : 'Direct chat'}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="veil-social-share-empty">You need a chat before sharing this video.</p>
        )}

        {sendFailed && <p className="veil-social-share-error" role="alert">Could not send the video link. Try again.</p>}

        <footer className="veil-social-share-footer">
          <button type="button" className="veil-social-share-cancel" onClick={onClose}>Cancel</button>
          {conversations.length > 0 && (
            <button
              type="button"
              className="veil-social-share-send"
              onClick={handleSend}
              disabled={!selectedConversationId || isSending}
            >
              {isSending ? 'Sending…' : 'Send video'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
};
