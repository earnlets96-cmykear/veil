# App Performance Audit and Safe Improvements

Date: 2026-10-11

## Goal

Reduce the cost users pay on startup and during chat-list updates while preserving message, group, attachment, media, authentication, and privacy behavior. Keep protocol, cryptography, identity, and persistence formats unchanged.

## Baseline evidence

- Production Vite build: 242 modules; entry JavaScript 1,087.38 kB minified / 294.57 kB gzip; existing warning for chunks above 500 kB.
- `App.tsx` statically imports all modal screens, including Settings, group/profile panels, and social-video sharing.
- Sidebar reads the complete `messages` context dictionary and performs a contacts `.find()` for every conversation while creating list rows.
- Focused performance suites: 67 passed; 5 failed because relay/recovery tests cannot connect to local services in this environment. The media crypto benchmark passed at 89.9/43.5ms (2MB encrypt/reassemble), 348.2/216.4ms (10MB), and 1499.8/1008.8ms (50MB).
- Existing worktree contains unrelated dirty docs/release files and untracked folders; do not stage or edit them.

## Implementation steps

1. Add a regression test proving secondary modal screens are dynamically loaded and rendered behind Suspense; run it first and confirm it fails.
2. Lazy-load screens that are only shown after login or an explicit user action. Keep Create Space and Restore Account eager for lock/onboarding flows. Preserve every modal condition and prop. Build and compare the entry bundle plus emitted modal chunks.
3. Add a sidebar regression test for precomputed contact lookup and use a memoized identity-to-avatar map, avoiding a linear contact scan per conversation. Preserve latest-message status and text fallbacks.
4. Run focused performance/UI tests and TypeScript, then production Vite build. Compare outputs to the baseline and inspect git diff for accidental behavior changes.
5. Update AI task/changelog/state docs only in a separate, clearly scoped patch if appropriate; do not overwrite existing user/agent changes. Do not commit unrelated dirty files.

## Guardrails

- No changes to cryptography, identity, Space isolation, authentication, message/group protocols, attachment formats, or transport.
- No weakening or deleting existing tests.
- Do not claim device smoothness is proven without an Android device. Report local relay test limitations and physical-device validation needs.
- Keep fixes minimal and revert any change that does not produce a measurable or testable benefit.

## Verification results

- Added regressions were observed failing before implementation and passed after the fixes.
- `npm run typecheck`: passed.
- Focused app/media/chat performance and UI suites: 16 files, 72 tests passed.
- Production Vite build: passed. Entry JavaScript decreased from 1,087.38 kB / 294.57 kB gzip to 925.11 kB / 262.02 kB gzip (162.27 kB / 32.55 kB gzip smaller). Settings, group, profile, account/space, app-lock, and social-video screens emit deferred chunks. Existing >500 kB core entry warning remains.
- The media benchmark passed at 2/10/50 MB but remains CPU intensive at 50 MB (about 1.5 s encryption and 1.0 s reassembly in this test environment). Five unrelated profile/media integration checks could not connect to local relay/recovery services.
- Android device scrolling, startup, and attachment-send profiling were unavailable here. These results prove bundle and test improvements, not an on-device frame-rate target.
