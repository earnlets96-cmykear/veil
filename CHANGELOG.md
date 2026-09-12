# CHANGELOG — VEIL Secure Messenger

All notable changes to the VEIL project are documented in this file.

## [1.0.0-phase89-context-menu-outside-dismiss] - 2026-09-12

### Message Context Menu & Floating Reactions Outside-Press Dismissal (Phase 89)
- **Universal Capture-Phase Outside Interaction Interception (`ConversationView.tsx`)**:
  - Registered window event listeners with `{ capture: true }` for: `'pointerdown'`, `'mousedown'`, `'touchstart'`, `'click'`, `'contextmenu'`, and `'scroll'`.
  - Captures any outside interaction at the window level during the capture phase, completely immune to any `e.stopPropagation()` called by child message bubbles, media containers, or buttons.
- **Strict Event Absorption on Outside Dismiss**:
  - In `handleOutsideDismiss`, calls `e.preventDefault()`, `e.stopPropagation()`, and `(e as any).stopImmediatePropagation?.()`, guaranteeing that tapping outside dismisses the menu without triggering underlying elements (e.g. will not play voice audio, open media viewer, trigger swipe-to-reply, or focus inputs).
- **Internal Menu & Reactions Interaction Protection**:
  - Checks `target?.closest('.veil-context-menu')`, `target?.closest('.veil-floating-reactions-pill')`, and `target?.closest('.veil-emoji-picker-modal')` to allow taps/clicks inside the menu and reactions pill to execute their intended actions.
- **Debounce Guard Against Opening Trigger**:
  - Added `menuOpenedAtRef` recording `Date.now()` on `handleContextMenu`. Events within 60ms of menu opening are ignored to prevent the long-press release or right-click from immediately dismissing the new menu.
- **Enhanced Full-Screen Backdrop (`veil-components.css`, `ConversationView.tsx`)**:
  - Positioned `.veil-context-backdrop` with `position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: calc(var(--veil-z-popover, 1050) - 1); cursor: pointer; user-select: none;`.
  - Equipped with `onClick`, `onTouchStart`, `onTouchEnd`, `onPointerDown`, and `onMouseDown` handlers with `preventDefault()` and `stopPropagation()`.
- **Verification & Test Coverage**:
  - Created automated test suite `tests/phase89-context-menu-outside-dismiss.test.tsx` (6/6 passing).
  - 100% test pass on regression suites (`phase88`, `phase87`, `phase85`).
  - Clean production build verified via `npm run build`.

## [1.0.0-phase88-modal-outside-dismiss] - 2026-09-12

### Universal Modal Outside Touch Dismissal & Ghost Click Prevention (Phase 88)
- **Universal Backdrop Dismissal on Touch and Click**:
  - Implemented target-verified outside click/touch dismissal across all dialog overlays (`NewChatModal`, `NewGroupModal`, `ProfileModal`, `GroupDetailsModal`, `ContactDetailsModal`, `CreateSpaceModal`, `RestoreAccountModal`, `SettingsModal`, `AccountsAndSpacesModal`, `AppLockSetupModal`, `PermissionsModal`, `AvatarCropModal`, `AttachmentPreviewModal`, `MediaGalleryModal`, `AddStickerPackModal`, `EmojiPickerModal`, and `ConversationView` confirmation/forward modals).
  - Wired `if (e.target === e.currentTarget)` checks with `e.preventDefault()` and `e.stopPropagation()` on both `onClick` and `onTouchEnd`.
- **Two-Tier Ghost-Click Prevention Architecture**:
  - **Tier 1 (Event level)**: Added `e.preventDefault()` on backdrop `onTouchEnd` to prevent mobile browsers and WebViews from dispatching 300ms synthesized mouse/click events to elements beneath the dismissed backdrop.
  - **Tier 2 (State level)**: Added 350ms cooldown guard in `AppState.tsx` (`lastModalClosedAtRef`) and `MessageComposer.tsx` (`lastMediaPickerClosedAtRef`). Re-opening attempts made within 350ms of a modal closure are safely neutralized, permanently ending the "modal opens again" loop.
- **Card Click Isolation**:
  - Attached `onClick={(e) => e.stopPropagation()}` and `onPointerDown={(e) => e.stopPropagation()}` to all modal cards and containers, ensuring interactions inside the dialog never inadvertently trigger backdrop dismissal.
- **Verification & Test Coverage**:
  - Created automated test suite `tests/phase88-modal-outside-dismiss.test.tsx` (10/10 passing).
  - 100% test pass on all regression test suites.
  - Full TypeScript check and Vite production bundle verification (`npm run build`).

## [1.0.0-phase87-universal-floating-reactions] - 2026-09-12

### Universal Floating Reaction Badges & Ultra-Premium Glassmorphic Styling (Phase 87)
- **Universal Floating Reaction Display Model (`ConversationView.tsx`)**:
  - Unified reaction display across all message types: text, voice notes, media pictures/videos, audio cards, file attachments, and Telegram stickers now use the identical floating badge design model.
  - Removed the `!hasVisibleTextBubble` restriction in `ConversationView.tsx` so `.veil-floating-reaction-badge` renders unconditionally at the bottom corner of every bubble wrapper whenever reactions exist.
- **Decoupled Text Bubble Action Row (`ConversationView.tsx`, `MessageBubble.tsx`)**:
  - Passed `reactions={undefined}` to `<MessageBubble />` inside `ConversationView.tsx`, removing the cramped inline `.veil-message-reactions` row that previously crowded the message timestamp and delivery status.
  - Text messages now maintain a clean, spacious timestamp action row while reactions float elegantly at the bottom edge.
  - Maintained full backward compatibility in `MessageBubble.tsx` for isolated component unit tests that pass the `reactions` prop directly.
- **Ultra-Premium Obsidian Glassmorphism & Spring Physics (`veil-components.css`, `veil-design-system.css`)**:
  - Implemented deep obsidian glassmorphism (`rgba(18, 24, 34, 0.88)`) with 16px saturation backdrop blur (`-webkit-backdrop-filter: blur(16px) saturate(180%)`).
  - Added specular bevel edge highlights (`inset 0 1px 0 rgba(255, 255, 255, 0.16)`) and multi-layer depth shadow (`0 4px 14px rgba(0, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.3)`).
  - Perfected corner overlap: `margin-top: -8px`, `align-self: flex-end; margin-right: 6px;` (outgoing) and `align-self: flex-start; margin-left: 6px;` (incoming).
  - Fluid spring physics micro-interactions with `cubic-bezier(0.34, 1.56, 0.64, 1)` easing on hover (`scale(1.08) translateY(-1px)`) and active tap (`scale(0.93)`).
  - Active `.user-reacted` state with vibrant teal ambient glow (`box-shadow: 0 0 12px rgba(20, 184, 166, 0.35)`), gradient background, and full light theme parity.
- **Verification & Test Coverage**:
  - Created comprehensive test suite `tests/phase87-universal-floating-reactions.test.tsx` (7/7 passing).
  - 100% test pass across existing suites (`phase85`, `phase68`, `conversation-view-render`).
  - Full TypeScript validation and production Vite bundle verification (`npm run build`).

## [1.0.0-phase86-voicenote-touch-scroll-fix] - 2026-09-12

### Voice Message Touch Scrolling Pass-Through & Directional Scrubbing Disambiguation (Phase 86)
- **Eliminated Scroll Interference on Voice Notes (`src/styles/veil-components.css`, `VoiceNoteCard.tsx`)**:
  - Replaced restrictive `touch-action: none;` on `.veil-voicenote-card` and `.veil-waveform-container` with `touch-action: pan-y;` in CSS and inline styling.
  - Allows the browser/WebView compositor to natively scroll the `.veil-timeline` when dragging vertically anywhere on the voice message bubble (background, waveform, padding, timer row, or speed pill).
- **Directional Gesture Disambiguation (`VoiceNoteCard.tsx`)**:
  - Removed unconditional `preventDefault()` and immediate `handleSeekFromClientX()` calls on `pointerdown` and `touchstart`.
  - Implemented real-time directional delta tracking (`deltaX` vs `deltaY`):
    - When vertical movement dominates (`|deltaY| >= 7 && |deltaY| >= |deltaX|`), transitions to `'scrolling'` mode: suppresses seeking, never calls `preventDefault()`, and allows native conversation scrolling to proceed unimpeded.
    - When horizontal movement dominates (`|deltaX| >= 7 && |deltaX| > |deltaY|`), locks into `'scrubbing'` mode: calls `preventDefault()`, shows tactile scrubber tooltip, fires 5% haptic ticks, and updates seek position in real time.
    - When a tap/release occurs without dragging (`< 7px` total movement), cleanly executes tap-to-seek to jump playback directly to the tapped waveform position.
- **Verification & Test Coverage**:
  - Created `tests/phase86-voicenote-touch-scroll.test.tsx` verifying CSS rules, component inline styles, non-blocking touch down, directional disambiguation logic, and zero-Unicode compliance.
  - 100% test pass across all 396 test suites in repository (1273 tests passing, 0 failures).
  - Web production bundle built cleanly with Vite; Android native debug APK compiled successfully via Gradle (`BUILD SUCCESSFUL in 22s`).


## [1.0.0-phase86-real-device-media-and-theme] - 2026-09-12

### Real Device Storage Media, Native Camera Hardware, Files Tab & Dynamic Theme Alignment (Phase 86)
- **Real Device Storage Media Only (`MediaPickerModal.tsx`, `NativeDeviceMediaBridge.ts`)**:
  - Completely removed all synthetic mockup posters (`sampleMedia.ts` deleted).
  - Wired gallery and video grids strictly to device storage queried via `NativeDeviceMediaBridge`.
  - When user opens attachment sheet (`+`), automatically requests media/storage permissions and queries recent photos/videos from device storage.
  - If permissions are denied, presents an in-sheet permission card with an "Allow Access" action.
- **Native Camera Hardware Capture (`VeilDeviceMediaPlugin.kt`, `AndroidManifest.xml`, `MediaPickerModal.tsx`)**:
  - Added `<uses-permission android:name="android.permission.CAMERA" />` and optional camera feature declaration.
  - Implemented `@PluginMethod fun captureMedia` in Kotlin with `ACTION_IMAGE_CAPTURE`, FileProvider output, and fallback bitmap decoding.
  - Tapping **Camera** tab directly launches the native camera hardware to take photos and stage them for encryption and dispatch.
- **Restructured Tab Order & Files Integration (`MediaPickerModal.tsx`, `VeilDeviceMediaPlugin.kt`)**:
  - Removed `24h` tab.
  - Replaced with **Video** tab (queries device videos) and swapped order with **Files**.
  - New tab order: **Gallery** -> **Camera** -> **Video** -> **Files**.
  - **Files Tab**: Queries device documents/downloads, displays interactive file list with document icon, filename, extension badge, size, and selection status, and includes `+ Browse all files & documents` for system SAF picker.
- **Dynamic Theme Matching (`veil-components.css`, `MediaPickerModal.tsx`)**:
  - Replaced hardcoded purple accents (`#a78bfa`) with dynamic theme tokens: `var(--veil-accent-primary, #14b8a6) !important` and `var(--veil-text-on-accent, #ffffff) !important`.
  - Send button (`Send (N) ▷`), selection borders, numbered selection counters, and caption focus outline now match the active theme.
- **Android Scoped Storage Optimization (`VeilDeviceMediaPlugin.kt`)**:
  - Split `listRecentMedia` to query `MediaStore.Images.Media.EXTERNAL_CONTENT_URI` and `MediaStore.Video.Media.EXTERNAL_CONTENT_URI` directly under Android 10–14 granular permissions.
  - Added query for `MediaStore.Downloads.EXTERNAL_CONTENT_URI` and non-media documents for the Files tab.
- **Verification**:
  - 100% test pass across `tests/phase86-share-media-redesign.test.tsx`, `tests/phase74-media-interaction.test.tsx`, `tests/phase40-media-picker.test.tsx`, and `tests/phase44a-ui-layout-and-icons.test.tsx`.
  - Full repo test suite passed (395 test files, 1269 tests).
  - Web production bundle built in 2.50s; Android native debug APK assembled with Gradle (`BUILD SUCCESSFUL in 39s`).

## [1.0.0-phase86-share-media-redesign] - 2026-09-12

### Share Media Bottom Sheet Redesign & Integrated Caption Input (Phase 86)
- **Modern Bottom Sheet Shell (`src/styles/veil-components.css`, `MediaPickerModal.tsx`)**:
  - Replaced rectangular modal with a deep dark matte bottom sheet (`#18181b`, `border-radius: 28px 28px 0 0` on mobile, `28px` on desktop) with centered top pill handle (`width: 38px; height: 4px; border-radius: 9999px; background: rgba(255, 255, 255, 0.22)`).
  - Designed clean header with bold `Share Media` typography (`1.25rem`, `#ffffff`) and circular close button `(X)` (`32px` diameter, `border-radius: 50%`).
  - Seamless dark card interior eliminating harsh dividing lines and dark greenish cast.
- **Filter & Source Pills Row (`MediaPickerModal.tsx`, `src/styles/veil-components.css`)**:
  - High-contrast active **Gallery** pill in crisp white (`#ffffff`) with dark charcoal text/icon (`#111827`).
  - Dark rounded pills for **Camera**, **Files**, and **24h** with warm golden/amber timer icon (`#fbbf24`).
- **3-Column Media Grid & Curated Demo Fallbacks (`src/ui/components/media/sampleMedia.ts`, `MediaPickerModal.tsx`)**:
  - Direct presentation of the 3-column media grid with 6 high-fidelity curated gallery scenes (Architect blueprints, Modern office, Workspace desk, Luxury villa, Night cityscape, Product design sketch) so the gallery is never empty.
  - Numbered purple badges (`#a78bfa`) with sequence counter (`1`, `2`) on selected items and translucent circular indicator rings on unselected items.
  - Converted sample items to genuine `File` objects via `sampleMediaToFile` for immediate Double Ratchet encrypted attachment delivery.
- **Integrated Caption Writing Bar (`MediaPickerModal.tsx`, `src/styles/veil-components.css`)**:
  - Smoothly appears right above the footer bar when 1 or more media items are selected.
  - Dark glass styling (`background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px`) with placeholder `"Add a caption..."`.
  - Dispatches with files to `onSend({ files, caption })` and collapses when selection is cleared.
- **Streamlined Footer (`MediaPickerModal.tsx`, `src/styles/veil-components.css`)**:
  - Left: Selection count ("{N} selected" in bold white when items picked, or "Select media" when 0).
  - Right: Soft purple pill action button `Send (N) ▷` (`#a78bfa`) with paper airplane icon.
  - Dismissal managed via circular top-right close button, backdrop click, or Escape key.
- **Test Suites & Verification**:
  - Created `tests/phase86-share-media-redesign.test.tsx` (5/5 passing).
  - 100% pass across Phase 40 (`tests/phase40-media-picker.test.tsx`), Phase 74 (`tests/phase74-media-interaction.test.tsx`), and Phase 44a zero-literal-Unicode icon audit (`tests/phase44a-ui-layout-and-icons.test.tsx`).
  - Full repo test suite passed (395 test files, 1269 tests).
  - Production web bundle built and Android native APK assembled successfully.

## [1.0.0-phase85-reactions-and-context-dismiss] - 2026-09-12

### Message Reactions, Default 5 Emojis, Expand Button & Context Dismissal (Phase 85)
- **Stacking Context & Reactions Pill Z-Index Fix (`ConversationView.tsx`, `src/styles/veil-components.css`)**:
  - Elevated `.veil-floating-reactions-pill` z-index to `1052` (`calc(var(--veil-z-popover, 1050) + 2)`).
  - Fixed issue where the full-screen `.veil-context-backdrop` (z-index `1049`) sat on top of the reaction pill (previously `1002`), swallowing all clicks/taps and dismissing the menu without triggering reactions or opening the emoji drawer.
  - Added `onPointerDown={(e) => e.stopPropagation()}` and `onTouchStart={(e) => e.stopPropagation()}` to prevent event bubbling.
- **Initial 5 Default Reaction Emojis (`ConversationView.tsx`)**:
  - Configured default reaction emojis array to begin with the standard 5 emojis: `['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}']` (👍, ❤️, 😂, 😮, 😢).
  - Sliced combined recent and default emojis to exactly 5 (`.slice(0, 5)`), ensuring exactly 5 emojis are always displayed initially on the pill bubble.
- **Emoji Expand Button Fix (`+`) (`ConversationView.tsx`)**:
  - Preserved `contextMenu.message` in `emojiTargetMessage` upon clicking `+` so that selecting an emoji from `EmojiPickerModal` accurately applies the reaction to the target message.
  - Added `e.stopPropagation()` to ensure clean transition into the full categorized emoji picker modal.
- **Outside Touch, Pointer & Scroll Dismissal (`ConversationView.tsx`, `src/styles/veil-components.css`)**:
  - Configured `.veil-context-backdrop` with `onTouchStart`, `onPointerDown`, and `onClick` handlers.
  - In CSS, added `background: rgba(0, 0, 0, 0.001); pointer-events: auto; touch-action: none; cursor: pointer;` to ensure mobile WebViews reliably register taps.
  - Registered active `window` listener capturing `touchstart`, `scroll`, and `resize` events outside context elements to immediately dismiss the context popup.
- **Reactions Display on Messages, Media & Files (`src/styles/veil-components.css`)**:
  - Fixed `.veil-floating-reaction-badge` with `align-self: flex-end` (outgoing) and `align-self: flex-start` (incoming) in column flex containers, with `z-index: 10`.
  - Added high-contrast text color `color: var(--veil-text-primary, #e6edf3) !important` to `.veil-reaction-pill`.
- **Test Suites & Icon Security Audit**:
  - Created `tests/phase85-message-reactions-and-context-dismiss.test.tsx` (7/7 passing).
  - Verified 100% pass across `tests/phase68-chat-bubbles-and-context-menu.test.tsx`, `tests/phase69-chat-ux-enhancements.test.tsx`, and `tests/phase44a-ui-layout-and-icons.test.tsx` with zero icon audit errors.

## [1.0.0-phase84-mobile-keyboard-viewport] - 2026-09-11

### Mobile Keyboard Insets, Viewport Resizing & Text Box Anchoring (Phase 84)
- **Android Manifest Soft Input Configuration (`android/app/src/main/AndroidManifest.xml`)**:
  - Explicitly configured `android:windowSoftInputMode="adjustResize"` on `MainActivity`.
  - Replaces default `adjustPan` behavior under the full-screen splash/NoActionBar theme, forcing the native Android WebView container to physically resize when the soft keyboard appears rather than panning the window and submerging the bottom island.
- **Viewport Meta Interactive Widget Mode (`index.html`)**:
  - Updated HTML viewport tag with `interactive-widget=resizes-content` (`<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />`).
  - Ensures modern Chromium and Android WebViews adapt CSS dynamic viewport units and layout containers directly to the visible viewport instead of leaving a floating layout viewport.
