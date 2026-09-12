/**
 * Phase 88 Test Suite: Universal Modal Outside Touch Dismissal & Ghost Click Prevention
 *
 * Verifies:
 * 1. AppState.tsx: Modal close cooldown guard (lastModalClosedAtRef) rejects rapid openModal() calls within 350ms.
 * 2. MessageComposer.tsx: Media picker cooldown guard (lastMediaPickerClosedAtRef) rejects rapid re-open of attachment picker.
 * 3. Universal Modal Backdrop Dismissal:
 *    - All modal backdrops (NewChatModal, NewGroupModal, ProfileModal, GroupDetailsModal, ContactDetailsModal,
 *      CreateSpaceModal, RestoreAccountModal, SettingsModal, AccountsAndSpacesModal, AppLockSetupModal,
 *      PermissionsModal, AvatarCropModal, AttachmentPreviewModal, MediaGalleryModal, AddStickerPackModal,
 *      EmojiPickerModal, ConversationView modals) implement target-verified outside click & touch dismissal
 *      with e.preventDefault() and e.stopPropagation().
 * 4. Inner Card Event Isolation:
 *    - All inner modal cards implement onClick={(e) => e.stopPropagation()} to prevent accidental dismissal
 *      when interacting with modal content.
 * 5. Unicode Compliance:
 *    - Strict Phase 44a verification ensuring no raw literal Unicode emojis are present in the touched files.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '..');

describe('Phase 88 — Universal Modal Outside Dismissal & Anti-Ghost-Click Engine', () => {
  it('AppState.tsx implements 350ms ghost-click cooldown guard on openModal()', () => {
    const appState = fs.readFileSync(path.join(rootDir, 'src/ui/app/AppState.tsx'), 'utf-8');

    // Verify ref exists
    expect(appState).toContain('lastModalClosedAtRef = useRef<number>(0)');

    // Verify timestamp recorded on closeModal
    expect(appState).toMatch(/closeModal\s*=\s*useCallback\(\(\)\s*=>\s*\{[^}]*lastModalClosedAtRef\.current\s*=\s*Date\.now\(\)/);

    // Verify openModal rejects calls within 350ms of closing
    expect(appState).toMatch(/openModal\s*=\s*useCallback\([^)]*\)\s*=>\s*\{[^}]*Date\.now\(\)\s*-\s*lastModalClosedAtRef\.current\s*<\s*350/);
  });

  it('MessageComposer.tsx guards attachment picker opening against ghost-click reactivation', () => {
    const composer = fs.readFileSync(path.join(rootDir, 'src/ui/components/MessageComposer.tsx'), 'utf-8');

    // Verify ref exists
    expect(composer).toContain('lastMediaPickerClosedAtRef = useRef<number>(0)');

    // Verify button guard
    expect(composer).toMatch(/Date\.now\(\)\s*-\s*lastMediaPickerClosedAtRef\.current\s*<\s*350/);

    // Verify onClose records timestamp
    expect(composer).toMatch(/onClose=\{[^}]*lastMediaPickerClosedAtRef\.current\s*=\s*Date\.now\(\)/);
  });

  it('Generic Modal.tsx absorbs backdrop touchstart and stops propagation on card', () => {
    const modalUi = fs.readFileSync(path.join(rootDir, 'src/ui/components/ui/Modal.tsx'), 'utf-8');

    expect(modalUi).toContain('touchStartOnBackdropRef');
    expect(modalUi).toContain('onPointerDown');
    expect(modalUi).toContain('onTouchEnd');
    expect(modalUi).toMatch(/veil-modal-card[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
    expect(modalUi).toMatch(/veil-modal-card[\s\S]*?onPointerDown=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });

  it('NewChatModal & NewGroupModal have target-verified outside click/touch dismiss and card stopPropagation', () => {
    const newChat = fs.readFileSync(path.join(rootDir, 'src/ui/components/NewChatModal.tsx'), 'utf-8');
    const newGroup = fs.readFileSync(path.join(rootDir, 'src/ui/components/NewGroupModal.tsx'), 'utf-8');

    // NewChatModal
    expect(newChat).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(newChat).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(newChat).toMatch(/className="veil-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // NewGroupModal
    expect(newGroup).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(newGroup).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(newGroup).toMatch(/className="veil-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });

  it('ProfileModal & GroupDetailsModal have target-verified outside click/touch dismiss and card stopPropagation', () => {
    const profile = fs.readFileSync(path.join(rootDir, 'src/ui/components/ProfileModal.tsx'), 'utf-8');
    const groupDetails = fs.readFileSync(path.join(rootDir, 'src/ui/components/GroupDetailsModal.tsx'), 'utf-8');

    // ProfileModal
    expect(profile).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(profile).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(profile).toMatch(/className="veil-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // GroupDetailsModal
    expect(groupDetails).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(groupDetails).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(groupDetails).toMatch(/className="veil-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });

  it('ContactDetailsModal, CreateSpaceModal & RestoreAccountModal have outside click/touch dismiss', () => {
    const contact = fs.readFileSync(path.join(rootDir, 'src/ui/components/ContactDetailsModal.tsx'), 'utf-8');
    const createSpace = fs.readFileSync(path.join(rootDir, 'src/ui/components/CreateSpaceModal.tsx'), 'utf-8');
    const restore = fs.readFileSync(path.join(rootDir, 'src/ui/components/RestoreAccountModal.tsx'), 'utf-8');

    // ContactDetailsModal
    expect(contact).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(contact).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(contact).toMatch(/className="veil-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // CreateSpaceModal
    expect(createSpace).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(createSpace).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(createSpace).toMatch(/className="veil-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // RestoreAccountModal
    expect(restore).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(restore).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(restore).toMatch(/className="veil-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });

  it('SettingsModal, AccountsAndSpacesModal & AppLockSetupModal have outside click/touch dismiss', () => {
    const settings = fs.readFileSync(path.join(rootDir, 'src/ui/components/SettingsModal.tsx'), 'utf-8');
    const spaces = fs.readFileSync(path.join(rootDir, 'src/ui/components/AccountsAndSpacesModal.tsx'), 'utf-8');
    const appLock = fs.readFileSync(path.join(rootDir, 'src/ui/components/AppLockSetupModal.tsx'), 'utf-8');

    // SettingsModal
    expect(settings).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(settings).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(settings).toMatch(/className="veil-settings-modal-container"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // AccountsAndSpacesModal
    expect(spaces).toMatch(/onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(spaces).toMatch(/onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?closeModal\(\)/);
    expect(spaces).toMatch(/className="veil-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // AppLockSetupModal
    expect(appLock).toMatch(/onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?handleDismiss\(\)/);
    expect(appLock).toMatch(/onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?handleDismiss\(\)/);
    expect(appLock).toMatch(/className="veil-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });

  it('Media & Utility modals (PermissionsModal, AvatarCropModal, AttachmentPreviewModal, MediaGalleryModal, AddStickerPackModal, EmojiPickerModal) have outside dismiss', () => {
    const permissions = fs.readFileSync(path.join(rootDir, 'src/ui/components/PermissionsModal.tsx'), 'utf-8');
    const crop = fs.readFileSync(path.join(rootDir, 'src/ui/components/ui/AvatarCropModal.tsx'), 'utf-8');
    const attachment = fs.readFileSync(path.join(rootDir, 'src/ui/components/media/AttachmentPreviewModal.tsx'), 'utf-8');
    const gallery = fs.readFileSync(path.join(rootDir, 'src/ui/components/media/MediaGalleryModal.tsx'), 'utf-8');
    const sticker = fs.readFileSync(path.join(rootDir, 'src/ui/components/stickers/AddStickerPackModal.tsx'), 'utf-8');
    const emoji = fs.readFileSync(path.join(rootDir, 'src/ui/components/ui/EmojiPickerModal.tsx'), 'utf-8');

    // PermissionsModal
    expect(permissions).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onCancel\(\)/);
    expect(permissions).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onCancel\(\)/);
    expect(permissions).toMatch(/className="veil-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // AvatarCropModal
    expect(crop).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onCancel\(\)/);
    expect(crop).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onCancel\(\)/);
    expect(crop).toMatch(/className="veil-modal-card veil-crop-modal-card"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // AttachmentPreviewModal
    expect(attachment).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onCancel\(\)/);
    expect(attachment).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onCancel\(\)/);
    expect(attachment).toMatch(/className="veil-attachment-preview-modal"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // MediaGalleryModal
    expect(gallery).toMatch(/className="veil-modal-overlay"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onClose\(\)/);
    expect(gallery).toMatch(/className="veil-modal-overlay"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onClose\(\)/);
    expect(gallery).toMatch(/className="veil-gallery-modal"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // AddStickerPackModal
    expect(sticker).toMatch(/className="veil-modal-backdrop"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onClose\(\)/);
    expect(sticker).toMatch(/className="veil-modal-backdrop"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onClose\(\)/);
    expect(sticker).toMatch(/className="veil-add-sticker-modal"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);

    // EmojiPickerModal
    expect(emoji).toMatch(/className="veil-emoji-picker-backdrop"[\s\S]*?onClick=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onClose\(\)/);
    expect(emoji).toMatch(/className="veil-emoji-picker-backdrop"[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?e\.target === e\.currentTarget[\s\S]*?onClose\(\)/);
    expect(emoji).toMatch(/className="veil-emoji-picker-modal"[\s\S]*?onClick=\{\(e\)\s*=>\s*e\.stopPropagation\(\)\}/);
  });

  it('ConversationView confirmation and forward modals have outside click/touch dismiss', () => {
    const convView = fs.readFileSync(path.join(rootDir, 'src/ui/components/ConversationView.tsx'), 'utf-8');

    // deleteForEveryoneConfirm
    expect(convView).toMatch(/setDeleteForEveryoneConfirm\(null\)[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?setDeleteForEveryoneConfirm\(null\)/);

    // forwardingMessage
    expect(convView).toMatch(/setForwardingMessage\(null\)[\s\S]*?onTouchEnd=\{\(e\)\s*=>\s*\{[\s\S]*?setForwardingMessage\(null\)/);
  });

  it('Strict Phase 44a compliance: No raw literal Unicode emojis in modified modal files', () => {
    const targetFiles = [
      'src/ui/app/AppState.tsx',
      'src/ui/components/MessageComposer.tsx',
      'src/ui/components/ui/Modal.tsx',
      'src/ui/components/NewChatModal.tsx',
      'src/ui/components/NewGroupModal.tsx',
      'src/ui/components/ProfileModal.tsx',
      'src/ui/components/GroupDetailsModal.tsx',
      'src/ui/components/ContactDetailsModal.tsx',
      'src/ui/components/CreateSpaceModal.tsx',
      'src/ui/components/RestoreAccountModal.tsx',
      'src/ui/components/SettingsModal.tsx',
      'src/ui/components/AccountsAndSpacesModal.tsx',
      'src/ui/components/AppLockSetupModal.tsx',
      'src/ui/components/PermissionsModal.tsx',
      'src/ui/components/ui/AvatarCropModal.tsx',
      'src/ui/components/media/AttachmentPreviewModal.tsx',
      'src/ui/components/media/MediaGalleryModal.tsx',
      'src/ui/components/stickers/AddStickerPackModal.tsx',
      'src/ui/components/ui/EmojiPickerModal.tsx',
      'src/ui/components/ConversationView.tsx',
    ];

    // Regex matching raw literal astral plane emojis
    const rawEmojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const relPath of targetFiles) {
      const content = fs.readFileSync(path.join(rootDir, relPath), 'utf-8');
      // EmojiPickerModal and ConversationView have emoji data tables using escapes
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Skip comment lines if any
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
        const match = line.match(rawEmojiRegex);
        if (match) {
          throw new Error(`Raw emoji '${match[0]}' found in ${relPath}:${idx + 1}: ${line}`);
        }
      });
    }
  });
});
