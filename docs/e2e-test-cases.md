# E2E test cases: Shift Tracker (whole application)

Companion to `docs/e2e-coverage-plan.md`. That plan says what each tier covers; this file lists every concrete case with steps and expected results, so each one can be handed to Copilot as an independent task.

## How to read this file

- **Cov** — `S1`–`S7` and `F4` name tests in `e2e/smoke.spec.cjs`; `closed-shift-protection` and `closed-shift-locks` name their spec files. `NEW`: no current E2E coverage. `PART`: the spec covers only part of the described case.
- **Pri** — `P0`: money, data loss, or closed-shift protection. `P1`: normal CRUD and workflow. `P2`: UX polish.
- **Tier** — Smoke cases run with `npm run test:e2e`; all current specs run with `npm run test:e2e:full`.
- **Seed** — a seed mode from the "Seed modes" section. Modes marked `exists` are handled by `e2e/seed.cjs`; modes marked `not implemented` are planned only.

## Conventions (same as the coverage plan)

1. Every visible string is resolved through `ar.json` keys with the `text()` helper. No Arabic literals in tests.
2. Entity names and values are unique ASCII (`E2E <Kind> ${suffix}`). Never reuse data across tests.
3. Each test launches its own app with its own temporary `userData`. Tests that mutate shared state are serialized, as in the current config (`workers: 1`).
4. Destructive confirmations use the in-app dialog; tests choose its confirm or cancel button through `nextDialog(page)`.
5. Success and failure notices are asserted by their i18n key text: `ipcErrors.tripDeleted`, `ipcErrors.deleteFailed`, and so on.
6. After any mutation, assert the UI **and** reload the page or navigate away and back, to prove it persisted.
7. Never assert `ar.json` text that is also a raw key. `expectNoRawTranslationKeys` stays in every flow that visits a new page.

## Seed modes

| Mode             | Contents                                                                                                                  | Status |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| `no-shift`       | One contractor, one driver, two vehicles, one client, one crusher, and one material type; no shifts or trips.               | exists          |
| `open-shift`     | Reference data plus one OPEN shift with no trips.                                                                           | exists          |
| `with-trip`      | One OPEN shift and one trip, with a trip receipt and closing-sheet attachment.                                                | exists          |
| `layout`         | Long names and notes, two trips, attachments, one ledger entry, and one client payment.                                      | exists          |
| `two-shifts`     | One OPEN and one CLOSED shift with separate drivers and trips; both shifts have attachments.                                 | exists          |
| `accounts`       | The two-shift setup plus OPEN-linked, CLOSED-linked, and unlinked ledger entries; no client payment is seeded.              | exists          |
| `golden`         | Client opening balance 500, one 20-cubic trip at client price 100 with a 200 fine, and a client payment of 1,000.           | exists          |
| `closed-shift`   | A standalone CLOSED-shift fixture.                                                                                           | not implemented |
| `reopened-shift` | A standalone REOPENED-shift fixture.                                                                                          | not implemented |
| `references`     | Settings entities referenced by shifts or trips for blocked-delete cases.                                                    | not implemented |

Closing a shift or reopening it inside a test goes through the UI. Seeds only build the _starting_ state.

---

## 1. App shell and navigation

| ID    | Scenario                           | Steps                                                            | Expected                                                                       | Seed        | Pri | Cov |
| ----- | ---------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- | --- | --- |
| NAV-1 | All six routes render              | Visit every nav item                                             | Correct page title each time, no console errors, no raw translation keys       | `with-trip` | P1  | S1  |
| NAV-2 | Active item highlight              | Click each nav item                                              | Only the clicked item has the active state                                     | `no-shift`  | P2  | NEW |
| NAV-3 | Unknown route falls back           | Go to `#/does-not-exist`                                         | Redirects to Add Trip and shows its title                                      | `no-shift`  | P2  | NEW |
| NAV-4 | Backup status indicator on startup | Launch with the backup folder healthy, then with `lastError` set | No warning when healthy; warning shown when `getBackupStatus` reports an error | `no-shift`  | P1  | NEW |

## 2. Add Trip (`/`)

