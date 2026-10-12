# Mezgeb — Verified account access and offline-to-cloud synchronization

**Branch:** feature/supabase-auth-preparation
**Supabase project:** pqfzkyssvxmboprkmdga (Mezgeb only)
**Vercel project:** mezgeb
**Production gate:** Keep this branch as Preview until live email and browser verification are completed.

## Account and financial-data protection

- Supabase Auth PKCE code exchange and token-hash confirmation callback.
- Server checks auth.getUser() and confirmed email on every cloud read/write.
- POST /api/cloud enforces same-origin request, application/json, and accountId equality with the server-verified user.
- Owner-scoped PostgreSQL RLS on 10 application tables.
- Anonymous roles do not have privileges to read the ledger or cloud snapshots.
- Local IndexedDB financial records remain usable without a connection.
- The interface shows the actual sync state; unverified users cannot start sync.
- This implementation supports **one owner / one business per authenticated identity**, not staff membership or multi-business.

## Automatic sync lifecycle

1. Create or verify your account using an actual inbox. Existing local records remain on-device.
2. From Settings, explicitly pair this device to your account.
3. On a new device with a cloud ledger, choose either the cloud document or your local records. The app never assumes which is authoritative.
4. Once paired, financial edits save to IndexedDB first.
5. When online, the client GETs the private cloud snapshot, merges with a locally persisted common base, then conditionally POSTs the merged document with the expected server revision.
6. A Postgres trigger increments the revision, and the server's revision comparison prevents silent overwrites.
7. Network failure leaves the local document intact. Retry occurs after reconnecting, restoring focus, or the background sync interval while the app is open.
8. Where safe, distinct transaction IDs and separate customer-credit events merge automatically.
9. A conflict stops automatic merging. Keep Cloud or Keep Device requires a deliberate choice, confirmation, and recoverable copies.
10. Cloud downloads and their matching sync checkpoint are saved in **one IndexedDB transaction** to prevent crash-induced false deletions.

## Financial conflict rules

- Distinct independent transaction IDs: merge.
- Both edit the same transaction differently: stop for conflict review.
- One deletes a transaction while another edits it: stop.
- Customer credit entries are append-only during merge; historical Dube entries cannot silently disappear.
- Customer removal with credit history: conflict.
- Concurrent repayments that exceed credit: conflict.
- Duplicate draft or legacy receipt references across separate entries: conflict.
- Business identity edits with different values: conflict.
- VAT receipts remain draft/legacy only; no official fiscal numbering.
- Browser-level settings such as locale/theme stay device-specific.

## Recovery and limits

- Recovery copies are kept on-device in IndexedDB, linked to the user identity (up to 20 recent copies per linked account).
- Restoring an older recovery copy sets a **durable holdForReview flag** before replacing device data. Subsequent sessions and retries remain blocked until an explicit Keep Cloud/Keep Device resolution; restored history cannot automatically remove cloud financial entries.
- Legacy JSON and older-browser imports are blocked while this device is paired for automatic sync. Unlink and export first to prevent unreviewed bulk deletions.
- The client checkpoints a successfully acknowledged cloud revision even if additional edits arrived during the network request, so edits made during an upload are retried from the correct ancestor.
- Import/sync validation rejects duplicate ledger IDs, Dube event IDs, and draft receipt references instead of silently collapsing them.
- Export financial data to JSON regularly; browser storage can be cleared by the user or operating system.
- Cloud snapshots are JSON records limited to ~2 MB and are NOT per-record incremental server writes.
- Automatic sync requires the browser app to be running. It is not a guaranteed always-on background Android service.
- Service worker caches the application shell, not official payment data or certified receipts.
- Cloud snapshots must not be treated as tax-compliant fiscal documents.
- **Future production needs:** PostgreSQL audit and write model, authenticated acceptance testing, PWA browser E2E, real email verification tests, backup/restore drills, and Chapa server verification.

## Verified checks

- Applied Supabase migrations 20261012182759 and 20261012183138.
- All ten targeted tables have RLS.
- Security advisor: zero warnings at latest audit.
- A transactional, rolled-back two-owner SQL isolation exercise verified each account reads only its own business and snapshot, cannot update or insert another owner's snapshot, and cannot overwrite a stale cloud revision.
- Test fixture check after rollback confirmed no test accounts or businesses left behind.
- Unit tests cover independent sales, amount conflicts, deletion-versus-edit, Dube repayments and overpayments, duplicate draft references and device-local preferences.
- GitHub CI (TypeScript, Vitest, production build) is the release gate.

## Tests not yet verified

- Real inbox email confirmation / resend / reset flows.
- Cross-device browser tests with two genuine users.
- Vercel preview HTTP smoke verification: Deployment Protection returned 403 to the automated testing connector.
- Mobile device PWA crash/restore, very large ledgers, and long offline sessions.

**Do not claim verified production rollout until these gates pass.**
