# Shift Tracker

## 1. Purpose and scale

- Offline, single-machine Windows desktop application for a stone-hauling business.
- Supports about 2,000 trips per year.
- Arabic right-to-left (RTL) user interface.

## 2. Stack and commands

| Area         | Current implementation                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Desktop      | Electron, `electron-vite`, React, TypeScript                               |
| Database     | SQLite through `better-sqlite3`                                            |
| UI           | React Router, React Hook Form, Zod, TanStack Table, Radix UI, Tailwind CSS |
| Localization | `react-i18next`; Arabic locale in `src/renderer/src/i18n/locales/ar.json`  |

| Command                                 | Purpose                                                      |
| --------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                           | Start the development app                                    |
| `npm run build`                         | Type-check and build the app                                 |
| `npm run typecheck`                     | Check node and web TypeScript projects                       |
| `npm run lint`                          | Lint the repository with zero warnings allowed               |
| `npm run verify:use-cases`              | Run the isolated use-case and SQLite verification harness    |
| `npm run db:inspect -- <database-path>` | Inspect a database read-only through Electron as Node        |
| `npm run test:e2e`                      | Build the app and run the Playwright Electron smoke suite    |
| `npm run review:gate`                   | Run checks and mechanical review rules; write `last-task.md` |
| `npm run review:gate:e2e`               | Run the review gate including the E2E suite                  |

## 3. Architecture

### Request and result flow

`renderer -> preload (window.api) -> ipcMain -> use-cases -> repositories -> SQLite`

- `src/main/index.ts` registers IPC handlers; `src/preload/index.ts` exposes `window.api`, and `src/preload/index.d.ts` types it.
- Use cases return `{ ok: true, data }` or `{ ok: false, errors }`, where each error has a `field` and `message`.
- Runtime validation is in main-process use cases and shared schemas/helpers in `src/main/validation.ts`; renderer forms also use Zod for immediate field feedback.
- Every user-visible renderer string comes from `src/renderer/src/i18n/locales/ar.json`. Do not hardcode user-visible text in renderer code.

### Money

- IPC and renderer monetary values are decimal pounds; SQLite monetary values are integer piasters.
- Main-process use cases convert values at the database boundary with helpers from `src/main/accounting.ts`.
- `src/main/accounting.ts` is the sole module for derived financial amounts. It performs half-up rounding per trip line and sums integer minor units.
- Cubic quantities are finite positive REAL values and are not money.

### File map

| File or directory                           | Responsibility                                                 |
| ------------------------------------------- | -------------------------------------------------------------- |
| `src/main/index.ts`                         | Electron startup, IPC handlers, window creation                |
| `src/main/db.ts`                            | Immutable version-5 schema baseline, safe opening, logging     |
| `src/main/migrations.ts`                    | Ordered numbered migrations and verified pre-migration backups |
| `src/main/validation.ts`                    | Shared date, number, and money validation                      |
| `src/main/accounting.ts`                    | Money conversion, per-line rounding, account calculations      |
| `src/main/backup.ts`                        | Post-close SQLite and attachment-directory backup              |
| `src/main/photoStorage.ts`                  | JPEG storage under Electron `userData`                         |
| `src/main/use-cases/`                       | Validated business operations and result contracts             |
| `src/main/repository/`                      | SQLite reads, writes, and transactions                         |
| `src/preload/index.ts`                      | Typed IPC bridge exposed as `window.api`                       |
| `src/preload/index.d.ts`                    | Renderer-facing API and row types                              |
| `src/renderer/src/App.tsx`                  | HashRouter routes and navigation                               |
| `src/renderer/src/pages/`                   | Main pages and settings/account subpages                       |
| `src/renderer/src/components/`              | Shared forms, tables, dialogs, details, and attachments        |
| `src/renderer/src/lib/enumLabels.ts`        | Shared labels for stored enum values                           |
| `src/renderer/src/i18n/`                    | Arabic translation setup and locale                            |
| `scripts/verify-closed-shift-use-cases.cjs` | Isolated real-use-case verification harness                    |
| `scripts/db-inspect.cjs`                    | Read-only database integrity and row-count inspection          |
| `scripts/review-gate.cjs`                   | Automated checks, mechanical rules, and task report            |
| `docs/dev-reset-checklist.md`               | One-time manual development database reset procedure           |
| `playwright.config.ts`                      | Playwright Electron test configuration                         |
| `e2e/seed.cjs`                              | Isolated E2E fixture seeding through Electron as Node          |
| `e2e/smoke.spec.cjs`                        | Five end-to-end smoke flows                                    |

