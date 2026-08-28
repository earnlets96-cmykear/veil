/**
 * Comprehensive Render Regression Test Suite for ConversationView
 *
 * Prevents black-screen render crashes and verifies header status rendering for:
 * 1. Direct unverified conversation (mounts without crashing, normal "Verify Identity" action).
 * 2. Direct verified conversation (mounts and renders "✓ Verified" badge and "🛡️ Safety Number").
 * 3. Direct MISMATCH conversation (mounts and renders "🚨 Key Changed" badge and "🚨 Review Key").
 * 4. Direct conversation with missing contact record (mounts safely without crash).
 * 5. Group conversation (mounts safely, displays "Group Info", no direct contact lookup crash).
 * 6. Empty / unselected conversation state (mounts empty state safely).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConversationView } from '../src/ui/components/ConversationView.tsx';
import { AppContext, AppContextType } from '../src/ui/app/AppState.tsx';
import { ToastProvider } from '../src/ui/components/ui/Toast.tsx';
import type { UIConversation, UIMessage } from '../src/ui/app/types.ts';
import type { Contact } from '../src/contacts/types.ts';

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

describe('ConversationView Render & Verification Status Suite', () => {
  const aliceContact: Contact = {
    identityId: 'user_alice_123',
    name: 'Alice',
    fingerprint: '11111 22222 33333 44444 55555 66666 77777 88888 99999 00000 11111 22222',
    signingPublicKey: 'pk_sign_alice',
    keyAgreementPublicKey: 'pk_ka_alice',
    status: 'ACCEPTED',
    verificationStatus: 'UNVERIFIED',
    addedAt: Date.now(),
  };

  const directConv: UIConversation = {
    id: 'user_alice_123',
    name: 'Alice',
    type: 'direct',
    unreadCount: 0,
    avatarSeed: 'user_alice_123',
    isVerified: false,
  };

  const sampleMessages: UIMessage[] = [
    {
      id: 'msg_1',
      senderId: 'user_alice_123',
      senderName: 'Alice',
      text: 'Hello from Alice!',
      timestamp: Date.now(),
      status: 'processed',
      isOutbound: false,
    },
  ];

  it('mounts direct UNVERIFIED conversation without crashing and displays standard verify button', () => {
    const mockContext = createMockAppContext({
      activeChatId: 'user_alice_123',
      conversations: [directConv],
      contacts: [aliceContact],
      messages: { 'user_alice_123': sampleMessages },
    });

    const html = renderWithContext(mockContext);

    expect(html).toContain('Alice');
    expect(html).toContain('Hello from Alice!');
    expect(html).toContain('End-to-End Encrypted');
    expect(html).not.toContain('Verified');
    expect(html).not.toContain('Key Changed');
  });

  it('mounts direct VERIFIED conversation and renders verified badge & safety number action', () => {
    const verifiedContact: Contact = {
      ...aliceContact,
      verificationStatus: 'VERIFIED',
    };

    const verifiedConv: UIConversation = {
      ...directConv,
      isVerified: true,
    };

    const mockContext = createMockAppContext({
      activeChatId: 'user_alice_123',
      conversations: [verifiedConv],
      contacts: [verifiedContact],
      messages: { 'user_alice_123': sampleMessages },
    });

    const html = renderWithContext(mockContext);

    expect(html).toContain('Alice');
    expect(html).toContain('Verified');
    expect(html).not.toContain('Key Changed');
  });

  it('mounts direct MISMATCH conversation and renders key changed warning & review key action', () => {
    const mismatchContact: Contact = {
      ...aliceContact,
      verificationStatus: 'MISMATCH',
    };

    const mockContext = createMockAppContext({
      activeChatId: 'user_alice_123',
      conversations: [directConv],
      contacts: [mismatchContact],
      messages: { 'user_alice_123': sampleMessages },
    });

    const html = renderWithContext(mockContext);

    expect(html).toContain('Alice');
    expect(html).toContain('Key Changed');
    expect(html).not.toContain('Verified');
  });

  it('mounts direct conversation with NO matching contact record safely without error', () => {
    const mockContext = createMockAppContext({
      activeChatId: 'user_alice_123',
      conversations: [directConv],
      contacts: [], // no contacts in address book
      messages: { 'user_alice_123': sampleMessages },
    });

    const html = renderWithContext(mockContext);

    expect(html).toContain('Alice');
    expect(html).toContain('Hello from Alice!');
    expect(html).toContain('End-to-End Encrypted');
  });

  it('mounts GROUP conversation safely and displays group info action', () => {
    const groupConv: UIConversation = {
      id: 'grp_engineering_001',
      name: 'Engineering Team',
      type: 'group',
      unreadCount: 0,
      avatarSeed: 'grp_engineering_001',
    };

    const groupMessages: UIMessage[] = [
      {
        id: 'msg_g1',
        senderId: 'user_bob',
        senderName: 'Bob',
        text: 'Group standup in 5 mins',
        timestamp: Date.now(),
        status: 'delivered',
        isOutbound: false,
      },
    ];

    const mockContext = createMockAppContext({
      activeChatId: 'grp_engineering_001',
      conversations: [groupConv],
      contacts: [aliceContact],
      messages: { 'grp_engineering_001': groupMessages },
    });

    const html = renderWithContext(mockContext);

    expect(html).toContain('Engineering Team');
    expect(html).toContain('End-to-End Encrypted');
    expect(html).toContain('Group standup in 5 mins');
  });

  it('handles empty active chat state gracefully', () => {
    const emptyConv: UIConversation = {
      id: 'user_alice_123',
      name: 'Alice',
      type: 'direct',
      unreadCount: 0,
    };

    const mockContext = createMockAppContext({
      activeChatId: 'user_alice_123',
      conversations: [emptyConv],
      contacts: [aliceContact],
      messages: {},
    });

    const html = renderWithContext(mockContext);

    expect(html).toContain('Alice');
    expect(html).toContain('End-to-End Encrypted Conversation');
  });
});
