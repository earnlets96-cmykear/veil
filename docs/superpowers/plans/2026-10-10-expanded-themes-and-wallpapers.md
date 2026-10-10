# Expanded Themes and Wallpapers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three coordinated theme presets, at least two bundled photo wallpapers in each Nature, Abstract, and Patterns family, and a device-local custom photo wallpaper.

**Architecture:** Extend the existing theme and wallpaper catalogs and theme CSS. Bundle sourced wallpaper images locally with a credits manifest. Add a focused IndexedDB store and image normalization utility for user-selected wallpapers; restore the local custom image at app startup and apply it through one CSS custom property shared by the live preview and chat timeline. Keep selection global to this installation and outside cloud/Space sync.

**Tech Stack:** React 19, TypeScript, Vite static asset imports, IndexedDB, Canvas image re-encoding, Vitest, fake-indexeddb.

---

## File map

- Modify `src/ui/utils/themeManager.ts`: add three theme IDs and the `custom` wallpaper ID while retaining existing preference keys and reset behavior.
- Create `src/ui/utils/wallpaperCatalog.ts`: define the Nature, Abstract, and Patterns groups and their six bundled images.
- Create `src/assets/wallpapers/`: keep optimized, bundled source images and a credits manifest adjacent to the assets.
- Create `src/ui/utils/customWallpaperImage.ts`: validate, decode, resize, and re-encode user images without retaining EXIF metadata.
- Create `src/ui/utils/customWallpaperStore.ts`: persist one custom photo Blob in app-origin IndexedDB and expose replace/read/remove operations.
- Create `src/ui/utils/customWallpaperManager.ts`: own the active object URL and apply/revoke it safely.
- Modify `src/main.tsx` and `src/ui/App.tsx`: restore an active custom wallpaper early enough to apply it to chat timelines after reload.
- Modify `src/ui/components/AppearanceSettingsView.tsx`: render family sections, the additional theme cards, upload/replace/remove controls, local-only storage disclosure, and failure feedback.
- Modify `src/styles/themes.css`: add the three coordinated theme token sets and wallpaper image/custom rules with contrast overlays.
- Modify `src/styles/veil-components.css`: style family cards and upload controls responsively and accessibly.
- Modify `tests/theme-accent-system.test.ts`: cover new IDs, grouped wallpaper catalog, preset application, persistence, and reset.
- Create `tests/custom-wallpaper-image.test.ts`: cover type, byte-size, decoded-pixel bounds, resize, and metadata-free output.
- Create `tests/custom-wallpaper-store.test.ts`: cover IndexedDB replace/read/remove, reload persistence, and storage failures.
- Create `tests/appearance-custom-wallpaper.test.tsx`: cover accessible upload controls, preview/selection state, and errors.
- Create `src/assets/wallpapers/credits.json`: record each image's creator, source page, license, and retrieval date.

## Task 1: Extend appearance catalogs and theme presets

**Files:** `src/ui/utils/themeManager.ts`, `src/ui/utils/wallpaperCatalog.ts`, `tests/theme-accent-system.test.ts`

- [ ] Add a failing assertion that the three new presets exist and are assigned one per collection:

```ts
expect(THEME_OPTIONS.filter((option) => ['glacier', 'canyon', 'aurora'].includes(option.id))).toHaveLength(3);
expect(THEME_OPTIONS.find((option) => option.id === 'glacier')?.collection).toBe('Minimal');
expect(THEME_OPTIONS.find((option) => option.id === 'canyon')?.collection).toBe('Nature');
expect(THEME_OPTIONS.find((option) => option.id === 'aurora')?.collection).toBe('Expressive');
```

- [ ] Add a failing assertion that Nature, Abstract, and Patterns each contain at least two built-in entries and that existing six wallpaper IDs remain valid.
- [ ] Run `npx vitest run tests/theme-accent-system.test.ts`; confirm the new catalog assertions fail before implementation.
- [ ] Add `glacier`, `canyon`, and `aurora` to `ThemeMode` and `validThemes`; give each a coordinated accent and entry in `THEME_OPTIONS`.
- [ ] Add a `WallpaperFamily` type and catalog interface in `wallpaperCatalog.ts`; populate exactly two initial entries per family using stable IDs and local asset paths in Task 2.
- [ ] Add `custom` to `ChatWallpaper`; load and persist it as the wallpaper selection ID without changing the default/reset value.
- [ ] Run `npx vitest run tests/theme-accent-system.test.ts`; expect all theme-manager tests to pass.
- [ ] Commit as `feat: add expanded appearance catalogs`.

