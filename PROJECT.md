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
| `build-installer.bat`                   | Double-click to build the Windows installer and open `dist`  |
| `npm run review:gate`                   | Run checks and mechanical review rules; write `last-task.md` |
| `npm run review:gate:e2e`               | Run the review gate including the E2E suite                  |

## 3. Architecture

### Request and result flow

`renderer -> preload (window.api) -> ipcMain -> use-cases -> repositories -> SQLite`

- `src/main/index.ts` registers IPC handlers; `src/preload/index.ts` exposes `window.api`, and `src/preload/index.d.ts` types it.
- `trip:suggestPrices` validates the client, crusher, optional material type, and optional location, then reads independent price suggestions without writing data. Stone and client prices use material-specific history or their entity's initial price; transport uses client history with an exact-location preference.
- Electron requests a single-instance lock for the current `userData` path before startup opens the database. A second launch exits silently; the first window is restored, shown, and focused when available.
- `src/main/ipcWrapper.ts` converts thrown or rejected IPC handlers into the standard `_form` error result and logs the original error. Preload invocation rejections use the same failure result.
- The renderer shell fills the window; the navigation bar stays visible while table pages scroll inside their table viewport.
- `DataTable` provides internal scrolling with a sticky header. Headers and cells are centered. Text columns wrap, break long words, clamp to two lines, and expose their full displayed text in a hover title; columns without metadata use this behavior.
- Numeric, identifier, date, and action columns set `meta: { nowrap: true }` to stay on one line with tabular numerals. Sorting, filtering, selection, and sums continue to use the original row values.
- The 1366×768 layout keeps all tables within their containers. Shift details moves location, stone price, and transport price into `TripDetailsContent`; All Trips moves shift into that details window; All Movements moves shift into `LedgerEntryDetailsContent`. Other table columns remain visible, including every statement, settings, and client-payment column.
- `src/renderer/src/lib/numberFormat.ts` formats displayed money to two decimals and quantities to at most three decimals with en-US grouping and Latin digits.
- `src/renderer/src/lib/ipcErrors.ts` exports the shared `ipcApi`, translates unexpected IPC failures, and shows non-blocking notices for unhandled errors and failed deletes. Identical notices are suppressed for three seconds and parallel bursts are coalesced; field-level validation remains with each form. Successful trip creation and update use the same notice mechanism; success notices dismiss after three seconds.
- Use cases return `{ ok: true, data }` or `{ ok: false, errors }`, where each error has a `field` and `message`.
- Runtime validation is in main-process use cases and shared schemas/helpers in `src/main/validation.ts`; renderer forms also use Zod for immediate field feedback.
- Every user-visible renderer string comes from `src/renderer/src/i18n/locales/ar.json`. Do not hardcode user-visible text in renderer code.

### Money

- IPC and renderer monetary values are decimal pounds; SQLite monetary values are integer piasters.
- Main-process use cases convert values at the database boundary with helpers from `src/main/accounting.ts`.
- `src/main/accounting.ts` is the sole module for derived financial amounts. It performs half-up rounding per trip line and sums integer minor units.
- Cubic quantities are finite positive REAL values and are not money.

### File map

