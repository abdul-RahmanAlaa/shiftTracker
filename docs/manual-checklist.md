# Manual confirmation checklist

All scenarios remain unchecked until confirmed by the user.

## Accounts and ledger

- [ ] Confirm add, edit, delete, field errors, blank Add after Edit, and delete-failure notices on Vehicles, Drivers, Contractors, Crushers, Clients, and Material Types settings.
- [ ] Contractor Account: edit and delete an entry linked to an OPEN shift.
- [ ] Contractor Account: confirm an entry linked to a CLOSED shift shows `common.lockedShift` and cannot be edited or deleted; confirm an unlinked entry can be edited and deleted.
- [ ] Contractor Account: edit and delete an unlinked entry.
- [ ] Driver History: edit and delete an entry linked to an OPEN shift.
- [ ] Driver History: confirm an entry linked to a CLOSED shift shows `common.lockedShift` and cannot be edited or deleted; confirm an unlinked entry can be edited and deleted.
- [ ] Driver History: edit and delete an unlinked entry.
- [ ] All Movements: edit and delete an entry linked to an OPEN shift.
- [ ] All Movements: confirm an entry linked to a CLOSED shift shows `common.lockedShift` and cannot be edited or deleted; confirm an unlinked entry can be edited and deleted.
- [ ] All Movements: edit and delete an unlinked entry.
- [ ] Edit a shift-linked ledger row to have no shift; save and confirm the shift is empty after reopening.
- [ ] Clear an allowed driver and ledger notes; save and confirm both remain empty after reopening.
- [ ] Edit only a ledger amount and confirm its shift, driver, contractor, and notes are preserved.
- [ ] Clear client-payment notes and confirm they remain empty after reopening.
- [ ] Edit only a client-payment amount and confirm its notes are preserved.
- [ ] Submit an invalid ledger combination and confirm a field error appears without a crash.
- [ ] Enter a client payment of -300 and confirm both Accounts and Statements increase the balance by 300.
- [ ] Enter a negative ledger amount and confirm it appears in driver history.
- [ ] Confirm amount zero is rejected with a field error.
- [ ] Edit a client payment to a negative amount.
- [ ] Reject a ledger entry assigned to a CLOSED shift beside its shift field.
- [ ] Reject amount edits on ledger entries linked to CLOSED shifts.
- [ ] Reject clearing the shift from a ledger entry linked to a CLOSED shift.
- [ ] Reject moving a ledger entry from an OPEN shift to a CLOSED shift.
- [ ] Accept an OTHER ledger entry without a shift when it has a contractor and note.

## Shifts and trip workflows

- [ ] Confirm delete prompts use the RTL in-app dialog, Escape cancels, focus returns to the delete button, and no native dialog appears in All Trips, Shift Details, settings, account, and attachment workflows.
- [ ] Type one trip row in the Add Trip grid and confirm every displayed field is saved correctly.
- [ ] Paste five tab-separated trip rows from Excel and confirm each parsed row is correct.
- [ ] Resolve a client and crusher with previous trips and confirm suggested prices appear and remain editable.
- [ ] Enter the same client with two material types and confirm each material can receive a different stone and client price suggestion.
- [ ] Change a material type and confirm an unedited suggested price clears or changes while a user-edited price stays unchanged.
- [ ] Confirm transport-price suggestions follow the client and prefer a matching trip location when one is entered.
- [ ] Leave material type unselected and confirm stone and client suggestions use only initial prices while transport can still come from trip history.
- [ ] Save a grid containing a server-rejected row and confirm the failed row remains with its error.
- [ ] Use Ctrl+D in the grid and confirm the cell copies from the row above.
- [ ] Confirm the Add Trip grid fits a 1366x768 laptop without page scrolling.
- [ ] Confirm Add Trip form validation, shift-selection loading, grid save/cancel behavior, and field values remain consistent after the page responsibilities were split.
- [ ] Confirm shift create/edit/close/reopen dialogs and Shift Details add/edit trip dialogs preserve validation, cancel behavior, attachment handling, and refreshed page data.
- [ ] With a large All Trips dataset, confirm virtualized scrolling keeps the sticky header and cell alignment, sorting and filtering include all rows, and select-all totals cover all filtered rows; confirm attachment images load when visible and previews, upload/delete, and CLOSED-shift read-only controls remain intact.
- [ ] Switch drivers quickly while the shift lookup is pending and confirm only the latest driver's shift appears.
- [ ] Reopen a CLOSED shift with a reason and confirm its badge and editability.
- [ ] Confirm reopen `shiftId` and `reason` errors appear beneath their controls.
- [ ] Add a forgotten trip and its attachment to a REOPENED shift from its detail page.
- [ ] Confirm reopened trip-count input has integer steps and a minimum of zero.
- [ ] Close a CLOSED shift with a count and confirm the already-closed `shiftId` error.
- [ ] Confirm a non-trip-field add-trip error appears and clears on resubmit or dialog close.
- [ ] Reject reopening with an empty reason.
- [ ] Start a new shift for the driver of a REOPENED shift.
- [ ] Re-close a reopened shift and confirm normal close checks and backup.
- [ ] Confirm an empty or wrong OPEN-shift close count produces a field error.
- [ ] Close with the correct count and confirm it is stored.
- [ ] Confirm the create-shift form has no reported-count field.
- [ ] Confirm a second OPEN shift on one vehicle is rejected.
- [ ] Confirm a trip price of zero is rejected beside its field.
- [ ] Confirm a negative trip price is rejected.
- [ ] Confirm an impossible date is rejected.
- [ ] Confirm a shift with zero default cubic is rejected.
- [ ] Verify create/update reject string, NaN, negative, and zero trip prices/cubics on the exact field without changing rows; quantities remain positive finite REAL values and unaffected by fines.
- [ ] Verify impossible trip/start/end dates show invalid-date errors and empty values show required errors.
- [ ] Create and edit a trip with empty optional renderer fields; confirm saves succeed and recipient status is sent as UNCLEAR.
- [ ] Confirm createShift rejects supplied reported count and zero, negative, or string defaults without inserting a row.
- [ ] Confirm a second OPEN shift is rejected, closing frees the vehicle, and REOPENED does not block a new shift.
- [ ] Confirm end-before-start leaves the shift unchanged and CLOSED-with-invalid-count returns the already-closed `shiftId` error first.
- [ ] Close an OPEN shift with a closing-sheet attachment and count zero; confirm CLOSED state and stored zero.
- [ ] Re-close with a new matching count and confirm it is stored.
- [ ] Re-close with a mismatched count and confirm the count-field error.
- [ ] Confirm the re-close input pre-fills stored count, or actual count when unset.
- [ ] Confirm a re-closed shift is locked against edits.
- [ ] Inspect `ShiftReopenLog` and confirm its latest `closed_again_at` timestamp.
- [ ] Confirm every receipt and recipient status value is labeled correctly in trip details.

