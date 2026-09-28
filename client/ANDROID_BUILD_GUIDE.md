# Android APK Build & Installation Guide

This project has been upgraded with **Capacitor** to run natively as an Android application.

---

## 🚀 Key Android Enhancements Made

1. **Direct Canvas Reel Synthesizer (`canvasRenderer.js`):**
   * Eliminates the dependency on `navigator.mediaDevices.getDisplayMedia` (which crashes inside mobile WebViews).
   * Renders the 1080×1920 9:16 vertical reel directly on an off-screen canvas at 30/60 FPS with Ken Burns background animation, Hindi/Indic grapheme karaoke text highlighting, and outro cards.
2. **Native Android File Saving & Sharing (`nativeFileSaver.js`):**
   * Uses `@capacitor/filesystem` and `@capacitor/share` to save `.webm` reels to device storage and immediately trigger the Android system share sheet (allowing direct saves to Gallery, WhatsApp, Google Drive, etc.).
3. **Mobile-Optimized UI (`App.jsx` & `ControlPanel.jsx`):**
   * Responsive tab bar switching between **"👁 Studio Preview"** and **"⚙ Control Room"** on smartphone displays.
4. **Android Permissions Configured (`AndroidManifest.xml`):**
   * Microphone recording (`RECORD_AUDIO`)
   * Storage and Media access (`READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`)
   * Network access (`INTERNET`)

---

## 📦 How to Generate Your APK

### Option 1: Automated 1-Click Cloud Build (Free with GitHub Actions) - *Recommended*
No need to install 10 GB of Android Studio or SDKs on your computer:
1. Push this project to your GitHub repository.
2. Go to the **Actions** tab on your GitHub repository.
3. Select **"Build Android APK"** and click **Run workflow**.
4. Once completed (approx. 2-3 minutes), download the generated **`StoryOfTheLeader-APK.zip`** from the **Artifacts** section.
5. Extract the `.apk` file and send it to your Android phone.

---

### Option 2: Using Android Studio (Local Build)
If you have **Android Studio** installed on your PC:
1. Open PowerShell / Command Prompt in `client`:
   ```bash
   cd client
   npm run cap:open
   ```
   *(Or open Android Studio and choose "Open an Existing Project", then select `client/android`)*.
2. Wait for Gradle sync to complete.
3. In Android Studio, go to the top menu:
   **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
4. When finished, a notification popup will say **"APK(s) generated successfully"**. Click **locate**.
5. Your APK will be at:
   `client/android/app/build/outputs/apk/debug/app-debug.apk`

---

### Option 3: Command Line (with Android SDK & Gradle)
If you have Android SDK set up locally:
```bash
cd client
npm run cap:sync
cd android
./gradlew assembleDebug
```
The output file is generated at:
`client/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 📲 How to Install on Your Android Phone

1. Transfer `app-debug.apk` to your phone via USB, Google Drive, or WhatsApp.
2. On your phone, tap the `.apk` file.
3. If prompted with *"Install unknown apps"*, tap **Settings** and enable **"Allow from this source"**.
4. Tap **Install** and then **Open**.
5. Grant Microphone and Storage permissions when prompted.
