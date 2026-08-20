/**
 * Main Conversation View Component for VEIL.
 *
 * Renders active chat header, E2EE message bubbles, encrypted attachment previews,
 * voice note playback, message reply quotes, delivery statuses, and the MessageComposer.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { MessageComposer } from './MessageComposer.tsx';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import type { UIMessage } from '../app/types.ts';

export const ConversationView: React.FC = () => {
  const { conversations, activeChatId, messages, openModal, selectConversation, setReplyTarget, activeSession, cloudClient } = useApp();
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});

  const activeConv = conversations.find((c) => c.id === activeChatId);
  const activeMessages = activeChatId
    ? messages[activeChatId] || (activeConv?.peerDoc?.identityId ? messages[activeConv.peerDoc.identityId] : []) || []
    : [];

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length]);

  if (!activeConv || !activeChatId) {
    return (
      <main className="veil-chat-main" role="main" aria-label="Conversation Main Area">
        <div className="veil-empty-state">
          <div className="veil-empty-icon" aria-hidden="true">🛡️</div>
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

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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

    // Stop any other currently playing audio
    if (playingAudioId && audioElementsRef.current[playingAudioId]) {
      audioElementsRef.current[playingAudioId].pause();
    }

    try {
      let audio = audioElementsRef.current[msg.id];
      if (!audio) {
        const audioUrl = await VoiceRecorder.downloadAndDecryptVoiceNote(activeSession, cloudClient, msg.voice as any);
        audio = new Audio(audioUrl);
        audioElementsRef.current[msg.id] = audio;
        audio.onended = () => setPlayingAudioId(null);
      }
      audio.play();
      setPlayingAudioId(msg.id);
    } catch (err: any) {
      alert(`Voice playback error: ${err.message || 'Failed to decrypt audio'}`);
    }
  };

  const handleDownloadAttachment = async (msg: UIMessage) => {
    if (!msg.attachment || !activeSession) return;
    if (msg.attachment.objectId) {
      try {
        const ciphertext = await cloudClient.downloadAttachment(msg.attachment.objectId);
        const blob = new Blob([ciphertext], { type: msg.attachment.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = msg.attachment.name;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err: any) {
        alert(`Attachment download error: ${err.message || 'Failed to download file'}`);
      }
    }
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background-color 0.5s ease';
      el.style.backgroundColor = 'rgba(99, 102, 241, 0.25)';
      setTimeout(() => {
        el.style.backgroundColor = '';
      }, 1500);
    }
  };

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
    <main className="veil-chat-main" role="main" aria-label={`Conversation with ${activeConv.name}`}>
      {/* Header */}
      <header className="veil-chat-header">
        <div className="veil-chat-peer-info">
          <button
            type="button"
            className="veil-btn veil-btn-secondary veil-back-btn"
            style={{ padding: '0.3rem 0.5rem' }}
            onClick={() => selectConversation(null)}
            aria-label="Back to sidebar"
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
            aria-hidden="true"
          >
            {activeConv.type === 'group' ? '👥' : activeConv.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
                {activeConv.name}
              </span>
              {activeConv.isVerified && (
                <span className="veil-badge veil-badge-secure" style={{ fontSize: '0.65rem' }}>
                  ✓ Verified Identity
                </span>
              )}
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
      <div className="veil-chat-timeline" role="log" aria-live="polite" aria-label="Message Timeline">
        {activeMessages.length === 0 ? (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--veil-text-muted)', fontSize: 'var(--veil-text-sm)' }}>
            🔒 Messages, attachments, and voice notes in this conversation are encrypted end-to-end.
            <div style={{ fontSize: 'var(--veil-text-xs)', marginTop: '0.25rem' }}>
              No third party or relay server can read or listen to them.
            </div>
          </div>
        ) : (
          activeMessages.map((msg) => (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`veil-message-row ${msg.isOutgoing ? 'outgoing' : 'incoming'}`}
              style={{ position: 'relative', margin: '0.25rem 0' }}
            >
              <div className="veil-message-bubble" style={{ maxWidth: '78%' }}>
                {/* Quoted Message Reference */}
                {msg.replyTo && (
                  <div
                    onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      marginBottom: '0.35rem',
                      background: 'rgba(0, 0, 0, 0.15)',
                      borderLeft: '3px solid var(--veil-accent-primary)',
                      borderRadius: 'var(--veil-radius-sm)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                    title="Jump to original message"
                  >
                    <div style={{ fontWeight: 600, color: 'var(--veil-accent-primary)' }}>
                      {msg.replyTo.senderName || 'Peer'}
                    </div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.85 }}>
                      {msg.replyTo.attachmentType === 'voice'
                        ? '🎙️ Voice note'
                        : msg.replyTo.attachmentType === 'file'
                        ? '📎 File attachment'
                        : msg.replyTo.text}
                    </div>
                  </div>
                )}

                {/* Voice Note Player */}
                {msg.voice ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.2rem 0' }}>
                    <button
                      type="button"
                      className="veil-btn veil-btn-primary"
                      style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, fontSize: '0.9rem' }}
                      onClick={() => handlePlayVoice(msg)}
                      title={playingAudioId === msg.id ? 'Pause Voice Note' : 'Play Voice Note'}
                      aria-label="Play or pause voice note"
                    >
                      {playingAudioId === msg.id ? '⏸' : '▶'}
                    </button>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-xs)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>🎙️ Voice Note</span>
                        <span style={{ opacity: 0.75 }}>({formatDuration(msg.voice.durationSeconds)})</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        {playingAudioId === msg.id ? 'Playing...' : 'End-to-End Encrypted'}
                      </div>
                    </div>
                  </div>
                ) : msg.attachment ? (
                  /* Encrypted File Attachment */
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.25rem 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ fontSize: '1.5rem' }}>📄</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--veil-text-xs)' }}>{msg.attachment.name}</div>
                        <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>{formatSize(msg.attachment.sizeBytes)} • Encrypted</div>
                      </div>
                    </div>
                    {msg.attachment.objectId && (
                      <button
                        type="button"
                        className="veil-btn veil-btn-secondary"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => handleDownloadAttachment(msg)}
                        title="Download Attachment"
                      >
                        ⬇
                      </button>
                    )}
                  </div>
                ) : (
                  /* Plain Text Message */
                  <div>{msg.text}</div>
                )}

                <div className="veil-message-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      opacity: 0.6,
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onClick={() => setReplyTarget(msg)}
                    title="Reply to message"
                  >
                    ↩ Reply
                  </button>
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