## Accounting, statements, and data

- [ ] Confirm a closing-shift attachment backup failure leaves close successful and shows a warning.
- [ ] Confirm contractor statements show the sign note and client statements do not.
- [ ] Enter a fixed fine and reason; confirm a separate negative client statement row.
- [ ] Confirm a fine reduces client balance without changing reported cubic or client total cubic.
- [ ] Confirm contractor transport uses reported client cubic and material uses crusher cubic as separate components.
- [ ] Confirm opening balances appear in Accounts and Statements even when their date follows transactions.
- [ ] Reassign a vehicle's contractor and confirm old shift charges stay with its creation-time contractor snapshot.
- [ ] Confirm money inputs reject more than two decimals, accept 5.25 exactly, and renderer steps are 0.01.
- [ ] Confirm contractor statement total quantity excludes MATERIAL row quantity.
- [ ] Confirm same-date statements show OPENING first, trips in numeric ID order, client CHARGE before FINE and contractor TRANSPORT before MATERIAL within each trip, and payments afterward in description/amount/notes order.
- [ ] Confirm all seven schema date columns reject impossible dates and nullable dates accept NULL.
- [ ] Confirm query plans use Trip(client_id), Shift(contractor_id), Ledger(driver_id), and Ledger(shift_id) indexes.
- [ ] Run the one-time development reset only after manual tests pass, following `docs/dev-reset-checklist.md`, and confirm the archived database with `npm run db:inspect`.
- [ ] Confirm a pre-migration backup that fails verification is deleted while the source database remains unchanged.
- [ ] Confirm the Statements page displays each row's note in its notes column.

## App and renderer

- [ ] Simulate a rejected IPC invocation and confirm loading resets, one non-blocking error notice appears, and the page remains usable.
- [ ] Confirm popup requests are denied and navigation or redirects outside the app renderer are blocked in development and packaged runs.
- [ ] Simulate a failed delete and confirm one visible non-blocking notice.
- [ ] Open AddTrip with the database unavailable and confirm one notice appears, not six.
- [ ] Confirm a failing save whose page already shows the error does not show a second notice.
- [ ] Double-click the app icon and confirm one window opens and the first is focused.
- [ ] Run `npm run dev` while the packaged app or another development instance is open and confirm the second instance exits.
- [ ] Switch contractor, driver, or client selection rapidly and confirm the displayed account always matches the selected name.
- [ ] Save or delete a movement, then change selection before it finishes; confirm the old account never replaces the new one.
- [ ] Clear the selection while loading and confirm the page remains empty.
- [ ] Open Add in each settings section and the ledger-entry, client-payment, and create-shift dialogs; confirm all fields start blank/default after switching from an edit or a previous Add.
- [ ] Confirm the settings, all-trips, shifts, shift-details, accounts, and statements pages keep the navbar visible and scroll table rows internally with a sticky header.
- [ ] Confirm the active navigation item is highlighted, every page has a visible title, and all table, summary, statement, details, and floating-window numbers use grouped Latin digits without changing input values.
- [ ] Confirm successful trip create/update notices are non-blocking and the Add Trip page no longer lists successful operations.
- [ ] Confirm Statements shows selection, totals, then the table.
- [ ] Confirm long names and notes wrap to two lines and show the full text on hover.
- [ ] Confirm every table fits a 1366×768 window without horizontal scrolling.
- [ ] Confirm all table headers and cells are centered.
- [ ] Confirm table sorting and filtering still work after text wrapping.
- [ ] Confirm table sum rows are unchanged by the layout.

## Backups and restore

- [ ] Close a shift and confirm a verified post-close database snapshot and any missing attachment mirror files appear under `userData/backups`.
- [ ] Start the app on a new local date and confirm a daily snapshot is created without delaying the window.
- [ ] Make the backups folder unwritable, restart the app, and confirm a non-blocking backup warning appears.
- [ ] Restore a database snapshot and missing attachments by following `docs/restore.md`.
