# CHANGELOG.md — VEIL Project Changelog

All notable changes, architectural decisions, and security milestones across the VEIL project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Phase 17] - 2026-08-15

### Added
- **Real-World Deployment, Production Integration, Security Validation & Release Hardening**:
  - `deployment/Caddyfile.example`: Caddy reverse proxy template with automatic TLS 1.3 and WebSocket support.
  - `deployment/nginx/veil.conf.example`: Nginx configuration with TLS 1.3, rate-limiting, and WebSocket upgrade.
  - `deployment/systemd/veil-relay.service.example`: Sandboxed systemd service file with OS-level restrictions.
  - `deployment/docker/Dockerfile` & `deployment/docker/docker-compose.yml`: Reproducible containerized relay packaging.
  - `deployment/.env.example` & `deployment/README.md`: Exhaustive deployment variables and operations manual.
  - Architecture and Operations Documentation:
    - `docs/PHASE17_PRODUCTION_VALIDATION.md`
    - `docs/DEPLOYMENT.md`
    - `docs/SELF_HOSTING.md`
    - `docs/SECURITY_AUDIT.md`
    - `docs/FAILURE_MODES.md`
    - `docs/COMPATIBILITY.md`
    - `docs/PERFORMANCE.md`
    - `docs/BACKUP_RECOVERY.md`
    - `docs/PRIVACY_DATA_FLOW.md`
    - `docs/RELEASE.md`
  - Documented `ADR-081` through `ADR-085` in `docs/ai/DECISIONS.md`.
  - 10 new test suites (315 total tests across 141 test files, 100% clean pass):
    - `tests/phase17-production-config.test.ts`
    - `tests/phase17-real-relay-e2e.test.ts`
    - `tests/phase17-restart-recovery.test.ts`
    - `tests/phase17-failure-injection.test.ts`
    - `tests/phase17-multispace-adversarial.test.ts`
    - `tests/phase17-security-audit.test.ts`
    - `tests/phase17-dependency-audit.test.ts`
    - `tests/phase17-performance-realistic.test.ts`
    - `tests/phase17-privacy-regression.test.ts`
    - `tests/phase17-release-artifacts.test.ts`

---

## [Phase 16] - 2026-08-15


### Added
- **Final Production Validation, Performance Benchmarking & System Packaging**:
  - `src/server/cli.ts`: Standalone Relay Server CLI entrypoint supporting configurable port, host, storage directory, and graceful shutdown (`npm run relay`).
  - `tests/performance-benchmarks.test.ts`: Performance benchmarking suite measuring Argon2id latency, AEAD throughput (> 1,000 ops/sec), attachment throughput (> 10 MiB/sec), and in-memory search latency (< 10ms for 1,000 records).
  - `tests/system-e2e-orchestration.test.ts`: Full cross-subsystem orchestration test verifying multi-Space creation, credential-selected unlocking, signed invitation onboarding, Double Ratchet messaging, chunked attachment transfers, local search, and emergency Panic Lock.
  - `docs/SYSTEM_SUMMARY.md`: Comprehensive technical specification synthesizing all 16 phases.
  - `README.md`: Complete documentation rewrite with feature matrix, quickstart guide, self-hosting guide, cryptographic specifications table, and documentation links.
  - Documented `ADR-079` and `ADR-080` in `docs/ai/DECISIONS.md`.
  - Added 2 new automated test suites (299 total tests across 131 test files, 100% clean pass).

---

## [Phase 15] - 2026-08-15


### Added
- **Production Integration, Real-World Messaging & Application Hardening**:
  - `src/contacts/types.ts`: Defined Contact model, verification status, and signed `InvitationPayload`.
  - `src/contacts/invitationManager.ts`: Cryptographic invitation manager with Ed25519 signatures, timestamp validity, replay protection, and 7-day expiration.
  - `src/contacts/contactManager.ts`: Space-isolated contact storage in `EncryptedSpaceStore` with verification toggle.
  - `src/attachments/types.ts`: Attachment metadata and chunking descriptors.
  - `src/attachments/attachmentPipeline.ts`: 64 KiB chunking with XChaCha20-Poly1305, full-file SHA-256 integrity verification, on-demand decryption, and ephemeral Blob revocation.
  - `src/notifications/types.ts` & `notificationDispatcher.ts`: Privacy policies (`HIDDEN`, `SENDER_ONLY`, `FULL_OBFUSCATED`) and locked-state suppression.
  - `src/search/types.ts` & `searchEngine.ts`: High-speed volatile in-memory search engine strictly isolated per Space and wiped on lock/panic.
  - `src/config/types.ts` & `appConfig.ts`: Typed environment configurations (dev, test, prod) with fail-closed TLS enforcement.
  - `src/server/storage/persistentRelayStore.ts`: File-backed persistent relay store with atomic `.tmp` rename operations and TTL sweep garbage collection.
  - Extended React 19 UI with instant search overlay, contacts tab, file attachment picker, device management, and exportable invitation generator (`src/ui/`).
  - Architecture Documentation:
    - `docs/CONTACT_ARCHITECTURE.md`
    - `docs/INVITATION_PROTOCOL.md`
    - `docs/MESSAGE_LIFECYCLE.md`
    - `docs/ATTACHMENT_ARCHITECTURE.md`
    - `docs/DEVICE_LINKING.md`
    - `docs/DATABASE_ARCHITECTURE.md`
    - `docs/NOTIFICATION_PRIVACY.md`
    - `docs/PRODUCTION_CONFIGURATION.md`
    - `docs/PRODUCTION_DEPLOYMENT.md`
  - Documented `ADR-072` through `ADR-078` in `docs/ai/DECISIONS.md`.
  - 12 new automated test suites (295 total tests across 129 test files, 100% clean pass):
    - `tests/contact-onboarding.test.ts`
    - `tests/invitation-protocol.test.ts`
    - `tests/message-lifecycle-production.test.ts`
    - `tests/group-production-lifecycle.test.ts`
    - `tests/attachment-pipeline.test.ts`
    - `tests/device-production-lifecycle.test.ts`
    - `tests/notification-privacy-dispatcher.test.ts`
    - `tests/search-privacy.test.ts`
    - `tests/production-config.test.ts`
    - `tests/relay-persistence-file.test.ts`
    - `tests/e2e-realistic-flow.test.ts`
    - `tests/accessibility-ui.test.ts`

