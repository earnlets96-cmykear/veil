# Message Bubble Palettes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six curated incoming/outgoing message color pairs with readable, opaque surfaces and live selection previews.

**Architecture:** Extend the existing local `ThemeManager` with a validated `bubblePalette` preference whose default delegates to current accent-driven colors. Put paired light/dark palette values in the theme data model, expose them as root CSS custom properties, and render selectable preview cards in `AppearanceSettingsView`. Actual message bubbles and the live preview use the same variables; message shape remains independent.

**Tech Stack:** React, TypeScript, vanilla CSS custom properties, localStorage, Vitest.

---

## Files and responsibilities

- Modify `src/ui/utils/themeManager.ts`: palette IDs, paired token definitions, validated preference storage, DOM attribute/token application, reset behavior.
- Modify `src/ui/components/AppearanceSettingsView.tsx`: palette cards and both-direction mini-previews.
- Modify `src/styles/themes.css`: light/dark palette tokens and shape-specific bubble treatments.
- Modify `src/styles/veil-design-system.css`: actual message bubble surfaces and role-specific borders.
- Modify `src/styles/veil-components.css`: ensure the later incoming-border override respects the selected palette token.
- Modify `tests/theme-accent-system.test.ts`: preference defaults, selection, persistence, reset, and color contrast checks.
- Modify or add `tests/appearance-custom-wallpaper.test.tsx`: palette availability, labels, selected state, and live preview rendering.
- Update `docs/ai/ACTIVE_TASK.md`, `docs/ai/CURRENT_STATE.md`, `docs/ai/CHANGELOG.md`, and `docs/ai/HANDOFF.md` with the completed appearance follow-up while preserving their existing unrelated edits.

### Task 1: Lock palette preference behavior with regressions

**Files:**
- Test: `tests/theme-accent-system.test.ts`

- [x] Add tests that a fresh manager uses `veil`, the six curated palettes are defined, `setBubblePalette('deep-sea')` persists and sets `data-bubble-palette`, and a new manager restores it.
- [x] Add tests that unknown stored palette IDs load as `veil`, `resetToDefaults()` resets the palette to `veil`, and changing palette leaves theme/accent/bubble shape unchanged.
- [x] Add a WCAG contrast helper in the test and assert every incoming/outgoing text/surface pair in both dark and light token sets has a contrast ratio of at least 4.5:1.
- [x] Run `npx vitest run tests/theme-accent-system.test.ts` and confirm the new assertions fail before implementation.

### Task 2: Add typed curated palette data and persistence

**Files:**
- Modify: `src/ui/utils/themeManager.ts`
- Test: `tests/theme-accent-system.test.ts`

- [x] Define `BubblePaletteId` as `veil | deep-sea | arctic | evergreen | ember | amethyst | rosewood`, a `BubblePalette` shape with light/dark incoming/outgoing background/text/border tokens, and exported `BUBBLE_PALETTES` records for the six named choices.
- [x] Keep `veil` as the preference default and apply no palette overrides for it, preserving existing theme/accent behavior.
- [x] Add `bubblePalette` to `AppearancePreferences`, load only IDs in `BUBBLE_PALETTES` plus `veil`, and store it under `veil:bubble_palette`.
- [x] Add `setBubblePalette()` and `getBubblePalette()`; apply the selected ID via `data-bubble-palette` and the active light/dark token values via root CSS custom properties. On `veil`, remove those inline overrides so existing theme/accent CSS remains authoritative.
- [x] Include `bubblePalette: 'veil'` in reset; preserve all other appearance preferences when one palette is selected.
- [x] Run the ThemeManager suite and confirm Task 1 regressions pass.

### Task 3: Add paired choices and mini-previews to Appearance

**Files:**
- Modify: `src/ui/components/AppearanceSettingsView.tsx`
- Modify: `src/styles/veil-components.css`
- Test: `tests/appearance-custom-wallpaper.test.tsx`

- [x] Add a **Bubble palette** section with six radio-style buttons/cards, palette names, selected state, and a two-bubble incoming/outgoing sample on every card. Include a **VEIL Default** choice to restore accent-driven bubbles.
- [x] Call `themeManager.setBubblePalette(id)` from each choice; keep current **Message shape** segmented controls independent and use the existing subscription so the full live preview updates immediately.
- [x] Add accessible group/card names and `aria-pressed` selected state; keep keyboard focus visible and use phone-friendly touch targets.
- [x] Extend the appearance test to assert all seven labels render, both sample directions appear for each preset, selection is exposed accessibly, and the main preview receives the selected palette ID.
- [x] Run `npx vitest run tests/appearance-custom-wallpaper.test.tsx`.

### Task 4: Apply premium opaque finishes to real and preview bubbles

**Files:**
- Modify: `src/styles/themes.css`
- Modify: `src/styles/veil-design-system.css`
- Modify: `src/styles/veil-components.css`

- [x] Add opaque, coordinated light/dark token pairs for Deep Sea, Arctic, Evergreen, Ember, Amethyst, and Rosewood. Use dark text on light surfaces and light text on dark surfaces, each meeting the 4.5:1 test threshold.
- [x] Give outgoing surfaces a restrained tonal highlight and distinct color; tint incoming surfaces visibly and more softly. Use CSS variables for border colors and keep both Modern Rounded and Classic Compact radius rules unchanged.
- [x] Apply tokens to `.veil-message-bubble.outgoing` / `.veil-message-bubble.incoming` and `.veil-bubble-outgoing` / `.veil-bubble-incoming` in the live preview. Replace the later incoming `border-color: var(--veil-border) !important` override with the palette-aware token.
- [x] Keep `data-bubble-palette="veil"` visually equivalent to the current accent-driven bubbles across Midnight, True Black, and Porcelain/Light themes.
- [x] Run `git diff --check` and inspect the final CSS selectors for theme/palette specificity conflicts.

### Task 5: Verify, document, and commit

**Files:**
- Modify: four `docs/ai` continuity files listed above.

- [x] Run `npx vitest run tests/theme-accent-system.test.ts tests/appearance-custom-wallpaper.test.tsx` and `npm run typecheck`.
- [x] If local preview access is available, inspect the Appearance screen and one real incoming/outgoing conversation at desktop and mobile sizes in dark and light themes; otherwise report the preview limitation.
- [x] Record palette behavior, local-only preference scope, focused test results, and any preview limitation in the four continuity docs without staging their pre-existing unrelated edits.
- [x] Stage only palette code, tests, and the four feature-specific documentation hunks; commit as `feat: add curated message bubble palettes`.
