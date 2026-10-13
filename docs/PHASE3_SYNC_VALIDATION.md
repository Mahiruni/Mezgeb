# Mezgeb Phase 3 — Sync integrity release gate

**Scope:** Existing local-first accounting application, verified Supabase identity, revision-controlled snapshots and IndexedDB recovery. No financial database migration and no customer record rewrites are included in Phase 3.

## Automated assertions

- Existing Vitest merge tests: independent sales and Dube repayments, simultaneous overpayments, edits to the same transaction, customer and credit event deletion, duplicated receipt numbers, metadata edits and device-local language/theme.
- `tests/sync-storage.test.ts`: IndexedDB guarded writes reject second-tab stale saves; monotonic cloud checkpoints reject regressions; recovery ledger, review hold and safety history commit atomically; stale cloud imports never delete a newer tab's edits.
- Manual recovery release must be initiated via Keep Cloud or Keep Device; background writers cannot remove the review hold.
- CI: TypeScript, Vitest, Next.js build; Vercel Preview must be READY and associated with the PR SHA before any merge.

## Live acceptance (needs test accounts/devices)

Use **two test devices or isolated browser profiles** and a *test business*, not the user's real ledger. Record a before/after JSON export and transaction counts. Stop and report any unexpected records before resolving.

1. **Account + initial restore:** Sign in to the same verified test account on Phone A and B. Empty B should automatically restore A's cloud ledger; both should show the same business and transaction IDs. The cloud record revision must never decrease.
2. **Online propagation:** Add a test sale on A; open B and focus the app. A's sale should arrive without a manual pairing action. Observe periodic refresh (app-open interval is about 45 seconds); the app does not guarantee sync while force-closed.
3. **Offline independence:** Put A offline and add sale A; keep B online and add sale B. Reconnect A, then bring both apps to foreground. Confirm both distinct IDs and correct totals on both devices with no duplicates.
4. **Concurrent write:** With A and B based on the same initial sale, change the amount differently while one is offline. The app must stop at a conflict, retain both sides, and require review; it must never silently pick the larger value.
5. **Credit safety:** Add distinct repayments to an existing test customer's Dube history on two devices. They should merge if totals stay within the credit; an overpayment and a deleted historical credit event must trigger conflict.
6. **Receipt collision:** Generate the same test draft number on separate offline devices and reconnect. An unresolvable duplicate reference must raise review, not silently issue a fiscal receipt.
7. **Two tabs (same device):** Open A in two browser tabs, save a test entry in tab 1, then attempt a different entry in tab 2 from the stale original state. Tab 2 must display a local-storage conflict and refuse upload/overwrite. Export from stale tab before reloading.
8. **Recovery interruption:** Restore an older recovery copy then reload the browser. The restored copy and a persistent review hold must survive together; uploads remain stopped until the person explicitly chooses Keep Cloud or Keep Device.
9. **Account switch and opt-out:** On the same browser, unlink account A and sign into test account B. It must not automatically upload A's ledger into B; the opt-out must remain effective until manually reconnecting.
10. **Network failures:** Disable connectivity during POST and recover after reconnect. Verify local entries remain and later upload only once. Confirm an HTTP 409 from a competing cloud update causes a fresh merge/retry, not a blind overwrite.

## Release criteria

**No production merge** if TypeScript/tests/build or associated Vercel Preview fails. Do not claim physical-device E2E without inspecting evidence from the two devices. Never run conflict/destructive exercises with real company transactions.

## Limitations

- Synchronization runs with the PWA open or returned to foreground, not as a guaranteed background Android service.
- Second-tab conflicts are deliberately blocked and require a review/reload; automatic resolution is unsafe for financial data.
- This snapshot engine is not yet an immutable double-entry journal, payroll system, or certified Ethiopian fiscal receipt service. Those are later milestones.