---

## [Phase 14] - 2026-08-15


### Added
- **Production Application Shell, Real Messaging UI & Client Integration**:
  - `src/ui/app/types.ts`: Defined UI view models, conversation models, message timeline models, and modal types.
  - `src/ui/app/sessionController.ts`: Application session coordinator managing credential-selected Space unlocking, Space switching total state purge, inactivity auto-lock timers, and instantaneous panic lock.
  - `src/ui/app/AppState.tsx`: React 19 Context provider integrating underlying services (`SpaceVaultManager`, `EncryptedSpaceStore`, `ConversationManager`, `GroupManager`, `NetworkManager`, `SpaceIdentityManager`).
  - `src/ui/components/LockScreen.tsx`: Neutral login interface with passphrase entry, persistent Space envelope count, and emergency panic lock trigger.
  - `src/ui/components/CreateSpaceModal.tsx`: Dialog to create an isolated Space with Argon2id parameters and automatic IndexedDB persistence.
  - `src/ui/components/Sidebar.tsx`: Multi-space selector, search bar, category filter, 1-to-1 conversation list, group list, and modal triggers.
  - `src/ui/components/ConversationView.tsx`: Main chat header, real-time message timeline with animated bubbles, timestamps, delivery status indicators (`QUEUED`, `SENDING`, `SENT_TO_RELAY`, `DELIVERED_TO_RECIPIENT`), and attachment previews.
  - `src/ui/components/MessageComposer.tsx`: Input area with Enter to send, Shift+Enter for multiline, and offline indicator.
  - `src/ui/components/NewChatModal.tsx`: Direct E2EE session initiation via peer Identity Document exchange.
  - `src/ui/components/NewGroupModal.tsx`: Group creation modal with initial member configuration.
  - `src/ui/components/GroupDetailsModal.tsx`: Group member management, member invitation, removal, and forward-secrecy epoch updates.
  - `src/ui/components/ContactDetailsModal.tsx`: Safety number verification (12-digit grouped fingerprint comparison).
  - `src/ui/components/SettingsModal.tsx`: Space settings, auto-lock interval selection, notification privacy levels, and emergency panic lock trigger.
  - `src/ui/App.tsx`: Root React application component.
  - `src/main.tsx`: React 19 entrypoint mounting `AppProvider` into DOM `#root`.
  - `src/styles/veil-design-system.css`: Complete tokenized styling for responsive desktop, tablet, and mobile layouts.
  - `docs/UI_ARCHITECTURE.md`: Component hierarchy, state flow, and security boundaries.
  - `docs/UX_SECURITY.md`: User experience privacy guidelines, neutral lock screen design, safety number workflows, and panic lock ergonomics.
  - Documented `ADR-067` through `ADR-071` in `docs/ai/DECISIONS.md`.
  - Added 5 new automated test suites (276 total tests across 117 test files, 100% clean pass):
    - `tests/ui-session-controller.test.ts`: Unlocking, Space switching state wipe, auto-lock, and panic lock.
    - `tests/ui-conversation-flow.test.ts`: E2EE message sending/receiving, status transitions, and timeline rendering.
    - `tests/ui-group-flow.test.ts`: Group creation, messaging, and epoch updates.
    - `tests/ui-privacy-security.test.ts`: Neutral credential rejection, zero-plaintext persistence protection.
    - `tests/ui-offline-network.test.ts`: Offline status indicator, outbound queue display, and reconnect sync.

---

## [Phase 13] - 2026-08-15


