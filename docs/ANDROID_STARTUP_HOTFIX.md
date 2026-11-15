# 1.0.2 startup recovery hotfix

User reported immediate crash on opening 1.0.1. Exact device exception not yet available. Guard optional AndroidX backup and service worker initialization, discard stale WebView navigation state (not storage), handle main-frame and renderer failures, show native recovery and explicit same-origin online fallback, add React error boundary and storage error state, and require a ready title in an API 35 emulator cold-start/restart smoke test. No database/schema/signing changes. Production signing remains unavailable. Real-device validation required.