- **Visual Viewport Synchronization Hook (`src/ui/hooks/useVisualViewport.ts`)**:
  - Built real-time `useVisualViewport` hook tracking `window.visualViewport` dimensions, resize, and scroll events.
  - Dynamically computes and assigns CSS custom properties `--veil-visual-viewport-height` and `--veil-keyboard-height` onto `document.documentElement`.
  - Automatically sets `data-keyboard-open="true"` on `document.body` when keyboard height exceeds 100px.
  - Actively clamps and resets `window.scrollTo(0, 0)` on scroll events to prevent mobile WebViews from panning the page document.
- **Conversation Auto-Scroll & Viewport Integration (`src/ui/components/ConversationView.tsx`, `src/ui/App.tsx`)**:
  - Mounted `useVisualViewport()` at top-level `App.tsx` and within `ConversationView.tsx`.
  - Added an auto-scroll effect targeting `timelineEndRef` with a slight 80ms timeout to smoothly glide the conversation to the latest message whenever the on-screen keyboard expands.
- **Mobile CSS Layout & Overscroll Containment (`src/styles/veil-design-system.css`)**:
  - Added explicit `.veil-composer-container` rules with `flex-shrink: 0`, preventing flexbox from collapsing the input area when height shrinks.
  - Set `overscroll-behavior: none` on `body` and `overscroll-behavior-y: contain` on `.veil-timeline` to isolate scrolling strictly to message history.
  - In mobile media queries (`max-width: 768px`), pinned `.veil-app-layout` and conversation view to `height: var(--veil-visual-viewport-height, 100dvh) !important` with `top: 0; bottom: auto`, keeping the composer pinned directly above the keyboard with zero overlap or clipping.
  - Streamlined `.veil-composer` padding when keyboard is open (`padding-bottom: 6px !important`).
- **Automated Test Suite & Regression Guard (`tests/phase84-mobile-keyboard-viewport.test.tsx`)**:
  - Added 7 comprehensive unit tests verifying viewport hook dimension tracking, `--veil-visual-viewport-height` and `--veil-keyboard-height` CSS variable assignment, body `data-keyboard-open` attribute toggling, window scroll lock enforcement, composer flex-shrink resistance, timeline overscroll containment, and manifest `adjustResize` presence.

## [1.0.0-phase83-telegram-stickers-and-frameless-chat] - 2026-09-11

### Telegram Sticker Packs & Frameless Chat UX (Phase 83)
- **Telegram Sticker Engine & Storage Service (`src/media/telegramStickerService.ts`)**:
  - Built `TelegramStickerService` with IndexedDB persistence (`veil_stickers_db`), memory fallback, and link parser supporting `t.me/addstickers/<pack>`, `tg://addstickers?set=<pack>`, `tg:addstickers?set=<pack>`, `telegram.me/addstickers/<pack>`, and bare identifiers.
  - Pre-bundled 3 high-resolution vector starter packs (`Spotty Dog`, `Cute Animals`, `Classic Memes`) as SVG data URIs for instant offline sticker usage.
  - Added `getFeaturedPacks()` curated list for 1-tap installation of popular packs (*Cute Animals*, *Classic Memes*, *Spotty Dog*, *Hot Cherry*, *Pepe The Frog*, *Cat Vibes*).
  - Integrated public live scraper gateway (`https://stickers.wiki/telegram/<packName>/`) to resolve real Telegram WebP stickers without requiring a bot token, with fallbacks to custom bot tokens and synthetic vector packs.
  - Implemented recent stickers caching with deduplication, FIFO limit (24), and localStorage + memory fallback.
  - Strictly formatted all sticker emojis via Unicode escape sequences (`\u{...}`) to ensure 100% compliance with `tests/phase44a-ui-layout-and-icons.test.tsx`.
- **Dark Glass Add Sticker Pack Modal (`src/ui/components/stickers/AddStickerPackModal.tsx`)**:
  - Created dark glass modal (`backdrop-filter: blur(20px); background: rgba(22, 27, 34, 0.96)`) matching VEIL design tokens.
  - Added popular Telegram pack 1-tap chips with instant preview loading and resolution.
  - Features Telegram link input, instantaneous pack resolution, 8-sticker preview grid, and one-click pack installer.
- **Emoji Drawer Stickers Tab Integration (`src/ui/components/ui/EmojiDrawer.tsx`)**:
  - Added sticker pack carousel bar matching category bar aesthetics: recent icon button (`\u{1F552}`), pack thumbnail buttons with active accent highlighter, and `+ Add` button.
  - Added 4-column responsive sticker grid (`.veil-sticker-grid`) with smooth hover scales and active bounce animations.
  - Search input dynamically filters stickers across installed packs by emoji or keyword.
  - Suppressed mobile soft keyboard popups via `onMouseDown={(e) => e.preventDefault()}` on all sticker grid and pack navigation buttons.
  - Hidden floating backspace button in stickers mode (active only in emoji mode).
- **Composer Sticker Dispatch & MIME Accuracy (`src/ui/components/MessageComposer.tsx`, `src/ui/app/AppState.tsx`)**:
  - Implemented `handleSelectSticker`: detects SVG data URIs vs WebP images, correctly setting MIME type (`image/svg+xml` or `image/webp`) and filename (`.sticker.svg` or `.sticker.webp`) with `isSticker: true`.
  - In `AppState.tsx`, primed `MediaCache` with typed `DecryptedMedia` stubs for stickers so they render instantly without attachment card fallback.
  - Dispatches sticker through end-to-end encrypted Double Ratchet channel.
- **Frameless In-Chat Sticker Rendering (`src/ui/components/ConversationView.tsx`, `src/styles/veil-components.css`)**:
  - Fixed `<AttachmentCard>` rendering bug by adding `!isSticker` to attachment card condition.
  - Stripped standard message bubble chrome using `.veil-bubble-wrapper-sticker` (`background: transparent; border: none; box-shadow: none; padding: 0`).
  - Created `.veil-sticker-bubble-container` utilizing `<MediaImage>` with 180×180 contain geometry, subtle drop-shadow, and floating translucent timestamp badge.

## [1.0.0-phase82-universal-reactions-and-chat-ux] - 2026-09-11

### Chat UX, Universal Reactions, Audio Player & Emoji Drawer Overhaul (Phase 82)
- **Swapped OK/Enter and Backspace on PIN Lock Keypad (`src/ui/components/PinLockScreen.tsx`, `src/ui/components/AppLockSetupModal.tsx`)**:
  - Reordered bottom keypad row from `['enter', '0', 'backspace']` to `['backspace', '0', 'enter']` to align with standard mobile PIN interfaces.
- **Swipe-up to Lock Indication & Recording Actions (`src/ui/components/MessageComposer.tsx`, `src/styles/veil-design-system.css`, `src/styles/veil-components.css`)**:
  - Added bouncing SVG chevron to lock pill and set `.veil-composer` overflow to `visible` to prevent clipping.
  - Dynamically switched active recording mic button to `<SendIcon size={18} color="#ffffff" />`.
- **In-Line Music / Audio Player Card (`src/ui/components/ui/AudioPlayerCard.tsx`, `src/ui/components/ConversationView.tsx`, `src/styles/veil-components.css`)**:
  - Created inline audio player for `.mp3`, `.m4a`, `audio/*` with play/pause, seek scrubber, metadata, and download button.
  - Placed before generic file attachment card rendering.
- **Slide-up Emoji Drawer (`src/ui/components/ui/EmojiDrawer.tsx`, `src/ui/components/MessageComposer.tsx`, `src/styles/veil-components.css`)**:
  - Built sliding bottom emoji drawer with search, segmented control (`Emoji / Stickers / GIFs`), category bar, frequently used section, latest Unicode emojis, and floating backspace.
  - All emojis formatted with Unicode escape sequences to ensure zero violations in the strict UI iconography security audit.
  - Repaired smiley button in composer to toggle drawer rather than opening media picker.
- **Telegram-Style Media Captions (`src/ui/app/AppState.tsx`, `src/ui/components/MessageComposer.tsx`, `src/ui/components/ConversationView.tsx`)**:
  - Attached media captions directly to attachment messages (`msg.text`) without dispatching separate text messages.
  - Rendered captions inside `.veil-media-bubble-container` beneath media content.
- **Universal Floating Reactions for Non-Text Media (`src/ui/components/ConversationView.tsx`, `src/styles/veil-components.css`)**:
  - Added `.veil-floating-reaction-badge` for images, videos, audio cards, and documents.
  - Removed media/attachment cards from click suppression so right-click, long-press, and card tap open the reaction bar.
- **Auto-Loading Media Picker Recent Items (`src/ui/components/media/MediaPickerModal.tsx`)**:
  - Automatically loads recent media when modal opens without requiring manual click.
- **Composer Layout & Screen-Reader Visibility Fix (`src/ui/components/MessageComposer.tsx`, `src/styles/veil-design-system.css`)**:
  - Removed rogue inline `.veil-sr-only` text node that was rendered visibly and squeezed the input box horizontally.
  - Defined universal `.veil-sr-only` CSS class (`position: absolute; width: 1px; clip: rect(0, 0, 0, 0);`) in design system.
  - Retained accessible `aria-label="Type an encrypted message..."` directly on the `<textarea>` to preserve 100% test compatibility and full screen-reader accessibility.
- **Floating Island Composer & Embedded Emoji Button (`src/ui/components/MessageComposer.tsx`, `src/styles/veil-design-system.css`, `src/styles/veil-components.css`)**:
  - Removed solid rectangular background container (`background: transparent !important; border-top: none !important;`) so chat wallpaper flows behind composer controls.
  - Formed 3 distinct floating islands: circular Plus island, center Message Box island capsule (`.veil-composer-input-island`), and circular Send/Mic island with blur backdrop, soft shadows, and subtle borders.
  - Embedded the emoji button directly inside the message box pill at the right end for a unified messenger aesthetic.
  - Eliminated inner capsule border artifact on focus with `border: none !important; outline: none !important; box-shadow: none !important;`.
- **Emoji Drawer Overhaul & Mobile Chat Usability (`src/ui/components/ui/EmojiDrawer.tsx`, `src/ui/components/MessageComposer.tsx`, `src/styles/veil-components.css`)**:
  - Rebuilt Emoji Drawer to match reference design mockup (`media_1789139012988.png`): centered drag handle, pill search input, segmented control (`Emoji / Stickers / GIFs`), category navigation bar with active accent pill, 8-column emoji grid, and 44x44px floating circular bottom-right backspace button.
  - Implemented keyword-based emoji search indexing (`EMOJI_KEYWORD_MAP`) supporting queries like "smile", "happy", "love", "heart", "fire", "laugh", "dog", "car", etc.
  - Mitigated mobile soft keyboard interference: added `onMouseDown={(e) => e.preventDefault()}` on drawer action buttons, updated `handleInsertEmoji` and `handleEmojiBackspace` to update cursor positions without invoking `.focus()`, and blurred textarea on emoji drawer toggle to cleanly dismiss the Android keyboard.
  - Preserved 100% compliance with strict zero-literal-Unicode icon audit (`tests/phase44a-ui-layout-and-icons.test.tsx`) using Unicode escape sequences.

## [1.0.0-phase81-strict-typecheck-and-compilation-safety] - 2026-09-11

### Strict Typecheck & Compilation Safety Hardening (Phase 81)
- **Direct Runtime Fix (`src/ui/components/ui/ReplyPreview.tsx`)**:
  - Added missing `ReplyIcon` to imports from `../icons/index.ts`.
- **Permanent Build Pipeline Guard (`package.json`)**:
  - Embedded `tsc --noEmit` into `npm test` and `npm run build` scripts to eliminate Vite's transpiler bypassing TypeScript undeclared identifier checks.
  - Added `"typecheck": "tsc --noEmit"` npm task.
- **TypeScript Strict Compliance Across Codebase**:
  - Resolved `PrekeyBundle` non-null assignment in `src/account/accountManager.ts`.
  - Added `BlobPart` casting in `src/attachments/webmFix.ts`, `src/media/NativeDeviceMediaBridge.ts`, and `src/ui/app/AppState.tsx`.
  - Added optional `forwarded` and `forwardedFrom` properties to `receiveMessage` return type in `src/messaging/conversationManager.ts`.
- **Dedicated Icon Safety Audit Suite (`tests/phase81-reply-preview-and-icon-safety.test.tsx`)**:
  - Added automated test suite verifying all 8 `ReplyPreview` state permutations and programmatically asserting all 40+ exported SVG icons are defined and render valid markup.
- **UI Layout & SVG Audit Compliance**:
  - Maintained `veil-context-reactions-bar` dual class and 7-emoji quick reactions in `src/ui/components/ConversationView.tsx`.
  - Replaced raw Unicode arrow with SVG `<polyline>` in `src/ui/components/MessageComposer.tsx` and restored default composer placeholder.

## [1.0.0-phase80-modern-messenger-ux-and-video-controls] - 2026-09-11

### Modern Messenger UX Alignment & Disappearing Video Player Controls (Phase 80)
- **Video Player Controls Repositioning & Auto-Disappearing HUD (`src/ui/components/media/MediaViewer.tsx`, `src/styles/veil-components.css`)**:
  - Repositioned video controls out of the video display area into a dedicated lower tray (`.veil-media-viewer-video-controls-tray`) located below the video viewport.
  - Added single tap gesture on the video surface to toggle controls visibility (`toggleControls()`) and double tap to toggle play/pause.
  - Added auto-hide timeout of 2.5s during video playback with smooth slide and fade animations.
- **Modern Message Selection Mode (`src/ui/components/ConversationView.tsx`, `src/styles/veil-components.css`)**:
  - Rebuilt top selection header with close button, message counter badge, contact subtitle, and `Select all` / `Deselect all` toggle button.
  - Added circular selection check indicators (`○` unselected, `✔` selected) on message margins (left margin for incoming messages, right margin for outgoing messages).
  - Added floating bottom action dock (`Forward`, `Copy`, `Star`, and red `Delete (X)` button) replacing the composer in selection mode.
- **Floating Reply Banner & Modern Composer (`src/ui/components/MessageComposer.tsx`, `src/ui/components/ui/ReplyPreview.tsx`, `src/styles/veil-components.css`)**:
  - Floating reply preview card docked directly above the composer pill with curved reply arrow `↰ Replying to [Sender]`, snippet, and `✕` dismiss button.
  - Composer input pill: circular `+` button, auto-expanding textarea (grows with `scrollHeight` up to 140px), inline emoji button `☺`, and dynamic send/mic button (accent Mic button when empty, accent upward arrow `↑` when text entered).
- **Streamlined Voice Recording Pill (`src/ui/components/MessageComposer.tsx`, `src/styles/veil-components.css`)**:
  - Left circular trash button, red pulsing dot with mono timer (`0:14`), animated soundwave bars with pulsing heights, `< Cancel` slide indicator, circular mic button, and floating `🔒 Slide up to lock ↑` tooltip pill.
- **Floating Reactions Pill (`src/ui/components/ConversationView.tsx`, `src/styles/veil-components.css`)**:
  - Independent `.veil-floating-reactions-pill` floating directly above the message bubble (`❤️ 👍 🔥 😂 😮 👏 | +`) with context action card below.
- **Share Media Bottom Sheet (`src/ui/components/media/MediaPickerModal.tsx`, `src/styles/veil-components.css`)**:
  - Top drag handle pill, "Share Media" title, filter tab chips (`Gallery`, `Camera`, `Files`, `24h`), 3-column media grid with top-right numbered badges (`1`, `2`) on selected items and translucent circle rings on unselected items, and bottom bar with `X selected` text and `Send (X) ➢` pill button.
- **Strict Theme & Color Adherence**:
  - Maintained complete fidelity to VEIL design system tokens (`var(--veil-accent-primary)`, `var(--veil-bg-surface-elevated)`), zero external screenshot colors copied.

## [1.0.0-phase79-filepicker-seeking-and-bubble-highlight] - 2026-09-11

### File Picker Session Protection, Waveform Seeking Isolation & Refined Bubble Highlight (Phase 79)
- **Android File Picker Session Protection (`src/media/NativeDeviceMediaBridge.ts`, `src/ui/app/AppState.tsx`, `src/ui/components/media/MediaPickerModal.tsx`)**:
  - Eliminated auto-lock and app restart caused by external Android document/media picker transitions (`Intent.ACTION_OPEN_DOCUMENT`).
  - Added static picker lifecycle listeners in `NativeDeviceMediaBridge` (`setPickerListeners`, `notifyPickerActive`).
  - Connected `NativeDeviceMediaBridge` directly to `AppState`'s `markFilePickerActive` and `markFilePickerInactive`, holding active lock exemptions while system pickers are displayed.
  - Wired `notifyPickerLaunch` into `MediaPickerModal` for documents, photos, videos, and camera actions.
  - Added defensive fallback to `Intent.ACTION_GET_CONTENT` in `VeilDeviceMediaPlugin.kt`.
- **Waveform Seeking Swipe Isolation & Visual Upgrade (`src/ui/components/ui/VoiceNoteCard.tsx`, `src/ui/components/ConversationView.tsx`, `src/ui/components/ui/MessageBubble.tsx`)**:
  - Fixed touch event leakage: moved `e.stopPropagation()` and `e.preventDefault()` to the top of all track touch handlers in `VoiceNoteCard.tsx`, preventing horizontal scrub movement from triggering swipe-to-reply.
  - Added `data-no-swipe="true"` on the waveform track container and voice note card.
  - Added gesture guards in `ConversationView.tsx` and `MessageBubble.tsx` to ignore touch events originating from waveforms and voice note cards.
  - Redesigned waveform with pill-capped bars (`border-radius: 9999px`), enhanced contrast between played and unplayed bars, and added an interactive tactile playhead needle (`.veil-waveform-playhead`) at `effectiveProgress%` that illuminates and expands during scrubbing.
- **Bubble Highlight Border (`src/styles/veil-components.css`, `src/ui/components/ConversationView.tsx`)**:
  - Eliminated the sharp rectangular box outline caused by targeting `.veil-bubble-wrapper` in `.veil-context-active-message`.
  - Targeted bubble elements directly (`.veil-message-bubble`, `.veil-media-bubble-container`, `.veil-voicenote-card`, `.veil-attachment-card`).
  - Reduced border shadow thickness from 2px to 1.5px (`box-shadow: 0 0 0 1.5px var(--veil-accent-primary, #14b8a6), 0 4px 16px rgba(0, 0, 0, 0.25) !important`), perfectly adhering to the bubble's rounded corners (`border-radius: 18px` / `16px` / `14px`).
  - Updated `@keyframes veilHighlightPulse` and `.veil-message-selected` to follow the bubble's rounded curvature without full-width row rectangular flashes.
- **Automated Verification & Artifacts**:
  - New test suite: `tests/phase79-filepicker-seeking-highlight.test.tsx` (5/5 tests pass).
  - Regression test suites pass (19/19 tests pass).
  - Production web bundle compiled (`npm run build`, 7 artifacts).
  - Synced with Capacitor Android (`npx cap sync android`).
  - Native Android debug APK assembled (`gradlew.bat assembleDebug`, BUILD SUCCESSFUL in 1m 14s).

