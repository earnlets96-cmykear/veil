# Expanded Themes and Wallpapers Design

## Goal

Give users a broader selection of coordinated VEIL themes and chat wallpapers, including their own photo as a background.

## Current context

`AppearanceSettingsView` already groups curated themes into Minimal, Nature, and Expressive collections, displays a live chat preview, and offers six CSS chat backgrounds. `ThemeManager` stores the current theme, accent, and wallpaper selection in device-local preferences and applies them through document attributes. The timeline background styles are defined in `themes.css`.

## Approved scope

- Keep the existing themes and wallpaper choices.
- Add three coordinated theme presets, one each to Minimal, Nature, and Expressive.
- Add at least two new wallpaper choices to each of three wallpaper families: Nature, Abstract, and Patterns. Keep the families clearly labeled in the Appearance screen.
- Add a custom-photo choice with preview, replace, and remove/reset actions.
- Keep appearance preferences global to the local app installation, matching the existing theme behavior. Do not sync the custom photo or fetch wallpaper images at runtime.

## Built-in wallpaper assets

Use real image assets found on the web for the built-in wallpaper library. Bundle the selected optimized images with VEIL so opening Appearance and rendering chat backgrounds does not contact an image host. Before including an image, verify its license permits use in a distributed app; record its photographer, source page, license, and retrieval date in a checked-in asset credits file. Exclude images containing visible logos, recognizable people, or protected artwork unless the required rights are clear. Unsplash's published license allows downloading, modifying, and distributing images for free, while noting restrictions on competing image-collection services and separate rights for depicted people, brands, and artwork ([Unsplash License](https://unsplash.com/license), [Unsplash Terms](https://unsplash.com/terms)). Pexels likewise allows broad free use but restricts standalone redistribution, including wallpaper products, so each asset must be checked against its current terms before use ([Pexels License](https://www.pexels.com/license/)). If an image's bundled use is unclear, do not include it; choose a source with explicit permission or a public-domain/CC0 image instead.

Candidate direction: two Nature scenes such as misty forest and alpine coast; two Abstract scenes with subdued color fields; and two Pattern images with low-contrast geometric or botanical detail. Final images should be cropped/compressed for chat use while retaining adequate resolution and include a dark/light readability overlay.

## Theme presets

Add three presets as a small extension to the existing `THEME_OPTIONS` data model. Proposed directions are Glacier (Minimal, cool pale neutral), Canyon (Nature, warm stone), and Aurora (Expressive, deep indigo with restrained teal/violet accents). Each preset sets both its theme and coordinated accent through the existing `setThemePreset` path.

## User wallpaper upload

- Accept JPEG, PNG, and WebP files from the platform's regular file/photo picker; do not accept SVG or other active-content formats.
- Reject source files over 15 MiB or decoded images over 40 megapixels. Re-encode to WebP at quality 0.84 with the longest edge capped at 2400 pixels, stripping metadata during that transform.
- Store the resulting Blob in a device-local IndexedDB appearance store. Store only the active custom-wallpaper selection in the existing local appearance preference layer. Do not transmit or sync the selected image.
- Show the photo in the live preview immediately. Apply it as a cover background in chat timelines with a contrast overlay so message text remains legible in light and dark themes.
- Provide Replace and Remove actions. Removing the image clears its local record and returns to the previously selected built-in wallpaper. Revoke old object URLs when replacing/removing and when the owning UI lifecycle ends.
- Show a clear error and retain the existing selection if the type, size, image decode, or storage write fails.

**Storage boundary:** Theme preferences are currently device-local and outside the encrypted Space store. The custom wallpaper follows that same local-only boundary; its image bytes are stored in the app's local IndexedDB origin and are not Space-encrypted. This must be stated plainly in the UI or help text. It is not uploaded to VEIL or synchronized to other devices.

## UI and accessibility

Keep the existing Appearance screen and live preview. Add labeled wallpaper-family sections with selectable cards and visible selected state. Add an Upload photo card/button with a thumbnail of the active upload, accessible file-picker label, and explicit Change/Remove actions. Keep keyboard focus visible, touch targets usable on phones, reduced-motion behavior, and all existing appearance controls.

## Verification

- Extend theme-manager tests for the new theme IDs, wallpaper IDs, persistence, and reset behavior.
- Add upload regressions for accepted image types, rejected files, size/dimension bounds, IndexedDB persistence, storage errors, replace/remove behavior, and no runtime network request for bundled assets.
- Verify the preview and actual chat timeline both show selected built-in and custom images while message contrast remains readable across dark, light, and AMOLED themes.
- Run focused appearance/upload suites and TypeScript. Visually inspect desktop and phone layouts.

## Out of scope

Per-chat or per-Space wallpaper selection, cross-device wallpaper sync, remote wallpaper packs/downloads, animated backgrounds, video wallpapers, a general theme editor, and changes to cryptography or message protocols.
