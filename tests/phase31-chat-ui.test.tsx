/**
 * Phase 31 Step 4: Main Chat UI Modernization Test Suite
 *
 * Tests the modernized chat experience across Sidebar, ConversationView,
 * MessageComposer, and chat primitives.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Avatar,
  Badge,
  Button,
  IconButton,
  SearchInput,
  StatusIndicator,
  EmptyState,
  AttachmentCard,
  VoiceNoteCard,
  MessageBubble,
  ReplyPreview,
  MessageStatus,
  MessageTimestamp,
} from '../src/ui/components/ui/index.ts';

describe('Phase 31: Main Chat UI Modernization Tests', () => {
  describe('Chat Header & Peer Identity Primitives', () => {
    it('renders peer Avatar with identity verification badge and status indicator', () => {
      const html = renderToStaticMarkup(
        <header className="veil-chat-header">
          <div className="veil-chat-peer-info">
            <IconButton icon="←" aria-label="Back to conversations" />
            <Avatar name="Alice" size="md" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="veil-conversation-name">Alice</span>
                <Badge variant="secure">✓ Verified Identity</Badge>
              </div>
              <StatusIndicator status="secure" label="🔒 Double Ratchet E2EE" />
            </div>
          </div>
          <Button variant="secondary" size="sm">Verify Safety Number</Button>
        </header>
      );

      expect(html).toContain('Alice');
      expect(html).toContain('✓ Verified Identity');
      expect(html).toContain('🔒 Double Ratchet E2EE');
      expect(html).toContain('Verify Safety Number');
      expect(html).toContain('aria-label="Back to conversations"');
    });

    it('renders Group chat header with group icon and group info action', () => {
      const html = renderToStaticMarkup(
        <header className="veil-chat-header">
          <div className="veil-chat-peer-info">
            <Avatar name="Core Team" isGroup size="md" />
            <div>
              <span className="veil-conversation-name">Core Team</span>
              <StatusIndicator status="secure" label="Encrypted Group Ratchet" />
            </div>
          </div>
          <Button variant="secondary" size="sm">Group Info</Button>
        </header>
      );

      expect(html).toContain('Core Team');
      expect(html).toContain('veil-avatar-square');
      expect(html).toContain('Encrypted Group Ratchet');
      expect(html).toContain('Group Info');
    });
  });

  describe('Message Timeline & Primitives', () => {
    it('renders plain text incoming and outgoing MessageBubbles with timestamps and status', () => {
      const incomingHtml = renderToStaticMarkup(
        <MessageBubble
          id="msg_inc_1"
          isOutgoing={false}
          text="Hey! Are you online in VEIL?"
          timestamp={1700000000000}
        />
      );
      expect(incomingHtml).toContain('veil-message-row incoming');
      expect(incomingHtml).toContain('Hey! Are you online in VEIL?');

      const outgoingHtml = renderToStaticMarkup(
        <MessageBubble
          id="msg_out_1"
          isOutgoing={true}
          text="Yes, fully encrypted via Double Ratchet."
          timestamp={1700000005000}
          status="DELIVERED_TO_RECIPIENT"
        />
      );
      expect(outgoingHtml).toContain('veil-message-row outgoing');
      expect(outgoingHtml).toContain('Yes, fully encrypted via Double Ratchet.');
      expect(outgoingHtml).toContain('Delivered &amp; Read');
    });

    it('renders MessageBubble with nested ReplyPreview quote', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_reply_1"
          isOutgoing={true}
          text="Acknowledged! Let's proceed."
          timestamp={1700000010000}
          replyTo={{
            messageId: 'msg_orig_1',
            senderName: 'Bob',
            text: 'Please review the security spec.',
          }}
        />
      );
      expect(html).toContain('Replying to Bob');
      expect(html).toContain('Please review the security spec.');
      expect(html).toContain('Acknowledged! Let&#x27;s proceed.');
    });

    it('renders MessageBubble with encrypted AttachmentCard preview and download action', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_att_1"
          isOutgoing={false}
          timestamp={1700000020000}
          attachmentElement={
            <AttachmentCard
              name="audit_report.pdf"
              sizeBytes={1024 * 250}
              mimeType="application/pdf"
              status="ready"
              onDownload={() => {}}
            />
          }
        />
      );
      expect(html).toContain('audit_report.pdf');
      expect(html).toContain('250.0 KB');
      expect(html).toContain('Encrypted File');
      expect(html).toContain('veil-attachment-icon-wrapper');
    });

    it('renders MessageBubble with VoiceNoteCard audio player', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_voice_1"
          isOutgoing={true}
          timestamp={1700000030000}
          voiceElement={
            <VoiceNoteCard
              durationSeconds={65}
              playbackState="idle"
              onPlayToggle={() => {}}
            />
          }
        />
      );
      expect(html).toContain('1:05');
      expect(html).toContain('veil-waveform-container');
      expect(html).toContain('veil-voicenote-play-btn');
    });
  });

  describe('Message Composer UI', () => {
    it('renders Composer with attach file, voice record, input, and send button', () => {
      const html = renderToStaticMarkup(
        <div className="veil-composer" role="region" aria-label="Message Composer">
          <IconButton icon="📎" aria-label="Attach Encrypted File" />
          <IconButton icon="🎙️" aria-label="Record Voice Note" />
          <textarea
            className="veil-composer-input"
            placeholder="Type an encrypted message..."
            readOnly
          />
          <Button variant="primary" size="md">Send ➤</Button>
        </div>
      );
      expect(html).toContain('aria-label="Attach Encrypted File"');
      expect(html).toContain('aria-label="Record Voice Note"');
      expect(html).toContain('placeholder="Type an encrypted message..."');
      expect(html).toContain('Send ➤');
    });

    it('renders ReplyPreview in Composer when replying to a message', () => {
      const html = renderToStaticMarkup(
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <ReplyPreview
            replyTo={{
              messageId: 'msg_target',
              senderName: 'Charlie',
              text: 'Can you send the public key?',
            }}
            onDismiss={() => {}}
          />
          <div className="veil-composer">
            <textarea className="veil-composer-input" readOnly />
            <Button variant="primary">Send ➤</Button>
          </div>
        </div>
      );
      expect(html).toContain('Charlie');
      expect(html).toContain('Can you send the public key?');
      expect(html).toContain('Cancel reply quote');
    });
  });

  describe('Empty & Loading States', () => {
    it('renders EmptyState when no conversation is selected', () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon="🛡️"
          title="No Conversation Selected"
          description="Choose a contact or group from the sidebar to view end-to-end encrypted messages."
        />
      );
      expect(html).toContain('No Conversation Selected');
      expect(html).toContain('🛡️');
    });

    it('renders EmptyState when conversation timeline is empty', () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon="🔒"
          title="End-to-End Encrypted"
          description="Messages, attachments, and voice notes in this conversation are encrypted end-to-end."
        />
      );
      expect(html).toContain('End-to-End Encrypted');
      expect(html).toContain('🔒');
    });
  });
});
