/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = function (context) {
  const { runCase, result, Database, path, fs, CURRENT_VERSION, MigrationError, runMigrations, createVerifiedDatabaseBackup, newMigrationDirectory, createBaselineDatabase, createFixtureDatabase, schemaSnapshot, fileSnapshot, refusalIsNonDestructive } = context
  function runMigrationBackupCases() {
    runCase(
          'M8 pre-migration backup failure aborts',
          'backup failure is structured and leaves baseline version, columns, and rows unchanged',
          () => {
            const directory = newMigrationDirectory('M8')
            const { fixtureDb } = createBaselineDatabase(directory)
            fixtureDb.prepare('INSERT INTO Client (name) VALUES (?)').run('M8 client')
            const backupDirectory = path.join(directory, 'backups')
            fs.writeFileSync(backupDirectory, 'not a directory')
            let error
            try {
              runMigrations(
                fixtureDb,
                [
                  {
                    version: 6,
                    name: 'must not run',
                    up(database) {
                      database.exec('ALTER TABLE Client ADD COLUMN should_not_exist TEXT')
                    }
                  }
                ],
                {
                  baselineVersion: CURRENT_VERSION,
                  backupDirectory
                }
              )
            } catch (caught) {
              error = caught
            }
            const version = fixtureDb.pragma('user_version', { simple: true })
            const columns = fixtureDb.pragma('table_info(Client)')
            const clients = fixtureDb.prepare('SELECT name FROM Client').all()
            fixtureDb.close()
            return {
              structuredBackupError:
                error instanceof MigrationError && error.code === 'BACKUP_FAILED',
              version,
              migrationNotApplied: !columns.some((column) => column.name === 'should_not_exist'),
              rowsIntact: clients.length === 1 && clients[0].name === 'M8 client',
              backupBlockerRemains: fs.readFileSync(backupDirectory, 'utf8') === 'not a directory'
            }
          },
          (actual) => {
            const value = result(actual)
            return (
              value?.structuredBackupError &&
              value.version === CURRENT_VERSION &&
              value.migrationNotApplied &&
              value.rowsIntact &&
              value.backupBlockerRemains
            )
          }
        )
    
    runCase(
          'M9 every refusal preserves database, sidecars, and directory listing',
          'all refusal snapshots match and WAL sidecars exist before each refusal',
          () => {
            const cases = [
              refusalIsNonDestructive(newMigrationDirectory('M9-newer'), 99, false),
              refusalIsNonDestructive(newMigrationDirectory('M9-unversioned'), 0, true),
              refusalIsNonDestructive(newMigrationDirectory('M9-old'), 3, false)
            ]
            return {
              eachRefusalPreservedAll:
                cases.length === 3 &&
                cases.every(
                  (value) =>
                    value.surfaced &&
                    value.sidecarsPresentBefore &&
                    value.fileUnchanged &&
                    value.userVersionUnchanged &&
                    value.rowsUnchanged &&
                    value.walUnchanged &&
                    value.sidecarsUnchanged &&
                    value.folderUnchanged
                )
            }
          },
          (actual) => result(actual)?.eachRefusalPreservedAll === true
        )
    
    runCase(
          'M10 failed backup verification removes the backup file',
          'version mismatch throws, removes backup, and preserves source version and rows',
          () => {
            const directory = newMigrationDirectory('M10')
            const { fixtureDb } = createBaselineDatabase(directory)
            fixtureDb.prepare('INSERT INTO Client (name) VALUES (?)').run('M10 client')
            const backupPath = path.join(directory, 'mismatched-version.db')
            let error
            try {
              createVerifiedDatabaseBackup(fixtureDb, backupPath, CURRENT_VERSION + 1)
            } catch (caught) {
              error = caught
            }
            const version = fixtureDb.pragma('user_version', { simple: true })
            const clients = fixtureDb.prepare('SELECT name FROM Client').all()
            fixtureDb.close()
            return {
              verificationThrew:
                error instanceof Error &&
                error.message.includes('Migration backup verification failed'),
              backupAbsent: !fs.existsSync(backupPath),
              versionUnchanged: version === CURRENT_VERSION,
              rowsUnchanged: clients.length === 1 && clients[0].name === 'M10 client'
            }
          },
          (actual) => {
            const value = result(actual)
            return (
              value?.verificationThrew &&
              value.backupAbsent &&
              value.versionUnchanged &&
              value.rowsUnchanged
            )
          }
        )
    
    runCase(
          'M11 successful verified backup is retained',
          'backup exists with integrity ok and matching user_version',
          () => {
            const directory = newMigrationDirectory('M11')
            const { fixtureDb } = createBaselineDatabase(directory)
            const backupPath = path.join(directory, 'verified-backup.db')
            createVerifiedDatabaseBackup(fixtureDb, backupPath, CURRENT_VERSION)
            fixtureDb.close()
            const backupDb = new Database(backupPath, { readonly: true, fileMustExist: true })
            const integrity = backupDb.pragma('integrity_check', { simple: true })
            const version = backupDb.pragma('user_version', { simple: true })
            backupDb.close()
            return {
              backupExists: fs.existsSync(backupPath),
              integrity,
              version
            }
          },
          (actual) => {
            const value = result(actual)
            return (
              value?.backupExists &&
              value.integrity === 'ok' &&
              value.version === CURRENT_VERSION
            )
          }
        )
  }
  return runMigrationBackupCases
}
