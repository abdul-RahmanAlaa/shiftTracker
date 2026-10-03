import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS TransportContractor (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  phone TEXT
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
  initial_price  REAL
);

CREATE TABLE IF NOT EXISTS Client (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL UNIQUE,
  initial_price  REAL
);

CREATE TABLE IF NOT EXISTS Shift (
  id                      TEXT PRIMARY KEY,
  vehicle_no              INTEGER NOT NULL REFERENCES Vehicle(vehicle_no),
  driver_id               INTEGER NOT NULL REFERENCES Driver(id),
  crusher_cubic_default   REAL NOT NULL,
  client_cubic_default    REAL NOT NULL,
  start_date              TEXT NOT NULL,
  end_date                TEXT,
  status                  TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
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
  stone_price             REAL,
  crusher_receipt_status  TEXT NOT NULL CHECK (crusher_receipt_status IN ('PROVIDED','CONFIRMED_MISSING','UNKNOWN')),
  crusher_receipt_no      INTEGER,
  client_id               INTEGER NOT NULL REFERENCES Client(id),
  transport_price         REAL NOT NULL,
  client_price             REAL NOT NULL,
  recipient_name_status    TEXT NOT NULL DEFAULT 'UNCLEAR' CHECK (recipient_name_status IN ('PROVIDED','UNCLEAR')),
  recipient_name           TEXT,
  client_receipt_no        TEXT,
  notes                    TEXT,
  CHECK (
    (crusher_receipt_status = 'PROVIDED' AND crusher_receipt_no IS NOT NULL)
    OR (crusher_receipt_status <> 'PROVIDED' AND crusher_receipt_no IS NULL)
  ),
  CHECK (
    (recipient_name_status = 'PROVIDED' AND recipient_name IS NOT NULL)
    OR (recipient_name_status = 'UNCLEAR' AND recipient_name IS NULL)
  )
);

CREATE TABLE Attachment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('TRIP','SHIFT')),
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('CRUSHER_RECEIPT','CLIENT_RECEIPT','CLOSING_SHEET')),
  photo_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attachment_entity ON Attachment (entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_crusher_receipt
ON Trip (crusher_id, crusher_receipt_no)
WHERE crusher_receipt_no IS NOT NULL;

CREATE TABLE IF NOT EXISTS Ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date     TEXT NOT NULL,
  driver_id      INTEGER REFERENCES Driver(id),
  movement_type  TEXT NOT NULL CHECK (movement_type IN ('ADVANCE','PAYMENT','OTHER')),
  amount         REAL NOT NULL,
  shift_id       TEXT REFERENCES Shift(id),
  contractor_id  INTEGER NOT NULL REFERENCES TransportContractor(id),
  notes          TEXT
);

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

CREATE VIEW IF NOT EXISTS TripAccounting AS
SELECT
  id,
  crusher_cubic * stone_price AS crusher_amount,
  crusher_cubic * transport_price AS transport_amount,
  (client_cubic_reported - discount_qty) AS effective_client_cubic,
  (client_cubic_reported - discount_qty) * client_price AS client_amount
FROM Trip;

CREATE TABLE IF NOT EXISTS ClientPayment (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date  TEXT NOT NULL,
  client_id   INTEGER NOT NULL REFERENCES Client(id),
  amount      REAL NOT NULL,
  notes       TEXT
);
`

const MIGRATION_V10_ATTACHMENTS = `
CREATE TABLE Attachment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('TRIP','SHIFT')),
  entity_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('CRUSHER_RECEIPT','CLIENT_RECEIPT','CLOSING_SHEET')),
  photo_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_attachment_entity ON Attachment (entity_type, entity_id);

INSERT INTO Attachment (entity_type, entity_id, kind, photo_path)
SELECT 'TRIP', id, 'CRUSHER_RECEIPT', receipt_photo_path
FROM Trip WHERE receipt_photo_path IS NOT NULL;

INSERT INTO Attachment (entity_type, entity_id, kind, photo_path)
SELECT 'SHIFT', id, 'CLOSING_SHEET', closing_photo_path
FROM Shift WHERE closing_photo_path IS NOT NULL;

ALTER TABLE Trip DROP COLUMN receipt_photo_path;
ALTER TABLE Shift DROP COLUMN closing_photo_path;
`

let db: Database.Database

function migrateToV10(): void {
  db.pragma('foreign_keys = OFF')
  try {
    db.transaction(() => db.exec(MIGRATION_V10_ATTACHMENTS))()
  } finally {
    db.pragma('foreign_keys = ON')
  }
}

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath('userData'), 'shift-tracker.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const currentVersion = db.pragma('user_version', { simple: true }) as number

  if (currentVersion === 0) {
    db.exec(SCHEMA)
    db.pragma('user_version = 10')
    console.log('[db] Schema created (fresh install, attachments enabled). user_version = 10')
  } else if (currentVersion === 1 || currentVersion === 9) {
    migrateToV10()
    db.pragma('user_version = 10')
    console.log(
      `[db] Migration v${currentVersion} -> v10 applied (generic attachments). user_version = 10`
    )
  } else {
    console.log(`[db] Database up to date. user_version = ${currentVersion}`)
  }

  console.log('[db] Database path:', dbPath)

  return db
}

export function getDb(): Database.Database {
  return db
}
