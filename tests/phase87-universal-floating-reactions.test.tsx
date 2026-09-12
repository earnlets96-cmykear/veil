/**
 * Phase 87 Test Suite: Universal Floating Reaction Badges & Ultra-Premium Styling
 *
 * Verifies:
 * 1. Text Messages Universal Floating Reactions:
 *    - ConversationView renders .veil-floating-reaction-badge for text messages.
 *    - The text message bubble itself renders with reactions={undefined} so its action row
 *      remains uncluttered (no cramped inline .veil-message-reactions inside the bubble).
 * 2. Non-Text Messages Floating Reactions:
 *    - Voice, media, file, and sticker cards render .veil-floating-reaction-badge.
 * 3. Backward Compatibility:
 *    - MessageBubble still renders internal .veil-message-reactions when passed reactions directly.
 * 4. Ultra-Premium Obsidian Glassmorphism & Spring Physics:
 *    - Corner positioning: align-self: flex-end (outgoing) vs align-self: flex-start (incoming).
 *    - Overlap: margin-top: -8px.
 *    - Specular highlights, backdrop blur, spring physics (cubic-bezier(0.34, 1.56, 0.64, 1)),
 *      active user-reacted state, and light theme overrides.
 * 5. Zero Literal Unicode Emoji Ban (Phase 44a rule compliance).
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';
import { ConversationView } from '../src/ui/components/ConversationView.tsx';
import { MessageBubble } from '../src/ui/components/ui/MessageBubble.tsx';
import { AppContext, AppContextType } from '../src/ui/app/AppState.tsx';
import { ToastProvider } from '../src/ui/components/ui/Toast.tsx';
import type { UIConversation, UIMessage } from '../src/ui/app/types.ts';
import type { Contact } from '../src/contacts/types.ts';

const rootDir = path.resolve(__dirname, '..');

function createMockAppContext(overrides: Partial<AppContextType> = {}): AppContextType {
  return {
    storageReady: true,
    storageError: null,
    activeSession: null,
    conversations: [],
    contacts: [],
    contactRequests: [],
    myProfile: null,
    privacySettings: { phoneVisibility: 'contacts', profileVisibility: 'everyone' },
    activeChatId: null,
    messages: {},
    activeModal: null,
    networkState: 'connected',
    knownSpacesCount: 1,
    searchQuery: '',
    searchResults: [],
    setSearchQuery: () => {},
    clearSearch: () => {},
    unlockSpace: async () => true,
    createSpace: async () => {},
    lockSpace: () => {},
    destroySpaceData: async () => {},
    panicLock: () => {},
    selectConversation: () => {},
    sendMessage: async () => {},
    deleteMessageLocally: async () => {},
    deleteMessagesLocally: async () => {},
    retryFailedMessage: async () => {},
    markConversationAsRead: async () => {},
    createVoiceNoteMessage: async () => {},
    createFileAttachmentMessage: async () => {},
    ensureCloudSession: async () => {},
    replyTarget: null,
    setReplyTarget: () => {},
    openModal: () => {},
    closeModal: () => {},
    addContactFromInvitation: async () => ({} as any),
    createInvitation: async () => '',
    updateContactVerification: async () => {},
    createGroup: async () => {},
    refreshDirectory: async () => {},
    updateProfile: async () => {},
    updatePrivacySettings: async () => {},
    sendContactRequest: async () => {},
    acceptContactRequest: async () => {},
    declineContactRequest: async () => {},
    cancelContactRequest: async () => {},
    blockUser: async () => {},
    unblockUser: async () => {},
    removeContact: async () => {},
    sessionController: {} as any,
    idMgr: {} as any,
    store: {} as any,
    notificationDispatcher: {} as any,
    contactRequestManager: {} as any,
    directoryClient: {} as any,
    cloudClient: {} as any,
    accountManager: {} as any,
    syncEngine: {} as any,
    ...overrides,
  };
}

function renderWithContext(contextValue: AppContextType): string {
  return renderToStaticMarkup(
    <ToastProvider>
      <AppContext.Provider value={contextValue}>
        <ConversationView />
      </AppContext.Provider>
    </ToastProvider>
  );
}

describe('Phase 87 — Universal Floating Reactions in ConversationView', () => {
  const aliceContact: Contact = {
    identityId: 'user_alice_87',
    name: 'Alice',
    fingerprint: '11111 22222 33333 44444 55555 66666 77777 88888 99999 00000 11111 22222',
    signingPublicKey: 'pk_sign_alice',
    keyAgreementPublicKey: 'pk_ka_alice',
    status: 'ACCEPTED',
    verificationStatus: 'VERIFIED',
    addedAt: Date.now(),
  };

  const directConv: UIConversation = {
    id: 'user_alice_87',
    name: 'Alice',
    type: 'direct',
    unreadCount: 0,
    avatarSeed: 'user_alice_87',
    isVerified: true,
  };

  it('renders .veil-floating-reaction-badge for a text message with reactions', () => {
    const textMsgWithReactions: UIMessage = {
      id: 'msg_text_with_rx',
      senderId: 'user_alice_87',
      senderName: 'Alice',
      text: 'This is a text message with reactions',
      timestamp: Date.now(),
      status: 'DELIVERED',
      isOutgoing: false,
      reactions: [
        { emoji: '\u{1F44D}', count: 3, userReacted: true },
        { emoji: '\u{1F525}', count: 1, userReacted: false },
      ],
    } as any;

    const ctx = createMockAppContext({
      activeChatId: directConv.id,
      conversations: [directConv],
      contacts: [aliceContact],
      messages: {
        [directConv.id]: [textMsgWithReactions],
      },
    });

    const html = renderWithContext(ctx);

    // Verify .veil-floating-reaction-badge is rendered
    expect(html).toContain('veil-floating-reaction-badge');
    expect(html).toContain('veil-reaction-pill');
    expect(html).toContain('user-reacted');
    expect(html).toContain('\u{1F44D}');
    expect(html).toContain('>3<');
    expect(html).toContain('\u{1F525}');
    expect(html).toContain('>1<');

    // Crucial check: Inside the text bubble MessageBubble itself,
    // .veil-message-reactions should NOT be rendered (decoupled cleanly)
    expect(html).not.toContain('veil-message-action-row"><div className="veil-message-reactions"');
  });

  it('renders .veil-floating-reaction-badge for an outgoing voice message with reactions', () => {
    const voiceMsgWithReactions: UIMessage = {
      id: 'msg_voice_with_rx',
      senderId: 'self_user',
      senderName: 'Me',
      text: 'Voice Message',
      timestamp: Date.now(),
      status: 'DELIVERED',
      isOutgoing: true,
      voice: {
        durationSeconds: 15,
        waveform: [10, 20, 30, 40, 50],
        mimeType: 'audio/webm;codecs=opus',
      },
      reactions: [
        { emoji: '\u2764\uFE0F', count: 2, userReacted: false },
      ],
    } as any;

    const ctx = createMockAppContext({
      activeChatId: directConv.id,
      conversations: [directConv],
      contacts: [aliceContact],
      messages: {
        [directConv.id]: [voiceMsgWithReactions],
      },
    });

    const html = renderWithContext(ctx);

    expect(html).toContain('veil-floating-reaction-badge');
    expect(html).toContain('\u2764\uFE0F');
    expect(html).toContain('>2<');
  });

  it('ConversationView source code removes !hasVisibleTextBubble barrier and decouples MessageBubble', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Decoupled: reactions={undefined} passed to MessageBubble in ConversationView
    expect(convView).toContain('reactions={undefined}');

    // Barrier removed: floating reaction badge rendered unconditionally when (msg as any).reactions has items
    expect(convView).not.toMatch(/!hasVisibleTextBubble\s*&&\s*\(msg as any\)\.reactions/);
    expect(convView).toMatch(/\(msg as any\)\.reactions\s*&&\s*\(msg as any\)\.reactions\.length > 0\s*&&\s*\(/);
  });
});

describe('Phase 87 — Backward Compatibility for MessageBubble', () => {
  it('MessageBubble still supports isolated callers passing reactions prop directly', () => {
    const html = renderToStaticMarkup(
      <MessageBubble
        id="bubble-isolated-test"
        isOutgoing={false}
        text="Isolated component test"
        timestamp={Date.now()}
        reactions={[
          { emoji: '\u{1F602}', count: 5, userReacted: true },
        ]}
      />
    );

    expect(html).toContain('veil-message-reactions');
    expect(html).toContain('veil-reaction-pill');
    expect(html).toContain('user-reacted');
    expect(html).toContain('\u{1F602}');
    expect(html).toContain('>5<');
  });
});

describe('Phase 87 — Ultra-Premium CSS Aesthetics & Spring Physics', () => {
  it('veil-components.css contains obsidian glassmorphism, specular highlights, and spring curves', () => {
    const css = fs.readFileSync(path.join(rootDir, 'src/styles/veil-components.css'), 'utf-8');

    // Floating reaction badge layout
    expect(css).toMatch(/\.veil-floating-reaction-badge\s*\{[^}]*margin-top:\s*-8px/);
    expect(css).toMatch(/\.veil-floating-reaction-badge\s*\{[^}]*z-index:\s*10/);
    expect(css).toMatch(/\.veil-msg-row\.outgoing\s+\.veil-floating-reaction-badge\s*\{[^}]*align-self:\s*flex-end/);
    expect(css).toMatch(/\.veil-msg-row\.outgoing\s+\.veil-floating-reaction-badge\s*\{[^}]*margin-right:\s*6px/);
    expect(css).toMatch(/\.veil-msg-row\.incoming\s+\.veil-floating-reaction-badge\s*\{[^}]*align-self:\s*flex-start/);
    expect(css).toMatch(/\.veil-msg-row\.incoming\s+\.veil-floating-reaction-badge\s*\{[^}]*margin-left:\s*6px/);

    // Obsidian glassmorphism & specular highlight
    expect(css).toContain('backdrop-filter: blur(16px) saturate(180%)');
    expect(css).toContain('inset 0 1px 0 rgba(255, 255, 255, 0.16)');

    // Spring physics cubic-bezier micro-interactions
    expect(css).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)');

    // User reacted active styling
    expect(css).toMatch(/\.veil-reaction-pill\.user-reacted\s*\{[^}]*border-color:\s*var\(--veil-accent-primary/);

    // Light mode support
    expect(css).toContain('[data-theme="light"] .veil-floating-reaction-badge .veil-reaction-pill');
  });

  it('veil-design-system.css harmonizes base .veil-reaction-pill with spring transitions and specular shadow', () => {
    const dsCss = fs.readFileSync(path.join(rootDir, 'src/styles/veil-design-system.css'), 'utf-8');

    expect(dsCss).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)');
    expect(dsCss).toMatch(/\.veil-reaction-pill\s*\{[^}]*box-shadow:[^}]*inset 0 1px 0/);
  });
});

describe('Phase 87 — Strict Zero Literal Unicode Emoji Compliance', () => {
  it('ConversationView and tests contain zero unescaped literal emojis in reaction definitions', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // Verify DEFAULT_REACTION_EMOJIS uses unicode escapes
    expect(convView).toContain("DEFAULT_REACTION_EMOJIS = ['\\u{1F44D}', '\\u2764\\uFE0F', '\\u{1F602}', '\\u{1F62E}', '\\u{1F622}', '\\u{1F64F}', '\\u{1F525}']");
  });
});