| File or directory                               | Responsibility                                                 |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `src/main/index.ts`                             | Electron startup, IPC handlers, window creation                |
| `src/main/ipcWrapper.ts`                        | IPC exception logging and standard failure results             |
| `src/main/db.ts`                                | Immutable version-5 schema baseline, safe opening, logging     |
| `src/main/migrations.ts`                        | Ordered numbered migrations and verified pre-migration backups |
| `src/main/validation.ts`                        | Shared date, number, and money validation                      |
| `src/main/accounting.ts`                        | Money conversion, per-line rounding, account calculations      |
| `src/main/backup.ts`                            | Verified snapshots, attachment mirror, retention, and status   |
| `src/main/photoStorage.ts`                      | JPEG storage under Electron `userData`                         |
| `src/main/use-cases/`                           | Validated business operations and result contracts             |
| `src/main/repository/`                          | SQLite reads, writes, and transactions                         |
| `src/main/use-cases/suggestTripPrices.ts`       | Read-only material-keyed and location-aware price suggestions  |
| `src/preload/index.ts`                          | Typed IPC bridge exposed as `window.api`                       |
| `src/preload/index.d.ts`                        | Renderer-facing API and row types                              |
| `src/renderer/src/App.tsx`                      | HashRouter routes and active navigation                        |
| `src/renderer/src/pages/`                       | Main pages and settings/account subpages                       |
| `src/renderer/src/components/`                  | Shared forms, scrollable tables, dialogs, details, attachments |
| `src/renderer/src/components/TripEntryGrid.tsx` | In-memory multi-trip entry grid for one shift                  |
| `src/renderer/src/lib/enumLabels.ts`            | Shared labels for stored enum values                           |
| `src/renderer/src/lib/ipcErrors.ts`             | Shared IPC API, error and success notices                      |
| `src/renderer/src/lib/latestGuard.ts`           | Reject stale asynchronous selection-load results               |
| `src/renderer/src/lib/numberFormat.ts`          | Shared display-only money and quantity formatting              |
| `src/renderer/src/lib/tripGrid.ts`              | Pure trip-grid parsers, name resolution, payloads, and errors  |
| `src/renderer/src/i18n/`                        | Arabic translation setup and locale                            |
| `scripts/verify-closed-shift-use-cases.cjs`     | Isolated real-use-case verification harness                    |
| `scripts/db-inspect.cjs`                        | Read-only database integrity and row-count inspection          |
| `scripts/review-gate.cjs`                       | Automated checks, mechanical rules, and task report            |
| `docs/dev-reset-checklist.md`                   | One-time manual development database reset procedure           |
| `docs/manual-checklist.md`                      | Unchecked manual confirmation scenarios                        |
| `docs/restore.md`                               | Database and attachment backup restoration steps               |
| `playwright.config.ts`                          | Playwright Electron test configuration                         |
| `e2e/seed.cjs`                                  | Isolated E2E fixture seeding through Electron as Node          |
| `e2e/smoke.spec.cjs`                            | Seven end-to-end smoke flows                                   |

## 4. Data model

The production schema in `src/main/db.ts` is an immutable version-5 baseline. A fresh database executes that baseline and then all numbered migrations in order. The real migration list is empty, so the latest supported version is currently 5. The database is `app.getPath('userData')/shift-tracker.db`.

Opening rules are based on `PRAGMA user_version` and user-table presence:

- Version 0 with no user tables creates the baseline and sets version 5 in one transaction, then applies pending migrations.
- Version 0 with user tables is refused as unversioned.
- Versions 1–4 are refused as unsupported development schemas.
- Versions from the baseline through latest-minus-one require a verified database-only backup before stepwise migrations.
- The latest version opens normally. Versions above latest are refused as newer than the app.
- Refusals do not modify or delete the database, sidecars, or data directory. The dialog asks the user to archive the data folder and gives its path and found version.
- Migration backups use `userData/backups/pre-migration-v<from>-to-v<to>-<timestamp>.db`. A backup is opened read-only and must pass `integrity_check` and match the source version before any migration starts; a backup that fails verification is deleted.
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
- Post-close snapshots are written to `userData/backups/db/post-close-<timestamp>-<shiftId>.db`; the first successful daily snapshot is `daily-<YYYY-MM-DD>.db` using the local date.
- Snapshots are created with `VACUUM INTO`, then opened read-only and verified with `integrity_check` and `user_version`. Failed snapshots are deleted and reported.
- `userData/backups/attachments/` mirrors files from `userData/docs/attachments` asynchronously with a concurrency limit of four. Missing and different-size files are copied; equal-size files are skipped, and mirror files are never deleted.
- After a successful snapshot, retention keeps the newest 60 daily and 120 post-close snapshots. Pre-migration snapshots, legacy directories, and unrecognized files are preserved.
- A non-blocking daily snapshot and attachment sync run after the window is created. Backup status is persisted at `userData/backups/status.json`; the renderer displays one warning when the last operation failed or the latest success is over three days old.
- Backups share the app data disk; copy them to external storage to protect against disk failure. See `docs/restore.md` for database and attachment recovery.
- Only a CLOSED shift can be reopened; a non-empty reason is required and recorded in `ShiftReopenLog`. Reopened shifts can be edited and closed again with a newly entered count and the normal close checks.
- CLOSED shifts are locked for trip, attachment, and ledger changes. Reopening is the correction path.
- Trips require positive finite cubic quantities and positive prices. Optional trip details are nullable in SQLite. Crusher and recipient status values have required matching receipt/name data.
- The Add Trip page selects one driver's OPEN shift with latest-request protection and enters trips in an in-memory grid. Core columns are always visible; receipt number, recipient, location, and fine details are optional columns. New rows inherit only the prior row's date and the shift cubic defaults.
- Unsaved grid rows exist only in renderer memory and are discarded when navigating away.
- Grid name cells resolve exact matches after whitespace/case normalization and Arabic normalization (alef forms, alef maqsura, ta marbuta, diacritics, and tatweel). Normalized collisions are rejected as ambiguous; unknown text remains unresolved, and the typed cell text is preserved. Number cells accept optional dot decimals and normalized Arabic digits/separators; only money cells accept valid thousands grouping, and money permits at most two decimal places. Cubic cells reject all commas and show a non-blocking amber hint above 150. Date cells accept real `YYYY-MM-DD` and `D/M/YYYY` dates.
- Pasting tab-separated rows supports quoted cells, skips a recognized header, ignores wholly empty lines, and ignores a trailing newline.
- Crusher receipt cells map blank to `UNKNOWN`, a positive integer to `PROVIDED`, and `-` to `CONFIRMED_MISSING`; recipient cells map blank to `UNCLEAR` and text to `PROVIDED`. Duplicate crusher/receipt pairs within the grid are blocked before saving.
- Prices are suggested independently by key. The nearest earlier grid row with a matching key takes precedence; otherwise the corresponding server suggestion is used. Unedited suggestions refresh or clear when their key changes, while user-edited prices are never overwritten. Results are cached in memory per request key and the cache is cleared after saving.

