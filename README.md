# Mezgeb መዝገብ

**Next.js 15 · React 19 · TypeScript · Dexie/IndexedDB · Zod · Lucide**

Mezgeb is an Ethiopian small-business ledger: sales, expenses, estimated VAT, draft receipts, Dube credit, CSV reporting, and responsive mobile-first views.

> Status: **Local-first preview**. Supabase, Chapa, and Vercel are deliberately not connected. Local drafts are NOT certified tax receipts. No live payments, cloud backup, or online authentication are provided.

## Implemented

- Responsive original navy/gold Mezgeb shell, dashboard, onboarding, settings, dark/light modes.
- Sales and expenses with integer-cent arithmetic, search, monthly filtering and per-category records.
- 15% VAT-inclusive estimates. Purchase input VAT is limited to stock and utility categories in the inherited business rule; tax treatment must be independently verified.
- Numbered DRAFT receipts with internal-use-only print preview. Imported older numbers are explicitly LEGACY.
- Dube customer credit ledger, repayments, outstanding totals and history.
- Monthly charts, CSV reports, IndexedDB storage, JSON backup/restore and explicit old HTML import.
- English/Amharic core UI. Five additional original language choices with English fallback pending full dictionary migration.
- HTTPS PWA service worker that caches the app shell, not financial database contents.
- Reviewable Supabase PostgreSQL schema and owner-based RLS migration, NOT applied.

## Running locally

Node.js 22+ recommended.

    npm install
    npm run dev
    npm run typecheck
    npm run test
    npm run build

Visit http://localhost:3000. The PWA service worker registers on HTTPS only.

## Legacy data migration

Your original HTML app used the "mezgeb_v1" localStorage key. Its accounts and password hashes are not secure server identities.

1. Download a JSON backup from the old HTML application.
2. Set up a business in this Next.js preview.
3. In Settings, choose the legacy JSON backup, review the entry counts, and confirm replacement.
4. First back up any data already created in the new preview.
5. When the same-origin "mezgeb_v1" key is available, Settings supports browser-local import without deleting the original.

Imported old password hashes, sessions, and client-side paid-plan claims are never considered authenticated or paid.

The supplied HTML contains an embedded Benaiah font. The font is not redistributed pending review of licensing and distribution rights; the new code uses the Noto Sans Ethiopic fallback.

## Payment & fiscal limits

Recording a payment method such as M-Pesa, Telebirr, CBE Birr or Chapa does not move money. No real payment providers are connected.

Receipt numbering is DRAFT-only. Financial calculations and exports are internal tools, not an official tax filing. The proposed Supabase SQL migration does not by itself make a compliant fiscal system.

No online sign-in, Supabase sync, verified Chapa payment, paid entitlement activation, server-issued final receipts, multi-user access, admin dashboard, audit-log enforcement, or offline conflict reconciliation is active yet.

## Connect Supabase & Vercel later

1. Link https://github.com/Mahiruni/Mezgeb to a Vercel project and verify preview builds.
2. Create a Supabase project, review the SQL migration, and apply it after authorization and test validation.
3. Populate NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel; keep service-role and payment secrets server-side, never public.
4. Implement secure Auth, memberships, server data access, transaction-safe sync and authoritative receipt issuance before hosting real multi-user financial data.
5. Integrate server-side Chapa initialization and authenticated verification; never activate paid plans from a browser-only callback.
6. Add production monitoring, database backups, rate-limiting, RLS isolation tests, cross-device sync tests, and payment failure/replay tests before public launch.

This repository was initially empty. The first implementation series was committed on main using GitHub. CI is configured to attempt type checks, tests and build; successful execution must be checked in GitHub Actions and is not implied by commits alone.

Built by Hisab Technologies.
