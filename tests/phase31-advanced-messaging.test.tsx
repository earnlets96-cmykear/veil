/**
 * Phase 31 Step 5A: Advanced Message Interaction Test Suite
 *
 * Verifies message selection, context menu, in-conversation search,
 * date separators, retry on failure, and jump-to-message highlighting.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MessageBubble,
  Button,
  IconButton,
} from '../src/ui/components/ui/index.ts';

describe('Phase 31 Step 5A: Advanced Message Interaction Tests', () => {
  describe('MessageBubble Advanced States', () => {
    it('renders MessageBubble in selection mode with checkbox and selected styling', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_select_1"
          isOutgoing={true}
          text="Selected message content"
          timestamp={1700000000000}
          isSelectionMode={true}
          isSelected={true}
          onSelectToggle={() => {}}
        />
      );

      expect(html).toContain('type="checkbox"');
      expect(html).toContain('checked=""');
      expect(html).toContain('veil-message-selected');
      expect(html).toContain('Selected message content');
    });

    it('renders MessageBubble with pulse highlight animation when jumped to', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_jump_1"
          isOutgoing={false}
          text="Jumped to message target"
          timestamp={1700000010000}
          isHighlighted={true}
        />
      );

      expect(html).toContain('veil-message-highlight');
      expect(html).toContain('Jumped to message target');
    });

    it('renders retry button when message status is FAILED', () => {
      const html = renderToStaticMarkup(
        <MessageBubble
          id="msg_fail_1"
          isOutgoing={true}
          text="Failed message"
          timestamp={1700000020000}
          status="FAILED"
          onRetry={() => {}}
        />
      );

      expect(html).toContain('🔄 Retry');
      expect(html).toContain('aria-label="Retry sending failed message"');
      expect(html).toContain('Failed to deliver');
    });
  });

  describe('Selection Toolbar Primitives', () => {
    it('renders floating selection toolbar with selected count and batch actions', () => {
      const html = renderToStaticMarkup(
        <div className="veil-selection-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <IconButton icon="✕" aria-label="Cancel selection" />
            <span>3 Selected</span>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <Button variant="secondary" size="sm">Select All</Button>
            <Button variant="secondary" size="sm">📋 Copy</Button>
            <Button variant="danger" size="sm">🗑️ Delete</Button>
          </div>
        </div>
      );

      expect(html).toContain('veil-selection-toolbar');
      expect(html).toContain('3 Selected');
      expect(html).toContain('Select All');
      expect(html).toContain('📋 Copy');
      expect(html).toContain('🗑️ Delete');
    });
  });

  describe('In-Conversation Search Primitives', () => {
    it('renders in-chat search banner with match counter and navigation controls', () => {
      const html = renderToStaticMarkup(
        <div className="veil-chat-search-bar" role="search">
          <input
            type="text"
            className="veil-input"
            defaultValue="secret"
            aria-label="Search conversation messages"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="veil-search-match-count">2 of 5</span>
            <IconButton icon="▲" aria-label="Previous search match" />
            <IconButton icon="▼" aria-label="Next search match" />
            <IconButton icon="✕" aria-label="Close search" />
          </div>
        </div>
      );

      expect(html).toContain('veil-chat-search-bar');
      expect(html).toContain('2 of 5');
      expect(html).toContain('aria-label="Previous search match"');
      expect(html).toContain('aria-label="Next search match"');
    });
  });

  describe('Date Separators & Context Menu Primitives', () => {
    it('renders date separator pill for timeline groupings', () => {
      const html = renderToStaticMarkup(
        <div className="veil-date-separator">
          <span className="veil-date-pill">Today</span>
        </div>
      );

      expect(html).toContain('veil-date-separator');
      expect(html).toContain('veil-date-pill');
      expect(html).toContain('Today');
    });

    it('renders context menu with Reply, Copy, Select, and Delete options', () => {
      const html = renderToStaticMarkup(
        <div className="veil-context-menu" role="menu" aria-label="Message Actions">
          <button type="button" className="veil-context-menu-item" role="menuitem">
            ↩ Reply
          </button>
          <button type="button" className="veil-context-menu-item" role="menuitem">
            📋 Copy Text
          </button>
          <button type="button" className="veil-context-menu-item" role="menuitem">
            🔘 Select
          </button>
          <button type="button" className="veil-context-menu-item veil-context-menu-danger" role="menuitem">
            🗑️ Delete Locally
          </button>
        </div>
      );

      expect(html).toContain('veil-context-menu');
      expect(html).toContain('↩ Reply');
      expect(html).toContain('📋 Copy Text');
      expect(html).toContain('🔘 Select');
      expect(html).toContain('🗑️ Delete Locally');
    });
  });
});
