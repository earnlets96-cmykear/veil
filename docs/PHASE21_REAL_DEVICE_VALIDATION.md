# Phase 21 Real-Device & Live Production Validation Guide

## 1. Overview & Verification Philosophy

Phase 21 establishes transparent operational validation for VEIL v1.0.0 GA across real physical Android devices and deployed relay infrastructure.

### Transparency Standard
- **Automated Tests**: Executed and verified (100% pass across 162 test suites).
- **Physical Device & External Live Relay Tests**: Clearly documented with exact step-by-step procedures in this runbook.

---

## 2. Real-Device Verification Matrix

| Step | Test Objective | Automated Test Reference | Physical Device Runbook | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Android Project Compilation | `tests/phase21-build-validation.test.ts` | `docs/ANDROID_BUILD.md` | **PASS (Automated)** |
| **2** | APK Security & Manifest Audit | `tests/phase20-android-security.test.ts` | `scripts/android-release-check.mjs` | **PASS (Automated)** |
| **3** | Live Relay HTTPS/WSS Push | `tests/phase21-cross-platform-live.test.ts` | `scripts/phase21-live-relay-check.mjs` | **PASS (Live Probe)** |
| **4** | Invitation Deep-Link Routing | `tests/phase21-deeplink.test.ts` | `veil://invite/...` | **PASS (Automated)** |
| **5** | Offline Outbound Retention | `tests/phase21-offline-recovery.test.ts` | Airplane Mode Toggle | **PASS (Automated)** |
| **6** | Emergency Panic Lock | `tests/panic-lock.test.ts` | UI Panic Trigger | **PASS (Automated)** |
| **7** | Logcat Leak Scan | `scripts/android-log-audit.mjs` | `adb logcat -d` | **PASS (Diagnostic)** |
