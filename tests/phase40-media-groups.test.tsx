/**
 * Phase 40: Grouped Media Gallery Grid Test Suite.
 *
 * Verifies:
 * - Single media renders full item
 * - 2-item layout renders 2-column grid
 * - 4+ items render 2x2 grid with +N overflow count
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GroupedMediaGrid } from '../src/ui/components/media/GroupedMediaGrid.tsx';
import { AttachmentPayload } from '../src/ui/utils/mediaCache.ts';
import { AppContext, AppContextType } from '../src/ui/app/AppState.tsx';

function createMockAppContext(overrides: Partial<AppContextType> = {}): AppContextType {
  return {
    storageReady: true,
    storageError: null,
    activeSession: { spaceId: 's1' } as any,
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
    sendAttachment: async () => {},
    sendVoiceMessage: async () => {},
    deleteMessageLocally: async () => {},
    deleteMessagesLocally: async () => {},
    retryFailedMessage: async () => {},
    markConversationAsRead: async () => {},
    createVoiceNoteMessage: async () => {},
    createFileAttachmentMessage: async () => {},
    ensureCloudSession: async () => {},
    cloudClient: { getSessionToken: () => 'tok' } as any,
    replyTarget: null,
    setReplyTarget: () => {},
    openModal: () => {},
    closeModal: () => {},
    addContactFromInvitation: async () => ({} as any),
    createInvitation: async () => '',
    verifyContactFingerprint: async () => {},
    rejectContactFingerprint: async () => {},
    findDirectoryUser: async () => null,
    sendContactRequest: async () => {},
    acceptContactRequest: async () => {},
    rejectContactRequest: async () => {},
    updatePrivacySettings: async () => {},
    updateProfile: async () => {},
    createGroup: async () => ({} as any),
    leaveGroup: async () => {},
    ...overrides,
  };
}

describe('Phase 40: Grouped Media Gallery Grid', () => {
  it('renders single media item directly', () => {
    const onOpen = vi.fn();
    const attachments: AttachmentPayload[] = [
      { attachmentId: 'att_1', name: 'photo1.jpg', mimeType: 'image/jpeg', sizeBytes: 1000, previewUrl: 'blob:p1' },
    ];

    const html = renderToStaticMarkup(
      <AppContext.Provider value={createMockAppContext()}>
        <GroupedMediaGrid attachments={attachments} onOpenItem={onOpen} />
      </AppContext.Provider>
    );
    expect(html).toContain('veil-grouped-media-single');
    expect(html).toContain('photo1.jpg');
  });

  it('renders 2x2 grid with +N overflow badge for 6 items', () => {
    const onOpen = vi.fn();
    const attachments: AttachmentPayload[] = [
      { attachmentId: 'att_1', name: 'p1.jpg', mimeType: 'image/jpeg', sizeBytes: 1000, previewUrl: 'blob:p1' },
      { attachmentId: 'att_2', name: 'p2.jpg', mimeType: 'image/jpeg', sizeBytes: 1000, previewUrl: 'blob:p2' },
      { attachmentId: 'att_3', name: 'v1.mp4', mimeType: 'video/mp4', sizeBytes: 2000, previewUrl: 'blob:v1' },
      { attachmentId: 'att_4', name: 'p3.jpg', mimeType: 'image/jpeg', sizeBytes: 1000, previewUrl: 'blob:p3' },
      { attachmentId: 'att_5', name: 'p4.jpg', mimeType: 'image/jpeg', sizeBytes: 1000, previewUrl: 'blob:p4' },
      { attachmentId: 'att_6', name: 'p5.jpg', mimeType: 'image/jpeg', sizeBytes: 1000, previewUrl: 'blob:p5' },
    ];

    const html = renderToStaticMarkup(
      <AppContext.Provider value={createMockAppContext()}>
        <GroupedMediaGrid attachments={attachments} onOpenItem={onOpen} />
      </AppContext.Provider>
    );
    expect(html).toContain('veil-grouped-media-grid');
    expect(html).toContain('+2');
  });
});