### Added
- **Client Networking & Relay Integration**:
  - `src/network/types.ts`: Defined `NetworkState`, `DeliveryStatus`, `NetworkConfig`, `QueuedOutboundEnvelope`, `QueuedInboundEnvelope`, and `SpaceMailboxBinding`.
  - `src/network/errors.ts`: Typed client network errors (`NetworkError`, `RelayUnavailableError`, `MailboxRevokedError`, `ProtocolVersionMismatchError`, `TlsRequiredError`, `EnvelopePayloadTooLargeError`, `UnauthorizedMailboxError`).
  - `src/network/httpTransport.ts`: Typed REST client interfacing with Phase 12 Relay Server endpoints with request timeouts, HTTP error mapping, and TLS enforcement.
  - `src/network/websocketTransport.ts`: Real-time WebSocket transport client with connection lifecycle states, mailbox capability authentication, ping/pong heartbeats, and exponential backoff with jitter.
  - `src/network/envelopeQueue.ts`: Persistent encrypted outbound and inbound queues backed by `EncryptedSpaceStore` (IndexedDB) with **ACK-after-persistence** semantics and duplicate delivery reconciliation.
  - `src/network/networkManager.ts`: Central client networking coordinator managing per-Space mailbox bindings, automatic queue draining, offline message persistence, and E2EE payload routing.
  - `docs/NETWORK_ARCHITECTURE.md`: Client networking architecture and subsystem design.
  - `docs/CLIENT_RELAY_INTEGRATION.md`: Integration guide connecting client E2EE engines to the relay server.
  - `docs/OFFLINE_DELIVERY.md`: Offline messaging, persistent queuing, restart recovery, and deduplication.
  - `docs/NETWORK_SECURITY.md`: Network threat model, per-Space isolation boundaries, and TLS fail-closed rules.
  - Documented `ADR-062` through `ADR-066` in `docs/ai/DECISIONS.md`.
  - Added 10 new automated test suites (268 total tests across 112 test files, 100% clean pass):
    - `tests/network-relay-client.test.ts`: HTTP transport and health/mailbox/envelope endpoints.
    - `tests/network-mailbox.test.ts`: Per-Space mailbox allocation and encrypted capability storage.
    - `tests/network-send-receive.test.ts`: Outbound and inbound pipeline over relay with ACK-after-persistence.
    - `tests/network-websocket.test.ts`: Real-time WebSocket envelope push and connection handling.
    - `tests/network-reconnect-backoff.test.ts`: Reconnection state transitions and exponential backoff.
    - `tests/network-offline-persistence.test.ts`: Offline queuing and application restart persistence recovery.
    - `tests/network-duplicates.test.ts`: Duplicate envelope suppression and deduplication registry.
    - `tests/network-multispace.test.ts`: 10-Space strict network, mailbox, and queue isolation.
    - `tests/network-security.test.ts`: TLS enforcement, locked session defense, and error handling.
    - `tests/network-integration-e2ee.test.ts`: Full end-to-end E2EE lifecycle over relay (Alice encrypts -> Relay transports -> Bob receives -> Bob decrypts -> Bob ACKs -> Bob replies).

---

## [Phase 12] - 2026-08-15


### Added
- **Standalone Production Relay Server & Blind Mailbox Transport Protocol v1**:
  - `src/server/types.ts`: Defined Relay Protocol v1 types, opaque `RelayEnvelope` ($\le 64$ KiB), `MailboxRecord` with one-way SHA-256 capability hashing, and standardized error codes.
  - `src/server/config.ts`: Centralized server limits, TTLs, and operational thresholds.
  - `src/server/logger.ts`: Structured `PrivacyLogger` with automatic redaction of capability tokens, passwords, keys, and payloads.
  - `src/server/rateLimiter.ts`: In-memory sliding-window rate limiter (120 req/min/IP) preventing request storms and mailbox flooding.
  - `src/server/storage/relayStore.ts`: `IRelayStore` abstraction decoupling transport logic from database drivers.
  - `src/server/storage/memoryRelayStore.ts`: In-memory transactional store with queue bounds and TTL sweep.
  - `src/server/wsHandler.ts`: Real-time WebSocket delivery handler supporting capability auth, instant envelope push, ping/pong heartbeats, and backpressure.
  - `src/server/relayServer.ts`: Standalone HTTP/WebSocket server implementing `/healthz`, `/readyz`, `/v1/mailboxes`, `/v1/envelopes`, `/v1/envelopes/fetch`, `/v1/envelopes/ack`, and `/v1/ws`.
  - `docs/RELAY_PROTOCOL.md`: Formal specification of VEIL Relay Transport Protocol v1.
  - `docs/RELAY_ARCHITECTURE.md`: Architecture guide, trust boundaries, and at-least-once delivery semantics.
  - `docs/RELAY_SECURITY.md`: Security analysis, threat model, abuse prevention, and production deployment boundaries.
  - `docs/RELAY_PRIVACY.md`: Metadata minimization, zero plaintext guarantee, and privacy logging rules.
  - Documented `ADR-057` through `ADR-061` in `docs/ai/DECISIONS.md`.
  - Added 8 new automated test suites (256 total tests across 102 test files, 100% clean pass):
    - `tests/relay-protocol.test.ts`: HTTP endpoints and schema tests.
    - `tests/relay-capabilities.test.ts`: Capability one-way SHA-256 verification and cross-mailbox isolation.
    - `tests/relay-delivery.test.ts`: At-least-once delivery, queue bounds, and ACK deletion.
    - `tests/relay-websocket.test.ts`: Real-time push, socket auth, and heartbeats.
    - `tests/relay-abuse.test.ts`: 64 KiB size bounds, rate limiting, and malformed request defense.
    - `tests/relay-privacy.test.ts`: Log sanitization and zero-decryption invariant.
    - `tests/relay-shutdown.test.ts`: Graceful server stop and socket draining.
    - `tests/relay-integration.test.ts`: 2-client end-to-end simulated transport lifecycle.

---

## [Phase 11] - 2026-08-15


### Added
- **Persistent Encrypted Local Storage (IndexedDB) & Required Storage Integration**:
  - `src/storage/types.ts`: Defined `IStorageAdapter`, `StoredRecord`, `StorageMetadata`, `MigrationDefinition`, and custom storage errors (`StorageUnavailableError`, `StorageQuotaError`, `StorageCorruptionError`, `StorageMigrationError`).
  - `src/storage/migrations.ts`: Transactional schema migration engine with Version 1 baseline establishing `envelopes`, `records` (index `by_spaceId`), and `meta` object stores.
  - `src/storage/indexedDbAdapter.ts`: Production IndexedDB storage driver with fail-closed behavior when IndexedDB is unavailable or fails initialization.
  - `src/storage/memoryAdapter.ts`: Test-only in-memory storage adapter for non-persistent environments.
  - `src/storage/spaceStore.ts`: Integrated `EncryptedSpaceStore` with `IStorageAdapter` for async persistent record writes and partition loading while preserving synchronous caching.
  - `src/spaces/vault.ts`: Added minimal persistence bridge methods (`loadEnvelopesFromStorage`, `saveEnvelopeToStorage`, `deleteSpaceWithStorage`).
  - `src/main.ts`: Updated production app initialization to initialize `IndexedDBStorageAdapter` and fail closed on error.
  - `docs/STORAGE_ARCHITECTURE.md`: Complete technical storage architecture guide with plaintext persistence protection framing and honest disk boundaries.
  - Documented `ADR-054` (Persistent IndexedDB Storage Adapter), `ADR-055` (Transactional Schema Migration Engine), `ADR-056` (Fail-Closed Storage Architecture).
  - Added 3 new test suites (236 total tests across 94 test files, 100% clean pass):
    - `tests/storage-indexeddb-restart.test.ts`: 7-step real application restart persistence, cross-space isolation, zero-plaintext audit, and tampering detection test.
    - `tests/storage-migrations.test.ts`: Baseline schema creation and migration execution tests.
    - `tests/storage-concurrency-quota.test.ts`: Fail-closed and quota error containment tests.

