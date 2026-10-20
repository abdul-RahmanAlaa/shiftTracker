import { dirname, join, relative } from 'path'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
  renameSync,
  readFileSync
} from 'fs'
import { copyFile, mkdir, readdir, stat } from 'fs/promises'
import Database from 'better-sqlite3'

export interface BackupStatus {
  lastSuccessAt: string | null
  lastError: string | null
}

export interface AttachmentMirrorCounts {
  copied: number
  skipped: number
  failed: number
}

type BackupResult<T> =
  { ok: true; data: T } | { ok: false; errors: { field: string; message: string }[] }

export interface BackupSuccessData {
  snapshotPath: string
  attachments: AttachmentMirrorCounts
}

const dailyRetention = 60
const postCloseRetention = 120
const mirrorConcurrency = 4

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function localDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function fileTimestamp(now: Date): string {
  return now.toISOString().replace(/:/g, '-').replace(/\./g, '-')
}

function ensureDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true })
}

function removePartialSnapshot(path: string): void {
  try {
    rmSync(path, { force: true })
  } catch {
    // Keep the original verification failure.
  }
}

export function verifyDatabaseSnapshot(
  snapshotPath: string,
  expectedVersion: number
): BackupResult<{ version: number }> {
  let snapshot: Database.Database | undefined
  let failure: unknown
  let version: number | undefined
  try {
    snapshot = new Database(snapshotPath, { readonly: true, fileMustExist: true })
    const integrity = snapshot.pragma('integrity_check', { simple: true })
    const userVersion: unknown = snapshot.pragma('user_version', { simple: true })
    if (
      integrity !== 'ok' ||
      typeof userVersion !== 'number' ||
      !Number.isSafeInteger(userVersion) ||
      userVersion !== expectedVersion
    ) {
      throw new Error(
        `Snapshot verification failed: integrity=${String(integrity)}, user_version=${String(userVersion)}`
      )
    }
    version = userVersion
  } catch (error) {
    failure = error
  } finally {
    if (snapshot?.open) {
      try {
        snapshot.close()
      } catch (error) {
        failure ??= error
      }
    }
  }
  if (failure === undefined && version !== undefined) {
    return { ok: true, data: { version } }
  }
  removePartialSnapshot(snapshotPath)
  return {
    ok: false,
    errors: [{ field: 'snapshot', message: errorMessage(failure) }]
  }
}

export function createVerifiedDatabaseBackup(
  db: Database.Database,
  backupPath: string,
  expectedVersion: number
): void {
  ensureDirectory(dirname(backupPath))
  const escapedPath = backupPath.replace(/'/g, "''")
  try {
    db.exec(`VACUUM INTO '${escapedPath}'`)
  } catch (error) {
    removePartialSnapshot(backupPath)
    throw error
  }
  const verified = verifyDatabaseSnapshot(backupPath, expectedVersion)
  if (!verified.ok) {
    throw new Error(`Migration backup verification failed: ${verified.errors[0].message}`)
  }
}

export async function syncAttachmentMirror(userDataPath: string): Promise<AttachmentMirrorCounts> {
  const source = join(userDataPath, 'docs', 'attachments')
  const destination = join(userDataPath, 'backups', 'attachments')
  const counts: AttachmentMirrorCounts = { copied: 0, skipped: 0, failed: 0 }
  if (!existsSync(source)) return counts

  const files: string[] = []
  async function collect(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) await collect(entryPath)
      else if (entry.isFile()) files.push(entryPath)
    }
  }

  try {
    await collect(source)
    await mkdir(destination, { recursive: true })
  } catch {
    return { copied: 0, skipped: 0, failed: 1 }
  }

  let nextIndex = 0
  const workers = Array.from({ length: Math.min(mirrorConcurrency, files.length) }, async () => {
    while (nextIndex < files.length) {
      const sourceFile = files[nextIndex]
      nextIndex += 1
      const destinationFile = join(destination, relative(source, sourceFile))
      try {
        const sourceStats = await stat(sourceFile)
        try {
          const destinationStats = await stat(destinationFile)
          if (destinationStats.size === sourceStats.size) {
            counts.skipped += 1
            continue
          }
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
        }
        await mkdir(dirname(destinationFile), { recursive: true })
        await copyFile(sourceFile, destinationFile)
        counts.copied += 1
      } catch {
        counts.failed += 1
      }
    }
  })
  await Promise.all(workers)
  return counts
}

function pruneSnapshots(
  databaseDirectory: string,
  prefix: 'daily-' | 'post-close-',
  limit: number
): void {
  if (!existsSync(databaseDirectory)) return
  const names = readdirSync(databaseDirectory)
    .filter((name) => {
      if (prefix === 'daily-') return /^daily-\d{4}-\d{2}-\d{2}\.db$/.test(name)
      return /^post-close-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-.+\.db$/.test(name)
    })
    .sort()
  for (const name of names.slice(0, Math.max(0, names.length - limit))) {
    rmSync(join(databaseDirectory, name))
  }
}

