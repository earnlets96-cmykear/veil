# Track 3 Contact Avatar and Privacy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore canonical contact avatars and expose persistent per-contact outgoing-media privacy defaults from the conversation contact profile.

**Architecture:** Contact records remain encrypted and keyed exclusively by `Contact.identityId`. The UI hydrates avatar data already held by contacts; outgoing-media policy continues through the existing attachment wire metadata. No crypto, cloud authorization, receipt, reply, or media implementation is redesigned.

**Tech Stack:** React, TypeScript, Vitest, EncryptedSpaceStore, existing AttachmentPipeline.

---

### Task 1: Add focused failing Track 3 regressions

**Files:**
- Create: `tests/phase45c-contact-avatar-privacy.test.tsx`

- [ ] Write tests that persist contacts with distinct canonical IDs, avatars, and media defaults through `ContactManager`, then reload them with a fresh manager.
- [ ] Render `ConversationView` with a persisted remote avatar and assert the header output includes that avatar URL; render a missing-avatar contact and assert the deterministic fallback initials remain.
- [ ] Render `ContactDetailsModal` with a direct contact and assert both policy labels and their persisted default values are visible.
- [ ] Assert a display-name collision cannot mutate the other canonical contact's policy, and that independently persisted A→B and B→A policies retain different values.
- [ ] Run `npx vitest run tests/phase45c-contact-avatar-privacy.test.tsx` and confirm failure because the header/control behavior is absent.

### Task 2: Wire canonical avatar rendering and direct-conversation hydration

**Files:**
- Modify: `src/ui/app/AppState.tsx`
- Modify: `src/ui/components/ConversationView.tsx`

- [ ] Preserve `targetProfile.avatar` when converting a directory profile into an invitation/contact.
- [ ] When creating or updating a direct `UIConversation`, copy the avatar only from the resolved canonical contact/profile.
- [ ] Pass `activeConversation.avatar ?? activeContact.avatar` to the header `Avatar` as `imageUrl`; leave its existing seed/name fallback intact.
- [ ] Run the Track 3 test and confirm the avatar assertions pass.

### Task 3: Restore Chat Privacy in the contact-details entry point

**Files:**
- Modify: `src/ui/components/ContactDetailsModal.tsx`

- [ ] Obtain `updateContactMediaPermissions` from `useApp`.
- [ ] Add a direct-contact-only `Chat Privacy` section with save/forward checkbox values derived from `contact.metadata`, defaulting to allowed.
- [ ] Invoke `updateContactMediaPermissions(contact.identityId, ...)` for each change; never use display name or conversation name as the mutation key.
- [ ] Include a concise non-DRM note.
- [ ] Run the Track 3 test and confirm the privacy and identity assertions pass.

### Task 4: Verify integration and handoff

**Files:**
- Modify: `docs/ai/ACTIVE_TASK.md`
- Modify: `docs/ai/CHANGELOG.md`
- Modify: `docs/ai/HANDOFF.md`

- [ ] Run Track 3 focused tests, Track 1 focused tests, and Track 2 focused tests.
- [ ] Run `npm run build`, `node scripts/release-build.mjs`, and `npx cap sync android`.
- [ ] Update documentation with only actual results; do not run Android Gradle or claim physical Android validation.
- [ ] Commit Track 3 separately on top of the existing merge commit. Do not push or merge remotely.
