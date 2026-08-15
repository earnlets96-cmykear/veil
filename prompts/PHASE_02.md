# PHASE 02: Independent Space Cryptographic Identities

## Objective
Implement independent, self-sovereign cryptographic identities per Space with Ed25519 signing, X25519 key agreement, contact card exchange, and safety number verification.

## Requirements
1. **Keypair Generation**: Seed Ed25519 and X25519 keypairs deterministically from Space identity subkeys.
2. **Zero Cross-Space Linkage**: Verify that identities across different Spaces share no mathematical correlation.
3. **Contact Card Formatting**: Generate and parse `veil://contact?...` URI strings and QR code payloads.
4. **Safety Number Derivation**: Compute 12-digit grouped fingerprint verification codes over sorted public keys.
5. **Contact Book Storage**: Securely persist contacts inside the active Space's encrypted database partition.

## Definition of Done
- Identity generation, contact cards, and safety number verification tests passing.
- Negative tests verifying that tampered signatures or modified contact keys are detected and rejected.
