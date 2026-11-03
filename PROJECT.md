# Shift Tracker

## 1. Purpose and scale

- Offline, single-machine Windows desktop application for a stone-hauling business.
- Supports about 2,000 trips per year.
- Arabic right-to-left (RTL) user interface.

## 2. Stack and commands

| Area         | Current implementation                                                                       |
| ------------ | -------------------------------------------------------------------------------------------- |
| Desktop      | Electron, `electron-vite`, React, TypeScript                                                 |
| Database     | SQLite through `better-sqlite3`                                                              |
| UI           | React Router, React Hook Form, Zod, TanStack Table, TanStack Virtual, Radix UI, Tailwind CSS |
| Localization | `react-i18next`; Arabic locale in `src/renderer/src/i18n/locales/ar.json`                    |

| Command                                  | Purpose                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                            | Start the development app                                          |
| `npm run build`                          | Type-check and build the app                                       |
| `npm run typecheck`                      | Check node and web TypeScript projects                             |
| `npm run lint`                           | Lint the repository with zero warnings allowed                     |
| `npm run check:i18n`                     | Check static/dynamic Arabic translation references and unused keys |
| `npm run verify:use-cases`               | Run the isolated use-case and SQLite verification harness          |
| `npm run db:inspect -- <database-path>`  | Inspect a database read-only through Electron as Node              |
| `npm run test:e2e`                       | Build the app and run the Playwright Electron smoke suite          |
| `node scripts/benchmark-large-table.cjs` | Run the one-off large-table performance benchmark                  |
| `npm run build:unpack`                   | Build an unpacked Windows app for packaging checks                 |
| `build-installer.bat`                    | Double-click to build the Windows installer and open `dist`        |
| `npm run review:gate`                    | Run checks and mechanical review rules; write `last-task.md`       |
| `npm run review:gate:e2e`                | Run the review gate including the E2E suite                        |

## 3. Architecture

### Request and result flow

`renderer -> preload (window.api) -> ipcMain -> use-cases -> repositories -> SQLite`

- `src/main/index.ts` registers IPC handlers; `src/preload/index.ts` exposes `window.api`, and `src/preload/index.d.ts` types it.
- The main process exposes DraftTrip CRUD, transactional promotion to Trip, and open-shift dashboard cards through dedicated IPC channels.
- `trip:suggestPrices` validates the client, crusher, optional material type, and optional location, then reads independent price suggestions without writing data. Stone and client prices use material-specific history or their entity's initial price; transport uses client history with an exact-location preference.
- Material type is required to save a trip (grid, single-trip form, server); it is optional only as an input for price suggestions.
- Electron requests a single-instance lock for the current `userData` path before startup opens the database. A second launch exits silently; the first window is restored, shown, and focused when available.
- The renderer window uses context isolation and sandboxing without Node integration. Popup requests are denied, and main-frame navigation and redirects are limited to the renderer entry URL.
- The window opens at 1366×768 with a 1024×640 minimum, stays hidden until `ready-to-show`, and uses the existing installer app ID `com.electron.app` as its Windows App User Model ID.
- The HTML document declares Arabic RTL metadata and receives its title from the Arabic app subtitle at build time. Windows/NSIS is the configured installer target; `appId` remains `com.electron.app`.
- `src/main/ipcWrapper.ts` converts thrown or rejected IPC handlers into the standard `_form` error result and logs the original error. Preload invocation rejections use the same failure result.
- The renderer shell fills the window; the navigation bar stays visible while table pages scroll inside their table viewport. Navigation links expose `aria-current` for the active route, but the active visual highlight is not applied.
- `DataTable` provides internal scrolling with a sticky header. Headers and cells are centered. Text columns wrap, break long words, clamp to two lines, and expose their full displayed text in a hover title; columns without metadata use this behavior.
- Scrollbars are styled globally in `src/renderer/src/assets/main.css` using theme foreground tokens.
- Tables with more than 200 filtered rows virtualize mounted rows. Sorting and distinct-value filtering still cover all loaded rows, while selection and sums cover all filtered selected rows, not only mounted rows.
- Numeric, identifier, date, and action columns set `meta: { nowrap: true }` to stay on one line with tabular numerals.
- `AttachmentManager` fetches an image data URI only when its thumbnail enters view. A shared three-request limit bounds attachment-photo IPC reads, and stale component requests cannot update replaced views.
- Trip receipt sections stack vertically in the fixed-layout Shift Details table so each section's preview and delete controls remain inside its pointer hit area at the default and minimum window sizes.
- The 1366×768 layout keeps all tables within their containers. Shift details moves location, stone price, and transport price into `TripDetailsContent`; All Trips moves shift into that details window; All Movements moves shift into `LedgerEntryDetailsContent`. Other table columns remain visible, including every statement, settings, and client-payment column.
- `src/renderer/src/lib/numberFormat.ts` formats displayed money to two decimals and quantities to at most three decimals with en-US grouping and Latin digits.
- `src/renderer/src/lib/ipcErrors.ts` exports the shared `ipcApi`, converts rejected IPC invocations to the standard `_form` failure result, translates unexpected IPC failures, and shows non-blocking notices for unhandled errors and failed deletes. Identical notices are suppressed for three seconds and parallel bursts are coalesced; field-level validation remains with each form. Successful trip creation and update use the same notice mechanism; success notices dismiss after three seconds.
- Use cases return `{ ok: true, data }` or `{ ok: false, errors }`, where each error has a `field` and `message`.
- Runtime validation is in main-process use cases and shared schemas/helpers in `src/main/validation.ts`; renderer forms also use Zod for immediate field feedback.
- Every user-visible renderer string comes from `src/renderer/src/i18n/locales/ar.json`. Do not hardcode user-visible text in renderer code.

