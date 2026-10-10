# Message Bubble Palettes Design

## Goal

Give users more clearly visible color and finish combinations for incoming and outgoing messages while preserving VEIL's premium, modern appearance.

## Current context

`AppearanceSettingsView` already shows a live conversation preview and exposes two bubble shape choices. `ThemeManager` persists one of eleven global accent colors and uses that accent to choose an outgoing bubble color. Incoming bubbles use theme surface colors. The live preview currently reflects theme, wallpaper, accent, and shape.

## Approved direction

Add a separate **Bubble palette** section with six curated, paired palettes. Each choice defines both incoming and outgoing surfaces, their text colors, borders, and restrained finish. Keep palette selection separate from app theme, global accent, bubble shape, and font size. Palette cards show both message directions in their previews, with a visible selected state; the main live preview and actual conversation bubbles update immediately.

Initial palette directions:

- **Deep Sea** — rich teal outbound, cool blue-green inbound.
- **Arctic** — clear blue outbound, pale slate-blue inbound.
- **Evergreen** — deep botanical green outbound, muted sage inbound.
- **Ember** — warm bronze outbound, soft amber-stone inbound.
- **Amethyst** — restrained violet outbound, cool lilac-slate inbound.
- **Rosewood** — muted berry outbound, soft rose-plum inbound.

Use opaque surfaces and text colors with readable contrast. A subtle directional highlight or tonal edge may add depth; avoid glass transparency, strong gradients, neon glow, and noisy texture. Preserve current Modern Rounded and Classic Compact shape choices.

## Persistence and rendering

Extend the existing device-local appearance preference model with a validated bubble-palette ID and a default that preserves the current VEIL palette. Apply palette tokens to actual message bubbles and the Appearance preview through root data attributes/CSS variables. Invalid or unknown stored IDs fall back safely to the default. Do not add per-chat/per-Space scope or network access.

## Verification

- Verify all six choices are available and selected state/persistence/reset work through `ThemeManager`.
- Verify palette tokens update incoming and outgoing production bubble styles and the Appearance previews, without overriding accent, theme surface, or shape controls.
- Cover readable text colors and opaque surfaces for every palette in focused tests.
- Run appearance and message-rendering focused suites plus TypeScript; visually review desktop and mobile layouts.

## Out of scope

Independent arbitrary incoming/outgoing color pickers, custom color entry, palette downloads, per-conversation or per-Space palettes, changing wallpaper behavior, and changes to cryptography or message protocols.
