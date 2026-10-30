# Task: Implement ALL remaining E2E test cases from `docs/e2e-test-cases.md`

The 14-item cleanup task is finished and committed. State you are building on (verified in `task-notes.md`): 8 smoke tests, 19 full-tier tests, 101 documented cases (30 covered, 71 NEW), 176 use-case harness cases, native `confirm()` replaced by the in-app ConfirmDialog, the startup probe removed, settings pages built on `SettingsEntityPage` + `useSettingsCrud`.

Your context may be summarized during this long task. Keep this file (`prompt-2-e2e.md`) in the workspace root, uncommitted, and re-read it in full before starting each batch. Never guess a batch's scope from a summary.

Read first, in full: `.github/copilot-instructions.md`, `PROJECT.md`, `docs/e2e-test-cases.md`, `docs/e2e-coverage-plan.md`, `e2e/helpers.cjs`, `e2e/seed.cjs`, `e2e/smoke.spec.cjs`, `e2e/closed-shift-protection.spec.cjs`, `e2e/closed-shift-locks.spec.cjs`, `playwright.config.ts`, `playwright.full.config.ts`.

## Rules

1. Scope: tests, seeds, helpers, and docs only. Do NOT modify anything under `src/`. If a test exposes an application bug, do NOT fix it: write the test to assert the documented expected behavior, mark it `test.fixme` with a comment `BUG-n: <one line>`, and list it prominently in `task-notes.md` under "Bugs found by tests" (money, data-loss and closed-shift bugs first).
2. The source of truth is the **Cov** column of `docs/e2e-test-cases.md` after you verify it against the real specs (grep `testWithApp(` names and IDs). Implement every case marked `NEW`, and finish the missing part of every `PART` case. Do not re-implement `S1-S7`, `F4`, or cases already covered by `closed-shift-protection.spec.cjs` / `closed-shift-locks.spec.cjs`.
3. Conventions (from the plan, all mandatory):
   - Every visible string comes from `ar.json` through `text()`. No Arabic literals. The one exception is Arabic *name variants* for ADD-14: build them from `\uXXXX` escapes inside a single helper `arabicVariants()` with a comment explaining why.
   - Entity names and values are unique ASCII (`E2E <Kind> ${suffix}`). No data shared between tests. Each test launches its own app with its own temp `userData`.
   - After any mutation, assert the UI and also reload or navigate away and back to prove persistence.
   - No `waitForTimeout` / fixed sleeps. Use web-first assertions and `expect.poll`. The only allowed time-based case is the auto-dismiss notice (SHR-3), asserted with a bounded `expect(...).toBeHidden({ timeout })`.
   - `expectNoRawTranslationKeys` in every flow that visits a page for the first time in that test.
   - Native dialogs no longer exist (they were replaced by the in-app ConfirmDialog); use the existing helper in `e2e/helpers.cjs` for confirm/cancel and keep a guard that no native dialog fires.
4. UI behavior introduced by the cleanup that tests must account for:
   - The window opens at 1366x768 (minimum 1024x640). Do not hardcode other viewports unless a test needs one.
   - `DataTable` virtualizes only above 200 filtered rows; the seeds here are far smaller, so rows render normally. Do not add a test that depends on virtualization.
   - Attachment thumbnails now load lazily when they become visible (IntersectionObserver, three concurrent requests). Always scroll the thumbnail into view and wait with a web-first assertion for the image or the `receiptPhoto.unavailable` text before asserting on it. Never assert on an image immediately after navigation.
   - Settings pages share `SettingsEntityPage`/`useSettingsCrud` and per-entity `*SettingsFields.tsx` components. Read them before writing the SET entity config table.
5. Tiers: do not touch `playwright.config.ts` (smoke only, must stay under 2 minutes). All new specs run only under `playwright.full.config.ts`. Run suites one at a time, never concurrently.
6. Never run `git commit` / `git push`. No new dependencies. Strict TypeScript/ESLint rules still apply to anything you add outside `.cjs` files; keep the existing `.cjs` eslint-disable header style.
7. Never claim "verified" for anything you did not run. Report real counts.

## Step 0: Seeds and helpers (do this first and verify before any spec)