| ID     | Scenario                           | Steps                                                              | Expected                                                                                              | Seed         | Pri | Cov |
| ------ | ---------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------ | --- | --- |
| ADD-1  | Driver without an OPEN shift       | Pick a driver who has no OPEN shift                                | Inline create-shift form is shown, the grid is not                                                    | `no-shift`   | P1  | NEW |
| ADD-2  | Create shift inline                | From ADD-1, fill vehicle and date, submit                          | Shift is created, grid becomes available, chip shows the new shift                                    | `no-shift`   | P1  | NEW |
| ADD-3  | Rapid driver switching             | Switch A → B → A quickly                                           | Only the latest driver's shift and chips remain (no stale result)                                     | `two-shifts` | P1  | NEW |
| ADD-4  | Clear driver selection             | Select a driver, then clear                                        | Grid and chips disappear, no leftover state                                                           | `with-trip`  | P2  | NEW |
| ADD-5  | Valid row saves exactly once       | Fill a valid row, double-click Save                                | One trip is created; duplicate-save guard works                                                       | `with-trip`  | P0  | S3  |
| ADD-6  | Zero price rejected                | Enter price 0                                                      | Field error, nothing saved                                                                            | `with-trip`  | P0  | S3  |
| ADD-7  | Required fields per row            | Leave crusher, client, or cubic empty and save                     | Error on each empty required cell, other rows unaffected                                              | `with-trip`  | P1  | NEW |
| ADD-8  | Paste a spreadsheet block          | Paste multi-row TSV with header, quoted cells, empty lines         | Header detected and skipped, values mapped to the right columns, empty lines ignored                  | `with-trip`  | P1  | NEW |
| ADD-9  | Stone and client price suggestions | Choose crusher and client with a previous trip, then a new pair    | `LAST_TRIP` price for the previous pair, `DEFAULT` initial price for the new pair, keyed per material | `with-trip`  | P1  | NEW |
| ADD-10 | Transport price suggestion         | Pick client plus location with and without history                 | Location-specific suggestion preferred; falls back to client-only; empty if none                      | `with-trip`  | P1  | NEW |
| ADD-11 | Missing material behaviour         | Leave material empty, then set it                                  | Suggestion refreshes on change; no error when material is optional                                    | `with-trip`  | P2  | NEW |
| ADD-12 | Ctrl+D copy down                   | Fill row 1, add row 2, focus a cell, press Ctrl+D                  | Value copied from the row above, only into that column                                                | `with-trip`  | P2  | NEW |
| ADD-13 | Cubic with comma rejected          | Type `1,5` or `1,000` in a cubic cell                              | Cell flagged as invalid, row not saved                                                                | `with-trip`  | P1  | NEW |
| ADD-14 | Arabic name variants               | Type normalized and ambiguous variants of a client or crusher name | Normalized match resolves; ambiguous match is flagged rather than guessed                             | `with-trip`  | P1  | NEW |
| ADD-15 | Partial server failure             | Save 2 rows where one duplicates a receipt number                  | One saved and removed, the failed row stays with its error                                            | `with-trip`  | P0  | S7  |
| ADD-16 | Saved rows are visible elsewhere   | Save a trip, then open All Trips and Shift Details                 | Trip appears in both with the same values                                                             | `with-trip`  | P1  | NEW |

## 3. Shifts (`/shifts`)

| ID    | Scenario                             | Steps                                                        | Expected                                                                        | Seed           | Pri | Cov     |
| ----- | ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------- | -------------- | --- | ------- |
| SH-1  | Create an OPEN shift                 | Fill the create dialog, submit                               | Shift listed with status OPEN and 0 trips; no count field                       | `no-shift`     | P1  | S2      |
| SH-2  | Duplicate vehicle                    | Create a second shift on the same vehicle                    | Field error on vehicle                                                          | `with-trip`    | P0  | S2      |
| SH-3  | Duplicate driver                     | Create a second shift for the same driver on another vehicle | Field error on driver                                                           | `with-trip`    | P0  | NEW     |
| SH-4  | Create-form validation and reset     | Submit empty, then fill, cancel, reopen the dialog           | Required errors shown; the reopened dialog is blank                             | `no-shift`     | P1  | NEW     |
| SH-5  | Close dialog pre-fills actual count  | Open Close on a shift with N trips                           | Count field shows N                                                             | `with-trip`    | P0  | S4      |
| SH-6  | Count mismatch rejected              | Enter N+1 and submit                                         | Error shown, shift stays OPEN                                                   | `with-trip`    | P0  | S4      |
| SH-7  | Close succeeds with attachments      | Seeded attachments, enter correct N                          | Status becomes CLOSED                                                           | `with-trip`    | P0  | S4      |
| SH-8  | Close blocked without closing sheet  | Try to close with no closing-sheet attachment                | Visible guidance, shift stays OPEN                                              | `with-trip`    | P0  | NEW     |
| SH-9  | Close blocked without a trip receipt | Try to close with a trip missing its required attachment     | Visible guidance, shift stays OPEN                                              | `with-trip`    | P0  | NEW     |
| SH-10 | Upload a closing sheet in the UI     | Upload a generated JPEG on the shift row                     | Attachment is listed and previewable                                            | `with-trip`    | P1  | NEW     |
| SH-11 | Reopen requires a reason             | Reopen a CLOSED shift with empty reason, then with a reason  | Empty rejected; valid reason sets status REOPENED                               | `two-shifts`   | P0  | NEW     |
| SH-12 | Re-close after reopen                | From SH-11, add a trip, close with the new count             | Shift returns to CLOSED with the new count                                      | `two-shifts`   | P0  | NEW     |
| SH-13 | Backup warning after close           | Make `userData/backups` unwritable, close a shift            | Warning notice appears, shift remains CLOSED; permissions restored in cleanup   | `with-trip`    | P1  | NEW     |
| SH-14 | List content and navigation          | Open the list, click a row action                            | Shows ID, date, driver, vehicle, status, trip count; navigates to `/shifts/:id` | `two-shifts`   | P1  | NEW     |

