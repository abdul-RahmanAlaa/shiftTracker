# App File Tree

Generated from tracked files in the current checkout. Excludes `.git`, `node_modules`, generated `out`, and the local ESLint cache.

```text
shiftTracker/
|-- .editorconfig
|-- .gitattributes
|-- .gitignore
|-- .prettierignore
|-- .prettierrc.yaml
|-- .vscode/
|   |-- extensions.json
|   |-- launch.json
|   `-- settings.json
|-- README.md
|-- app-context.md
|-- app-file-tree.md
|-- app-todo.md
|-- build/
|   |-- entitlements.mac.plist
|   |-- icon.icns
|   |-- icon.ico
|   `-- icon.png
|-- components.json
|-- electron-builder.yml
|-- electron.vite.config.ts
|-- eslint.config.mjs
|-- package-lock.json
|-- package.json
|-- resources/
|   `-- icon.png
|-- shift-app-todo.md
|-- shift-tracker-context.md
|-- src/
|   |-- main/
|   |   |-- backup.ts
|   |   |-- db.ts
|   |   |-- index.ts
|   |   |-- photoStorage.ts
|   |   |-- repository/
|   |   |   |-- accountsRepository.ts
|   |   |   |-- attachmentRepository.ts
|   |   |   |-- clientRepository.ts
|   |   |   |-- contractorRepository.ts
|   |   |   |-- crusherRepository.ts
|   |   |   |-- driverRepository.ts
|   |   |   |-- ledgerRepository.ts
|   |   |   |-- listRepository.ts
|   |   |   |-- materialTypeRepository.ts
|   |   |   |-- shiftRepository.ts
|   |   |   |-- statementRepository.ts
|   |   |   |-- tripRepository.ts
|   |   |   `-- vehicleRepository.ts
|   |   `-- use-cases/
|   |       |-- attachmentPhoto.ts
|   |       |-- closeShift.ts
|   |       |-- createClient.ts
|   |       |-- createClientPayment.ts
|   |       |-- createContractor.ts
|   |       |-- createCrusher.ts
|   |       |-- createDriver.ts
|   |       |-- createLedgerEntry.ts
|   |       |-- createMaterialType.ts
|   |       |-- createShift.ts
|   |       |-- createTrip.ts
|   |       |-- createVehicle.ts
|   |       |-- getAccounts.ts
|   |       |-- getStatement.ts
|   |       |-- listAllTripsData.ts
|   |       |-- listData.ts
|   |       |-- listLedgerData.ts
|   |       `-- listTripData.ts
|   |-- preload/
|   |   |-- index.d.ts
|   |   `-- index.ts
|   `-- renderer/
|       |-- index.html
|       `-- src/
|           |-- App.tsx
|           |-- env.d.ts
|           |-- main.tsx
|           |-- assets/
|           |   |-- base.css
|           |   |-- electron.svg
|           |   |-- main.css
|           |   `-- wavy-lines.svg
|           |-- components/
|           |   |-- AttachmentManager.tsx
|           |   |-- CreateShiftForm.tsx
|           |   |-- DataTable.tsx
|           |   |-- FloatingWindow.tsx
|           |   |-- FloatingWindowsContext.ts
|           |   |-- FloatingWindowsProvider.tsx
|           |   |-- LedgerEntryDetailsContent.tsx
|           |   |-- LedgerEntryForm.tsx
|           |   |-- ShiftBreadcrumb.tsx
|           |   |-- SubmitButton.tsx
|           |   |-- TripDetailsContent.tsx
|           |   `-- ui/
|           |       |-- badge.tsx
|           |       |-- button.tsx
|           |       |-- calendar.tsx
|           |       |-- card.tsx
|           |       |-- checkbox.tsx
|           |       |-- command.tsx
|           |       |-- date-picker.tsx
|           |       |-- dialog.tsx
|           |       |-- form.tsx
|           |       |-- input.tsx
|           |       |-- label.tsx
|           |       |-- popover.tsx
|           |       |-- select.tsx
|           |       |-- skeleton.tsx
|           |       |-- table.tsx
|           |       `-- textarea.tsx
|           |-- i18n/
|           |   |-- index.ts
|           |   `-- locales/
|           |       `-- ar.json
|           |-- lib/
|           |   `-- utils.ts
|           `-- pages/
|               |-- AccountsPage.tsx
|               |-- AddTripPage.tsx
|               |-- AllTripsPage.tsx
|               |-- SettingsPage.tsx
|               |-- ShiftDetailPage.tsx
|               |-- ShiftsPage.tsx
|               |-- StatementsPage.tsx
|               |-- accounts/
|               |   |-- AccountTables.tsx
|               |   |-- AllMovementsPage.tsx
|               |   |-- ClientAccountPage.tsx
|               |   |-- ContractorAccountPage.tsx
|               |   `-- DriverHistoryPage.tsx
|               `-- settings/
|                   |-- ClientsSettings.tsx
|                   |-- ContractorsSettings.tsx
|                   |-- CrushersSettings.tsx
|                   |-- DriversSettings.tsx
|                   |-- MaterialTypesSettings.tsx
|                   `-- VehiclesSettings.tsx
|-- tsconfig.json
|-- tsconfig.node.json
`-- tsconfig.web.json
```