Seeds in `e2e/seed.cjs`: cleanup Item 12 already aligned the seed table in `docs/e2e-test-cases.md` with the code. Treat that table and `e2e/seed.cjs` as the source of truth, reuse every mode that exists (at least `no-shift`, `with-trip`, `layout`, `two-shifts`, `accounts`, `golden`), and only add the modes below that are missing, using the names already used in the doc:
- `empty`: reference data only (or document that `no-shift` is that mode and use it).
- `closed-shift`: one CLOSED shift with 2 trips, a trip attachment per trip, and a closing sheet. Reuse `two-shifts`' closed shift if equivalent; do not duplicate code.
- `reopened-shift`: one REOPENED shift with 1 trip (seed by creating, attaching, closing, then reopening through use-cases).
- `references`: every settings entity referenced by at least one shift or trip, so blocked-delete cases work for vehicle, driver, contractor, crusher, client, material type.
- `golden`: client opening balance 500, one trip 20 x 100, fine 200, client payment 1000 (confirm it matches the doc; expected client balance 1,300.00).
- Seeds only build starting state. Closing/reopening inside a test goes through the UI.

Facts about the current harness (read `e2e/helpers.cjs` to confirm): the startup probe was removed. The session object now exposes `application`, `page`, `seedData`, `tempDirectory`, `browserErrors`, `traceStarted`. `tempDirectory` IS the verified app `userData` (the fixture asserts `app.getPath('userData')` equals it before any action). `session.startupLog`, `session.actualUserData` and `session.databasePath` no longer exist; the database is `path.join(session.tempDirectory, 'shift-tracker.db')`, attachments live under `session.tempDirectory/docs/attachments`, backups under `session.tempDirectory/backups`. Confirm/cancel of delete flows goes through the in-app ConfirmDialog helper that cleanup Item 8 added to `helpers.cjs` (find its name; do not recreate it).

Helpers in `e2e/helpers.cjs` (add only what is missing; check what exists first): `tripRow(page, tripId)`, `makeJpeg(width, height)` (generate in the page via canvas and return a Buffer for `setInputFiles`), `makeTruncatedJpeg()`, `makePng()`, `makePdf()`, `arabicVariants()`, `readDb(session)` (read-only inspection using `better-sqlite3` with `readonly: true` on `tempDirectory/shift-tracker.db`, or the logic in `scripts/db-inspect.cjs`), `expectNotice(page, key)` (exists), `closeShiftViaApi` (exists), `fillGridRow(...)`.

Done when: a throwaway sanity spec (deleted afterwards) opens each seed mode successfully; typecheck and lint pass.

## Build order (priority from the doc: P0 first). One spec file per area; after finishing each file run it in isolation, then continue.

### Batch 1: Closed-shift and lifecycle (P0)
`e2e/shift-lifecycle.spec.cjs`
- SH-3 duplicate driver on another vehicle, field error on driver (`with-trip`)
- SH-4 create-form validation and blank reopened dialog (`empty`)
- SH-8 close blocked without closing sheet; SH-9 close blocked when a trip has no attachment (visible guidance, status stays OPEN). Finish the PART parts: assert the exact guidance text keys.
- SH-10 upload a closing sheet through the UI; listed and previewable
- SH-11 reopen requires a reason (empty rejected, then valid reason gives REOPENED) (`closed-shift`)
- SH-12 re-close after reopen with the new count after adding a trip; status CLOSED, new count stored
- SH-13 backup warning after close: after launch, delete `userData/backups` and create a plain FILE named `backups` in its place so directory creation fails (do not rely on Windows ACLs), close the shift via the UI, assert the warning notice and that the shift is CLOSED; restore in cleanup
- SH-14 list content and navigation to `/shifts/:id` (`two-shifts`)

`e2e/closed-shift-more.spec.cjs`
- ATT-6 CLOSED trip attachments are read-only in all three places (Shift Details, All Trips details window, trip details), preview still works
- ATT-8 stale view: close via `closeShiftViaApi` while a view is open, then try to add an attachment; error notice, nothing stored
- ACC-5 and ACC-6 are in Batch 3
- GOLD-3 is in Batch 2
- RT-2 persistence across restart (create data, close app, relaunch with the same `userData`, all present) and RT-3 CLOSED state and UI lock survive restart; use `relaunchApp`

