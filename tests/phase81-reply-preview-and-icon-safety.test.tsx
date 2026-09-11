/**
 * Phase 81: ReplyPreview & Icon Component Safety Test Suite.
 *
 * Verifies:
 * - ReplyPreview component renders without runtime or reference errors across all payload types.
 * - ReplyIcon is properly imported, defined, and instantiated.
 * - All exported icons in src/ui/components/icons can be rendered to static markup without undefined errors.
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReplyPreview } from '../src/ui/components/ui/ReplyPreview.tsx';
import * as Icons from '../src/ui/components/icons/index.ts';

describe('Phase 81: ReplyPreview & Icon Component Safety', () => {
  describe('ReplyPreview Rendering Stability', () => {
    it('1. Renders text reply quote with ReplyIcon and sender name', () => {
      const html = renderToStaticMarkup(
        <ReplyPreview
          replyTo={{
            messageId: 'msg-101',
            senderName: 'Alice',
            text: 'Hello world from encrypted channel',
          }}
          onDismiss={vi.fn()}
        />
      );

      expect(html).toContain('Replying to Alice');
      expect(html).toContain('Hello world from encrypted channel');
      expect(html).toContain('veil-icon');
      expect(html).toContain('Cancel reply quote');
    });

    it('2. Renders self-reply quote properly ("Replying to You")', () => {
      const html = renderToStaticMarkup(
        <ReplyPreview
          replyTo={{
            messageId: 'msg-102',
            senderName: 'Yourself',
            isSelfReply: true,
            text: 'My own message',
          }}
        />
      );

      expect(html).toContain('Replying to You');
      expect(html).toContain('My own message');
    });

    it('3. Renders voice note reply snippet with MicIcon', () => {
      const html = renderToStaticMarkup(
        <ReplyPreview
          replyTo={{
            messageId: 'msg-103',
            senderName: 'Bob',
            attachmentType: 'voice',
          }}
        />
      );

      expect(html).toContain('Replying to Bob');
      expect(html).toContain('Voice note');
    });

    it('4. Renders photo reply snippet with ImageIcon', () => {
      const html = renderToStaticMarkup(
        <ReplyPreview
          replyTo={{
            messageId: 'msg-104',
            senderName: 'Charlie',
            attachmentType: 'image',
            thumbnailUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          }}
        />
      );

      expect(html).toContain('Replying to Charlie');
      expect(html).toContain('Photo');
      expect(html).toContain('<img');
    });

    it('5. Renders video reply snippet with VideoIcon', () => {
      const html = renderToStaticMarkup(
        <ReplyPreview
          replyTo={{
            messageId: 'msg-105',
            senderName: 'Dave',
            attachmentType: 'video',
          }}
        />
      );

      expect(html).toContain('Replying to Dave');
      expect(html).toContain('Video');
    });

    it('6. Renders document/file reply snippet with PaperclipIcon', () => {
      const html = renderToStaticMarkup(
        <ReplyPreview
          replyTo={{
            messageId: 'msg-106',
            senderName: 'Eve',
            attachmentType: 'file',
          }}
        />
      );

      expect(html).toContain('Replying to Eve');
      expect(html).toContain('File attachment');
    });
  });

  describe('Icon Library Integrity & Safety', () => {
    it('7. ReplyIcon is explicitly defined and produces valid SVG markup', () => {
      expect(Icons.ReplyIcon).toBeDefined();
      expect(typeof Icons.ReplyIcon).toBe('function');

      const html = renderToStaticMarkup(<Icons.ReplyIcon size={16} />);
      expect(html).toContain('<svg');
      expect(html).toContain('width="16"');
      expect(html).toContain('height="16"');
    });

    it('8. Every exported icon in Icons/index.ts is defined and renderable', () => {
      const entries = Object.entries(Icons);
      expect(entries.length).toBeGreaterThan(20);

      for (const [name, Component] of entries) {
        expect(Component, `Icon ${name} must be defined`).toBeDefined();
        if (typeof Component === 'function') {
          const markup = renderToStaticMarkup(React.createElement(Component, { size: 18 }));
          expect(markup, `Icon ${name} must produce non-empty svg`).toContain('<svg');
        }
      }
    });
  });
});
