/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = function (context) {
  const { migrationRoot, fs, path, Database, crypto, initDatabase, SCHEMA, CURRENT_VERSION, MigrationError } = context
  function newMigrationDirectory(name) {
      const directory = path.join(migrationRoot, name)
      fs.mkdirSync(directory, { recursive: true })
      return directory
    }
  function createBaselineDatabase(directory, filename = 'shift-tracker.db') {
      const databasePath = path.join(directory, filename)
      const fixtureDb = new Database(databasePath)
      fixtureDb.exec(SCHEMA)
      fixtureDb.pragma('user_version = ' + CURRENT_VERSION)
      return { databasePath, fixtureDb }
    }
  function createFixtureDatabase(directory, version, tableName = 'Fixture', keepOpen = false) {
      const databasePath = path.join(directory, 'shift-tracker.db')
      const fixtureDb = new Database(databasePath)
      if (keepOpen) fixtureDb.pragma('journal_mode = WAL')
      fixtureDb.exec('CREATE TABLE ' + tableName + ' (id INTEGER PRIMARY KEY, value TEXT NOT NULL)')
      fixtureDb.prepare('INSERT INTO ' + tableName + ' (id, value) VALUES (1, ?)').run('preserved')
      fixtureDb.pragma('user_version = ' + version)
      if (keepOpen) return { databasePath, fixtureDb }
      fixtureDb.close()
      return databasePath
    }
  function schemaSnapshot(fixtureDb) {
      return fixtureDb
        .prepare(
          "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
        )
        .all()
    }
  function fileSnapshot(directory) {
      return fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => {
          const itemPath = path.join(directory, entry.name)
          if (!entry.isFile()) return { name: entry.name, type: 'directory' }
          if (entry.name.endsWith('-shm')) {
            return { name: entry.name, type: 'file', size: fs.statSync(itemPath).size }
          }
          const bytes = fs.readFileSync(itemPath)
          return {
            name: entry.name,
            type: 'file',
            size: bytes.length,
            hash: crypto.createHash('sha256').update(bytes).digest('hex')
          }
        })
    }
  function refusalIsNonDestructive(directory, version, unversioned) {
      const { databasePath, fixtureDb } = createFixtureDatabase(
        directory,
        version,
        unversioned ? 'UnversionedFixture' : 'VersionedFixture',
        true
      )
      const before = fileSnapshot(directory)
      const sidecarsPresentBefore = ['-wal', '-shm'].every((suffix) =>
        before.some(
          (entry) =>
            entry.name === path.basename(databasePath) + suffix && entry.type === 'file'
        )
      )
      process.env.SHIFT_TRACKER_USER_DATA = directory
      globalThis.__migrationDialog = []
      globalThis.__migrationQuitCount = 0
      let surfacedError
      try {
        initDatabase()
      } catch (error) {
        surfacedError = error
      }
      const after = fileSnapshot(directory)
      const fixtureVersion = fixtureDb.pragma('user_version', { simple: true })
      const fixtureRows = fixtureDb
        .prepare('SELECT * FROM ' + (unversioned ? 'UnversionedFixture' : 'VersionedFixture'))
        .all()
      const userVersionUnchanged = fixtureVersion === version
      const rowsUnchanged = fixtureRows.length === 1 && fixtureRows[0].value === 'preserved'
      fixtureDb.close()
      const file = after.find((entry) => entry.name === path.basename(databasePath))
      const expectedCode = unversioned
        ? 'UNVERSIONED_DATABASE'
        : version > CURRENT_VERSION
          ? 'NEWER_DATABASE_VERSION'
          : 'UNSUPPORTED_OLD_VERSION'
      const surfaced = surfacedError instanceof MigrationError && surfacedError.code === expectedCode
      const dialogIncludesPathAndVersion =
        globalThis.__migrationDialog.length === 2 &&
        globalThis.__migrationDialog[1].includes(directory) &&
        globalThis.__migrationDialog[1].includes(String(version)) &&
        !globalThis.__migrationDialog[1].toLowerCase().includes('delete')
      const walName = path.basename(databasePath) + '-wal'
      const shmName = path.basename(databasePath) + '-shm'
      const beforeWal = before.find((entry) => entry.name === walName)
      const afterWal = after.find((entry) => entry.name === walName)
      const beforeShm = before.find((entry) => entry.name === shmName)
      const afterShm = after.find((entry) => entry.name === shmName)
      const walUnchanged =
        beforeWal?.type === 'file' &&
        afterWal?.type === 'file' &&
        beforeWal.size === afterWal.size &&
        beforeWal.hash === afterWal.hash
      const sidecarsUnchanged =
        beforeWal?.type === 'file' &&
        afterWal?.type === 'file' &&
        beforeShm?.type === 'file' &&
        afterShm?.type === 'file' &&
        beforeWal.size === afterWal.size &&
        beforeWal.hash === afterWal.hash &&
        beforeShm.size === afterShm.size
      return {
        surfaced,
        dialogIncludesPathAndVersion,
        quitCalled: globalThis.__migrationQuitCount === 1,
        sidecarsPresentBefore,
        fileUnchanged: before.some((entry) => entry.name === file?.name && entry.hash === file?.hash),
        userVersionUnchanged,
        rowsUnchanged,
        walUnchanged,
        sidecarsUnchanged,
        folderUnchanged: JSON.stringify(before) === JSON.stringify(after)
      }
    }
  return { newMigrationDirectory, createBaselineDatabase, createFixtureDatabase, schemaSnapshot, fileSnapshot, refusalIsNonDestructive }
}