| Price     | Trip-history key                      | Default and fallback                                                 |
| --------- | ------------------------------------- | -------------------------------------------------------------------- |
| Stone     | Crusher + material type               | Crusher initial price; material type is not required for the default |
| Client    | Client + material type                | Client initial price; material type is not required for the default  |
| Transport | Client + exact location when supplied | Latest trip for the client when no location match exists             |

Trip history ordering uses the greatest trip date, then the greatest numeric trip ID. Trips with no material type do not match material-keyed prices. Suggestion results carry a source for each price (`LAST_TRIP`, `DEFAULT`, or `null` as applicable); `DEFAULT` source metadata is tracked internally by the grid without a separate UI indicator. Saving valid rows is sequential and guarded against re-entrant submissions; successful rows disappear after saving and failed rows remain with mapped errors.

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
- Statement notes show payment notes on payment rows, trip notes on client CHARGE and contractor TRANSPORT rows, and the fine reason on client FINE rows. Contractor MATERIAL rows and OPENING rows have no notes; a trip note appears only once in contractor statements.

## 6. Routes and pages

| Route              | Page and purpose                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `/`                | `AddTripPage` — select a driver and enter multiple trips for one OPEN shift                                          |
| `/shifts`          | `ShiftsPage` — browse shifts, close and reopen shifts                                                                |
| `/shifts/:shiftId` | `ShiftDetailPage` — inspect a shift, manage trips and attachments; successful trip deletion shows a notice           |
| `/all-trips`       | `AllTripsPage` — browse trips across shifts; inspect or delete a trip                                                |
| `/accounts`        | `AccountsPage` — contractor account, driver history, client account, and all movements; page label is `حركة النقدية` |
| `/statements`      | `StatementsPage` — client and contractor statements                                                                  |
| `/settings`        | `SettingsPage` — vehicles, drivers, contractors, crushers, clients, material types                                   |

The wildcard route redirects to `/`. Every page has a visible title; the active top-navigation link is highlighted and marked with `aria-current="page"`. Shared renderer components include `DataTable` (centered cells, text wrapping, nowrap column metadata, an internal scroll viewport, and a sticky header), `TripEntryGrid`, `AttachmentManager`, `CreateShiftForm`, `LedgerEntryForm`, `TripDetailsContent`, `LedgerEntryDetailsContent`, `ShiftBreadcrumb`, `SubmitButton`, and the floating-window provider/components.

## 7. Verification

