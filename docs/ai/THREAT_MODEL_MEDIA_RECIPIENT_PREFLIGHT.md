# Media Recipient Preflight Threat Model

## Scope

This change resolves direct-message recipient profile material before attachment encryption and upload. It does not change Double Ratchet, prekey consumption, attachment encryption, message serialization, relay routing, or group media delivery.

## Assets and trust boundaries

- Recipient identity and signing-key continuity are trusted only through the existing contact record and verified signed profile.
- Directory responses are untrusted, attacker-controlled input.
- Attachment plaintext, media keys, encrypted outbox state, and Space partitions remain governed by `THREAT_MODEL_MEDIA.md`.

## Threats and controls

| Threat | Control |
|---|---|
| Directory returns a forged or expired profile | Verify the profile signature and expiry before using or persisting its prekey bundle. |
| Directory returns a profile for a different conversation identity | Require exact identity ID equality whenever the conversation/contact already identifies the peer. |
| Directory refresh attempts to replace a pinned signing key | Require the profile signing key to match the contact's existing signing key and verify with that key. |
| Profile embeds an invalid or mismatched identity document | Verify the embedded self-signed identity document and require its identity ID to match the signed profile. |
| Upload succeeds but E2EE message setup cannot proceed | Resolve the session/prekey before starting attachment upload; fail closed and retain the user's selected file when resolution fails. |
| Refreshed profile crosses Space boundaries | Store through the active Space's existing `ContactManager` and `EncryptedSpaceStore`; no global profile cache is added. |

## Residual risk and release gate

The directory can withhold a valid profile and block sending; this is an availability failure, not a reason to bypass recipient authentication. No profile or attachment key is sent to a new service. This is post-RC security-sensitive recipient setup work: independent security review, formal audit, dual sign-off, and physical Android send/retry validation remain mandatory before deployment.
