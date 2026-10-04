# Shift Tracker TODO

## Resume Instructions

New chat: attach [shift-tracker-context.md](shift-tracker-context.md), [shift-app-todo.md](shift-app-todo.md), [code-review-backlog.md](code-review-backlog.md).

## Standing Rules

Rules live in `.github/copilot-instructions.md`. Follow them and the Doc Sync rule on every task.

Updated from the current working tree. This file is the operational source-of-truth for the project status and is intentionally aligned to the code in the repo rather than stale historical notes.

## 📋 Code Review Backlog

- [x] B1: fixed; manually verified.
- [x] B2: fixed in code; manually verified by user.
- [ ] B3: open; detail components still compare enum values to old Arabic strings.
- [x] B4: fixed; manually verified. Follow-up remains open for six unused i18n keys and a missing-key check script.
- [x] B5: fixed in code (`TripIdCounter` and attachment-row cleanup in the trip-delete transaction); manually verified by user.
- [x] B6: fixed in code (attachmentId, 5MB/JPEG validation, closed-shift guard, closeShift file-exists check); manually verified by user. Approved renderer exception: one line in `AttachmentManager.tsx`.
- [ ] B7: open; decision pending on PUT versus PATCH semantics for ledger/clientPayment updates.
- [x] B8: resolved by decision; migration chain removed, old DBs refused, fresh DB required. No backup is made before schema initialization; the post-close backup risk remains open below.
- [ ] B9: open; delete failures and rejected IPC calls still need user-visible handling.
- [ ] B10: open; contractor/driver edit forms remain duplicated and unlocked.
- [ ] B11: open; table empty state, account number formatting, balance consistency, and duplicate payment notes need follow-up.

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
2. There is no `npm test` script or tracked test suite.

### Verification Status

The user confirmed all Manual Test Checklist scenarios passed in Electron using a fresh `shift-tracker.db`. This runtime result is user-reported and cannot be independently derived from source.

## Operational Notes

- `CURRENT_VERSION` is `2` in `src/main/db.ts`.
- A legacy database is rejected with an explicit error message telling the user to delete the local DB file and restart the app.
- No backup is created before schema initialization; `closeShift` still runs backup after closing without `try/catch`.
- The current UI label for the accounts page is `حركة النقدية`, not `الحسابات`.
- No migration path is retained in the source for earlier experimental schemas.

## Decisions

- Contractor balance sign is the reverse of client sign, using the same formula: client positive means the client owes us; contractor positive means we owe the contractor. This must be documented in the contractor statement UI. `StatementsPage` currently has no such note; this is an open task.
- Execution order: B2 + B8, then B6 + B7, then the rest.
- The Accounts page final name is `حركة النقدية`. Do not reopen this naming decision.
- The project uses a fresh-install database policy: schema reset is the supported path. Legacy migration logic is not retained; older local databases are refused.
- The source is the authority; stale docs and historical migration claims are ignored when they do not match checked-out code.

## Next Up

1. B7: decide PUT versus PATCH semantics for ledger and clientPayment updates, then address the finding.
2. B3: correct enum labels in detail views.
3. B9: show deletion errors and handle rejected IPC calls.
4. B10: use the shared ledger form for edits with locked IDs.
5. B11: fix the remaining smaller UI/accounting inconsistencies.

## Manual Test Checklist

- [x] Delete the local `shift-tracker.db` first.
- [x] Delete a trip with an attachment; verify attachment rows and the file are removed, and the trip ID is not reused.
- [x] Open an attachment photo through `attachmentId`.
- [x] Verify adding and removing attachments on a closed shift are rejected.
- [x] Verify uploads larger than 5MB and non-JPEG uploads are rejected.
- [x] Verify `closeShift` fails when a required attachment row exists but its file is missing.
- [x] Update a client without `location`, `openingBalance`, or `openingBalanceDate`, and a contractor without `phone`, `openingBalance`, or `openingBalanceDate`; verify existing values are preserved.
