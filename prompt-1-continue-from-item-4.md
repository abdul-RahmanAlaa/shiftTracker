# Task (CONTINUATION): resume the 14-item cleanup and hardening plan at Item 4

Items 1, 2 and 3 are DONE and validated in this workspace (the 13 changed files). Do NOT redo or re-verify them beyond running the normal checks. The original prompt was lost when your context was summarized, so the full plan is below. Continue strictly in order: 4, 5, 6, ... 14.

Before starting, read: `.github/copilot-instructions.md`, `PROJECT.md`, `docs/e2e-test-cases.md`, `scripts/review-gate.cjs`, and the current `task-notes.md` (it holds the Item 1-3 results).

## Execution rules (these override the standing "do only the requested item" rule for the 14 items below, and ONLY for them)

1. This task authorizes exactly the 14 items below, including renderer, preload, config, helper and doc changes they need. Any other problem you find: do NOT fix it. One line in `task-notes.md` under "Noticed but did not touch" (file, problem, severity).
2. Do the items strictly in order 1 → 14. Finish and verify one item before starting the next. Never batch items.
3. Items 5-8 and 14 are refactors: behavior-preserving. No visible UI or text change unless the item says so. No schema change. No change to money logic (`src/main/accounting.ts` stays untouched). If an item seems to need a schema change, stop that item and report.
4. After EACH item run, in this order, and fix failures before moving on:
   - `npm run typecheck`
   - `npm run lint`
   - `npm run verify:use-cases` (case count must never drop below the current count)
   - `npm run test:e2e`
   - if the item touched renderer files or `e2e/helpers.cjs`: also `npm run test:e2e:full -- closed-shift-protection.spec.cjs` and `npm run test:e2e:full -- closed-shift-locks.spec.cjs`
   - `npm run review:gate`
   Run E2E suites one at a time, never concurrently (concurrent runs previously caused a startup-probe failure).
5. If an item cannot be completed without breaking a rule or a test you cannot fix, revert only that item's changes, record the reason in `task-notes.md`, and continue with the next item.
6. Never run `git commit` or `git push`. No new dependencies unless an item says so. No `any`, no new `as never` / bypass casts. Every new user-visible string goes into `ar.json`. No hardcoded Arabic in the renderer.
7. Doc sync after each item: rewrite the affected `PROJECT.md` sections to describe the verified current state (no history wording, no "fixed"/"added in"), delete completed Open items, and add an unchecked manual scenario for anything a human must confirm in Electron.
8. Progress tracking: after each item overwrite `task-notes.md` (UTF-8 no BOM, max 25 lines) with a first line `DONE: items 1..n | NEXT: n+1`. If you must stop early, stop cleanly after a finished and verified item with that line, so a follow-up "continue" can resume.
9. Never write "verified" or "manually tested" for anything only the user can confirm in Electron. Say "code-complete, not manually tested".

---

---

### Item 4: Unhandled promise rejections in the renderer (B9)
- There are about 20 `.then(` calls and only 2 `.catch(` calls in `src/renderer/src`. List every `.then(` chain and every `await window.api...` / `ipcApi...` call that has no `try/catch`, `.catch`, or documented handling via `ipcApi` in `src/renderer/src/lib/ipcErrors.ts`.
- Read `ipcErrors.ts` first and confirm precisely what it already catches (rejected invocations, `ok:false` results). Only add handling where a failure would currently be silent (stuck loading state, empty table with no message, unhandled rejection).
- Use the existing notice mechanism and existing translation keys; add keys only when none fits. Loading flags must always reset in `finally`.
- Also confirm all remaining direct `window.api.` calls (there are 5) go through the same error handling, or route them through `ipcApi`.
- Done when: no unhandled rejection path remains in the audited list, and the audit result (counts before/after) is in `task-notes.md`.

---

## PHASE B: Medium priority (cleanup)

### Item 5: Remove `as never` in `src/renderer/src/pages/AddTripPage.tsx` (lines ~153-154)
- Replace `control as never` / `name as never` by correct generic typing (typed wrapper component or properly parameterized `Control<TFieldValues>` / `FieldPath<TFieldValues>`). No casts. Done when typecheck and lint pass and a grep for `as never` in `src` returns nothing.

### Item 6: Collapse the six near-identical settings pages
- `src/renderer/src/pages/settings/{Vehicles,Drivers,Contractors,Crushers,Clients,MaterialTypes}Settings.tsx` (~1,800 lines) repeat the same CRUD pattern.
- Extract a shared hook (list load with latest-request guard, create, update, delete with the shared confirm call, notices, blank-Add-after-Edit reset) and, where it truly reduces code, a shared table/dialog shell. Each entity keeps its own fields, validation schema, columns, and translation keys. Do not change any visible text, field order, validation message, or delete-failure notice (`ipcErrors.deleteFailed`).
- Route every delete confirmation through ONE function so Item 8 changes a single place.
- Done when: each settings page is under ~150 lines of entity-specific config, behavior is identical, smoke + closed-shift suites pass.

