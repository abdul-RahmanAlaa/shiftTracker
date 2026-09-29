# App File Tree

Excludes `node_modules` and `.git`.

```text
shiftTracker
+-- .vscode
|   +-- extensions.json
|   +-- launch.json
|   \-- settings.json
+-- build
|   +-- entitlements.mac.plist
|   +-- icon.icns
|   +-- icon.ico
|   \-- icon.png
+-- out
|   +-- main
|   |   \-- index.js
|   +-- preload
|   |   \-- index.js
|   \-- renderer
|       +-- assets
|       |   +-- index-B2jcGTWE.js
|       |   \-- index-SrO59TqY.css
|       \-- index.html
+-- resources
|   \-- icon.png
+-- src
|   +-- main
|   |   +-- repository
|   |   |   +-- accountsRepository.ts
|   |   |   +-- clientRepository.ts
|   |   |   +-- contractorRepository.ts
|   |   |   +-- crusherRepository.ts
|   |   |   +-- driverRepository.ts
|   |   |   +-- ledgerRepository.ts
|   |   |   +-- listRepository.ts
|   |   |   +-- shiftRepository.ts
|   |   |   +-- tripRepository.ts
|   |   |   \-- vehicleRepository.ts
|   |   +-- use-cases
|   |   |   +-- closeShift.ts
|   |   |   +-- createClient.ts
|   |   |   +-- createClientPayment.ts
|   |   |   +-- createContractor.ts
|   |   |   +-- createCrusher.ts
|   |   |   +-- createDriver.ts
|   |   |   +-- createLedgerEntry.ts
|   |   |   +-- createShift.ts
|   |   |   +-- createTrip.ts
|   |   |   +-- createVehicle.ts
|   |   |   +-- getAccounts.ts
|   |   |   +-- importCsvData.ts
|   |   |   +-- listAllTripsData.ts
|   |   |   +-- listData.ts
|   |   |   +-- listLedgerData.ts
|   |   |   +-- listTripData.ts
|   |   |   +-- shiftPhoto.ts
|   |   |   \-- tripPhoto.ts
|   |   +-- backup.ts
|   |   +-- db.ts
|   |   +-- index.ts
|   |   \-- photoStorage.ts
|   +-- preload
|   |   +-- index.d.ts
|   |   \-- index.ts
|   \-- renderer
|       +-- src
|       |   +-- assets
|       |   |   +-- base.css
|       |   |   +-- electron.svg
|       |   |   +-- main.css
|       |   |   \-- wavy-lines.svg
|       |   +-- components
|       |   |   +-- ui
|       |   |   |   +-- badge.tsx
|       |   |   |   +-- button.tsx
|       |   |   |   +-- calendar.tsx
|       |   |   |   +-- card.tsx
|       |   |   |   +-- checkbox.tsx
|       |   |   |   +-- command.tsx
|       |   |   |   +-- date-picker.tsx
|       |   |   |   +-- dialog.tsx
|       |   |   |   +-- form.tsx
|       |   |   |   +-- input.tsx
|       |   |   |   +-- label.tsx
|       |   |   |   +-- popover.tsx
|       |   |   |   +-- select.tsx
|       |   |   |   +-- table.tsx
|       |   |   |   \-- textarea.tsx
|       |   |   +-- CreateShiftForm.tsx
|       |   |   +-- DataTable.tsx
|       |   |   +-- FloatingWindow.tsx
|       |   |   +-- FloatingWindowsContext.ts
|       |   |   +-- FloatingWindowsProvider.tsx
|       |   |   +-- LedgerEntryDetailsContent.tsx
|       |   |   +-- LedgerEntryForm.tsx
|       |   |   +-- ReceiptPhoto.tsx
|       |   |   \-- TripDetailsContent.tsx
|       |   +-- lib
|       |   |   \-- utils.ts
|       |   +-- pages
|       |   |   +-- accounts
|       |   |   |   +-- AccountTables.tsx
|       |   |   |   +-- AllMovementsPage.tsx
|       |   |   |   +-- ClientAccountPage.tsx
|       |   |   |   +-- ContractorAccountPage.tsx
|       |   |   |   \-- DriverHistoryPage.tsx
|       |   |   +-- settings
|       |   |   |   +-- ClientsSettings.tsx
|       |   |   |   +-- ContractorsSettings.tsx
|       |   |   |   +-- CrushersSettings.tsx
|       |   |   |   +-- DriversSettings.tsx
|       |   |   |   \-- VehiclesSettings.tsx
|       |   |   +-- AccountsPage.tsx
|       |   |   +-- AddTripPage.tsx
|       |   |   +-- AllTripsPage.tsx
|       |   |   +-- ImportPage.tsx
|       |   |   +-- SettingsPage.tsx
|       |   |   \-- ShiftsPage.tsx
|       |   +-- App.tsx
|       |   +-- env.d.ts
|       |   \-- main.tsx
|       \-- index.html
+-- .editorconfig
+-- .eslintcache
+-- .gitattributes
+-- .gitignore
+-- .prettierignore
+-- .prettierrc.yaml
+-- app-file-tree.md
+-- components.json
+-- electron.vite.config.ts
+-- electron-builder.yml
+-- eslint.config.mjs
+-- package.json
+-- package-lock.json
+-- README.md
+-- shift-app-todo.md
+-- shift-tracker-context.md
+-- tsconfig.json
+-- tsconfig.node.json
\-- tsconfig.web.json
```
