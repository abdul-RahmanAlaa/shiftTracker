/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = function (context) {
  const { fs, path, harnessUserData, db, BackupService, result, runAsyncCase, CURRENT_VERSION, verifyDatabaseSnapshot, syncAttachmentMirror, initializeBackupService, createOwnShift, addClosingSheet, closeShift } = context
  async function runBackupCases() {
    const backupRoot = path.join(harnessUserData, 'backup-cases')
    fs.mkdirSync(backupRoot, { recursive: true })
    const makeRoot = (name) => {
      const userDataPath = path.join(backupRoot, name)
      fs.mkdirSync(userDataPath, { recursive: true })
      return userDataPath
    }
    const now = new Date(2026, 2, 10, 12, 30, 45, 123)
  
    await runAsyncCase(
      'BK-1 post-close snapshot is created, verified and named correctly',
      'verified post-close-<timestamp>-<shiftId>.db snapshot',
      async () => {
        const userDataPath = makeRoot('BK-1')
        const service = new BackupService(userDataPath, db)
        const response = await service.backupAfterClose('BK1-SHIFT', now)
        const snapshotPath = response.ok ? response.data.snapshotPath : ''
        const verification = snapshotPath
          ? verifyDatabaseSnapshot(snapshotPath, CURRENT_VERSION)
          : undefined
        return {
          response,
          name: path.basename(snapshotPath),
          verification,
          files: fs.readdirSync(path.join(userDataPath, 'backups', 'db'))
        }
      },
      (actual) => {
        const output = result(actual)
        return output?.response?.ok === true &&
          output.name ===
            'post-close-' +
              now.toISOString().replaceAll(':', '-').replaceAll('.', '-') +
              '-BK1-SHIFT.db' &&
          output.verification?.ok === true &&
          output.verification.data.version === CURRENT_VERSION &&
          output.files.includes(output.name)
      }
    )
  
    await runAsyncCase(
      'BK-2 attachment mirror copies once and skips unchanged files',
      'first copies all files; second copies none and preserves file timestamps',
      async () => {
        const userDataPath = makeRoot('BK-2')
        const source = path.join(userDataPath, 'docs', 'attachments')
        fs.mkdirSync(path.join(source, 'nested'), { recursive: true })
        fs.writeFileSync(path.join(source, 'one.jpg'), Buffer.from('one'))
        fs.writeFileSync(path.join(source, 'nested', 'two.jpg'), Buffer.from('two'))
        const first = await syncAttachmentMirror(userDataPath)
        const mirrored = [
          path.join(userDataPath, 'backups', 'attachments', 'one.jpg'),
          path.join(userDataPath, 'backups', 'attachments', 'nested', 'two.jpg')
        ]
        const mtimes = mirrored.map((file) => fs.statSync(file).mtimeMs)
        const second = await syncAttachmentMirror(userDataPath)
        return { first, second, mtimes, after: mirrored.map((file) => fs.statSync(file).mtimeMs) }
      },
      (actual) => {
        const output = result(actual)
        return output?.first.copied === 2 &&
          output.first.skipped === 0 &&
          output.first.failed === 0 &&
          output.second.copied === 0 &&
          output.second.skipped === 2 &&
          output.second.failed === 0 &&
          JSON.stringify(output.mtimes) === JSON.stringify(output.after)
      }
    )
  
    await runAsyncCase(
      'BK-3 mirror retains deleted files and recopies smaller partial files',
      'deleted source remains mirrored; smaller target is copied again',
      async () => {
        const userDataPath = makeRoot('BK-3')
        const source = path.join(userDataPath, 'docs', 'attachments')
        const mirror = path.join(userDataPath, 'backups', 'attachments')
        fs.mkdirSync(source, { recursive: true })
        fs.writeFileSync(path.join(source, 'removed.jpg'), Buffer.from('kept'))
        fs.writeFileSync(path.join(source, 'partial.jpg'), Buffer.from('complete'))
        await syncAttachmentMirror(userDataPath)
        fs.rmSync(path.join(source, 'removed.jpg'))
        fs.writeFileSync(path.join(mirror, 'partial.jpg'), Buffer.from('x'))
        const counts = await syncAttachmentMirror(userDataPath)
        return {
          counts,
          removedStillExists: fs.existsSync(path.join(mirror, 'removed.jpg')),
          partialContents: fs.readFileSync(path.join(mirror, 'partial.jpg'), 'utf8')
        }
      },
      (actual) => {
        const output = result(actual)
        return output?.counts.copied === 1 &&
          output.counts.skipped === 0 &&
          output.counts.failed === 0 &&
          output.removedStillExists === true &&
          output.partialContents === 'complete'
      }
    )
  
    await runAsyncCase(
      'BK-4 daily snapshot runs once per local date',
      'same date does not create a second snapshot; next date creates another',
      async () => {
        const userDataPath = makeRoot('BK-4')
        const service = new BackupService(userDataPath, db)
        const first = await service.createDailySnapshot(now)
        const sameDay = await service.createDailySnapshot(new Date(2026, 2, 10, 23, 0))
        const nextDay = await service.createDailySnapshot(new Date(2026, 2, 11, 0, 1))
        const files = fs.readdirSync(path.join(userDataPath, 'backups', 'db')).sort()
        return { first, sameDay, nextDay, files }
      },
      (actual) => {
        const output = result(actual)
        return output?.first.ok === true &&
          output.first.data.snapshotPath !== null &&
          output.sameDay.ok === true &&
          output.sameDay.data.snapshotPath === null &&
          output.nextDay.ok === true &&
          output.nextDay.data.snapshotPath !== null &&
          output.files.length === 2 &&
          output.files.includes('daily-2026-03-10.db') &&
          output.files.includes('daily-2026-03-11.db')
      }
    )
  
    await runAsyncCase(
      'BK-5 retention prunes only oldest named snapshots',
      'keeps newest 60 daily and 120 post-close files and preserves unrelated files/folders',
      async () => {
        const userDataPath = makeRoot('BK-5')
        const databaseDirectory = path.join(userDataPath, 'backups', 'db')
        fs.mkdirSync(databaseDirectory, { recursive: true })
        const start = new Date(2026, 0, 1)
        for (let index = 0; index < 62; index += 1) {
          const date = new Date(start)
          date.setDate(start.getDate() + index)
          const day = String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
          fs.writeFileSync(path.join(databaseDirectory, 'daily-' + day + '.db'), 'daily')
        }
        for (let index = 0; index < 122; index += 1) {
          const date = new Date(start)
          date.setDate(start.getDate() + index)
          const stamp = String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + 'T00-00-00-000Z'
          fs.writeFileSync(path.join(databaseDirectory, 'post-close-' + stamp + '-OLD.db'), 'post')
        }
        fs.writeFileSync(path.join(databaseDirectory, 'pre-migration-v1.db'), 'pre-migration')
        fs.writeFileSync(path.join(databaseDirectory, 'unknown.bin'), 'unknown')
        const legacyDirectory = path.join(userDataPath, 'backups', 'legacy')
        fs.mkdirSync(legacyDirectory)
        fs.writeFileSync(path.join(legacyDirectory, 'keep.txt'), 'legacy')
        const service = new BackupService(userDataPath, db)
        const dailyResult = await service.createDailySnapshot(now)
        const postResult = await service.backupAfterClose('BK5-SHIFT', now)
        const files = fs.readdirSync(databaseDirectory)
        return {
          dailyResult,
          postResult,
          dailyCount: files.filter((name) => name.startsWith('daily-') && name.endsWith('.db')).length,
          postCount: files.filter((name) => name.startsWith('post-close-') && name.endsWith('.db')).length,
          preserved: [
            files.includes('pre-migration-v1.db'),
            files.includes('unknown.bin'),
            fs.readFileSync(path.join(legacyDirectory, 'keep.txt'), 'utf8') === 'legacy'
          ]
        }
      },
      (actual) => {
        const output = result(actual)
        return output?.dailyResult.ok === true &&
          output.postResult.ok === true &&
          output.dailyCount === 60 &&
          output.postCount === 120 &&
          output.preserved.every(Boolean)
      }
    )
  
    await runAsyncCase(
      'BK-6 unwritable backup path warns but close succeeds',
      'closeShift returns ok with backupWarning and persists CLOSED state',
      async () => {
        const userDataPath = makeRoot('BK-6')
        const previousUserDataPath = process.env.SHIFT_TRACKER_USER_DATA
        try {
          process.env.SHIFT_TRACKER_USER_DATA = userDataPath
          fs.writeFileSync(path.join(userDataPath, 'backups'), 'not a directory')
          initializeBackupService(userDataPath, db)
          const shift = createOwnShift()
          addClosingSheet(shift.id, 'bk6-closing-sheet.jpg')
          const response = await closeShift({
            shiftId: shift.id,
            endDate: '2026-03-11',
            reportedTripCount: 0
          })
          const status = db.prepare('SELECT status FROM Shift WHERE id = ?').get(shift.id)?.status
          return { response, status }
        } finally {
          process.env.SHIFT_TRACKER_USER_DATA = previousUserDataPath
        }
      },
      (actual) => {
        const output = result(actual)
        return output?.response?.ok === true &&
          output.response.data.backupWarning === true &&
          output.status === 'CLOSED'
      }
    )
  
    await runAsyncCase(
      'BK-7 corrupt snapshot is removed and reported',
      'verification returns failure and deletes the invalid database file',
      () => {
        const snapshotPath = path.join(makeRoot('BK-7'), 'corrupt.db')
        fs.writeFileSync(snapshotPath, 'not sqlite')
        const verification = verifyDatabaseSnapshot(snapshotPath, CURRENT_VERSION)
        return { verification, exists: fs.existsSync(snapshotPath) }
      },
      (actual) => {
        const output = result(actual)
        return output?.verification.ok === false &&
          output.verification.errors[0].field === 'snapshot' &&
          output.exists === false
      }
    )
  
    await runAsyncCase(
      'BK-8 backup status persists and reloads after restart',
      'success timestamp and subsequent error are both available after service recreation',
      async () => {
        const userDataPath = makeRoot('BK-8')
        const service = new BackupService(userDataPath, db)
        await service.createDailySnapshot(now)
        const databaseDirectory = path.join(userDataPath, 'backups', 'db')
        fs.rmSync(databaseDirectory, { recursive: true, force: true })
        fs.writeFileSync(databaseDirectory, 'blocked directory')
        await service.createDailySnapshot(new Date(2026, 2, 11, 12, 30))
        const persisted = JSON.parse(
          fs.readFileSync(path.join(userDataPath, 'backups', 'status.json'), 'utf8')
        )
        const reloaded = new BackupService(userDataPath, db).getStatus()
        return { persisted, reloaded }
      },
      (actual) => {
        const output = result(actual)
        return typeof output?.persisted.lastSuccessAt === 'string' &&
          typeof output.persisted.lastError === 'string' &&
          output.reloaded.lastSuccessAt === output.persisted.lastSuccessAt &&
          output.reloaded.lastError === output.persisted.lastError
      }
    )
  }
  return runBackupCases
}