### Money

- IPC and renderer monetary values are decimal pounds; SQLite monetary values are integer piasters.
- Main-process use cases convert values at the database boundary with helpers from `src/main/accounting.ts`.
- `src/main/accounting.ts` is the sole module for derived financial amounts. It performs half-up rounding per trip line and sums integer minor units.
- Cubic quantities are finite positive REAL values and are not money.

### File map

| File or directory                                            | Responsibility                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `src/main/index.ts`                                          | Electron startup, IPC handlers, window creation                                                |
| `src/main/ipcWrapper.ts`                                     | IPC exception logging and standard failure results                                             |
| `src/main/db.ts`                                             | Current schema, version-0 fresh databases, safe opening, logging                               |
| `src/main/migrations.ts`                                     | Empty migration stub                                                                           |
| `src/main/validation.ts`                                     | Shared date, number, and money validation                                                      |
| `src/main/accounting.ts`                                     | Money conversion, per-line rounding, account calculations                                      |
| `src/main/backup.ts`                                         | Verified snapshots, attachment mirror, retention, and status                                   |
| `src/main/photoStorage.ts`                                   | JPEG storage under Electron `userData`                                                         |
| `src/main/use-cases/`                                        | Validated business operations and result contracts                                             |
| `src/main/repository/`                                       | SQLite reads, writes, and transactions                                                         |
| `src/main/repository/draftTripRepository.ts`                 | DraftTrip CRUD and open-shift context                                                          |
| `src/main/repository/dashboardRepository.ts`                 | Open-shift cards and custody/trip counts                                                       |
| `src/main/use-cases/draftTrip.ts`                            | Validated DraftTrip CRUD                                                                       |
| `src/main/use-cases/promoteDraftTrip.ts`                     | Atomic DraftTrip promotion with optional or automatic custody                                  |
| `src/main/use-cases/getDashboard.ts`                         | Dashboard open-shift query                                                                     |
| `src/main/use-cases/suggestTripPrices.ts`                    | Read-only material-keyed and location-aware price suggestions                                  |
| `src/preload/index.ts`                                       | Typed IPC bridge exposed as `window.api`                                                       |
| `src/preload/index.d.ts`                                     | Renderer-facing API and row types                                                              |
| `src/renderer/src/App.tsx`                                   | HashRouter routes and active navigation                                                        |
| `src/renderer/src/pages/`                                    | Main pages and settings/account subpages                                                       |
| `src/renderer/src/pages/DashboardPage.tsx`                    | Dashboard open-shift cards, draft details, and promotion workflow                             |
| `src/renderer/src/pages/DashboardDraftGrid.tsx`                | Inline editable DraftTrip grid and row actions                                                 |
| `src/renderer/src/components/`                               | Shared forms, scrollable tables, dialogs, details, attachments                                 |
| `src/renderer/src/components/TripEntryGrid.tsx`              | In-memory multi-trip grid composition for one shift                                            |
| `src/renderer/src/components/trip-entry-grid/`               | Grid row/cell rendering, navigation, validation, suggestions, and save hooks                   |
| `src/renderer/src/components/ConfirmDialog.tsx`              | Shared promise-based, RTL confirmation dialog and hook                                         |
| `src/renderer/src/pages/TripForm.tsx`                        | Add Trip form and typed field rendering                                                        |
| `src/renderer/src/pages/tripFormSchema.ts`                   | Add Trip form schema and typed values                                                          |
| `src/renderer/src/pages/NumberField.tsx`                     | Shared numeric input for Add Trip fields                                                       |
| `src/renderer/src/pages/useAddTripPage.ts`                   | Add Trip selection, loading, and save orchestration                                            |
| `src/renderer/src/pages/ShiftsDialogs.tsx`                   | Shift create, edit, close, and reopen dialogs                                                  |
| `src/renderer/src/pages/useShiftsPageData.ts`                | Shift list loading and page data actions                                                       |
| `src/renderer/src/pages/ShiftTripDialogs.tsx`                | Shift Details add/edit trip dialogs                                                            |
| `src/renderer/src/pages/useShiftDetailPage.ts`               | Shift Details data loading and trip mutations                                                  |
| `src/renderer/src/components/LedgerEntryDialog.tsx`          | Shared ledger add/edit dialog and form                                                         |
| `src/renderer/src/pages/accounts/useLedgerEntryMutations.ts` | Shared ledger create, update, delete, locking, and refresh logic                               |
| `src/renderer/src/pages/settings/useSettingsCrud.ts`         | Shared settings list loading, CRUD, confirmation, and form state                               |
| `src/renderer/src/pages/settings/SettingsEntityPage.tsx`     | Shared settings table, actions, and form dialog shell                                          |
| `src/renderer/src/pages/settings/settingsFormSchemas.ts`     | Settings form schemas and entity types                                                         |
| `src/renderer/src/pages/settings/*SettingsFields.tsx`        | Entity-specific settings form fields                                                           |
| `src/renderer/src/lib/enumLabels.ts`                         | Shared labels for stored enum values                                                           |
| `src/renderer/src/lib/ipcErrors.ts`                          | Shared IPC API, error and success notices                                                      |
| `src/renderer/src/lib/latestGuard.ts`                        | Reject stale asynchronous selection-load results                                               |
| `src/renderer/src/lib/numberFormat.ts`                       | Shared display-only money and quantity formatting                                              |
| `src/renderer/src/lib/tripGrid.ts`                           | Pure trip-grid parsers, name resolution, payloads, and errors                                  |
| `src/renderer/src/i18n/`                                     | Arabic translation setup and locale                                                            |
| `scripts/verify-closed-shift-use-cases.cjs`                  | Electron-as-Node bootstrap for the isolated use-case harness                                   |
| `scripts/verify/entry.ts`                                    | Shared harness setup and ordered suite execution                                               |
| `scripts/verify/`                                            | Per-area shift, trip, ledger, accounting, statement, migration, backup, grid, and price suites |
| `scripts/db-inspect.cjs`                                     | Read-only database integrity and row-count inspection                                          |
| `scripts/review-gate.cjs`                                    | Automated checks, mechanical rules, and task report                                            |
| `scripts/check-i18n.cjs`                                     | Check translation references and unused Arabic locale keys                                     |
| `docs/dev-reset-checklist.md`                                | One-time manual development database reset procedure                                           |
| `docs/e2e-test-cases.md`                                     | Concrete E2E test cases and expected results                                                   |
| `docs/manual-checklist.md`                                   | Unchecked manual confirmation scenarios                                                        |
| `docs/restore.md`                                            | Database and attachment backup restoration steps                                               |
| `playwright.config.ts`                                       | Playwright Electron test configuration                                                         |
| `e2e/seed.cjs`                                               | Isolated E2E fixture seeding through Electron as Node                                          |
| `e2e/smoke.spec.cjs`                                         | Eight end-to-end smoke flows                                                                   |
| `e2e/add-trip.spec.cjs`                                      | Add Trip driver, grid, suggestions, and persistence flows                                      |
| `e2e/settings.spec.cjs`                                      | Settings CRUD and validation flows for six entity types                                        |
| `scripts/verify/settings.cjs`                                | Main-process settings validation and phone-format cases                                        |

