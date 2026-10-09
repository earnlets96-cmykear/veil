# VEIL Notification Settings and Android Push UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make VEIL's notification controls and Android background-alert status clear while preserving generic, privacy-safe FCM delivery.

**Architecture:** Keep notification permission, local privacy mode, and Android background push as distinct settings concerns. Drive the background-alert control from async registration results, show loading and failure states, and keep all remote payload content fixed and generic. Retain the existing VEIL theme and Android notification channel ID.

**Tech Stack:** React 19, TypeScript, Vitest, Capacitor, Kotlin, Android NotificationCompat, Firebase Cloud Messaging.

---

## File map

- Modify `src/ui/app/AppState.tsx` to expose background-push preference/registration states without exposing its token.
- Modify `src/ui/components/SettingsModal.tsx` to group permission, local privacy, and background-alert controls and render honest status and feedback.
- Modify `src/notifications/notificationDispatcher.ts` only if a focused regression proves local-versus-background behavior is mislabeled or misrouted; preserve its current payload policy.
- Modify `android/app/src/main/java/chat/veil/app/VeilFirebaseMessagingService.kt` and `VeilNotificationsPlugin.kt` only for consistent static channel name/description and notification presentation.
- Add `tests/phase124-notification-settings-ux.test.tsx` for accessible settings states and copy.
- Extend `tests/phase114-push-delivery.test.ts` only for payload/channel privacy regressions that are not already covered.
- Update `docs/ai/ACTIVE_TASK.md`, `docs/ai/CURRENT_STATE.md`, and `docs/ai/CHANGELOG.md` with verified implementation status. Do not mark device validation complete without an Android device run.

## Task 1: Add notification settings regressions

**Files:**
- Create: `tests/phase124-notification-settings-ux.test.tsx`
- Read: `src/ui/components/SettingsModal.tsx`, `src/notifications/notificationDispatcher.ts`

- [ ] **Step 1: Add tests for the settings contract**

Render the Notifications category with mocked application context and notification bridge. Assert the page distinguishes device permission, notifications while VEIL is open, and Android background alerts; privacy mode descriptions disclose their exact local exposure; denied permission exposes the Android settings action; the test button is disabled without permission; push actions show pending/success/failure feedback; and the Android-only card is absent on web.

- [ ] **Step 2: Run the new suite and confirm the missing states fail**

Run: `npx vitest run tests/phase124-notification-settings-ux.test.tsx`

Expected: the suite fails on the unimplemented labels/status states, not on module setup. Fix only test harness setup if imports or providers are incorrect.

- [ ] **Step 3: Add generic-push assertions where needed**

In `tests/phase114-push-delivery.test.ts`, preserve assertions that the FCM request contains only `kind=message` and no sender, preview, mailbox, or conversation data. Add no duplicate assertion if the existing cases already cover it.

- [ ] **Step 4: Run both focused suites**

Run: `npx vitest run tests/phase124-notification-settings-ux.test.tsx tests/phase114-push-delivery.test.ts`

Expected: the new UI tests fail for the new UX contract; existing push privacy tests pass.

## Task 2: Implement the notification settings experience

**Files:**
- Modify: `src/ui/app/AppState.tsx`
- Modify: `src/ui/components/SettingsModal.tsx`
- Modify only if needed: `src/notifications/notificationDispatcher.ts`

- [ ] **Step 1: Group the existing controls with precise labels**

Use section headings **Device permission**, **While VEIL is open**, and **Background alerts (Android)**. Describe `FULL_OBFUSCATED` as showing the sender/group and a short plaintext preview, `SENDER_ONLY` as showing the sender/group, `HIDDEN` as a generic alert, and `SILENT_COUNTER` as suppressing system notifications and disabling FCM registration. Explain that foreground privacy modes do not change the generic Android FCM alert.

- [ ] **Step 2: Expose registration status without exposing credentials**

Add context state with the finite status values `off`, `registering`, `ready`, and `error`, plus a user-safe error message. Set `registering` before native/relay registration, `ready` only after both succeed, and `error` on failure without clearing the user's opt-in preference for retryable startup failures. When the active Space changes while opted in, set `registering` before re-registering; display which Space is active and explain that the one-token association moves with that Space. On explicit disable, show `off` only after the UI records the opt-out; if relay removal fails, surface that failure and retry path. Never place the FCM token in context or UI state beyond the existing secure registration operation.

- [ ] **Step 3: Make status and actions accessible**

Represent permission and background-push operation state with text as well as color. Disable repeat actions while a request is pending. On failure, show a retryable concise error and leave the enabled state false. Use an `aria-live="polite"` status region for operation results. Keep the test action disabled until permission is granted.

- [ ] **Step 4: Keep background-alert copy accurate**

State that background alerts use Firebase, contain generic text, expose token/delivery timing to Google, reveal the one-bit visible-send hint to the relay, and follow one active Space per device. Show this only on Android. Do not expose or render registration tokens.

- [ ] **Step 5: Run the UI regressions**

Run: `npx vitest run tests/phase124-notification-settings-ux.test.tsx tests/phase114-push-delivery.test.ts`

Expected: PASS.

## Task 3: Refine native alert channel presentation without changing privacy

**Files:**
- Modify: `android/app/src/main/java/chat/veil/app/VeilFirebaseMessagingService.kt`
- Modify: `android/app/src/main/java/chat/veil/app/VeilNotificationsPlugin.kt`

- [ ] **Step 1: Keep channel identity stable**

Retain channel ID `veil_messages`. Set the same user-facing name and description in both native channel creation paths so foreground and remote alerts are managed together in Android Settings. Keep title `VEIL`, body `New encrypted message received`, `VISIBILITY_PRIVATE`, auto-cancel behavior, and the existing VEIL small icon. Do not use notification previews or remote-supplied copy.

- [ ] **Step 2: Add a source-level regression for generic native presentation**

Extend an existing Android source contract test or add `tests/phase124-native-notification-privacy.test.ts` to assert both native paths keep private visibility and do not interpolate Firebase data into title/body. Keep the test narrow and avoid brittle whitespace matching.

- [ ] **Step 3: Verify focused suites and Android compilation**

Run: `npx vitest run tests/phase124-native-notification-privacy.test.ts tests/phase114-push-delivery.test.ts`

Run: `cd android; .\gradlew.bat :app:assembleDebug`

Expected: tests pass and Gradle builds. If Gradle fails to initialize because of host loopback restrictions, record that exact blocker without claiming native compilation passed.

## Task 4: Update verified project status and commit

**Files:**
- Modify: `docs/ai/ACTIVE_TASK.md`
- Modify: `docs/ai/CURRENT_STATE.md`
- Modify: `docs/ai/CHANGELOG.md`

- [ ] **Step 1: Record only completed and verified work**

Document the new section hierarchy, accessible states, preserved FCM payload, test results, Android build result, and physical-device validation still outstanding.

- [ ] **Step 2: Run final notification verification**

Run: `npx vitest run tests/phase124-notification-settings-ux.test.tsx tests/phase124-native-notification-privacy.test.ts tests/phase114-push-delivery.test.ts`

Run: `npm run typecheck`

Expected: all focused suites and typecheck pass.

- [ ] **Step 3: Check the diff and commit only this plan's implementation files**

Run: `git diff --check`

Commit: `feat: clarify notification settings and Android alerts`

## Security invariants

- Android remote push remains data-only and generic; never put message or identity content into an FCM payload or system alert.
- Do not log tokens, service-account material, or provider response bodies.
- No message wire format, cryptographic protocol, or Space isolation behavior changes in this plan.
- Firebase production rollout remains subject to the existing independent audit and dual-signoff gate.
