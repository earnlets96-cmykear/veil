# VEIL App Lock Settings Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make App Lock settings persist, accurately describe, and control the lock behavior for backgrounding, inactivity, and Android screen-off events.

**Architecture:** Centralize validated lock-delay values in the device PIN registry and make the UI and runtime consume that same source. Consolidate app-exit and app-background timing into one leave-app delay, implement a foreground inactivity timer, and add a native Android screen-off signal with a pending-lock marker that survives WebView suspension. Keep startup locked whenever App Lock is enabled and consume pending locks before unlocking.

**Tech Stack:** TypeScript, React 19, Vitest, Capacitor, Kotlin, Android BroadcastReceiver/SharedPreferences.

---

## File map

- Modify `src/privacy/pinManager.ts` to define the canonical delay union and persist/read leave-app, inactivity, and screen-off settings with backwards-compatible defaults.
- Add `src/privacy/appLockPolicy.ts` for pure delay parsing and elapsed-time decisions so timer edge cases can be unit tested without React or Android.
- Modify `src/ui/components/AppLockSettingsView.tsx` to use semantic controls backed by the canonical registry and show saved values.
- Modify `src/ui/components/SettingsModal.tsx` to remove the disconnected Security-page inactivity selector or route it to the canonical App Lock setting.
- Modify `src/ui/app/AppState.tsx` to enforce the canonical background and inactivity policies and consume native pending-lock state before exposing an unlocked session.
- Add `src/privacy/nativeAppLockBridge.ts`, `android/app/src/main/java/chat/veil/app/VeilAppLockPlugin.kt`, and a registration line in `android/app/src/main/java/chat/veil/app/MainActivity.java` for Android screen-off signals and pending-lock consumption.
- Add `tests/phase124-applock-policy.test.ts`, `tests/phase124-applock-settings.test.tsx`, and `tests/phase124-applock-lifecycle.test.tsx`.
- Add `docs/ai/THREAT_MODEL_APP_LOCK.md`; add an ADR to `docs/ai/DECISIONS.md`; update `docs/ai/ACTIVE_TASK.md`, `docs/ai/CURRENT_STATE.md`, and `docs/ai/CHANGELOG.md` after verification.

## Task 1: Record the threat review and lock policy

**Files:**
- Create: `docs/ai/THREAT_MODEL_APP_LOCK.md`
- Modify: `docs/ai/DECISIONS.md`

- [ ] **Step 1: Document the threat model before changing runtime code**

Describe the threat as sensitive unlocked UI surviving an app-background, inactivity, screen-off, process-suspension, or restart transition. Define the invariant: if App Lock is enabled, VEIL must display the lock screen before sensitive Space content after startup/resume when a configured delay has elapsed. Document Android lifecycle signal loss, picker exceptions, pending-marker clearing rules, and what screen-off timing does not guarantee.

- [ ] **Step 2: Add an ADR for the policy and native bridge**

Record the canonical delay model, event semantics, migration from legacy optional settings, pending screen-off marker, no-plaintext/no-key persistence, and release gates. State explicitly that this changes local authentication lifecycle behavior and requires adversarial regressions, independent security audit, and dual sign-off before deployment.

- [ ] **Step 3: Review the documents against `docs/ai/SECURITY_RULES.md`**

Expected: no promise that Android can lock a process after it is already force-stopped; on a fresh app process, App Lock startup gating remains authoritative.

## Task 2: Add failing pure-policy tests

**Files:**
- Create: `tests/phase124-applock-policy.test.ts`
- Create: `src/privacy/appLockPolicy.ts`

- [ ] **Step 1: Write tests for canonical delay semantics**

Use fake timestamps and assert the boundaries below:

```ts
expect(lockDelayMs('immediately')).toBe(0);
expect(lockDelayMs('30s')).toBe(30_000);
expect(lockDelayMs('1m')).toBe(60_000);
expect(lockDelayMs('never')).toBe(Infinity);
expect(shouldLockForElapsed('5m', 299_999)).toBe(false);
expect(shouldLockForElapsed('5m', 300_000)).toBe(true);
expect(shouldLockForElapsed('never', Number.MAX_SAFE_INTEGER)).toBe(false);
```

Also test rejection or safe normalization of corrupt persisted values, and that `immediately` locks at the first background event while finite delays are evaluated against elapsed time on resume.

- [ ] **Step 2: Run tests and observe the expected failure**

