# Mezgeb Phase 1 — Real-account acceptance (PREVIEW ONLY)

**Status:** Automated code review and CI are not a substitute for real inbox delivery and browser testing.
**App:** Vercel project `mezgeb`, GitHub `Mahiruni/Mezgeb` PR #1.
**Supabase:** dedicated project `pqfzkyssvxmboprkmdga` only.
**Production:** do not merge until all release gates are recorded as PASS.

## Required configuration before using a real inbox

1. Open [Supabase > Mezgeb > Authentication > Providers > Email](https://supabase.com/dashboard/project/pqfzkyssvxmboprkmdga/auth/providers), ensure Email provider and **Confirm Email** are enabled. If confirmation is disabled, sign-up may immediately return a session; Mezgeb now rejects that case.
2. Open [Authentication > SMTP Settings](https://supabase.com/dashboard/project/pqfzkyssvxmboprkmdga/auth/smtp). Configure and verify a **custom SMTP server** for non-team recipients. Supabase's default SMTP is restricted; sending a test to an ordinary recipient may fail even when the code is correct. Do not share SMTP credentials or email tokens in GitHub/ChatGPT.
3. Open [Authentication > URL Configuration](https://supabase.com/dashboard/project/pqfzkyssvxmboprkmdga/auth/url-configuration). Site URL may remain `https://mezgeb-omega.vercel.app`, but **additional redirect URLs** must include the exact active PREVIEW origin + `/auth/callback`. For a stable branch alias, authorize `https://mezgeb-git-feature-supabase-auth-preparation-gulitshop.vercel.app/auth/callback` if the alias resolves to the feature. Also allow the final Production callback. Avoid broad wildcards.
4. Vercel settings: Project `mezgeb`, Preview must have `NEXT_PUBLIC_SUPABASE_URL=https://pqfzkyssvxmboprkmdga.supabase.co` and a matching Supabase **publishable** key. Production values need separate independent verification. DO NOT configure `sb_secret_` keys in public variables.
5. Vercel Deployment Protection: sign in to the authorized team's Vercel account before visiting Preview, or use project-scoped authorized testing credentials. Do **not** disable protection just to pass a smoke test.
6. For PKCE, complete the email verification/recovery link on the **same browser and device** where registration or reset began, unless you have deliberately configured and tested the separate-device token-hash email template and session handoff.

## Test script — record PASS / FAIL

| # | Live acceptance check | Expected behavior | Status |
|---|---|---|---|
| 1 | Visit the allowed Preview origin at `/auth` | Email/password form renders with no build or hydration error | **NEEDS BROWSER** |
| 2 | Register a NEW test email and 12+ character password | UI prompts for confirmation; no usable verified session before email link | **NEEDS INBOX** |
| 3 | Receive confirmation email and click once in same browser | `/auth/callback` exchanges code and leads to `/auth/status` with **Verified account session active** | **NEEDS INBOX** |
| 4 | Reload `/auth/status` and reopen page in same browser | Still verified server-side until sign-out or expiry | **NEEDS BROWSER** |
| 5 | Sign out in Settings and refresh `/auth/status` | No authenticated server session, local IndexedDB records preserved | **NEEDS BROWSER** |
| 6 | Sign in again with correct password | Redirects to Settings; `/auth/status` reports verified | **NEEDS BROWSER** |
| 7 | Try incorrect password for TEST account | Authentication error; no valid session | **NEEDS BROWSER** |
| 8 | Request password-reset email for TEST account | Neutral UI message and email arrives with correct preview callback | **NEEDS INBOX** |
| 9 | Open recovery email on same browser | `/auth/update-password` loads; 12+ character new password accepted | **NEEDS INBOX** |
| 10 | After reset, refresh `/auth/status`, then sign in using new password | Recovery session ends; old password rejected; new password signs in | **NEEDS BROWSER** |
| 11 | Expired or duplicate link | Safe invalid-link message; no token disclosures; resend available | **NEEDS BROWSER** |
| 12 | Sign out then try `GET /api/cloud` without session | Returns HTTP 401; private data not disclosed | **NEEDS BROWSER** |
| 13 | Different account on same browser | Previously paired cloud business cannot auto-upload into another identity | **NEEDS 2 TEST ACCOUNTS** |

## Already automated

- Supabase Auth callback redirect allowlist and OTP-type validation.
- Known Mezgeb Supabase project pin and rejection of public secret-key configuration.
- Account verified-email gating in cloud API and client sync.
- Supabase RLS enabled on ten tables; anonymous cloud/ledger reads denied.
- GitHub Actions TypeScript, Vitest, Next production build.

## Blockers / reporting rules

The dedicated Mezgeb database currently had **0 auth users** during Phase 1 inspection; no real sign-up or confirmation email was sent as part of this audit. The Vercel connector could inspect deployment metadata but returned **403** while trying to fetch a protected page. Thus build READY != proven login-page HTTP 200. A different authorized browser, consented test mailbox and a configured SMTP sender are required for real flow testing.

Do not store test passwords, verification codes, recovery links, private cookies or SMTP credentials in issue comments.
