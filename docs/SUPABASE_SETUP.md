# Mezgeb — Supabase connection handoff

This branch implements Supabase authentication and **automatic offline-to-cloud snapshot synchronization after explicit device pairing**. Transactions and Dube save locally first; server revisions, three-way merges and recovery copies protect updates. It is still a Preview release until real inbox and browser testing pass.

## 1. Project

Create a dedicated Supabase project named Mezgeb. Do not reuse the Hisab Technologies, NexRide, or EliteTrade databases.

## 2. Auth URL configuration

Site URL: https://mezgeb-omega.vercel.app
Additional redirect: https://mezgeb-omega.vercel.app/auth/callback

Add explicit authorized preview URLs individually for test deployments. Avoid permissive wildcard production redirects. Vercel currently reports SSO protection for this project's vercel.app domains.

## 3. Environment variables in Vercel project mezgeb

NEXT_PUBLIC_SUPABASE_URL — https://pqfzkyssvxmboprkmdga.supabase.co.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — project's public publishable key.

Preview public configuration was created for Mezgeb and is separate from Production. Never put a service-role key or payment secret in a NEXT_PUBLIC_ variable. Never commit credentials. Redeploy Preview after changing variables. The Vercel connector only exposed encrypted Production variable metadata, so the existing Production values could not be independently verified.

## 4. Authentication pages

/auth — sign up, sign in, and request recovery.
/auth/callback — server-side PKCE code exchange.
/auth/update-password — complete password recovery.

Use Supabase Auth email/password settings, SMTP, confirmation templates, and callback allowlist. Test sign-up, email delivery, sign-in persistence, sign-out, reset, and expired links.

## 5. Database remains pending

The two migrations in supabase/migrations are APPLIED to the dedicated Mezgeb project (pqfzkyssvxmboprkmdga): 20261012182759_mezgeb_secure_foundation and 20261012183138_mezgeb_foreign_key_indexes. Ten application tables exist, RLS is on for each, and the Supabase security advisor found no errors. A rolled-back two-owner SQL exercise verified business and snapshot isolation, cross-account write denial, and stale revision detection. Real-user authentication tests, browser-based cross-device sync, immutable canonical ledger writes, fiscal receipts and payment verification remain release blockers.

GET /api/cloud loads the private revisioned snapshot, and POST /api/cloud uses an authenticated account-bound conditional update. Settings explicitly pairs a verified identity to the device. **After pairing**, automatic sync merges independent financial entries, refuses conflicting edits, preserves recoverable local history and retries after reconnection. First sign-in alone never switches on cloud uploads; certified receipts remain disabled. See SYNC_RELEASE_GATE.md.

## 6. Deployment gating

Verify GitHub checks, next build, protected deployment browser testing, authentication, and account redirects before production. Keep payment processing and official receipt issuance disabled until server-side verification is implemented.
