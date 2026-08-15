# PHASE 04: End-to-End Encrypted 1-to-1 Messaging (Double Ratchet)

## Objective
Implement the Double Ratchet protocol for one-to-one messaging, guaranteeing Forward Secrecy and Post-Compromise Security.

## Requirements
1. **Prekey Bundles**: Generate and manage Identity Keys, Signed Prekeys (with Ed25519 signatures), and One-Time Prekeys.
2. **Initial Handshake (X3DH)**: Establish initial ratchet state using extended triple Diffie-Hellman key exchange.
3. **Double Ratchet Engine**: Symmetric KDF ratchets + Diffie-Hellman asymmetric ratchets.
4. **Out-of-Order Message Handling**: Safely buffer and decrypt skipped or out-of-order message keys.
5. **Replay Protection**: Reject duplicated or replayed message nonces.
6. **Attack Tests**: Verify that modifying ciphertext, tampering with headers, or replaying packets triggers immediate cryptographic rejection.

## Definition of Done
- Complete 1-to-1 messaging cycle functional across Double Ratchet sessions.
- Forward secrecy and break-in recovery verified via automated attack tests.
