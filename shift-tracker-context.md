# Shift Tracker: Source-Grounded Context

Snapshot checked: 2026-10-03, source at `HEAD` `9c5c453`. This document describes checked-out code, not earlier plans or the value inside a running user's database.

## Stack and Structure

- Electron + electron-vite, React + TypeScript, SQLite through `better-sqlite3`.
- Main-process database path: `app.getPath('userData')/shift-tracker.db` (`src/main/db.ts`).
- Renderer uses `react-router-dom` `HashRouter`, `react-hook-form`, Zod, TanStack Table, Radix/shadcn UI primitives, and `react-i18next`.
- Preload exposes `window.api`; `src/main/index.ts` registers IPC handlers. Use cases return `{ ok: true, data }` or `{ ok: false, errors }` results.
- Arabic is the only locale registered in `src/renderer/src/i18n/index.ts`.
- Renderer forms use client-side Zod schemas and main use cases also validate their inputs; validation is not exclusively in one layer.

## Database Schema

The fresh-install `SCHEMA` in `src/main/db.ts` creates these tables and columns:

| Table | Columns |
| --- | --- |
| `TransportContractor` | `id`, `name`, `phone`, `opening_balance`, `opening_balance_date` |
| `Vehicle` | `vehicle_no`, `trailer_no`, `contractor_id`, `default_cubic`, `owner_name` |
| `Driver` | `id`, `name`, `phone1`, `phone2` |
| `Crusher` | `id`, `name`, `initial_price` |
| `Client` | `id`, `name`, `initial_price`, `location`, `opening_balance`, `opening_balance_date` |
| `MaterialType` | `id`, `name` |
| `Shift` | `id`, `vehicle_no`, `driver_id`, `crusher_cubic_default`, `client_cubic_default`, `start_date`, `end_date`, `status`, `reported_destination`, `reported_trip_count`, `notes` |
| `Trip` | `id`, `shift_id`, `trip_date`, `crusher_cubic`, `client_cubic_reported`, `discount_qty`, `discount_reason`, `location`, `crusher_id`, `stone_price`, `crusher_receipt_status`, `crusher_receipt_no`, `client_id`, `transport_price`, `client_price`, `recipient_name_status`, `recipient_name`, `client_receipt_no`, `notes`, `material_type_id` |
| `Attachment` | `id`, `entity_type`, `entity_id`, `kind`, `photo_path`, `created_at` |
| `Ledger` | `id`, `entry_date`, `driver_id`, `movement_type`, `amount`, `shift_id`, `contractor_id`, `notes` |
| `ClientPayment` | `id`, `entry_date`, `client_id`, `amount`, `notes` |

Thus `MaterialType`, `Attachment`, both entities' opening-balance columns, `Client.location`, and `Trip.material_type_id` exist in the actual fresh-install schema.

Constraints and derived objects in `SCHEMA`:

- Foreign keys connect vehicles, shifts, trips, and account rows to related entities; `Trip.material_type_id` references `MaterialType(id)`.
- `Shift.status` permits `OPEN` and `CLOSED`.
- `Trip.crusher_receipt_status` permits `PROVIDED`, `CONFIRMED_MISSING`, and `UNKNOWN`; checks enforce the receipt-number and recipient-name status/value combinations.
- `Attachment.entity_type` permits `TRIP`/`SHIFT`; `kind` permits `CRUSHER_RECEIPT`/`CLIENT_RECEIPT`/`CLOSING_SHEET`. `entity_id` is polymorphic and has no declared foreign key.
- `Ledger.movement_type` permits `ADVANCE`, `PAYMENT`, and `OTHER`.
- Indexes: partial unique `idx_trip_crusher_receipt` on non-null `(crusher_id, crusher_receipt_no)`, and `idx_attachment_entity` on `(entity_type, entity_id)`.
- Views: `ShiftStats` (`shift_id`, `actual_trip_count`, `reported_trip_count`, `has_count_mismatch`) and `TripAccounting` (`id`, `crusher_amount`, `transport_amount`, `effective_client_cubic`, `client_amount`).