## 4. Shift details (`/shifts/:shiftId`)

| ID    | Scenario                                    | Steps                                                                      | Expected                                                                  | Seed             | Pri | Cov                     |
| ----- | ------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------- | --- | ----------------------- |
| SD-1  | Summary and trips table                     | Open an OPEN shift                                                         | Driver, vehicle, status and the trips list are correct                    | `with-trip`      | P1  | PART S3                 |
| SD-2  | Edit dialog hydration                       | Open Edit on a trip                                                        | Every field holds the saved value                                         | `with-trip`      | P1  | PART S3                 |
| SD-3  | Save an edit                                | Change cubic and price, save                                               | Row and totals update; persists after reload                              | `with-trip`      | P0  | NEW                     |
| SD-4  | Edit validation                             | Clear a required field, save                                               | Field error, nothing saved                                                | `with-trip`      | P1  | NEW                     |
| SD-5  | Delete a trip, confirm                      | Click Delete, accept the dialog                                            | Notice `ipcErrors.tripDeleted`; row removed; trip count and totals update | `with-trip`      | P0  | closed-shift-protection |
| SD-6  | Delete a trip, cancel                       | Click Delete, dismiss the dialog                                           | Row stays, no notice, no IPC call                                         | `with-trip`      | P1  | closed-shift-protection |
| SD-7  | CLOSED shift locks edit and delete          | Open a CLOSED shift                                                        | No Edit or Delete; `common.lockedShift` label shown; Details still works  | `two-shifts`     | P0  | closed-shift-protection |
| SD-8  | Server rejects trip changes on CLOSED shift | Close the shift in another path while this page is open, then click Delete | Error notice, row preserved                                               | `with-trip`      | P0  | closed-shift-protection |
| SD-9  | REOPENED shift: add a trip                  | Open a REOPENED shift, add through the full TripForm dialog                | Trip saved and listed                                                     | `reopened-shift` | P1  | NEW                     |
| SD-10 | Trip details window                         | Click the Eye button on a row                                              | Details window shows the correct receipt and recipient labels             | `with-trip`      | P1  | PART S3                 |
| SD-11 | Breadcrumb                                  | Click the breadcrumb                                                       | Returns to the shifts list                                                | `with-trip`      | P2  | NEW                     |

## 5. All Trips (`/all-trips`)

