import Database from 'better-sqlite3'
import { app, dialog } from 'electron'
import { join } from 'path'
import { MigrationError, migrations, runMigrations } from './migrations'

export const CURRENT_VERSION = 5

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS TripIdCounter (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  next_number INTEGER NOT NULL
);

INSERT OR IGNORE INTO TripIdCounter (id, next_number) VALUES (1, 1);

CREATE TABLE IF NOT EXISTS TransportContractor (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  phone TEXT,
  opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (typeof(opening_balance) = 'integer'),
  opening_balance_date TEXT CHECK (
    opening_balance_date IS NULL OR (
      length(opening_balance_date) = 10 AND
      opening_balance_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
      strftime('%Y-%m-%d', opening_balance_date, '+0 days') IS NOT NULL AND
      strftime('%Y-%m-%d', opening_balance_date, '+0 days') = opening_balance_date
    )
  )
);

CREATE TABLE IF NOT EXISTS Vehicle (
  vehicle_no    INTEGER PRIMARY KEY,
  trailer_no    INTEGER NOT NULL,
  contractor_id INTEGER NOT NULL REFERENCES TransportContractor(id),
  default_cubic REAL,
  owner_name    TEXT
);

CREATE TABLE IF NOT EXISTS Driver (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL UNIQUE,
  phone1  TEXT,
  phone2  TEXT
);

CREATE TABLE IF NOT EXISTS Crusher (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  initial_price  INTEGER CHECK (
    initial_price IS NULL OR
    (typeof(initial_price) = 'integer' AND initial_price > 0)
  )
);

CREATE TABLE IF NOT EXISTS Client (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  initial_price  INTEGER CHECK (
    initial_price IS NULL OR
    (typeof(initial_price) = 'integer' AND initial_price > 0)
  ),
  location       TEXT,
  opening_balance INTEGER NOT NULL DEFAULT 0 CHECK (typeof(opening_balance) = 'integer'),
  opening_balance_date TEXT CHECK (
    opening_balance_date IS NULL OR (
      length(opening_balance_date) = 10 AND
      opening_balance_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
      strftime('%Y-%m-%d', opening_balance_date, '+0 days') IS NOT NULL AND
      strftime('%Y-%m-%d', opening_balance_date, '+0 days') = opening_balance_date
    )
  )
);

