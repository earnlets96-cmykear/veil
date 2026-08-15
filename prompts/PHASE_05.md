# PHASE 05: Encrypted Group Messaging & Encrypted Media

## Objective
Implement multi-party encrypted group conversations and client-side encrypted media storage and transfer.

## Requirements
1. **Group Cryptography**: Implement Sender Keys / group ratchet scheme with key rotation upon member departure.
2. **Group Administration**: Roles (Owner, Admin, Member), invitations, removals, and group metadata protection.
3. **Forward Secrecy on Removal**: When a member is removed, derive a new group epoch key to prevent them from decrypting future messages.
4. **Encrypted Media Vault**: Encrypt images, audio notes, and attachments locally with single-use symmetric keys before upload to untrusted blob storage.
5. **No Automatic Media Leakage**: Private media remains in encrypted client storage and is never automatically exported to shared device galleries.

## Definition of Done
- Group creation, messaging, member removal key rotation, and encrypted media upload/download fully tested.