export class BackupService {
  private readonly backupDirectory: string
  private readonly databaseDirectory: string
  private readonly statusPath: string
  private status: BackupStatus = { lastSuccessAt: null, lastError: null }
  private operationQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly userDataPath: string,
    private readonly db: Database.Database
  ) {
    this.backupDirectory = join(userDataPath, 'backups')
    this.databaseDirectory = join(this.backupDirectory, 'db')
    this.statusPath = join(this.backupDirectory, 'status.json')
    this.loadStatus()
  }

  getStatus(): BackupStatus {
    return { ...this.status }
  }

  async backupAfterClose(shiftId: string, now: Date): Promise<BackupResult<BackupSuccessData>> {
    return this.serialize<BackupResult<BackupSuccessData>>(async () => {
      const safeShiftId = shiftId.replace(/[^A-Za-z0-9_-]/g, '_')
      const snapshotPath = join(
        this.databaseDirectory,
        `post-close-${fileTimestamp(now)}-${safeShiftId}.db`
      )
      const snapshot = this.createSnapshot(snapshotPath, 'post-close-')
      const attachments = await syncAttachmentMirror(this.userDataPath)
      if (!snapshot.ok || attachments.failed > 0) {
        const errors = [
          ...(!snapshot.ok ? snapshot.errors : []),
          ...(attachments.failed > 0
            ? [
                {
                  field: 'attachments',
                  message: `Attachment mirror failed for ${attachments.failed} file(s)`
                }
              ]
            : [])
        ]
        this.recordError(errors.map((error) => error.message).join('; '), now)
        return { ok: false, errors }
      }
      this.recordSuccess(now)
      return { ok: true, data: { snapshotPath, attachments } }
    }).catch((error: unknown): BackupResult<BackupSuccessData> => {
      const message = errorMessage(error)
      this.recordError(message, now)
      return { ok: false, errors: [{ field: 'backup', message }] }
    })
  }

  async createDailySnapshot(now: Date): Promise<BackupResult<{ snapshotPath: string | null }>> {
    return this.serialize<BackupResult<{ snapshotPath: string | null }>>(async () => {
      const snapshotPath = join(this.databaseDirectory, `daily-${localDate(now)}.db`)
      if (existsSync(snapshotPath)) return { ok: true, data: { snapshotPath: null } }
      const snapshot = this.createSnapshot(snapshotPath, 'daily-')
      const attachments = await syncAttachmentMirror(this.userDataPath)
      if (!snapshot.ok || attachments.failed > 0) {
        const errors = [
          ...(!snapshot.ok ? snapshot.errors : []),
          ...(attachments.failed > 0
            ? [
                {
                  field: 'attachments',
                  message: `Attachment mirror failed for ${attachments.failed} file(s)`
                }
              ]
            : [])
        ]
        this.recordError(errors.map((error) => error.message).join('; '), now)
        return { ok: false, errors }
      }
      this.recordSuccess(now)
      return { ok: true, data: { snapshotPath } }
    }).catch((error: unknown): BackupResult<{ snapshotPath: string | null }> => {
      const message = errorMessage(error)
      this.recordError(message, now)
      return { ok: false, errors: [{ field: 'backup', message }] }
    })
  }

  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operationQueue.then(operation, operation)
    this.operationQueue = next.then(
      () => undefined,
      () => undefined
    )
    return next
  }

  private createSnapshot(
    snapshotPath: string,
    prefix: 'daily-' | 'post-close-'
  ): BackupResult<{ version: number }> {
    try {
      const versionValue: unknown = this.db.pragma('user_version', { simple: true })
      if (typeof versionValue !== 'number' || !Number.isSafeInteger(versionValue)) {
        throw new Error('The open database has an invalid user_version')
      }
      const version = versionValue
      ensureDirectory(this.databaseDirectory)
      const escapedPath = snapshotPath.replace(/'/g, "''")
      this.db.exec(`VACUUM INTO '${escapedPath}'`)
      const verification = verifyDatabaseSnapshot(snapshotPath, version)
      if (!verification.ok) return verification
      pruneSnapshots(
        this.databaseDirectory,
        prefix,
        prefix === 'daily-' ? dailyRetention : postCloseRetention
      )
      return verification
    } catch (error) {
      removePartialSnapshot(snapshotPath)
      return { ok: false, errors: [{ field: 'snapshot', message: errorMessage(error) }] }
    }
  }

  private loadStatus(): void {
    if (!existsSync(this.statusPath)) return
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.statusPath, 'utf8'))
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('lastSuccessAt' in parsed) ||
        !(parsed.lastSuccessAt === null || typeof parsed.lastSuccessAt === 'string') ||
        !('lastError' in parsed) ||
        !(parsed.lastError === null || typeof parsed.lastError === 'string')
      ) {
        throw new Error('Backup status file has an invalid shape')
      }
      this.status = { lastSuccessAt: parsed.lastSuccessAt, lastError: parsed.lastError }
    } catch (error) {
      this.status.lastError = `Could not read backup status: ${errorMessage(error)}`
      console.error(this.status.lastError)
    }
  }

  private recordSuccess(now: Date): void {
    this.status = { lastSuccessAt: now.toISOString(), lastError: null }
    this.persistStatus()
  }

  private recordError(message: string, now: Date): void {
    this.status = { ...this.status, lastError: message }
    console.error('Backup operation failed', { at: now.toISOString(), error: message })
    this.persistStatus()
  }

  private persistStatus(): void {
    try {
      ensureDirectory(this.backupDirectory)
      const temporaryPath = `${this.statusPath}.tmp`
      writeFileSync(temporaryPath, `${JSON.stringify(this.status, null, 2)}\n`, 'utf8')
      renameSync(temporaryPath, this.statusPath)
    } catch (error) {
      this.status.lastError = `${this.status.lastError ?? ''}${this.status.lastError ? '; ' : ''}Could not persist backup status: ${errorMessage(error)}`
      console.error(this.status.lastError)
    }
  }
}

let backupService: BackupService | undefined

export function initializeBackupService(
  userDataPath: string,
  db: Database.Database
): BackupService {
  backupService = new BackupService(userDataPath, db)
  return backupService
}

export function backupDatabase(
  shiftId: string,
  now: Date
): Promise<BackupResult<BackupSuccessData>> {
  if (!backupService) {
    return Promise.resolve({
      ok: false,
      errors: [{ field: 'backup', message: 'Backup service is not initialized' }]
    })
  }
  return backupService.backupAfterClose(shiftId, now)
}
