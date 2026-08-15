# IMPLEMENTATION PLAN — VEIL PHASE 19
# FINAL RELEASE ENGINEERING, RC2 HARDENING & v1.0.0 GA

You are continuing development of the VEIL privacy-first end-to-end encrypted messaging application.

IMPORTANT:
VEIL has completed Phases 0–18.

Current release candidate:

    v1.0.0-rc.2

Current verified state:

    Test files: 144
    Tests: 324
    Failures: 0
    Skipped: 0
    Production build: PASS
    Working tree: CLEAN
    Latest commit: 82fa3ca

Phase 18 completed:

- high-concurrency stress testing
- extreme failure/race-condition testing
- formal cryptographic invariant verification
- CSPRNG nonce uniqueness testing
- HKDF domain separation verification
- deterministic keypair validity verification
- RC2 release documentation
- formal security proof documentation

The objective of Phase 19 is NOT to introduce major new application features.

The objective is to take RC2 and turn it into a reproducible, auditable, installable, production release candidate suitable for final v1.0.0 General Availability.

============================================================
1. PRIMARY OBJECTIVE
============================================================

Produce a release-quality VEIL v1.0.0 artifact with:

1. Reproducible builds
2. Version consistency
3. Release artifact generation
4. Cryptographic integrity manifests
5. Dependency and supply-chain verification
6. Final security regression testing
7. Final browser/runtime compatibility validation
8. Final deployment validation
9. Upgrade and rollback validation
10. Release documentation
11. Git tagging
12. Clean working tree
13. Explicit GA release checklist

Do NOT redesign the cryptographic architecture.

Do NOT replace existing cryptographic primitives.

Do NOT rewrite the Double Ratchet.

Do NOT rewrite Group Ratchet.

Do NOT redesign Space isolation.

Do NOT add unrelated features.

This is a RELEASE ENGINEERING phase.

============================================================
2. ABSOLUTE ARCHITECTURAL FREEZE
============================================================

The following subsystems are FROZEN unless a release-blocking defect is discovered:

src/crypto/
src/spaces/
src/ratchet/
src/group/
src/recovery/
src/storage/
src/network/
src/server/
src/contacts/
src/attachments/
src/notifications/
src/search/

Do not modify cryptographic algorithms merely for optimization.

Do not change:

- Argon2id parameters
- XChaCha20-Poly1305 usage
- AES-GCM usage where already defined
- HKDF-SHA256 domains
- Ed25519 signing
- X25519/key agreement
- Double Ratchet state transitions
- Group epoch semantics
- Space Master Key architecture
- StorageKey derivation
- IdentitySeed derivation
- relay capability authentication
- encrypted IndexedDB persistence

If a genuine defect is discovered:

1. Stop.
2. Identify the exact invariant violated.
3. Write a regression test.
4. Make the smallest possible fix.
5. Re-run the entire suite.
6. Document the change in DECISIONS.md.
7. Do NOT continue silently.

============================================================
3. RELEASE VERSION CONSISTENCY
============================================================

Audit every version source in the repository.

Ensure:

- package.json
- package-lock.json
- application version
- release metadata
- README
- release documentation
- deployment metadata
- CLI output
- generated artifacts

all consistently identify:

    v1.0.0

Remove stale:

    v1.0.0-rc.2

references where they should no longer exist.

Retain historical RC2 references where appropriate in release history.

Create a single canonical version source where practical.

Add a test:

tests/release-version.test.ts

It must fail if version declarations disagree.

============================================================
4. REPRODUCIBLE BUILD SYSTEM
============================================================

Establish a deterministic production build process.

Requirements:

- clean install
- deterministic dependency installation
- production TypeScript compilation
- Vite production build
- no development-only artifacts
- no debug output
- no secrets embedded in dist/
- no local filesystem paths embedded in dist/
- no environment credentials embedded in dist/

Create:

scripts/release-build.*

or an equivalent repository-native release script.

The release build must:

1. remove previous build output
2. install/use locked dependencies
3. execute tests
4. execute security checks
5. build production artifacts
6. validate artifacts
7. generate integrity metadata

============================================================
5. RELEASE ARTIFACT INTEGRITY
============================================================

Generate SHA-256 checksums for all release artifacts.

Create:

    release/
        v1.0.0/
            checksums.sha256
            manifest.json

The manifest must identify:

- release version
- git commit
- build timestamp
- Node version
- package manager version
- operating system/build environment
- artifact names
- artifact sizes
- SHA-256 hashes

Do NOT place secrets into the manifest.

Add automated verification:

tests/release-integrity.test.ts

Test that:

- every declared artifact exists
- hashes match
- no undeclared production artifacts exist
- manifest version matches package version

============================================================
6. PRODUCTION ARTIFACT AUDIT
============================================================

