# Restore database and attachments

## Backup layout

- Verified SQLite snapshots are stored in `userData/backups/db/`.
- `post-close-<timestamp>-<shiftId>.db` captures the database after a successful shift close.
- `daily-<YYYY-MM-DD>.db` is the first verified snapshot created on that local date after app startup.
- The attachment mirror is stored in `userData/backups/attachments/`. It contains copies of files from `userData/docs/attachments`. Existing mirrored files are never removed; files with a different size are recopied.
- Backup files are on the same disk as the app data. Keep an external copy for protection against disk failure.

Post-close snapshots are useful for restoring a particular shift-close point. The daily snapshot is useful as a broader once-per-day recovery point. Both contain the database only; restore attachments separately from the mirror when required.

## PowerShell restore

1. Close the app and verify that all its processes have exited.
2. Set the app's `userData` directory and archive the current database files before restoring:

   ```powershell
   $userData = Read-Host 'Enter the app userData directory'
   $archive = Join-Path $env:USERPROFILE ("shift-tracker-before-restore-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
   New-Item -ItemType Directory -Path $archive | Out-Null
   foreach ($name in @('shift-tracker.db', 'shift-tracker.db-wal', 'shift-tracker.db-shm')) {
     $source = Join-Path $userData $name
     if (Test-Path -LiteralPath $source) {
       Copy-Item -LiteralPath $source -Destination (Join-Path $archive $name) -Force
     }
   }
   ```

3. Select a database snapshot. Use a post-close snapshot for a known close point, or a daily snapshot for the daily recovery point:

   ```powershell
   $backupFile = Read-Host 'Enter the full path to the selected snapshot .db file'
   if (-not (Test-Path -LiteralPath $backupFile -PathType Leaf)) {
     throw 'The selected backup file does not exist.'
   }
   ```

4. Remove stale WAL sidecars, then restore the selected snapshot:

   ```powershell
   $databasePath = Join-Path $userData 'shift-tracker.db'
   foreach ($name in @("$databasePath-wal", "$databasePath-shm")) {
     if (Test-Path -LiteralPath $name) {
       Remove-Item -LiteralPath $name -Force
     }
   }
   Copy-Item -LiteralPath $backupFile -Destination $databasePath -Force
   ```

5. From the repository root, inspect the restored database before starting the app:

   ```powershell
   npm run db:inspect -- "$databasePath"
   ```

6. Start the app, confirm that the database opens as expected, then close it before restoring attachments.
7. To restore missing attachments only, copy files from the mirror without overwriting files already in `docs/attachments`:

   ```powershell
   $backupAttachments = Join-Path $userData 'backups\attachments'
   $attachments = Join-Path $userData 'docs\attachments'
   if (Test-Path -LiteralPath $backupAttachments -PathType Container) {
     Get-ChildItem -LiteralPath $backupAttachments -File -Recurse | ForEach-Object {
       $relativePath = [System.IO.Path]::GetRelativePath($backupAttachments, $_.FullName)
       $destination = Join-Path $attachments $relativePath
       if (-not (Test-Path -LiteralPath $destination)) {
         $destinationDirectory = Split-Path -Parent $destination
         New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
         Copy-Item -LiteralPath $_.FullName -Destination $destination
       }
     }
   }
   ```

8. Start the app again and confirm that restored attachments open.
