# CONTACT_ARCHITECTURE.md — VEIL Contact & Space-Isolated Address Book

## 1. Architectural Principles

In VEIL, contacts and address books adhere to strict multi-Space cryptographic isolation:
1. **Per-Space Scoping**: Contacts in Space A ("Personal") are completely invisible and inaccessible in Space B ("Work" or "Decoy").
2. **Encrypted Persistence**: All contact cards are stored in `EncryptedSpaceStore` under the active Space's derived `StorageKey`.
3. **No Centralized Identity Server**: Contacts are exchanged purely peer-to-peer via signed invitation payloads (`InvitationPayload`).
4. **Verification State**: Each contact tracks a verification state (`UNVERIFIED` vs `VERIFIED`) linked to out-of-band safety number comparison.

---

## 2. Contact Model & Lifecycle

```typescript
export interface Contact {
  identityId: string;
  name: string;
  fingerprint: string;
  signingPublicKey: string;
  keyAgreementPublicKey: string;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'MISMATCH';
  addedAt: number;
  lastSeen?: number;
  prekeyBundle?: PrekeyBundle;
  mailboxId?: string;
  metadata?: Record<string, string>;
}
```

---

## 3. Cryptographic Invitation Format

Signed invitations contain the full identity document, recipient blind `mailboxId`, and `PrekeyBundle` for instantaneous asynchronous Double Ratchet / X3DH session handshakes:

```typescript
export interface InvitationPayload {
  version: 1;
  identityId: string;
  name: string;
  signingPublicKey: string;
  keyAgreementPublicKey: string;
  fingerprint: string;
  mailboxId?: string;
  prekeyBundle?: PrekeyBundle;
  createdAt: number;
  expiresAt: number;
  signature: string; // Ed25519 signature over canonical payload string
}
```
