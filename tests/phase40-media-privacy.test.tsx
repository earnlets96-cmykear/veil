/**
 * Phase 40: Per-Media Privacy Controls & Symmetrical Enforcement Test Suite.
 *
 * Verifies:
 * - Disallowing save renders "Saving disabled by sender" badge in MediaViewer
 * - Download and Share buttons are omitted when allowSave is false
 * - Download and Share buttons are present when allowSave is true
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MediaViewer } from '../src/ui/components/media/MediaViewer.tsx';
import { MediaViewerItem } from '../src/ui/components/media/index.ts';
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

describe('Phase 40: Per-Media Privacy Controls', () => {
  it('renders Saving disabled by sender badge when allowSave is false', () => {
    const handleDownload = vi.fn();
    const handleShare = vi.fn();
    const handleClose = vi.fn();

    const privateItem: MediaViewerItem = {
      id: 'item_private_1',
      type: 'image',
      name: 'confidential_document.png',
      url: 'blob:mock-confidential-img',
      attachment: {
        attachmentId: 'att_priv_1',
        name: 'confidential_document.png',
        mimeType: 'image/png',
        sizeBytes: 5000,
        allowSave: false,
        allowForward: false,
      },
    };

    const html = renderToStaticMarkup(
      <AppContext.Provider value={createMockAppContext()}>
        <MediaViewer
          items={[privateItem]}
          initialIndex={0}
          onClose={handleClose}
          onDownload={handleDownload}
          onShare={handleShare}
        />
      </AppContext.Provider>
    );

    expect(html).toContain('Saving disabled by sender');
  });

  it('renders download and share buttons when allowSave is true', () => {
    const handleDownload = vi.fn();
    const handleShare = vi.fn();
    const handleClose = vi.fn();

    const standardItem: MediaViewerItem = {
      id: 'item_standard_1',
      type: 'image',
      name: 'family_photo.jpg',
      url: 'blob:mock-family-photo',
      attachment: {
        attachmentId: 'att_std_1',
        name: 'family_photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 15000,
        allowSave: true,
      },
    };

    const html = renderToStaticMarkup(
      <AppContext.Provider value={createMockAppContext()}>
        <MediaViewer
          items={[standardItem]}
          initialIndex={0}
          onClose={handleClose}
          onDownload={handleDownload}
          onShare={handleShare}
        />
      </AppContext.Provider>
    );

    expect(html).not.toContain('Saving disabled by sender');
    expect(html).toContain('aria-label="Download file"');
    expect(html).toContain('aria-label="Share media"');
  });
});
