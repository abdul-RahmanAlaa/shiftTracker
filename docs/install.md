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
