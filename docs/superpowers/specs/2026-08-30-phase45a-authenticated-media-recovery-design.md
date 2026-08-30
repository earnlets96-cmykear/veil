# VEIL Phase 45A — Authenticated Media Delivery and Recovery Design

## Scope

This track repairs authenticated attachment delivery, session restoration, remote account recovery, and diagnostic redaction only. It does not change receipts, avatars, replies, thumbnails, or general UI.

## 1. Current lifecycle and verified failures

Account creation creates a local Space, derives its keys from the supplied passphrase, creates an identity, registers an account remotely with the same supplied credential, uploads a v1 encrypted identity backup, and saves a session record locally. Unlock loads the local Space and calls `ensureCloudSession`.

The existing session path has three defects:

- `ensureCloudSession` reads an undeclared `explicitPassword`. A cold/expired-session path throws, catches the exception silently, and returns `false`; subsequent attachment requests run with no bearer token.
- The `veil:cloud:session` record persists `authPassword`, then silently uses it to reauthenticate. This unnecessarily retains a plaintext credential, even though the record is encrypted at rest.
- `ensureCloudSession` accepts any CloudClient token without proving it belongs to the Space's saved account. A stale session from another Space can be reused.

Attachment creation sends `targetContact.name` as `recipientUsername`, although `name` is a display name and the `Contact` model does not retain a canonical account username. The server therefore cannot reliably authorize a valid recipient. The server already correctly requires a bearer session and checks the owner or explicitly authorized recipient; that boundary remains intact.

## 2. New authentication and session lifecycle

`CloudSessionState` is the only persisted client session data:

```ts
interface CloudSessionState {
  sessionToken: string;
  accountId: string;
  deviceId: string;
  expiresAt: number;
  username: string; // canonical, lower-case, no @
}
```

It is stored only through `EncryptedSpaceStore`; it contains no password, recovery credential, master key, or private key.

`CloudSessionCoordinator` holds an optional credential only in memory for the currently unlocked/recovered session. On unlock or recovery, the entered credential is registered in the coordinator. A non-expired saved session is restored only after its shape is validated and is installed with `CloudClient.setSession`. An expired/rejected session is cleared. Reauthentication is attempted only while an in-memory credential exists; otherwise attachment work fails with a clear authentication-required error. Account registration is never an automatic fallback for an existing Space.

Every attachment method calls `CloudClient.requireAuthenticatedSession()` before issuing a network request. Thus no attachment request with a missing, malformed, or stale local token reaches the network. A server 401 clears the client session; a one-time reauthentication retry is permitted only through the coordinator.

## 3. Current recovery data and omissions

The v1 recovery blob has one `spaceId`, one master key, one identity document, and two private keys. It omits all encrypted application records, contacts, conversations, additional Spaces, and any durable contact metadata. The existing tests only prove key/identity restoration; they write contacts and conversations after the snapshot has already been uploaded.

## 4. Versioned recovery snapshot

The replacement is `VEIL-RECOVERY-SNAPSHOT-v2`, encrypted client-side with a fresh Argon2id-derived KEK and XChaCha20-Poly1305 AAD bound to the canonical username and format version.

```ts
interface RecoverySnapshotV2 {
  version: 2;
  createdAt: number;
  spaces: Array<{
    envelope: SpaceHeaderEnvelope;
    masterKeyBase64: string;
    identityDocument: IdentityDocument;
    signingPrivateKeyBase64: string;
    keyAgreementPrivateKeyBase64: string;
    encryptedRecords: StoredRecord[];
  }>;
}
```

Only currently unlockable Spaces are included. Creating or changing recoverable state refreshes the snapshot while the Space is unlocked. Each embedded record remains encrypted under its Space StorageKey; the outer recovery encryption adds an independent authenticated layer. The server receives only opaque ciphertext, nonce/format, and KDF parameters.

