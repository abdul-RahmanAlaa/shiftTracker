# One-Time Development Database Reset

Use this procedure only after the manual tests pass. It is a manual development reset; the app has no in-app reset feature.

1. Close Shift Tracker and stop every `npm run dev` process.
2. Find the exact database directory in the app log line `[db] Database path: ...`. Confirm that the path belongs to this Shift Tracker installation. Call this path `$userData`.
3. Choose a dated archive directory outside `$userData`, for example `D:\ShiftTracker-archives\2026-10-13`.
4. Copy the named data to the archive. Include `shift-tracker.db`, and include `shift-tracker.db-wal` and `shift-tracker.db-shm` when present. Copy the complete `docs\` and `backups\` directories when present.

   ```powershell
   $userData = 'PASTE-THE-CONFIRMED-USERDATA-DIRECTORY'
   $archive = 'D:\ShiftTracker-archives\2026-10-13'
   New-Item -ItemType Directory -Force -Path $archive
   foreach ($name in @('shift-tracker.db', 'shift-tracker.db-wal', 'shift-tracker.db-shm')) {
     $source = Join-Path $userData $name
     if (Test-Path -LiteralPath $source) {
       Copy-Item -LiteralPath $source -Destination $archive
     }
   }
   foreach ($name in @('docs', 'backups')) {
     $source = Join-Path $userData $name
     if (Test-Path -LiteralPath $source) {
       Copy-Item -LiteralPath $source -Destination $archive -Recurse
     }
   }
   ```

5. Compare source and archive file counts and sizes. Inspect only the archived database:

   ```powershell
   Get-ChildItem -LiteralPath $userData -File -Recurse |
     Select-Object FullName, Length
   Get-ChildItem -LiteralPath $archive -File -Recurse |
     Select-Object FullName, Length
   npm run db:inspect -- (Join-Path $archive 'shift-tracker.db')
   ```

   Confirm the archived database has `integrity_check: ok`, and retain the archive even if inspection reports a problem.

6. After confirming the archive, delete only these named items if present. Do not delete `$userData` itself or any other contents.

   ```powershell
   foreach ($name in @('shift-tracker.db', 'shift-tracker.db-wal', 'shift-tracker.db-shm')) {
     $target = Join-Path $userData $name
     if (Test-Path -LiteralPath $target) {
       Remove-Item -LiteralPath $target
     }
   }
   foreach ($name in @('docs', 'backups')) {
     $target = Join-Path $userData $name
     if (Test-Path -LiteralPath $target) {
       Remove-Item -LiteralPath $target -Recurse
     }
   }
   ```

7. Start the app. Confirm `[db] Database path: ...` points to the intended directory and `[db] Schema version: ...` reports the latest supported version.
8. Create the first shift and trip; confirm their IDs are `SH-0001` and `TRP-0001`.
9. Keep the dated archive in its external location.