| ID    | Scenario                            | Steps                                                                                     | Expected                                                                                                             | Seed           | Pri | Cov                     |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------- | --- | ----------------------- |
| AT-1  | Sort                                | Click a sortable header twice                                                             | Ascending then descending order                                                                                      | `two-shifts`   | P2  | NEW                     |
| AT-2  | Filter by distinct value            | Open a column filter, pick a value                                                        | Only matching rows remain; clearing restores all                                                                     | `two-shifts`   | P1  | NEW                     |
| AT-3  | Row selection sum                   | Select two rows                                                                           | Selected sum of client cubic is correct                                                                              | `two-shifts`   | P1  | NEW                     |
| AT-4  | Details window                      | Click Details                                                                             | Window shows the right trip; opening the same trip twice does not duplicate it                                       | `with-trip`    | P1  | PART S3                 |
| AT-5  | Delete a trip in an OPEN shift      | Click Delete, accept the dialog                                                           | Notice `ipcErrors.tripDeleted`; row removed immediately; trip is also gone from Shift Details; persists after reload | `two-shifts`   | P0  | closed-shift-protection |
| AT-6  | Cancel delete                       | Click Delete, dismiss the dialog                                                          | Row stays, no notice                                                                                                 | `two-shifts`   | P1  | closed-shift-protection |
| AT-7  | CLOSED shift hides Delete           | Look at a trip from a CLOSED shift                                                        | `common.lockedShift` label replaces Delete; Details still present                                                    | `two-shifts`   | P0  | closed-shift-protection |
| AT-8  | OPEN and CLOSED mixed               | Look at a trip from each shift                                                            | Delete only on OPEN-shift rows                                                                                       | `two-shifts`   | P0  | closed-shift-protection |
| AT-9  | Reopen restores Delete              | Reopen the CLOSED shift, return to All Trips                                              | Delete button now appears for its trips                                                                              | `two-shifts`   | P0  | closed-shift-protection |
| AT-10 | Stale row is rejected by the server | Load All Trips, close the shift through `window.api.closeShift`, click Delete on that row | Notice `ipcErrors.deleteFailed`; row preserved after reload                                                          | `with-trip`    | P0  | closed-shift-protection |
| AT-11 | Delete a trip that has attachments  | Delete an OPEN-shift trip with an attachment                                              | Trip and its attachment files are removed (assert via the details window or the DB inspect script)                   | `with-trip`    | P1  | NEW                     |
| AT-12 | Empty state                         | Open with no trips                                                                        | Empty message, no errors                                                                                             | `no-shift`     | P2  | NEW                     |

## 6. Attachments (shared component)

| ID    | Scenario                                          | Steps                                                                                             | Expected                                                                                            | Seed           | Pri | Cov                     |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------- | --- | ----------------------- |
| ATT-1 | Upload, crop, save a JPEG                         | Upload a generated JPEG, crop, save                                                               | Thumbnail listed, preview opens                                                                     | `with-trip`    | P1  | NEW                     |
| ATT-2 | Delete an attachment                              | Delete it, confirm                                                                                | Removed from the list and the file system                                                           | `with-trip`    | P1  | NEW                     |
| ATT-3 | Reject non-JPEG                                   | Pick a PNG or PDF                                                                                 | Visible error, nothing stored                                                                       | `with-trip`    | P1  | NEW                     |
| ATT-4 | Corrupt image                                     | Upload a truncated JPEG                                                                           | Visible error, no crash                                                                             | `with-trip`    | P2  | NEW                     |
| ATT-5 | Crop, rotate, zoom controls                       | Use each control                                                                                  | Output differs; controls respond                                                                    | `with-trip`    | P2  | NEW                     |
| ATT-6 | CLOSED trip attachments are read-only             | Open a trip from a CLOSED shift (Shift Details, All Trips details window, trip details)           | Add and delete controls are unavailable; preview still works                                        | `two-shifts`   | P0  | NEW                     |
| ATT-7 | A closing sheet cannot be added to a CLOSED shift | Open the close dialog and its shift select; call addAttachment for a CLOSED shift through the API | CLOSED shifts are not offered in the dialog; the server rejects the call; attachments are unchanged | `two-shifts`   | P0  | closed-shift-locks      |
| ATT-8 | Server rejects attachment changes on CLOSED shift | Close the shift while the view is open, then try to add                                           | Error notice, nothing stored                                                                        | `with-trip`    | P0  | NEW                     |

## 7. Settings (`/settings`)

Run SET-1 through SET-6 once per entity (6 parametrized cases): vehicle, driver, contractor, crusher, client, material type.

