# VEIL Messaging UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement one cohesive professional messaging UI that combines a calm chat surface, a Telegram-like conversation workspace, and a quiet accessible visual system without changing messaging behavior.

**Architecture:** Keep `ConversationView`, `MessageBubble`, and `MessageComposer` as behavior owners. Move visual consistency into semantic design tokens and existing stylesheet layers, adding small presentational primitives only when repeated state markup cannot be expressed by existing components. Preserve the current windowing, scroll scheduling, gesture arbitration, media policy, and protocol/session code.

**Tech Stack:** React 18, TypeScript, Vite, existing VEIL CSS token/component styles, Vitest, Capacitor Android asset sync.

---

## File map

- Modify `src/styles/veil-design-system.css`: semantic colors, spacing, elevation, typography, focus rings, shell/timeline/composer primitives, and responsive breakpoints.
- Modify `src/styles/veil-components.css`: message rows, media/voice cards, reactions, reply previews, list rows, overlays, and state variants.
- Modify `src/styles/themes.css`: map light/dark/wallpaper variables to the shared semantic roles.
- Modify `src/ui/components/ConversationView.tsx`: only class names/semantic wrappers needed to expose existing header, list, timeline, selection, and empty states; do not alter message or scroll logic.
- Modify `src/ui/components/ui/MessageBubble.tsx`: only presentational state hooks/classes for consistent bubble metadata, grouping, reply, receipt, and attachment layouts.
- Modify `src/ui/components/MessageComposer.tsx`: only presentational classes/aria labels for attachment, reply, recording, emoji, send, disabled, and keyboard-open states.
- Inspect and modify the existing conversation-list component discovered during implementation, preserving its data and event handlers.
- Add `tests/phase103-ui-system.test.tsx`: source-level regression coverage for required class/state contracts and semantic tokens.
- Update `docs/ai/ACTIVE_TASK.md` and `docs/ai/CHANGELOG.md` with verified UI work.
- Regenerate tracked release metadata and Android web assets through `npm run build` and `npx cap sync android`.
- Remove temporary untracked `design-preview.html` after the implementation begins; it is a brainstorming artifact, not a shipped asset.

### Task 1: Establish semantic UI tokens

**Files:** `src/styles/veil-design-system.css`, `src/styles/themes.css`, `tests/phase103-ui-system.test.tsx`

- [ ] Write failing tests that assert semantic roles exist for `--veil-surface-app`, `--veil-surface-panel`, `--veil-surface-elevated`, `--veil-text-primary`, `--veil-text-secondary`, `--veil-accent`, `--veil-focus-ring`, spacing/radius tokens, and both `[data-theme="dark"]` and `[data-theme="light"]` mappings.
- [ ] Run `npx vitest run tests/phase103-ui-system.test.tsx`; expect failures for missing tokens.
- [ ] Add the tokens by aliasing existing VEIL variables, not replacing them with unrelated colors. Define the same roles for dark and light themes, with body/secondary contrast meeting 4.5:1 and focus ring visibly distinct.
- [ ] Add shared transition tokens (`150ms`, `220ms`, ease-out) and a single elevation vocabulary.
- [ ] Rerun the focused test; expect the token assertions to pass.
- [ ] Commit `refactor: add semantic messaging ui tokens`.

### Task 2: Refine the responsive conversation workspace

**Files:** existing conversation-list component, `src/ui/components/ConversationView.tsx`, `src/styles/veil-design-system.css`, `src/styles/veil-components.css`, `tests/phase103-ui-system.test.tsx`

- [ ] Add failing assertions for an accessible list/search region, active/unread/pinned/muted row classes, responsive list/chat shell classes, and preserved `onClick`/selection handlers.
- [ ] Run the focused test and verify the new assertions fail before implementation.
- [ ] Add only semantic wrappers/classes around existing conversation rows and search controls. Use a structural mobile breakpoint to collapse the list when a chat is active; do not introduce new routing or state.
- [ ] Style row hierarchy: 44–52px touch-safe rows, avatar/status grouping, one-line preview truncation, unread badge, active background, hover/focus/pressed states, and quiet dividers.
- [ ] Verify keyboard focus and narrow viewport layout with the existing browser preview; rerun focused tests.
- [ ] Commit `feat: refine responsive conversation workspace`.

### Task 3: Refine chat header and timeline geometry

**Files:** `src/ui/components/ConversationView.tsx`, `src/ui/components/ui/MessageBubble.tsx`, `src/styles/veil-design-system.css`, `src/styles/veil-components.css`, `tests/phase103-ui-system.test.tsx`