Inspect the generated dist/ directory.

Automatically reject artifacts containing:

- passwords
- private keys
- Space Master Keys
- test credentials
- API secrets
- relay capabilities
- plaintext message fixtures
- development-only environment variables
- local absolute filesystem paths
- debug endpoints
- localhost URLs unless explicitly required for development-only code

Create:

tests/release-artifact-security.test.ts

Use deterministic test fixtures.

Do NOT use vague string scanning alone for cryptographic security claims.

Document false-positive handling.

============================================================
7. DEPENDENCY & SUPPLY-CHAIN LOCK
============================================================

Audit:

package.json
package-lock.json

Verify:

- lockfile is synchronized
- no undeclared dependencies
- no duplicate conflicting cryptographic libraries
- no unnecessary telemetry packages
- no analytics SDK
- no remote code loading dependency
- no suspicious postinstall scripts
- no unexpected native binaries

Run the repository's appropriate dependency audit command.

Record:

- dependency count
- production dependency count
- audit result
- unresolved advisories, if any
- severity classification

Do not automatically upgrade dependencies just because a newer version exists.

Any dependency update must be justified and fully regression-tested.

Create:

docs/DEPENDENCY_SECURITY.md

============================================================
8. FINAL CRYPTOGRAPHIC REGRESSION GATE
============================================================

Re-run all existing cryptographic tests.

Additionally create:

tests/phase19-crypto-regression.test.ts

Verify at minimum:

1. Argon2id password derivation
2. random salt generation
3. random nonce generation
4. XChaCha20-Poly1305 encryption/decryption
5. authentication failure on tampering
6. HKDF domain separation
7. Space Master Key uniqueness
8. StorageKey uniqueness
9. IdentitySeed separation
10. Ed25519 signature verification
11. invalid signature rejection
12. Double Ratchet message progression
13. replay rejection
14. Group epoch separation
15. locked-space access rejection
16. panic-lock invalidation
17. encrypted persistence
18. cross-space isolation

No test may rely on timing-based security claims.

============================================================
9. FINAL MULTI-SPACE ISOLATION GATE
============================================================

Create:

tests/phase19-multispace-final.test.ts

Test at least:

- 20 Spaces
- distinct SMKs
- distinct StorageKeys
- distinct mailbox bindings
- distinct queues
- distinct search indexes
- independent contact stores
- independent conversation state
- independent notification state

For every Space A/B pair verify:

    A cannot decrypt B data
    A cannot access B records
    A cannot access B mailbox state
    A cannot access B search index
    A cannot access B volatile session state

Test:

- switch
- lock
- unlock
- panic lock
- restart

between multiple Spaces.

============================================================
10. FINAL NETWORK / RELAY GATE
============================================================

Validate the complete real transport path:

CLIENT A
    ↓
E2EE
    ↓
NETWORK MANAGER
    ↓
TLS
    ↓
RELAY
    ↓
TLS
    ↓
NETWORK MANAGER
    ↓
E2EE
    ↓
CLIENT B

Test:

- mailbox creation
- capability authentication
- HTTP transport
- WebSocket transport
- reconnect
- exponential backoff
- offline queue
- restart recovery
- duplicate delivery
- ACK-after-persistence
- TTL expiry
- malformed envelopes
- oversized envelopes
- relay restart
- client restart
- simultaneous client restart

The relay MUST NOT decrypt message contents.

============================================================
11. FINAL ATTACHMENT GATE
============================================================

Test realistic attachment flows:

- small image
- 1 MiB file
- larger multi-chunk file
- corrupted chunk
- corrupted final hash
- interrupted transfer
- resumed transfer
- Space switch during transfer
- lock during transfer
- panic lock during transfer

Verify:

- encrypted chunks
- authenticated chunks
- SHA-256 integrity
- no plaintext persistence
- Blob URL revocation
- memory cleanup
- safe failure

============================================================
12. FINAL RECOVERY GATE
============================================================

Validate:

- recovery mnemonic generation
- backup export
- encrypted backup
- backup import
- wrong backup passphrase
- corrupted backup
- expired/invalid recovery data
- restoration into a fresh application instance

Verify recovered Space state does not accidentally expose unrelated Spaces.

============================================================
13. FINAL UI / UX SECURITY GATE
============================================================

Verify:

- neutral lock screen
- failed credential handling
- Space switching
- auto-lock
- panic lock
- notification suppression while locked
- no plaintext in URL
- no plaintext in localStorage
- no plaintext in console
- no sensitive data in browser title
- no sensitive data in document metadata
- no sensitive data in error messages

Test keyboard accessibility.

Test:

- keyboard-only navigation
- focus trapping in modals
- Escape behavior
- screen-reader labels
- button semantics
- form labels
- visible focus states

