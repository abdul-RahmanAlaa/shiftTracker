/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const Database = require('better-sqlite3')
const path = require('node:path')

const scriptIndex = process.argv.findIndex(
  (argument) => path.basename(argument) === 'db-inspect.cjs'
)
const databaseArgument = scriptIndex >= 0 ? process.argv[scriptIndex + 1] : undefined
if (!databaseArgument) {
  console.error('Usage: npm run db:inspect -- <database-path>')
  process.exit(2)
}

const databasePath = path.resolve(databaseArgument)
let db
try {
  db = new Database(databasePath, { readonly: true, fileMustExist: true })
  const version = db.pragma('user_version', { simple: true })
  const integrity = db.pragma('integrity_check', { simple: true })
  console.log(`Database: ${databasePath}`)
  console.log(`user_version: ${version}`)
  console.log(`integrity_check: ${integrity}`)

  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all()
  console.log('Tables and row counts:')
  for (const { name } of tables) {
    const quotedName = `"${name.replace(/"/g, '""')}"`
    const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${quotedName}`).get()
    console.log(`- ${name}: ${count}`)
  }

  for (const table of ['Shift', 'Trip']) {
    if (!tables.some((entry) => entry.name === table)) {
      console.log(`${table} first id: (table absent)`)
      console.log(`${table} last id: (table absent)`)
      continue
    }
    const quotedName = `"${table}"`
    const first = db.prepare(`SELECT id FROM ${quotedName} ORDER BY id ASC LIMIT 1`).get()
    const last = db.prepare(`SELECT id FROM ${quotedName} ORDER BY id DESC LIMIT 1`).get()
    console.log(`${table} first id: ${first?.id ?? '(none)'}`)
    console.log(`${table} last id: ${last?.id ?? '(none)'}`)
  }

  if (integrity !== 'ok') process.exitCode = 1
} catch (error) {
  console.error(
    `Database inspection failed: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exitCode = 1
} finally {
  if (db?.open) db.close()
}

process.stdout.write('', () => process.exit(process.exitCode || 0))