## Task 2: Curate and bundle wallpaper images

**Files:** `src/assets/wallpapers/**`, `src/ui/utils/wallpaperCatalog.ts`, `src/assets/wallpapers/credits.json`, `tests/theme-accent-system.test.ts`

- [ ] Find six real images: two calm Nature scenes, two subdued Abstract scenes, and two low-contrast Pattern scenes. Search individual source pages and verify the license permits packaging and use inside VEIL. Do not copy an image if its source/license or depicted third-party rights are unclear.
- [ ] Download and optimize chosen sources into WebP files under `src/assets/wallpapers/`. Use local Vite asset imports; do not use remote image URLs in runtime CSS or components.
- [ ] Record creator, source page, license, and retrieval date for every image in `credits.json`.
- [ ] Update the wallpaper catalog entries to point to the corresponding local assets and provide labels/descriptions.
- [ ] Add a catalog assertion that all six asset paths exist and every image has a credits entry:

```ts
for (const wallpaper of WALLPAPER_CATALOG.flatMap((family) => family.wallpapers)) {
  expect(wallpaper.assetUrl).toBeTruthy();
  expect(credits[wallpaper.id]).toMatchObject({ source: expect.any(String), license: expect.any(String) });
}
```

- [ ] Add a guard that built-in catalog entries resolve only to bundled Vite assets; appearance rendering must not create image-host requests or use remote runtime URLs.

- [ ] Run `npx vitest run tests/theme-accent-system.test.ts`; expect catalog and existing wallpaper behavior to pass.
- [ ] Commit assets and metadata as `feat: bundle curated chat wallpapers`.

## Task 3: Normalize user-selected images

**Files:** `src/ui/utils/customWallpaperImage.ts`, `tests/custom-wallpaper-image.test.ts`

- [ ] Write failing tests for accepted JPEG/PNG/WebP, rejected SVG/unknown type, rejection above 15 MiB, and rejection above 40 megapixels.
- [ ] Run `npx vitest run tests/custom-wallpaper-image.test.ts`; confirm the tests fail because the processor is absent.
- [ ] Implement `normalizeCustomWallpaper(file: File): Promise<Blob>` with MIME allow-list checks, a 15 MiB source cap, `createImageBitmap` decoding, a 40-megapixel decoded cap, a 2400-pixel maximum edge, and `canvas.toBlob(..., 'image/webp', 0.84)` output. Inject/mock the bitmap and canvas runtime so bounds, resizing, encoding, and errors can be tested in Vitest's Node environment. Close the bitmap and reject on decoding/encoding errors.
- [ ] Assert output MIME is `image/webp`, output dimensions do not exceed 2400 pixels on the longest edge, and encoded output does not preserve EXIF metadata.
- [ ] Run `npx vitest run tests/custom-wallpaper-image.test.ts`; expect valid image cases to pass and invalid/adversarial cases to reject with safe user-displayable errors.
- [ ] Commit as `feat: normalize custom wallpaper uploads`.

## Task 4: Persist one custom wallpaper locally

**Files:** `src/ui/utils/customWallpaperStore.ts`, `tests/custom-wallpaper-store.test.ts`

- [ ] Write failing IndexedDB tests for save/read, replacement, remove, reload persistence, missing IndexedDB, and transaction failure. Use `fake-indexeddb` and a dedicated test database name.
- [ ] Run `npx vitest run tests/custom-wallpaper-store.test.ts`; confirm the tests fail before implementation.
- [ ] Implement a single-record object store in a separate `veil_appearance` database with methods `save(blob: Blob): Promise<void>`, `load(): Promise<Blob | null>`, and `remove(): Promise<void>`.
- [ ] Persist the last built-in wallpaper ID under a separate local preference whenever switching from a built-in wallpaper to `custom`; use it when custom image storage is missing, corrupt, or removed, falling back to `default` if it is invalid.
- [ ] Keep the database scoped to the app origin; do not add network, relay, cloud, or `EncryptedSpaceStore` dependencies.
- [ ] Run `npx vitest run tests/custom-wallpaper-store.test.ts`; expect CRUD, persistence, and failure paths to pass.
- [ ] Commit as `feat: persist custom wallpaper locally`.

## Task 5: Manage wallpaper URLs and restore the selection

**Files:** `src/ui/utils/customWallpaperManager.ts`, `src/ui/utils/themeManager.ts`, `src/main.tsx`, `src/ui/App.tsx`, `tests/custom-wallpaper-store.test.ts`