## 4. Data model

The production schema in `src/main/db.ts` is an immutable version-5 baseline. A fresh database executes that baseline and then all numbered migrations in order. The real migration list is empty, so the latest supported version is currently 5. The database is `app.getPath('userData')/shift-tracker.db`.

Opening rules are based on `PRAGMA user_version` and user-table presence:

- Version 0 with no user tables creates the baseline and sets version 5 in one transaction, then applies pending migrations.
- Version 0 with user tables is refused as unversioned.
- Versions 1–4 are refused as unsupported development schemas.
- Versions from the baseline through latest-minus-one require a verified database-only backup before stepwise migrations.
- The latest version opens normally. Versions above latest are refused as newer than the app.
- Refusals do not modify or delete the database, sidecars, or data directory. The dialog asks the user to archive the data folder and gives its path and found version.
- Migration backups use `userData/backups/pre-migration-v<from>-to-v<to>-<timestamp>.db`. A backup is opened read-only and must pass `integrity_check` and match the source version before any migration starts.
- Every migration and its `user_version` update share one transaction. A migration failure rolls back to its prior version; the dialog includes the backup path and states the data remains at the last completed version.
- Migrations that rebuild foreign-keyed tables declare `foreignKeys: 'off'`; the runner disables enforcement outside the transaction, runs `foreign_key_check` inside it, rolls back violations, and restores enforcement in `finally`.
- Migration backups cover the database only; migrations do not change attachment files.
- For a one-time manual development reset, follow `docs/dev-reset-checklist.md`. The checklist archives named database and user-data items before deletion; there is no in-app reset.

In the table below, `NOT NULL` means required; columns without it are nullable unless they are primary keys. `INTEGER` money is piasters. Foreign keys are noted as `REFERENCES`.

