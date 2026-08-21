/**
 * Phase 31 Step 3: Reusable UI Component System Test Suite
 *
 * Verifies rendering, accessibility semantics, token class mapping,
 * interaction states, and privacy preservation across all reusable components.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Button,
  IconButton,
  Input,
  PasswordInput,
  SearchInput,
  Card,
  GlassCard,
  Badge,
  StatusIndicator,
  Avatar,
  Modal,
  Toast,
  Spinner,
  Skeleton,
  EmptyState,
  Progress,
  Divider,
  AttachmentCard,
  VoiceNoteCard,
  MessageBubble,
  ReplyPreview,
  MessageStatus,
  MessageTimestamp,
} from '../src/ui/components/ui/index.ts';

describe('Phase 31: Reusable UI Component Layer Tests', () => {
  describe('Button & IconButton Components', () => {
    it('renders Button with primary variant and children', () => {
      const html = renderToStaticMarkup(<Button variant="primary">Unlock Space</Button>);
      expect(html).toContain('veil-btn-primary');
      expect(html).toContain('Unlock Space');
      expect(html).toContain('type="button"');
    });

    it('renders Button with loading state and spinner', () => {
      const html = renderToStaticMarkup(<Button isLoading>Sending</Button>);
      expect(html).toContain('disabled=""');
      expect(html).toContain('veil-spinner');
      expect(html).toContain('aria-busy="true"');
    });

    it('renders Button with panic variant for emergency wipe', () => {
      const html = renderToStaticMarkup(<Button variant="panic">Emergency Wipe</Button>);
      expect(html).toContain('veil-btn-panic');
      expect(html).toContain('Emergency Wipe');
    });

    it('renders IconButton with mandatory aria-label and accessible title', () => {
      const html = renderToStaticMarkup(
        <IconButton icon="🔒" aria-label="Lock Active Space" />
      );
      expect(html).toContain('aria-label="Lock Active Space"');
      expect(html).toContain('title="Lock Active Space"');
      expect(html).toContain('veil-icon-btn');
    });
  });

  describe('Form Input Components', () => {
    it('renders Input with accessible label and helper text', () => {
      const html = renderToStaticMarkup(
        <Input label="Space Name" helperText="Used locally to identify this partition" />
      );
      expect(html).toContain('Space Name');
      expect(html).toContain('Used locally to identify this partition');
      expect(html).toContain('veil-input');
    });

    it('renders Input with inline error validation message and aria-invalid', () => {
      const html = renderToStaticMarkup(
        <Input label="Username" errorText="Username is already taken" />
      );
      expect(html).toContain('aria-invalid="true"');
      expect(html).toContain('veil-input-error');
      expect(html).toContain('Username is already taken');
      expect(html).toContain('role="alert"');
    });

    it('renders PasswordInput with privacy masking and toggle button', () => {
      const html = renderToStaticMarkup(
        <PasswordInput label="Passphrase" />
      );
      expect(html).toContain('type="password"');
      expect(html).toContain('aria-label="Show passphrase"');
    });

    it('renders SearchInput with search icon', () => {
      const html = renderToStaticMarkup(
        <SearchInput value="alice" onChange={() => {}} />
      );
      expect(html).toContain('type="search"');
      expect(html).toContain('🔍');
    });
  });

  describe('Surfaces, Badges & Avatars', () => {
    it('renders Card with interactive and elevated variants', () => {
      const html = renderToStaticMarkup(
        <Card variant="elevated" interactive>
          <h3>Space Item</h3>
        </Card>
      );
      expect(html).toContain('veil-card-elevated');
      expect(html).toContain('veil-card-interactive');
      expect(html).toContain('role="button"');
    });

    it('renders GlassCard with backdrop blur container', () => {
      const html = renderToStaticMarkup(
        <GlassCard>
          <div>Glass Content</div>
        </GlassCard>
      );
      expect(html).toContain('veil-card-glass');
    });

    it('renders Badge with secure, warning, and danger variants', () => {
      const secureHtml = renderToStaticMarkup(<Badge variant="secure">Verified</Badge>);
      expect(secureHtml).toContain('veil-badge-secure');
      expect(secureHtml).toContain('Verified');

      const dangerHtml = renderToStaticMarkup(<Badge variant="danger">Blocked</Badge>);
      expect(dangerHtml).toContain('veil-badge-danger');
    });

    it('renders StatusIndicator communicating state textually without relying solely on color', () => {
      const html = renderToStaticMarkup(<StatusIndicator status="online" />);
      expect(html).toContain('Encrypted &amp; Online');
    });

    it('renders Avatar with deterministic fallback and presence badge', () => {
      const html = renderToStaticMarkup(
        <Avatar name="Alice" size="lg" status="online" />
      );
      expect(html).toContain('veil-avatar-lg');
      expect(html).toContain('A');
      expect(html).toContain('veil-avatar-status-online');
      expect(html).toContain('role="img"');
    });
  });

  describe('Modal & Dialog System', () => {
    it('renders Modal when isOpen=true with dialog semantics', () => {
      const html = renderToStaticMarkup(
        <Modal isOpen={true} onClose={() => {}} title="Create Space">
          <p>Modal content</p>
        </Modal>
      );
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('Create Space');
      expect(html).toContain('Modal content');
    });

    it('does not render Modal when isOpen=false', () => {
      const html = renderToStaticMarkup(
        <Modal isOpen={false} onClose={() => {}} title="Hidden Dialog">
          <p>Hidden</p>
        </Modal>
      );
      expect(html).toBe('');
    });
  });

  describe('Toast Notification System', () => {
    it('renders Toast with type, icon, and accessible status role', () => {
      const html = renderToStaticMarkup(
        <Toast
          toast={{ id: 't1', type: 'success', title: 'Space Created', message: 'Ready for encrypted messaging' }}
          onDismiss={() => {}}
        />
      );
      expect(html).toContain('veil-toast-success');
      expect(html).toContain('Space Created');
      expect(html).toContain('Ready for encrypted messaging');
      expect(html).toContain('role="status"');
    });
  });

  describe('Feedback & Utility Primitives', () => {
    it('renders Spinner with aria-busy for screen readers', () => {
      const html = renderToStaticMarkup(<Spinner size="md" />);
      expect(html).toContain('veil-spinner-md');
      expect(html).toContain('aria-busy="true"');
    });

    it('renders Skeleton placeholder', () => {
      const html = renderToStaticMarkup(<Skeleton width="200px" height="24px" />);
      expect(html).toContain('veil-skeleton');
      expect(html).toContain('aria-hidden="true"');
    });

    it('renders EmptyState with icon, title, and action', () => {
      const html = renderToStaticMarkup(
        <EmptyState
          icon="💬"
          title="No Messages"
          description="Start an end-to-end encrypted conversation."
          action={<Button>+ New Chat</Button>}
        />
      );
      expect(html).toContain('No Messages');
      expect(html).toContain('Start an end-to-end encrypted conversation.');
      expect(html).toContain('+ New Chat');
    });

    it('renders Progress with aria progress semantics', () => {
      const html = renderToStaticMarkup(<Progress value={45} max={100} />);
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('aria-valuenow="45"');
    });

    it('renders Divider with horizontal and vertical separators', () => {
      const hHtml = renderToStaticMarkup(<Divider label="OR" />);
      expect(hHtml).toContain('role="separator"');
      expect(hHtml).toContain('OR');

      const vHtml = renderToStaticMarkup(<Divider orientation="vertical" />);
      expect(vHtml).toContain('veil-divider-vertical');
    });
  });

  describe('Media & Messaging UI Primitives', () => {
    it('renders AttachmentCard with encrypted metadata display and download action', () => {
      const html = renderToStaticMarkup(
        <AttachmentCard
          name="secret_plan.pdf"
          sizeBytes={1024 * 500}
          mimeType="application/pdf"
          status="ready"
          onDownload={() => {}}
        />
      );
      expect(html).toContain('secret_plan.pdf');
      expect(html).toContain('500.0 KB');
      expect(html).toContain('End-to-End Encrypted');
      expect(html).toContain('📕');
    });

    it('renders VoiceNoteCard with duration and waveform container', () => {
      const html = renderToStaticMarkup(
        <VoiceNoteCard durationSeconds={45} playbackState="idle" />
      );
      expect(html).toContain('0:45');
      expect(html).toContain('veil-waveform-container');
      expect(html).toContain('veil-voicenote-play-btn');
    });

    it('renders MessageBubble with reply quotes, text, and timestamp', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_test_1"
          isOutgoing={true}
          text="Hello from E2EE space!"
          timestamp={1700000000000}
          status="DELIVERED_TO_RECIPIENT"
          replyTo={{ messageId: 'msg_0', senderName: 'Alice', text: 'Original message' }}
        />
      );
      expect(html).toContain('veil-message-row outgoing');
      expect(html).toContain('Hello from E2EE space!');
      expect(html).toContain('Alice');
      expect(html).toContain('Original message');
      expect(html).toContain('✓✓');
    });

    it('renders ReplyPreview with snippet and dismiss button', () => {
      const html = renderToStaticMarkup(
        <ReplyPreview
          replyTo={{ messageId: 'm1', senderName: 'Bob', text: 'Meeting at 3pm' }}
          onDismiss={() => {}}
        />
      );
      expect(html).toContain('Bob');
      expect(html).toContain('Meeting at 3pm');
      expect(html).toContain('Cancel reply quote');
    });

    it('renders MessageStatus with correct receipts', () => {
      const queuedHtml = renderToStaticMarkup(<MessageStatus status="QUEUED" />);
      expect(queuedHtml).toContain('⏳');

      const deliveredHtml = renderToStaticMarkup(<MessageStatus status="DELIVERED_TO_RECIPIENT" />);
      expect(deliveredHtml).toContain('✓✓');

      const failedHtml = renderToStaticMarkup(<MessageStatus status="FAILED" />);
      expect(failedHtml).toContain('⚠️');
    });

    it('renders MessageTimestamp with formatted time and iso datetime', () => {
      const html = renderToStaticMarkup(<MessageTimestamp timestamp={new Date(1700000000000)} />);
      expect(html).toContain('dateTime=');
    });
  });
});
