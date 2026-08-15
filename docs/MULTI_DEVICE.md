# MULTI_DEVICE.md — VEIL Multi-Device Enrollment & Selective Synchronization

## 1. Executive Summary

VEIL supports multi-device operation while preserving its core security invariant: **Multi-Space Cryptographic Isolation**.
Users can enroll secondary devices (such as a laptop, tablet, or secondary phone) and explicitly select which individual Spaces are synchronized.

---

## 2. Ephemeral Device Enrollment Protocol

```mermaid
sequenceDiagram
    autonumber
    actor Alice as User
    participant Primary as Primary Device
    participant Secondary as Secondary Device

    Primary->>Primary: User selects Spaces to sync (e.g. Work, Main)<br/>Generate Ephemeral Keypair (PrivP, PubP)
    Primary->>Alice: Displays QR Code { sessionId, PubP, nonce }
    Secondary->>Secondary: Scans QR Code<br/>Generate Ephemeral Keypair (PrivS, PubS)<br/>Generate Long-Term Device Keys (DevPub, DevPriv)
    Secondary->>Primary: Sends PubS + DevPub over local/direct transport
    Primary->>Primary: Compute Shared Secret = X25519(PrivP, PubS)<br/>Derive 6-Digit SAS Code via HKDF-SHA256
    Secondary->>Secondary: Compute Shared Secret = X25519(PrivS, PubP)<br/>Derive 6-Digit SAS Code via HKDF-SHA256
    Primary->>Alice: Displays 6-digit SAS confirmation code
    Secondary->>Alice: Displays 6-digit SAS confirmation code
    Alice->>Primary: Confirms SAS matches
    Alice->>Secondary: Confirms SAS matches
    Primary->>Primary: Encrypt Selected Space Master Keys with Shared Secret<br/>Sign Secondary DevPub with Space Ed25519 Identity
    Primary->>Secondary: Send Encrypted Envelopes + Device Authorization
    Secondary->>Secondary: Decrypt Selected Space Master Keys<br/>Initialize local Space Vaults
```

---

## 3. Short Authentication String (SAS) Derivation

To prevent active Man-in-the-Middle (MITM) attacks during ephemeral key agreement:
$$\text{SASBytes} = \text{HKDF-SHA256}(\text{ikm}=\text{SharedSecret}, \text{salt}=\text{PubP} \parallel \text{PubS}, \text{info}=\text{"veil-v1-device-sas"}, \text{length}=4)$$
$$\text{SASCode} = (\text{BigEndianUInt32}(\text{SASBytes}) \bmod 1,000,000) \to \text{formatted as 6 digits (e.g., "482910")}$$

Both devices must display the identical 6-digit code. If an adversary intercepts and replaces ephemeral public keys, the computed SAS codes will mismatch, allowing the user to abort immediately before any Space credentials are transmitted.

---

## 4. Selective Space Synchronization

- **Per-Space Scope**: The primary device user explicitly chooses which Space(s) to transfer.
- **Unselected Spaces**: For any unselected Space (such as a Private Space or Decoy Space), zero cryptographic keys, metadata, or envelopes are transferred. The secondary device remains completely unaware of their existence.
- **Independent Space Passwords**: The secondary device can set a new local password or unlock credential for the imported Space.

---

## 5. Device Revocation & Post-Revocation Security

1. **Signed Revocation Tombstones**: An authorized device can revoke any secondary device by signing a `RevocationRecord` with the Space's Ed25519 identity key.
2. **Key & Prekey Pool Rotation**: Upon device revocation, remaining active devices rotate local prekey pools and ratchet states.
3. **Exclusion from Future Fan-out**: Revoked device IDs are removed from the active `DeviceRegistry` and will not receive future sync envelopes or multi-device messages.
