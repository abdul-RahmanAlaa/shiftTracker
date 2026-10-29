/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = function (context) {
  const { runCase, result, initDatabase, runMigrations, Database, path, fs, SCHEMA, CURRENT_VERSION, MigrationError, newMigrationDirectory, createBaselineDatabase, createFixtureDatabase, schemaSnapshot, fileSnapshot, refusalIsNonDestructive } = context
  function runMigrationCases() {
    runCase(
          'M1 fresh baseline matches direct SCHEMA',
          'fresh database reaches latest version and sqlite_master equals direct SCHEMA execution',
          () => {
            const directory = newMigrationDirectory('M1')
            process.env.SHIFT_TRACKER_USER_DATA = directory
            const initialized = initDatabase()
            const initializedVersion = initialized.pragma('user_version', { simple: true })
            const initializedSchema = schemaSnapshot(initialized)
            initialized.close()
      
            const direct = new Database(path.join(directory, 'direct-schema.db'))
            direct.exec(SCHEMA)
            const directSchema = schemaSnapshot(direct)
            direct.close()
            return {
              initializedVersion,
              expectedVersion: CURRENT_VERSION,
              schemasEqual: JSON.stringify(initializedSchema) === JSON.stringify(directSchema)
            }
          },
          (actual) => {
            const value = result(actual)
            return (
              value?.initializedVersion === value.expectedVersion && value.schemasEqual === true
            )
          }
        )
    
    runCase(
          'M2 migration and verified backup',
          'version 6, preserved row, backup exists with version 5 and integrity ok',
          () => {
            const directory = newMigrationDirectory('M2')
            const { databasePath, fixtureDb } = createBaselineDatabase(directory)
            fixtureDb
              .prepare('INSERT INTO Client (name, opening_balance) VALUES (?, ?)')
              .run('M2 client', 125)
            const migration = {
              version: 6,
              name: 'add client migration note',
              up(database) {
                database.exec('ALTER TABLE Client ADD COLUMN migration_note TEXT')
              }
            }
            runMigrations(fixtureDb, [migration], {
              baselineVersion: CURRENT_VERSION,
              backupDirectory: path.join(directory, 'backups')
            })
            const version = fixtureDb.pragma('user_version', { simple: true })
            const client = fixtureDb.prepare('SELECT name, opening_balance, migration_note FROM Client').get()
            fixtureDb.close()
            const backups = fs.readdirSync(path.join(directory, 'backups'))
            const backupPath = path.join(directory, 'backups', backups[0])
            const backupDb = new Database(backupPath, { readonly: true, fileMustExist: true })
            const backupVersion = backupDb.pragma('user_version', { simple: true })
            const integrity = backupDb.pragma('integrity_check', { simple: true })
            backupDb.close()
            return {
              version,
              preserved: client?.name === 'M2 client' && client?.opening_balance === 125,
              addedColumn: client?.migration_note === null,
              backupExists: backups.length === 1 && fs.existsSync(backupPath),
              backupVersion,
              integrity
            }
          },
          (actual) => {
            const value = result(actual)
            return (
              value?.version === 6 &&
              value.preserved &&
              value.addedColumn &&
              value.backupExists &&
              value.backupVersion === CURRENT_VERSION &&
              value.integrity === 'ok'
            )
          }
        )
    
    runCase(
          'M3 migration rollback with structured error',
          'version 5, added column absent, row intact, backup exists, MIGRATION_FAILED surfaced',
          () => {
            const directory = newMigrationDirectory('M3')
            const { fixtureDb } = createBaselineDatabase(directory)
            fixtureDb.prepare('INSERT INTO Client (name) VALUES (?)').run('M3 client')
            let error
            try {
              runMigrations(
                fixtureDb,
                [
                  {
                    version: 6,
                    name: 'alter then fail',
                    up(database) {
                      database.exec(
                        "ALTER TABLE Client ADD COLUMN should_rollback TEXT; INSERT INTO Client (name) VALUES ('temporary')"
                      )
                      throw new Error('intentional migration failure')
                    }
                  }
                ],
                {
                  baselineVersion: CURRENT_VERSION,
                  backupDirectory: path.join(directory, 'backups')
                }
              )
            } catch (caught) {
              error = caught
            }
            const version = fixtureDb.pragma('user_version', { simple: true })
            const columns = fixtureDb.pragma('table_info(Client)')
            const clients = fixtureDb.prepare('SELECT name FROM Client').all()
            fixtureDb.close()
            const backups = fs.readdirSync(path.join(directory, 'backups'))
            return {
              structuredError: error instanceof MigrationError && error.code === 'MIGRATION_FAILED',
              errorVersion: error instanceof MigrationError ? error.version : undefined,
              backupPath: error instanceof MigrationError ? error.backupPath : undefined,
              version,
              columnAbsent: !columns.some((column) => column.name === 'should_rollback'),
              rowsIntact: clients.length === 1 && clients[0].name === 'M3 client',
              backupExists: backups.length === 1
            }
          },
          (actual) => {
            const value = result(actual)
            return (
              value?.structuredError &&
              value.errorVersion === CURRENT_VERSION &&
              typeof value.backupPath === 'string' &&
              value.version === CURRENT_VERSION &&
              value.columnAbsent &&
              value.rowsIntact &&
              value.backupExists
            )
          }
        )
    
    runCase(
          'M4 newer database refusal',
          'version 99 refusal is structured, logged to dialog, quits, and preserves every file and sidecar',
          () => refusalIsNonDestructive(newMigrationDirectory('M4'), 99, false),
          (actual) => {
            const value = result(actual)
            return (
              value?.surfaced &&
              value.dialogIncludesPathAndVersion &&
              value.quitCalled &&
              value.sidecarsPresentBefore &&
              value.fileUnchanged &&
              value.userVersionUnchanged &&
              value.rowsUnchanged &&
              value.walUnchanged &&
              value.sidecarsUnchanged &&
              value.folderUnchanged
            )
          }
        )
    
    runCase(
          'M5 unversioned database refusal',
          'version 0 with user tables is refused, dialog and quit run, and all files remain unchanged',
          () => refusalIsNonDestructive(newMigrationDirectory('M5'), 0, true),
          (actual) => {
            const value = result(actual)
            return (
              value?.surfaced &&
              value.dialogIncludesPathAndVersion &&
              value.quitCalled &&
              value.sidecarsPresentBefore &&
              value.fileUnchanged &&
              value.userVersionUnchanged &&
              value.rowsUnchanged &&
              value.walUnchanged &&
              value.sidecarsUnchanged &&
              value.folderUnchanged
            )
          }
        )
    
    runCase(
          'M6 below-baseline database refusal',
          'version 3 refusal is structured, logged to dialog, quits, and preserves every file and sidecar',
          () => refusalIsNonDestructive(newMigrationDirectory('M6'), 3, false),
          (actual) => {
            const value = result(actual)
            return (
              value?.surfaced &&
              value.dialogIncludesPathAndVersion &&
              value.quitCalled &&
              value.sidecarsPresentBefore &&
              value.fileUnchanged &&
              value.userVersionUnchanged &&
              value.rowsUnchanged &&
              value.walUnchanged &&
              value.sidecarsUnchanged &&
              value.folderUnchanged
            )
          }
        )
    
    runCase(
          'M7 foreign-key-off rebuild and violation rollback',
          'valid rebuild commits with empty FK check; invalid rebuild rolls back and keeps version 5',
          () => {
            const successDirectory = newMigrationDirectory('M7-success')
            const successPath = path.join(successDirectory, 'shift-tracker.db')
            const successDb = new Database(successPath)
            successDb.pragma('foreign_keys = ON')
            successDb.exec(
              "CREATE TABLE Parent (id INTEGER PRIMARY KEY, label TEXT NOT NULL);" +
                'CREATE TABLE Child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES Parent(id));' +
                "INSERT INTO Parent VALUES (1, 'parent');" +
                'INSERT INTO Child VALUES (1, 1);'
            )
            successDb.pragma('user_version = ' + CURRENT_VERSION)
            runMigrations(
              successDb,
              [
                {
                  version: 6,
                  name: 'rebuild parent',
                  foreignKeys: 'off',
                  up(database) {
                    database.exec(
                      'CREATE TABLE ParentNew (id INTEGER PRIMARY KEY, label TEXT NOT NULL, note TEXT);' +
                        'INSERT INTO ParentNew (id, label) SELECT id, label FROM Parent;' +
                        'DROP TABLE Parent;' +
                        'ALTER TABLE ParentNew RENAME TO Parent;'
                    )
                  }
                }
              ],
              {
                baselineVersion: CURRENT_VERSION,
                backupDirectory: path.join(successDirectory, 'backups')
              }
            )
            const successVersion = successDb.pragma('user_version', { simple: true })
            const successForeignKeys = successDb.pragma('foreign_keys', { simple: true })
            const successViolations = successDb.pragma('foreign_key_check')
            const child = successDb.prepare('SELECT parent_id FROM Child WHERE id = 1').get()
            successDb.close()
      
            const failureDirectory = newMigrationDirectory('M7-failure')
            const failurePath = path.join(failureDirectory, 'shift-tracker.db')
            const failureDb = new Database(failurePath)
            failureDb.pragma('foreign_keys = ON')
            failureDb.exec(
              'CREATE TABLE Parent (id INTEGER PRIMARY KEY);' +
                'CREATE TABLE Child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES Parent(id));' +
                'INSERT INTO Parent VALUES (1);' +
                'INSERT INTO Child VALUES (1, 1);'
            )
            failureDb.pragma('user_version = ' + CURRENT_VERSION)
            let violationError
            try {
              runMigrations(
                failureDb,
                [
                  {
                    version: 6,
                    name: 'introduce invalid foreign key',
                    foreignKeys: 'off',
                    up(database) {
                      database.prepare('INSERT INTO Child (id, parent_id) VALUES (2, 999)').run()
                    }
                  }
                ],
                {
                  baselineVersion: CURRENT_VERSION,
                  backupDirectory: path.join(failureDirectory, 'backups')
                }
              )
            } catch (error) {
              violationError = error
            }
            const failureVersion = failureDb.pragma('user_version', { simple: true })
            const failureChildren = failureDb.prepare('SELECT id FROM Child ORDER BY id').all()
            const failureForeignKeys = failureDb.pragma('foreign_keys', { simple: true })
            failureDb.close()
            return {
              successVersion,
              successForeignKeys,
              successNoViolations: successViolations.length === 0,
              childPreserved: child?.parent_id === 1,
              failureStructured: violationError instanceof MigrationError && violationError.code === 'MIGRATION_FAILED',
              failureVersion,
              failureRowsRolledBack:
                failureChildren.length === 1 && failureChildren[0].id === 1,
              failureForeignKeys
            }
          },
          (actual) => {
            const value = result(actual)
            return (
              value?.successVersion === 6 &&
              value.successForeignKeys === 1 &&
              value.successNoViolations &&
              value.childPreserved &&
              value.failureStructured &&
              value.failureVersion === CURRENT_VERSION &&
              value.failureRowsRolledBack &&
              value.failureForeignKeys === 1
            )
          }
        )
  }
  return runMigrationCases
}
