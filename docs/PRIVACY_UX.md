# PRIVACY_UX.md — VEIL Privacy UX, Panic Lock & Decoy Space Architecture

## 1. Overview & Core UX Philosophy

VEIL turns advanced cryptography (multi-space cryptographic isolation, blind mailboxes, Double Ratchet, Sender Keys, zero-knowledge recovery) into a simple, intuitive, and modern chat experience.

### Primary Rule: Privacy Should Be Simple
- The user does not need to understand Argon2id, HKDF, MLS, or X25519 to use VEIL safely.
- Technical cryptography is hidden under clean indicators (e.g. `Verified ✓` instead of raw epoch numbers).
- Advanced security details are available on-demand in a dedicated "Security Details" screen for technical auditing.

---

## 2. Credential-Selected Entry Screen

```text
              VEIL

        Enter your password
        [ • • • • • • • • ]
               Unlock
```

- **Zero Disclosure Before Unlock**: The unlock screen does not display Space names, the number of existing Spaces, or recent conversation previews.
- **Generic Failure Response**: Any invalid or unrecognized credential returns the identical error: `"Unable to unlock."`
- **Space Switching**: To switch Spaces, the user locks the current Space, returns to the generic unlock screen, and enters a different credential.

---

## 3. Quick Lock vs. Panic Lock

| Property | Quick Lock | Panic Lock |
| :--- | :--- | :--- |
| **Intent** | Normal everyday locking when stepping away. | Immediate emergency privacy containment under duress. |
| **Scope** | Current active Space. | **ALL** Spaces and memory partitions. |
| **Session State** | Session destroyed; volatile keys zeroized. | **ALL** active sessions destroyed; all volatile keys zeroized. |
| **UI State** | Clears active Space messages, media, drafts, search. | Wipes **ALL** cached UI data, drafts, search caches, and clipboard tracking. |
| **Data Preservation** | Encrypted envelopes on disk remain safe. | Encrypted envelopes on disk remain safe (zero accidental deletion). |
| **Device Enrollment**| Devices remain authorized. | Devices remain authorized (no silent revocation). |

---

## 4. Notification Privacy Tiers

Users can configure per-Space notification privacy levels:

1. **High Privacy**:
   - Title: `"VEIL"`
   - Body: `"New message"` (or `"New attachment"`)
   - Sender name and message plaintext are completely suppressed.
2. **Balanced Privacy** (Default):
   - Title: `Sender Name` (or `"VEIL"` if hidden)
   - Body: `"Sent a message"` / `"Sent an attachment"`
   - Plaintext message content is suppressed.
3. **Convenient**:
   - Displays sender name and preview text if unlocked.
4. **Locked-State Invariant**:
   - When a Space is locked, all notifications collapse to High Privacy (`"VEIL: New message"`).
   - Upon Quick/Panic Lock, all notifications for locked Spaces are immediately purged from active notification history.

---

## 5. Decoy Space Model & Honest Limitations

- **Genuine Independent Spaces**: A Decoy Space in VEIL is not a "fake UI". It is a genuine encrypted Space with its own independent Space Master Key (SMK), independent storage partition, and real communication capability.
- **Zero Cross-Space Leakage**: Decoy Space settings never reveal hidden or alternate Spaces.
- **Anti-Denial Invariant**: VEIL never claims "perfect plausible deniability" against full forensic filesystem or memory analysis.