### Batch 2: Money correctness (P0)
`e2e/money.spec.cjs`
- GOLD-1 from `empty`, UI only: client opening balance 500 (Settings), shift, trip 20 x 100 via the Add Trip grid, fine 200 via the grid's fine columns, client payment 1,000 via Accounts. Client balance shows exactly `1,300.00` on Accounts and on Statements, and the two values are identical
- GOLD-2 delete the trip from All Trips; balance drops by the trip value on both pages, after reload (`golden`)
- GOLD-3 close the shift, delete is hidden, balance unchanged (`golden`)
- Compute every expected number in the test from the inputs (show the arithmetic in a comment), never copy a displayed value

`e2e/statements.spec.cjs`
- ST-1 client statement rows: opening row, trip rows with notes, fine row, payment rows, in order (`golden`)
- ST-2 contractor statement: transport and material rows separate, sign note shown, quantity total excludes material
- ST-4 summary above the table, grouped formatting (e.g. `100,500.25`)
- ST-5 empty selector state; ST-6 switching selection shows only that entity's rows (`two-shifts`)

### Batch 3: Accounts (P0/P1)
`e2e/accounts.spec.cjs` (seed `accounts`)
- ACC-1 contractor ledger add (ADVANCE, PAYMENT, OTHER), balance recalculates after each
- ACC-2 edit an amount, delete another row; table and balance refresh
- ACC-3 same as ACC-1/ACC-2 on the driver history page
- ACC-4 movement linked to an OPEN shift saved, Edit/Delete available
- ACC-5 movement linked to a CLOSED shift is locked on all three ledger pages (`common.lockedShift`)
- ACC-6 creating a movement with a CLOSED shift is rejected with a visible error, nothing saved (go through the UI form; if the selector correctly never offers CLOSED shifts, also assert the server rejection through `callApi`)
- ACC-7 client payment lifecycle including a negative amount; each step changes the balance by the signed amount (compute expected values)
- ACC-8 All Movements: filter by driver, sort by amount, details window shows notes and shift
- ACC-9 ledger form validation (empty amount, zero amount, missing date), blank Add dialog after cancel
- ACC-10 switching between the four sections loads each one's own data, no stale rows

### Batch 4: Settings (P0/P1), parametrized over 6 entities
`e2e/settings.spec.cjs`
- Build ONE entity config table (vehicle, driver, contractor, crusher, client, material type): translation keys for the section, fields, required fields, unique key field, sample valid values. Read each `src/renderer/src/pages/settings/*Settings.tsx` and `ar.json` to fill it accurately.
- Generate SET-1 to SET-6 per entity: create, edit hydration and save, delete unreferenced, required fields, duplicate key (vehicle: same vehicle number), blank Add dialog after Edit.
- SET-7 blocked delete shows `ipcErrors.deleteFailed` and the row is still listed after reload, per applicable entity (`references`)
- SET-8 opening balance needs its date (balance without date, date without balance) for client and contractor
- SET-9 numeric field limits (negative or non-numeric initial price, default cubic, phone)
- SET-10 vehicle needs a contractor
- Test titles must include the case ID and entity, e.g. `SET-5 duplicate key (crusher)`.

### Batch 5: Add Trip grid (P1)
`e2e/add-trip.spec.cjs`
- ADD-1 driver without an OPEN shift shows the inline create form, not the grid (`empty`)
- ADD-2 create shift inline; grid appears, chip shows the new shift
- ADD-3 rapid driver switching A to B to A; only the latest driver's shift and chips remain (`two-shifts`; make the race deterministic by switching without awaiting between clicks)
- ADD-4 clear driver selection
- ADD-7 required fields per row, other rows unaffected
- ADD-8 paste a spreadsheet block: header detected and skipped, quoted cells, empty lines ignored, trailing newline (dispatch a real `paste` event with clipboard data)
- ADD-9 stone and client price suggestions: `LAST_TRIP` for a previous pair, default initial price for a new pair, keyed per material
- ADD-10 transport suggestion: exact location preferred, fallback to client-only, empty if none
- ADD-11 missing material behavior; suggestion refreshes on change; user-edited prices are never overwritten
- ADD-12 Ctrl+D copies the value from the row above into that column only
- ADD-13 cubic with a comma (`1,5`, `1,000`) is flagged and not saved
- ADD-14 Arabic name variants: normalized match resolves, ambiguous match is flagged (use `arabicVariants()`)
- ADD-16 saved rows visible in All Trips and Shift Details with the same values

