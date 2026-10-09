# VEIL Premium Appearance Design

## Goal

Give VEIL a richer, more personal appearance experience while keeping the existing privacy-first visual identity and local preference storage.

## Design

The Appearance settings view becomes a compact customization studio. Theme presets are grouped into **Minimal**, **Nature**, and **Expressive** collections, using complete surface palettes and coordinated accents. Keep familiar neutral options and include distinct warm, cool, and vivid choices. Theme selection and independent accent selection remain available.

Chat backgrounds are a separate collection from app themes. Offer a clean solid option and a varied set of low-contrast, CSS-rendered patterns, such as fine dots, soft waves, orbiting points, and organic shapes. Patterns must preserve message readability and adapt to light and dark themes. No remote images or network requests are introduced.

Expose the existing message bubble shape and font size preferences in the view. A small live sample conversation reflects theme, accent, wallpaper, bubble shape, and text size as the user changes them. Include a reset-to-defaults action so the user can easily return to VEIL's standard appearance.

Use descriptive names, selected states, keyboard focus, and accessible labels for all palette and wallpaper choices. Respect reduced-motion preferences. Retain the current local `ThemeManager` storage model; appearance preferences do not move between accounts or Spaces.

## Scope and constraints

- Update the appearance view, `ThemeManager` option definitions, theme token styles, and focused tests/documentation.
- Preserve existing preference IDs and safely extend the persisted wallpaper options.
- Keep changes isolated from cryptography, identity, Space boundaries, transport, and message protocols.
- Do not add external font, image, or asset dependencies.

## Acceptance criteria

- The user can browse multiple named theme collections and immediately identify the active choice.
- The user can select a background, message shape, and text scale; each applies immediately and survives restart using existing local persistence.
- The preview updates with each preference and remains readable across the theme and background choices.
- Reset restores the existing default appearance values.
- New and existing appearance behavior has focused regression coverage.
- Typecheck and focused appearance tests pass; full-suite limitations are reported accurately.
