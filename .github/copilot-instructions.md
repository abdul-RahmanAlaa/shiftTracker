# Shift Tracker: Standing Rules (apply to every task)

## Scope

- Do only the requested item. If you find any other problem, do NOT fix it. Record it under "Noticed but did not touch" in `task-notes.md` (one line: file, problem, severity).
- Do not modify renderer files in a backend task unless the user approved an explicit exception. Any exception must be named (file + line) in the final report.
- Never run `git commit` or `git push`. The user decides.
- Decisions in the "Decisions" section (contractor balance sign, accounts page name "حركة النقدية", execution order, fresh-DB policy) are locked. Do not change or reopen them without an explicit user order.

## Database

- Any schema change MUST bump `CURRENT_VERSION` in `src/main/db.ts`, update `SCHEMA` (and any view/index) in the same task, and the report must say: "delete the local shift-tracker.db before testing".
- Current policy is: old databases are refused. If real user data may exist, ASK the user before deleting data or refusing an old database. Do not decide this alone.

## Code

- No `any`. No new `as never` or `as` casts used to bypass types. Fix the types instead.
- Every user-visible string goes into `ar.json` under a key. Add any new key in the same task. No hardcoded Arabic in the renderer.
- Use cases return `{ ok: true, data }` or `{ ok: false, errors }`. Never throw to the renderer.
- Every new main-process handler validates its input at runtime (not just `!x`). Distinguish `undefined` (not provided), `null` (explicit clear), and `0` (valid value).
- Every new IPC channel is added in all three places: use-case/handler in main, preload, and `index.d.ts`.

## Verification

- Run `npm run typecheck` and `npm run lint`. Report the real exit codes.
- Never write "verified" or "manually tested" unless the user explicitly said so, or you read it in source in this session. Code-complete means "fixed in code, not manually tested".
- For every item implemented but not confirmed by the user, add an unchecked manual scenario to `PROJECT.md` under Open items.
- If you added accounting logic, include one small numeric example in the report.

## Doc Sync

After any task that changes behavior, schema, decisions, or open items:

1. Rewrite the affected sections of `PROJECT.md` so they describe the verified current state.
2. Delete completed items from Open items; never append history or use phrases such as "fixed" or "added in".
3. Verify implementation facts against source and keep one canonical home for each project fact.

## Task reporting

After every task, write `task-notes.md` in UTF-8 without BOM with the sections Summary, Could not verify, and Noticed but did not touch; keep it to 25 lines maximum. Run `npm run review:gate` and tell the user to attach `last-task.md` only. Do not paste command outputs or diffs in chat.