| Table                 | Columns, SQL types, nullability, and checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TripIdCounter`       | `id INTEGER PRIMARY KEY CHECK (id = 1)`; `next_number INTEGER NOT NULL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `TransportContractor` | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`; `phone TEXT`; `opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (typeof(...) = 'integer')`; `opening_balance_date TEXT` nullable, valid real `YYYY-MM-DD` when set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `Vehicle`             | `vehicle_no INTEGER PRIMARY KEY`; `trailer_no INTEGER NOT NULL`; `contractor_id INTEGER NOT NULL REFERENCES TransportContractor(id)`; `default_cubic REAL`; `owner_name TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Driver`              | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`; `phone1 TEXT`; `phone2 TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Crusher`             | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`; `initial_price INTEGER` nullable, positive integer when set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `Client`              | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`; `initial_price INTEGER` nullable, positive integer when set; `location TEXT`; `opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (typeof(...) = 'integer')`; `opening_balance_date TEXT` nullable, valid real `YYYY-MM-DD` when set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `MaterialType`        | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `Shift`               | `id TEXT PRIMARY KEY`; `vehicle_no INTEGER NOT NULL REFERENCES Vehicle(vehicle_no)`; `driver_id INTEGER NOT NULL REFERENCES Driver(id)`; `contractor_id INTEGER NOT NULL REFERENCES TransportContractor(id)` (creation-time snapshot); `crusher_cubic_default REAL NOT NULL`; `client_cubic_default REAL NOT NULL`; `start_date TEXT NOT NULL`; `end_date TEXT`; `status TEXT NOT NULL CHECK (OPEN, CLOSED, REOPENED)`; `reported_destination TEXT`; `reported_trip_count INTEGER`; `notes TEXT`; defaults must be finite and positive; start/end dates must be real `YYYY-MM-DD` when set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `ShiftReopenLog`      | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `shift_id TEXT NOT NULL REFERENCES Shift(id)`; `reopened_at TEXT NOT NULL`; `reason TEXT NOT NULL CHECK (length(trim(reason)) > 0)`; `previous_end_date TEXT`; `closed_again_at TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `Trip`                | `id TEXT PRIMARY KEY`; `shift_id TEXT NOT NULL REFERENCES Shift(id)`; `trip_date TEXT NOT NULL` and valid real `YYYY-MM-DD`; `crusher_cubic REAL NOT NULL`; `client_cubic_reported REAL NOT NULL`; `fine_amount INTEGER NOT NULL DEFAULT 0` and non-negative integer; `fine_reason TEXT`; `location TEXT`; `crusher_id INTEGER NOT NULL REFERENCES Crusher(id)`; `stone_price INTEGER NOT NULL` positive integer; `crusher_receipt_status TEXT NOT NULL CHECK (PROVIDED, CONFIRMED_MISSING, UNKNOWN)`; `crusher_receipt_no INTEGER`; `client_id INTEGER NOT NULL REFERENCES Client(id)`; `transport_price INTEGER NOT NULL` positive integer; `client_price INTEGER NOT NULL` positive integer; `recipient_name_status TEXT NOT NULL DEFAULT 'UNCLEAR' CHECK (PROVIDED, UNCLEAR)`; `recipient_name TEXT`; `client_receipt_no TEXT`; `notes TEXT`; `material_type_id INTEGER REFERENCES MaterialType(id)`; cubic quantities must be finite and positive; PROVIDED receipt requires a number and other receipt states require NULL; PROVIDED recipient requires a name and UNCLEAR requires NULL |
| `Attachment`          | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `entity_type TEXT NOT NULL CHECK (TRIP, SHIFT)`; `entity_id TEXT NOT NULL` (polymorphic, no FK); `kind TEXT NOT NULL CHECK (CRUSHER_RECEIPT, CLIENT_RECEIPT, CLOSING_SHEET)`; `photo_path TEXT NOT NULL`; `created_at TEXT NOT NULL DEFAULT datetime('now')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Ledger`              | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `entry_date TEXT NOT NULL` and valid real `YYYY-MM-DD`; `driver_id INTEGER REFERENCES Driver(id)`; `movement_type TEXT NOT NULL CHECK (ADVANCE, PAYMENT, OTHER)`; `amount INTEGER NOT NULL` non-zero integer; `shift_id TEXT REFERENCES Shift(id)`; `contractor_id INTEGER NOT NULL REFERENCES TransportContractor(id)`; `notes TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `ClientPayment`       | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `entry_date TEXT NOT NULL` and valid real `YYYY-MM-DD`; `client_id INTEGER NOT NULL REFERENCES Client(id)`; `amount INTEGER NOT NULL` non-zero integer; `notes TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

All seven date columns use shape and SQLite calendar-validity checks. Nullable dates accept NULL.

| Index or view                                                                 | Definition                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `idx_trip_crusher_receipt`                                                    | Partial unique `(crusher_id, crusher_receipt_no)` for non-NULL receipt numbers |
| `idx_trip_shift`, `idx_trip_client`, `idx_trip_crusher`                       | Trip lookup indexes                                                            |
| `idx_shift_open_vehicle`, `idx_shift_open_driver`                             | Partial unique vehicle/driver indexes for `status = 'OPEN'`                    |
| `idx_shift_driver_status`, `idx_shift_vehicle_status`, `idx_shift_contractor` | Shift lookup indexes                                                           |
| `idx_attachment_entity`                                                       | `(entity_type, entity_id)`                                                     |
| `idx_ledger_contractor`, `idx_ledger_driver`, `idx_ledger_shift`              | Ledger lookup indexes                                                          |
| `idx_client_payment_client`                                                   | Client payment lookup index                                                    |
| `ShiftStats`                                                                  | Per-shift `actual_trip_count`, `reported_trip_count`, and `has_count_mismatch` |

Attachment rows store paths relative to user data. JPEG files are stored under `userData/docs/attachments`; the database stores `docs/attachments/<attachmentId>.jpg`. Uploads are limited to 5 MiB decoded and checked for JPEG magic bytes. `closeShift` checks the closing-sheet file exists and requires at least one attachment for each trip.

## 5. Business rules

### Shifts and trips

- Shift states are `OPEN`, `CLOSED`, and `REOPENED`.
- One `OPEN` shift is allowed per vehicle and per driver. `REOPENED` shifts do not block a new shift for that vehicle or driver.
- Shift creation snapshots the vehicle's contractor into `Shift.contractor_id`; later vehicle reassignment does not reassign historical charges.
- Closing an `OPEN` or `REOPENED` shift requires an explicitly supplied non-negative integer reported trip count equal to the actual trip count, an end date not before its start date, a valid closing-sheet file, and at least one attachment on every trip.
- The close dialog pre-fills `reportedTripCount ?? actualTripCount ?? 0` for any shift. Main requires the count explicitly and applies no fallback.
- The close transaction stores the end date, reported count, and CLOSED status and updates the active reopen log. A post-close backup failure is logged and returned as a visible warning; it does not fail the close.
- Only a CLOSED shift can be reopened; a non-empty reason is required and recorded in `ShiftReopenLog`. Reopened shifts can be edited and closed again with a newly entered count and the normal close checks.
- CLOSED shifts are locked for trip, attachment, and ledger changes. Reopening is the correction path.
- Trips require positive finite cubic quantities and positive prices. Optional trip details are nullable in SQLite. Crusher and recipient status values have required matching receipt/name data.
- A fine is a fixed non-negative monetary amount with an optional reason. It can be edited only while the shift is OPEN or REOPENED; after close, reopen the shift to edit it. A fine does not change cubic quantities.

### Balances and accounting

- Client balance = opening balance + (reported client cubic × client price) − fines − client payments. A positive client balance means the client owes the business.
- Contractor balance = opening balance + (reported client cubic × transport price) + (crusher cubic × stone price) − signed ledger settlements. A positive contractor balance means the business owes the contractor.
- Opening balances are included in Accounts and Statements. `opening_balance_date` is informational and does not filter transactions.
- Prices at IPC boundaries use decimal pounds; money is persisted and summed as integer piasters. Each derived trip line rounds half-up before totals are summed.
- Contractor transport and material charges remain separate statement components. Material quantity is excluded from the contractor statement's total quantity.
- Ledger movements are `ADVANCE`, `PAYMENT`, and `OTHER`; signed non-zero amounts are allowed. A ledger row may be associated with a driver and shift; its contractor is required. Entries linked to a CLOSED shift cannot be created, changed, moved, or deleted.
- Client payments are signed non-zero amounts. The statement formula subtracts payment amounts, so a negative payment increases the client balance.
- Closing a shift creates no automatic ledger settlement.
- Statements contain opening balance, trip charges, fine adjustments, and payments; contractor statements show transport and material charges separately.

## 6. Routes and pages

| Route              | Page and purpose                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `/`                | `AddTripPage` — add a trip to the driver's OPEN shift                                                                |
| `/shifts`          | `ShiftsPage` — browse shifts, close and reopen shifts                                                                |
| `/shifts/:shiftId` | `ShiftDetailPage` — inspect a shift, manage trips and attachments                                                    |
| `/all-trips`       | `AllTripsPage` — browse trips across shifts                                                                          |
| `/accounts`        | `AccountsPage` — contractor account, driver history, client account, and all movements; page label is `حركة النقدية` |
| `/statements`      | `StatementsPage` — client and contractor statements                                                                  |
| `/settings`        | `SettingsPage` — vehicles, drivers, contractors, crushers, clients, material types                                   |

The wildcard route redirects to `/`. Shared renderer components include `DataTable`, `AttachmentManager`, `CreateShiftForm`, `LedgerEntryForm`, `TripDetailsContent`, `LedgerEntryDetailsContent`, `ShiftBreadcrumb`, `SubmitButton`, and the floating-window provider/components.

## 7. Verification

- `npm run verify:use-cases` bundles and invokes the real use cases under Electron-as-Node, uses an isolated temporary user-data directory, prints a result table and exits non-zero on failed cases.
- The use-case harness includes M1–M9 migration checks for fresh baseline equivalence, verified backups, migration rollback, version refusals, foreign-key rebuilds, backup failure, and refusal immutability. All fixtures use temporary directories.
- `npm run db:inspect -- <database-path>` opens a database read-only and reports its version, integrity, table row counts, and first/last Shift and Trip IDs. It never writes to the inspected database.
- `npm run test:e2e` builds the app and drives the real Electron app through five Playwright smoke flows: all routes and runtime/translation-key health; shift creation and duplicate-vehicle rejection; trip validation and detail labels; shift close/count/attachments; contractor-versus-client statement note.
- E2E fixtures and each app launch use temporary user-data directories.
- `npm run review:gate` runs diff check, typecheck, lint, and the use-case harness, then checks added diff lines for selected mechanical rules. `npm run review:gate:e2e` also runs Playwright. The gate does not use AI and writes `last-task.md`; the complete harness result table goes to ignored `scripts/last-harness-output.txt`.
- Automated checks do not replace user confirmation in Electron. Only checklist items explicitly marked `[x]` were confirmed by the user; unchecked scenarios remain pending.
- Human testing is required for pending manual checklist scenarios, visual usability, workflows outside the smoke flows, and real-device filesystem/backup behavior.

## 8. Open items

Priority order reflects user-visible correctness first, then operational risks and manual confirmation.

1. **High — IPC error visibility:** failed delete results and rejected IPC promises are not consistently surfaced to the user. Review `src/renderer/src/pages/` and `src/renderer/src/pages/AddTripPage.tsx`.
2. **High — ledger edit forms:** contractor and driver account pages retain separate manual edit forms rather than applying the shared locking rules consistently. Review `src/renderer/src/pages/accounts/ContractorAccountPage.tsx` and `src/renderer/src/pages/accounts/DriverHistoryPage.tsx`.
3. **High — migration definitions:** the ordered migration runner is present, but the numbered migrations list is empty; add a numbered migration with any future schema change. Review `src/main/migrations.ts`.
4. **Medium — account and statement details:** filtered table empty-state handling, account number formatting, and duplicated client-payment notes need attention. Review `src/renderer/src/components/DataTable.tsx`, `src/renderer/src/pages/accounts/AccountTables.tsx`, and `src/main/repository/statementRepository.ts`.
5. **Medium — async account loading:** rapid entity changes can race in account/history pages. Review `src/renderer/src/pages/accounts/ContractorAccountPage.tsx`, `src/renderer/src/pages/accounts/DriverHistoryPage.tsx`, and `src/renderer/src/pages/accounts/ClientAccountPage.tsx`.
6. **Medium — attachment throughput:** shift details can request many full attachment data URIs. Review `src/renderer/src/pages/ShiftDetailPage.tsx` and `src/renderer/src/components/AttachmentManager.tsx`.
7. **Medium — same-date ordering:** statement ordering for movements on one date needs an explicit, stable business order. Review `src/main/use-cases/getStatement.ts`.
8. **Low — locale maintenance:** six unused locale entries remain, and there is no automated missing-translation-key check. Review `src/renderer/src/i18n/locales/ar.json` and `src/renderer/src/i18n/`.
9. **Low — app packaging metadata:** boilerplate app metadata, window title, HTML language/direction, and app ID alignment need review. Review `package.json`, `src/renderer/index.html`, and `src/main/index.ts`.
10. **Pending manual confirmation:** edit a shift-linked ledger row to have no shift; save and confirm the shift is empty after reopening.
11. **Pending manual confirmation:** clear an allowed driver and ledger notes; save and confirm both remain empty after reopening.
12. **Pending manual confirmation:** edit only a ledger amount and confirm its shift, driver, contractor, and notes are preserved.
13. **Pending manual confirmation:** clear client-payment notes and confirm they remain empty after reopening.
14. **Pending manual confirmation:** edit only a client-payment amount and confirm its notes are preserved.
15. **Pending manual confirmation:** submit an invalid ledger combination and confirm a field error appears without a crash.
16. **Pending manual confirmation:** enter a client payment of -300 and confirm both Accounts and Statements increase the balance by 300.
17. **Pending manual confirmation:** enter a negative ledger amount and confirm it appears in driver history.
18. **Pending manual confirmation:** confirm amount zero is rejected with a field error.
19. **Pending manual confirmation:** edit a client payment to a negative amount.
20. **Pending manual confirmation:** reopen a CLOSED shift with a reason and confirm its badge and editability.
21. **Pending manual confirmation:** confirm reopen `shiftId` and `reason` errors appear beneath their controls.
22. **Pending manual confirmation:** add a forgotten trip and its attachment to a REOPENED shift from its detail page.
23. **Pending manual confirmation:** confirm reopened trip-count input has integer steps and a minimum of zero.
24. **Pending manual confirmation:** close a CLOSED shift with a count and confirm the already-closed `shiftId` error.
25. **Pending manual confirmation:** confirm a non-trip-field add-trip error appears and clears on resubmit or dialog close.
26. **Pending manual confirmation:** reject reopening with an empty reason.
27. **Pending manual confirmation:** start a new shift for the driver of a REOPENED shift.
28. **Pending manual confirmation:** re-close a reopened shift and confirm normal close checks and backup.
29. **Pending manual confirmation:** confirm an empty or wrong OPEN-shift close count produces a field error.
30. **Pending manual confirmation:** close with the correct count and confirm it is stored.
31. **Pending manual confirmation:** confirm the create-shift form has no reported-count field.
32. **Pending manual confirmation:** confirm a second OPEN shift on one vehicle is rejected.
33. **Pending manual confirmation:** confirm a trip price of zero is rejected beside its field.
34. **Pending manual confirmation:** confirm a negative trip price is rejected.
35. **Pending manual confirmation:** confirm an impossible date is rejected.
36. **Pending manual confirmation:** confirm a shift with zero default cubic is rejected.
37. **Pending manual confirmation:** verify create/update reject string, NaN, negative, and zero trip prices/cubics on the exact field without changing rows; quantities remain positive finite REAL values and unaffected by fines.
38. **Pending manual confirmation:** verify impossible trip/start/end dates show invalid-date errors and empty values show required errors.
39. **Pending manual confirmation:** create and edit a trip with empty optional renderer fields; confirm saves succeed and recipient status is sent as UNCLEAR.
40. **Pending manual confirmation:** confirm createShift rejects supplied reported count and zero, negative, or string defaults without inserting a row.
41. **Pending manual confirmation:** confirm a second OPEN shift is rejected, closing frees the vehicle, and REOPENED does not block a new shift.
42. **Pending manual confirmation:** confirm end-before-start leaves the shift unchanged and CLOSED-with-invalid-count returns the already-closed `shiftId` error first.
43. **Pending manual confirmation:** close an OPEN shift with a closing-sheet attachment and count zero; confirm CLOSED state and stored zero.
44. **Pending manual confirmation:** re-close with a new matching count and confirm it is stored.
45. **Pending manual confirmation:** re-close with a mismatched count and confirm the count-field error.
46. **Pending manual confirmation:** confirm the re-close input pre-fills stored count, or actual count when unset.
47. **Pending manual confirmation:** confirm a re-closed shift is locked against edits.
48. **Pending manual confirmation:** inspect `ShiftReopenLog` and confirm its latest `closed_again_at` timestamp.
49. **Pending manual confirmation:** reject a ledger entry assigned to a CLOSED shift beside its shift field.
50. **Pending manual confirmation:** reject amount edits on ledger entries linked to CLOSED shifts.
51. **Pending manual confirmation:** reject clearing the shift from a ledger entry linked to a CLOSED shift.
52. **Pending manual confirmation:** reject moving a ledger entry from an OPEN shift to a CLOSED shift.
53. **Pending manual confirmation:** accept an OTHER ledger entry without a shift when it has a contractor and note.
54. **Pending manual confirmation:** confirm trip details label every receipt and recipient status value correctly.
55. **Pending manual confirmation:** confirm ledger details display Advance and Payment correctly.
56. **Pending manual confirmation:** make the backup folder unwritable and confirm close succeeds with a visible warning.
57. **Pending manual confirmation:** confirm contractor statements show the sign note and client statements do not.
58. **Pending manual confirmation:** enter a fixed fine and reason; confirm a separate negative client statement row.
59. **Pending manual confirmation:** confirm a fine reduces client balance without changing reported cubic or client total cubic.
60. **Pending manual confirmation:** confirm contractor transport uses reported client cubic and material uses crusher cubic as separate components.
61. **Pending manual confirmation:** confirm opening balances appear in Accounts and Statements even when their date follows transactions.
62. **Pending manual confirmation:** reassign a vehicle's contractor and confirm old shift charges stay with its creation-time contractor snapshot.
63. **Pending manual confirmation:** confirm money inputs reject more than two decimals, accept 5.25 exactly, and renderer steps are 0.01.
64. **Pending manual confirmation:** confirm contractor statement total quantity excludes MATERIAL row quantity.
65. **Pending manual confirmation:** confirm all seven schema date columns reject impossible dates and nullable dates accept NULL.
66. **Pending manual confirmation:** confirm query plans use Trip(client_id), Shift(contractor_id), Ledger(driver_id), and Ledger(shift_id) indexes.
67. **Pending manual confirmation:** run the one-time development reset only after manual tests pass, following `docs/dev-reset-checklist.md`, and confirm the archived database with `npm run db:inspect`.

## 9. Locked decisions

- Contractor balance sign is the reverse of client sign under the shared formula: a positive contractor balance means the business owes the contractor. The client and contractor statement pages explain their meanings; calculations and colors remain as implemented.
- The Accounts page label is `حركة النقدية`.
- Execution order is B2 + B8, then B6 + B7, then the rest.
- Schema version 5 is the immutable accepted baseline. Future schema changes use numbered migrations; the app refuses unversioned databases, versions below baseline, and versions newer than its latest migration.
- Never delete a database during ordinary startup or migration. A development reset is a one-time manual procedure in `docs/dev-reset-checklist.md`, after manual tests pass and after an external archive is verified.
- A close-time reported trip count is required for OPEN and REOPENED shifts; neither stored nor actual count is a main-process fallback.
- If backup fails after close, closing still succeeds and the user sees a warning.
- Money uses no more than two decimals at input boundaries; derived line amounts use exact half-up rounding.
- Each trip has one fixed non-negative monetary fine and optional reason. It reduces client balance as a separate negative statement row and never changes cubic quantities or costs.
- Client charge = `client_cubic_reported × client_price`.
- Contractor transport = `client_cubic_reported × transport_price`; contractor material = `crusher_cubic × stone_price`; both increase contractor balance and remain separately displayed.
- Opening balances are included in Accounts and Statements; `opening_balance_date` is informational only.
- `Shift.contractor_id` snapshots the contractor when the shift is created; historical accounting uses that snapshot.
- Trip IDs are unique; gaps are allowed.