Create:

tests/phase19-ui-security-final.test.ts

============================================================
14. BROWSER COMPATIBILITY MATRIX
============================================================

Document supported browsers/runtimes based on actual implementation.

At minimum evaluate:

- Chromium-based browser
- Firefox
- Safari/WebKit if environment permits

Validate:

- IndexedDB
- WebCrypto
- WebSocket
- Blob APIs
- Web Workers if used
- clipboard APIs if used
- notifications if used

Do not claim support for a browser that was not actually tested.

Create:

docs/BROWSER_COMPATIBILITY.md

Clearly distinguish:

SUPPORTED
PARTIALLY SUPPORTED
UNTESTED
UNSUPPORTED

============================================================
15. PRODUCTION DEPLOYMENT SMOKE TEST
============================================================

Use the existing deployment configuration.

Validate:

Caddy
Nginx
Docker
systemd

where practical.

For each validated deployment:

1. Start relay.
2. Verify health endpoint.
3. Verify readiness endpoint.
4. Establish secure client connection.
5. Send E2EE message.
6. Receive E2EE message.
7. Verify WebSocket connection.
8. Restart relay.
9. Verify client recovery.
10. Verify persistent relay queue.
11. Verify graceful shutdown.

Do NOT claim real TLS certificate validation if the environment does not provide actual certificates.

Use clearly labeled local/test certificates when necessary.

============================================================
16. BACKUP & RESTORE VALIDATION
============================================================

Validate relay backup procedures.

Test:

- backup creation
- backup integrity
- restore to clean directory
- restore with existing data
- corrupted backup
- interrupted backup
- permissions failure
- insufficient disk space

Document:

docs/OPERATIONS_BACKUP_RESTORE.md

============================================================
17. UPGRADE / ROLLBACK TESTING
============================================================

Simulate:

RC2
 ↓
v1.0.0

and verify:

- existing encrypted Spaces remain readable
- IndexedDB schema remains compatible
- messages remain decryptable
- relay queues remain compatible
- recovery backups remain compatible

Then test rollback behavior.

IMPORTANT:

Do NOT claim arbitrary downgrade support.

If downgrade is unsafe, explicitly document:

    "Downgrade is unsupported."

Create:

tests/upgrade-compatibility.test.ts

============================================================
18. SECURITY DOCUMENTATION FINALIZATION
============================================================

Review all security claims across:

README.md
docs/
docs/SECURITY_AUDIT.md
docs/FORMAL_SECURITY_PROOF.md
docs/RELAY_SECURITY.md
docs/NETWORK_SECURITY.md
docs/CRYPTOGRAPHY.md
docs/KNOWN_LIMITATIONS.md

Remove or correct claims such as:

- "unbreakable"
- "perfect anonymity"
- "fully anonymous"
- "formally proven secure" unless precisely qualified
- "zero metadata"
- "audited" unless an actual external audit exists

Use precise language.

VEIL may provide strong cryptographic confidentiality under documented assumptions.

It does NOT magically eliminate:

- endpoint compromise
- browser compromise
- OS compromise
- traffic analysis
- IP visibility
- denial of service
- malicious relay infrastructure
- compromised user devices

Create:

docs/SECURITY_CLAIMS.md

containing:

CLAIM
BOUNDARY
ASSUMPTIONS
WHAT VEIL DOES NOT GUARANTEE

============================================================
19. PRIVACY / TELEMETRY FINAL AUDIT
============================================================

Verify:

- no analytics
- no telemetry
- no tracking pixels
- no third-party tracking scripts
- no unexpected external requests
- no remote configuration fetches
- no automatic crash-reporting service unless explicitly configured and documented

Create:

tests/privacy-network-egress.test.ts

Document expected external network destinations.

============================================================
20. LICENSE & THIRD-PARTY NOTICE
============================================================

Audit all production dependencies.

Generate or update:

LICENSE
THIRD_PARTY_NOTICES.md

Ensure third-party licenses are represented appropriately.

Do not invent license information.

If license metadata cannot be verified, document it rather than guessing.

============================================================
21. RELEASE DOCUMENTATION
============================================================

Create:

docs/RELEASE_V1.0.0.md

Include:

- release version
- release date
- supported environments
- major capabilities
- security architecture
- known limitations
- deployment instructions
- upgrade instructions
- backup instructions
- rollback limitations
- test results
- artifact hashes
- commit hash

Create:

docs/GA_RELEASE_CHECKLIST.md

Checklist must contain:

[ ] version consistency
[ ] clean install
[ ] full tests
[ ] production build
[ ] cryptographic regression
[ ] multispace isolation
[ ] network E2EE
[ ] attachment integrity
[ ] recovery
[ ] UI security
[ ] browser compatibility
[ ] deployment smoke tests
[ ] backup/restore
[ ] upgrade compatibility
[ ] dependency audit
[ ] privacy audit
[ ] artifact integrity
[ ] documentation review
[ ] git clean
[ ] release tag

============================================================
22. FINAL TEST ORCHESTRATION
============================================================

Create a single release verification command.

Prefer:

    npm run verify:release

It must execute, in appropriate order:

1. typecheck
2. unit tests
3. integration tests
4. security tests
5. performance sanity tests
6. dependency audit
7. production build
8. artifact validation
9. integrity manifest generation

The command must fail immediately when a mandatory gate fails.

Do NOT make tests artificially pass.

============================================================
23. FINAL RELEASE TEST TARGET
============================================================

The final target is:

    100% passing
    0 failures
    0 skipped

unless an explicitly documented environment-dependent test cannot run.

If a test cannot run:

- mark it clearly
- explain why
- do not falsely report it as passed

============================================================
24. GIT RELEASE PROCESS
============================================================

Before tagging:

1. Run full release verification.
2. Inspect git diff.
3. Inspect generated release artifacts.
4. Verify no secrets.
5. Verify no temporary files.
6. Verify no node_modules changes.
7. Verify lockfile state.
8. Verify documentation.
9. Verify clean build.

Create a final release commit:

    release: v1.0.0

Then create annotated git tag:

    v1.0.0

Do NOT push the tag unless explicitly instructed.

============================================================
25. FINAL RELEASE SCORECARD
============================================================

Generate:

docs/GA_RELEASE_SCORECARD.md

Use:

| Category | Result | Evidence | Status |
|----------|--------|----------|--------|
| Cryptography | | | |
| Multi-Space Isolation | | | |
| Storage | | | |
| Networking | | | |
| E2EE Messaging | | | |
| Groups | | | |
| Attachments | | | |
| Recovery | | | |
| UI Security | | | |
| Privacy | | | |
| Relay | | | |
| Deployment | | | |
| Performance | | | |
| Compatibility | | | |
| Supply Chain | | | |
| Documentation | | | |

No category may be marked PASS without actual evidence.

============================================================
26. AI CONTINUITY
============================================================

Update:

docs/ai/ACTIVE_TASK.md
docs/ai/CURRENT_STATE.md
docs/ai/CHANGELOG.md
docs/ai/DECISIONS.md
docs/ai/HANDOFF.md

Add appropriate ADRs for release engineering decisions.

Record:

- final commit
- release version
- test count
- test files
- build result
- release artifact hashes
- supported environments
- known limitations
- unresolved risks
- release status

============================================================
27. DEFINITION OF DONE
============================================================

Phase 19 is COMPLETE only when:

[ ] v1.0.0 version consistency verified
[ ] reproducible production build verified
[ ] release artifacts generated
[ ] SHA-256 integrity manifest generated
[ ] artifact security scan passes
[ ] dependency audit passes
[ ] cryptographic regression passes
[ ] multispace regression passes
[ ] network E2EE regression passes
[ ] attachment regression passes
[ ] recovery regression passes
[ ] UI security regression passes
[ ] privacy egress audit passes
[ ] browser compatibility documented
[ ] deployment smoke tests pass
[ ] backup/restore verified
[ ] upgrade compatibility verified
[ ] security claims reviewed
[ ] third-party notices updated
[ ] release documentation complete
[ ] GA release scorecard complete
[ ] AI continuity documents updated
[ ] full test suite passes
[ ] production build passes
[ ] release commit created
[ ] v1.0.0 annotated tag created
[ ] git working tree clean

============================================================
28. FINAL RESPONSE REQUIRED FROM AGENT
============================================================

When finished, return a structured report:

# PHASE 19 COMPLETE

## Release
- Version:
- Git commit:
- Git tag:
- Build status:

## Tests
- Test files:
- Total tests:
- Passed:
- Failed:
- Skipped:

## Security
- Cryptographic regression:
- Multi-Space isolation:
- Privacy audit:
- Dependency audit:
- Artifact security:

## Compatibility
- Chromium:
- Firefox:
- Safari/WebKit:
- Node.js:

## Deployment
- Caddy:
- Nginx:
- Docker:
- systemd:

## Release Artifacts
- Artifact directory:
- Manifest:
- SHA-256 checksum file:

## Documentation
- Release notes:
- GA checklist:
- Security claims:
- Compatibility:
- Backup/restore:
- Scorecard:

## Known Limitations

List only verified limitations.

## Unresolved Risks

List anything that prevents claiming a completely clean GA release.

## Final Status

Choose exactly one:

    GA READY
    RELEASE BLOCKED

Do not claim GA READY if any mandatory release gate failed.