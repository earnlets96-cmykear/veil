# Premium Appearance Customization Implementation Plan

> **For agentic workers:** Execute inline in this session. Complete each step in order and keep the existing theme identifiers and local preference model.

**Goal:** Add polished theme collections, varied chat wallpaper patterns, visible bubble/font controls, a live conversation preview, and a reset action.

**Architecture:** Extend the existing `ThemeManager` preference definitions and DOM attributes; retain localStorage persistence. Build the appearance studio in the current React settings view, with CSS-only previews and wallpaper patterns using existing semantic theme variables.

**Tech Stack:** React 19, TypeScript, Vanilla CSS, Vitest.

---

### Task 1: Lock down appearance data and persistence

**Files:**
- Modify: `tests/theme-accent-system.test.ts`
- Modify: `src/ui/utils/themeManager.ts`

- [ ] Add tests that enumerate the new wallpaper choices, verify they survive a new `ThemeManager`, and verify reset restores `dark`, `teal`, `default`, `modern`, and `default` preferences.
- [ ] Run `npx vitest run tests/theme-accent-system.test.ts`; confirm the new wallpaper/reset expectations fail for the missing behavior.
- [ ] Extend `ChatWallpaper`, `WALLPAPERS`, and saved wallpaper validation while preserving the old IDs. Add `resetToDefaults()` that updates all preferences, storage, DOM attributes, and subscribers.
- [ ] Rerun `npx vitest run tests/theme-accent-system.test.ts` and confirm it passes.

### Task 2: Implement theme collections and live customization

**Files:**
- Modify: `src/ui/components/AppearanceSettingsView.tsx`
- Modify: `src/styles/veil-components.css`

- [ ] Group existing and new premium theme choices as Minimal, Nature, and Expressive; show surface/accent swatches, descriptive accessible names, and selected states.
- [ ] Add wallpaper selectors, bubble shape and text size controls, each connected to `ThemeManager` and its subscription.
- [ ] Add an illustrative two-message preview that reflects current settings and a reset action that calls `resetToDefaults()`.
- [ ] Add responsive layout, visible `:focus-visible` states, hover treatment, and reduced-motion-aware transitions.

### Task 3: Complete token styling and regression checks

**Files:**
- Modify: `src/styles/themes.css`
- Modify: `tests/theme-accent-system.test.ts`
- Modify: `docs/ai/ACTIVE_TASK.md`
- Modify: `docs/ai/CURRENT_STATE.md`
- Modify: `docs/ai/CHANGELOG.md`

- [ ] Add light/dark adaptive CSS-only wallpaper treatments for solid, dots, waves, orbit, and organic presets; keep contrast low behind message content.
- [ ] Add focused assertions for theme/wallpaper metadata and `data-wallpaper` reflection; run `npx vitest run tests/theme-accent-system.test.ts` and `npm run typecheck`.
- [ ] Run the Impeccable detector once on the edited UI targets; fix mechanical findings.
- [ ] Update VEIL task/state/changelog notes and inspect the final diff without modifying pre-existing untracked paths.
- [ ] Commit the implementation with a descriptive `feat:` message.