Restore validates the outer format, KDF parameters, snapshot version, per-Space envelope/identity structure, and decryptability before writing local state. It restores envelopes, identity records, and encrypted records into a fresh local adapter, then stores the newly-issued token-only CloudSessionState and calls `CloudClient.setSession`.

## 5. Migration

Existing token-only session records are accepted after validation. Any legacy `authPassword` field is ignored and removed on the next successful unlock/recovery. Existing v1 recovery blobs remain readable for identity-only restoration, then are upgraded to v2 after the user unlocks a Space and supplies the credential; v1 cannot reconstruct state it never contained. No automatic registration occurs as part of migration.

## 6. Recipient authorization

`Contact` gains an optional canonical `accountUsername`, taken only from a verified signed profile/invitation. Attachment creation uses it as `recipientUsername`; it never uses a display name. The server resolves that handle after authenticating the requester and permits only the owner, a matching recipient account, or an explicit allowed account. Missing canonical recipient identity is a sender-side validation error.

## 7. Logging and redaction

Runtime diagnostics recursively redact sensitive keys and values, including credentials, tokens, keys, account/identity/device identifiers, authorization values, ciphertext/plaintext, and blob URLs. Safe event names, byte counts, MIME categories, and coarse status codes remain available. CloudClient removes direct console diagnostics. Tests capture console output and inspect diagnostic history recursively against representative secrets.

## 8. Threat model and security controls

- R2/attachment routes remain bearer-authenticated and recipient-authorized.
- The relay/server never receives plaintext recovery credentials, master keys, private keys, messages, decrypted media, or recovery snapshot plaintext.
- Session tokens are encrypted locally, expire server-side, and are never logged.
- A rejected or expired token is cleared; no token substitution or public-endpoint fallback exists.
- Snapshot parsing is fail-closed before local writes; malformed/corrupt snapshots surface a specific safe error.
- The account authentication credential and recovery encryption credential may be the same user-entered value in the current UX, but their use is explicit and in-memory only. They are not persisted as authentication state.

## 9. Expected file changes

- `src/network/cloudClient.ts`: typed session validation, fail-closed attachment gate, redacted error mapping.
- `src/ui/app/AppState.tsx`: coordinator-backed session restoration; remove `authPassword`, `explicitPassword`, and automatic registration fallback; canonical recipient lookup.
- `src/account/accountManager.ts`: v2 snapshot creation, v1 compatibility, fresh-store restoration, token-only persistence.
- `src/contacts/types.ts`, `src/contacts/contactManager.ts`, `src/contacts/contactRequestManager.ts`: verified canonical account username propagation.
- `src/debug/runtimeDiagnostics.ts`, `src/ui/utils/mediaLogger.ts`: recursive redaction and no sensitive identifiers.
- `tests/phase45a-authenticated-media-e2e.test.ts`, `tests/phase45a-auth-recovery-e2e.test.ts`, `tests/phase45a-auth-security.test.ts`, `tests/phase45a-sensitive-logging.test.ts`: behavioral regression coverage.
- `docs/ai/CURRENT_STATE.md`, `docs/ai/ACTIVE_TASK.md`, `docs/ai/CHANGELOG.md`, `docs/ai/HANDOFF.md`: verified state and handoff.

## 10. Acceptance criteria

1. Missing/invalid attachment auth fails before the HTTP request; valid sender and canonical recipient requests succeed.
2. Logout/login, cold session restoration, and a 401-triggered reauthentication preserve the correct account binding without persisted credentials.
3. Fresh local storage can recover an account from a remote v2 encrypted snapshot, recreate identities, Spaces, encrypted contacts/conversations, a CloudClient session, and an authenticated encrypted-media download/decrypt operation.
4. No test secret, token, password, key, full identifier, blob URL, plaintext, or ciphertext appears in diagnostic history or console output.
5. The dedicated suites, full Vitest suite, web/release builds, Capacitor sync, and Android debug build pass.