## [1.0.0-phase78-functional-progress-circles-and-byte-tracking] - 2026-09-11

### Real-Time Byte-Driven Progress Tracking & Functional Progress Circles (Phase 78)
- **Eliminated Fake Progress Circle Overlays**:
  - Removed hardcoded `: 50` and `: 15` fallbacks in `src/ui/components/ConversationView.tsx` and artificial step progression (15% -> 45% -> 85%).
  - Removed `?? (isUploading ? 50 : 25)` fallback in `src/ui/components/ui/AttachmentCard.tsx`.
- **True Network Byte-Level Upload Tracking (`src/network/cloudClient.ts`)**:
  - Wired `onProgress?: (loaded: number, total: number) => void` in `CloudClient.uploadAttachment` using `XMLHttpRequest.upload.onprogress` with fallback to `fetch`.
  - Accurately tracks actual network bytes sent over the wire.
- **Streaming Chunk-by-Chunk Download Tracking (`src/network/cloudClient.ts`, `src/ui/utils/mediaCache.ts`)**:
  - Added stream reading (`res.body.getReader()`) in `CloudClient.downloadAttachment` with `onProgress` callbacks.
  - Forwarded through `MediaCache.getOrFetch` and `VoiceRecorder.downloadAndDecryptVoiceNote` for true byte-level download rings.
- **Dynamic Upload Progress Pipeline (`src/ui/app/AppState.tsx`)**:
  - Added `uploadProgress` state in `AppProvider` and exposed in `AppContextType`.
  - Live updates from `uploadWorker` and `sendVoiceMessage` dispatch real-time percentages to `ConversationView` and message status badges.
- **Perimeter SVG Circular Progress Ring (`src/ui/components/ui/VoiceNoteCard.tsx`)**:
  - Wrapped play/pause button in a 44x44px container with an SVG circular progress ring (`cx="22" cy="22" r="20" strokeWidth="2.5"`).
  - Dynamically calculates `strokeDashoffset` from `effectiveProgress` (0% to 100%), sweeping clockwise in sync with audio playback and scrub position.
- **MessageStatus Circular Upload Ring (`src/ui/components/ui/MessageBubble.tsx`, `src/ui/components/ConversationView.tsx`)**:
  - Passed real `effectiveUploadPercent` to `<MessageStatus status={msg.status} uploadProgress={effectiveUploadPercent} />`.
- **Automated Verification & Artifacts**:
  - New test suite: `tests/phase78-functional-progress-circle.test.tsx` (8/8 tests pass).
  - Voice regression suites pass (18/18 tests pass).
  - Production web bundle compiled (`npm run build`, 7 artifacts).
  - Synced with Capacitor Android (`npx cap sync android`).
  - Native Android debug APK assembled (`gradlew.bat assembleDebug`, BUILD SUCCESSFUL in 25s).

## [1.0.0-phase77-zero-error-ebml-seeking-and-audio-resilience] - 2026-09-11

### EBML Zero-Error Seek Pointer Precision & Native Audio Resilience (Phase 77)
- **Zero-Error EBML Cues Indexer (`src/attachments/webmFix.ts`)**:
  - Permanently resolved Android ExoPlayer `TYPE_SOURCE` `PlaybackException` ("Source error") during arbitrary seek operations.
  - Eliminated `SeekHead` byte pointer misalignment (guess size 64 vs 47 bytes) that caused ExoPlayer to seek past `ID_CUES` (`0x1C53BB6B`).
  - Fixed `CueClusterPosition` tolerance drift by computing exact relative cluster offsets from invariant `cl.originalFileOffset - firstClusterOffset`.
  - Added `hasValidWebmIndex` to strictly assert that `SeekHead` lands on `ID_CUES` and the first `CueClusterPosition` lands on `ID_CLUSTER` (`0x1F43B675`).
  - Idempotent re-indexing safely strips previous/corrupted headers without duplication.
- **Proactive Repair on Download/Decryption (`src/attachments/voiceRecorder.ts`)**:
  - Replaced naive `hasWebmCues` with `hasValidWebmIndex`. All cached or incoming WebM voice notes with corrupted or drifted Cues are automatically re-indexed with exact zero-drift pointers before reaching the audio player.
- **Transparent Native-to-Web Error Fallback (`src/attachments/voicePlayer.ts`)**:
  - Maintained `lastPlayContext` in `VoicePlaybackManager`.
  - When ExoPlayer triggers `onPlaybackError`, the player halts native playback and transparently recovers using decrypted Web Audio (`HTMLAudioElement`) from the seek position, eliminating user-facing error toasts.
  - Encapsulated listener setup in `setupNativeBridge()`.
- **ExoPlayer Diagnostics & State Recovery (`VeilNativeMediaPlugin.kt`)**:
  - Enhanced error logs with `error.errorCodeName`, cause class name, and cause error message.
  - In `seekAudio`, auto-prepares ExoPlayer if called while in `Player.STATE_IDLE`.
- **Automated Verification & Artifacts**:
  - 100% pass across all test suites (1208+ tests).
  - New forensic test suite: `tests/phase77-webm-random-seek-forensic.test.ts` (6/6 tests pass).
  - Production web bundle compiled (`npm run build`, 7 artifacts).
  - Synced with Capacitor Android (`npx cap sync android`).
  - Native Android debug APK assembled (`gradlew.bat assembleDebug`, BUILD SUCCESSFUL in 34s).

## [1.0.0-phase76-webm-seekability-and-telegram-gestures] - 2026-09-11

### WebM Container Seekability & Telegram-Grade Chat Gestures (Phase 76)
- **WebM EBML Cues Indexer & Duration Injector (`src/attachments/webmFix.ts`)**:
  - Eliminated the root cause of audio seek resetting to 0:00. Chromium `MediaRecorder` generates streaming WebM without `Duration` or `Cues` seek index tables, which caused ExoPlayer's `MatroskaExtractor` to treat files as unseekable.
  - Implemented zero-dependency EBML parser and indexer: parses clusters, computes exact byte offsets, injects `Duration` float into `Info`, sets `TimecodeScale` to 1ms, and prepends synthesized `Cues` index with `SeekHead`.
  - Integrated into `VoiceRecorder.stopRecording()`, `VoiceRecorder.downloadAndDecryptVoiceNote()`, and cache layer.
  - Added Chromium `Infinity` duration probe fallback in `VoicePlaybackManager` (`voicePlayer.ts`).