## 4. Data model

The production schema is defined in `src/main/db.ts`. A fresh database executes the complete schema and remains at `PRAGMA user_version = 0`; there is no migration history. The database is `app.getPath('userData')/shift-tracker.db`.

Opening rules are based on `PRAGMA user_version` and user-table presence:

- Version 0 with no user tables creates the current schema in one transaction and keeps version 0.
- Version 0 with the complete current schema opens normally; a version-0 database with a partial or unknown schema is refused as unversioned.
- Any positive version is refused; archive the data folder and remove the old database manually before using this fresh-install build.
- Refusals do not modify or delete the database, sidecars, or data directory. The dialog asks the user to archive the data folder and gives its path and found version.
- Foreign-key enforcement is enabled before schema creation and remains enabled after opening.

In the table below, `NOT NULL` means required; columns without it are nullable unless they are primary keys. `INTEGER` money is piasters. Foreign keys are noted as `REFERENCES`.

| Table                 | Columns, SQL types, nullability, and checks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TripIdCounter`       | `id INTEGER PRIMARY KEY CHECK (id = 1)`; `next_number INTEGER NOT NULL`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `TransportContractor` | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`; `phone TEXT`; `opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (typeof(...) = 'integer')`; `opening_balance_date TEXT` nullable, valid real `YYYY-MM-DD` when set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `Vehicle`             | `vehicle_no INTEGER PRIMARY KEY`; `trailer_no INTEGER NOT NULL`; `contractor_id INTEGER NOT NULL REFERENCES TransportContractor(id)`; `default_cubic REAL`; `owner_name TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Driver`              | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`; `phone1 TEXT`; `phone2 TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `Crusher`             | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`; `initial_price INTEGER` nullable, positive integer when set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `Client`              | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`; `initial_price INTEGER` nullable, positive integer when set; `location TEXT`; `opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (typeof(...) = 'integer')`; `opening_balance_date TEXT` nullable, valid real `YYYY-MM-DD` when set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `MaterialType`        | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `name TEXT NOT NULL UNIQUE`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Shift`               | `id TEXT PRIMARY KEY`; `vehicle_no INTEGER NOT NULL REFERENCES Vehicle(vehicle_no)`; `driver_id INTEGER NOT NULL REFERENCES Driver(id)`; `contractor_id INTEGER NOT NULL REFERENCES TransportContractor(id)` (creation-time snapshot); `crusher_cubic_default REAL NOT NULL`; `client_cubic_default REAL NOT NULL`; `start_date TEXT NOT NULL`; `end_date TEXT`; `status TEXT NOT NULL CHECK (OPEN, CLOSED, REOPENED)`; `reported_destination TEXT`; `reported_trip_count INTEGER`; `notes TEXT`; defaults must be finite and positive; start/end dates must be real `YYYY-MM-DD` when set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `ShiftReopenLog`      | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `shift_id TEXT NOT NULL REFERENCES Shift(id)`; `reopened_at TEXT NOT NULL`; `reason TEXT NOT NULL CHECK (length(trim(reason)) > 0)`; `previous_end_date TEXT`; `closed_again_at TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `Trip`                | `id TEXT PRIMARY KEY`; `shift_id TEXT NOT NULL REFERENCES Shift(id)`; `trip_date TEXT NOT NULL` and valid real `YYYY-MM-DD`; nullable `time_of_day` (`MORNING`, `EVENING`); `crusher_cubic REAL NOT NULL`; `client_cubic_reported REAL NOT NULL`; `fine_amount INTEGER NOT NULL DEFAULT 0` and non-negative integer; `fine_reason TEXT`; `location TEXT`; `crusher_id INTEGER NOT NULL REFERENCES Crusher(id)`; `stone_price INTEGER NOT NULL` positive integer; `crusher_receipt_status TEXT NOT NULL CHECK (PROVIDED, CONFIRMED_MISSING, UNKNOWN)`; `crusher_receipt_no INTEGER`; `client_id INTEGER NOT NULL REFERENCES Client(id)`; `transport_price INTEGER NOT NULL` positive integer; `client_price INTEGER NOT NULL` positive integer; `recipient_name_status TEXT NOT NULL DEFAULT 'UNCLEAR' CHECK (PROVIDED, UNCLEAR)`; `recipient_name TEXT`; `client_receipt_no TEXT`; `notes TEXT`; `material_type_id INTEGER REFERENCES MaterialType(id)`; cubic quantities must be finite and positive; PROVIDED receipt requires a number and other receipt states require NULL; PROVIDED recipient requires a name and UNCLEAR requires NULL |
| `Attachment`          | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `entity_type TEXT NOT NULL CHECK (TRIP, SHIFT, LEDGER)`; `entity_id TEXT NOT NULL` (polymorphic, no FK); `kind TEXT NOT NULL CHECK (CRUSHER_RECEIPT, CLIENT_RECEIPT, CLOSING_SHEET, TRANSFER_RECEIPT)`; `photo_path TEXT NOT NULL`; `created_at TEXT NOT NULL DEFAULT datetime('now')`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `DraftTrip`           | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `vehicle_no INTEGER NOT NULL REFERENCES Vehicle(vehicle_no)`; `trip_date TEXT NOT NULL` with `YYYY-MM-DD` shape check; nullable `time_of_day` (`MORNING`, `EVENING`); nullable `crusher_id REFERENCES Crusher(id)` and `client_id REFERENCES Client(id)`; nullable positive finite `cubic`; nullable positive integer `custody_amount`; nullable `custody_date` with real `YYYY-MM-DD` check and nullable `custody_time` with `HH:MM` check; nullable `receipt_note` and `notes`; `created_at TEXT NOT NULL DEFAULT datetime('now')`; index on `vehicle_no`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Ledger`              | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `entry_date TEXT NOT NULL` and valid real `YYYY-MM-DD`; nullable `entry_time` with `HH:MM` check; `driver_id INTEGER REFERENCES Driver(id)`; `movement_type TEXT NOT NULL CHECK (ADVANCE, PAYMENT, OTHER)`; `amount INTEGER NOT NULL` non-zero integer; `shift_id TEXT REFERENCES Shift(id)`; `contractor_id INTEGER NOT NULL REFERENCES TransportContractor(id)`; `notes TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ClientPayment`       | `id INTEGER PRIMARY KEY AUTOINCREMENT`; `entry_date TEXT NOT NULL` and valid real `YYYY-MM-DD`; `client_id INTEGER NOT NULL REFERENCES Client(id)`; `amount INTEGER NOT NULL` non-zero integer; `notes TEXT`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

Date columns use shape checks, and transaction dates use SQLite calendar-validity checks. Nullable dates accept NULL.

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
- Closing an `OPEN` or `REOPENED` shift requires no DraftTrips for its vehicle, an explicitly supplied non-negative integer reported trip count equal to the actual trip count, an end date not before its start date, a valid closing-sheet file, and at least one attachment on every trip.
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
- Contractor Account, Driver History, and All Movements use the same ledger dialog and mutation hook. Ledger shift selectors only offer shifts that are not CLOSED; errors for a missing or newly locked entry appear beside the shift selector.
- Trips require positive finite cubic quantities and positive prices. Optional trip details are nullable in SQLite. Crusher and recipient status values have required matching receipt/name data. Material type is required to save a trip (grid, single-trip form, server); it is optional only as an input for price suggestions.
- The Add Trip page selects one driver's OPEN shift with latest-request protection and enters trips in an in-memory grid. Core columns include trip date, time of day, crusher/client/material, quantities, prices, receipt state, and notes; receipt number, recipient, location, and fine details are optional columns. New rows inherit only the prior row's date and the shift cubic defaults.
- Unsaved grid rows exist only in renderer memory and are discarded when navigating away.
- DraftTrips persist separately from Trips, are listed with the vehicle's OPEN-shift driver and crusher/client names, and can be created, updated, deleted, or promoted. Promotion creates the Trip and any draft or review-form ADVANCE custody entry, then deletes the draft in one transaction; explicit `custody: null` suppresses automatic custody creation. Trip time of day defaults to the draft value when omitted.
- The dashboard is the home route and contains open-shift cards plus a compact, editable DraftTrip grid. Draft details include custody date/time; promotion reviews custody explicitly and pre-fills trip details from the draft without mapping free-text receipt notes into structured receipt fields.
- Ledger entries support nullable entry times, shown alongside dates, and optional `TRANSFER_RECEIPT` attachments managed from entry details. Ledger attachments require the entry to exist and follow the linked shift's closed-state rules; deleting an entry removes its attachment rows and stored files.
- Dashboard open-shift cards include shift age, trip and draft counts, the latest shift-linked ADVANCE amount/date/time, and trips since that advance. The latest custody row is selected by date, time (NULL last), then ledger ID.
- Grid name cells resolve exact matches after whitespace/case normalization and Arabic normalization (alef forms, alef maqsura, ta marbuta, diacritics, and tatweel). Normalized collisions are rejected as ambiguous; unknown text remains unresolved, and the typed cell text is preserved. Number cells accept optional dot decimals and normalized Arabic digits/separators; only money cells accept valid thousands grouping, and money permits at most two decimal places. Cubic cells reject all commas and show a non-blocking amber hint above 150. Date cells accept real `YYYY-MM-DD` and `D/M/YYYY` dates.
- Pasting tab-separated rows supports quoted cells, skips a recognized header, ignores wholly empty lines, and ignores a trailing newline.
- Crusher receipt cells map blank to `UNKNOWN`, a positive integer to `PROVIDED`, and `-` to `CONFIRMED_MISSING`; recipient cells map blank to `UNCLEAR` and text to `PROVIDED`. Duplicate crusher/receipt pairs within the grid are blocked before saving.
- Prices are suggested independently by key. The nearest earlier grid row with a matching key takes precedence; otherwise the corresponding server suggestion is used. Unedited suggestions refresh or clear when their key changes, while user-edited prices are never overwritten. Results are cached in memory per request key and the cache is cleared after saving.

| Price     | Trip-history key                      | Default and fallback                                     |
| --------- | ------------------------------------- | -------------------------------------------------------- |
| Stone     | Crusher + material type               | Crusher initial price                                    |
| Client    | Client + material type                | Client initial price                                     |
| Transport | Client + exact location when supplied | Latest trip for the client when no location match exists |

Trip history ordering uses the greatest trip date, then the greatest numeric trip ID. Trips with no material type do not match material-keyed prices. Suggestion results carry a source for each price (`LAST_TRIP`, `DEFAULT`, or `null` as applicable); `DEFAULT` source metadata is tracked internally by the grid without a separate UI indicator. Saving valid rows is sequential and guarded against re-entrant submissions; successful rows disappear after saving and failed rows remain with mapped errors.

- A fine is a fixed non-negative monetary amount with an optional reason. It can be edited only while the shift is OPEN or REOPENED; after close, reopen the shift to edit it. A fine does not change cubic quantities.

### Balances and accounting

- Client balance = opening balance + (reported client cubic × client price) − fines − client payments. A positive client balance means the client owes the business.
- Contractor balance = opening balance + (reported client cubic × transport price) + (crusher cubic × stone price) − signed ledger settlements. A positive contractor balance means the business owes the contractor.
- Opening balances are included in Accounts and Statements. `opening_balance_date` is informational and does not filter transactions.
- Prices at IPC boundaries use decimal pounds; money is persisted and summed as integer piasters. Each derived trip line rounds half-up before totals are summed.
- Contractor transport and material charges remain separate statement components. Material quantity is excluded from the contractor statement's total quantity.
- Statements always place OPENING first. Remaining rows sort by date, then trip rows by numeric trip-ID suffix with client CHARGE before FINE and contractor TRANSPORT before MATERIAL for each trip. Payments follow trip rows and sort by description, signed amount, then notes, making same-date output independent of input order.
- Ledger movements are `ADVANCE`, `PAYMENT`, and `OTHER`; signed non-zero amounts are allowed. A ledger row may be associated with a driver and shift; its contractor is required. Entries linked to a CLOSED shift cannot be created, changed, moved, or deleted.
- Client payments are signed non-zero amounts. The statement formula subtracts payment amounts, so a negative payment increases the client balance.
- Closing a shift creates no automatic ledger settlement.
- Statement notes show payment notes on payment rows, trip notes on client CHARGE and contractor TRANSPORT rows, and the fine reason on client FINE rows. Contractor MATERIAL rows and OPENING rows have no notes; a trip note appears only once in contractor statements.

## 6. Routes and pages

| Route              | Page and purpose                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `/`                | `DashboardPage` — open-shift cards and editable DraftTrip grid                                                        |
| `/add-trip`        | `AddTripPage` — select a driver and enter multiple trips for one OPEN shift                                          |
| `/shifts`          | `ShiftsPage` — browse shifts, close and reopen shifts                                                                |
| `/shifts/:shiftId` | `ShiftDetailPage` — inspect a shift, manage trips and attachments; successful trip deletion shows a notice           |
| `/all-trips`       | `AllTripsPage` — browse trips across shifts; inspect or delete a trip                                                |
| `/accounts`        | `AccountsPage` — contractor account, driver history, client account, and all movements; page label is `حركة النقدية` |
| `/statements`      | `StatementsPage` — client and contractor statements                                                                  |
| `/settings`        | `SettingsPage` — vehicles, drivers, contractors, crushers, clients, material types                                   |

The wildcard route redirects to `/`. Every page has a visible title; the active top-navigation link is marked with `aria-current="page"` and highlighted. Shared renderer components include `DataTable` (centered cells, text wrapping, nowrap column metadata, an internal scroll viewport, and a sticky header), `TripEntryGrid`, `AttachmentManager`, `CreateShiftForm`, `LedgerEntryForm`, `LedgerEntryDialog`, `TripDetailsContent`, `LedgerEntryDetailsContent`, `ShiftBreadcrumb`, `SubmitButton`, and the floating-window provider/components.

## 7. Verification

- `npm run verify:use-cases` bundles and invokes the real use cases under Electron-as-Node, uses an isolated temporary user-data directory, prints a result table and exits non-zero on failed cases.
- The use-case harness is assembled from per-area suites under `scripts/verify/` and verifies P1–P9 for trip-price suggestions and G1–G13 for pure trip-grid behavior, alongside shift, trip, ledger, accounting, and deterministic statement-ordering cases.
- The use-case harness entry imports `MigrationError` and `runMigrations`, which are not exported by the empty migration stub; `npm run verify:use-cases` stops during bundling. Updating the harness is outside this task's scope.
- Destructive actions use the shared in-app `ConfirmDialog`; its promise resolves to confirm or cancel, Escape cancels, and focus returns to the triggering element.
- `npm run check:i18n` rejects missing or unreferenced Arabic translation keys and documents allow-listed dynamic key prefixes; `npm run review:gate` runs this check.
- `npm run db:inspect -- <database-path>` opens a database read-only and reports its version, integrity, table row counts, and first/last Shift and Trip IDs. It never writes to the inspected database.
- `node scripts/benchmark-large-table.cjs` seeds an isolated temporary database with 8,000 trips across 50 shifts and measures All Trips in Electron through Playwright; it is a one-off measurement, not a gate test.
- `npm run test:e2e` builds the app and runs eight Playwright test declarations in `e2e/smoke.spec.cjs`, covering routes and runtime/translation-key health, shift creation, trip-grid behavior, shift closing, statement notes, second-instance handling, and table layout.
- `npm run test:e2e:full` discovers 144 tests across fourteen E2E spec files, including eight smoke tests. The Settings suite has 51 enabled tests. The full suite remains pending.
- Focused E2E results: Attachments passed 6 tests with ATT-3/ATT-4 blocked on three serial runs (1m03.329s, 1m00.655s, 1m00.777s wall); All Trips passed 6/6 (46.940s); Shift Details 7/7 (1m17.559s); closed-shift locks 1/1 (20.298s); closed-shift protection 9/10 (AT-9 combobox detachment; 1m46.039s). Smoke passed 8/8 (build and run 2m03.530s). Current case coverage is 100 covered, 3 blocked, 0 partial, and 0 NEW out of 103. The full E2E suite remains pending.
- Attachment validation rejects raw non-JPEG bytes on the server. PDF and undecodable-image rejection messages remain blocked by ATT-3 and ATT-4.
- E2E fixtures and app launches use temporary user-data directories; the harness checks the launched app's `userData` path before opening its first window.
- `npm run review:gate` runs diff check, typecheck, lint, the i18n check, and the use-case harness, then checks added diff lines for selected mechanical rules. `npm run review:gate:e2e` also runs Playwright. The gate does not use AI and writes `last-task.md`; the complete harness result table goes to ignored `scripts/last-harness-output.txt`.
- Automated checks do not replace user confirmation in Electron. Only checklist items explicitly marked `[x]` were confirmed by the user; unchecked scenarios remain pending.
- Human testing is required for pending manual checklist scenarios, visual usability, workflows outside the smoke flows, and real-device filesystem/backup behavior.

## 8. Open items

- **OI-002 — Medium, account and statement details:** filtered-table empty-state handling and duplicated client-payment notes need attention. Review `src/renderer/src/components/DataTable.tsx`, `src/renderer/src/pages/accounts/AccountTables.tsx`, and `src/main/repository/statementRepository.ts`.
- **OI-007 — Low, Add Trip grid manual confirmation:** typing, paste, suggestions, keyboard behavior, server-error retention, driver switching, and laptop fit remain unchecked; scenarios are listed in `docs/manual-checklist.md`.
- [ ] Manually confirm the Add Trip inline create-shift form: select a driver with no OPEN shift, confirm the form is inline, create the shift, and confirm the trip grid appears.
- [ ] Manually verify Settings create, edit, delete, validation, and persistence for vehicles, drivers, contractors, crushers, clients, and material types; automated scenarios are in `e2e/settings.spec.cjs`.
- [ ] Manually cancel vehicle and driver edits, then open Add and confirm every field is blank (SET-6).
- [ ] Manually verify client and contractor opening-balance pairs: both blank is valid, zero with a date is valid, and either missing counterpart shows its field error (SET-8).
- [ ] Manually verify both driver phone fields accept digits, spaces, hyphens, parentheses, and one leading plus, while rejecting other characters (SET-9).
- [ ] Manually verify: add three drafts in the grid; edit one draft's custody date/time in details; promote one draft with automatic custody and one with custody unchecked; verify the Ledger entries and dashboard card; upload a transfer document on a custody entry; and try closing a shift that still has drafts.
- [ ] Confirm a fresh install creates the complete schema including DraftTrip at `PRAGMA user_version` 0, reopens with the same schema, and refuses partial version-0 and positive-version databases without modification.
- **OI-010 — Low, table layout manual confirmation:** confirm two-line text wrapping, full-text hover titles, centered headers and cells, laptop fit, and unchanged sorting, filtering, and sums using `docs/manual-checklist.md`.
- **OI-011 — Low, Windows installer manual confirmation:** build and install the Windows installer, launch Shift Tracker, and confirm the Arabic title, default window size, and one-instance behavior using `docs/manual-checklist.md`.
- **OI-012 — Low, trip deletion manual confirmation:** delete a trip from Shift Details and All Trips; confirm the success notice and that the deleted trip disappears from the list. In All Trips, confirm Delete is hidden for trips in CLOSED shifts and the locked label is shown.
- **OI-013 — Low, closed-shift attachment manual confirmation:** attachments of trips in CLOSED shifts show no upload or delete controls in Shift Details, the trip details window, and the All Trips details window; REOPENED and OPEN shifts keep them.
- **OI-014 — Low, renderer navigation manual confirmation:** confirm popup requests are denied and navigation or redirects outside the app renderer are blocked in development and packaged runs.
- **OI-015 — Low, ledger form manual confirmation:** confirm add, edit, and delete behavior on Contractor Account, Driver History, and All Movements for OPEN-shift, CLOSED-shift, and unlinked entries using `docs/manual-checklist.md`.
- **OI-016 — Low, statement ordering manual confirmation:** confirm same-date statements show OPENING first, numeric trip-ID order, the correct per-trip component order, and canonical payment order using `docs/manual-checklist.md`.
- **OI-017 — Low, renderer IPC failure manual confirmation:** simulate a rejected IPC invocation and confirm the loading state resets, a non-blocking error notice appears, and the page remains usable using `docs/manual-checklist.md`.
- **OI-018 — Low, settings CRUD manual confirmation:** confirm add, edit, delete, field errors, blank Add after Edit, and delete-failure notices remain consistent on all six settings pages using `docs/manual-checklist.md`.
- **OI-019 — Low, extracted trip and shift workflows manual confirmation:** confirm Add Trip grid/form interactions and shift/detail dialogs preserve validation, save, cancel, attachment, and refresh behavior using `docs/manual-checklist.md`.
- **OI-020 — Low, in-app confirmation manual confirmation:** confirm destructive prompts use RTL text and styling, Escape cancels, focus returns to the trigger, and no native dialog appears across delete workflows using `docs/manual-checklist.md`.
- **OI-021 — Low, large-table and lazy-attachment manual confirmation:** confirm large All Trips tables keep scrolling, sorting, filtering, and sums correct, and attachment previews load on display while upload, delete, preview, and CLOSED-shift read-only behavior remain intact using `docs/manual-checklist.md`.
- **OI-022 — Low, receipt pointer layout manual confirmation:** confirm receipt Upload, Preview, and Delete controls receive mouse clicks in Shift Details at 1366×768 using `docs/manual-checklist.md`.

### Portable Mode (do after all other features are done)

Goal: the entire app (exe + data) lives in one folder and can be moved between machines by copying that folder.

Implementation (`src/main/db.ts` and `src/main/backup.ts`):

- Add `resolveDataPath()` in `db.ts`:
  - Import `existsSync` from `fs` and `dirname` from `path`.
  - Resolve the executable directory with `dirname(app.getPath('exe'))`; use its `data` subfolder when it exists, otherwise use `app.getPath('userData')`.
- Replace every `app.getPath('userData')` in `db.ts` with `resolveDataPath()`.
- `initializeBackupService` is currently called from `src/main/index.ts` with `app.getPath('userData')`; pass `resolveDataPath()` there so backups and the database use the same folder. `backup.ts` already receives its data path from its caller.
- To activate portable mode after installing, create an empty `data` folder next to the `.exe`. The app detects it on next launch and uses it automatically.
- To move the app, copy the entire install folder (exe + `data\`).

Manual confirmation scenarios are listed unchecked by area in `docs/manual-checklist.md`.

## 9. Decisions

- Contractor balance sign is the reverse of client sign under the shared formula: a positive contractor balance means the business owes the contractor. The client and contractor statement pages explain their meanings; calculations and colors remain as implemented.
- The Accounts page label is `حركة النقدية`.
- Fresh databases remain at `PRAGMA user_version = 0` and use the complete current schema directly. Complete version-0 schemas reopen; partial or unknown version-0 schemas and any positive user version are refused. Remove old databases manually before using this virgin-state build.
- Never delete a database during ordinary startup. There is no migration process; archive and manually remove existing databases before use.
- A close-time reported trip count is required for OPEN and REOPENED shifts; neither stored nor actual count is a main-process fallback.
- If backup fails after close, closing still succeeds and the user sees a warning.
- Money uses no more than two decimals at input boundaries; derived line amounts use exact half-up rounding.
- Each trip has one fixed non-negative monetary fine and optional reason. It reduces client balance as a separate negative statement row and never changes cubic quantities or costs.
- Client charge = `client_cubic_reported × client_price`.
- Contractor transport = `client_cubic_reported × transport_price`; contractor material = `crusher_cubic × stone_price`; both increase contractor balance and remain separately displayed.
- Opening balances are included in Accounts and Statements; `opening_balance_date` is informational only.
- `Shift.contractor_id` snapshots the contractor when the shift is created; historical accounting uses that snapshot.
- Trip IDs are unique; gaps are allowed.