- `npm run verify:use-cases` bundles and invokes the real use cases under Electron-as-Node, uses an isolated temporary user-data directory, prints a result table and exits non-zero on failed cases.
- The use-case harness verifies P1–P9 for trip-price suggestions and G1–G9 for pure trip-grid behavior, alongside the shift, trip, ledger, accounting, and migration cases.
- The use-case harness includes M1–M9 migration checks and BK-1–BK-8 backup checks for snapshot verification, attachment mirroring, daily snapshots, retention, close warnings, and status persistence. All fixtures use temporary directories.
- `npm run db:inspect -- <database-path>` opens a database read-only and reports its version, integrity, table row counts, and first/last Shift and Trip IDs. It never writes to the inspected database.
- `npm run test:e2e` builds the app and drives the real Electron app through seven Playwright smoke flows: all routes and runtime/translation-key health; shift creation and duplicate-vehicle rejection; trip-grid validation and detail labels; partial grid save with a server-rejected row; shift close/count/attachments; contractor-versus-client statement note; and refusal of a second instance while the first remains responsive.
- E2E fixtures and each app launch use temporary user-data directories.
- `npm run review:gate` runs diff check, typecheck, lint, and the use-case harness, then checks added diff lines for selected mechanical rules. `npm run review:gate:e2e` also runs Playwright. The gate does not use AI and writes `last-task.md`; the complete harness result table goes to ignored `scripts/last-harness-output.txt`.
- Automated checks do not replace user confirmation in Electron. Only checklist items explicitly marked `[x]` were confirmed by the user; unchecked scenarios remain pending.
- Human testing is required for pending manual checklist scenarios, visual usability, workflows outside the smoke flows, and real-device filesystem/backup behavior.

## 8. Open items

- **OI-001 — High, ledger edit forms:** contractor and driver account pages retain separate manual edit forms rather than applying the shared locking rules consistently. Review `src/renderer/src/pages/accounts/ContractorAccountPage.tsx` and `src/renderer/src/pages/accounts/DriverHistoryPage.tsx`.
- **OI-002 — Medium, account and statement details:** filtered-table empty-state handling and duplicated client-payment notes need attention. Review `src/renderer/src/components/DataTable.tsx`, `src/renderer/src/pages/accounts/AccountTables.tsx`, and `src/main/repository/statementRepository.ts`.
- **OI-003 — Medium, attachment throughput:** shift details can request many full attachment data URIs. Review `src/renderer/src/pages/ShiftDetailPage.tsx` and `src/renderer/src/components/AttachmentManager.tsx`.
- **OI-004 — Medium, same-date ordering:** statement ordering for movements on one date needs an explicit, stable business order. Review `src/main/use-cases/getStatement.ts`.
- **OI-005 — Low, locale maintenance:** unused locale entries remain, and there is no automated missing-translation-key check. Review `src/renderer/src/i18n/locales/ar.json` and `src/renderer/src/i18n/`.
- **OI-006 — Low, app packaging metadata:** boilerplate app metadata, window title, HTML language/direction, and app ID alignment need review. Review `package.json`, `src/renderer/index.html`, and `src/main/index.ts`.
- **OI-007 — Low, Add Trip grid manual confirmation:** typing, paste, suggestions, keyboard behavior, server-error retention, driver switching, and laptop fit remain unchecked; scenarios are listed in `docs/manual-checklist.md`.
- **OI-008 — Medium, E2E coverage:** expand automated coverage according to `docs/e2e-coverage-plan.md`.
- **OI-009 — Medium, E2E coverage:** expand E2E coverage per `docs/e2e-coverage-plan.md`.
- **OI-010 — Low, table layout manual confirmation:** confirm two-line text wrapping, full-text hover titles, centered headers and cells, laptop fit, and unchanged sorting, filtering, and sums using `docs/manual-checklist.md`.
- **OI-011 — Low, installer helper manual confirmation:** double-click `build-installer.bat` and confirm it builds the installer, opens `dist`, and leaves failures visible.
- **OI-012 — Low, trip deletion manual confirmation:** delete a trip from Shift Details and All Trips; confirm the success notice and that the deleted trip disappears from the list. In All Trips, confirm Delete is hidden for trips in CLOSED shifts and the locked label is shown.

Manual confirmation scenarios are listed unchecked by area in `docs/manual-checklist.md`.

## 9. Decisions

- Contractor balance sign is the reverse of client sign under the shared formula: a positive contractor balance means the business owes the contractor. The client and contractor statement pages explain their meanings; calculations and colors remain as implemented.
- The Accounts page label is `حركة النقدية`.
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
