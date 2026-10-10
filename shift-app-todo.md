# Shift Tracker TODO

## Resume Instructions

New chat: attach [shift-tracker-context.md](shift-tracker-context.md), [shift-app-todo.md](shift-app-todo.md), [code-review-backlog.md](code-review-backlog.md).

## Standing Rules

Rules live in `.github/copilot-instructions.md`. Follow them and the Doc Sync rule on every task.

Updated from the current working tree. This file is the operational source-of-truth for the project status and is intentionally aligned to the code in the repo rather than stale historical notes.

## 📋 Code Review Backlog

- [x] B1: fixed; manually verified.
- [x] B2: fixed in code; manually verified by user.
- [ ] B3: fixed in code; detail views use shared enum-label helpers for receipt status, recipient-name status, and movement type; not manually tested.
- [x] B4: fixed; manually verified. Follow-up remains open for six unused i18n keys and a missing-key check script.
- [x] B5: fixed in code (`TripIdCounter` and attachment-row cleanup in the trip-delete transaction); manually verified by user.
- [x] B6: fixed in code (attachmentId, 5MB/JPEG validation, closed-shift guard, closeShift file-exists check); manually verified by user. Approved renderer exception: one line in `AttachmentManager.tsx`.
- [ ] B7: fixed in code (PUT semantics, FK errors returned as field errors, finite non-zero amounts allow negatives, and closed-shift entries are locked); not manually tested.
- [ ] Reopen shift (not a B-item): REOPENED status, ShiftReopenLog, reopen dialog, re-close with reported count; fixed in code, not manually tested.
- [ ] Vehicle open-shift guard: createShift rejects a second open shift on the same vehicle while allowing a reopened shift to start a new shift; fixed in code, not manually tested.
- [ ] Batch 1 runtime validation and use-case verification harness: fixed in code, not manually tested.
- [ ] B8: Part A uses schema version 4 and refuses older databases. The explicit one-time development reset and ordered migration runner are gated in Part B and have not been started.
- [ ] B9: open; delete failures and rejected IPC calls still need user-visible handling.
- [ ] B10: open; contractor/driver edit forms remain duplicated and unlocked.
- [ ] B11: partially addressed; account balances now include opening balances and share statement calculations. Empty-state rendering, account number formatting, and duplicate client-payment notes remain open.

Full text: [code-review-backlog.md](code-review-backlog.md).

## Source Audit

### Implemented in Current Source

- [x] Fresh-install schema includes MaterialType, Attachment, client/contractor opening-balance fields, and `Trip.material_type_id`.
- [x] Main-process create/list/update/delete use cases and IPC handlers exist for drivers, clients, crushers, contractors, vehicles, and material types.
- [x] Shift creation/closure and trip create/update/delete are implemented.
- [x] Attachment persistence/list/read/remove flows exist; `closeShift` validates attachments and reported trip count.
- [x] Ledger, client payments, account queries, and client/contractor statement APIs exist.
- [x] Renderer routes exist for `/`, `/shifts`, `/shifts/:shiftId`, `/all-trips`, `/accounts`, `/statements`, and `/settings`.
- [x] Settings pages include the entity sections for vehicles, drivers, contractors, crushers, clients, and material types.
- [x] `/statements` is implemented for clients and contractors; `/accounts` is a separate page labeled `حركة النقدية`.

### Gaps Confirmed in Current Source

1. No CSV import/export workflow is present under `src`.
2. There is no `npm test` script; run the tracked use-case verification harness with `npm run verify:use-cases`.

### Verification Status

Only items marked [x] were confirmed by the user in Electron; unchecked items are pending.

## Operational Notes

- `CURRENT_VERSION` is `4` in `src/main/db.ts`.
- Part A retains the fresh-baseline version gate and refuses older databases. The one-time development reset procedure and ordered migrations are deferred to gated Part B. No real database was accessed or reset.
- No backup is created before schema initialization; after closing, backup failures are logged and shown to the user without failing the close.
- The current UI label for the accounts page is `حركة النقدية`, not `الحسابات`.
- No migration path is retained in the source for earlier experimental schemas.
- Runtime validation is enforced in main for real `YYYY-MM-DD` dates, positive integer IDs, positive cubic quantities and prices, non-negative fixed monetary fines, two-decimal money precision, and validated enums before database writes.

## Decisions