---

## [v1.0.0-rc.1] - 2026-08-15 (Phase 10)


### Added
- **Release Candidate Packaging, Production Hardening & Operational Readiness**:
  - `tests/e2e-release-lifecycle.test.ts`: Complete end-to-end full system lifecycle integration test covering space creation, credential-selected unlocking, blind mailboxes, 1-to-1 Double Ratchet, group SenderKey messaging, 64 KiB encrypted media, multi-device SAS enrollment, BIP-39 recovery, Panic Lock, and space deletion.
  - `SECURITY.md`: Security policy and responsible vulnerability disclosure SLAs.
  - `docs/SECURITY_GUIDE.md`: Comprehensive technical security architecture guide.
  - `docs/USER_PRIVACY_GUIDE.md`: Plain-language privacy guide for end users.
  - `docs/DEVELOPMENT.md`: Developer onboarding, build, and contribution standards.
  - `docs/DEPLOYMENT.md`: Production server hardening, reverse proxy TLS, and container security.
  - `docs/OPERATIONS.md`: Production operations, monitoring, health checks, and key rotation.
  - `docs/INCIDENT_RESPONSE.md`: 10-step incident response workflow and key compromise containment.
  - `docs/ABUSE_MODEL.md`: Abuse containment and resource defense model.
  - `docs/RELEASE_CHECKLIST.md`: Formal production readiness verification matrix.
  - `RELEASE_NOTES.md`: Official `v1.0.0-rc.1` release candidate notes.
  - `docs/RELEASE_CANDIDATE_REPORT.md`: Release candidate certification report.
  - `THIRD_PARTY_NOTICES.md`: Complete open source license attributions.
  - `.env.example`: Standardized environment variable template.
  - Enforced Post-RC Security Freeze governance rule in `AGENTS.md`.
  - Documented `ADR-049` (End-to-End Lifecycle Verification), `ADR-050` (Post-RC Freeze), `ADR-051` (Vulnerability Disclosure), `ADR-052` (Zero-Knowledge Deployment), `ADR-053` (v1.0.0-rc.1 Tagging).

---

## [Phase 9] - 2026-08-15


### Added
- **Adversarial Security Audit, Red-Team Review & Release Hardening**:
  - `docs/SECURITY_AUDIT.md`: Complete security asset inventory, trust boundaries, and threat actor matrix.
  - `docs/SECURITY_AUDIT_REPORT.md`: Comprehensive adversarial red-team audit report and release candidate classification.
  - `docs/SECURITY_PROPERTIES.md`: Cryptographic security property matrix mapping claims to tests and boundary limitations.
  - `docs/SECURITY_SCORECARD.md`: Subsystem-by-subsystem evaluation (`PASS` / `PASS WITH LIMITATIONS`).
  - `docs/RELEASE_BLOCKERS.md`: Mandatory release blocker resolution verification.
  - `docs/SECURITY_DEBT.md`: Transparent accepted risks and post-release technical hardening roadmap.
  - Documented `ADR-044` (Adversarial Verification), `ADR-045` (Hostile Parser Fuzzing), `ADR-046` (Cryptographic Invariants & Nonces), `ADR-047` (Real-Time Panic Lock Session Invalidation), `ADR-048` (Release Candidate Designation).
- **Adversarial Red-Team Test Suites (8 new suites, 15 new tests, 229 total across 90 test files)**:
  - `tests/audit-crypto-invariants.test.ts`: Nonce collision verification across 10,000 CSPRNG samples, HKDF subkey domain separation, and buffer zeroization.
  - `tests/audit-cross-space-attacks.test.ts`: In-memory and local storage cross-space partition injection attacks, credential oracle rejection.
  - `tests/audit-protocol-state-machine.test.ts`: Double Ratchet and Group SenderKey epoch rollback rejection.
  - `tests/audit-media-pipeline.test.ts`: Media chunk swapping attacks and corrupted chunk AAD validation.
  - `tests/audit-device-recovery.test.ts`: BIP-39 mnemonic checksum corruption detection and corrupted backup file rejection.
  - `tests/audit-transport-server-boundary.test.ts`: IDOR capability access attempts across blind mailboxes.
  - `tests/audit-panic-race-conditions.test.ts`: Instant session destruction and in-flight storage operation rejection during panic lock.
  - `tests/audit-fuzz-parsers.test.ts`: Hostile fuzz testing of padding unpadding, transport envelopes, and backup deserializers with 500+ random/malformed buffers.

---

## [Phase 8] - 2026-08-15