### Batch 6: Shift details, All Trips, attachments UI (P1/P2)
`e2e/shift-details.spec.cjs`: SD-1 (finish PART), SD-3 save an edit and totals update and persist, SD-4 edit validation, SD-9 REOPENED shift add a trip through the full TripForm dialog (`reopened-shift`), SD-10 (finish PART) details labels for every receipt/recipient status, SD-11 breadcrumb.

`e2e/all-trips.spec.cjs` (seed `two-shifts`): AT-1 sort ascending then descending, AT-2 distinct-value filter and clear, AT-3 selected-sum of client cubic for two selected rows, AT-4 details window and no duplicate window on opening the same trip twice (finish PART), AT-11 delete a trip with an attachment: trip gone, and the attachment FILE is gone from `userData/docs/attachments` and its DB row gone (assert on disk, not only in the UI), AT-12 empty state (`empty`).

`e2e/attachments.spec.cjs` (seed `with-trip`): ATT-1 upload, crop, save a JPEG; thumbnail listed and preview opens, ATT-2 delete removes the list item AND the file on disk, ATT-3 reject PNG and PDF with a visible error and nothing stored, ATT-4 truncated JPEG shows a visible error without a crash, ATT-5 crop/rotate/zoom controls respond and the saved output differs.

### Batch 7: App shell and shared components (P2)
`e2e/shell-shared.spec.cjs`: NAV-2 only the clicked nav item has `aria-current="page"`, NAV-3 unknown route redirects to Add Trip, NAV-4 backup indicator: healthy launch shows no warning; launch with a plain file at `userData/backups` (so the startup daily snapshot fails) shows the warning, SHR-2 floating window lifecycle (open, move, resize, minimize, restore, close; finish PART), SHR-3 notices: success and error shown, dismiss button closes, auto-dismiss after its timer, SHR-4 Create Shift, Trip and Ledger forms are blank when reopened after cancel.

## Per-batch loop
For each batch: write the spec(s) and any seeds/helpers it needs, run `npm run typecheck`, `npm run lint`, then `npm run test:e2e:full -- <file>` for each new file alone. Fix test problems (selectors, timing, data). Never weaken an assertion to make it pass; a failing assertion that reveals an app bug becomes `test.fixme` with a `BUG-n` comment per Rule 1. Then update the **Cov** column in `docs/e2e-test-cases.md` for the cases just done (spec file name, e.g. `money.spec.cjs`).

## Final steps
1. Run `npm run verify:use-cases`, `npm run check:i18n` (if it exists), `npm run test:e2e` (smoke must still be under 2 minutes; report the real time), then `npm run test:e2e:full` once, sequentially, for the whole suite. Run the full suite a second time and report any test that failed in only one of the two runs as flaky and fix its cause.
2. Doc sync: update `docs/e2e-test-cases.md` (Cov column, Totals, seed table), `docs/e2e-coverage-plan.md` (real counts and runtime), `PROJECT.md` section 3 file map and section 7 (real test counts and list of spec files), and the single remaining E2E Open item: remove it if every case is implemented, otherwise list exactly which case IDs remain and why.
3. Run `npm run review:gate`, then write `task-notes.md` (UTF-8 no BOM, max 25 lines): Summary with real counts (cases implemented out of 101, tests passing, tests `fixme`), "Bugs found by tests" (ID, one line, severity), "Could not verify", "Noticed but did not touch". Do not paste command output or diffs in chat. Tell me to attach `last-task.md` only.
4. If you cannot finish all batches in one run, stop cleanly after a finished and verified batch, and make the first line of `task-notes.md` `DONE: batches 1..n | NEXT: n+1` so I can say "continue".
