# DEVICE_LINKING.md — Multi-Device Pairing & Revocation Protocol

## 1. Pairing Protocol Flow

1. **Initiation**: Primary device exports a signed pairing request containing ephemeral key agreement public key and timestamp.
2. **Key Agreement**: Secondary device derives shared pairing secret via X25519 ECDH.
3. **SAS Comparison**: Both devices render a 6-digit Short Authentication String (SAS) for in-person confirmation.
4. **Provisioning**: Primary device transmits encrypted Space enrollment payload.
5. **Revocation**: Removing a device marks its enrollment record as revoked in `DeviceManager`; revoked devices are rejected from future synchronization.
