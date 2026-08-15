# Android Build & Compilation Guide

## 1. Prerequisites

- **Node.js**: v20.0.0+
- **JDK**: Java Development Kit 17 or 21
- **Android SDK**: API Level 34 installed (`ANDROID_HOME` or `ANDROID_SDK_ROOT` set)
- **Gradle**: Bundled Gradle Wrapper in `android/`

---

## 2. Build Commands

### On Windows (PowerShell)
```powershell
# 1. Build Web Client Assets
npm run build

# 2. Sync Capacitor Container
npx cap sync android

# 3. Assemble Debug APK
cd android
.\gradlew.bat assembleDebug

# 4. Assemble Release APK
.\gradlew.bat assembleRelease
```

### On Linux / macOS
```bash
# 1. Build Web Client Assets
npm run build

# 2. Sync Capacitor Container
npx cap sync android

# 3. Assemble Debug APK
cd android
./gradlew assembleDebug

# 4. Assemble Release APK
./gradlew assembleRelease
```

---

## 3. ADB Installation on Physical Device

```bash
# Ensure device is connected with USB Debugging enabled
adb devices

# Install debug APK
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# View real-time application logs
adb logcat -s "Capacitor/Console"
```