| ID     | Scenario                       | Steps                                                                                                                        | Expected                                                          | Seed         | Pri | Cov              |
| ------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------ | --- | ---------------- |
| SET-1  | Create                         | Open Add, fill valid values, save                                                                                            | New row appears in the table; persists after reload               | `no-shift`   | P1  | PART S2 (driver) |
| SET-2  | Edit hydration and save        | Open Edit, change a field, save                                                                                              | Dialog starts with saved values; table updates                    | `no-shift`   | P1  | NEW              |
| SET-3  | Delete an unreferenced row     | Delete, confirm                                                                                                              | Row removed                                                       | `no-shift`   | P1  | NEW              |
| SET-4  | Required fields                | Submit empty                                                                                                                 | Error per required field, nothing created                         | `no-shift`   | P1  | NEW              |
| SET-5  | Duplicate key                  | Create the same name (vehicle: same vehicle number)                                                                          | Duplicate error                                                   | `no-shift`   | P1  | NEW              |
| SET-6  | Blank Add dialog after Edit    | Open Edit, cancel, open Add                                                                                                  | Add dialog is blank, not carrying the edited row                  | `no-shift`   | P2  | NEW              |
| SET-7  | Blocked delete shows a notice  | Delete a referenced row (driver or vehicle with a shift; contractor with a vehicle; crusher, client or material with a trip) | Notice `ipcErrors.deleteFailed`; row is still listed after reload | `references` | P0  | NEW              |
| SET-8  | Opening balance needs its date | Client or contractor: balance without date, then date without balance                                                        | Validation error in each case                                     | `no-shift`   | P1  | NEW              |
| SET-9  | Numeric field limits           | Negative or non-numeric initial price, default cubic, phone                                                                  | Rejected with a field error                                       | `no-shift`   | P2  | NEW              |
| SET-10 | Vehicle needs a contractor     | Add a vehicle with no contractor                                                                                             | Required error on contractor                                      | `no-shift`   | P1  | NEW              |

## 8. Accounts (`/accounts`)

| ID     | Scenario                                    | Steps                                                              | Expected                                                   | Seed       | Pri | Cov |
| ------ | ------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | ---------- | --- | --- |
| ACC-1  | Contractor ledger add                       | Add ADVANCE, PAYMENT, and OTHER entries                            | Rows appear; balance recalculates after each               | `accounts` | P0  | NEW |
| ACC-2  | Contractor ledger edit and delete           | Edit an amount, delete another row                                 | Table and balance refresh                                  | `accounts` | P0  | NEW |
| ACC-3  | Driver history add, edit, delete            | Same as ACC-1 and ACC-2 on the driver page                         | Same expectations                                          | `accounts` | P0  | NEW |
| ACC-4  | Movement linked to an OPEN shift            | Add a movement with an OPEN shift                                  | Saved; Edit and Delete available                           | `accounts` | P1  | NEW |
| ACC-5  | Movement linked to a CLOSED shift is locked | Open a movement linked to a CLOSED shift on all three ledger pages | Edit and Delete hidden or locked with `common.lockedShift` | `accounts` | P0  | NEW |
| ACC-6  | Server rejects a CLOSED-shift movement      | Create a movement and pick a CLOSED shift                          | Visible error, nothing saved                               | `accounts` | P0  | NEW |
| ACC-7  | Client payment lifecycle                    | Add, edit, delete a payment, including a negative amount           | Each step changes the client balance by the signed amount  | `accounts` | P0  | NEW |
| ACC-8  | All Movements list                          | Filter by driver, sort by amount, open details                     | Correct rows; details window shows notes and shift         | `accounts` | P1  | NEW |
| ACC-9  | Ledger form validation                      | Empty amount, zero amount, missing date                            | Field errors; Add dialog is blank after cancel             | `accounts` | P1  | NEW |
| ACC-10 | Account section switching                   | Switch between the four sections                                   | Each loads its own data, no stale rows                     | `accounts` | P2  | NEW |

## 9. Statements (`/statements`)

| ID   | Scenario                                     | Steps                      | Expected                                                                                          | Seed         | Pri | Cov     |
| ---- | -------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- | ------------ | --- | ------- |
| ST-1 | Client statement rows                        | Select the client          | Opening-balance row, trip rows with notes, fine row, and payment rows are all present and ordered | `golden`     | P0  | NEW     |
| ST-2 | Contractor statement rows                    | Select the contractor      | Transport and material rows are separate; sign note is shown; quantity total excludes material    | `golden`     | P0  | PART S5 |
| ST-3 | Client statement has no contractor sign note | Select a client            | Contractor sign note is absent                                                                    | `with-trip`  | P1  | S5      |
| ST-4 | Totals placement and formatting              | Open any statement         | Summary is above the table; amounts use grouped format (`100,500.25`)                             | `golden`     | P1  | NEW     |
| ST-5 | Selector empty state                         | Open with nothing selected | Prompt shown, no table, no errors                                                                 | `no-shift`   | P2  | NEW |
| ST-6 | Switching selection                          | Pick client A then B       | Only B's rows shown                                                                               | `two-shifts` | P1  | NEW     |