### Item 7: Split the oversized files (behavior-preserving)
Targets (aim for under ~400 lines per file, split by responsibility, not arbitrarily):
- `src/renderer/src/components/TripEntryGrid.tsx` (~896): separate row/cell components, paste handling, keyboard handling (Ctrl+D), suggestion fetching/caching hook, submit/save orchestration. Keep pure logic in `src/renderer/src/lib/tripGrid.ts`.
- `src/renderer/src/pages/AddTripPage.tsx` (~725), `ShiftsPage.tsx` (~534), `ShiftDetailPage.tsx` (~520): extract dialogs, forms and data hooks.
- `scripts/verify-closed-shift-use-cases.cjs` (~2,919 lines): split into per-area files under `scripts/verify/` (shifts, trips, ledger, accounting, statements, migrations, backup, grid, prices) plus a small runner. `npm run verify:use-cases` must keep the same command, the same result table format, the same exit-code behavior, and a case count that does not decrease (the review gate checks this).
- No renames of exported public names that other files or tests import unless you update every importer in the same item.
- Done when: no listed file exceeds ~400 lines, all checks and suites pass unchanged, and the `PROJECT.md` file map matches the new structure.

### Item 8: Replace native `confirm()` with an in-app ConfirmDialog
- 13 call sites use `confirm(...)`. Native confirm in Electron on Windows can leave inputs unfocused afterwards.
- Build `ConfirmDialog` plus a promise-based `useConfirm()` hook on the existing Radix `dialog.tsx`, RTL-correct, with title/message/confirm/cancel texts from `ar.json` (reuse existing keys where they exist), Escape = cancel, focus returns to the triggering element, destructive styling on the confirm button.
- Replace every `confirm(` in `src` (find them with grep; do not trust this count). Keep each existing message key.
- Update `e2e/helpers.cjs` and every existing spec so delete flows click the in-app dialog's confirm/cancel button instead of `page.once('dialog', ...)`. Keep `nextDialog` as a thin compatible wrapper if that minimizes churn. Add a guard in the delete flows asserting that NO native dialog event fires.
- Done when: `grep -rn "confirm(" src/renderer` finds nothing, and the whole existing E2E suite passes using the new dialog.

### Item 9: Dead code removal and i18n check (OI-005)
- `src/main/index.ts`: remove the `ipcMain.on('ping', ...)` boilerplate. Merge the split imports from `./use-cases/getAccounts` into one.
- `src/main/ipcWrapper.ts`: the `if (typeof result === 'object' ...) { return result }` branch is dead because both paths return `result`. Remove it, keep behavior identical (also fix any malformed generic such as `Promise<r>` if it is really in the file).
- Remove the unused dependencies `papaparse` and `@types/papaparse` with `npm uninstall` (this updates `package-lock.json`). Before removing, grep to confirm zero imports. Check `react-easy-crop`, `date-fns`, `cmdk`, `react-rnd`, `react-day-picker`, `lucide-react` are each actually imported and leave them.
- Remove unused `ar.json` keys: at least `shifts.validation.endDateRequired`, `shifts.validation.endDateInvalid`, `addTrip.logs.created`, `addTrip.logs.failed`. First confirm each is unused including dynamic key construction (`t(\`prefix.${x}\`)`); keep dynamically built keys.
- Do NOT remove the `console.log('[db] Database path:', ...)` in `src/main/db.ts` here; Item 14 decides its fate.
- Add `scripts/check-i18n.cjs` and an `npm run check:i18n` script that fails on (a) keys used in `src/renderer/src` via `t('...')` that are missing from `ar.json`, and (b) keys in `ar.json` never referenced (allow-list for dynamic prefixes in the script, documented at the top). Wire it into `scripts/review-gate.cjs` as a check. Update `PROJECT.md` section 2 command table and section 7.
- Done when: the checks pass, OI-005 is removed from Open items.

### Item 10: Large-table performance and attachment throughput (OI-003)
- Measure first. Add a script under `scripts/` (not run in the gate) that seeds an isolated temp database with 8,000 trips across 50 shifts using real use-cases, then measure All Trips initial render, sort, filter, and select-all-sum timings in the real Electron app via Playwright (a one-off script, not a gate test). Record numbers in `task-notes.md`.
- If All Trips renders and interacts in under ~1 second at 8,000 rows, make no table change and record the numbers. If not, implement row virtualization in `DataTable.tsx` with `@tanstack/react-virtual` (the one allowed new dependency, only if needed) keeping: sticky header, centered cells, nowrap column meta, sorting, distinct-value filtering, row selection and selected sums computed over ALL filtered rows (not only visible ones).
- OI-003: in `ShiftDetailPage.tsx` and `AttachmentManager.tsx`, stop requesting every full attachment data URI up front. Load a thumbnail/full image only when it is displayed or opened (lazy, with a small concurrency cap and the existing latest-request guard). Keep upload/delete controls, CLOSED-shift read-only behavior, and preview unchanged.
- Done when: numbers are recorded, OI-003 is removed, and attachment-related E2E (closed-shift suites) pass.