### Added
- **Metadata Minimization, Traffic Analysis Resistance & Privacy-Preserving Network Behavior**:
  - `src/privacy/padding.ts`: `MessagePadding` implementing discrete size bucket quantization (512B, 2KB, 8KB, 32KB, 64KB), length-prefixed CSPRNG random padding, and hard bounds (`MAX_MESSAGE_SIZE = 64KB`, `MAX_PADDED_SIZE = 128KB`).
  - `src/transport/trafficShaper.ts`: `TrafficShaper` providing bounded random delay jitter (20ms–400ms), envelope batching queues (up to 5 envelopes), and three traffic privacy levels (`Standard`, `Balanced`, `High`).
  - `src/transport/mailboxRotation.ts`: `MailboxRotationManager` with epoch-based capability rotation and overlapping grace periods.
  - `src/privacy/presencePrivacy.ts`: `PresencePrivacyManager` providing typing indicator rate-limiting (3s threshold), opt-in read receipts with opaque IDs, and configurable last-seen status.
- **Documentation & Audits**:
  - `docs/METADATA_AUDIT.md`: System-wide metadata vector catalog and classifications.
  - `docs/API_METADATA_AUDIT.md`: Endpoint-by-endpoint inspection and minimization analysis.
  - `docs/SERVER_PRIVACY.md`: Server logging, retention, and access control policies.
  - `docs/ANONYMITY_NETWORKS.md`: Architectural analysis of Tor, mixnets, VPNs, and proxies.
  - `docs/METADATA_REMAINING_LEAKAGE.md`: Transparent documentation of residual traffic signals.
  - Documented `ADR-039` (Size Bucket Quantization), `ADR-040` (Timing Jitter & Batching), `ADR-041` (Mailbox Capability Rotation), `ADR-042` (Rate-Limited Presence), `ADR-043` (Traffic Privacy Levels).
- **Test Suites (12 new suites, 15 new tests, 214 total across 82 files)**:
  - `tests/message-padding.test.ts`: Bucket quantization and unpadding exactness.
  - `tests/resource-limit.test.ts`: Payload size bounds and memory exhaustion defenses.
  - `tests/timing-privacy.test.ts`: Jitter scheduling and bounded random delays.
  - `tests/identifier-privacy.test.ts`: Cryptographically random, non-sequential IDs.
  - `tests/push-privacy.test.ts`: Opaque wakeups without content or Space leakage.
  - `tests/presence-privacy.test.ts`: Typing rate-limiting and receipt privacy controls.
  - `tests/transport-privacy.test.ts`: Batch queue thresholds and immediate dispatch.
  - `tests/media-metadata.test.ts`: 64 KiB chunk standardization and encrypted metadata.
  - `tests/server-metadata.test.ts`: Honest-but-curious server database audit.
  - `tests/cross-space-metadata.test.ts`: Indistinguishable traffic across Main, Private, and Decoy Spaces.
  - `tests/privacy-levels.test.ts`: Standard, Balanced, and High traffic privacy configuration.
  - `tests/metadata-analysis.test.ts`: Traffic analysis test harness and mailbox rotation grace periods.

---

## [Phase 7] - 2026-08-15


### Added
- **Privacy UX, Panic Lock, Decoy Spaces & Human-Centered Security**:
  - `src/privacy/types.ts`: Privacy levels (`high`, `balanced`, `convenient`), auto-lock intervals, notification privacy tiers, sensitive content types, and security indicator structures.
  - `src/privacy/privacyManager.ts`: Per-Space privacy settings manager with presets.
  - `src/privacy/lockManager.ts`: `LockManager` implementing Quick Lock (single-space), Panic Lock (multi-space instant wipe), and configurable Auto-Lock inactivity countdowns.
  - `src/privacy/notificationManager.ts`: `NotificationManager` implementing privacy-preserving notification tiers and locked-state notification purging.
  - `src/privacy/uiStateManager.ts`: `UIStateManager` for dynamic tracking and complete wiping of sensitive UI plaintexts, drafts, previews, and search caches upon lock.
  - `src/privacy/securityIndicators.ts`: `SecurityIndicators` providing human-readable status (`Verified ✓`, `Unverified`, `Security Changed ⚠`) and identity change alerts.
  - `src/privacy/decoyEnforcement.ts`: `DecoyEnforcement` validating authentic decoy space independence and strict anti-disclosure.
  - `src/privacy/disclosureGuard.ts`: `DisclosureGuard` enforcing generic `"Unable to unlock."` errors and filtering prohibited security marketing claims.
- **Documentation**:
  - `docs/PRIVACY_UX.md`: Comprehensive specification of VEIL's privacy UX model.
  - `docs/KNOWN_LIMITATIONS.md`: Concrete and honest security boundaries and limitation analysis.
  - Documented `ADR-034` (Two-Tier Lock Model), `ADR-035` (Granular Notification Privacy), `ADR-036` (Complete UI State Purge), `ADR-037` (Genuine Decoy Spaces), `ADR-038` (Human-Centered Security Indicators).
- **Test Suites (9 new suites, 15 new tests, 199 total across 70 files)**:
  - `tests/panic-lock.test.ts`: Instant multi-space session destruction and UI purge.
  - `tests/quick-lock.test.ts`: Single-space lock isolation.
  - `tests/decoy-space.test.ts`: Independent decoy SMK and zero cross-space disclosure.
  - `tests/notification-privacy.test.ts`: High/Balanced/Convenient tiers and locked-state fallback.
  - `tests/locked-state.test.ts`: UI element and search cache purging on lock.
  - `tests/privacy-settings.test.ts`: Per-Space privacy settings persistence and presets.
  - `tests/error-disclosure.test.ts`: Error sanitization and prohibited term enforcement.
  - `tests/security-indicators.test.ts`: Human-readable status badges and identity change warnings.
  - `tests/auto-lock.test.ts`: Inactivity timer countdowns, activity resets, background events.