CREATE TABLE IF NOT EXISTS MaterialType (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Shift (
  id                      TEXT PRIMARY KEY,
  vehicle_no              INTEGER NOT NULL REFERENCES Vehicle(vehicle_no),
  driver_id               INTEGER NOT NULL REFERENCES Driver(id),
  contractor_id           INTEGER NOT NULL REFERENCES TransportContractor(id),
  crusher_cubic_default   REAL NOT NULL,
  client_cubic_default    REAL NOT NULL,
  start_date              TEXT NOT NULL,
  end_date                TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED','REOPENED')),
  reported_destination    TEXT,
  reported_trip_count     INTEGER,
  notes                   TEXT,
  CHECK (crusher_cubic_default > 0 AND crusher_cubic_default < 1e308),
  CHECK (client_cubic_default > 0 AND client_cubic_default < 1e308),
  CHECK (
    length(start_date) = 10 AND
    start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
    strftime('%Y-%m-%d', start_date, '+0 days') IS NOT NULL AND
    strftime('%Y-%m-%d', start_date, '+0 days') = start_date
  ),
  CHECK (
    end_date IS NULL OR (
      length(end_date) = 10 AND
      end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
      strftime('%Y-%m-%d', end_date, '+0 days') IS NOT NULL AND
      strftime('%Y-%m-%d', end_date, '+0 days') = end_date
    )
  )
);

CREATE TABLE IF NOT EXISTS ShiftReopenLog (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id           TEXT NOT NULL REFERENCES Shift(id),
  reopened_at        TEXT NOT NULL,
  reason             TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  previous_end_date   TEXT,
  closed_again_at    TEXT
);

CREATE TABLE IF NOT EXISTS Trip (
  id                      TEXT PRIMARY KEY,
  shift_id                TEXT NOT NULL REFERENCES Shift(id),
  trip_date               TEXT NOT NULL CHECK (
    length(trip_date) = 10 AND
    trip_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
    strftime('%Y-%m-%d', trip_date, '+0 days') IS NOT NULL AND
    strftime('%Y-%m-%d', trip_date, '+0 days') = trip_date
  ),
  crusher_cubic           REAL NOT NULL,
  client_cubic_reported   REAL NOT NULL,
  fine_amount             INTEGER NOT NULL DEFAULT 0 CHECK (
    typeof(fine_amount) = 'integer' AND fine_amount >= 0
  ),
  fine_reason             TEXT,
  location                TEXT,
  crusher_id              INTEGER NOT NULL REFERENCES Crusher(id),
  stone_price             INTEGER NOT NULL CHECK (
    typeof(stone_price) = 'integer' AND stone_price > 0
  ),
  crusher_receipt_status  TEXT NOT NULL CHECK (crusher_receipt_status IN ('PROVIDED','CONFIRMED_MISSING','UNKNOWN')),
  crusher_receipt_no      INTEGER,
  client_id               INTEGER NOT NULL REFERENCES Client(id),
  transport_price         INTEGER NOT NULL CHECK (
    typeof(transport_price) = 'integer' AND transport_price > 0
  ),
  client_price            INTEGER NOT NULL CHECK (
    typeof(client_price) = 'integer' AND client_price > 0
  ),
  recipient_name_status    TEXT NOT NULL DEFAULT 'UNCLEAR' CHECK (recipient_name_status IN ('PROVIDED','UNCLEAR')),
  recipient_name           TEXT,
  client_receipt_no        TEXT,
  notes                    TEXT,
  material_type_id         INTEGER REFERENCES MaterialType(id),
  CHECK (crusher_cubic > 0 AND crusher_cubic < 1e308),
  CHECK (client_cubic_reported > 0 AND client_cubic_reported < 1e308),
  CHECK (
    (crusher_receipt_status = 'PROVIDED' AND crusher_receipt_no IS NOT NULL)
    OR (crusher_receipt_status <> 'PROVIDED' AND crusher_receipt_no IS NULL)
  ),
  CHECK (
    (recipient_name_status = 'PROVIDED' AND recipient_name IS NOT NULL)
    OR (recipient_name_status = 'UNCLEAR' AND recipient_name IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS Attachment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('TRIP','SHIFT')),
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('CRUSHER_RECEIPT','CLIENT_RECEIPT','CLOSING_SHEET')),
  photo_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attachment_entity ON Attachment (entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_crusher_receipt
ON Trip (crusher_id, crusher_receipt_no)
WHERE crusher_receipt_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trip_shift ON Trip (shift_id);
CREATE INDEX IF NOT EXISTS idx_trip_client ON Trip (client_id);
CREATE INDEX IF NOT EXISTS idx_trip_crusher ON Trip (crusher_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_open_vehicle
ON Shift (vehicle_no) WHERE status = 'OPEN';

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_open_driver
ON Shift (driver_id) WHERE status = 'OPEN';

CREATE INDEX IF NOT EXISTS idx_shift_driver_status ON Shift (driver_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_vehicle_status ON Shift (vehicle_no, status);
CREATE INDEX IF NOT EXISTS idx_shift_contractor ON Shift (contractor_id);

CREATE TABLE IF NOT EXISTS Ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date     TEXT NOT NULL CHECK (
    length(entry_date) = 10 AND
    entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
    strftime('%Y-%m-%d', entry_date, '+0 days') IS NOT NULL AND
    strftime('%Y-%m-%d', entry_date, '+0 days') = entry_date
  ),
  driver_id      INTEGER REFERENCES Driver(id),
  movement_type  TEXT NOT NULL CHECK (movement_type IN ('ADVANCE','PAYMENT','OTHER')),
  amount         INTEGER NOT NULL CHECK (typeof(amount) = 'integer' AND amount <> 0),
  shift_id       TEXT REFERENCES Shift(id),
  contractor_id  INTEGER NOT NULL REFERENCES TransportContractor(id),
  notes          TEXT
);

CREATE INDEX IF NOT EXISTS idx_ledger_contractor ON Ledger (contractor_id);
CREATE INDEX IF NOT EXISTS idx_ledger_driver ON Ledger (driver_id);
CREATE INDEX IF NOT EXISTS idx_ledger_shift ON Ledger (shift_id);

CREATE VIEW IF NOT EXISTS ShiftStats AS
SELECT
  s.id AS shift_id,
  COUNT(t.id) AS actual_trip_count,
  s.reported_trip_count,
  (s.reported_trip_count IS NOT NULL
   AND s.reported_trip_count <> COUNT(t.id)) AS has_count_mismatch
FROM Shift s
LEFT JOIN Trip t ON t.shift_id = s.id
GROUP BY s.id;

CREATE TABLE IF NOT EXISTS ClientPayment (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date  TEXT NOT NULL CHECK (
    length(entry_date) = 10 AND
    entry_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
    strftime('%Y-%m-%d', entry_date, '+0 days') IS NOT NULL AND
    strftime('%Y-%m-%d', entry_date, '+0 days') = entry_date
  ),
  client_id   INTEGER NOT NULL REFERENCES Client(id),
  amount      INTEGER NOT NULL CHECK (typeof(amount) = 'integer' AND amount <> 0),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS idx_client_payment_client ON ClientPayment (client_id);
`

let db: Database.Database

const DATABASE_MESSAGES = {
  title: 'خطأ في قاعدة البيانات',
  openFailed: 'تعذر فتح قاعدة البيانات.',
  unavailable: 'غير متاح',
  archiveRequired:
    'إصدار قاعدة البيانات غير مدعوم. أرشف مجلد البيانات بالكامل قبل أي محاولة أخرى.\n\nالمسار: {path}\nالإصدار الموجود: {version}\nالإصدار المدعوم حتى: {latest}',
  migrationFailed:
    'تعذر تحديث قاعدة البيانات. بقيت البيانات عند آخر إصدار مكتمل.\n\nالمسار: {path}\nالإصدار الموجود: {version}\nالنسخة الاحتياطية: {backupPath}\nالتفاصيل: {details}',
  backupFailed:
    'تعذر إنشاء نسخة احتياطية موثوقة قبل تحديث قاعدة البيانات؛ لم يبدأ التحديث.\n\nالمسار: {path}\nالإصدار الموجود: {version}\nمسار النسخة الاحتياطية: {backupPath}\nالتفاصيل: {details}'
}

function userTables(database: Database.Database): string[] {
  const rows = database
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all() as { name: string }[]
  return rows.map((row) => row.name)
}

function formatMessage(
  template: string,
  values: Record<string, string | number | undefined>
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => String(values[key] ?? ''))
}

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'shift-tracker.db')
  const latestVersion = migrations.at(-1)?.version ?? CURRENT_VERSION

  try {
    db = new Database(dbPath)
    const currentVersion = db.pragma('user_version', { simple: true }) as number

    if (currentVersion === 0) {
      const existingTables = userTables(db)
      if (existingTables.length > 0) {
        throw new MigrationError(
          'UNVERSIONED_DATABASE',
          `Unversioned database contains user tables: ${existingTables.join(', ')}`,
          currentVersion
        )
      }
      db.pragma('foreign_keys = ON')
      db.transaction(() => {
        db.exec(SCHEMA)
        db.pragma(`user_version = ${CURRENT_VERSION}`)
      })()
    } else {
      db.pragma('foreign_keys = ON')
    }

    runMigrations(db, migrations, {
      baselineVersion: CURRENT_VERSION,
      backupDirectory: join(userDataPath, 'backups')
    })
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    console.log('[db] Database path:', dbPath)
    console.info(`[db] Schema version: ${db.pragma('user_version', { simple: true })}`)
    return db
  } catch (err) {
    console.error('[db] initDatabase failed:', err)
    if (db?.open) db.close()

    if (err instanceof MigrationError) {
      const message =
        err.code === 'UNVERSIONED_DATABASE' ||
        err.code === 'UNSUPPORTED_OLD_VERSION' ||
        err.code === 'NEWER_DATABASE_VERSION'
          ? formatMessage(DATABASE_MESSAGES.archiveRequired, {
              path: userDataPath,
              version: err.version,
              latest: latestVersion
            })
          : err.code === 'BACKUP_FAILED'
            ? formatMessage(DATABASE_MESSAGES.backupFailed, {
                path: userDataPath,
                version: err.version,
                backupPath: err.backupPath,
                details: err.cause instanceof Error ? err.cause.message : err.message
              })
            : formatMessage(DATABASE_MESSAGES.migrationFailed, {
                path: userDataPath,
                version: err.version,
                backupPath: err.backupPath ?? DATABASE_MESSAGES.unavailable,
                details: err.cause instanceof Error ? err.cause.message : err.message
              })
      dialog.showErrorBox(DATABASE_MESSAGES.title, message)
    } else {
      dialog.showErrorBox(
        DATABASE_MESSAGES.title,
        `${DATABASE_MESSAGES.openFailed}\n\n${err instanceof Error ? err.message : String(err)}`
      )
    }
    app.quit()
    throw err
  }
}

export function getDb(): Database.Database {
  return db
}