- [ ] Add failing lifecycle tests: custom wallpaper restored on startup when selected, no image applied when a built-in wallpaper is selected, replacement revokes the old URL, and removal revokes the current URL and restores the built-in choice.
- [ ] Implement `CustomWallpaperManager` around the store and image normalizer. Keep at most one active object URL and revoke it on replacement, removal, or manager disposal.
- [ ] Implement `restoreIfSelected(isSelected: boolean): Promise<void>` and call it at app bootstrap before relying on `data-wallpaper="custom"` in the timeline. Missing/corrupt stored content must fall back to the saved built-in wallpaper without logging image bytes or data URLs, and without delaying initial app rendering.
- [ ] Apply the active URL through `--veil-custom-wallpaper-image` using a quoted CSS `url(...)`; clear the property on removal.
- [ ] Run `npx vitest run tests/custom-wallpaper-store.test.ts` and `npm run typecheck`; expect lifecycle tests and TypeScript to pass.
- [ ] Commit as `feat: restore custom chat wallpaper on startup`.

## Task 6: Build the Appearance wallpaper and upload controls

**Files:** `src/ui/components/AppearanceSettingsView.tsx`, `src/styles/veil-components.css`, `tests/appearance-custom-wallpaper.test.tsx`

- [ ] Add failing UI assertions for labeled family sections, all six wallpaper cards, three new theme cards, Upload photo, Change photo, Remove photo, the local-only disclosure, and an accessible error status.
- [ ] Implement the grouped wallpaper cards and use the actual bundled local previews.
- [ ] Add an invisible image input with `accept="image/jpeg,image/png,image/webp"`; trigger it from an accessible button. On successful normalization and storage, select `custom`, update the preview, and reset the input value so the same file can be selected again.
- [ ] Add Change and Remove actions. On failed validation/storage, retain the current wallpaper and announce the error; after removal, restore the last built-in selection.
- [ ] Keep React subscription cleanup and avoid leaving stale object URLs when the Appearance view unmounts.
- [ ] Run `npx vitest run tests/appearance-custom-wallpaper.test.tsx tests/theme-accent-system.test.ts`; expect all focused UI/catalog assertions to pass.
- [ ] Commit as `feat: add custom wallpaper controls`.

## Task 7: Apply wallpaper images safely to preview and chat

**Files:** `src/styles/themes.css`, `src/styles/veil-components.css`, `src/ui/components/AppearanceSettingsView.tsx`, `tests/appearance-custom-wallpaper.test.tsx`

- [ ] Add complete semantic theme tokens for Glacier, Canyon, and Aurora, including surfaces, text, borders, accent, and outgoing bubble contrast.
- [ ] Apply each built-in wallpaper to both `.veil-timeline` and the live preview using local asset URLs, `background-size: cover`, and theme-aware dark/light contrast overlays.
- [ ] Apply `--veil-custom-wallpaper-image` to both surfaces when `data-wallpaper="custom"`; do not place message text directly over an unmodified high-contrast image.
- [ ] Add responsive card layouts, visible `:focus-visible` rings, 44px minimum upload/remove controls on touch layouts, and reduced-motion-safe transitions.
- [ ] Run the focused suites from Tasks 1, 3, 4, and 6 plus `npm run typecheck`; expect all to pass.
- [ ] Visually inspect the Appearance page and active chat at desktop and phone widths, all three theme modes (dark, light, AMOLED), each wallpaper family, and the custom photo state.
- [ ] Commit as `feat: style expanded wallpaper and theme previews`.

## Task 8: Update project status and final verification

**Files:** `docs/ai/CURRENT_STATE.md`, `docs/ai/ACTIVE_TASK.md`, `docs/ai/CHANGELOG.md`, `docs/ai/HANDOFF.md`

- [ ] Record the feature, local unencrypted image-storage boundary, focused verification results, and any remaining device/browser checks.
- [ ] Run `npx vitest run tests/theme-accent-system.test.ts tests/custom-wallpaper-image.test.ts tests/custom-wallpaper-store.test.ts tests/appearance-custom-wallpaper.test.tsx` and `npm run typecheck`; retain actual results.
- [ ] Inspect `git diff --check` and the final diff; stage only feature files and preserve unrelated repository changes.
- [ ] Commit as `docs: record expanded themes and wallpapers`.

## License sources reviewed

- [Unsplash License](https://unsplash.com/license)
- [Unsplash Terms](https://unsplash.com/terms)
- [Pexels License](https://www.pexels.com/license/)
