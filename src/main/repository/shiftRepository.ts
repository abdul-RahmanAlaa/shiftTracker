import { getDb } from '../db'

interface InsertShiftInput {
  id: string
  vehicleNo: number
  driverId: number
  crusherCubicDefault: number
  clientCubicDefault: number
  startDate: string
  reportedDestination: string | null
  reportedTripCount: number | null
  notes: string | null
}

export function getNextShiftId(): string {
  const db = getDb()
  const row = db
    .prepare(
      `
      SELECT id FROM Shift
      WHERE id LIKE 'SH-%'
      ORDER BY CAST(SUBSTR(id, 4) AS INTEGER) DESC
      LIMIT 1
    `
    )
    .get() as { id: string } | undefined

  const lastNumber = row ? parseInt(row.id.slice(3), 10) : 0
  return `SH-${String(lastNumber + 1).padStart(4, '0')}`
}

export function insertShift(input: InsertShiftInput): void {
  const db = getDb()
  const stmt = db.prepare(`
    INSERT INTO Shift (
      id, vehicle_no, driver_id, crusher_cubic_default, client_cubic_default,
      start_date, end_date, status, reported_destination, reported_trip_count, notes
    ) VALUES (@id, @vehicleNo, @driverId, @crusherCubicDefault, @clientCubicDefault,
      @startDate, NULL, 'مفتوحة', @reportedDestination, @reportedTripCount, @notes)
  `)
  stmt.run(input)
}

export function insertHistoricalShift(input: {
  id: string
  vehicleNo: number
  driverId: number
  crusherCubicDefault: number
  clientCubicDefault: number
  startDate: string
  endDate: string
}): void {
  const db = getDb()
  db.prepare(
    `
    INSERT INTO Shift (
      id, vehicle_no, driver_id, crusher_cubic_default, client_cubic_default,
      start_date, end_date, status, reported_destination, reported_trip_count, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'منتهية', NULL, NULL, NULL)
  `
  ).run(
    input.id,
    input.vehicleNo,
    input.driverId,
    input.crusherCubicDefault,
    input.clientCubicDefault,
    input.startDate,
    input.endDate
  )
}

interface ShiftRow {
  id: string
  status: string
}

export function getShiftById(shiftId: string): ShiftRow | undefined {
  const db = getDb()
  return db.prepare('SELECT id, status FROM Shift WHERE id = ?').get(shiftId) as
    ShiftRow | undefined
}

interface ShiftStatsRow {
  shift_id: string
  actual_trip_count: number
  reported_trip_count: number | null
  has_count_mismatch: number // SQLite بيرجع 0/1 مش boolean حقيقي
}

export function getShiftStats(shiftId: string): ShiftStatsRow | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM ShiftStats WHERE shift_id = ?').get(shiftId) as
    ShiftStatsRow | undefined
}

export function closeShiftInDb(shiftId: string, endDate: string): void {
  const db = getDb()
  db.prepare(`UPDATE Shift SET status = 'منتهية', end_date = ? WHERE id = ?`).run(endDate, shiftId)
}

export function getOpenShiftByDriver(driverId: number): { id: string } | undefined {
  const db = getDb()
  return db
    .prepare(`SELECT id FROM Shift WHERE driver_id = ? AND status = 'مفتوحة'`)
    .get(driverId) as { id: string } | undefined
}

export interface ShiftFullRow {
  id: string
  vehicleNo: number
  driverId: number
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
}

export function getOpenShiftByDriverFull(driverId: number): ShiftFullRow | undefined {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT
        id, vehicle_no as vehicleNo, driver_id as driverId,
        crusher_cubic_default as crusherCubicDefault,
        client_cubic_default as clientCubicDefault, status,
        start_date as startDate, end_date as endDate
      FROM Shift
      WHERE driver_id = ? AND status = 'مفتوحة'
    `
    )
    .get(driverId) as ShiftFullRow | undefined
}

export interface ShiftListRow {
  id: string
  vehicleNo: number
  driverId: number
  driverName: string
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
  startDate: string
  endDate: string | null
  actualTripCount: number
}

export function listAllShifts(): ShiftListRow[] {
  const db = getDb()
  return db
    .prepare(
      `
      SELECT
        s.id, s.vehicle_no as vehicleNo, s.driver_id as driverId, d.name as driverName,
        s.crusher_cubic_default as crusherCubicDefault,
        s.client_cubic_default as clientCubicDefault, s.status,
        s.start_date as startDate, s.end_date as endDate,
        (SELECT COUNT(*) FROM Trip t WHERE t.shift_id = s.id) as actualTripCount
      FROM Shift s
      JOIN Driver d ON d.id = s.driver_id
      ORDER BY s.start_date DESC, s.id DESC
    `
    )
    .all() as ShiftListRow[]
}