Run: `npx vitest run tests/phase124-applock-policy.test.ts`

Expected: FAIL because the policy module/functions are not implemented.

- [ ] **Step 3: Implement the pure policy functions**

Export `type AppLockDelay = 'immediately' | '30s' | '1m' | '5m' | '10m' | '15m' | 'never'`, `lockDelayMs(delay: AppLockDelay): number`, and `shouldLockForElapsed(delay: AppLockDelay, elapsedMs: number): boolean`. Keep this module free of storage, timers, React, and native calls.

- [ ] **Step 4: Run the pure-policy tests**

Run: `npx vitest run tests/phase124-applock-policy.test.ts`

Expected: PASS.

## Task 3: Use one persisted App Lock settings model

**Files:**
- Modify: `src/privacy/pinManager.ts`
- Modify: `src/ui/components/AppLockSettingsView.tsx`
- Modify: `src/ui/components/SettingsModal.tsx`
- Create: `tests/phase124-applock-settings.test.tsx`

- [ ] **Step 1: Test persisted selections and removal of duplicate state**

Assert that each selected delay calls the matching `SpacePinManager` setter and is visible after remount. Assert that enabling App Lock without a PIN routes to PIN setup. Assert that the Security page no longer exposes a second selector whose value is disconnected from the PIN registry.

- [ ] **Step 2: Run the new settings tests and confirm they fail**

Run: `npx vitest run tests/phase124-applock-settings.test.tsx`

Expected: FAIL for currently disconnected choices and duplicate selector behavior.

- [ ] **Step 3: Add canonical typed storage accessors and migrate prior selections**

Import the `AppLockDelay` type for `get/setLeaveAppLockDelay`, `get/setInactivityLockDelay`, and `get/setScreenOffLockDelay`. For older registry records, migrate `afterBackground` and `afterExitingApp` to one leave-app delay: if `afterBackground` is `never` or `lockOnBackground` is false, preserve `never`; otherwise select the more protective (shorter) finite delay and treat `never` as infinity. If neither interval exists, migrate a valid legacy `autoLockInterval`; otherwise default safely to `5m`. Migrate valid `afterInactivity` and `afterScreenOff` values, with safe defaults `10m` and `immediately`. Validate all values before writing. Make persistence report failure; a failed setter restores its previous in-memory value and returns failure so the UI can retain the last saved selection. Keep loading of existing registry version 1 records backward compatible and avoid storing plaintext credentials or message data.

- [ ] **Step 4: Convert the settings UI to semantic controls**

Use labeled `<select>` or radio controls rather than clickable non-semantic `div` rows. Show one **When you leave VEIL** setting, one **While using VEIL** inactivity setting, and one Android-only **When screen turns off** setting. Use the project button/input styles, visible keyboard focus, at least 44px touch targets, and a live save status. Remove the unpersisted Security-page select; keep the panic-lock control intact.

- [ ] **Step 5: Run App Lock settings regressions**

Run: `npx vitest run tests/phase124-applock-settings.test.tsx tests/phase62-applock-privacy-auth.test.tsx tests/phase63-deep-repair.test.tsx`

Expected: PASS.

## Task 4: Enforce background and foreground-inactivity timing

**Files:**
- Modify: `src/ui/app/AppState.tsx`
- Modify: `tests/phase124-applock-lifecycle.test.tsx`

- [ ] **Step 1: Add failing lifecycle tests**

Test that background delay `immediately` locks on background, finite delays lock only once elapsed on resume, `never` remains unlocked for that transition, picker transitions do not lock, and the inactivity timer resets on pointer/key activity then locks at its exact boundary. Test screen-off immediate/finite/never delay behavior, that disabling App Lock cancels pending timers, and that a new process starts locked before showing Space content.

- [ ] **Step 2: Run the lifecycle tests and confirm they fail**

Run: `npx vitest run tests/phase124-applock-lifecycle.test.tsx`

Expected: FAIL because current background handling reads legacy `autoLockInterval` and has no configured inactivity timer.

- [ ] **Step 3: Connect the foreground and background policies**

Replace lifecycle reads of the legacy shared interval with the canonical persisted delays. Record a background timestamp; lock immediately only for a zero delay; on resume use `shouldLockForElapsed`. Install a single foreground inactivity timer for the active unlocked Space, reset it on `pointerdown`, `keydown`, and `touchstart`, and remove listeners/clear timers on lock, Space change, or component cleanup. Do not inspect or log event contents.

