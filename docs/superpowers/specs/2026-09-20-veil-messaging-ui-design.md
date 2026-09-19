# VEIL Messaging UI Design

## Direction

Create one unified professional messaging system that combines three approved qualities:

- **Chat-first calm:** the active conversation is the primary task surface, with clear message rhythm, restrained motion, and a confident composer.
- **Telegram-style workspace:** conversation navigation is searchable, information-dense, and responsive without making the chat feel like an admin panel.
- **Quiet premium:** contrast, typography, touch targets, media surfaces, and light/dark variants feel deliberate and accessible.

This is a UI refinement and composition pass. Existing encryption, account/session flows, delivery/read receipts, recovery, media policy, gestures, and message semantics remain unchanged.

## Surfaces in scope

1. Conversation list: search, active conversation, unread count, pinned/muted indicators, avatar hierarchy, preview truncation, and responsive transition into chat.
2. Chat header: stable back affordance, identity/status hierarchy, action grouping, and selection/search states.
3. Timeline: consistent vertical rhythm, date separators, outgoing/incoming bubble geometry, grouped-message joins, reply previews, reactions, attachments, voice notes, and receipt metadata.
4. Composer: attachment affordance, input island, emoji action, reply banner, recording/send states, keyboard-safe layout, and touch feedback.
5. Media surfaces: recent-file/media picker, attachment previews, upload progress, media viewer controls, and save/share affordances.
6. Shared overlays and states: empty, loading, error, disabled, focused, selected, and keyboard-open states.

## Visual system

- Preserve VEIL’s existing privacy-first blue/slate identity and token architecture; extend tokens instead of introducing one-off colors.
- Use one consistent icon stroke and button vocabulary; remove emoji/unicode glyphs where a real icon already exists.
- Use 8px spacing rhythm with larger section separation and 12–16px surface radii; pills remain reserved for compact controls.
- Keep body text at accessible contrast and provide visible keyboard focus states.
- Support dark and light themes using the same semantic roles, not separate component-specific palettes.

## Interaction and motion

- Keep existing horizontal edge-back, reply-swipe, focused-media down-swipe, and vertical-scroll arbitration intact.
- Add only short state motion: 150–220ms ease-out for composer expansion, selection, attachment reveal, and list-to-chat transitions.
- Never animate every message on mount or use decorative motion during scroll.
- Preserve virtualization/windowing and avoid layout reads in scroll handlers.

## Component boundaries

- `ConversationView` owns chat composition and state wiring; styling changes should remain presentational.
- `ConversationMessageRow`/`MessageBubble` own message geometry and message-type presentation.
- `MessageComposer` owns input, attachments, reply, recording, and send-state presentation.
- Shared CSS tokens and component styles remain in the existing design-system/component stylesheets.
- Any new reusable visual primitive must be a small, stateless component with an explicit state API.

## Acceptance criteria

- Existing focused Track 1–4 and Phase 102 performance tests remain passing.
- New UI regression coverage verifies responsive shell states, composer states, message-type classes, media-picker states, focus visibility, and light/dark semantic tokens.
- No protocol, crypto, persistence, recipient authorization, or receipt behavior changes.
- Web/release build succeeds and Capacitor sync succeeds.
- Android source/assets are synced; physical Android verification remains a user task.

## Implementation order

1. Extract/normalize semantic UI tokens and icon/button states.
2. Refine conversation list and responsive shell.
3. Refine chat header and timeline/bubble geometry.
4. Refine composer and attachment/media surfaces.
5. Add regression tests, run detector and bounded visual QA, then build and sync.
