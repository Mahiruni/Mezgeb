# Mezgeb Android preview

This is a minimal first-party Android WebView wrapper of the **existing** https://mezgeb-omega.vercel.app accounting app; it does not replace, reimplement, or migrate the React/Supabase ledger. The app uses WebView device storage for IndexedDB and local records. Browser storage and this Android app's storage are **separate**. Cross-device transfer must use the verified Mezgeb cloud pairing flow.

## Build / install

CI (GitHub Actions, **Mezgeb Android preview APK**) uploads an installable **debug** APK in its downloadable ZIP artifact. Locally with Android SDK, JDK 17 and Gradle 8.13:

`gradle --project-dir android :app:assembleDebug`

Install `android/app/build/outputs/apk/debug/app-debug.apk` on a test Android device. It is debug-signed by the build agent, **not** a production signed or Play Store release. Rebuilding can change the debug key; uninstalling/reinstalling destroys this app's local ledger unless a verified cloud copy/backup exists. Do not uninstall or clear app data before export and recovery verification.

## Android status and navigation safety

Android 11+ uses WindowInsets for the status bar (clock, signal, notifications and camera cutouts), bottom gesture/navigation area, landscape sides, and keyboard. Android 8-10 use the platform's default non-fullscreen layout. The website also uses viewport safe-area CSS for standalone PWAs and iPhones. Keep this contract across future changes: do not draw interactive content beneath system controls.

## Release gates before real customers

- Confirm offline reopening, persisted IndexedDB, account email confirmation, signed-in sync, conflict recovery, and native back/navigation on two physical phones.
- Validate local JSON **download/export** and receipt/print flows on Android WebView; these browser download features are not yet implemented natively in this wrapper and must not be assumed to work.
- Reuse the actual licensed Benaiah Ethiopic font asset from the NexRide source after confirming packaging rights; the CSS currently falls back to Noto Sans Ethiopic when Benaiah is not installed.
- Configure a durable Android release signing key in protected CI, Google Play/App Links, and signed production AAB/APK.
- This wrapper needs internet on first install to load the hosted app and may not be fully available offline on a cold launch even when some service worker assets are cached.
- The native shell intentionally does not request location, contacts, camera or other sensitive permissions.
