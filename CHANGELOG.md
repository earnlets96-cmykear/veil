# CHANGELOG — VEIL Secure Messenger

All notable changes to the VEIL project are documented in this file.

## [1.0.0-phase33] - 2026-08-28

### Added
- **In-Memory Decrypted Media Cache (`src/ui/utils/mediaCache.ts`)**:
  - Singleton `MediaCache` managing decrypted image/video buffers and ephemeral Blob URLs.
  - Zero-leakage memory lifecycle: automatically zeroizes and revokes all object URLs on Space Lock or Emergency Panic Lock.
- **Inline Decrypted Media Component (`src/ui/components/media/MediaImage.tsx`)**:
  - Automatic cloud ciphertext retrieval, cryptographic reassembly, and inline thumbnail rendering with smooth shimmer placeholder while decrypting.
  - Aspect ratio preservation, centered play badge for video attachments, and tap-to-fullscreen in `MediaViewer`.

### Changed
- **Settings Modal Visual Transformation (`src/ui/components/SettingsModal.tsx`)**:
  - Connected `{activeModal?.type === 'settings' && <SettingsModal />}` in `App.tsx` modal router.
  - Redesigned to match Telegram-inspired information architecture: Top Profile Header Card + clean grouped iOS/Telegram list rows with colored SVG icon badges (`badge-blue`, `badge-indigo`, `badge-emerald`, `badge-amber`, `badge-purple`, `badge-cyan`, `badge-rose`), subtitle value previews, and navigation chevrons.
- **Chat List & Sidebar Modernization (`src/ui/components/Sidebar.tsx`)**:
  - Added formatted relative timestamps (`14:22`, `Yesterday`, `Aug 26`).
  - Added SVG snippet indicators (`Photo`, `Video`, `File`, `Voice message`).
  - Glowing unread pill badge counter.
- **Conversation View & Bubbles (`src/ui/components/ConversationView.tsx`)**:
  - Embedded `<MediaImage />` inside message bubbles with floating bottom-right timestamps and delivery status checkmarks.
  - Connected `handleOpenMedia` directly to decrypted media items and byte buffers in `MediaViewer`.
- **Shared Media Gallery (`src/ui/components/media/MediaGalleryModal.tsx`)**:
  - Linked to real conversation media with `<MediaImage />` thumbnails and full `MediaViewer` playback.

### Verification
- 250 / 250 test suites passed (635 / 635 automated tests).
- Clean `npm run build:release` with verified SHA-256 release manifest.
- Clean Gradle debug APK build (`BUILD SUCCESSFUL in 17s`).
