# Shift Tracker: Source-Grounded Context

This document reflects the checked-out source in the current workspace and is the source of truth for implementation decisions. Earlier migration notes and stale planning text are not treated as current facts unless they still match the code.

## Stack and Structure

- Electron + electron-vite, React + TypeScript, and SQLite via `better-sqlite3`.
- Main-process DB path: `app.getPath('userData')/shift-tracker.db` (`src/main/db.ts`).
- Renderer uses `react-router-dom` `HashRouter`, `react-hook-form`, Zod, TanStack Table, Radix/shadcn UI primitives, and `react-i18next`.
- Preload exposes `window.api`; `src/main/index.ts` registers IPC handlers. Main use cases return `{ ok: true, data }` or `{ ok: false, errors }` results.
- Arabic is the only locale registered in `src/renderer/src/i18n/index.ts`.

## Database Schema

The fresh-install `SCHEMA` in `src/main/db.ts` creates the current baseline tables and derived objects. The key schema facts are:

- `TransportContractor`: `id`, `name`, `phone`, `opening_balance`, `opening_balance_date`
- `Vehicle`: `vehicle_no`, `trailer_no`, `contractor_id`, `default_cubic`, `owner_name`
- `Driver`: `id`, `name`, `phone1`, `phone2`
- `Crusher`: `id`, `name`, `initial_price`
- `Client`: `id`, `name`, `initial_price`, `location`, `opening_balance`, `opening_balance_date`
- `MaterialType`: `id`, `name`
- `Shift`: `id`, `vehicle_no`, `driver_id`, `crusher_cubic_default`, `client_cubic_default`, `start_date`, `end_date`, `status`, `reported_destination`, `reported_trip_count`, `notes`
- `Trip`: `id`, `shift_id`, `trip_date`, `crusher_cubic`, `client_cubic_reported`, `discount_qty`, `discount_reason`, `location`, `crusher_id`, `stone_price`, `crusher_receipt_status`, `crusher_receipt_no`, `client_id`, `transport_price`, `client_price`, `recipient_name_status`, `recipient_name`, `client_receipt_no`, `notes`, `material_type_id`
- `Attachment`: `id`, `entity_type`, `entity_id`, `kind`, `photo_path`, `created_at`
- `Ledger`: `id`, `entry_date`, `driver_id`, `movement_type`, `amount`, `shift_id`, `contractor_id`, `notes`
- `ClientPayment`: `id`, `entry_date`, `client_id`, `amount`, `notes`
- `TripIdCounter`: single-row table used for monotonic trip IDs

Constraints and derived objects in the live schema:

- Foreign keys connect vehicles, shifts, trips, and account rows to related entities; `Trip.material_type_id` references `MaterialType(id)`.
- `Shift.status` accepts `OPEN`, `CLOSED`, and `REOPENED`.
- `ShiftReopenLog` stores `id`, `shift_id`, `reopened_at`, `reason`, `previous_end_date`, and `closed_again_at`.
- `Trip.crusher_receipt_status` accepts `PROVIDED`, `CONFIRMED_MISSING`, and `UNKNOWN`; checks enforce receipt-number and recipient-name status/value combinations.
- `Trip.recipient_name_status` accepts `PROVIDED` and `UNCLEAR`.
- `Attachment.entity_type` accepts `TRIP` and `SHIFT`; `kind` accepts `CRUSHER_RECEIPT`, `CLIENT_RECEIPT`, and `CLOSING_SHEET`. `entity_id` is polymorphic and has no declared foreign key.
- `Ledger.movement_type` accepts `ADVANCE`, `PAYMENT`, and `OTHER`.
- Indexes: partial unique `idx_trip_crusher_receipt` on non-null `(crusher_id, crusher_receipt_no)`, and `idx_attachment_entity` on `(entity_type, entity_id)`.
- Views: `ShiftStats` (`shift_id`, `actual_trip_count`, `reported_trip_count`, `has_count_mismatch`) and `TripAccounting` (`id`, `crusher_amount`, `transport_amount`, `effective_client_cubic`, `client_amount`).

