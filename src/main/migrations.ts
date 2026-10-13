import type Database from 'better-sqlite3'
import { join } from 'path'
import { createVerifiedDatabaseBackup } from './backup'

export interface Migration {
  version: number
  name: string
  foreignKeys?: 'off'
  up(db: Database.Database): void
}

export interface MigrationOptions {
  baselineVersion: number
  backupDirectory: string
}

export type MigrationErrorCode =
  | 'UNVERSIONED_DATABASE'
  | 'UNSUPPORTED_OLD_VERSION'
  | 'NEWER_DATABASE_VERSION'
  | 'INVALID_MIGRATION_SEQUENCE'
  | 'BACKUP_FAILED'
  | 'MIGRATION_FAILED'

export class MigrationError extends Error {
  constructor(
    readonly code: MigrationErrorCode,
    message: string,
    readonly version: number,
    readonly backupPath?: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'MigrationError'
  }
}

export const migrations: Migration[] = []

function getUserTables(db: Database.Database): string[] {
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all() as { name: string }[]
  return rows.map((row) => row.name)
}

function migrationBackupPath(
  options: MigrationOptions,
  fromVersion: number,
  toVersion: number
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return join(
    options.backupDirectory,
    `pre-migration-v${fromVersion}-to-v${toVersion}-${timestamp}.db`
  )
}

function validateMigrationSequence(migrationsToRun: Migration[], baselineVersion: number): void {
  let expectedVersion = baselineVersion + 1
  for (const migration of migrationsToRun) {
    if (
      !Number.isSafeInteger(migration.version) ||
      migration.version !== expectedVersion ||
      !migration.name.trim() ||
      typeof migration.up !== 'function'
    ) {
      throw new MigrationError(
        'INVALID_MIGRATION_SEQUENCE',
        `Expected a named migration at version ${expectedVersion}`,
        migration.version
      )
    }
    expectedVersion += 1
  }
}

export function runMigrations(
  db: Database.Database,
  migrationList: Migration[],
  options: MigrationOptions
): void {
  const { baselineVersion } = options
  if (!Number.isSafeInteger(baselineVersion) || baselineVersion < 1) {
    throw new MigrationError(
      'INVALID_MIGRATION_SEQUENCE',
      'The baseline version must be a positive integer',
      baselineVersion
    )
  }

  const orderedMigrations = [...migrationList].sort((left, right) => left.version - right.version)
  validateMigrationSequence(orderedMigrations, baselineVersion)
  const latestVersion = orderedMigrations.at(-1)?.version ?? baselineVersion
  const currentVersion = db.pragma('user_version', { simple: true }) as number
  const userTables = getUserTables(db)

  if (currentVersion === 0 && userTables.length > 0) {
    throw new MigrationError(
      'UNVERSIONED_DATABASE',
      `Unversioned database contains user tables: ${userTables.join(', ')}`,
      currentVersion
    )
  }
  if (currentVersion > 0 && currentVersion < baselineVersion) {
    throw new MigrationError(
      'UNSUPPORTED_OLD_VERSION',
      `Database version ${currentVersion} is below baseline ${baselineVersion}`,
      currentVersion
    )
  }
  if (currentVersion > latestVersion) {
    throw new MigrationError(
      'NEWER_DATABASE_VERSION',
      `Database version ${currentVersion} is newer than supported version ${latestVersion}`,
      currentVersion
    )
  }
  if (currentVersion === 0 || currentVersion === latestVersion) return

  const backupPath = migrationBackupPath(options, currentVersion, latestVersion)
  try {
    createVerifiedDatabaseBackup(db, backupPath, currentVersion)
  } catch (error) {
    throw new MigrationError(
      'BACKUP_FAILED',
      `Unable to create and verify the pre-migration backup: ${backupPath}`,
      currentVersion,
      backupPath,
      { cause: error }
    )
  }

  let version = currentVersion
  for (const migration of orderedMigrations.filter((entry) => entry.version > currentVersion)) {
    if (migration.version !== version + 1) {
      throw new MigrationError(
        'INVALID_MIGRATION_SEQUENCE',
        `Expected migration ${version + 1}, found ${migration.version}`,
        version,
        backupPath
      )
    }

    if (migration.foreignKeys === 'off') db.pragma('foreign_keys = OFF')
    try {
      db.transaction(() => {
        migration.up(db)
        db.pragma(`user_version = ${migration.version}`)
        if (migration.foreignKeys === 'off') {
          const violations = db.pragma('foreign_key_check') as {
            table: string
            rowid: number | null
            parent: string
            fkid: number
          }[]
          if (violations.length > 0) {
            throw new Error(`Foreign-key check failed: ${JSON.stringify(violations)}`)
          }
        }
      })()
      version = migration.version
    } catch (error) {
      throw new MigrationError(
        'MIGRATION_FAILED',
        `Migration ${migration.version} (${migration.name}) failed`,
        version,
        backupPath,
        { cause: error }
      )
    } finally {
      if (migration.foreignKeys === 'off') db.pragma('foreign_keys = ON')
    }
  }
}
