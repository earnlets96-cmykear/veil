# UX_SECURITY.md — User Experience Privacy Guidelines & Security Ergonomics

## 1. Neutral Credential Unlock UX

- The VEIL lock screen is **neutral by design**:
  - It does NOT display lists of existing Spaces (e.g. "Personal", "Secret Work", "Decoy").
  - The user enters their passphrase, and `SpaceVaultManager` authenticates the matching encrypted `SpaceHeaderEnvelope` on-the-fly.
  - An attacker observing the screen cannot determine how many Spaces exist or what they are named.
  - Invalid credentials return a generic error: `"Invalid credentials or Space envelope not found."`

---

## 2. Panic Lock Ergonomics

- The **Panic Lock** button is accessible from both the locked state and the authenticated dashboard header.
- Activating Panic Lock triggers an instantaneous memory wipe without confirmation prompts or animations that would delay execution.
- Immediately halts WebSocket connections and clears decrypted messages.

---

## 3. Safety Number Verification Workflow

- Contact details modals format the peer's 256-bit public identity key fingerprint into a readable 12-digit safety number (e.g. `482 193 771 402`).
- Users can visually compare this safety number in person or over an out-of-band verified channel to confirm authenticity and prevent man-in-the-middle attacks.
