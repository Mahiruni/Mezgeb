# Signature Edition release gate — 0.4.0 preview

Implemented: seven distinct feature stories, local device speech (only if matching voice available), EN/AM/OM onboarding and core labels, centered account forms, verification-gated authentication, two-step business setup, actual balance overview, optional tour, five-item navigation, Android 12+ branded splash, app-interface release checker and localized notes.

## Outstanding production gates
- Obtain consented Ethiopian presenter video/audio for all seven stories; do not represent synthesized or device narration as real human speech. The present build uses product illustrations and device voice. Native reviewers must approve every localized screen, email, error, fiscal label and accessibility string.
- Verify Benaiah redistribution rights and approved local font binaries; currently use the existing Plus Jakarta Sans/Noto Sans Ethiopic font stack.
- Run real-device onboarding, keyboard, reduced-motion, offline and existing-account upgrade tests. Validate email delivery and verification on the production origin. No financial calculation or database migration is part of this UI release.
- Current Android CI builds a debug preview. Verify production signing certificate continuity with the installed package, build a release APK, verify artifact checksum and install over existing data before publishing an APK manifest. The native updater is implemented behind a user-initiated same-origin navigation. It fetches a fixed HTTPS manifest, verifies byte size, SHA-256, package identity, installed signing certificates and increasing version, and uses Android's user-confirmed PackageInstaller session. The manifest remains unavailable until a compatible signed APK exists. The updater itself still requires real-device verification. The web interface update checker is independent of native package updates.
- Production Vercel domain and GitHub main deployment must be confirmed for the exact tested revision. Do not clear site storage or replace an existing ledger to force an update.
- Legal/commercial review is required for the preview privacy notice and final terms.