---

## [Phase 6] - 2026-08-15


### Added
- **Multi-Device Synchronization & Zero-Knowledge Cryptographic Recovery**:
  - `src/device/types.ts`: `DeviceRecord`, `DeviceEnrollmentSession`, `EnrollmentTicket`, `EnrollmentPayload`, `SpaceSyncEnvelope`, `DeviceRevocationRecord`, `DeviceRegistry`.
  - `src/device/enrollment.ts`: `DeviceEnrollmentManager` implementing ephemeral X25519 Diffie-Hellman key agreement, 6-digit visual SAS confirmation code derivation via HKDF-SHA256, and XChaCha20-Poly1305 encrypted credential tunnels.
  - `src/device/deviceManager.ts`: `DeviceManager` with signed `DeviceRevocationRecord` tombstones, authorization verification, and active device enumeration.
  - `src/recovery/bip39.ts`: BIP-39 mnemonic encoder/decoder supporting 24-word standard English recovery phrases with 8-bit SHA-256 checksums.
  - `src/recovery/wordlist.ts`: Standard 2048-word BIP-39 English wordlist.
  - `src/recovery/recoveryVault.ts`: `RecoveryVault` handling zero-knowledge Space recovery from 24-word mnemonics and standalone encrypted `.veilbackup` emergency files.
  - `src/spaces/vault.ts`: Extended `createSpace` to support importing custom/recovered `masterKey`.
- **Documentation**:
  - `docs/MULTI_DEVICE.md`: Comprehensive multi-device enrollment and selective synchronization specification.
  - `docs/RECOVERY.md`: Comprehensive zero-knowledge recovery specification.
  - Documented `ADR-029` (Ephemeral QR Key Agreement with SAS), `ADR-030` (Selective Space Sync), `ADR-031` (Signed Device Revocation), `ADR-032` (BIP-39 Mnemonic Recovery), `ADR-033` (Anti-Escrow and Zero Server Password Reset).
- **Test Suites (7 new suites, 9 new tests, 184 total across 61 files)**:
  - `tests/device-enrollment.test.ts`: QR ticket generation, ephemeral key exchange, SAS calculation & confirmation.
  - `tests/device-sas-mitm.test.ts`: MITM attack detection via SAS code mismatch.
  - `tests/device-selective-sync.test.ts`: Selective Space sync and complete isolation of unselected Spaces.
  - `tests/device-revocation.test.ts`: Device revocation, signed tombstones, re-registration prevention.
  - `tests/bip39-recovery.test.ts`: 24-word BIP-39 mnemonic generation, checksum validation, deterministic identity restoration.
  - `tests/recovery-file.test.ts`: Encrypted emergency backup file export and import with wrong password rejection.
  - `tests/no-server-backdoor.test.ts`: Anti-backdoor and zero-knowledge enforcement tests.

---

## [Phase 5] - 2026-08-15


### Added
- **Encrypted Group Messaging & Encrypted Media Vault**:
  - `src/group/types.ts`: Group messaging types, roles (`CREATOR`, `ADMIN`, `MEMBER`), `GroupEpoch`, `GroupMember`, `GroupAction`, `GroupState`, `SenderKeyDistributionMessage`, `GroupMessagePayload`.
  - `src/group/groupKdf.ts`: Sender key symmetric chain stepping (`HMAC-SHA256`), epoch master derivation (`HKDF-SHA256`), metadata encryption keys, and canonical byte serializations for AAD authentication and Ed25519 signatures.
  - `src/group/senderKey.ts`: `SenderKeySession` state machine with $O(1)$ group message encryption, bounded skipped key buffer (`MAX_GROUP_SKIPPED_KEYS = 500`), Ed25519 sender signature verification, and single-use message key zeroization.
  - `src/group/groupState.ts`: `GroupStateManager` enforcing role hierarchy, Ed25519 signature checks, anti-rollback epoch validation, and encrypted group metadata.
  - `src/group/groupManager.ts`: `GroupManager` coordinating group creation, pairwise distribution over 1-to-1 Double Ratchet channels, epoch advancement, key rotation upon member departure, and encrypted Space store persistence.
  - `src/media/types.ts`: `MediaMetadata`, `EncryptedMediaChunk`, `EncryptedMediaPackage`, `EncryptedMediaAttachment`, `MediaUploadRequest`, `MediaDownloadResponse`.
  - `src/media/mediaEncryptor.ts`: Symmetric client-side chunked encryption with `XChaCha20-Poly1305`, random 32-byte keys per media file, canonical AAD binding (`mediaId`, `chunkIndex`, `totalChunks`, `isLastChunk`), and SHA-256 integrity digests.
  - `src/media/mediaStorage.ts`: `InMemoryMediaRelay` / `IMediaStorageAdapter` for untrusted blob transport with capability authorization and corruption testing.
  - `src/media/mediaVault.ts`: `MediaVault` managing local space-isolated encrypted media caching and gallery isolation.
- **Documentation**:
  - `docs/GROUP_PROTOCOL.md`: Comprehensive group protocol specification.
  - `docs/MEDIA_SECURITY.md`: Comprehensive media encryption and untrusted blob transport specification.
  - Documented `ADR-023` (Sender Keys with Epoch Ratcheting), `ADR-024` (Signed Group Actions and Anti-Rollback Epochs), `ADR-025` (Forward Secrecy on Member Departure), `ADR-026` (Single-Use Media Keys), `ADR-027` (Streaming Chunk Authenticated Encryption), `ADR-028` (Untrusted Media Relay and Local Gallery Isolation).
