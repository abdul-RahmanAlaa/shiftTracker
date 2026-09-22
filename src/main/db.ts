import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS TransportContractor (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Vehicle (
  vehicle_no    INTEGER PRIMARY KEY,
  trailer_no    INTEGER,
  contractor_id INTEGER NOT NULL REFERENCES TransportContractor(id)
);

CREATE TABLE IF NOT EXISTS Driver (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Crusher (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Client (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Shift (
  id                      TEXT PRIMARY KEY,
  vehicle_no              INTEGER NOT NULL REFERENCES Vehicle(vehicle_no),
  driver_id               INTEGER NOT NULL REFERENCES Driver(id),
  crusher_cubic_default   REAL NOT NULL,
  client_cubic_default    REAL NOT NULL,
  start_date              TEXT NOT NULL,
  end_date                TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('مفتوحة','منتهية')),
  reported_destination    TEXT,
  reported_trip_count     INTEGER,
  notes                   TEXT
);

CREATE TABLE IF NOT EXISTS Trip (
  id                      TEXT PRIMARY KEY,
  shift_id                TEXT NOT NULL REFERENCES Shift(id),
  trip_date               TEXT NOT NULL,
  crusher_cubic           REAL NOT NULL,
  client_cubic_reported   REAL NOT NULL,
  discount_qty            REAL NOT NULL DEFAULT 0,
  discount_reason         TEXT,
  location                TEXT,
  crusher_id              INTEGER NOT NULL REFERENCES Crusher(id),
  stone_price             REAL NOT NULL,
  crusher_receipt_status  TEXT NOT NULL CHECK (crusher_receipt_status IN ('قيمة','مفيش (متأكد)','مش معروف')),
  crusher_receipt_no      INTEGER,
  client_id               INTEGER NOT NULL REFERENCES Client(id),
  transport_price         REAL NOT NULL,
  client_price             REAL NOT NULL,
  recipient_name_status    TEXT NOT NULL DEFAULT 'مش واضح' CHECK (recipient_name_status IN ('قيمة','مش واضح')),
  recipient_name           TEXT,
  client_receipt_no        TEXT,
  notes                    TEXT,
  CHECK (
    (crusher_receipt_status = 'قيمة' AND crusher_receipt_no IS NOT NULL)
    OR (crusher_receipt_status <> 'قيمة' AND crusher_receipt_no IS NULL)
  ),
  CHECK (
    (recipient_name_status = 'قيمة' AND recipient_name IS NOT NULL)
    OR (recipient_name_status = 'مش واضح' AND recipient_name IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_crusher_receipt
ON Trip (crusher_id, crusher_receipt_no)
WHERE crusher_receipt_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS Ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date     TEXT NOT NULL,
  driver_id      INTEGER REFERENCES Driver(id),
  movement_type  TEXT NOT NULL CHECK (movement_type IN ('عهدة','دفعة','اخرى')),
  amount         REAL NOT NULL,
  shift_id       TEXT REFERENCES Shift(id),
  contractor_id  INTEGER NOT NULL REFERENCES TransportContractor(id),
  notes          TEXT
);
`

let db: Database.Database

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'shift-tracker.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion === 0) {
    db.exec(SCHEMA)
    db.pragma('user_version = 1')
    console.log('[db] Schema created. user_version = 1')
  } else {
    console.log(`[db] Existing database found. user_version = ${currentVersion}`)
  }

  console.log('[db] Database path:', dbPath)

  return db
}

export function getDb(): Database.Database {
  return db
}