- Contractor balance sign is the reverse of client sign, using the same formula: client positive means the client owes us; contractor positive means we owe the contractor. Both contractor statement surfaces explain this sign; calculations and colors are unchanged.
- Execution order: B2 + B8, then B6 + B7, then the rest.
- The Accounts page final name is `حركة النقدية`. Do not reopen this naming decision.
- Part A establishes schema baseline version 4 and refuses older databases. Do not reset a database as part of routine updates; the explicit one-time development reset and ordered migration runner are gated in Part B.
- The source is the authority; stale docs and historical migration claims are ignored when they do not match checked-out code.
- B7 update semantics are PUT: update requests carry the full row state; every nullable field is required and must be sent as a value or `null`, where `null` clears nullable columns. `Ledger.contractor_id` remains `NOT NULL` in the current schema, so the contractor is derived from a selected shift or required when no shift is selected. No update field falls back to its existing value.
- Ledger entries and client payments may use negative amounts for refunds or reversals (for example, refunding part of a client payment or returning an excess driver advance). Zero is rejected. The statement formula is unchanged (`balance = opening + charges - payments`), so a negative payment raises the balance.
- Close-time reported trip count is required for both OPEN and REOPENED shifts; no stored-count or actual-count fallback is used. This is the adopted D1 decision and is locked.
- If the post-close backup fails, the shift close still succeeds and the user sees a visible warning that the shift was closed but the backup failed.
- R1: money inputs have at most two decimals; derived amounts use exact half-up rounding per trip line and sums use integer minor units. Cubic quantities remain finite positive REAL values.
- R2: each trip has one fixed non-negative monetary fine and optional reason. It reduces client balance as a separate negative statement row and never changes cubic quantities or costs; discount fields and effective cubic are removed.
- R3: client charge = client_cubic_reported × client_price.
- R4: contractor transport = client_cubic_reported × transport_price; material = crusher_cubic × stone_price. Show separately; both increase contractor balance. No crusher ledger/account and no automatic closeShift settlement.
- R5: client balance = opening + charges - fines - payments; contractor balance = opening + transport + material - signed ledger settlements. Positive client means client owes us; positive contractor means we owe contractor.
- R6: opening balances are included in Accounts and Statements; opening_balance_date is informational and never filters trips or payments.
- R7: trip IDs need only be unique; gaps are allowed and the existing ID scheme is unchanged.
- R8: Shift snapshots contractor_id at creation; historical accounting uses it, not the vehicle's current contractor.
- T1: money columns are INTEGER piasters in SQLite and decimal pounds at renderer/IPC; main-process boundaries convert and reject amounts with more than two decimals.
- T2: one shared TypeScript accounting module calculates derived money from raw rows; SQL does not calculate line amounts. The unused TripAccounting view is removed.
- T3: schema version 4 baseline includes fine columns, Shift.contractor_id, integer money, stone_price NOT NULL, the approved CHECK constraints and indexes, and partial unique indexes for OPEN shifts by vehicle and driver.
- Implementation assumptions: one fine per trip and half-up rounding per trip line, as specified by the owner.
- A CLOSED shift stays locked: no ledger entry can be created, edited, deleted, or moved to or from it. Correction paths are `reopenShift`, or an `OTHER` entry without a shift and with a note. A reopened shift is finished but temporarily unlocked only to correct a mistake. `Shift.status` values are `OPEN`, `CLOSED`, and `REOPENED`. `REOPENED` is not an open shift: it never counts in the driver/vehicle open-shift checks, never blocks creating a new shift for the same driver or vehicle, and does not appear in lists used to start new work. A reopened shift accepts everything an open shift accepts: new trips, trip edits and deletes, ledger entries, and attachments. When a REOPENED shift is closed again, the user re-enters the reported trip count, which is required and validated against the actual trip count before the close transaction writes. `closeShift` validates it as an integer >= 0, checks mismatch against that new count before writes, then updates `Shift.reported_trip_count`, sets `CLOSED`, and updates the reopen log in one transaction. The close dialog pre-fills the count from `reportedTripCount ?? actualTripCount ?? 0` for any shift; main requires the count explicitly with no fallback. Trips can be added to a REOPENED shift from the shift detail page. Every reopen requires a non-empty reason and is logged in `ShiftReopenLog`.

## Next Up

1. Manually test the Part A accounting scenarios below; fixed in code, not manually tested.
2. Wait for explicit "continue Part B" approval before implementing the reset checklist or migration runner.
3. B9: show deletion errors and handle rejected IPC calls.
4. B10: use the shared ledger form for edits with locked IDs.
5. B11: fix the remaining empty-state, formatting, and duplicate-note inconsistencies.

## Manual Test Checklist

