# Mobile Navigation Gestures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deliberate edge-swipe to leave a mobile chat and a downward drag to dismiss focused media, without interfering with replying, scrolling, media controls, or image zoom.

**Architecture:** Keep gesture interpretation pure in one UI utility so thresholds and cancellation rules have direct unit coverage. `ConversationView` owns chat navigation because it owns `selectConversation`; `MediaViewer` owns dismiss progress because it owns the fullscreen overlay. Neither gesture enters message-row reply handling.

**Tech Stack:** React 19, TypeScript, Vitest, existing VEIL design tokens and touch events.

---

### Task 1: Define and test gesture decisions

**Files:**
- Create: `src/ui/utils/mobileGesturePhysics.ts`
- Create: `tests/phase71-mobile-navigation-gestures.test.ts`

- [ ] **Step 1: Write failing unit tests**

Test `shouldCompleteConversationBackSwipe` with an LTR left-edge start, a rightward 72px drag, vertical-dominant cancellation, a non-edge start, and RTL reversal. Test `shouldDismissMediaByDrag` with a downward 120px drag, a horizontal gallery-like drag, an upward drag, and zoomed media.

- [ ] **Step 2: Run the new test file and verify it fails because the helper module is missing**

Run: `npx vitest run tests/phase71-mobile-navigation-gestures.test.ts`

Expected: module-resolution failure for `mobileGesturePhysics.ts`.

- [ ] **Step 3: Implement only the pure gesture decisions**

Export `CHAT_BACK_EDGE_PX = 24`, `CHAT_BACK_TRIGGER_PX = 72`, and `MEDIA_DISMISS_TRIGGER_PX = 120`. A chat-back gesture is valid only from the logical start edge, in its logical forward direction, and when horizontal movement dominates. A media drag is valid only when not zoomed, downward, and vertically dominant.

- [ ] **Step 4: Run the gesture tests**

Run: `npx vitest run tests/phase71-mobile-navigation-gestures.test.ts`

Expected: all gesture-decision tests pass.

### Task 2: Add mobile chat edge-swipe back

**Files:**
- Modify: `src/ui/components/ConversationView.tsx`
- Test: `tests/phase71-mobile-navigation-gestures.test.ts`

- [ ] **Step 1: Extend the failing test with a chat-back completion case that represents the component contract**

Use an LTR start at x=12 and end at x=88; assert the pure decision is true. Use a same-distance vertical move and assert false.

- [ ] **Step 2: Run the test and verify the missing helper behavior fails**

Run: `npx vitest run tests/phase71-mobile-navigation-gestures.test.ts`

- [ ] **Step 3: Wire the helper to the conversation root**

Track only one-finger touches that begin at the logical screen edge, ignore selection mode and focused media, translate the conversation a capped amount while dragging, call `selectConversation(null)` only when the threshold completes, and restore the position for every cancellation path. Existing header Back control remains unchanged.

- [ ] **Step 4: Run focused gesture and conversation tests**

Run: `npx vitest run tests/phase71-mobile-navigation-gestures.test.ts tests/phase45d-reply-gesture.test.tsx tests/conversation-view-render.test.tsx`

Expected: all tests pass; reply behavior remains independent.

### Task 3: Add focused-media pull-down dismissal

**Files:**
- Modify: `src/ui/components/media/MediaViewer.tsx`
- Modify: `src/styles/veil-components.css`
- Test: `tests/phase71-mobile-navigation-gestures.test.ts`

- [ ] **Step 1: Extend the failing test with valid and invalid media drag cases**

Assert a 130px downward vertical drag at zoom 1 dismisses; assert 119px does not; assert a horizontal drag and any zoom above 1 do not.

- [ ] **Step 2: Run the test and verify the new cases fail**

Run: `npx vitest run tests/phase71-mobile-navigation-gestures.test.ts`

- [ ] **Step 3: Wire drag state to the media overlay**

Capture a single-touch start, use the helper to reject horizontal and zoomed interaction, apply bounded translate/scale/backdrop progress while dragging, call `onClose` only after the trigger, and animate back after cancelled drags. Keep Escape and the visible close button.

- [ ] **Step 4: Add scoped motion CSS**

Use `will-change: transform, opacity` and a short ease-out return transition, honoring `prefers-reduced-motion` by eliminating the transition. Do not add global touch rules.

- [ ] **Step 5: Run all focused tests**

Run: `npx vitest run tests/phase71-mobile-navigation-gestures.test.ts tests/phase45d-reply-gesture.test.tsx tests/phase45d-media-rendering.test.tsx tests/conversation-view-render.test.tsx`

Expected: all tests pass.

### Task 4: Final verification and one local commit

**Files:**
- Modify: `docs/ai/CURRENT_STATE.md`
- Modify: `docs/ai/ACTIVE_TASK.md`
- Modify: `docs/ai/CHANGELOG.md`

- [ ] **Step 1: Run focused gesture and media tests**

Run: `npx vitest run tests/phase71-mobile-navigation-gestures.test.ts tests/phase45d-reply-gesture.test.tsx tests/phase45d-media-rendering.test.tsx tests/conversation-view-render.test.tsx`

- [ ] **Step 2: Run the production build only after all code is complete**

Run: `npm run build`

Expected: Vite exits 0.

- [ ] **Step 3: Update project handoff documentation and commit the full batch locally**

Run: `git add <changed files> && git commit -m "feat: add mobile chat and media dismiss gestures"`

Do not push or merge.
