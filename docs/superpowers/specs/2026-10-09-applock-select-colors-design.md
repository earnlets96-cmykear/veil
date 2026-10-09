# App Lock Select Colors Design

## Goal

Make the App Lock delay selectors visually consistent with VEIL's dark settings surface. The current browser-default white controls stand out from the surrounding dark card.

## Design

Keep the existing native `<select>` controls, labels, options, layout, saved values, and change handlers. Add a focused `.veil-select` style using VEIL's existing surface, border, text, accent, and color-scheme tokens. In dark themes, the closed control should have a dark fill and readable light value text; in light themes, it should follow the selected light palette. Keep a subtle border and visible keyboard focus ring in either palette. Preserve the current 44px minimum target height and native selection behavior.

This is a presentation-only change to the three App Lock delay controls. It does not change App Lock policy, persistence, security behavior, or other settings controls.

## Verification

Run the focused App Lock settings test and the TypeScript check. Inspect the selector styles and run the Impeccable detector on the changed UI targets. The existing full-suite run is also underway as required by the repository takeover procedure.
