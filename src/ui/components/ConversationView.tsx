/**
 * Modernized Conversation View Component for VEIL Phase 31.
 *
 * Renders active chat header with verification badges, E2EE message timeline,
 * encrypted attachment cards, voice note players, reply quote previews,
 * delivery receipts, and the MessageComposer.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useApp } from '../app/AppState.tsx';
import { MessageComposer } from './MessageComposer.tsx';
import { VoiceRecorder } from '../../attachments/voiceRecorder.ts';
import { AttachmentPipeline } from '../../attachments/attachmentPipeline.ts';
import type { AttachmentMetadata, EncryptedAttachmentChunk } from '../../attachments/types.ts';
import { base64ToBytes } from '../../crypto/utils.ts';
import type { UIMessage } from '../app/types.ts';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  StatusIndicator,
  EmptyState,
  AttachmentCard,
  VoiceNoteCard,
  MessageBubble,
} from './ui/index.ts';

export const ConversationView: React.FC = () => {
  const {
    conversations,
    activeChatId,
    messages,
    openModal,
    selectConversation,
    setReplyTarget,
    activeSession,
    cloudClient,
    ensureCloudSession,
  } = useApp();

  const timelineEndRef = useRef<HTMLDivElement>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null);

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
        <EmptyState
          icon="🛡️"
          title="No Conversation Selected"
          description="Choose a contact or group from the sidebar to view end-to-end encrypted messages."
        />
      </main>
    );
  }

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
        if (!cloudClient.getSessionToken()) {
          await ensureCloudSession(activeSession);
        }
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
      setDownloadingAttachmentId(msg.id);
      try {
        if (!cloudClient.getSessionToken()) {
          await ensureCloudSession(activeSession);
        }
        const rawCiphertext = await cloudClient.downloadAttachment(msg.attachment.objectId);
        let plaintextBytes: Uint8Array;

        if (msg.attachment.encryptionKeyBase64) {
          const encryptionKey = base64ToBytes(msg.attachment.encryptionKeyBase64);
          const chunks: EncryptedAttachmentChunk[] = JSON.parse(new TextDecoder().decode(rawCiphertext));
          const meta: AttachmentMetadata = {
            attachmentId: msg.attachment.attachmentId || msg.attachment.objectId,
            name: msg.attachment.name,
            mimeType: msg.attachment.mimeType,
            sizeBytes: msg.attachment.sizeBytes,
            chunkCount: msg.attachment.chunkCount || chunks.length,
            chunkSize: msg.attachment.chunkSize || (64 * 1024),
            sha256Hash: msg.attachment.sha256Hash || '',
          };
          plaintextBytes = AttachmentPipeline.decryptAndReassemble(meta, chunks, encryptionKey);
        } else {
          plaintextBytes = rawCiphertext;
        }

        const blob = new Blob([plaintextBytes], { type: msg.attachment.mimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = msg.attachment.name;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err: any) {
        alert(`Attachment download error: ${err.message || 'Failed to download file'}`);
      } finally {
        setDownloadingAttachmentId(null);
      }
    }
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'background-color 0.5s ease';
      el.style.backgroundColor = 'var(--veil-accent-primary-subtle)';
      setTimeout(() => {
        el.style.backgroundColor = '';
      }, 1500);
    }
  };

  return (
    <main className="veil-chat-main" role="main" aria-label={`Conversation with ${activeConv.name}`}>
      {/* Header */}
      <header className="veil-chat-header">
        <div className="veil-chat-peer-info">
          <IconButton
            icon="←"
            variant="secondary"
            className="veil-back-btn"
            onClick={() => selectConversation(null)}
            aria-label="Back to conversations"
            title="Back to conversations"
          />

          <Avatar
            name={activeConv.name}
            isGroup={activeConv.type === 'group'}
            size="md"
          />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--veil-text-sm)', color: 'var(--veil-text-primary)' }}>
                {activeConv.name}
              </span>
              {activeConv.isVerified && (
                <Badge variant="secure">
                  ✓ Verified Identity
                </Badge>
              )}
            </div>
            <StatusIndicator
              status="secure"
              label={activeConv.type === 'group' ? 'Encrypted Group Ratchet' : '🔒 Double Ratchet E2EE'}
            />
          </div>
        </div>

        <div>
          {activeConv.type === 'direct' ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openModal({ type: 'contactDetails', conversationId: activeConv.id })}
            >
              Verify Safety Number
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openModal({ type: 'groupDetails', conversationId: activeConv.id })}
            >
              Group Info
            </Button>
          )}
        </div>
      </header>

      {/* Message Timeline */}
      <div className="veil-chat-timeline" role="log" aria-live="polite" aria-label="Message Timeline">
        {activeMessages.length === 0 ? (
          <EmptyState
            icon="🔒"
            title="End-to-End Encrypted"
            description="Messages, attachments, and voice notes in this conversation are encrypted end-to-end. No third party or relay server can read or listen to them."
          />
        ) : (
          activeMessages.map((msg) => {
            const isVoice = Boolean(msg.voice);
            const isAttachment = Boolean(msg.attachment);

            const voiceElement = isVoice ? (
              <VoiceNoteCard
                durationSeconds={msg.voice!.durationSeconds}
                playbackState={playingAudioId === msg.id ? 'playing' : 'idle'}
                onPlayToggle={() => handlePlayVoice(msg)}
              />
            ) : undefined;

            const attachmentElement = isAttachment ? (
              <AttachmentCard
                name={msg.attachment!.name}
                sizeBytes={msg.attachment!.sizeBytes}
                mimeType={msg.attachment!.mimeType}
                status={downloadingAttachmentId === msg.id ? 'downloading' : 'ready'}
                onDownload={msg.attachment!.objectId ? () => handleDownloadAttachment(msg) : undefined}
              />
            ) : undefined;

            return (
              <MessageBubble
                key={msg.id}
                id={msg.id}
                isOutgoing={Boolean(msg.isOutgoing)}
                text={msg.text}
                timestamp={msg.timestamp}
                status={msg.status}
                replyTo={
                  msg.replyTo
                    ? {
                        messageId: msg.replyTo.messageId,
                        senderName: msg.replyTo.senderName,
                        text: msg.replyTo.text,
                        attachmentType: msg.replyTo.attachmentType,
                      }
                    : undefined
                }
                onReplyClick={scrollToMessage}
                onReplyTrigger={() => setReplyTarget(msg)}
                voiceElement={voiceElement}
                attachmentElement={attachmentElement}
              />
            );
          })
        )}
        <div ref={timelineEndRef} />
      </div>

      {/* Composer */}
      <MessageComposer conversationId={activeChatId} />
    </main>
  );
};
