# Restore database and attachments

## Backup contents

- A pre-migration backup is a standalone SQLite database snapshot created with `VACUUM INTO` immediately before a migration. The app opens it read-only and checks `integrity_check` and `user_version`. It contains no `userData/docs` directory or other user-data files. A failed verification removes that backup file.
- A regular backup is a standalone SQLite database snapshot named `backups/shift-tracker-<timestamp>.db`. When `userData/docs` exists, `backupDatabase()` also copies that entire directory to the matching `backups/docs-<timestamp>` directory. It does not copy other `userData` files or preserve the active `-wal` and `-shm` sidecars as backup files.
- Trip attachment JPEGs are stored below `userData/docs/attachments`; a database-only backup therefore does not contain the attachment files. Restore a matching regular-backup `docs-<timestamp>` directory separately when those files are needed. Pre-migration database backups have no paired docs backup.

## PowerShell restore

1. Close the app and verify that all its processes have exited.
2. Set the exact Electron `userData` directory for this installation, then archive the current database files and the current `docs` folder:

   ```powershell
   $userData = Read-Host 'Enter the app userData directory'
   $archive = Join-Path $env:USERPROFILE ("shift-tracker-before-restore-" + (Get-Date -Format 'yyyyMMdd-HHmmss'))
   New-Item -ItemType Directory -Path $archive | Out-Null
   foreach ($name in @('shift-tracker.db', 'shift-tracker.db-wal', 'shift-tracker.db-shm', 'docs')) {
     $source = Join-Path $userData $name
     if (Test-Path -LiteralPath $source) {
       Copy-Item -LiteralPath $source -Destination (Join-Path $archive $name) -Recurse -Force
     }
   }
   ```

3. Choose the database backup file. Prefer a regular `shift-tracker-<timestamp>.db` with its matching `docs-<timestamp>` when attachments are needed. A pre-migration backup may use an older schema version and may require the app version that created it.

   ```powershell
   $backupFile = Read-Host 'Enter the full path to the selected .db backup'
   if (-not (Test-Path -LiteralPath $backupFile -PathType Leaf)) {
     throw 'The selected backup file does not exist.'
   }
   ```

4. Remove stale WAL sidecars from the restore target:

   ```powershell
   $databasePath = Join-Path $userData 'shift-tracker.db'
   Remove-Item -LiteralPath "$databasePath-wal", "$databasePath-shm" -Force -ErrorAction SilentlyContinue
   ```

5. Copy the selected database backup over `shift-tracker.db`:

   ```powershell
   Copy-Item -LiteralPath $backupFile -Destination $databasePath -Force
   ```

6. From the repository root, inspect the restored database:

   ```powershell
   npm run db:inspect -- "$databasePath"
   ```

7. Start the app and confirm that the database opens as expected, then close it before touching attachment files.
8. When attachments are needed and a matching regular-backup docs folder exists, restore it separately after confirming the current `docs` directory is safely archived:

   ```powershell
   $backupDocs = Read-Host 'Enter the full path to the matching docs-<timestamp> directory'
   if (-not (Test-Path -LiteralPath $backupDocs -PathType Container)) {
     throw 'The selected attachment backup directory does not exist.'
   }
   $docsPath = Join-Path $userData 'docs'
   if (Test-Path -LiteralPath $docsPath) {
     Move-Item -LiteralPath $docsPath -Destination (Join-Path $archive 'docs-before-attachment-restore')
   }
   Copy-Item -LiteralPath $backupDocs -Destination $docsPath -Recurse
   ```

9. Start the app again and confirm the restored attachments open.
