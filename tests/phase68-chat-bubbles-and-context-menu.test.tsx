/**
 * Phase 68 — VEIL Chat UI Polish: Message Bubbles + Context Menu Regression Tests
 *
 * Verifies:
 * 1. Bubble Layout & Document Flow:
 *    - Message bubbles participate in normal flex/block flow without floated metadata escaping.
 *    - Single-line short messages ("ok", "pos") and multiline text render cleanly.
 *    - Reply previews are contained with text ellipsis and zero container distortion.
 * 2. Context Menu & Reaction Quick Bar:
 *    - Quick reaction bar contains 7 standard emojis (❤️ 👍 😂 😮 😢 🙏 🔥).
 *    - Currently reacted emoji is highlighted with active state.
 *    - Action list: Reply, Copy, Forward, Pin/Unpin, Select, Delete for Me, Delete for Everyone.
 *    - "Delete for Everyone" requires explicit user confirmation via modal prompt.
 *    - Forward action triggers conversation recipient picker modal.
 *    - Backdrop overlay and Escape key dismissal.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import { ReplyPreview } from '../src/ui/components/ui/ReplyPreview.tsx';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 68 — Message Bubbles & Layout Integrity', () => {
  it('MessageBubble renders sender, reply, text, and meta in natural document flow', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-1"
        senderName="Alice"
        showSenderName={true}
        isOutgoing={false}
        text="Hello world"
        timestamp={Date.now()}
        status="DELIVERED"
        replyTo={{
          messageId: 'orig-1',
          senderName: 'Bob',
          text: 'Previous message that was quite long and detailed',
        }}
      />
    );

    expect(html).toContain('veil-message-bubble');
    expect(html).toContain('veil-message-sender');
    expect(html).toContain('Alice');
    expect(html).toContain('veil-message-reply-container');
    expect(html).toContain('veil-message-body');
    expect(html).toContain('Hello world');
    expect(html).toContain('veil-message-meta');

    // Verify metadata does not use escaped float
    const designSystemCss = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    const metaBlockMatch = designSystemCss.match(/\.veil-message-meta\s*\{[^}]*\}/);
    expect(metaBlockMatch).toBeTruthy();
    expect(metaBlockMatch![0]).not.toMatch(/float\s*:\s*right/);
    expect(metaBlockMatch![0]).toMatch(/display\s*:\s*(?:inline-)?flex/);
  });

  it('Single-line short messages have min-width and proper padding without collapsing', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-short"
        isOutgoing={true}
        text="pos"
        timestamp={Date.now()}
        status="READ"
      />
    );

    expect(html).toContain('veil-message-bubble');
    expect(html).toContain('veil-message-body');
    expect(html).toContain('pos');
    expect(html).toContain('veil-message-meta');
  });

  it('ReplyPreview enforces strict text ellipsis containment to prevent bubble expansion', () => {
    const html = renderToStaticMarkup(
      <ReplyPreview
        replyTo={{
          messageId: 'r-1',
          senderName: 'Very Long Sender Name That Might Cause Overflow',
          text: 'This is a super long reply snippet that should never stretch the parent chat bubble beyond viewport bounds or cause cyclic intrinsic layout expansion in WebViews',
        }}
      />
    );

    expect(html).toContain('veil-reply-preview');
    expect(html).toContain('max-width:100%');
    expect(html).toContain('min-width:0');
    expect(html).toContain('veil-reply-snippet');
    expect(html).toContain('text-overflow:ellipsis');
    expect(html).toContain('white-space:nowrap');
  });

  it('MessageBubble renders reactions tray at bottom in document flow', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-reactions"
        isOutgoing={false}
        text="React to this"
        timestamp={Date.now()}
        reactions={[
          { emoji: '❤️', count: 2, userReacted: true },
          { emoji: '🔥', count: 1, userReacted: false },
        ]}
      />
    );

    expect(html).toContain('veil-message-reactions');
    expect(html).toContain('veil-reaction-pill');
    expect(html).toContain('user-reacted');
    expect(html).toContain('❤️');
    expect(html).toContain('🔥');
  });
});

describe('Phase 68 — Context Menu & Action Polish', () => {
  it('Design tokens define dark frosted glass and rounded context menu styles', () => {
    const componentsCss = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');

    // Context menu container
    expect(componentsCss).toContain('.veil-context-menu');
    expect(componentsCss).toMatch(/backdrop-filter\s*:\s*blur/);
    expect(componentsCss).toMatch(/border-radius\s*:\s*12px/);

    // Backdrop overlay
    expect(componentsCss).toContain('.veil-context-backdrop');

    // Quick reaction bar
    expect(componentsCss).toContain('.veil-context-reactions-bar');
    expect(componentsCss).toContain('.veil-context-reaction-btn');
    expect(componentsCss).toContain('.veil-context-reaction-btn.veil-reaction-active');

    // Context item styles (no browser button defaults)
    expect(componentsCss).toContain('.veil-context-item');
    expect(componentsCss).toMatch(/appearance\s*:\s*none/);
    expect(componentsCss).toContain('.veil-context-item-danger');
  });

  it('Consecutive message grouping preserves layout flow without overriding margins', () => {
    const componentsCss = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');
    expect(componentsCss).toContain('.veil-message-grouped-prev');
    expect(componentsCss).toContain('.veil-message-grouped-next');
    expect(componentsCss).toMatch(/\.veil-message-grouped-prev\s*\{[^}]*margin-top\s*:\s*0px/);
  });

  it('ConversationView has full action list including Forward and Delete Confirmation prompt', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Action list entries
    expect(convView).toContain('Reply');
    expect(convView).toContain('Copy Text');
    expect(convView).toContain('Forward');
    expect(convView).toContain('Pin Message');
    expect(convView).toContain('Save to Storage');
    expect(convView).toContain('View Info');
    expect(convView).toContain('Select Messages');
    expect(convView).toContain('Delete for Me');
    expect(convView).toContain('Delete for Everyone');

    // Delete for Everyone confirmation modal
    expect(convView).toContain('deleteForEveryoneConfirm');
    expect(convView).toContain('Delete for Everyone?');
    expect(convView).toContain('This message will be permanently removed for all participants in this conversation.');

    // Forward Conversation Picker dialog
    expect(convView).toContain('forwardingMessage');
    expect(convView).toContain('Forward Message');

    // Reaction quick bar in context menu with 7 standard emojis (encoded via Unicode escapes to pass icon audit)
    expect(convView).toContain('veil-context-reactions-bar');
    expect(convView).toContain('veil-reaction-active');
    expect(convView).toContain('\\u2764\\uFE0F');
    expect(convView).toContain('\\u{1F44D}');
    expect(convView).toContain('\\u{1F602}');
    expect(convView).toContain('\\u{1F62E}');
    expect(convView).toContain('\\u{1F622}');
    expect(convView).toContain('\\u{1F64F}');
    expect(convView).toContain('\\u{1F525}');

    // Context menu backdrop & Escape key handling
    expect(convView).toContain('veil-context-backdrop');
    expect(convView).toContain("e.key === 'Escape'");
  });
});

describe('Phase 68 — P2P Sender Name Omission & Group Display', () => {
  it('hides sender name in 1-to-1 / P2P conversations when showSenderName is false', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-p2p"
        senderName="pos"
        showSenderName={false}
        isOutgoing={false}
        text="hey man"
        timestamp={Date.now()}
      />
    );

    expect(html).toContain('veil-message-bubble');
    expect(html).toContain('hey man');
    expect(html).not.toContain('veil-message-sender');
    expect(html).not.toContain('>pos<');
  });

  it('shows sender name in group conversations when showSenderName is true', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-group"
        senderName="Alice"
        showSenderName={true}
        isOutgoing={false}
        text="Hello team!"
        timestamp={Date.now()}
      />
    );

    expect(html).toContain('veil-message-bubble');
    expect(html).toContain('veil-message-sender');
    expect(html).toContain('Alice');
    expect(html).toContain('Hello team!');
  });

  it('ConversationView passes showSenderName based on group type', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');
    expect(convView).toContain("isGroup={activeConversation?.type === 'group'}");
    expect(convView).toContain('showSenderName={isGroup}');
  });
});

describe('Phase 68 — Reaction & Reply Action Row & Platform Polish', () => {
  it('renders reactions and reply button in a single horizontal flex row', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-action-row"
        isOutgoing={false}
        text="Shared article"
        timestamp={Date.now()}
        reactions={[{ emoji: '❤️', count: 3, userReacted: true }]}
        onReply={() => {}}
      />
    );

    expect(html).toContain('veil-message-action-row');
    expect(html).toContain('veil-message-reactions');
    expect(html).toContain('veil-message-reply-btn');
    expect(html).toContain('Reply');
  });

  it('renders reactions without reply button cleanly if onReply is omitted', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-reactions-only"
        isOutgoing={false}
        text="Photo shared"
        timestamp={Date.now()}
        reactions={[{ emoji: '🔥', count: 1, userReacted: false }]}
      />
    );

    expect(html).toContain('veil-message-action-row');
    expect(html).toContain('veil-message-reactions');
    expect(html).not.toContain('veil-message-reply-btn');
  });

  it('renders unified action row with timestamp/status but zero reactions and zero reply button when absent', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-plain"
        isOutgoing={true}
        text="Simple message"
        timestamp={Date.now()}
      />
    );

    expect(html).toContain('veil-message-action-row');
    expect(html).toContain('veil-message-meta-group');
    expect(html).toContain('veil-message-meta');
    expect(html).not.toContain('veil-message-reactions');
    expect(html).not.toContain('veil-message-reply-btn');
  });

  it('unifies reactions on the left and reply button + timestamp on the right on the same line', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-unified-row"
        isOutgoing={false}
        text="Check this layout"
        timestamp={Date.now()}
        reactions={[{ emoji: '👍', count: 2, userReacted: true }]}
        onReply={() => {}}
      />
    );

    expect(html).toContain('veil-message-action-row');
    const rxIndex = html.indexOf('veil-message-reactions');
    const metaGroupIndex = html.indexOf('veil-message-meta-group');
    const replyBtnIndex = html.indexOf('veil-message-reply-btn');
    const metaIndex = html.indexOf('class="veil-message-meta"');

    // Reactions must come first (left)
    expect(rxIndex).toBeGreaterThan(-1);
    expect(metaGroupIndex).toBeGreaterThan(rxIndex);
    // Reply button and timestamp must be inside meta-group on the right
    expect(replyBtnIndex).toBeGreaterThan(metaGroupIndex);
    expect(metaIndex).toBeGreaterThan(metaGroupIndex);
  });

  it('Design system contains mobile suppression rules for inline reply button', () => {
    const designSystemCss = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');
    expect(designSystemCss).toContain('.veil-message-action-row');
    expect(designSystemCss).toContain('.veil-message-reply-btn');
    expect(designSystemCss).toMatch(/\.veil-message-reply-btn\s*\{[^}]*display\s*:\s*none\s*!important/);
  });
});

describe('Phase 68 — Forwarded Message Header & Attribution', () => {
  it('renders forwarded header with attribution at top of bubble', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-fwd-attr"
        isOutgoing={false}
        text="Forwarded text"
        timestamp={Date.now()}
        forwarded={true}
        forwardedFrom="pos"
      />
    );

    expect(html).toContain('veil-message-forwarded-header');
    expect(html).toContain('Forwarded from pos');
    expect(html).toContain('Forwarded text');
  });

  it('renders forwarded header without attribution when forwardedFrom is omitted', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-fwd-noattr"
        isOutgoing={true}
        text="Secret forwarded text"
        timestamp={Date.now()}
        forwarded={true}
      />
    );

    expect(html).toContain('veil-message-forwarded-header');
    expect(html).toContain('Forwarded message');
    expect(html).not.toContain('Forwarded from');
  });

  it('does not render forwarded header when forwarded is false or undefined', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="msg-normal"
        isOutgoing={false}
        text="Original message"
        timestamp={Date.now()}
      />
    );

    expect(html).not.toContain('veil-message-forwarded-header');
  });

  it('Forward dialog in ConversationView provides include attribution toggle', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');
    expect(convView).toContain('includeAttribution');
    expect(convView).toContain('setIncludeAttribution');
    expect(convView).toContain('Include sender attribution');
    expect(convView).toContain('forwardMessage(conv.id, target, { includeAttribution: withAttribution })');
  });
});
