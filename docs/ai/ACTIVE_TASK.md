# ACTIVE_TASK.md — Active Work Tracker

## Active Phase: PHASE 54 (Definitive Feature Inventory & Missing-Feature Forensic Audit)
- **Status**: **COMPLETE & VERIFIED 100% (AUDIT ONLY)**
- **Branch**: `main`
- **Output Document**: `docs/PHASE54_FEATURE_AUDIT.md`

### Completed Tasks
- [x] Inspected entire codebase across 12 feature domains and 68 individual capabilities.
- [x] Verified working implementations (GREEN) against code reality and test suites.
- [x] Identified broken/mock implementations (RED): Mute toggle, Voice Call button, Local deletion cloud resurrection bug, Group messaging disconnect, Contact blocking active message bypass, Offline queue drain UI disconnect, Cloud snapshot Last-Write-Wins overwrite risk.
- [x] Identified incomplete implementations (YELLOW): Search scope gap, Safety number QR scanner absence, Decoy space UI toggle absence, Group read receipts, Decrypted media memory cleanup.
- [x] Identified missing standard messenger features (MISSING): Emoji reactions, Message editing, Delete for everyone, Message forwarding, Pin message/chat, In-chat unread separator line, Disappearing messages, Real background push notifications (FCM), Real-time typing indicators & presence, Cover traffic padding.
- [x] Documented Android platform reality (Build Verified vs. Physical Runtime Unverified).
- [x] Generated definitive 15-section audit report matching Section 31 requirements (`docs/PHASE54_FEATURE_AUDIT.md`).
- [x] Updated project state documentation (`CURRENT_STATE.md`, `ACTIVE_TASK.md`, `CHANGELOG.md`).

---

## Next Phase: PHASE 55 (Integrity Hardening & Mock Removal — P0 Focus)
- [ ] Wire `deleteMessageLocally` to `scheduleCloudSync` in `src/ui/app/AppState.tsx`.
- [ ] Enforce `isBlocked()` in incoming message processing loop in `src/ui/app/AppState.tsx`.
- [ ] Persist contact mute status in encrypted space store and connect to `NotificationDispatcher`.
- [ ] Remove mock Voice Call button from `src/ui/components/ProfileModal.tsx`.
- [ ] Notify `AppState` when `networkManager.flushOutboundQueue` succeeds to advance message status to `SENT_TO_RELAY`.
