/**
 * Main Conversation View Component for VEIL.
 *
 * Renders active chat header, E2EE message bubbles, delivery statuses,
 * and the MessageComposer.
 */

import React, { useRef, useEffect } from 'react';
import { useApp } from '../app/AppState.tsx';
import { MessageComposer } from './MessageComposer.tsx';

export const ConversationView: React.FC = () => {
  const { conversations, activeChatId, messages, openModal, selectConversation } = useApp();
  const timelineEndRef = useRef<HTMLDivElement>(null);

  const activeConv = conversations.find((c) => c.id === activeChatId);
  const activeMessages = activeChatId ? messages[activeChatId] || [] : [];

  // Auto-scroll to bottom on new message
  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  if (!activeConv || !activeChatId) {
    return (
      <main className="veil-chat-main">
        <div className="veil-empty-state">
          <div className="veil-empty-icon">🛡️</div>
          <h2 style={{ fontSize: 'var(--veil-text-lg)', fontWeight: 600, marginBottom: '0.5rem' }}>
            No Conversation Selected
          </h2>
          <p style={{ fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-secondary)' }}>
            Choose a contact or group from the sidebar to view end-to-end encrypted messages.
          </p>
        </div>
      </main>
    );
  }

  const renderStatus = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return <span title="Queued locally (Offline)">⏳</span>;
      case 'SENDING':
        return <span title="Encrypting & Sending">🔄</span>;
      case 'SENT_TO_RELAY':
        return <span title="Delivered to Relay">✓</span>;
      case 'DELIVERED_TO_RECIPIENT':
      case 'PROCESSED':
        return <span title="Delivered & Decrypted by Peer" style={{ color: 'var(--veil-success)' }}>✓✓</span>;
      case 'FAILED':
        return <span title="Failed to deliver" style={{ color: 'var(--veil-danger)' }}>⚠️</span>;
      default:
        return <span>✓</span>;
    }
  };

  return (
    <main className="veil-chat-main">
      {/* Header */}
      <header className="veil-chat-header">
        <div className="veil-chat-peer-info">
          <button
            type="button"
            className="veil-btn veil-btn-secondary"
            style={{ padding: '0.3rem 0.5rem', display: 'none' }} // Visible on mobile
            onClick={() => selectConversation(null)}
          >
            ← Back
          </button>

          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: activeConv.type === 'group' ? 'var(--veil-radius-md)' : '50%',
              background:
                activeConv.type === 'group'
                  ? 'linear-gradient(135deg, #0ea5e9, #6366f1)'
                  : 'linear-gradient(135deg, #a855f7, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: '#ffffff',
            }}
          >
            {activeConv.type === 'group' ? '👥' : activeConv.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
              {activeConv.name}
            </div>
            <div style={{ fontSize: 'var(--veil-text-xs)', color: 'var(--veil-text-muted)' }}>
              {activeConv.type === 'group' ? 'Encrypted Group Ratchet' : '🔒 Double Ratchet E2EE'}
            </div>
          </div>
        </div>

        <div>
          {activeConv.type === 'direct' ? (
            <button
              type="button"
              className="veil-btn veil-btn-secondary"
              style={{ fontSize: 'var(--veil-text-xs)' }}
              onClick={() => openModal({ type: 'contactDetails', conversationId: activeConv.id })}
            >
              Verify Safety Number
            </button>
          ) : (
            <button
              type="button"
              className="veil-btn veil-btn-secondary"
              style={{ fontSize: 'var(--veil-text-xs)' }}
              onClick={() => openModal({ type: 'groupDetails', conversationId: activeConv.id })}
            >
              Group Info
            </button>
          )}
        </div>
      </header>

      {/* Message Timeline */}
      <div className="veil-chat-timeline">
        {activeMessages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--veil-text-muted)', fontSize: 'var(--veil-text-sm)' }}>
            🔒 Messages sent in this conversation are encrypted end-to-end.
            <div style={{ fontSize: 'var(--veil-text-xs)', marginTop: '0.25rem' }}>
              No third party or relay server can read them.
            </div>
          </div>
        ) : (
          activeMessages.map((msg) => (
            <div key={msg.id} className={`veil-message-row ${msg.isOutgoing ? 'outgoing' : 'incoming'}`}>
              <div className="veil-message-bubble">
                <div>{msg.text}</div>
                <div className="veil-message-meta">
                  <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.isOutgoing && <span>{renderStatus(msg.status)}</span>}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={timelineEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer conversationId={activeChatId} />
    </main>
  );
};
