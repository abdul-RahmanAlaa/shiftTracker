# Shift Tracker: Standing Rules (apply to every task)

## Scope
- Do only the requested item. If you find any other problem, do NOT fix it. Append it to a "Found while working" section at the end of `code-review-backlog.md` (one line: file, problem, severity).
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
- For every item marked "fixed in code", add an unchecked scenario to the Manual Test Checklist in `shift-app-todo.md`.
- If you added accounting logic, include one small numeric example in the report.

## Doc Sync (before reporting completion)
After ANY task that changes code, schema, behavior, decisions, or backlog status, update:
1. `shift-app-todo.md`: status line of affected items (B1 to B11 and risks), "Next Up", and the Manual Test Checklist (tick only if the user confirmed a test).
2. `shift-tracker-context.md`: changed facts (schema, CURRENT_VERSION, routes/labels, use-case behavior). Verify each fact against source first.
3. `code-review-backlog.md`: the Status line of affected items, plus the "Found while working" section. Never rewrite or delete original problem text or proposed fixes.
- Keep the "Decisions" sections identical in `shift-tracker-context.md` and `shift-app-todo.md`.
- One canonical home per fact: status in todo, facts in context, full finding text in backlog. Remove duplication instead of adding it.
- If nothing doc-relevant changed, say so explicitly. Do not skip silently.

## Final report format
1. Summary of what changed.
2. "Docs updated": one line per file, or "no change needed" with the reason.
3. Real `git diff --stat` and real `git diff` (not a handwritten summary).
4. "Could not verify": list everything not verified from source, even if empty.
5. Copyable output: at the end of every task, write the full final report to `last-report.md` and the full real diff to `last-diff.patch` (`git diff > last-diff.patch`, overwrite each time; if the task added new untracked files, also append them with `git diff --no-index /dev/null <file>` or list them). Do not print the whole diff in chat; print the report and say which files to attach.
6. The report must contain only the report: no internal notes, no drafts, no planning text, no truncation. Plain markdown only.
7. Language: write every response in English; switch only if the user explicitly asks in the current message. Do not translate existing Arabic text.
