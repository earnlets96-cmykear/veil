# CHANGELOG — VEIL Secure Messenger

All notable changes to the VEIL project are documented in this file.

## [1.0.0-phase32] - 2026-08-28

### Added
- **Pure SVG Vector Icon Suite**: Integrated over 35 stroke-based vector icons in `src/ui/components/icons/Icons.tsx` and exported via barrel `src/ui/components/icons/index.ts`. All raw Unicode emojis removed from interface controls.
- **Unified FileSaver Engine (`src/ui/utils/fileSaver.ts`)**:
  - Native Android storage using `@capacitor/filesystem` writing to `Directory.Documents/VEIL` and `@capacitor/share` fallback.
  - Web browser saving via `showSaveFilePicker` and anchor blob downloads.
  - Preserved E2EE pipeline: ciphertext retrieval -> authenticated reassembly -> local cryptographic decryption -> local file saving.
- **Telegram-Inspired Media Viewer (`src/ui/components/media/MediaViewer.tsx`)**:
  - Fullscreen photo & video viewer with 1x-4x smooth zoom, touch dragging, keyboard shortcuts, and direct save/share actions.
  - HTML5 video player with custom scrubber, play/pause controls, time display, and fullscreen toggle.
  - Gallery item index carousel navigation.
- **Shared Media Gallery Modal (`src/ui/components/media/MediaGalleryModal.tsx`)**:
  - In-conversation shared media browser with categorized tabs: Photos & Videos (3-column responsive grid), Files & Documents (file-type icons and metadata), and Voice Notes.
- **Pre-Send Attachment Preview Modal (`src/ui/components/media/AttachmentPreviewModal.tsx`)**:
  - Attachment staging overlay allowing inspection of pending files/images, optional captions, and individual file removal before encryption and sending.

### Changed
- **UI Primitives Modernization**:
  - `AttachmentCard`: SVG file-type icons (PDF, ZIP, Text, Audio, Video, Image) and interactive download/decrypting/ready states.
  - `VoiceNoteCard`: SVG playback controls, interactive waveform scrubber, and timer display.
  - `MessageStatus`: SVG Clock, Refresh, Single Check, Double Check (delivered & read), and AlertCircle icons.
  - `PasswordInput`: SVG Eye/EyeOff passphrase visibility toggle.
  - `SearchInput`: SVG SearchIcon and CloseIcon clear button.
  - `Toast`: Accessible `role="alert"` / `aria-live="assertive"` for errors, SVG icons, and auto-dismiss.
  - `Button` & `IconButton`: Accessible minimum 44px touch targets, busy spinners, and SVG icon slots.
- **Main Views & Modals**:
  - Modernized `LockScreen`, `Sidebar`, `ConversationView`, `MessageComposer`, `SettingsModal`, `ProfileModal`, `ContactDetailsModal`, `NewChatModal`, `NewGroupModal`, `GroupDetailsModal`, `CreateSpaceModal`, `RestoreAccountModal`, and `ErrorBoundary`.

### Fixed
- **Android File Download Drop Bug**: Fixed issue where WebView silently ignored `blob:` download links by implementing native file saving into device `Documents/VEIL` via Capacitor filesystem plugins.

### Verification
- 250 / 250 test suites passed (635 / 635 automated tests).
- Clean `npm run build:release` with verified SHA-256 release manifest.
- Clean Gradle debug APK build (`BUILD SUCCESSFUL in 4m 38s`).