- **Test Suites (20 new suites, 28 new tests, 175 total across 54 files)**:
  - `tests/group-protocol.test.ts`: KDF determinism, key lengths, canonicalization.
  - `tests/group-creation.test.ts`: Random group IDs, creator role, initial epoch 1, signed genesis action.
  - `tests/group-membership.test.ts`: Role hierarchy (`CREATOR` > `ADMIN` > `MEMBER`), permission checks.
  - `tests/group-add-remove.test.ts`: Forward secrecy on member departure, epoch advancement, key rotation.
  - `tests/group-epochs.test.ts`: Monotonic epoch progression, stale action rejection, anti-rollback.
  - `tests/group-replay.test.ts`: Message replay detection and sequence tracking.
  - `tests/group-ordering.test.ts`: Out-of-order message decryption (1, 3, 2) via skipped message keys.
  - `tests/group-state.test.ts`: Signature validation on actions and anti-tampering.
  - `tests/group-rollback.test.ts`: Outbound sender key rollback rejection.
  - `tests/group-malicious-server.test.ts`: Bit-flipped ciphertext rejection, header sequence tampering rejection.
  - `tests/group-isolation.test.ts`: Cross-group and cross-space cryptographic isolation.
  - `tests/media-encryption.test.ts`: Image, audio, video, document encryption with unique keys.
  - `tests/media-integrity.test.ts`: Corrupted chunks, wrong keys, truncated chunks, tampered digests rejected.
  - `tests/media-chunking.test.ts`: Reordered, duplicated, and cross-file substituted chunks detected.
  - `tests/media-authorization.test.ts`: Capability token authorization for upload, download, delete.
  - `tests/media-replay.test.ts`: Duplicate upload idempotency.
  - `tests/media-corruption.test.ts`: Bit-flip, truncated byte stream, modified nonce detection.
  - `tests/group-media.test.ts`: Complete end-to-end flow: Alice, Bob, Charlie; media transfer; member removal blocks subsequent media.
  - `tests/group-crash-recovery.test.ts`: Group state and sender key recovery across lock/unlock cycles.
  - `tests/group-fuzz.test.ts`: Malformed payloads and descriptors fuzz testing.

---

## [Phase 4] - 2026-08-15


### Added
- **End-to-End Encrypted 1-to-1 Messaging (Double Ratchet & X3DH)**:
  - `src/ratchet/types.ts`: Protocol data structures, `PrekeyBundle`, `SignedPrekey`, `OneTimePrekey`, `RatchetMessage`, `PersistedRatchetState`.
  - `src/ratchet/kdf.ts`: Root key KDF (HKDF-SHA256), Symmetric chain KDF (HMAC-SHA256), and canonical header AAD serialization.
  - `src/ratchet/prekeys.ts`: `PrekeyManager` managing generation, signing, and consumption of Signed Prekeys and One-Time Prekey pools.
  - `src/ratchet/x3dh.ts`: Extended Triple Diffie-Hellman protocol (`initiateX3DH` and `receiveX3DH`).
  - `src/ratchet/ratchet.ts`: `DoubleRatchetSession` implementing full Signal-specification DH and symmetric ratcheting, bounded skipped message keys (`MAX_SKIPPED_KEYS = 500`), and single-use key zeroization.
  - `src/messaging/sessionStore.ts`: `RatchetSessionStore` providing encrypted persistence in `EncryptedSpaceStore`.
  - `src/messaging/conversationManager.ts`: `ConversationManager` orchestrating asynchronous handshakes, outbox/inbox queues, message sending/receiving, and local encrypted history.
- **Architecture Decisions**: Documented `ADR-019` (X3DH Key Agreement), `ADR-020` (Double Ratchet Protocol), `ADR-021` (Bounded Skipped Keys), `ADR-022` (Encrypted Session Persistence).
- **Test Suites (10 new suites, 15 new tests, 147 total)**:
  - `tests/prekey-management.test.ts`: SPK Ed25519 signing and OPK pool consumption.
  - `tests/x3dh-handshake.test.ts`: Asymmetric handshake equality and MITM signature rejection.
  - `tests/double-ratchet-core.test.ts`: Bidirectional ping-pong messaging with DH ratchet steps.
  - `tests/out-of-order-messages.test.ts`: Skipped messages (1, 3, 2) and immediate key erasure on use.
  - `tests/forward-secrecy.test.ts`: Current state compromise cannot decrypt past messages.
  - `tests/post-compromise-recovery.test.ts`: Break-in recovery after fresh DH ratchet step.
  - `tests/ratchet-tampering.test.ts`: Header sequenceNum tampering and bit-flipped ciphertext rejection.
  - `tests/session-persistence.test.ts`: Ratchet session restoration across lock/unlock cycles.
  - `tests/conversation-e2ee.test.ts`: Full integration (Alice -> X3DH -> Ratchet -> Mock Transport -> Ratchet -> Bob).
  - `tests/ratchet-isolation.test.ts`: Cross-space isolation (Private Space cannot decrypt Main Space messages).

---

## [Phase 3] - 2026-08-15

