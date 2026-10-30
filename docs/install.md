# Build the Windows installer

## Requirements

- Windows
- Node.js and npm available on `PATH`
- Internet access the first time dependencies need to be installed

## Double-click build

Double-click `build-installer.bat` in the repository root. The script changes to its own directory, runs `npm install` only when the `node_modules` directory is missing, and then runs `npm run build:win`. On success, it opens the `dist` output folder in Explorer and pauses before closing. If a command fails or the output folder is missing, it displays the error and pauses so the details remain visible.

## Build from a terminal

From the repository root, run:

```powershell
npm run build:win
```

The Windows installer is written to `dist`. Keep the terminal open to inspect build errors.

## Create a source-only ZIP

From the repository root in Windows PowerShell, create a ZIP in the temporary directory without build outputs, dependencies, caches, Git data, or local task reports:

```powershell
$archive = Join-Path $env:TEMP "shift-tracker-source-$((Get-Date).ToString('yyyyMMdd-HHmmss')).zip"; tar.exe -a -c -f $archive --exclude=.git --exclude=node_modules --exclude=dist --exclude=out --exclude=test-results --exclude=playwright-report --exclude=.eslintcache --exclude=.DS_Store --exclude='*.log*' --exclude=last-task.md --exclude=task-notes.md --exclude=status-report.md --exclude=scripts/last-harness-output.txt --exclude=scripts/.verify-closed-shift-use-cases.bundle.cjs .
```
