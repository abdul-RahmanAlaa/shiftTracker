import { app } from 'electron'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, cpSync } from 'fs'
import Database from 'better-sqlite3'
import { getDb } from './db'

export function createVerifiedDatabaseBackup(
  db: Database.Database,
  backupPath: string,
  expectedVersion: number
): void {
  mkdirSync(dirname(backupPath), { recursive: true })
  const escapedPath = backupPath.replace(/'/g, "''")
  db.exec(`VACUUM INTO '${escapedPath}'`)

  const backupDb = new Database(backupPath, { readonly: true, fileMustExist: true })
  try {
    const integrity = backupDb.pragma('integrity_check', { simple: true })
    const version = backupDb.pragma('user_version', { simple: true })
    if (integrity !== 'ok' || version !== expectedVersion) {
      throw new Error(
        `Migration backup verification failed: integrity=${String(integrity)}, user_version=${String(version)}`
      )
    }
  } finally {
    backupDb.close()
  }
}

export function backupDatabase(): void {
  const db = getDb()
  const backupDir = join(app.getPath('userData'), 'backups')
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDbPath = join(backupDir, `shift-tracker-${timestamp}.db`)

  db.exec(`VACUUM INTO '${backupDbPath.replace(/'/g, "''")}'`)

  const docsSource = join(app.getPath('userData'), 'docs')
  if (existsSync(docsSource)) {
    cpSync(docsSource, join(backupDir, `docs-${timestamp}`), { recursive: true })
  }
}