- [ ] Add failing assertions for stable header identity/status/action groups, incoming/outgoing/grouped message classes, date separators, receipt metadata, and preserved message event handlers.
- [ ] Run the focused test and confirm it fails.
- [ ] Add classes/wrappers only where needed to distinguish header identity, status, actions, date separators, bubble body, metadata, receipt, reply, reaction, attachment, and voice states.
- [ ] Apply consistent geometry: readable max width, 8px rhythm, 12–16px surface radii, grouped-message join radii, restrained shadows/borders, and clear outgoing/incoming contrast.
- [ ] Add hover/focus/selected/highlight states and ensure long text/media cannot overflow the viewport.
- [ ] Verify that no scroll handler, message status reducer, receipt dispatch, or media decrypt path changes; rerun focused tests.
- [ ] Commit `feat: refine chat timeline visual hierarchy`.

### Task 4: Refine composer and media surfaces

**Files:** `src/ui/components/MessageComposer.tsx`, relevant media picker/viewer component, `src/styles/veil-design-system.css`, `src/styles/veil-components.css`, `tests/phase103-ui-system.test.tsx`

- [ ] Add failing assertions for composer input/attachment/emoji/reply/recording/send states, keyboard-safe classes, recent-file/media picker sections, upload progress, save/share controls, and `aria-label` coverage.
- [ ] Run the focused test and verify failure.
- [ ] Add state classes while preserving current file inputs, recent-file callbacks, media encryption, upload, recording, and send handlers.
- [ ] Style the composer as one stable input island with clear attachment affordance, readable textarea, emoji action, reply banner, recording waveform/status, disabled/loading states, and a 44px minimum touch target.
- [ ] Style the in-app media picker as a bottom sheet/action surface with recent files, type grouping, preview thumbnails, selection state, progress/error state, and explicit Save/Share actions. Do not add storage permission logic in this UI-only task.
- [ ] Ensure overlays use fixed/portal positioning where needed and do not clip inside scrolling containers.
- [ ] Rerun focused tests and verify keyboard-open behavior in the browser preview.
- [ ] Commit `feat: polish composer and media surfaces`.

### Task 5: Motion, accessibility, and performance audit

**Files:** `src/styles/veil-design-system.css`, `src/styles/veil-components.css`, `tests/phase103-ui-system.test.tsx`

- [ ] Add tests asserting transitions are limited to state classes, focus-visible styles exist, no message mount animation is introduced, and existing Phase 102 scroll invariants remain untouched.
- [ ] Run `npx vitest run tests/phase102a-scroll-performance.test.tsx tests/phase103-ui-system.test.tsx` and verify the new assertions initially fail where appropriate.
- [ ] Add 150–220ms ease-out transitions for composer expansion, selection, attachment reveal, and list-to-chat state only. Avoid `will-change` on every message and avoid layout-triggering animation.
- [ ] Run the Impeccable detector once over changed UI files: `C:\Users\RTX 4060\Desktop\PROJECT\chat\.agents\skills\impeccable\scripts\impeccable.cmd detect --json src/styles/veil-design-system.css src/styles/veil-components.css src/styles/themes.css src/ui/components/ConversationView.tsx src/ui/components/ui/MessageBubble.tsx src/ui/components/MessageComposer.tsx`.
- [ ] Fix all actionable detector findings in one bounded pass, then rerun the focused tests.
- [ ] Commit `fix: harden messaging ui states and motion`.

### Task 6: Full verification and handoff

**Files:** `docs/ai/ACTIVE_TASK.md`, `docs/ai/CHANGELOG.md`, tracked release/Android generated assets

- [ ] Run the focused UI/performance suites and record exact totals.
- [ ] Run the relevant existing Track 1–4 tests; do not claim the full workspace suite unless its aggregate result is available.
- [ ] Run `npm run build` and confirm TypeScript, Vite, and release manifest generation succeed.
- [ ] Run `npx cap sync android` and confirm Android web assets/plugins sync.
- [ ] Do not claim Android Gradle or physical Android verification unless a fresh APK build actually succeeds; the known loopback failure must be reported if it recurs.
- [ ] Update phase docs with exact verification results and remove `design-preview.html`.
- [ ] Run `git diff --check`, `git status --short`, and `git log -3 --oneline`; confirm no push or remote merge.
- [ ] Commit `docs: record messaging ui verification`.

## Self-review

- Spec coverage: all six scoped surfaces, visual roles, motion, component boundaries, acceptance criteria, and implementation order map to Tasks 1–6.
- Placeholder scan: no TBD/TODO/FIXME or unspecified implementation handoffs remain.
- Type consistency: tasks use the existing React components and CSS layers; no new API is introduced.
- Security scope: no cryptographic, persistence, transport, receipt, or authorization behavior is changed.
