# Mezgeb — Supabase connection handoff

This branch prepares Supabase authentication only. Financial records, subscriptions, receipts, and Dube remain browser-local.

## 1. Project

Create a dedicated Supabase project named Mezgeb. Do not reuse the Hisab Technologies, NexRide, or EliteTrade databases.

## 2. Auth URL configuration

Site URL: https://mezgeb-omega.vercel.app
Additional redirect: https://mezgeb-omega.vercel.app/auth/callback

Add explicit authorized preview URLs individually for test deployments. Avoid permissive wildcard production redirects. Vercel currently reports SSO protection for this project's vercel.app domains.

## 3. Environment variables in Vercel project mezgeb

NEXT_PUBLIC_SUPABASE_URL — new project's API URL.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — project's public publishable key.

Never put a service-role key or payment secret in a NEXT_PUBLIC_ variable. Never commit credentials. Redeploy Preview after changing variables.

## 4. Authentication pages

/auth — sign up, sign in, and request recovery.
/auth/callback — server-side PKCE code exchange.
/auth/update-password — complete password recovery.

Use Supabase Auth email/password settings, SMTP, confirmation templates, and callback allowlist. Test sign-up, email delivery, sign-in persistence, sign-out, reset, and expired links.

## 5. Database remains pending

The SQL file under supabase/migrations is only a reviewable draft and has not been applied. Harden RLS, immutable financial transactions, receipt numbering, tenant isolation, and transactional credit balances before production connection.

Signing into Supabase is not cloud syncing. The current local ledger must not be represented as server-backed.

## 6. Deployment gating

Verify GitHub checks, next build, protected deployment browser testing, authentication, and account redirects before production. Keep payment processing and official receipt issuance disabled until server-side verification is implemented.