## 10. Money golden scenario (UI-created data only)

| ID     | Scenario                          | Steps                                                                                                                 | Expected                                                                                    | Seed     | Pri | Cov |
| ------ | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------- | --- | --- |
| GOLD-1 | End-to-end balance                | Through the UI: set client opening balance 500, add a trip 20 × 100, add a 200 fine, record a client payment of 1,000 | Client balance is **1,300.00** on Accounts and on Statements. The two numbers match exactly | `no-shift` | P0  | NEW |
| GOLD-2 | Delete the trip                   | Delete the trip from All Trips (open shift)                                                                           | Balance drops by the trip value, on both pages, after reload                                | `golden` | P0  | NEW |
| GOLD-3 | Closed shift protects the numbers | Close the shift, try to delete the trip                                                                               | Delete is hidden; balance unchanged                                                         | `golden` | P0  | NEW |

## 11. Shared components

| ID    | Scenario                     | Steps                                                | Expected                                                                                                | Seed        | Pri | Cov     |
| ----- | ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- | --- | ------- |
| SHR-1 | DataTable layout at 1366×768 | Open every table with long names and notes           | No horizontal overflow, headers and cells centered, wrapped cells have titles, text clamps at two lines | `layout`    | P2  | F4      |
| SHR-2 | Floating window lifecycle    | Open, move, resize, minimize, restore, close         | Each action works; closing removes it                                                                   | `with-trip` | P2  | PART S3 |
| SHR-3 | Notices                      | Trigger a success and an error notice                | Shown, dismiss button closes, auto-dismiss after the timer                                              | `with-trip` | P1  | NEW     |
| SHR-4 | Forms keep clean state       | Open and cancel Create Shift, Trip, and Ledger forms | Each form is blank when reopened                                                                        | `with-trip` | P2  | NEW     |

## 12. Runtime

| ID   | Scenario                          | Steps                                                         | Expected                                               | Seed        | Pri | Cov |
| ---- | --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ | ----------- | --- | --- |
| RT-1 | Second instance                   | Launch the app twice                                          | Second exits, the first is focused, database untouched | `with-trip` | P1  | S6  |
| RT-2 | Persistence across restart        | Create data, close the app, relaunch with the same `userData` | All data is present                                    | `with-trip` | P0  | NEW |
| RT-3 | Closed-shift state across restart | Close a shift, relaunch                                       | It is still CLOSED and still locked in the UI          | `with-trip` | P0  | NEW |

---

## Totals

| Area          | Cases                                   |
| ------------- | --------------------------------------- |
| Navigation    | 4                                       |
| Add Trip      | 16                                      |
| Shifts        | 14                                      |
| Shift details | 11                                      |
| All Trips     | 12                                      |
| Attachments   | 8                                       |
| Settings      | 10 (SET-1–6 run per entity, 6 entities) |
| Accounts      | 10                                      |
| Statements    | 6                                       |
| Golden money  | 3                                       |
| Shared        | 4                                       |
| Runtime       | 3                                       |
| **Total**     | **101**                                 |

The 19 test declarations across the three current specs fully or partly cover 30 of these cases; 71 have no E2E coverage yet. Build the `P0` cases first.

## Suggested build order

1. **Closed-shift protection (all P0 lock cases):** AT-5 to AT-10, SD-5 to SD-8, ATT-6 to ATT-8, ACC-5, ACC-6, GOLD-3, RT-3. These guard the newest work.
2. **Money correctness:** GOLD-1, GOLD-2, ACC-1, ACC-2, ACC-3, ACC-7, ST-1, ST-2.
3. **Shift lifecycle:** SH-3, SH-8, SH-9, SH-11, SH-12.
4. **Settings CRUD and blocked deletes:** SET-1 to SET-10.
5. **Add Trip grid behaviours:** ADD-7 to ADD-14.
6. **Everything else (P1/P2).**

## Shared helper functions

- `nextDialog(page, action)`: select confirm, cancel, or Escape in the in-app confirmation dialog.
- `expectNotice(page, key)`: assert the notice container shows `text(key)`.
- `closeShiftViaApi(page, shiftId)`: calls `window.api.closeShift` through `page.evaluate` (used by AT-10, SD-8, ATT-8).
- `tripRow(page, tripId)`: returns the table row locator by trip id.
- `makeJpeg(width, height)` and `makePng()`: generate image fixtures in memory for the attachment cases.