### Version Handling

The schema is now a single clean baseline at `user_version = 1`. There is no upgrade path from any prior experimental database version; any older local SQLite database must be deleted manually before starting the app. This reset was intentionally done now at first real ship rather than deferred.

The project no longer maintains a multi-version migration chain, so the previous `versions 2–8 unsupported` gap no longer applies because there is no migration chain left to have gaps in. Old local databases are treated as incompatible state and must be replaced with a fresh database created from the current schema.

The current schema version was bumped to `CURRENT_VERSION = 2` for the new `TripIdCounter` baseline and the stricter attachment guards. Any existing local database must be deleted again before the next manual test, because the app intentionally refuses legacy local data rather than trying to preserve it.

### Backend Update Rules

B2 is fixed in the current backend: optional update fields are treated as patch semantics. If a caller omits an optional value on update, the existing row value is preserved instead of being replaced with `0`, `null`, or an empty string. This applies to client and contractor updates, including `location`, `openingBalance`, `openingBalanceDate`, and `phone` when those fields are not explicitly provided.

B5 is fixed: trip IDs now come from the monotonic `TripIdCounter` table instead of reusing deleted IDs, and deleting a trip removes its attachment rows and photo files in the same transaction.

B6 is fixed: attachment files are validated and saved under the attachments directory only, path traversal is blocked, the `getAttachmentPhoto({ attachmentId })` contract replaces any path-based contract, invalid/empty JPEG data is rejected, closed shifts reject attachment changes, and invalid entity/kind combinations are rejected.

B8 is resolved via the database reset: migration safety is handled by refusing any old database and requiring a clean fresh start at `user_version = 1` instead of carrying stale migration history forward.

## Renderer Routes and Labels

Routes declared in `src/renderer/src/App.tsx`:

| Route | Page | Current Arabic title/label |
| --- | --- | --- |
| `/` | `AddTripPage` | `addTrip.title` |
| `/shifts` | `ShiftsPage` | `shifts.title` |
| `/shifts/:shiftId` | `ShiftDetailPage` | shift details |
| `/all-trips` | `AllTripsPage` | `allTrips.title` |
| `/accounts` | `AccountsPage` | `accountsPage.title` = **الحسابات** |
| `/statements` | `StatementsPage` | `statementsPage.title` = **كشف حساب** |
| `/settings` | `SettingsPage` | `settingsPage.title` |

There is no `/import` route or `ImportPage.tsx` in the current source. `/statements` is implemented. `AccountsPage` currently displays **الحسابات**, not **الخزينة**. Settings sections (vehicles, drivers, contractors, crushers, clients, material types) are selected within `SettingsPage`, not separate routes.

See [app-file-tree.md](app-file-tree.md) for the current tracked renderer pages and components.

## Implemented Areas Visible in Source

- Settings pages exist for vehicles, drivers, contractors, crushers, clients, and MaterialType; client location/opening-balance fields and contractor opening-balance fields are present in forms.
- Add-trip and shift-detail editing share a trip schema/form; trip creation/update requires `materialTypeId` and loads material types.
- `StatementsPage` selects clients/contractors, calls the corresponding statement API, and renders opening/charge/payment rows and totals.
- `AccountsPage` contains contractor, driver, client, and all-movements sections. `ClientPayment` is a separate table from `Ledger`.
- Attachment flows exist for trips and shifts. `closeShift` checks for a closing-sheet attachment, at least one attachment per trip, and reported trip count, then backs up the database.
- Shared renderer components include `DataTable`, `SubmitButton`, `Skeleton`, and the in-app `FloatingWindow` system.

## Source-Verified Gaps

- No CSV import/export page or CSV import/export use case exists in tracked `src`. `papaparse` remains a package dependency, which alone does not establish a working CSV flow.
- `package.json` has no test script, and the tracked tree contains no test/spec files. Runtime/manual-test completion cannot be determined from source.
- The migration fallback does not explicitly upgrade `user_version` values 2 through 8.
