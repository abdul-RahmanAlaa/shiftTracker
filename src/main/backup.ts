import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, cpSync } from 'fs'
import { getDb } from './db'

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