- [ ] **Step 4: Run lifecycle and existing regressions**

Run: `npx vitest run tests/phase124-applock-lifecycle.test.tsx tests/auto-lock.test.ts tests/phase67-applock-perf-and-timing.test.ts tests/applock-multi-space-pin.test.ts`

Expected: PASS, including existing media-picker background exceptions.

## Task 5: Add Android screen-off lock signaling

**Files:**
- Create: `src/privacy/nativeAppLockBridge.ts`
- Create: `android/app/src/main/java/chat/veil/app/VeilAppLockPlugin.kt`
- Modify: `android/app/src/main/java/chat/veil/app/MainActivity.java`
- Modify: `src/ui/app/AppState.tsx`
- Modify: `tests/phase124-applock-lifecycle.test.tsx`

- [ ] **Step 1: Add bridge contract tests**

Mock the native bridge and assert a screen-off event creates a pending lock, a pending lock is consumed before the unlock transition, and non-Android platforms do not register the native listener.

- [ ] **Step 2: Implement a lifecycle-scoped Android receiver**

Register a dynamic receiver for `Intent.ACTION_SCREEN_OFF` from the Capacitor plugin. In the receiver, persist only `SystemClock.elapsedRealtime()` as a pending screen-off timestamp in private app preferences; this supports finite delay checks across WebView suspension and app-process death in the same boot. Do not persist PINs, credentials, identity, or message content. Unregister the receiver in plugin destruction. Expose a one-shot `consumePendingScreenOffElapsedMs()` method that reads and clears the timestamp atomically. Device reboot already starts App Lock in its locked state, so a timestamp from a prior boot must never unlock or suppress that startup gate.

- [ ] **Step 3: Register and consume the plugin safely**

Register `VeilAppLockPlugin` in `MainActivity`. In TypeScript, treat plugin absence/failure as unsupported, and check/consume the timestamp on app resume before setting the session unlocked. Compare elapsed screen-off time against the selected screen-off delay; invoke the existing lock path when the delay has elapsed and leave the app locked. Keep the media/file picker guard behavior intact.

- [ ] **Step 4: Run lifecycle tests and Android compile**

Run: `npx vitest run tests/phase124-applock-lifecycle.test.tsx tests/phase67-applock-perf-and-timing.test.ts`

Run: `cd android; .\gradlew.bat :app:assembleDebug`

Expected: focused tests pass and Android compilation succeeds. If Gradle daemon startup is blocked by host loopback policy, report the blocker and require device validation outside that environment.

## Task 6: Final security verification, documentation, and commit

**Files:**
- Modify: `docs/ai/ACTIVE_TASK.md`
- Modify: `docs/ai/CURRENT_STATE.md`
- Modify: `docs/ai/CHANGELOG.md`
- Verify: `docs/ai/THREAT_MODEL_APP_LOCK.md`, `docs/ai/DECISIONS.md`

- [ ] **Step 1: Run focused adversarial and positive regressions**

Run: `npx vitest run tests/phase124-applock-policy.test.ts tests/phase124-applock-settings.test.tsx tests/phase124-applock-lifecycle.test.tsx tests/phase62-applock-privacy-auth.test.tsx tests/phase63-deep-repair.test.tsx tests/phase67-applock-perf-and-timing.test.ts tests/applock-multi-space-pin.test.ts tests/phase116-delivery-and-safe-area.test.ts`

Run: `npm run typecheck`

Expected: all focused suites and typecheck pass. Verify no test weakens existing PIN collision, brute-force lockout, picker, or Space isolation assertions.

- [ ] **Step 2: Record release gates accurately**

State that implementation and source tests are complete only if they pass. Keep physical Android screen-off/process-death validation, independent audit, and dual sign-off marked outstanding until actually completed.

- [ ] **Step 3: Check and commit only this implementation**

Run: `git diff --check`

Commit: `fix: connect app lock settings to runtime`

## Non-negotiable security gates

- App startup remains locked whenever App Lock is enabled, before private Space UI can render.
- Screen-off markers contain only a boolean and are consumed atomically.
- Do not persist secrets or log user input while observing activity.
- Preserve picker exceptions and all PIN/Space isolation adversarial tests.
- The implementation cannot be deployed until an independent security audit and explicit dual sign-off are complete.