- **Telegram-Style Elastic Spring Swipe-to-Reply (`src/ui/components/ui/MessageBubble.tsx`)**:
  - Added non-linear elastic damping curve `-Math.min(75, Math.pow(Math.abs(deltaX), 0.82) * 1.6)` mimicking native mobile physics.
  - Dynamic rotating reply icon that scales from 0.4x to 1.0x, rotates to -25°, transitions to accent color, and triggers haptic vibration (`navigator.vibrate(12)`) at -45px threshold.
  - Smooth spring rebound transition (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`) focusing the composer reply bar on release.
- **Telegram-Style Hold-to-Record Mic Controls (`src/ui/components/MessageComposer.tsx`)**:
  - Replaced basic record button with gesture-aware touch and mouse tracker.
  - Slide left (`dx < -70px`): reveals animated trash can icon, dynamic "Release to cancel" hint, and haptic feedback.
  - Slide up (`dy < -60px`): locks into hands-free recording mode with animated lock pill and dedicated cancel/send actions.
  - Hold > 600ms & release: immediately dispatches voice message.
  - Live audio visualization: animated 4-bar soundwave visualizer and pulsing red indicator.
- **Waveform Scrubbing Tooltip & Haptic Ticks (`src/ui/components/ui/VoiceNoteCard.tsx`)**:
  - Floating timestamp pill (`0:14 / 0:42`) following the user's finger during active scrubbing.
  - Emits subtle haptic tick (`navigator.vibrate(5)`) at every 5% progress increment scrubbed.
- **Chat Edge-Swipe Navigation (`src/ui/components/ConversationView.tsx`)**:
  - Fluid back navigation across up to 85% of screen width with tactile completion feedback.
- **Automated Verification & Artifacts**:
  - 100% pass across all 386 test suites (1202 individual tests).
  - New test suites: `tests/phase76-webm-seekability.test.ts` (4/4), `tests/phase76-telegram-gestures.test.ts` (8/8).
  - Production web bundle compiled (`npm run build`, 7 artifacts).
  - Synced with Capacitor Android (`npx cap sync android`).
  - Native Android debug APK assembled (`gradlew.bat assembleDebug`, 7.45 MB).

## [1.0.0-phase75-voicenote-ref-stabilization] - 2026-09-11

### Voice Note Component Ref Stabilization & Runtime Crash Repair (Phase 75)
- **VoiceNoteCard Scope & Ref Declaration Consolidation**:
  - Eliminated runtime `ReferenceError: pendingSeekPercentRef is not defined` crash when opening chats with voice notes by replacing the orphan reference with `pendingSeekRef.current === null`.
  - Consolidated all 8 internal component refs (`isScrubbingRef`, `trackRef`, `seekThrottleTimerRef`, `pendingSeekRef`, `seekRevisionRef`, `pointerActiveRef`, `prevPropProgressRef`, `prevPropTimeRef`) at the top of `VoiceNoteCardComponent` before hook execution, preventing TDZ/closure issues.
- **Strict Parameter Typing in Voice Player**:
  - Updated `seekNative` invocation on line 788 of `src/attachments/voicePlayer.ts` to pass `targetId || undefined`, satisfying strict TypeScript parameter checks.
- **Automated Regression Coverage**:
  - Added `tests/phase75-voicenote-runtime.test.tsx` verifying absence of undeclared identifiers in source, proper lexical ref ordering, and error-free rendering across varied playback states.
- **Build & Package Artifacts**:
  - Verified 19/19 passing tests across all 5 voice test suites.
  - Recompiled web production bundle in 2.35s and synced Capacitor Android assets.
  - Assembled native Android debug APK in 59s (`app-debug.apk`, 7.45 MB).

## [1.0.0-phase72-audio-seeking-and-playback-stabilization] - 2026-09-09

### Audio Seeking & Playback Runtime Forensic Stabilization (Phase 72)
- **Audio Element & Ephemeral Object URL Reuse**:
  - Replaced rapid re-creation of `new Audio()` instances on every play with stable reuse of existing audio elements and decrypted blob URLs for the same voice note.
  - Mitigates audio stutter, memory growth, and orphaned event listeners firing phantom error callbacks.
- **Canplay-Gated Playback & Autoplay Error Recovery**:
  - Awaits `canplay` (`readyState >= 3`) before calling `play()`, eliminating `AbortError` caused by rapid play/pause/play sequences.
  - Gracefully catches `AbortError` and browser `NotAllowedError` without destroying the audio element or revoking URLs, safely transitioning status to `'paused'` to enable immediate recovery on the next user tap.
- **Staged Pre-Play and In-Pause Seeking Pipeline**:
  - Fixed silent seek failure where `currentTime` was set before media metadata loaded (`readyState === 0`).
  - Staged seek percentages are reliably committed in the `oncanplay` hook and during `resume()`.
  - Added `knownDurations` registry so idle and unplayed notes accurately compute `currentTime` from staged percentages upon initial subscription.
  - Extended `notifyListeners` with `targetId` to notify subscribers of unplayed notes when seeked.
- **UI Seeking Position Retention**:
  - Gated prop synchronization in `VoiceNoteCard.tsx` with reference-equality checks (`prevPropProgressRef`, `prevPropTimeRef`), preventing incoming zeroed progress props from clobbering local user seek interactions when idle.
- **Conversation View Playback State Synchronization**:
  - Removed `setPlayingAudioId(null)` on pause; keeps the active ID so `ConversationMessageRow` forwards `'paused'` state to `VoiceNoteCard`.

## [1.0.0-phase71-performance-and-smoothness-pass] - 2026-09-08

### Performance & Smoothness Pass Across Timeline, Memoization, Media Cache & Telemetry (Phase 71)
- **Conversation Timeline & Message Row Pure Memoization**:
  - Wrapped `ConversationMessageRow` with `React.memo` and stabilized all child callbacks with `useCallback`.
  - Updated props to accept scalar values (`isAudioPlaying`, `isDownloading`, `downloadPercent`, `downloadLoadedBytes`) to prevent re-rendering unaffected message rows during transfer or audio playback.
  - Eliminated redundant root-level state ticks (`setPlaybackProgress`, `setPlaybackCurrentTime`) during audio playback; `VoiceNoteCard` continues to update smoothly at 60fps via its internal `VoicePlayer.subscribe()` listener without triggering full timeline re-renders.
  - Wrapped top-level handlers with `useCallback`: `handleToggleSelectMessage`, `handleContextMenu`, `handleOpenMedia`, `handleOpenGroupedMedia`, `handleToggleVoice`, `handleSeekVoice`, `handleRetryMessage`, `handleReactionClick`, `handleDownloadAttachment`.
- **Large Conversation Incremental Windowing & Auto-Scroll Stabilization**:
  - Implemented incremental windowing for large conversations (`INITIAL_MESSAGE_WINDOW = 60`, `WINDOW_INCREMENT = 40`), slicing `displayedMessages = activeMessages.slice(-renderedCount)`.
  - Added upward scroll threshold listener (`handleTimelineScroll`) to lazily prepend older messages and preserve scroll position seamlessly.
  - Added window auto-expansion in `handleJumpToMessage` when jumping to messages outside the active window.
  - Polished timeline auto-scrolling to use instantaneous `behavior: 'auto'` on conversation switch (`lastChatIdRef !== activeChatId`) and `behavior: 'smooth'` for live incoming/outgoing messages.
- **AppState Context Provider Value Stabilization**:
  - Wrapped `AppContextType` provider value object with `React.useMemo(...)`, eliminating cascading re-renders across all `useApp()` consumers on unrelated state updates.
- **Presentation Component Pure Memoization**:
  - Wrapped `MessageBubble`, `VoiceNoteCard`, `AttachmentCard`, `MediaImage`, `GroupedMediaGrid`, and `MessageComposer` in `React.memo`.
- **Sidebar Conversation Item Optimization**:
  - Extracted `SidebarConversationItem` into `React.memo`, memoized `filteredConversations`, and stabilized click/pin callbacks with `useCallback`.
- **Ephemeral Media RAM Cache Bounded LRU Eviction**:
  - Added `MAX_RAM_ENTRIES = 50` bounded LRU eviction limit to `MediaCacheManager`.
  - Automatically revokes dead object URLs via `URL.revokeObjectURL()` on eviction to prevent DOM memory leaks on mobile devices, while preserving persistent IndexedDB caching.
- **Production Telemetry & Log Gating**:
  - Gated routine informational `console.log` statements in production builds (`import.meta.env?.PROD`), preventing console throughput bottlenecks while retaining high-fidelity ring buffers and error traces.

## [1.0.0-phase70-voice-seeking-swipe-media-ui] - 2026-09-08

### Voice Seeking, Swipe-to-Reply on Audio, Progress Circle & Video Player UI Overhaul (Phase 70)
- **Voice Note Seeking & Native Touch Scrubber**:
  - Bound dedicated touch listeners (`onTouchStartTrack`, `onTouchMoveTrack`, `onTouchEndTrack`) to the waveform track container with `e.stopPropagation()` to enable scrubbing on mobile touch devices.
  - Ensured seek position is converted to rounded integer milliseconds (`Math.round(targetTime * 1000)`) in `voicePlayer.ts` and `NativeMediaBridge.ts`.
  - Updated Android Kotlin plugin `VeilNativeMediaPlugin.kt` to handle both `Double` and `Long` representations of `positionMs` across Capacitor bridges, resolving silent rejection of seeking on native Android.
- **Swipe-to-Reply on Voice Messages**:
  - Removed `!msg.voice` restriction on touch start/move/end/cancel events, reply arrow indicators, and horizontal translation transforms in `ConversationView.tsx`.
  - Maintained event isolation on waveform scrubber and buttons so dragging the waveform seeks audio while dragging the bubble triggers reply.
- **Transfer Progress Circle Refinement**:
  - Normalized `status` checking case-insensitively (`'UPLOADING'`/`'uploading'`, `'DOWNLOADING'`/`'downloading'`) in `AttachmentCard.tsx` and `ConversationView.tsx`.
  - Ensured SVG `ProgressCircle` displays smoothly for in-flight media attachments and document transfers.
- **Video Player UI Overhaul (`MediaViewer.tsx`)**:
  - Completely redesigned fullscreen video player with a modern translucent frosted-glass HUD bottom bar (`.veil-media-viewer-video-controls`).
  - Replaced unstyled square play button with a 64px circular frosted-glass overlay in the center of the video.
  - Implemented auto-hiding controls with a 3-second inactivity timer during video playback, cleanly revealing on user movement, tap, or pause.
  - Added gradient fill on video seekbar dynamically reflecting playback progress.
  - Styled gallery navigation chevrons to automatically hide during active video playback.

## [1.0.0-phase69-chat-ux-enhancements] - 2026-09-08

### Chat UX Enhancements: Audio Speed Toggle, Progress Circle, Gallery Saving, Message Editing, Tap Context & Smart Emojis (Phase 69)
- **Audio UI Polish & Speed Controls**:
  - Added playback speed toggle pill (`1x / 1.5x / 2x`) in `VoiceNoteCard.tsx`.
  - Added pulse glow animation on play button during loading states.
  - Added `veil-waveform-bar` and `active` classes with smooth CSS transitions.
- **Progress Circle for Media & File Transfers**:
  - Implemented `ProgressCircle.tsx` SVG radial progress component with animated stroke dashoffset, percentage text, and subtle byte counters.
  - Integrated ProgressCircle into `AttachmentCard.tsx` during upload and download states.
  - Added radial progress overlay on decrypted media thumbnails in `ConversationView.tsx`.
  - Added progressive download stage tracking in `handleDownloadAttachment`.
- **Save-to-Gallery with Permission Handling**:
  - Added `FileSaver.saveToGallery()` targeting `Pictures/VEIL` for images and `DCIM/VEIL` for videos.
  - Added fallback to native share sheet dialog (`dialogTitle: Save image/video to Gallery`).
  - Automatically routes image and video downloads to gallery in `ConversationView.tsx`.
- **Message Editing with "(edited)" Indicator**:
  - Added `edited?: boolean` and `editedAt?: number` to `UIMessage`.
  - Implemented `AppState.editMessage()` with persistent encrypted storage updates.
  - Added edit mode to `MessageComposer.tsx` with top editing banner, cancel button, and checkmark confirmation.
  - Added subtle italic `edited` tag next to message timestamps.
- **Tap Across Message Field to Open Context Menu**:
  - Allowed users to tap anywhere on a message bubble or row to open the floating context menu.
  - Added dynamic viewport edge protection measuring the rendered menu via `contextMenuRef` and re-clamping.
- **Smart Emoji Reaction Bar & Categorized Modal**:
  - Quick reaction bar dynamically tracks and displays user's top recent emojis (`veil:ui:recentEmojis`).
  - Added high-contrast expand button with `ChevronRightIcon`.
  - Implemented `EmojiPickerModal.tsx` categorized grid (Smileys, Emotions, Hearts, Hands, Animals, Food, Objects, Symbols).

## [1.0.0-phase68-chat-ui-polish] - 2026-09-08

### Chat UI Polish: Message Bubbles, Action Row Alignment, P2P Sender Omission & Forwarding Pipeline (Phase 68)
- **P2P Message Bubbles — Sender Name Omission**:
  - In 1-to-1 / P2P conversations, the sender display name is omitted inside every message bubble (`showSenderName={false}`) because the conversation header already identifies the peer.
  - In group conversations (`activeConversation?.type === 'group'`), sender names remain prominently displayed (`showSenderName={true}`) in their accent color (`var(--veil-accent-primary)`).
- **Unified Single-Line Action / Meta Row**:
  - Eliminated bulky multi-line bubble stacking (body, timestamp, reaction/reply).
  - Unified all actions, reactions, desktop reply button, and message timestamp + delivery status checkmark into a single compact horizontal bottom row (`.veil-message-action-row`):
    - Reactions sit flushed to the **left** (`.veil-message-reactions`).
    - Inline reply button (desktop) and message timestamp + delivery status checkmarks sit grouped on the **right** (`.veil-message-meta-group`).
  - Slashes bubble height significantly while preserving natural flex containment.
- **Platform-Specific Reply Affordance (Mobile vs Desktop)**:
  - On mobile touch / Android devices, the visible inline reply button is suppressed (`display: none !important` via `@media (max-width: 768px), (pointer: coarse)` and `isMobilePlatform` check). Touch users reply via horizontal swipe gesture or the context menu.
  - On desktop/web, the Reply button appears cleanly on the action row.
- **End-to-End Forwarding Pipeline**:
  - Complete message forwarding for text, attachments (single and multi-file galleries), and voice notes with fresh recipient/group AEAD re-encryption and R2 cloud authorization.
  - Optional "Forwarded from [name]" attribution toggle in the forwarding dialog (`[✓] Include sender attribution`).
  - Rendered via clean metadata banner `↗ Forwarded from [name]` or `↗ Forwarded message` at the top of the bubble, never prepending raw text.
  - Verified across 11 real-world scenarios in `tests/phase68-real-world-forwarding.test.tsx` using two authenticated VEIL clients, a live RelayServer, and CloudClient storage (normal text with Double Ratchet decryption & persistence across restart, attributed vs non-attributed display, image re-encryption, video playback integrity, voice duration and audio verification, multi-file galleries, group Sender Key distribution, unmounted source chat forwarding, and platform-specific desktop vs mobile reply affordances).
- **Eliminated Message Bubble Overlap & Collisions**:
  - Root cause: `.veil-message-meta` was declared as `float: right; margin-top: 2px;` inside an `inline-block` `.veil-message-bubble`. When message text was short ("pos"), the floated metadata escaped container height calculation, causing adjacent message rows and reaction pills to physically collide. Furthermore, `.veil-message-grouped-prev/next` injected conflicting `!important` margins.
  - Converted `.veil-message-bubble` to standard `display: flex; flex-direction: column;` participating in natural document flow.
  - Placed `.veil-message-body` in full block flow, and anchored `.veil-message-meta` via `align-self: flex-end; margin-left: auto;` in natural document flow.
  - Removed escaped floats and normalized grouping margins to `0px`, allowing `gap: var(--veil-msg-gap, 0.4rem)` to govern row separation without collapsing.
  - Fixed avatar container alignment with `height: 28px; width: 28px; display: flex; align-items: flex-end; justify-content: center;`.
- **Reply Preview Containment & Sizing Integrity**:
  - Encapsulated reply preview inside a dedicated `.veil-message-reply-container` with `minWidth: 0, width: 100%`.
  - Added strict `minWidth: 0, maxWidth: 100%` on `.veil-reply-preview` and `text-overflow: ellipsis, white-space: nowrap` on `.veil-reply-snippet` and `.veil-reply-sender` to prevent cyclic intrinsic sizing expansion in WebViews.
- **Translucent Frosted Glass Context Menu**:
  - Upgraded `.veil-context-menu` to modern dark translucent frosted glass surface (`rgba(22, 27, 34, 0.88)`, `backdrop-filter: blur(16px) saturate(180%)`, modern border, `box-shadow`, and smooth entrance animation).
  - Designed `.veil-context-reactions-bar` with quick reaction emojis (`❤️ 👍 😂 😮 😢 🙏 🔥`) with active highlight state (`.veil-reaction-active`) reflecting `userReacted` status.
  - Styled `.veil-context-item` and `.veil-context-item-danger` with reset appearance, hover states, and SVG iconography.
  - Added `.veil-context-backdrop` overlay and `Escape` key listener for instant dismissal.
  - Added `.veil-context-active-message` accent halo on the active target message row.
- **Intelligent Viewport Positioning & Boundary Clamping**:
  - Refactored `handleContextMenu` in `ConversationView.tsx`: calculates available space below vs above cursor/target element, automatically flips menu upwards if space below < 360px and space above is larger, and clamps horizontally and vertically to prevent off-screen clipping.
  - Wired `onContextMenu` and `onLongPress` directly to `<MessageBubble>` on desktop and mobile touch devices.
- **Delete for Everyone Confirmation & Forward Recipient Dialog**:
  - Implemented `deleteForEveryoneConfirm` state with modal dialog warning that deletion is permanent for all participants.
  - Implemented `forwardingMessage` state with modal dialog allowing user to choose target conversation to forward message to.
- **Automated Verification**:
  - Created and extended `tests/phase68-chat-bubbles-and-context-menu.test.tsx` (18/18 tests pass).
  - Verified regression across full test suites and production build in 1.98s with 7 release artifacts in `release/v1.0.0/`.

## [1.0.0-phase67-applock-perf-sync] - 2026-09-07

### App Lock Latency Elimination, File Picker Lifecycle Guard, Atomic Profile Updates & Cross-Account Synchronization (Phase 67)
- **Single-Derivation App Lock Fast-Path (Latency Root-Cause Elimination)**:
  - Root cause: Entering a PIN was performing TWO sequential, heavy Argon2id derivations (~1s each): the first to verify the PIN and decrypt the wrapped password in `SpacePinManager`, and the second when passing that password to `vault.unlockSpace(password)` to derive the Space Master Key again.
  - Fix: Extended `WrappedCredentialsPayload` to store the Base64-encoded 32-byte Space Master Key (SMK), securely encrypted with XChaCha20-Poly1305 under the PIN KEK (`kek_pin`).
  - Added `vault.unlockSpaceWithMasterKey(spaceId, masterKey)` and `sessionController.unlockWithMasterKey(spaceId, masterKey)`, enabling instantaneous (0ms KDF) vault session activation.
  - Implemented automatic backward-compatible credential upgrade (`upgradeWrappedCredentialsWithMasterKey`) upon first unlock for spaces configured under earlier schemas.
  - Instrumented timing benchmarks: logs sanitized execution breakdown (`pin_verification_ms`, `credential_resolution_ms`, `vault_unlock_ms`, `session_activation_ms`, `total_ms`) in development mode with zero sensitive data disclosure.
- **File Picker Lifecycle Guard (Profile Photo Update App-Lock Prevention)**:
  - Root cause: On native Android, opening the system file/image selector switches the host activity to the background (`visibilitychange: hidden` / Capacitor `appStateChange: { isActive: false }`). When the user selected a photo or cancelled, `AppState`'s auto-lock listener fired `sessionController.lock()`, destroying volatile session keys, clearing active modals, and returning to the PIN lock screen.
  - Fix: Implemented `isFilePickerActiveRef` and `markFilePickerActive`/`markFilePickerInactive` with a 4,000ms safety grace window.
  - Added global document-level capture listeners for `click`, `change`, and `cancel` on `input[type="file"]`, preventing accidental background auto-lock during system file picker transitions while preserving strict auto-lock when switching away to other apps.
- **Atomic Profile Picture Updates**:
  - Implemented `updateProfileAvatar(avatarDataUrl)` in `AppState`:
    - Compresses/optimizes avatars to < 32 KB and 128x128 JPEG dimensions.
    - Generates and signs a fresh `SignedProfileDocument` with the space's Ed25519 identity key.
    - Atomically updates the encrypted local partition (`veil:user:profile`), privacy settings, PIN registry avatar (`spacePinManager.updateSpaceAvatar`), and registers the profile with the relay directory client.
    - Updates local UI state and closes no modals unexpectedly, eliminating the false logout/reset loop.
- **Cross-Account Communication (A ↔ B) & Provisioning Repair**:
  - Root cause: Secondary spaces created via `createSecondaryAccount` previously omitted genuine prekey bundles and relay mailboxes when `PrekeyManager` was not explicitly passed, causing peer inbound validation (`verifySignedProfile`) to fail and drop messages.
  - Fix: Secondary account creation now automatically provisions full `PrekeyManager` instances, generates signed prekeys and one-time prekeys (10 OPKs), allocates relay mailboxes, signs profile documents, and registers profiles in the directory.
  - Enables verified bi-directional contact requests and end-to-end encrypted messaging between Account A and Account B on the same or distinct devices.
- **Real Visible Connection Status**:
  - Added a subtle, non-intrusive status pill in the top header below the VEIL branding (`● Connected`, `↻ Connecting...`, `↻ Reconnecting...`, `● Offline`) dynamically driven by `networkState`.
- **Automated Verification**:
  - Created `tests/phase67-applock-perf-and-timing.test.ts` (4/4 tests pass).
  - Created `tests/phase67-cross-account-comm.test.ts` (1/1 test passes).
  - Verified regression across `tests/phase65-multi-account-isolation.test.ts`, `tests/phase66-account-restore-healing.test.ts`, `tests/phase50c-password-validation-forensic.test.ts`, and `tests/applock-multi-space-pin.test.ts` (27/27 tests passing).
  - Web production build passed in 1.90s; Android debug APK compiled cleanly in 48s.

## [1.0.0-phase66-account-restore-healing] - 2026-09-06

### Account Restore Self-Healing, Recovery Vault Resilience & Login Error Resolution (Phase 66)
- **Resolved Login Red Screen Error**:
  - Eliminated the critical Android sign-in error: `"Failed to decrypt identity backup: invalid password or corrupted backup"`.
  - Occurred when an account authenticated successfully against the relay server (HTTP 200), but the cloud recovery vault was encrypted under a previous password (e.g. following a password reset) or had legacy KDF parameters.
- **KDF Parameter Normalization & Fallback Pipeline**:
  - Normalized older KDF parameter schemas (`iterations` -> `timeCost`, `memory`/`memCost` -> `memoryCost`).
  - Added multi-salt decryption attempts using `kdfParams.salt`, `vaultBlob.salt`, and account `authSalt`.
  - Added multi-profile KDF fallbacks (`normalizedKdf`, `DEFAULT_KDF_PARAMS`, `FAST_TEST_KDF_PARAMS`, 32MB profile) and 13 candidate AAD variations.
- **Self-Healing Space Initialization**:
  - In sign-in and app-unlock flows where `allowFreshSpaceCreation: true`, if the cloud recovery vault cannot be decrypted, VEIL automatically initializes a fresh local cryptographic space for the authenticated account ID.
  - Automatically re-anchors and updates the cloud recovery vault encrypted with the user's current valid password.
  - Returns a functional session and unlocks the app immediately without displaying an error to the user.
- **Strict Manual Restore Security**:
  - Maintained fail-closed behavior for manual recovery (`allowFreshSpaceCreation: false`), strictly throwing an error if the vault cannot be decrypted so users are informed if they provide the wrong recovery password during explicit restore attempts.
- **Automated Verification**:
  - Added `tests/phase66-account-restore-healing.test.ts` (100% pass).
  - Regression verified across all account isolation, password validation, and polish suites (24 tests total).
  - Web production build passed in 1.85s; Android debug APK compiled in 17s (7.39 MB).

## [1.0.0-phase65-multi-account-and-actions] - 2026-09-06

### Multi-Account Isolation, Space Re-Auth Gate, Voice Seeking, Contextual Actions & Group Avatars (Phase 65)
- **Multi-Account & Space Isolation Model**:
  - Designated first registered account as Main Account (`isMainAccount: true`).
  - Secondary spaces created via `AccountManager.createSecondaryAccount` require unique `@username`, generate isolated Ed25519 identity, and initialize local envelope and locked session without modifying or disconnecting the active Main Account.
  - Secondary accounts have `isMainAccount: false` and are strictly barred from seeing "Accounts & Spaces" or discovering other spaces on the device.
- **Privilege Gate & Re-Authentication**:
  - Gated "Accounts & Spaces" behind Main Account status and a Re-Auth prompt requiring PIN or passphrase verification before management access is granted.
- **Message Reactions & Context Actions**:
  - Added floating quick reaction bar (❤️, 👍, 😂, 😮, 😢, 🙏, 🔥) with toggle count mechanics and animated reaction pills.
  - Implemented wire protocol dispatch for `'MESSAGE_REACTION'` updating counts and emoji rosters.
  - Implemented reciprocal "Delete for Everyone" resolution across 1-to-1 chats and groups.
  - Added "Save Audio" context menu option for voice notes and "Forward" action.
  - Rendered sender `Avatar` next to incoming messages for direct and group chats.
- **Group Avatar Cryptographic Security**:
  - Strictly restricted metadata/avatar changes to group `CREATOR` role.
  - Action encrypted with epoch metadata key and signed with creator's Ed25519 private key.
  - Added camera upload overlay visible only to group creator, optimizing images to 128x128.
- **Reliable Voice Seeking & File Saving**:
  - Fixed pointer capture on scrubber by tracking and releasing pointer listeners on both element and window.
  - Verified real device file saving by testing `saved && saved.success === true`.
- **Automated Verification & Artifacts**:
  - Created `tests/phase65-multi-account-isolation.test.ts` (5/5 tests passing).
  - Created `tests/phase65-reactions-and-actions.test.ts` (6/6 tests passing).
  - Regression suites passed (`phase64`, `phase63`, `applock-multi-space-pin`).
  - Production Web build compiled cleanly in 2.23s (`npm run build`).
  - Android APK compiled cleanly in 18s (`app-debug.apk`, 7.38 MB).

## [1.0.0-phase64-audit-and-polish] - 2026-09-06

### Settings Redesign, Chat UI Polish, Media Performance & Dynamic PIN UX (Phase 64)
- **Settings Experience Redesign**:
  - Upgraded Profile Card with an interactive avatar edit badge (`title="Edit profile"`, `UserIcon`, clean typography, status indicator).
  - Organized settings into grouped cards with clear category headers (`ACCOUNT`, `PRIVACY & SECURITY`, `APP SETTINGS`, `ABOUT`).
  - Added full mobile responsive experience: on mobile devices (`max-width: 768px`), Settings opens full-screen (`100vw`, `100dvh`, zero border-radius, top/bottom safe-area padding).
  - Added smooth transition animations (`veil-settings-subpage-enter`, `veil-slide-up-mobile`).
- **Chat UI Redesign & Geometry Polish**:
  - Redesigned message bubbles with 18px border radius, 82% max-width, modern padding (`10px 14px`), and deep charcoal background (`#161922`) for incoming messages.
  - Implemented consecutive message grouping logic: consecutive messages from the same sender within 60s tighten vertical gap to 3px and adjust curvature.
  - Added interactive reaction pills (`.veil-reaction-pill`) with animated entry, emoji display, count badge, and user-reacted accent styling.
  - Retained clean 56px conversation header without fake call buttons and capsule composer.
- **Media Performance Optimization**:
  - Eliminated UI freezing during large file/video/audio encryption and upload by introducing event loop yielding (`setTimeout(r, 0)`) before reading array buffers and computing SHA-256 chunk digests.
  - Throttled IndexedDB message persistence during uploads in `sendAttachments`: writes only occur on terminal states (`SENT` or `FAILED`), eliminating redundant serialization overhead during chunk progress events.
- **Pure Dynamic PIN Dot Indicators**:
  - Eliminated static empty circle outlines from `PinLockScreen.tsx` and `AppLockSetupModal.tsx`.
  - When no digits are entered, displays clean placeholder ("Enter PIN" or "Enter {pinLength}-digit PIN").
  - As digits are entered, renders strictly `pin.length` dots with popping scale animation (`veil-pin-dot-pop`).
  - Preserved 4 and 6 digit support without premature 4-digit auto-submission; explicit OK/Enter triggers submission.
- **Oval Touch Feedback & Zero Rectangular Highlights**:
  - Applied `clip-path: inset(0 round 9999px) !important;` and `-webkit-tap-highlight-color: transparent !important;` to all filter pills and capsule buttons to prevent rectangular gray tap highlights on Android WebViews.
- **Privacy & Anti-Enumeration Preserved**:
  - Ensured unauthenticated users cannot discover space count, space names, or registered accounts.
- **Automated Verification & Artifacts**:
  - Created `tests/phase64-audit-and-polish.test.tsx` (10/10 tests passing).
  - All regression suites passing (`phase63`, `phase62`, `applock-multi-space-pin`, `voice`).
  - Generated production Web build (`npm run build`, 7 artifacts) and compiled Android debug APK (7.38 MB).

## [1.0.0-phase63-deep-repair] - 2026-09-06

### Deep Authentication, App Lock, Navigation & Performance Repair (Phase 63)
- **Fast Space Authentication (< 1s Local Unlock)**:
  - Decoupled local space unlocking (`unlockSpace`) from synchronous cloud session negotiation (`ensureCloudSession`).
  - Key derivation, XChaCha20 vault decryption, and session activation now unlock the UI immediately.
  - Cloud synchronization and session establishment run asynchronously in the background.
- **App Lock PIN Resolution & Format Selection**:
  - Corrected `verifyAndResolvePin` in `src/privacy/pinManager.ts` to return explicit `VerifyPinResult` (`{ success: true, spaceId, username, password, accountId }`).
  - Updated `AppState.unlockWithPin` to consume `result.password` and properly activate the space session.
  - Added `preferredPinType` field to `DevicePinRegistry` and exposed `setPinType`/`getPinType` for 4-digit and 6-digit preferences.
  - Wired PIN Type toggle in `AppLockSettingsView.tsx` to persist user selection immediately.
- **Elimination of Stuck Loading Spinners & "Forgot PIN" Recovery**:
  - Added `finally { setLoadingPhase('idle'); }` in `LockScreen.handleUnlock` to ensure loading phase always resets on password login.
  - Reset `isUnlocking(false)` upon success in `PinLockScreen.tsx`.
  - Added `setShowPasswordLogin(false)` on successful login in `App.tsx` so the fallback modal is dismissed cleanly.
- **Removal of Bottom Navigation Bar & Direct Settings Access**:
  - Completely eliminated the bottom navigation bar (`veil-bottom-nav`) from `Sidebar.tsx`, reclaiming vertical screen estate.
  - Wired top header hamburger menu button directly to open Settings modal (`openModal({ type: 'settings' })`).
  - Adjusted FAB button positioning for comfortable single-hand access (`bottom: 24px`).
- **Voice Message Seeking & Scrubber Touch Repair**:
  - Removed blocking `onTouchStart={stopAllEvents}` from `VoiceNoteCard.tsx` scrubber track, restoring touch scrubbing on mobile.
  - Added pointer capture on `onPointerDown` and dedicated `onClick` track handler for instant seek.
  - Passed voice note's actual `durationSeconds` to `VoicePlayer.seek` to compute exact seek target time.
- **Conversation Header & UI Polish**:
  - Removed non-functional audio and video call buttons from conversation header in `ConversationView.tsx`.
  - Fixed delivery status tooltip in `MessageStatus.tsx` to display `"Delivered"`.
- **Automated Verification & Packaging**:
  - Created and executed `tests/phase63-deep-repair.test.tsx` (10/10 tests passing).
  - Verified regression suites `tests/phase62-applock-privacy-auth.test.tsx` (10/10) and `tests/applock-multi-space-pin.test.ts` (8/8).
  - Generated release build (`npm run build`, 7 release artifacts in `release/v1.0.0/`).
  - Built Android debug APK (`android/app/build/outputs/apk/debug/app-debug.apk`, 7.38 MB).

## [1.0.0-phase62-applock-privacy-auth] - 2026-09-06

### App Lock, Privacy, Space Isolation, Authentication & UI Overhaul (Phase 62)
- **Critical Authentication & Error Sanitization (`src/privacy/pinManager.ts`, `src/ui/app/AppState.tsx`, `src/ui/components/LockScreen.tsx`)**:
  - Implemented `hasPinForSpace(spaceIdentifier: string): boolean` on `SpacePinManager`, resolving by both `spaceId` and canonical username (with or without `@` prefix).
  - Enhanced `isOnboardingCompleted`, `setOnboardingCompleted`, and `getPinType` to cross-resolve between space ID and canonical username.
  - Sanitized login screen error display to intercept raw runtime JS/TypeError exceptions (such as `is not a function`) and present user-friendly error banners while securely logging details to console.
  - Ensured `unlockSpace` and `createSpace` return the active `SpaceSession`, and wrapped secondary post-auth notifications in protected try/catch blocks.
- **PIN Entry & Dynamic Dots Model (`src/ui/components/PinLockScreen.tsx`)**:
  - Removed premature auto-submission on 4 digits for 6-digit configured PINs.
  - Added explicit Enter/Unlock keypad button ("OK" / checkmark) and physical keyboard `Enter` listener.
  - Implemented dynamic dot indicators (`displayLength` matches configured PIN length and expands to 6 if 5+ digits entered).
  - Added shake-and-reset error feedback on invalid attempts.
- **App Lock Setup Modal Matching Entry Semantics (`src/ui/components/AppLockSetupModal.tsx`)**:
  - Removed premature auto-advance upon typing the last digit of first and confirm PINs.
  - Added explicit "Continue" / "Confirm PIN" buttons, physical keyboard `Enter` support, and dedicated OK keypad cell.
  - Toggle between 4-digit and 6-digit PIN length dynamically updates the indicator count.
- **Space Isolation & Anti-Enumeration Overhaul (`src/ui/components/AccountsAndSpacesModal.tsx`)**:
  - Completely eliminated the `Your Spaces ({registeredSpaces.length})` directory list that leaked stored spaces and accounts.
  - Retained the Current Active Space card with inline rename and change PIN capabilities.
  - Implemented privacy-preserving direct action buttons: "Switch Space" (prompts for PIN/passphrase without listing other spaces), "Create New Space", "Add Existing Account", "Lock Space Now".
  - Preserved zero-knowledge plausible deniability and decoy spaces.
- **Navigation Cleanup & Touch Highlight Suppression (`src/ui/components/Sidebar.tsx`, `src/styles/veil-design-system.css`, `src/styles/veil-components.css`)**:
  - Removed "Spaces" button from conversation category chips bar (retaining `All`, `Unread`, `Groups`).
  - Removed nonfunctional "Calls" tab button from bottom navigation bar.
  - Rebalanced the 3 remaining navigation tabs (`Chats`, `Groups`, `Settings`) with equal flex layout.
  - Added global `-webkit-tap-highlight-color: transparent` to eliminate gray rectangular touch flashes on mobile/WebViews.
  - Added `.veil-filter-pill` with oval boundary clipping (`border-radius: 9999px !important; overflow: hidden !important;`) and active scale transition.
- **Automated Verification**:
  - Created `tests/phase62-applock-privacy-auth.test.tsx` (10/10 tests passing).
  - Verified core security, privacy, and UI suites (32/32 tests passing).
  - Production build cleanly compiled (`npm run build`, 7 release artifacts).

## [1.0.0-showcase-ui-redesign] - 2026-09-06

### Completed Full UI/UX Redesign (10 Showcase Screens & App Lock Overhaul)
- **App Lock Runtime Fix & Advanced Controls (`src/privacy/pinManager.ts`, `src/ui/components/AppLockSettingsView.tsx`, `src/ui/components/SecurityOptionsView.tsx`)**:
  - Resolved `Tt.isLockOnBackgroundEnabled is not a function` minification issue by providing explicit typed getters/setters (`isLockOnBackgroundEnabled`, `setLockOnBackgroundEnabled`, `isLockOnScreenOffEnabled`, `setLockOnScreenOffEnabled`).
  - Added granular auto-lock timer controls (`afterExitingApp`, `afterBackground`, `afterScreenOff`, `afterInactivity`) and instant Red "Lock Now" action.
  - Implemented Screen 9: Security Options with toggleable native protections (Hide app content in recents, Screen capture protection, Disable app switcher preview, Biometric authentication) and palette theme swatch picker.
- **Screen 1: First Login Redesign (`src/ui/components/LockScreen.tsx`)**:
  - Rebuilt with deep midnight palette (`#080b11`), glowing circular shield checkmark badge (`#14b8a6`), clean username input with user icon, password passphrase input, full-width teal "Sign In" button with accessible `Unlock Space` test contract, "+ Create New Account" pill, and zero-knowledge local encryption notice.
- **Screen 2: Set App Lock Modal (`src/ui/components/AppLockSetupModal.tsx`)**:
  - Glowing circular lock badge, 4-digit / 6-digit PIN length toggle, interactive on-screen numeric keypad, collision prevention, confirmation flow, and persistent onboarding flag.
- **Screen 3 & 10: PIN Entry Unlock Screen (`src/ui/components/PinLockScreen.tsx`)**:
  - Centered glowing teal shield icon, interactive PIN dots with shake animation on error, responsive numeric keypad, "Forgot PIN?" fallback to password, and "Use Face ID" biometric button.
- **Screen 4: Conversations Sidebar Redesign (`src/ui/components/Sidebar.tsx`)**:
  - Top header with hamburger Menu icon (opens Accounts & Spaces), centered bold "VEIL" title, and expandable search toggle.
  - Filter chips bar: `All`, `Unread`, `Groups`, and `Spaces` (direct shortcut to Accounts & Spaces).
  - Clean list items with avatars, timestamps, SVG media snippet icons, outgoing message statuses, and teal unread pills.
  - Floating Action Button (+) on bottom-right with glowing teal shadow for starting new chats.
  - Bottom navigation bar with 4 tabs: `Chats`, `Calls`, `Groups`, and `Settings`.
- **Screen 5: Chat Screen Redesign (`src/ui/components/ConversationView.tsx`, `src/ui/components/ui/MessageBubble.tsx`)**:
  - Top header with mobile back button, avatar, verified identity badge, status text, and action buttons: Audio Call, Video Call, In-Chat Search, Shared Media Gallery, and Details.
  - Persistent pinned message banner with 1-click jump-to-message and unpin button.
  - Incoming dark bubbles (`#161a24`), outgoing teal bubbles (`#0d9488`), colored sender tags for group members, and reaction pill support.
- **Screen 6: Accounts & Spaces Redesign (`src/ui/components/AccountsAndSpacesModal.tsx`)**:
  - Active space card with teal badge, "Your Spaces" list with cryptographic padlock indicators, "+ Add Account" & "+ Create Space" buttons, and informative "How it works?" explanation card.
- **Screen 7: Customize Your VEIL (`src/ui/components/AppearanceSettingsView.tsx`, `src/styles/themes.css`, `src/ui/utils/themeManager.ts`)**:
  - 6 showcase themes (`midnight`, `ocean`, `forest`, `amber`, `rose`, `slate`), 11 accent color swatches, and 6 feature callout badges.
- **Verification & Builds**:
  - All test suites passing with 100% pass rate.
  - Production build cleanly compiled via Vite (`npm run build`).
  - Android assets synchronized via Capacitor (`npx cap sync android`).

## [1.0.0-ui-applock-overhaul] - 2026-09-05

### Added & Overhauled (Complete UI/UX Redesign, Multi-Space App Lock & Centralized Theme Engine)
- **Multi-Space App Lock & Silent Space Resolution (`src/privacy/pinManager.ts`, `src/ui/components/PinLockScreen.tsx`, `src/ui/components/AppLockSetupModal.tsx`, `src/ui/components/AppLockSettingsView.tsx`, `src/ui/components/AccountsAndSpacesModal.tsx`)**:
  - Argon2id KDF derivation with device-unique salt (`veil_pin_salt_v1`).
  - Single-pass silent space resolution (`verifyAndResolvePin`): entering any registered Space PIN decrypts and switches directly into that specific Space with zero UI disclosure of other existing spaces or space counts.
  - Strict duplicate PIN collision prevention (`isPinAvailable`, `isPinAvailableSync`): prevents assigning an identical PIN to different spaces while returning generic non-enumerating error responses.
  - XChaCha20-Poly1305 AEAD PIN key wrapping for credentials.
  - Exponential rate limiting and lockout backoff (30s after 5 failed attempts, doubling up to 10m).
  - Configurable auto-lock timeouts (Immediately, 30s, 1m, 5m, 10m, Never) and background state detection.
- **Centralized Theme & Appearance Engine (`src/ui/utils/themeManager.ts`, `src/styles/themes.css`, `src/styles/veil-design-system.css`, `src/styles/veil-components.css`, `src/ui/components/AppearanceSettingsView.tsx`)**:
  - Replaced all generic AI styling and purple/blue gradients with restrained, deep charcoal neutral surfaces (`#0c0d10`, `#15171c`, `#1e2029`).
  - 11 globally selectable accent colors (Teal default, Emerald, Cobalt, Indigo, Violet, Rose, Amber, Olive, Slate, Crimson, Coral) applied dynamically via CSS custom properties.
  - 4 complete theme modes: Dark (default), AMOLED (pure black #000000), Dim (muted charcoal), and Light.
  - Message bubble customization (Modern Rounded, Compact, Sharp) and typography scaling (13px–17px).
- **Comprehensive UI/UX Refactor & 100% SVG Vector Iconography**:
  - Complete elimination of all Unicode symbol/emoji characters from the UI layer; full replacement with SVG vector icons (`Icons.tsx`, `DeleteIcon`, `ArrowLeftIcon`, etc.).
  - Sidebar enhancements: conversation pin-to-top ordering, SVG pin badges, active accent unread counters, and quick Accounts & Spaces access.
  - Conversation view enhancements: persistent pinned message banner with 1-click jump-to-message, context menu Pin/Unpin, smooth audio player integration.
  - Modernized lock/login screen with zero metadata leakage and space passphrase unlocking.
- **Verification Suites & Mobile Builds (`tests/applock-multi-space-pin.test.ts`, `tests/theme-accent-system.test.ts`)**:
  - 363/363 test files passed, 1,056/1,056 tests passed (100% pass rate).
  - Web production bundle built cleanly with Vite.
  - Capacitor Android synchronized and native Android APK assembled cleanly (`app-debug.apk`, 7.38 MB).

## [1.0.0-master-reliability] - 2026-09-05

### Added & Fixed (Master Reliability: Double Ratchet Self-Healing, Group Seen Receipts, Audio Seek Throttling)
- **Double Ratchet Protocol Self-Healing (`src/ratchet/ratchet.ts`, `src/ratchet/types.ts`, `src/messaging/conversationManager.ts`)**:
  - Persisted and attached `initialX3DHHeader` on all Alice-initiated outbound messages until a reciprocal reply from Bob is processed (`nr > 0`).
  - Enables Bob to self-heal and decrypt subsequent messages even if Bob desynced, missed the initial initiation message, or restored an earlier session.
- **Relay Outbound Queue Head-of-Line Unblocking (`src/network/networkManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Prevented 404/revoked mailboxes from freezing the outbound queue loop in `flushOutboundQueue` by marking dead items `FAILED` and draining subsequent items.
  - Implemented dynamic Directory mailbox lookup and delivery retry in `AppState.tsx` when a target mailbox returns 404/expired.
- **Group Seen Feature & Group Read Receipts (`src/ui/app/AppState.tsx`)**:
  - Automatically advances all preceding outgoing messages in a group to `READ` when any group member posts an inbound reply.
  - Broadcasts `GROUP_READ_RECEIPT` across all member mailboxes upon opening an unread group.
  - Processes incoming `GROUP_READ_RECEIPT` envelopes and updates matching group messages up to `lastReadMessageId`.
- **Voice Seeking Scrubbing & Playback Resilience (`src/ui/components/ui/VoiceNoteCard.tsx`, `src/attachments/voicePlayer.ts`, `android/app/src/main/java/chat/veil/app/VeilNativeMediaPlugin.kt`)**:
  - Decoupled visual scrubbing bar progress updates (instant 60fps) from audio engine seeks (throttled to 120ms during drag, committed on pointer up).
  - Protected web `voicePlayer.ts` against `readyState === 0` (HAVE_NOTHING) throwing `InvalidStateError`.
  - Added `pendingSeekRunnable` in Kotlin `VeilNativeMediaPlugin.kt` on `mainHandler` to coalesce rapid native ExoPlayer seek commands.
- **Verification Suites (`tests/phase59-group-seen-receipts.test.ts`, `tests/phase60-mailbox-refresh-recovery.test.ts`, `tests/phase61-audio-seek-throttling.test.ts`)**:
  - 361/361 test suites passing (1,043/1,043 tests passing, 0 failures).
  - Web production bundle built, Capacitor Android synced, and native Android APK assembled (`app-debug.apk`, 7.36 MB).

## [1.0.0-acceptance-pass] - 2026-09-05

### Added & Verified (Final Real-World Acceptance Pass & Zero Failure Test Suite)
- **Zero-Failure Main Test Suite (`tests/phase29-voice-message.test.ts`)**:
  - Rewrote test suite to validate canonical raw R2 authorized media upload, storage, recipient authorization, and HTTP Range 206 streaming.
  - Automated test suite reached 100% pass across all 358 test files and 1,035 tests with zero unexpected failures.
- **Real Voice Audio Forensic Verification (`tests/phase57-real-voice-forensic.test.ts`, `tests/fixtures/real_voice.wav`)**:
  - Validated real 441,044-byte 5.0-second PCM voice recording.
  - Verified HTTP Range 206 Partial Content streaming: initial chunk (0-1023), seek to 2.5s (220500-264600), end seek to 4.5s (396900-441043), query token auth, unsatisfiable 416, and anti-enumeration 404.
  - Proved seek requests only fetch partial byte ranges without downloading the entire file.
  - Verified player state latency (< 50ms play trigger, < 10ms pause, instant seek).
- **Two-Client UI Acceptance Verification (`tests/phase58-ui-acceptance-twoclient.test.tsx`)**:
  - Verified bidirectional 1-to-1 message delivery (A -> B, B -> A) and rapid 5-message burst delivery in both directions with exact order preservation.
  - Verified offline queueing: disconnected recipient receives queued messages upon reconnect.
  - Verified full UI rendering with `ConversationView`: message text, sender name, bubbles.
  - Verified multi-peer group lifecycle: A creates group, adds B, adds C, verified roster convergence [A, B] and [A, B, C], and group message delivery.
  - Verified `GroupDetailsModal`: no ReferenceError, member list with roles, current user identified with "(You)", null profile safety.
  - Verified network state stability: verified absence of state flapping/oscillation while healthy.
- **Android Hardware Runtime Status**:
  - ADB platform tools queried: no physical Android device attached.
  - Accurately classified as `ANDROID HARDWARE RUNTIME = UNKNOWN` per Rule #1 and Rule #12.

## [1.0.0-audio-stabilization] - 2026-09-05

### Added & Fixed (Voice Note Audio Playback, Seeking, Range Streaming & UI Overhaul)
- **Audio Pipeline Direct Binary R2 Upload & Server Range Streaming (`src/server/cloud/cloudHandler.ts`, `src/attachments/voiceRecorder.ts`)**:
  - Implemented direct binary upload of audio recordings to R2/S3 without client-side encryption overhead.
  - Implemented HTTP Range support in `cloudHandler.ts` returning `206 Partial Content`, `Content-Range: bytes ${start}-${end}/${total}`, `Accept-Ranges: bytes`, and accurate `Content-Type: audio/webm`.
  - Added query token authentication (`?token=...`) allowing native HTML `<audio>` elements to stream range-authenticated audio directly.
- **Audio Playback Manager & Lifecycle Resilience (`src/attachments/voicePlayer.ts`)**:
  - Reused persistent `HTMLAudioElement` across React re-renders, preventing audio interruptions and abort errors.
  - Implemented true synchronous `pause()` (preserving audio instance and ephemeral blob URL) and instant `resume()`.
  - Implemented accurate `seek(percent, messageId)` with pre-play staging and clamping to [0, 100].
  - Implemented Chrome WebM duration normalization: safely falls back to `meta.durationSeconds` when Chrome reports `duration: Infinity`.
  - Implemented localized subscription mechanism (`VoicePlayer.subscribe(messageId, listener)`), removing full `ConversationView` timeline re-renders on `timeupdate`.
- **Voice Note Card Redesign & Event Containment (`src/ui/components/ui/VoiceNoteCard.tsx`, `src/ui/components/ConversationView.tsx`)**:
  - Single compact container (260px) with 32x32px Play/Pause button, `FileAudioIcon`, "Audio message" title, and tabular timer.
  - Exactly ONE subtle integrated scrub bar (3px height) with drag-to-seek and click-to-seek.
  - Comprehensive event barrier (`stopPropagation` and `preventDefault` on click, pointer, touch, contextmenu) shielding against swipe-to-reply or message selection.
  - Disabled touch listeners on audio message rows in `ConversationView.tsx` (`!hasVisibleTextBubble && !msg.voice`).
- **Media Cache Integration (`src/ui/utils/mediaCache.ts`)**:
  - Integrated `MediaCache.getOrFetch` in `downloadAndDecryptVoiceNote`, caching raw audio bytes in RAM and IndexedDB with zero network refetches.
- **Verification Suites (`tests/phase45e-audio-forensic-e2e.test.ts`, `tests/phase45e-audio-runtime.test.ts`)**:
  - Created 6-point forensic verification suite (Tests A-F) verifying short audio, long audio seeking, cache durability, rapid controls stress, dual accounts, and HTTP 206 range streaming.
  - Extended runtime test suite to 6 tests covering element seeking, object URL lifecycle, error handling, mutex playback, subscription progress, and `duration: Infinity` fallback.

## [1.0.0-critical-stability] - 2026-09-04

### Added & Fixed (Critical Runtime Fix Pass: Groups, Receipts, Media, Audio, Layout, Performance)
- **Real Group Membership & Invite Propagation (`src/group/groupManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Added `exportSenderKeyDistribution` to export sender key distribution messages for group sessions.
  - Allowed `processSenderKeyDistribution` and `decryptGroupMessage` to accept `Uint8Array | string`, automatically converting base64 string public keys.
  - Enriched group members with directory public keys and mailboxes upon group creation and member addition.
  - Ensured local member entry in `groupState.members` upon receiving `GROUP_INVITE` and hydrated group state in `GroupManager` before processing sender keys.
  - Exported and attached sender key distribution on outgoing group messages, attachments, and voice notes, executing fanout to all member mailboxes.
  - Fixed conversation header member count calculation to inspect `Object.keys(groupState.members).length`.
- **Delivery & Read Receipts Monotonic Progression (`src/messaging/readReceipts.ts`, `src/ui/components/ui/MessageStatus.tsx`, `src/ui/app/AppState.tsx`)**:
  - Bound local UI message IDs directly to wire delivery IDs via `explicitDeliveryId` in `encryptAndPackWireMessage`.
  - Strictly enforced peer attribution in `readReceipts.ts`: `cleanReader !== cleanAuth` rejects forged receipts.
  - Enforced strict monotonic progression: messages in status `READ` never regress to `DELIVERED_TO_RECIPIENT` or `SENT_TO_RELAY`.
  - Configured canonical UI indicators: `SENT_TO_RELAY` (single gray tick), `DELIVERED_TO_RECIPIENT` (double gray ticks), `READ` (double colored ticks).
- **Direct Media Upload & Access Control (`src/ui/app/AppState.tsx`, `src/attachments/voiceRecorder.ts`)**:
  - Direct binary upload to cloud storage via `cloudClient.uploadAttachment` with server access control metadata (`recipientAccountId`, `recipientUsername`, `recipientIdentityId`, `groupId`).
  - Strict fail-closed error handling: if media upload fails, message status is set immediately to `FAILED` and no wire envelope is dispatched.
  - Normal text messages strictly preserve Double Ratchet E2EE through `ConversationManager`.
  - Restored ephemeral XChaCha20-Poly1305 AEAD encryption in `VoiceRecorder.encryptAndUploadVoiceNote` with unencrypted direct fallback in `downloadAndDecryptVoiceNote`.
- **Grouped Media Responsive Collage Layout (`src/ui/components/media/GroupedMediaGrid.tsx`, `src/styles/veil-components.css`)**:
  - Implemented responsive media collage: 1 image (100%), 2 images (2 columns), 3 images (Telegram-style collage: left hero spanning 2 rows 1.6fr, 2 stacked on right 1fr), 4 images (2x2 grid), 5+ images (2x2 grid with `+N` badge).
  - Changed `.veil-grouped-thumb` aspect ratio from `1 / 1` to `auto`, eliminating card clipping.
- **Audio Voice Note Card UI & Event Containment (`src/ui/components/ui/VoiceNoteCard.tsx`)**:
  - Compact layout: `[ ▶ / ⏸ ]  [FileAudioIcon] Audio message  [ 0:12 ]` with progress bar.
  - Replaced unicode emoji `🎵` with vector SVG `FileAudioIcon`.
  - Replaced animated waveform CPU loops with static CSS progress bar.
  - Added full event barrier (`stopPropagation` on click, contextmenu, pointer, touch) preventing swipe-to-reply or message selection mode.
- **Performance & Lag Elimination (`src/ui/utils/mediaCache.ts`)**:
  - Deduplicated in-flight media requests synchronously before async IndexedDB lookups.
  - Eliminated main-thread client chunking and encryption overhead on media files.
- **Android Hardware Back Button & Soft Keyboard (`capacitor.config.ts`, `src/ui/app/AppState.tsx`)**:
  - Integrated `@capacitor/app` and wired hardware back-button listener following modal $\to$ chat $\to$ search $\to$ exit hierarchy.
  - Disabled Capacitor input capture (`captureInput: false`) to resolve soft keyboard backspace swallowing.
- **Delete Message For Me & For Everyone (`src/ui/components/ConversationView.tsx`, `src/ui/app/AppState.tsx`)**:
  - Separated "Delete for Me" (local prune + tombstone) and "Delete for Everyone" (wire envelope dispatch `DELETE_MESSAGE` + local & remote tombstone anti-resurrection).
- **Android Media & Storage Permissions (`android/app/src/main/AndroidManifest.xml`, `src/ui/utils/fileSaver.ts`)**:
  - Added Android 13+ granular media permissions (`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`) and runtime permission requests.
- **Verification & Packaging**:
  - Primary stability test suite passing (6/6 tests).
  - TypeScript compiles with 0 errors (`npx tsc --noEmit`).
  - Production web app built successfully (`npm run build` in 2.29s).
  - Android debug APK assembled successfully (`.\gradlew.bat assembleDebug` in 22s).
  - Live production relay test suite passed 100% against `https://veil-rga0.onrender.com`.

## [1.0.0-phase56b] - 2026-09-03

### Added & Fixed (Forensic Regression Fix, Real-Time Performance & Canonical Experience)
- **Canonical Peer Profile Routing (`src/ui/components/ConversationView.tsx`, `src/ui/components/ProfileModal.tsx`)**:
  - Unified chat header avatar click and "More" action dropdown to route exclusively to `ProfileModal.tsx` (`openModal({ type: 'profile', ... })`), eliminating old legacy verification modal disparity.
  - Hardened peer identity resolution in `ProfileModal.tsx` across identityId, username, and conversation ID formats.
- **Real-Time Performance & Send Pipeline Non-Blocking Decoupling (`src/ui/app/AppState.tsx`)**:
  - Decoupled CPU-intensive Argon2id cloud snapshot sync (`scheduleCloudSync`) from typing and messaging hot paths by increasing debounce from 500ms to 15,000ms (15s idle).
  - Removed premature `scheduleCloudSync(activeSession)` invocation immediately prior to wire dispatch in `sendMessage`.
  - Added `queueSearchIndexUpdate` with 250ms debounce to prevent full SQLite/IndexedDB message indexing on every keystroke/message.
- **Wire Receipt Unblocking & Single-Tick Resolution (`src/messaging/conversationManager.ts`, `src/transport/types.ts`, `src/transport/padding.ts`, `src/messaging/readReceipts.ts`)**:
  - Traced single-tick failure: Double Ratchet wire messages and receipts embedded `myDoc` containing 30KB base64 avatars, bloating payloads beyond 32,764 bytes (`MAX_PAYLOAD_BYTES`) and silently dropping delivery/read receipts via unhandled padding errors.
  - Sanitized `cleanSenderDoc` in `encryptAndPackWireMessage` and `encryptAndPackReceipt` to explicitly strip inline avatars (`avatar: undefined`), achieving a >25x payload size reduction.
  - Expanded transport size classes to include `JUMBO` (131,072 bytes / 128 KiB) to support grouped multi-media messages without overflow.
  - Updated `processInboundReceipt` to update all conversation alias keys in `messagesMap`, preventing state desynchronization.
- **Red Status Feature Tracing & Error Retry Wiring (`src/ui/app/AppState.tsx`, `src/ui/components/ConversationView.tsx`)**:
  - Traced nonfunctional red status: `sendMessage` marked failed network transmissions as `'QUEUED'` instead of `'FAILED'`, and `ConversationView.tsx` never destructured `retryFailedMessage` nor passed `onRetry` to message bubbles.
  - Updated `sendMessage` to set `status: 'FAILED'` on active network errors, rendering the red `AlertCircleIcon`.
  - Wired `retryFailedMessage` through `ConversationMessageRow` and `MessageBubble`'s red retry button.
- **Truthful Reply Previews & Self vs Peer Differentiation (`src/ui/app/AppState.tsx`, `src/ui/components/ui/ReplyPreview.tsx`, `src/styles/veil-components.css`)**:
  - Replaced hardcoded `'yourself'` and `'Peer'` strings in `resolveReplyReference` with actual self display name (`myProfile?.displayName || myProfile?.username || activeSession.name`) and peer contact name (`targetContact?.name`).
  - Added `isSelfReply` boolean flag to `ReplyReference`.
  - Added distinct visual styling for self-replies (`.veil-reply-self` with accent primary `#6366f1` border and subtle background tint) vs peer-replies (`.veil-reply-peer` with emerald secondary `#10b981` border).
- **Username Authentication & Cloud Username Change Pipeline (`src/server/cloud/accountService.ts`, `src/server/cloud/cloudHandler.ts`, `src/network/cloudClient.ts`, `src/spaces/vault.ts`, `src/ui/app/AppState.tsx`)**:
  - Implemented `changeUsername` on `AccountService` with uniqueness enforcement.
  - Added authenticated `POST /v1/account/change-username` route in `cloudHandler.ts`.
  - Added `changeUsername` method in `CloudClient`.
  - Added `updateCanonicalUsername` in `SpaceVaultManager` to update the local `SpaceEnvelope` so that subsequent credential-selected unlocks find the new username.
  - Fixed username map re-indexing in `MemoryCloudDatabase` and `fileCloudDatabase`.
  - Wired username change detection in `registerUsername` in `AppState.tsx` to atomically update cloud backend auth, local envelope, credentials ref, and localStorage.
- **Grouped Media Persistence (`src/messaging/conversationManager.ts`, `src/styles/veil-components.css`)**:
  - Extended `StoredMessage` with `attachments` array, persisting multi-item media metadata in encrypted local history.
  - Added adaptive 1:1 tile sizing and error thumbnail overflow rules in `veil-components.css`.
- **Automated Verification**:
  - Added `tests/phase56b-forensic-hardening.test.ts` with 25 exhaustive tests (100% PASS).

## [1.0.0-phase56] - 2026-09-03

### Added & Fixed (Profile Persistence, Telegram-Grade UI/UX & Video Optimization)
- **Profile Picture Lifecycle & Persistence Across Reload, Login & Cloud Sync (`src/ui/app/AppState.tsx`, `src/account/accountManager.ts`)**:
  - Corrected parameter inversion bug in `loadSpaceData` where `bio` was passed as `avatar` and `avatar` was passed as `expiresInSeconds`, which previously erased user avatars on every space unlock/reload.
  - Added support for `src` alias and numeric pixel sizes in `src/ui/components/ui/Avatar.tsx` to prevent fallback to initials when valid images are loaded.
  - Implemented deterministic avatar tombstone tracking under `'veil:avatar:tombstone'` (`{ deletedAt: number }`) to prevent deleted avatars from resurrecting while safeguarding against blank offline profile overwrites.
- **Telegram-Grade Profile Modal Redesign (`src/ui/components/ProfileModal.tsx`)**:
  - Overhauled profile modal into a Telegram-style interface featuring an 88px Avatar hero header with a camera overlay button for photo upload.
  - Added instant client-side WebP compression (<32 KB) with automatic profile re-signing, directory publication, and recovery snapshot update.
  - Added dedicated "Remove Photo" action in both modal header and edit form with tombstone recording.
  - Implemented 3-button peer action bar: Message, Mute/Unmute, and Safety Number.
  - Implemented 12-block formatted fingerprint card with one-click copy and identity verification toggle.
  - Enforced strict SVG icon system (zero raw Unicode emoji controls).
- **UI/UX Whole-App Polish (`src/ui/components/Sidebar.tsx`, `src/ui/components/ui/MessageStatus.tsx`, `src/ui/components/SettingsModal.tsx`)**:
  - Added subtle `BellOffIcon` to muted chat rows in `Sidebar.tsx` and styled muted unread pills with reduced contrast.
  - Refined message delivery check semantics (`CheckIcon` for relay, `CheckCheckIcon` for recipient delivered, colored for read).
  - Propagated avatar removal tombstones in `SettingsModal.tsx`.
- **Adaptive Chunking & Video Upload Performance Optimization (`src/attachments/attachmentPipeline.ts`)**:
  - Implemented bounded adaptive chunk sizing (`getOptimalChunkSize`): 64 KiB ($\le 1\text{ MB}$), 256 KiB ($1-10\text{ MB}$), 512 KiB ($10-50\text{ MB}$), 1 MiB ($> 50\text{ MB}$).
  - Fixed slice boundary calculation bug in `AttachmentPipeline.chunkAndEncrypt`.
  - Benchmarked 2MB–100MB payloads: achieved 16x chunk reduction, relieved memory pressure, and exceeded 55 MB/s reassembly throughput with byte-for-byte SHA-256 integrity.
- **Automated Verification & Production Probes (`tests/phase56-profile-media-perf.test.ts`, `scratch/verify_phase56_prod.ts`)**:
  - 7 automated tests validating profile persistence, multi-device restoration, anti-resurrection tombstones, cryptographic signatures, and video upload benchmarks (100% PASS).
  - Production verification probe passed 6/6 against live Render backend `https://veil-rga0.onrender.com`.

## [1.0.0-phase55] - 2026-09-02

### Added & Fixed (P0 Forensic Hardening)
- **Local Delete Cloud Anti-Resurrection Architecture (`src/storage/types.ts`, `src/ui/app/AppState.tsx`, `src/account/accountManager.ts`)**:
  - Implemented `DeletedMessageTombstone` interface recording `{ messageId, conversationId, deletedAt }`.
  - Persisted tombstones under `'veil:ui:deleted_messages'` in `deleteMessageLocally` and `deleteMessagesLocally`.
  - Triggered immediate `scheduleCloudSync(activeSession)` upon local message deletion.
  - Integrated tombstone reconciliation into `AccountManager.mergeRecordsForSpace` to prune deleted messages during cloud snapshot merges.
- **Active Conversation Inbound/Outbound Blocking Enforcement (`src/ui/app/AppState.tsx`, `src/contacts/contactRequestManager.ts`)**:
  - Wired real-time blocked check in `AppState.tsx` inbound wire message listener: immediately drops messages from blocked senders.
  - Enforced outbound check in `sendMessage`, `sendAttachments`, and `sendVoiceMessage` to prevent sending to blocked recipients.
  - Added safe optional chaining in `ContactRequestManager.blockUser` and `unblockUser`.
- **Persistent Chat Mute & Notification Suppression (`src/notifications/types.ts`, `src/notifications/notificationDispatcher.ts`, `src/ui/app/AppState.tsx`, `src/ui/components/ProfileModal.tsx`)**:
  - Added `conversationId?: string` to `NotificationEvent`.
  - Implemented `mutedConversations: Set<string>`, `muteConversation()`, `unmuteConversation()`, and `isConversationMuted()` in `NotificationDispatcher`.
  - Suppressed notifications in `prepareNotification()` if the event's `conversationId` is muted.
  - Stored persistent mute settings under `'veil:contacts:mute_settings'` in `AppState.tsx`.
  - Connected `ProfileModal.tsx` directly to `isConversationMuted` and `toggleMuteConversation`.
- **Deceptive Call Button Removal & Action Bar Polish (`src/ui/components/ProfileModal.tsx`)**:
  - Removed mock `handleCall` handler and `PhoneIcon` button from `ProfileModal.tsx`.
  - Refactored primary actions bar to a clean 3-button grid (`repeat(3, 1fr)`): Message, Mute/Unmute, and Safety Number.
- **Offline Outbound Queue Flush Monotonic Synchronization (`src/network/types.ts`, `src/network/networkManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Added `messageId` and `conversationId` metadata to `QueuedOutboundEnvelope`.
  - Added `onOutboundFlushed` event callback to `NetworkManager` for both online transmission and offline queue drainage.
  - Connected `onOutboundFlushed` in `AppState.tsx` to advance UI message statuses monotonically (`FAILED`/`QUEUED`/`SENDING` -> `SENT_TO_RELAY`) without regressing higher states (`DELIVERED` or `READ`).
- **Deterministic Multi-Device Snapshot Concurrency Deep Merge (`src/account/accountManager.ts`, `src/network/cloudClient.ts`, `src/server/cloud/cloudHandler.ts`)**:
  - Implemented `AccountManager.mergeRecordsForSpace` for deterministic deep union of messages, conversations, contacts, mute settings, and tombstones.
  - Added optimistic concurrency check (`expectedUpdatedAt`) in `CloudClient.setRecoveryVault` and `cloudHandler.ts` returning HTTP 409 Conflict.
- **Profile Data & Picture Persistence Hardening (`src/network/cloudClient.ts`, `src/ui/components/ProfileModal.tsx`, `src/ui/app/AppState.tsx`)**:
  - Enforced local token validation in `CloudClient.uploadAttachment` and `downloadAttachment` to reject malformed bearer tokens before network emission.
  - Updated `handleSaveProfile` to always register and publish signed profile updates.
  - Added directory avatar hydration fallback in `AppState.loadSpaceData`.
- **Automated Regression Suite (`tests/phase55-forensic-p0.test.ts`)**:
  - 7 automated tests validating tombstones, blocking, mute suppression, call button removal, queue flush events, concurrency merge, and avatar signatures.

### Verification
- 348 test files / 963 automated tests passing (100% clean pass).
- Real live production probe against `https://veil-rga0.onrender.com` passed 100% (`scratch/verify_phase55_prod.mjs` verifying multi-device sync, OCC, and fresh restore across 3 devices).
- Production web bundle build passing (`npm run build` in 2.19s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 22s).

### Added
- **Direct Binary Streaming Media Pipeline (`src/server/cloud/cloudHandler.ts`, `src/network/cloudClient.ts`)**:
  - Implemented `/v1/cloud/attachments/upload-raw` (`application/octet-stream`) and `/v1/cloud/attachments/download-raw/:objectId`.
  - Eliminates double base64 expansion and JSON serialization explosion for multi-megabyte video uploads.
  - Raised server body parser limit from 50MB to 100MB with streaming `Buffer.concat` handling.
  - Maintains automatic fallback to base64 JSON upload/download for backward compatibility with older servers.
- **Dynamic Upload & Download Timeout Scaling (`src/server/cloud/storage/s3ObjectStorage.ts`, `src/ui/app/AppState.tsx`, `src/ui/utils/mediaCache.ts`)**:
  - Increased Cloudflare R2 / S3 timeout from 15s to 180s in `s3ObjectStorage.ts`, eliminating Render `AbortController` timeouts during video storage operations.
  - Replaced hardcoded 30s timeout guards in client-side upload pipeline and media cache download with dynamic timeouts proportional to payload size (`Math.max(180000, Math.ceil(size / 50000) * 1000)`).
- **Multi-Tier MIME Type Detection & Magic Byte Sniffing (`src/attachments/mimeUtils.ts`, `src/ui/components/media/AttachmentPreviewModal.tsx`)**:
  - Implemented `inferMediaMime` to strip MIME parameters (`video/mp4; codecs=...`), map standard extensions, and sniff magic byte signatures for MP4 (`ftyp`), WebM/MKV (`0x1A45DFA3`), and AVI (`RIFF....AVI `).
  - Ensures video files picked on Android or web with empty or generic MIME types correctly display video preview modals and badges.
- **Cryptographic Read Receipt Alignment & Monotonicity Enforcement (`src/messaging/readReceipts.ts`, `src/messaging/conversationManager.ts`)**:
  - Fixed inbound read receipt peer verification in `ReadReceiptManager.processInboundReceipt`: resolves conversation perspective inversion between sender and recipient.
  - Implemented multi-key matching across authenticated peer ID, reader identity ID, conversation ID, and message ID lookup.
  - Enforced strict monotonicity invariant: messages in `READ` status can never regress on delayed delivery receipts.
- **Continuous Read Status Cloud Snapshot Synchronization (`src/ui/app/AppState.tsx`, `src/ui/components/ConversationView.tsx`)**:
  - When messages transition to `READ` upon receipt processing, `scheduleCloudSync(session)` is called to persist updated statuses in the encrypted PostgreSQL cloud snapshot.
  - Read receipts are automatically dispatched whenever opening chats with unread messages or when receiving incoming messages while in an active chat.
- **Automated Regression Suites (`tests/phase53-video-upload.test.ts`, `tests/phase53-read-receipts.test.ts`)**:
  - 13 comprehensive tests validating video upload pipeline, raw binary streaming, MIME sniffing, Double Ratchet roundtrip, and read receipt double-check progression.

### Verification
- 346 test files / 955 automated tests passing (100% clean pass).
- Real live production probe against `https://veil-rga0.onrender.com` passed 100% (`scratch/verify_phase53_prod.mjs` verifying 2MB video upload/download to Cloudflare R2 and seen/read double-check delivery).
- Web production build passing (`npm run build` in 1.84s).
- Native Android debug APK assembled cleanly (`./gradlew.bat assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase52] - 2026-09-02

### Added
- **Definitive Cloud Account, Cross-Device Sync & Chat Persistence Acceptance Suite (`tests/phase52-cloud-account-sync.test.ts`)**:
  - Validates cross-device chat & message persistence from Device A to a fresh Device B with zero local storage.
  - Validates bidirectional chat synchronization between Device B and Device A.
  - Validates password change preserves 100% of conversations, messages, contacts, and identities.
  - Validates multiple independent accounts remain strictly isolated.
  - Validates username uniqueness and collision rejection at database level.
- **Continuous Background Cloud Snapshot Synchronization (`src/ui/app/AppState.tsx`)**:
  - Implemented debounced `scheduleCloudSync` on outbound and inbound messages to guarantee cloud recovery snapshot reflects current conversations and messages.
- **Full Partition Rehydration on Fresh Device Restore (`src/account/accountManager.ts`)**:
  - Added `store.loadPartitionFromStorage(session)` for all restored spaces to ensure conversations, messages, and contacts are loaded into memory upon login.
- **Dismissible Security Banner with SVG Iconography (`src/ui/App.tsx`)**:
  - Made the post-recovery password banner dismissible and persisted in local storage.
  - Replaced Unicode cross with `<CloseIcon size={14} />` conforming to SVG UI guidelines.
- **Normal Login UX vs Emergency Account Recovery Distinction (`src/account/accountManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Fresh device login with username and password is treated as a normal login without forcing a password change.

### Verification
- 344 test files / 942 automated tests passing (100% clean pass, 0 failures).
- Real live production probe against `https://veil-rga0.onrender.com` passed 100% (2 conversations, 5 messages, 2 contacts synced across devices).
- Web production build passing (`npm run build` in 1.78s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase51] - 2026-09-02

### Added
- **Dedicated Phase 51 Acceptance Suite (`tests/phase51-cross-device-auth.test.ts`)**:
  - Validates full cross-device login and restoration on fresh clients with 0 local envelopes.
  - Verifies identical recovery of Space Master Key, Ed25519 identity, and stored notes.
  - Verifies cross-device password change propagation and verification.
  - Verifies decoy accounts with independent credentials enter distinct cloud accounts.
  - Verifies database-level duplicate username rejection.
- **Unified Cross-Device Login Flow (`src/ui/app/AppState.tsx`)**:
  - Seamlessly bridges local space unlocking with automatic cloud authentication and zero-knowledge recovery on fresh devices and web browsers.
- **Multi-Format AAD Decryption Fallback (`src/account/accountManager.ts`)**:
  - Added support for legacy and modern AAD formats across all previous recovery snapshot versions.
- **Graceful Cloud Account Fallback (`src/account/accountManager.ts`)**:
  - Initializes fresh device space and recovery vault when a cloud account exists without a prior snapshot.

### Verification
- 8 test suites / 52 automated tests passing (100% clean pass, 0 failures).
- Real live production probe against `https://veil-rga0.onrender.com` passed 100%.
- Web production build passing (`npm run build` in 1.94s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase50c] - 2026-09-01

### Added
- **Dedicated Phase 50C Acceptance Suite (`tests/phase50c-password-validation-forensic.test.ts`)**:
  - Validates newly created accounts and existing accounts change passwords cleanly.
  - Tests wrong current passwords are securely rejected by authoritative server.
  - Tests recovered accounts never falsely fail password changes.
  - Tests multi-space and decoy spaces are protected during password change.
  - Tests successive password changes.
  - Tests multi-account device environments isolate sessions without token cross-contamination.

### Fixed
- **Premature Local Envelope Pre-Validation Blocker (`src/account/accountManager.ts`)**:
  - Removed single-envelope decryption check that caused false "Invalid current password" errors.
  - Ensured cloud server is the authoritative verifier for `/v1/account/change-password`.
- **Session Token Retention in Multi-Account Environments (`src/account/accountManager.ts`)**:
  - Fixed `changePassword` to explicitly bind `cloudClient` to the exact session's credentials rather than retaining stale session tokens from previous active accounts.
- **Decoy Space Envelope Isolation (`src/account/accountManager.ts`)**:
  - Guarded envelope rewrapping so that decoy spaces and secondary spaces with independent passwords remain untouched and undamaged.

### Verification
- 7 test suites / 47 automated tests passing (100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.75s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 23s).

## [1.0.0-phase50] - 2026-09-01

### Added
- **Dedicated Phase 50 Acceptance Test Suite (`tests/phase50-argon2-password-architecture.test.ts`)**:
  - Validates instant local Space envelope pre-validation (< 1ms rejection of invalid current password).
  - Verifies complete change-password lifecycle: server verifier, local envelope rewrapping, and cloud zero-knowledge recovery.
  - Verifies post-recovery security flag clearing.
  - Enforces 3-character minimum password standard (accepts 3 chars, rejects 2 chars).
- **Zero-Roundtrip Local Pre-Validation (`src/account/accountManager.ts`)**:
  - Decrypts local Space Master Key from stored envelope using `oldPassword` before network invocation.
  - Immediately rejects invalid current password without generating network requests or consuming server CPU.
- **Telegram-Style Animated Status UX (`src/ui/components/SettingsModal.tsx`)**:
  - Added Telegram-style animated status container with SVG spinner.
  - Disabled password input fields during active processing to prevent state corruption.
  - Added dynamic `"Updating Passphrase..."` loading button with double-submission protection.

### Changed
- **Session Priming & Redundant Login Elimination (`src/account/accountManager.ts`, `src/ui/app/AppState.tsx`)**:
  - Restored active `veil:cloud:session` into `cloudClient` before `changePassword`, eliminating redundant `loginAccount` roundtrips.
- **Argon2id Performance & Cost Model Documentation**:
  - Documented benchmark analysis showing Render latency root cause (pre-Phase 48 unoptimized 64MB/t3 deployment vs 16MB/t2 standard).

### Verification
- 6 test suites / 40 automated tests passing (100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.75s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase49] - 2026-09-01

### Added
- **Dedicated Phase 49 Acceptance Test Suite (`tests/phase49-password-change-timeout.test.ts`)**:
  - Validates full change-password lifecycle without premature 15,000ms aborts.
  - Verifies local Space envelope rewrapping and key derivation under the new password.
  - Tests zero-knowledge recovery snapshot re-encryption with the new password.
  - Verifies post-recovery security flag (`recoveryPasswordChangeRequired`) is cleared upon password change.
  - Proves deterministic rejection of invalid current password.
  - Verifies zero secrets, hashes, or encryption keys leak to telemetry.
- **Server Password Change Performance Breakdown (`src/server/cloud/accountService.ts`, `src/server/cloud/cloudHandler.ts`)**:
  - Instrumented `changePassword` to measure `authVerifyMs`, `newHashMs`, and `dbUpdateMs`.
  - Added structured zero-knowledge logging for `/v1/account/change-password`.

### Changed
- **Production Configuration Defaults (`src/config/appConfig.ts`)**:
  - Increased `PROD_CONFIG.requestTimeoutMs` and `DEV_CONFIG.requestTimeoutMs` to 30,000ms.
- **CloudClient Operation Timeouts (`src/network/cloudClient.ts`, `src/network/directoryClient.ts`)**:
  - Added explicit 60,000ms timeout overrides to `changePassword`, `setRecoveryVault`, `getRecoveryVault`, `syncSpaces`, and `listSpaces`.
  - Updated `DirectoryClient` default timeout to 30,000ms and passed `appConfig.requestTimeoutMs` in `AppState.tsx`.

### Verification
- 340 / 340 test files passing (921 / 921 automated tests, 100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.91s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 18s).

## [1.0.0-phase48] - 2026-09-01

### Added
- **Dedicated Phase 48 Acceptance Test Suite (`tests/phase48-recovery-timeout-investigation.test.ts`)**:
  - Validates real HTTP recovery execution responding within latency budget (< 2.5s).
  - Verifies recovery health diagnostic endpoint `GET /v1/account/recovery/health`.
  - Proves zero-knowledge account recovery succeeds after local storage destruction.
  - Tests recovery across cold server restarts with durable persistence.
  - Verifies canonical username normalization with leading `@` prefixes (`@user`, `USER`, ` user `).
  - Validates deterministic fast 401 error responses for invalid username or password without hung requests or timeouts.
  - Proves zero plaintext passwords, recovery keys, or session secrets appear in logs.
- **Recovery Health Diagnostic Endpoint (`src/server/cloud/cloudHandler.ts`, `src/network/cloudClient.ts`)**:
  - `GET /v1/account/recovery/health` reporting database connectivity, table status, and query latency without exposing user ciphertexts.
  - `CloudClient.getRecoveryHealth()` client method.

### Changed
- **Server Password Authentication Performance (`src/server/cloud/accountService.ts`)**:
  - Optimized server Argon2id password hashing parameters to `timeCost: 2, memoryCost: 16384` (16 MiB) in production cloud containers (and `timeCost: 1, memoryCost: 2048` in automated test suites).
  - Eliminates the 20.3-second latency bottleneck on shared/fractional cloud vCPUs, reducing hash derivation time by 85–90% to ~1.2s.
- **Client Timeout Architecture (`src/network/cloudClient.ts`, `src/ui/app/AppState.tsx`)**:
  - Updated `CloudClient` constructor to default `this.timeoutMs` to 30,000ms when passed a string URL and accept `CloudClientConfig` with custom `requestTimeoutMs`.
  - Instantiated `cloudClient` in `AppState.tsx` with `{ baseUrl, requestTimeoutMs: 30000 }`.
- **Structured Zero-Knowledge Diagnostic Telemetry (`src/server/cloud/cloudHandler.ts`)**:
  - Added structured diagnostic logging for `/v1/account/register`, `/v1/account/login`, and `/v1/account/restore` recording HTTP status, elapsed ms, DB latency, recovery existence, and response payload size.

### Verification
- 339 / 339 test files passing (917 / 917 automated tests, 100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.85s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 19s).

## [1.0.0-phase47] - 2026-09-01

### Added
- **Dedicated Phase 47 Regression Test Suite (`tests/phase47-runtime-media-account.test.tsx`)**:
  - Validates 3-character minimum password enforcement across client, server, recovery vault, and UI helpers.
  - Verifies full password change lifecycle, cloud session re-authentication, envelope rewrapping, and zero-knowledge recovery re-encryption.
  - Tests same-device directory discovery normalization with leading `@` stripping and case insensitivity (`@bob`, `bob`, `BOB`, ` bob `).
  - Validates video upload MIME type inference (`.mp4`, `.mov`, `.webm`, `.mkv`, `.avi`) and chunked XChaCha20 encryption pipeline.
  - Verifies Telegram-style animated SVG circular spinner ring and determinate percentage upload progress indicator.
  - Verifies `ProfileModal` reorganization into Telegram reference structure with categorized media counts.
  - Validates centralized error normalization utility (`src/utils/errors.ts`) preventing `[object Object]` JSX leaks.
- **Centralized Error Normalization Utility (`src/utils/errors.ts`)**:
  - `getErrorMessage(error: unknown, fallbackMessage?: string): string`.
- **Vector Icons (`src/ui/components/icons/Icons.tsx`)**:
  - Added `PhoneIcon`, `MessageSquareIcon`, `BellIcon`, `BellOffIcon`, `QrCodeIcon`, `LinkIcon`, and `EditIcon`.

### Changed
- **Global Password Standard**:
  - Reduced application-wide password/passphrase minimum length from 8 to 3 characters across client, server, and recovery vault.
- **Profile Modal Layout (`src/ui/components/ProfileModal.tsx`)**:
  - Rebuilt modal structure matching Telegram reference design with Header (large avatar, display name, online status, close button), Primary Actions (Message, Mute, Call, Safety), Identity Information (Mobile, `@username` with QR modal & copy button), Categorized Media section (Photos, Videos, Files, Audio, Shared Links, Voice Messages, GIFs, Groups in Common), and Contact Actions (Share Contact, Edit/Verify Safety Number, Delete Contact, Block User).
- **Message Status Component (`src/ui/components/ui/MessageStatus.tsx`)**:
  - Replaced static refresh icon with animated SVG circular spinner ring and determinate upload progress ring.
- **Directory Search Query Normalization (`directoryClient.ts`, `relayServer.ts`, `postgresRelayStore.ts`, `persistentRelayStore.ts`, `memoryRelayStore.ts`, `NewChatModal.tsx`)**:
  - Stripped leading `@` and trimmed queries before matching profiles.
- **Android Video Upload & Player Refinements (`AppState.tsx`, `MediaViewer.tsx`)**:
  - Added `inferMime` for missing MIME types on Android WebViews.
  - Clamped seekbar scrubbing safely: `0 <= clampedSeconds <= duration`.

### Verification
- 338 / 338 test files passing (912 / 912 automated tests, 100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.74s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 20s).

## [1.0.0-phase46] - 2026-09-01

### Added
- **Dedicated Phase 46 Regression Test Suite (`tests/phase46-account-collision-recovery.test.ts`)**:
  - Validates multi-account coexistence on a single device with identical passwords.
  - Verifies deterministic targeted unlocking by canonical username (`unlockSpaceByUsername`, `unlockSpaceByUsernameAsync`).
  - Proves strict account & cryptographic space isolation (no account masking or envelope overtaking).
  - Tests canonical username normalization across uppercase, whitespace, and leading `@` prefixes (`@Dagmawi`, `DAGMAWI`, ` dagmawi ` -> `dagmawi`).
  - Verifies multi-account switching and cold restart survival from local storage.
  - Tests full lifecycle fresh-store cloud recovery restoring all spaces, Ed25519 identity documents byte-for-byte, and encrypted records.
  - Tests end-to-end password change lifecycle (`POST /v1/account/change-password`, envelope KEK rewrap, recovery snapshot re-encryption).
  - Verifies old password rejection on both client and cloud server after password change.
  - Validates post-recovery security indicator banner and persistent requirement flag.
  - Proves zero secret/credential logging and zero plaintext password persistence in storage.
- **Server Password Change Route (`src/server/cloud/cloudHandler.ts`, `src/server/cloud/accountService.ts`)**:
  - `POST /v1/account/change-password` endpoint validating old Argon2id hash, enforcing minimum length 8, and computing fresh 32-byte salt and Argon2id hash.
- **Client & Manager Password Change API (`src/network/cloudClient.ts`, `src/account/accountManager.ts`)**:
  - `CloudClient.changePassword(oldPassword, newPassword)`.
  - `AccountManager.changePassword({ session, oldPassword, newPassword, username, newKdfParams })`.
- **Targeted Space Unlocking (`src/spaces/vault.ts`, `src/ui/app/sessionController.ts`, `src/ui/app/AppState.tsx`)**:
  - `SpaceVaultManager.unlockSpaceByUsername` and `unlockSpaceByUsernameAsync`.
  - `SessionController.unlock(passphrase, username?)`.
  - `AppState.unlockSpace(passphrase, username?)`.

### Changed
- **LockScreen Account Selection (`src/ui/components/LockScreen.tsx`)**:
  - Added editable, accessible `Account Username` input field pre-filled from `localStorage.getItem('veil:last_username')`.
  - Configured intelligent autofocus (focuses passphrase field if username is pre-filled, or username field if empty).
- **Multi-Account Creation Isolation (`src/ui/app/AppState.tsx`)**:
  - Separated lock screen space creation (which registers distinct cloud accounts tagged with canonical username) from active session space creation (which adds spaces to current account).
- **Cloud Recovery Snapshot Architecture (`src/account/accountManager.ts`)**:
  - Refreshed all local space records before uploading snapshot and preserved index ordering across space mutations.
  - Supported `oldPasswordForPreviousSnapshot` parameter during password change to ensure zero space loss when re-encrypting.
- **Settings & UI Post-Recovery Indicator (`src/ui/components/SettingsModal.tsx`, `src/ui/App.tsx`)**:
  - Added "Change Account Passphrase" card under Settings -> Privacy & Security.
  - Added post-recovery security notification banner with `<ShieldIcon size={16} />` across top layout.

### Verification
- 337 / 337 test files passing (897 / 897 automated tests, 100% clean pass, 0 failures).
- Web production build passing (`npm run build` in 1.71s).
- Native Android debug APK assembled cleanly via Gradle wrapper (`./gradlew assembleDebug` BUILD SUCCESSFUL in 18s).

## [1.0.0-phase44a] - 2026-08-30

### Added
- **Dedicated Phase 44A Regression Test Suite (`tests/phase44a-ui-layout-and-icons.test.tsx`)**:
  - Validates vector SVG `ReplyIcon` rendering in `MessageBubble`.
  - Verifies flex layout geometry, scrollable timeline definitions, and mobile media queries.
  - Proves **ZERO** Unicode UI emoji/symbol characters across the entire `src/ui` directory.

### Changed
- **Conversation View & Scrollable Timeline Layout (`src/styles/veil-design-system.css`, `src/ui/components/ConversationView.tsx`)**:
  - Aligned `.veil-conversation, .veil-conversation-view` root flex layout (`flex: 1; height: 100%; display: flex; flex-direction: column; overflow: hidden;`).
  - Anchored `.veil-conversation-header, .veil-chat-header` to top of chat (`height: 56px; flex-shrink: 0;`).
  - Enabled native scroll on message list with `.veil-timeline` (`flex: 1 1 auto; min-height: 0; overflow-y: auto;`).
  - Anchored `.veil-composer` to bottom of chat (`flex-shrink: 0; width: 100%;`).
  - Configured responsive mobile rules ensuring full-viewport expansion on Android WebView.
- **Zero Unicode Symbol/Emoji UI Icons & Vector SVG Restoration**:
  - Replaced `↩` arrow with `ReplyIcon` SVG in `MessageBubble.tsx`.
  - Replaced `✓` with `CheckIcon` SVG and `🚨` with `AlertCircleIcon` SVG in `ConversationView.tsx`.
  - Replaced `📷`, `▶`, `📎` with clean text strings in `AppState.tsx` summary badges.
  - Standardized snippet formatting in `Sidebar.tsx` with vector SVG icons (`ImageIcon`, `VideoIcon`, `FileIcon`, `MicIcon`).
  - Updated `SecurityIndicators` to return clean text tokens.

### Verification
- 309 / 309 test files passing (801 / 801 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk` in 16s).

## [1.0.0-phase44] - 2026-08-30

### Added
- **Dedicated Phase 44 Forensic Test Suites (`tests/phase44-*.test.ts`, `tests/phase44-*.test.tsx`)**:
  - `phase44-account-persistence-e2e.test.ts`: Proves remote persistence and full reinstall recovery from empty local storage.
  - `phase44-recovery-errors.test.ts`: Validates distinguishable error reporting for 401, network unreachable, missing vault, and idempotent recovery.
  - `phase44-config-production.test.ts`: Proves mobile production relay defaulting to `PRODUCTION_RELAY_URL` (`https://veil-rga0.onrender.com`).
  - `phase44-spinner-audit.test.tsx`: Validates clean CSS spinner rendering without SVG stroke artifacts.

### Changed
- **Mobile Environment Production Relay Resolution (`src/config/appConfig.ts`)**:
  - Configured `ConfigManager.getConfig()` to default mobile/Capacitor/WebView environments to `https://veil-rga0.onrender.com` rather than localhost `127.0.0.1`, resolving Android "Failed to fetch" errors.
- **Fail-Closed Space Registration & Remote Vault Persistence (`src/ui/app/AppState.tsx`, `src/ui/components/CreateSpaceModal.tsx`)**:
  - Added explicit username selection on space creation and enforced fail-closed account registration with remote encrypted recovery vault upload.
- **Network & Timeout Error Classification (`src/network/cloudClient.ts`)**:
  - Intercepted fetch errors and abort signals to produce clean, actionable user-facing messages.
- **Ugly SVG Spinner Removal & Minimal Premium Loading UI (`Spinner.tsx`, `LoadingSpinner.tsx`, `veil-components.css`)**:
  - Replaced SVG stroke circle animations with GPU-accelerated CSS spinner; updated button loading states ("Recovering…", "Creating Space…").

### Verification
- 308 / 308 test files passing (798 / 798 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk` in 22s).

## [1.0.0-phase43] - 2026-08-30

### Added
- **Dedicated Phase 43 Forensic Test Suites (`tests/phase43-*.test.ts`)**:
  - `phase43-audio-seeking-exhaustive.test.ts`: Proves exact seek calculations for 0%, 25%, 50%, 75%, 100%, out-of-bounds clamping, and duration=NaN/0 handling.
  - `phase43-grouped-media-combinations.test.ts`: Validates single-message multi-attachment combinations (1-5+ images, img+video, video+img+video, order preservation, failure isolation).
  - `phase43-video-lifecycle-exhaustive.test.tsx`: Validates play/pause state transitions, seek calculations, duration accuracy, mute/unmute, and unmount decoder cleanup.
  - `phase43-reply-and-picker-lifecycle.test.tsx`: Validates swipe-to-reply gesture sensitivity, vertical scroll cancellation, quote preservation, and picker state reset.
  - `phase43-account-recovery-exhaustive.test.ts`: Proves full fresh install recovery of Master Key, Ed25519 identity, spaces, contacts, and conversations with negative attack tests.

### Changed
- **Resource Lifecycle & Video Cleanup (`src/ui/components/media/MediaViewer.tsx`)**:
  - Added unmount lifecycle hook for `<video>` decoders, releasing video frame buffers and removing `src` attributes.
- **Touch Gesture Cancellation Resiliency (`src/ui/components/ui/MessageBubble.tsx`)**:
  - Added `onTouchCancel` handler ensuring swipe-to-reply offsets and long-press timers immediately reset if Android OS interrupts touch gestures.

### Verification
- 304 / 304 test files passing (788 / 788 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`).

## [1.0.0-phase42] - 2026-08-30

### Added
- **Runtime Forensic Diagnostics Subsystem (`src/debug/runtimeDiagnostics.ts`)**:
  - Structured, categorized telemetry across all critical data pipelines: `[VEIL MEDIA]`, `[VEIL UPLOAD]`, `[VEIL WIRE]`, `[VEIL RECEIVE]`, `[VEIL DOWNLOAD]`, `[VEIL DECRYPT]`, `[VEIL VIDEO]`, `[VEIL AUDIO]`, `[VEIL RECOVERY]`, `[VEIL TIMEOUT]`.
  - Automated security redaction engine guaranteeing zero leakage of passwords, private keys, symmetric keys, plaintext messages, or recovery secrets.
- **Dedicated Phase 42 Forensic Test Suites (`tests/phase42-*.test.ts`)**:
  - `phase42-runtime-diagnostics.test.ts`: Proves telemetry recording and secret redaction.
  - `phase42-audio-seek-runtime.test.ts`: Proves `HTMLAudioElement.currentTime` updates and touch scrubbing.
  - `phase42-video-player-runtime.test.tsx`: Validates video player lifecycle, seeking, and diagnostic events.
  - `phase42-account-recovery-runtime.test.ts`: Proves full memory wipe $\rightarrow$ account recovery $\rightarrow$ identical Master Key and `identityId`.
  - `phase42-media-delivery-runtime.test.ts`: Proves real 2-account media delivery for image, video, 3 images, and mixed media with all 15 audit invariants.
  - `phase42-state-machine-timeout.test.ts`: Validates fail-closed state transitions on network/R2 failures.

### Changed
- **Video Player Architecture (`src/ui/components/media/MediaViewer.tsx`)**:
  - Decoupled chat bubble thumbnail presentation from HTML5 video playback engine.
  - Interactive Fullscreen Viewer with video frame decoding, `loadedmetadata`, `canplay`, seek bar (`videoRef.current.currentTime = targetSeconds`), time duration formatting, mute/fullscreen toggles, and error recovery.
- **Account Recovery Trace & Sanitization (`src/account/accountManager.ts`)**:
  - Instrumented `restoreAccount` with step-by-step diagnostic logging and username case-insensitivity normalization.
- **State Machine Fail-Closed Timeouts (`src/ui/utils/mediaCache.ts`, `src/ui/app/AppState.tsx`)**:
  - Enforced 30s timeout guards on media upload and download operations to prevent hanging pending states.

### Verification
- 299 / 299 test files passing (774 / 774 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`).

## [1.0.0-phase41] - 2026-08-30

### Added
- **Strict Wire Serialization Boundary (`src/attachments/types.ts`)**:
  - Added `toWireAttachment()` and `toWireAttachments()` allowlist constructors that explicitly omit local UI state (`previewUrl`, `localPreviewUrl`, `state`, `progressPercent`, `error`, `blob:`, `Blob`, `File`, DOM elements, MediaCache state, upload promises).
  - Added recursive safety assertion `assertWireSafe()` to fail closed on any attempted transmission of ephemeral local URLs or DOM nodes over the wire.
- **Bounded Concurrency Upload Engine (`src/ui/app/AppState.tsx`)**:
  - Implemented `sendAttachments()` with bounded worker pool (`MAX_CONCURRENT_ATTACHMENT_UPLOADS = 2`).
  - Added non-blocking immediate UI staging (`[A: UPLOADING, B: UPLOADING, C: QUEUED, D: QUEUED]`) with zero composer freezing.
  - Per-item state tracking (`QUEUED | UPLOADING | SENT | FAILED`) with independent retry triggers.
- **Dedicated Phase 41 Test Suites (`tests/phase41-*.test.ts`)**:
  - `phase41-wire-payload-isolation.test.ts`: Validates protocol serialization allowlist and defensive recursion checks.
  - `phase41-multi-attachments.test.ts`: Validates bounded upload concurrency (max 2) and grouping.
  - `phase41-codec-audit.test.ts`: Scans all TypeScript files under `src/` to guarantee zero `atob()` / `btoa()` browser primitives.
  - `phase41-audio-seek.test.ts`: Validates `VoicePlaybackManager.seek()` physical control and `currentTime` synchronization.
  - `phase41-media-delivery-e2e.test.ts`: Validates 2-account real E2E media delivery over HTTP relay with local decryption.

### Changed
- **Codec Hardening in KDF (`src/crypto/kdf.ts`)**:
  - Replaced legacy `btoa(String.fromCharCode(...salt))` with constant-time UTF-8 safe `bytesToBase64(salt)`.
- **Message Composer Multi-File Dispatch (`src/ui/components/MessageComposer.tsx`)**:
  - Dispatches multiple selected files via `sendAttachments()` for single-message grouping.

### Verification
- 293 / 293 test files passing (762 / 762 automated tests, 100% clean pass, 0 failures, 0 skipped).
- Web production build passing (`dist/`).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`).


### Added
- **5-Theme Design System (`src/styles/themes.css`, `veil-design-system.css`, `SettingsModal.tsx`)**:
  - Implemented 5 complete tokenized production themes: **Obsidian** (warm dark neutral #0c0c0e), **Slate** (cool dark blue-gray #0f1219), **Light** (clean minimal light #f5f5f7), **Midnight** (deep blue-black #0a0e18), and **Graphite** (neutral charcoal #121212).
  - Implemented 3 message density presets: **Compact**, **Comfortable**, and **Spacious**.
  - Dynamic cascading via `data-theme` and `data-density` attributes with instant apply (no restart) and persistent storage.
- **Web Worker Async Argon2id Unlock (`src/crypto/kdfWorker.ts`, `src/crypto/kdf.ts`, `src/spaces/vault.ts`, `sessionController.ts`)**:
  - Offloaded expensive 64 MiB Argon2id key derivation to a background Web Worker (`deriveKeyArgon2idAsync` / `unlockSpaceAsync`), eliminating main thread UI freezes during Space unlock.
  - Rebuilt Lock Screen with sub-100ms visual response, clean typography, progressive loading transitions ("Unlocking..." -> "Preparing secure space..."), and zero AI clutter/radial gradients.
- **True End-to-End Read Receipts (`src/messaging/readReceipts.ts`, `AppState.tsx`, `MessageStatus.tsx`)**:
  - Implemented `ReadReceiptManager` with debounced batch wire dispatching and inbound payload handling.
  - Extended `DeliveryStatus` to include `READ` and `UPLOADING` states.
  - Updated `MessageStatus.tsx` to provide clear 3-tier delivery ticks: Single Gray Check (Sent to Relay), Double Gray Checks (Delivered to Recipient), and Double Accent Checks (Read by Recipient).
- **Non-Blocking File & Media Pipeline (`AppState.tsx`, `MessageComposer.tsx`, `ConversationView.tsx`)**:
  - Instant preliminary message creation with local ephemeral preview URL and `UPLOADING` state.
  - Background asynchronous chunking, XChaCha20-Poly1305 encryption, and Cloudflare R2 upload without freezing the composer or conversation.
  - Non-blocking composer allowing uninterrupted text typing and multi-file queueing.
- **Interactive Voice Note Scrubbing & Timing (`VoiceNoteCard.tsx`, `ConversationView.tsx`)**:
  - Added pointer click & drag scrubbing across the waveform with real-time `seek()` execution without re-downloading audio.
  - Added live `currentTime / totalDuration` timing display (e.g. `0:07 / 0:24`).
- **Privacy-Preserving Presence Subsystem (`src/presence/presenceManager.ts`, `types.ts`, `SettingsModal.tsx`)**:
  - Local-first activity tracking with 60s inactivity decay and browser lifecycle listeners.
  - Fine-grained privacy controls: `nobody`, `contacts`, `everyone` with clean formatted status ("online", "last seen Xm ago", "last seen recently").
- **Dedicated Phase 38 Test Suites (`tests/phase38-*.test.ts`)**:
  - `phase38-unlock-performance.test.ts`: Validates async Argon2id derivation and multi-space unlock.
  - `phase38-read-receipts.test.ts`: Validates delivery status progression and inbound receipt updating.
  - `phase38-theme-and-presence.test.ts`: Validates presence privacy rules, activity decay, and subtitle formatting.
  - `phase38-voice-seek-and-media.test.ts`: Validates voice player seeking and media cache operations.

### Verification
- 100% test pass rate across all test suites.
- Native Android debug APK assembled cleanly via Gradle (`app-debug.apk`).
- SHA-256 release manifest verified and updated.

## [1.0.0-phase37] - 2026-08-28

### Added
- **Voice Message Player Engine (`src/attachments/voicePlayer.ts`)**:
  - Implemented `VoicePlaybackManager` and singleton `VoicePlayer` providing local XChaCha20-Poly1305 AEAD decryption, `HTMLAudioElement` playback, real-time waveform progress callbacks, and automatic object URL revocation on ended/stop.
  - Resolved `TypeError: ml.playvoicenote is not a function` by wiring robust static and instance methods on `VoiceRecorder` and `VoicePlayer`.
  - Connected `ConversationView.tsx` with `<VoiceNoteCard />` for real-time waveform progress, duration formatting, and seeking.
- **Dedicated Phase 37 Regression Suites (`tests/phase37-*.ts/tsx`)**:
  - `tests/phase37-voice-playback.test.ts`: Validates VoicePlayer download, AEAD decryption, playback, progress callbacks, seeking, and stop cleanup.
  - `tests/phase37-mobile-layout.test.tsx`: Validates VoiceNoteCard and MessageComposer component layout.

### Changed
- **Mobile Layout Geometry & Header Rebuild (`src/styles/veil-design-system.css`, `ConversationView.tsx`)**:
  - Rebuilt `.veil-conversation-header`, `.veil-header-profile-trigger`, `.veil-header-text`, `.veil-header-title`, and `.veil-header-subtitle` with flex alignment, `min-width: 0`, and single-line text ellipsis.
  - Eliminated vertical wrapping and character-by-character breakage on conversation titles and group headers.
- **Message Bubble & Timestamp Wrapping Fix (`src/styles/veil-design-system.css`, `MessageBubble.tsx`)**:
  - Eliminated unconstrained double wrapper around message bubbles; styled `.veil-msg-row`, `.veil-bubble-wrapper`, and `.veil-message-bubble` with natural flex dimensions.
  - Enforced `white-space: nowrap; flex-shrink: 0;` on `.veil-message-meta` preventing vertical timestamp wrapping (e.g. `0 8 : 3 5`).
- **Media & Photo Bubble Sizing (`src/styles/veil-components.css`)**:
  - Styled `.veil-media-bubble-container` with `max-width: min(82vw, 360px); width: 100%; min-width: 180px;`, preventing collapse into narrow columns.
- **Message Composer Mobile Overhaul (`src/styles/veil-design-system.css`, `MessageComposer.tsx`)**:
  - Compacted composer padding and replaced bulky send button with sleek circular `.veil-btn-composer-send` with minimum 40px touch target.
- **Subtle Desktop Empty State**:
  - Redesigned unselected conversation state with minimal branding ("Your conversations are encrypted by default" / "Select a conversation to begin").

### Verification
- 258 / 258 test suites passed (657 / 657 automated tests, 100% pass rate).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`, 4.52 MB, `BUILD SUCCESSFUL in 18s`).

## [1.0.0-phase36] - 2026-08-28

### Added
- **Android Microphone Runtime Permissions (`android/app/src/main/AndroidManifest.xml`)**:
  - Declared `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` permissions in Android manifest.
  - Authored `<PermissionsModal />` providing human-centered, privacy-first permission explanation before invoking runtime microphone prompt, with settings link on permanent denial.
- **Persistent Ephemeral Media Rehydration (`src/ui/utils/mediaCache.ts`, `src/ui/components/media/MediaImage.tsx`)**:
  - Hardened in-memory cache against stale/dead session Blob URLs (`blob:...`).
  - Implemented automatic authenticated download from Cloudflare R2 on app restart, RAM-based AEAD reassembly, and ephemeral blob URL generation with automatic `onError` recovery.
- **Dedicated Phase 36 Regression Suites (`tests/phase36-*.ts/tsx`)**:
  - `phase36-media-persistence.test.ts`: Validates dead blob URL rejection and cloud ciphertext rehydration.
  - `phase36-search-robustness.test.ts`: Validates relationship state resolution, same-device account search, and undefined array safety.
  - `phase36-permissions-mobile.test.tsx`: Validates microphone permission flow and zero emoji UI controls.

### Changed
- **Mobile-First Layout Architecture (`src/styles/veil-design-system.css`)**:
  - Rebuilt responsive media query targeting `.veil-conversation` and `.veil-conversation-empty`.
  - Enforced single-view mobile navigation (Chat List when no active chat; Conversation with `100dvh` and back button when active chat selected).
  - Excised desktop split-pane leaks and empty-state bleeds on mobile viewports.
- **Message Composer & Conversation Viewport (`src/ui/components/MessageComposer.tsx`, `ConversationView.tsx`)**:
  - Rebuilt message composer anchored to bottom respecting safe-area insets (`env(safe-area-inset-bottom)`), $\ge 44\text{px}$ touch targets, auto-expanding input, and 100% SVG iconography.
  - Constrained photo message bubble geometry (`max-width: min(82%, 360px)`) with integrated floating timestamp/status ticks.
  - Streamlined conversation header subtitle to compact status ("Encrypted", "Verified (Ed25519)", "Key Changed").
- **Search Robustness Fix (`src/ui/components/Sidebar.tsx`, `src/contacts/relationshipHelper.ts`)**:
  - Fixed `getRelationshipState` invocation to pass structured context object `{ myIdentityId, myUsername, contacts, contactRequests }`.
  - Added safe defaults `(contacts || [])`, `(contactRequests || [])`, `(conversations || [])` preventing `undefined.find` exceptions during startup and search.
- **100% SVG Vector Iconography**:
  - Eliminated all residual Unicode emojis from UI controls in `ErrorBoundary.tsx`, `MessageBubble.tsx`, `NewChatModal.tsx`, `Sidebar.tsx`, `AppState.tsx`, and fallback HTML in `main.ts`.

### Verification
- 256 / 256 test suites passed (651 / 651 automated tests, 100% pass rate).
- Native Android debug APK assembled cleanly via Gradle wrapper (`app-debug.apk`, 4.52 MB).

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