- [x] Delete the local `shift-tracker.db` first.
- [x] Delete a trip with an attachment; verify attachment rows and the file are removed, and the trip ID is not reused.
- [x] Open an attachment photo through `attachmentId`.
- [x] Verify adding and removing attachments on a closed shift are rejected.
- [x] Verify uploads larger than 5MB and non-JPEG uploads are rejected.
- [x] Verify `closeShift` fails when a required attachment row exists but its file is missing.
- [x] Update a client without `location`, `openingBalance`, or `openingBalanceDate`, and a contractor without `phone`, `openingBalance`, or `openingBalanceDate`; verify existing values are preserved.
- [ ] Edit a ledger entry that has a shift: choose "no shift", save, reopen: shift is empty.
- [ ] Clear the driver where the page allows it and clear notes on a ledger entry; save and reopen to verify both are empty.
- [ ] Edit a ledger entry changing only the amount; verify shift, driver, contractor, and notes are unchanged.
- [ ] Edit a client payment: clear notes, save, reopen: notes are empty.
- [ ] Edit a client payment changing only the amount; verify notes are unchanged.
- [ ] Try saving a ledger entry that violates an existing rule (for example a movement type that requires a contractor, without one): a field error appears next to the field, no crash.
- [ ] Client payment of -300 is accepted and raises the client balance by 300 in both Accounts and Statement.
- [ ] A negative ledger amount is accepted and appears in driver history.
- [ ] Amount 0 is rejected with a field error.
- [ ] Editing a client payment to a negative amount works.
- [ ] Reopen a closed shift with a reason: badge shows the reopened state and the shift becomes editable again.
- [ ] Reopen dialog displays returned `shiftId` and `reason` field errors beneath their controls.
- [ ] Add a forgotten trip with its attachment to a reopened shift from the detail page.
- [ ] Reopened trip-count input uses integer steps and a minimum of zero.
- [ ] Closing a CLOSED shift with a reported count still shows the already-closed `shiftId` error.
- [ ] A non-trip-field create error appears in the add-trip dialog and clears on resubmit or close.
- [ ] Reject reopening with an empty reason.
- [ ] While a shift is reopened, the driver can start a new shift.
- [ ] Re-close the reopened shift and verify the close checks still run and the backup is created.
- [ ] Close an OPEN shift with the count cleared or wrong shows a field error under the count field.
- [ ] Correct count closes the shift and stores the reported trip count.
- [ ] Create-shift form has no count field.
- [ ] Second shift on the same vehicle is rejected.
- [ ] Trip with 0 price rejected with a field error.
- [ ] Trip with a negative price rejected.
- [ ] Impossible date rejected.
- [ ] Shift with 0 default cubic rejected.
- [ ] Verify trip create and update reject string, NaN, negative, and zero prices/cubic values on the exact field without changing rows; verify cubic quantities remain positive finite real values and are unaffected by a financial fine.
- [ ] Verify impossible trip, shift-start, and shift-end dates report invalid-date errors while empty dates report required errors.
- [ ] Create and edit a trip whose optional strings are empty in the renderer; verify saves succeed, nullable DB values mapped to empty strings are accepted, and recipient status is explicitly sent as UNCLEAR.
- [ ] Verify createShift rejects a provided reported count without inserting a shift, and rejects zero/negative/string defaults without inserting a shift.
- [ ] Verify a second OPEN shift on a dedicated vehicle is rejected, closing frees the vehicle, and a REOPENED shift does not block a new shift on it.
- [ ] Verify a close date before shift start leaves the shift unchanged, and an already-CLOSED shift with an invalid count reports the already-closed shiftId error first.
- [ ] Close an OPEN shift with a valid reported count only after the required closing-sheet attachment exists; verify the shift closes and the reported count is stored as zero.
- [ ] Re-close with the newly entered reported count; verify it succeeds and updates the count.
- [ ] Re-close with a wrong reported count; verify a field error appears under the count field.
- [ ] Verify the re-close count field is pre-filled from the current reported count, or actual count when none is set.
- [ ] After re-closing, edits are locked again.
- [ ] Query `ShiftReopenLog` using `SELECT id, shift_id, reopened_at, reason, previous_end_date, closed_again_at FROM ShiftReopenLog ORDER BY id DESC;` to confirm the reopen log and `closed_again_at` timestamp.
- [ ] Add a ledger entry choosing a closed shift: rejected with an error next to the shift field.
- [ ] Edit amount of an entry on a closed shift: rejected.
- [ ] Edit an entry on a closed shift and choose "no shift": rejected.
- [ ] Move an entry from an open shift to a closed shift: rejected.
- [ ] Add an OTHER entry with no shift, a contractor, and a note: accepted.
- [ ] Trip details show the correct receipt-status and recipient-status labels for every stored enum value.
- [ ] Ledger entry details show Advance and Payment correctly.
- [ ] Closing a shift while the backup folder is unwritable still closes the shift and shows the backup warning.
- [ ] Contractor statement shows the balance-sign note and the client statement does not.
- [ ] Enter a fixed fine and reason; confirm it appears as a separate negative client statement line.
- [ ] Confirm a fine reduces client balance without changing reported cubic or client total cubic.
- [ ] Confirm contractor transport uses reported client cubic and material cost uses crusher cubic, shown as separate components.
- [ ] Confirm opening balances appear in both Accounts and Statements even when opening_balance_date is later than some transactions.
- [ ] Reassign a vehicle to another contractor after a shift is created; confirm old shift charges remain with the original contractor.
- [ ] Confirm every monetary input rejects more than two decimal places, accepts 5.25 exactly, and renderer money steps remain 0.01.

Automated use-case check command: `npm run verify:use-cases` (not a manual test). E2E smoke command: `npm run test:e2e` (builds the app then runs Playwright; not a manual test).

E2E smoke coverage maps to these unchecked manual checklist items: shift creation and duplicate vehicle validation; trip zero-price validation and receipt/recipient labels; close count pre-fill, mismatch rejection, attachment checks, and successful close; contractor/client statement sign-note visibility. S1 additionally checks route rendering, page/console errors, and raw translation-key text; these have no existing manual checklist item.