## Version Handling

The current source uses a single clean baseline at `CURRENT_VERSION = 3` and initializes the DB on first run via `SCHEMA` and `user_version = 3`.

Important decisions in the live code:

- There is no migration chain kept in the source. The app intentionally refuses older databases instead of trying to upgrade them.
- Any existing local `shift-tracker.db` from an older experimental build must be deleted manually before the app can run.
- The current source intentionally treats legacy local state as unsupported rather than carrying stale migration logic forward.
- No backup is created before schema initialization. The `closeShift` backup runs after closing; if it fails, the error is logged, the close still succeeds, and the renderer shows a warning.

This is the current and deliberate policy for the app: clean fresh start, no upgrade path from older experimental database versions.

## Backend Fixes and Decisions

The current source contains the following enforced fixes:

- B2 is fixed: optional update fields preserve existing values when omitted, instead of resetting to `0`, `null`, or empty strings. This applies to client/contractor updates.
- B5 is fixed: trip IDs come from `TripIdCounter`; deleting a trip and its attachment rows occurs in one SQLite transaction, followed by removal of the stored photo files.
- B6 is fixed: attachment storage is restricted to the app attachments directory, path traversal is blocked, invalid JPEGs are rejected, invalid entity/kind combinations are rejected, closed shifts reject attachment edits, and the API contract uses `attachmentId` instead of raw paths.
- B8 is fixed by decision: the migration chain was removed from the source and the app refuses old local databases instead of trying to preserve unsupported data.
- B7 update contract: ledger and client payment updates require the complete row state. Nullable update fields are required and accept explicit `null` to clear nullable columns; `undefined` is rejected and no field falls back to its stored value. `Ledger.contractor_id` remains `NOT NULL` in the current schema, so the contractor is derived from a selected shift or required when no shift is selected. Create and update validate runtime types, finite non-zero amounts (negative values allowed), IDs, enum values, and real `YYYY-MM-DD` dates; SQLite foreign-key failures return field errors.
- Ledger entries cannot be created on a closed shift; updates are rejected if either the existing entry shift or requested destination shift is closed; deletions on closed shifts remain rejected. Creating an OTHER entry without a shift remains allowed when a contractor is supplied.
- `createShift` rejects any attempt to pass `reportedTripCount`, stores `reported_trip_count` as `NULL` on initial creation, and blocks a second open shift on the same vehicle while still allowing a reopened shift to start a new shift.
- `closeShift` requires a valid non-negative `reportedTripCount` for every close (including the first close of an OPEN shift), validates required closing-sheet attachment rows before writing, and for a `REOPENED` shift validates the newly entered count before closing again. The already-CLOSED check runs first. The count is entered at close for OPEN and REOPENED shifts; there is no stored-count or actual-count fallback. The close dialog pre-fills the count from `reportedTripCount ?? actualTripCount ?? 0` for any shift; main requires the count explicitly with no fallback. The input uses integer steps and a zero minimum. After the close transaction, backup errors are logged and returned as a success warning that the renderer displays while refreshing the list.
- Runtime validation is enforced in `createShift`, `createTrip`, and `updateTrip` for real `YYYY-MM-DD` values, positive integer IDs, positive numeric cubic/price fields, non-negative numeric `discountQty`, and validated enums for `crusherReceiptStatus` and `recipientNameStatus` before the database write. Trip-date, shift-date, and discount-quantity validation messages come from `ar.json`. Optional trip strings from renderer forms are sent as empty strings; trip edits map nullable DB strings to empty strings and explicitly send `recipientNameStatus`.

## Renderer Routes and Labels

The current renderer routes are declared in `src/renderer/src/App.tsx`:

| Route              | Page              | Current label                         |
| ------------------ | ----------------- | ------------------------------------- |
| `/`                | `AddTripPage`     | `addTrip.title`                       |
| `/shifts`          | `ShiftsPage`      | `shifts.title`                        |
| `/shifts/:shiftId` | `ShiftDetailPage` | shift details                         |
| `/all-trips`       | `AllTripsPage`    | `allTrips.title`                      |
| `/accounts`        | `AccountsPage`    | `accountsPage.title` = `حركة النقدية` |
| `/statements`      | `StatementsPage`  | `statementsPage.title` = `كشف حساب`   |
| `/settings`        | `SettingsPage`    | `settingsPage.title`                  |

The final user-facing name for the accounts page is `حركة النقدية`. The old Arabic wording `الحسابات` is not the current source-of-truth label and was removed from the renderer locale.

- The Add Trip page retrieves only a driver's `OPEN` shift. Shift Detail has a `REOPENED`-only add-trip dialog that reuses the shared `TripForm`; non-field create errors are displayed as an alert and cleared on resubmit or dialog close.
- Trip and ledger detail views use shared enum-label helpers for receipt status, recipient-name status, and movement type.

## Source-Verified Gaps

- There is no CSV import/export route or implementation in the tracked `src` tree.
- There is no `npm test` script; the tracked use-case verification harness runs with `npm run verify:use-cases`.
- Only items marked [x] were confirmed by the user in Electron; unchecked items are pending.

## Decisions

- Contractor balance sign is the reverse of client sign, using the same formula: client positive means the client owes us; contractor positive means we owe the contractor. Both contractor statement surfaces explain this sign; calculations and colors are unchanged.
- Execution order: B2 + B8, then B6 + B7, then the rest.
- The Accounts page final name is `حركة النقدية`. Do not reopen this naming decision.
- The project uses a fresh-install database policy: schema reset is the supported path. Legacy migration logic is not retained; older local databases are refused.
- The source is the authority; stale docs and historical migration claims are ignored when they do not match checked-out code.
- B7 update semantics are PUT: update requests carry the full row state; every nullable field is required and must be sent as a value or `null`, where `null` clears nullable columns. `Ledger.contractor_id` remains `NOT NULL` in the current schema, so the contractor is derived from a selected shift or required when no shift is selected. No update field falls back to its existing value.
- Ledger entries and client payments may use negative amounts for refunds or reversals (for example, refunding part of a client payment or returning an excess driver advance). Zero is rejected. The statement formula is unchanged (`balance = opening + charges - payments`), so a negative payment raises the balance.
- Close-time reported trip count is required for both OPEN and REOPENED shifts; no stored-count or actual-count fallback is used. This is the adopted D1 decision and is locked.
- If the post-close backup fails, the shift close still succeeds and the user sees a visible warning that the shift was closed but the backup failed.
- A CLOSED shift stays locked: no ledger entry can be created, edited, deleted, or moved to or from it. Correction paths are `reopenShift`, or an `OTHER` entry without a shift and with a note. A reopened shift is finished but temporarily unlocked only to correct a mistake. `Shift.status` values are `OPEN`, `CLOSED`, and `REOPENED`. `REOPENED` is not an open shift: it never counts in the driver/vehicle open-shift checks, never blocks creating a new shift for the same driver or vehicle, and does not appear in lists used to start new work. A reopened shift accepts everything an open shift accepts: new trips, trip edits and deletes, ledger entries, and attachments. When a REOPENED shift is closed again, the user re-enters the reported trip count, which is required and validated against the actual trip count before the close transaction writes. `closeShift` validates it as an integer >= 0, checks mismatch against that new count before writes, then updates `Shift.reported_trip_count`, sets `CLOSED`, and updates the reopen log in one transaction. The close dialog pre-fills the count from `reportedTripCount ?? actualTripCount ?? 0` for any shift; main requires the count explicitly with no fallback. Trips can be added to a REOPENED shift from the shift detail page. Every reopen requires a non-empty reason and is logged in `ShiftReopenLog`.

## References

For current task status and the complete review findings, see [shift-app-todo.md](shift-app-todo.md) and [code-review-backlog.md](code-review-backlog.md).
