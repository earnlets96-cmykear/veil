# App Lock Select Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the App Lock delay selectors match VEIL's dark settings surface while preserving native select behavior.

**Architecture:** Add one focused `.veil-select` rule to the existing component stylesheet. Reuse VEIL surface, border, text, and accent tokens; keep the current React markup, labels, values, persistence, and handlers unchanged.

**Tech Stack:** React, TypeScript, Vanilla CSS, Vitest.

---

### Task 1: Style the App Lock delay selectors

**Files:**
- Modify: `src/styles/veil-components.css`
- Verify: `tests/phase124-applock-settings.test.ts`

- [x] **Step 1: Add the focused selector style**

Add `.veil-select` styling in the component stylesheet using `var(--veil-bg-surface-elevated)` for its background, `var(--veil-border)` for its border, and `var(--veil-text-primary)` for its text. Keep the existing native arrow and selection menu. Add a visible `:focus-visible` outline using `var(--veil-accent-primary)`; do not remove the browser focus indicator without replacing it.

```css
.veil-select {
  color-scheme: var(--veil-scheme, dark);
  color: var(--veil-text-primary);
  background-color: var(--veil-bg-surface-elevated);
  border: 1px solid var(--veil-border);
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  font: inherit;
}

.veil-select:focus-visible {
  outline: 2px solid var(--veil-accent-primary);
  outline-offset: 2px;
}
```

- [x] **Step 2: Run focused App Lock settings coverage**

Run: `npx vitest run tests/phase124-applock-settings.test.ts`

Expected: the persisted delay selector tests pass.

- [x] **Step 3: Run TypeScript and the UI detector**

Run: `npm run typecheck`

Expected: TypeScript exits successfully.

Run: `.agents/skills/impeccable/scripts/impeccable.cmd detect --json src/ui/components/AppLockSettingsView.tsx src/styles/veil-components.css`

Expected: no new findings for the App Lock selector styling.

- [x] **Step 4: Commit the scoped UI change**

Stage only `src/styles/veil-components.css`, `docs/ai/CURRENT_STATE.md`, `docs/ai/ACTIVE_TASK.md`, `docs/ai/CHANGELOG.md`, and this plan. Record the presentation-only fix in all three project status documents, then commit with `fix: match App Lock selectors to dark settings UI`.