---

## PHASE C: Low priority (metadata, docs, tooling)

### Item 11: Packaging and app metadata (OI-006)
- `src/renderer/index.html`: `<title>` = the app's real Arabic name via the build-time constant you can find or add (do not hardcode Arabic in renderer TSX; HTML title is the one exception, add a comment) and `<html lang="ar" dir="rtl">`. Keep the CSP.
- `package.json`: replace the boilerplate `description`, `author`, `homepage` with neutral accurate values. Do NOT change `name` (it determines the `userData` path and therefore where user data lives).
- Do NOT change `appId` (changing it changes the Windows installer identity). Instead set `electronApp.setAppUserModelId(...)` in `src/main/index.ts` to exactly match the current `appId` (`com.electron.app`). Record in `task-notes.md` that choosing a real appId is the user's decision.
- `electron-builder.yml`: remove the unused `publish` block (`example.com/auto-updates`), the `mac`, `dmg`, and `linux`/`appImage` sections and their boilerplate camera/microphone/Documents/Downloads usage strings; also remove the `build:mac` / `build:linux` scripts. Keep Windows/NSIS settings and `build-installer.bat` working. Run `npm run build:unpack` to prove packaging still works, if it works in this environment, and say plainly if you could not run it.
- `src/main/index.ts` window: default size 1366×768 with a sensible `minWidth`/`minHeight`; keep `show: false` + `ready-to-show`.
- Done when: the items above are done and listed in `PROJECT.md` section 2/3 where relevant; add an unchecked manual scenario to install and launch the installer (OI-011 already exists, extend it).

### Item 12: Documentation fixes
- Replace the boilerplate `README.md` with a short accurate one: what the app is, prerequisites, install/dev/build/test commands, link to `PROJECT.md` and `docs/`.
- `PROJECT.md` Open items: merge OI-008 and OI-009 into one; remove any item completed in this task; make sure every remaining item is accurate against the source.
- `docs/e2e-test-cases.md`: make the "Seed modes" table match `e2e/seed.cjs` exactly (the code has `no-shift`, not `empty`; `two-shifts` already includes a CLOSED shift; mark which listed modes still do not exist). Fix the "Cov" column against the real spec files. Fix the totals.
- `docs/e2e-coverage-plan.md`: fix the claimed number of smoke tests and full tests to the real counts (count `testWithApp(` occurrences per spec; do not trust old numbers).
- Do not invent facts: every number you write must come from a command you ran.

### Item 13: Source-sharing hygiene
- Confirm `.gitignore` excludes `dist`, `out`, `test-results`, `playwright-report`, `.eslintcache`, and `node_modules`. Do NOT delete any local build output.
- Add a short section to `docs/install.md` or `README.md` with a Windows PowerShell command that creates a source-only zip (excluding `node_modules`, `dist`, `out`, `test-results`, `playwright-report`, `.eslintcache`, `.git`) for sharing the project. Test the command if you can and say if you could not.

### Item 14: Replace the E2E startup probe
- In `e2e/helpers.cjs`, `captureStartupDatabasePath` spawns an extra Electron per app launch and parses stdout for the database path. It is slow and was the cause of a flaky failure.
- Remove the extra spawn. The temp `userData` directory is already known to the test, so derive `shift-tracker.db` from it. Keep the safety guarantee the probe gave (the app under test must not touch real user data): after launching through Playwright, evaluate `app.getPath('userData')` in the Electron main process and assert it equals the temp directory BEFORE any other action; fail the test immediately otherwise.
- If nothing else consumes the `[db] Database path:` log line afterwards, remove that `console.log` from `src/main/db.ts`. If something does, leave it and say what.
- Done when: smoke + `test:e2e:full` (all existing specs) pass TWICE in a row, run sequentially, with no flaky failure, and the helper no longer spawns a second Electron process.

---

## Final steps
1. Run the complete set once more: typecheck, lint, `verify:use-cases`, `check:i18n`, `test:e2e:full` (all specs, sequentially), `review:gate`.
2. Write the final `task-notes.md` (UTF-8 no BOM, max 25 lines): one line per item with status (done / reverted + reason), the real counts (verify cases, E2E tests passed), "Could not verify", and "Noticed but did not touch". Do not paste command output or diffs in chat.
3. Tell me to attach `last-task.md` only.
