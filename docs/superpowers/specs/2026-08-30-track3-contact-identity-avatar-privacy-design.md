# Track 3 Contact Identity, Avatar, and Chat Privacy Design

## Scope

Track 3 integrates the existing Track 1 and Track 2 local histories, then fixes only contact-avatar propagation and per-contact outgoing-media privacy controls. Replies, thumbnails, recovery, media encryption, cloud authorization, and receipt semantics are out of scope.

## Integrated base

`codex/phase45c-contact-privacy` starts at Track 2 (`fe96a91`) and includes Track 1 through a normal merge commit from `codex/phase45a-auth-recovery`. Neither history is rebased, squashed, pushed, or remotely merged.

## Root causes

1. `Contact.avatar` is persisted from invitations and accepted contact requests, but direct conversation creation/update paths do not consistently copy it into `UIConversation`.
2. The sidebar has a contact-avatar fallback, while `ConversationView` passes only a seed to `Avatar`; it therefore ignores an available persisted remote avatar.
3. Per-contact `allowSave` and `allowForward` defaults already persist in the encrypted contact record and already flow through encrypted attachment metadata. Their UI is in `ProfileModal`, but the conversation header opens `ContactDetailsModal`, where the controls are absent.

## Design

### Canonical contact identity

`Contact.identityId` remains the only key for contact lookup, mutation, routing, and media-policy authorization. Display names and usernames are display/search values only; they are never used to authorize another contact or select a privacy policy.

### Avatar propagation

Invitation/profile ingestion retains the public avatar data already accepted for a contact. Every direct conversation written from a canonical contact will carry `contact.avatar`; rendering will prefer `UIConversation.avatar`, then the canonical contact avatar, then the existing deterministic fallback. This avoids render-time directory calls and remains valid after encrypted state rehydration.

### Chat privacy controls

`ContactDetailsModal` gains a `Chat Privacy` section for direct contacts. Its two toggles call the existing `updateContactMediaPermissions(identityId, ...)` operation, which stores only `allowSave`/`allowForward` under that contact's encrypted `metadata`. The existing `ProfileModal` controls remain unchanged.

The existing sender-side media composition path continues to use these values as per-recipient defaults, permits a supported per-send override, and includes the resolved values in authenticated encrypted media metadata. Recipient presentation continues to respect the sender's values. These UX controls are not DRM and do not claim to prevent screenshots, cameras, or a compromised device.

### Persistence and symmetry

Contacts, their avatar, and their policy defaults are stored in `EncryptedSpaceStore`. Thus A's policy attached to A's canonical record for B is independent from B's policy attached to B's record for A. Rehydration reloads the same records before conversations render.

## Expected files

- `src/ui/app/AppState.tsx` — preserve canonical contact avatar when hydrating/creating direct conversations.
- `src/ui/components/ConversationView.tsx` — display the persisted contact/conversation avatar in the header.
- `src/ui/components/ContactDetailsModal.tsx` — expose the existing per-contact policy operation.
- `tests/phase45c-contact-avatar-privacy.test.tsx` — focused avatar, persistence, canonical identity, privacy-default, and symmetry regressions.
- `docs/ai/{ACTIVE_TASK,CHANGELOG,HANDOFF}.md` — accurate Track 3 handoff after verification.

## Acceptance tests

1. An accepted contact avatar renders in the waiting/sidebar conversation and conversation header; absence uses the existing fallback.
2. Avatar and per-contact preferences survive encrypted-store rehydration.
3. `allowSave` and `allowForward` use the canonical identity record, flow to outgoing media metadata, and remain independent for A-to-B and B-to-A.
4. A display-name collision cannot select or mutate another canonical contact's privacy policy.
5. Existing Track 1 focused authentication/recovery suites and Track 2 receipt suite remain green after integration.