### Added
- **Privacy-Preserving Untrusted Transport Interface**:
  - `src/transport/types.ts`: Size classes (`SMALL`, `MEDIUM`, `LARGE`, `XLARGE`), `TransportEnvelope`, `MailboxCapability`, `ServerMailboxRecord`, `ITransportAdapter`.
  - `src/transport/padding.ts`: Length-prefixed deterministic padding and safe unpadding.
  - `src/transport/capability.ts`: Opaque `mailboxId` generation, 256-bit capability secrets, and `SHA-256(capability || tag)` verifier derivation.
  - `src/transport/protection.ts`: Temporary Phase 3 authenticated transport protection.
  - `src/transport/envelope.ts`: Version 1 transport envelope packaging, TTL calculation, and validation.
  - `src/transport/outbox.ts`: `EncryptedOutbox` partitioned per Space in `EncryptedSpaceStore` with retry state.
  - `src/transport/inbox.ts`: `EncryptedInbox` partitioned per Space with encrypted processed ID deduplication registry.
  - `src/transport/server.ts`: `MockTransportServer` with capability verifier checks, TTL auto-purge, failure simulation, and database dump inspection.
  - `src/transport/client.ts`: `TransportClient` coordinating outbox/inbox queues, retries, and offline mode.
- **Architecture Decisions**: Documented `ADR-015` (blind mailbox model), `ADR-016` (size classes and padding), `ADR-017` (encrypted outbox/inbox), `ADR-018` (transport adapter pattern).
- **Test Suites (10 new suites, 31 new tests, 132 total)**:
  - `tests/transport-mailbox.test.ts`: Mailbox lifecycle, status queries, deletion.
  - `tests/transport-authentication.test.ts`: Capability verification, wrong token rejection, verifier one-way hashing.
  - `tests/transport-isolation.test.ts`: Main vs Private vs Decoy space transport isolation.
  - `tests/transport-tampering.test.ts`: Payload ciphertext tampering, nonce tampering, malformed envelope rejection.
  - `tests/transport-replay.test.ts`: Envelope replay detection, duplicate retry rejection, lock/unlock persistence.
  - `tests/transport-padding.test.ts`: Size classes (512B, 2KB, 8KB, 32KB), boundary sizes, safe corruption handling.
  - `tests/transport-expiration.test.ts`: Envelope TTL expiration, fetch auto-purge, global purge.
  - `tests/transport-failure.test.ts`: Offline mode queueing, timeout resilience, recovery on reconnection.
  - `tests/malicious-server.test.ts`: Corrupted server payload handling, truncated response handling.
  - `tests/metadata-exposure.test.ts`: Server database dump audit (zero passwords, SMKs, private keys, or plaintexts).

---

## [Phase 2] - 2026-08-15

### Added
- **Cryptographic Identity Layer**:
  - `src/crypto/hkdf.ts`: Extended with two-tier HKDF identity derivation domains (`veil-v1-identity-seed`, `veil-v1-signing-key`, `veil-v1-key-agreement`).
  - `src/identity/signing.ts`: Ed25519 digital signature wrapper (`@noble/curves/ed25519.js`, v1.8.0).
  - `src/identity/keyAgreement.ts`: X25519 key agreement wrapper (`@noble/curves/ed25519.js`, exports `x25519`).
  - `src/identity/canonical.ts`: Deterministic canonical serialization with explicit field ordering.
  - `src/identity/fingerprint.ts`: SHA-256 fingerprint (12 × 5-digit groups) and identity ID computation.
  - `src/identity/document.ts`: Self-signed `IdentityDocument` with Ed25519 self-signature over canonical bytes.
  - `src/identity/manager.ts`: `SpaceIdentityManager` managing creation, encrypted persistence, loading, signing, verification, and DH key agreement.
- **SpaceSession Extension**: Added `getMasterKey()` for internal identity derivation within the Space boundary.
- **Architecture Decisions**: Documented `ADR-012` (two-tier HKDF identity derivation), `ADR-013` (self-signed identity binding), `ADR-014` (Space cloning produces same identity).
- **Test Suites (52 new tests, 101 total)**:
  - `tests/identity-generation.test.ts`: Identity creation, determinism, Space independence.
  - `tests/identity-signatures.test.ts`: Ed25519 sign/verify, tampered message, wrong key.
  - `tests/key-agreement.test.ts`: X25519 DH commutativity, isolation.
  - `tests/identity-isolation.test.ts`: Cross-Space identity independence, locked Space, signing attacks.
  - `tests/identity-document.test.ts`: Self-signature verification, field tampering, unknown version.
  - `tests/identity-fingerprint.test.ts`: Determinism, format, canonical round-trip.
  - `tests/identity-tampering.test.ts`: Key substitution, bit flips, Frankenstein documents.
  - `tests/identity-lifecycle.test.ts`: Persistence, lock/unlock, password change preserves identity, deletion.

---

## [Phase 1] - 2026-08-15

### Added
- **Cryptographic Space Vault Engine**:
  - `src/crypto/kdf.ts`: Argon2id password KDF (`@noble/hashes/argon2.js`, RFC 9106).
  - `src/crypto/aead.ts`: XChaCha20-Poly1305 authenticated encryption (`@noble/ciphers/chacha.js`).
  - `src/spaces/envelope.ts`: Versioned `SpaceHeaderEnvelope` with canonical AAD context binding.
  - `src/spaces/session.ts`: `SpaceSession` with volatile key management and `destroy()`.
  - `src/spaces/vault.ts`: `SpaceVaultManager` with AAD, targeted/discovery unlock, crash-safe password change.
  - `src/storage/spaceStore.ts`: `EncryptedSpaceStore` with partitioned AEAD storage.

### Fixed
- Enforced AAD envelope metadata binding (`VEIL-v1|version:1|spaceId:<id>|alg:...|salt:...`).
- Optimized credential-selected unlock with targeted `unlockSpace(password, spaceId)`.
- Crash-safe transactional password change with atomic commit.
- Corrected terminology to "selected established cryptographic primitives".

---

## [Phase 0] - 2026-08-15

### Added
- AI-Agent Continuity System, architecture documentation, phase prompts, baseline scaffolding.
