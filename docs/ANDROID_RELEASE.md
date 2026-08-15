# Android Release Packaging & Installation

## 1. Build Configurations

- **Application ID**: `chat.veil.app`
- **Min SDK**: 26 (Android 8.0 Oreo)
- **Target SDK**: 34 (Android 14)
- **Build Output**: `android/app/build/outputs/apk/release/app-release-unsigned.apk`

---

## 2. Compilation Instructions

```bash
# 1. Build production web bundle
npm run build

# 2. Sync to Android container
npx cap sync android

# 3. Build Release APK via Gradle
cd android && ./gradlew assembleRelease
```
