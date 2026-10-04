# Shift Tracker TODO: Source Audit

Updated from checked-out source on 2026-10-03 (`HEAD` `9c5c453`). Checked items confirm code exists; they do not claim every flow was manually tested in Electron.

## Implemented in Current Source

- [x] Fresh-install schema contains `MaterialType`, `Attachment`, client/contractor opening-balance fields, and `Trip.material_type_id` (`user_version` target 11).
- [x] Main-process entity create/list/update/delete use cases and IPC handlers exist for drivers, clients, crushers, contractors, vehicles, and material types.
- [x] Shift creation/closure and trip create/update/delete are implemented; trip create/update requires `materialTypeId`.
- [x] Attachment persistence/list/read/remove flows exist; `closeShift` validates attachments and reported trip count.
- [x] Ledger, client payments, account queries, and client/contractor statement APIs exist.
- [x] Renderer routes exist for `/`, `/shifts`, `/shifts/:shiftId`, `/all-trips`, `/accounts`, `/statements`, and `/settings`.
- [x] Settings pages include six entity sections; client location/opening balance/date and contractor opening balance/date are in their forms and tables.
- [x] `/statements` is implemented for clients and contractors. `/accounts` remains separate and is now labeled **حركة النقدية**.
- [x] Client/Contractor fields removed by `e8921fc` under the mistaken assumption that they were unused have been restored.
- [x] إعادة تسمية الحسابات: تم اعتماد الاسم النهائي **حركة النقدية**، وليس **الخزينة**، وهو الاسم الذي سيتم الاحتفاظ به وعدم إعادة مناقشته.

## Fixed in Current Source

- [x] B2: Optional update fields preserve existing values when omitted, rather than resetting to `0`/`null` during client and contractor updates.
- [x] B5: Deleted trips no longer reuse IDs; `TripIdCounter` provides a monotonic ID source, and trip deletion removes attachment rows plus stored photo files in the same operation.
- [x] B6: Attachment path traversal is blocked, validator checks reject invalid JPEGs and invalid entity/kind pairs, closed-shift attachment edits are blocked, and `getAttachmentPhoto` now relies on `attachmentId` instead of raw paths.
- [x] B8: Migration safety is resolved by resetting the schema to a single clean baseline at `user_version = 1`. Any old local database must be deleted manually; there is no historical migration chain left to support or gap-fill.

## Gaps Confirmed in Current Source

1. No CSV import/export workflow is present under `src`: no `ImportPage`, route, IPC handler, or CSV use case. Decide separately whether CSV support is still wanted; the PapaParse dependency is not an implementation.
2. There is no `npm test` script or tracked test/spec file. Add automated tests as a separately scoped task if desired.

## Verification Status Not Derivable from Source

Whether routes and workflows have been manually exercised in the packaged Electron application is not recorded in source. Typecheck/lint results alone do not establish runtime verification.
