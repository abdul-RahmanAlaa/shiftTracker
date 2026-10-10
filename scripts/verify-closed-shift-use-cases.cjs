/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')
const { build } = require('esbuild')

const root = path.resolve(__dirname, '..')
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shift-tracker-use-cases-'))
const resultOutputPath = process.env.SHIFT_TRACKER_RESULT_FILE

for (const method of ['log', 'error']) {
  const writeConsole = console[method].bind(console)
  console[method] = (...values) => {
    writeConsole(...values)
    if (resultOutputPath) {
      fs.appendFileSync(resultOutputPath, values.map(String).join(' ') + '\n')
    }
  }
}

if (!process.versions.electron) {
  console.error('FAIL runtime | actual: not running in Electron Node | expected: Electron as Node')
  fs.rmSync(tempDir, { recursive: true, force: true })
  process.exit(2)
}

const entry = `
import { initDatabase, getDb } from '../src/main/db'
import fs from 'node:fs'
import path from 'node:path'
import { createLedgerEntry, updateLedgerEntry, deleteLedgerEntry } from '../src/main/use-cases/createLedgerEntry'
import { createClientPayment, updateClientPayment } from '../src/main/use-cases/createClientPayment'
import { createShift } from '../src/main/use-cases/createShift'
import { closeShift } from '../src/main/use-cases/closeShift'
import { createTrip, updateTrip } from '../src/main/use-cases/createTrip'
import { reopenShift } from '../src/main/use-cases/reopenShift'
import { getTripById as getTripRawById } from '../src/main/repository/tripRepository'
import { listTripsByShift } from '../src/main/use-cases/listTripData'
import { createClient } from '../src/main/use-cases/createClient'
import { createContractor } from '../src/main/use-cases/createContractor'
import { createCrusher } from '../src/main/use-cases/createCrusher'
import { getClientAccount, getContractorAccount } from '../src/main/use-cases/getAccounts'
import { getClientStatement, getContractorStatement } from '../src/main/use-cases/getStatement'

const outcomes = []
function runCase(name, expected, operation, passes) {
  let actual
  try {
    actual = { threw: false, value: operation() }
  } catch (error) {
    actual = { threw: true, error: error instanceof Error ? error.message : String(error) }
  }
  const pass = passes(actual)
  if (!pass) outcomes.push(name)
  console.log(
    '| ' +
      name.replaceAll('|', '\\|') +
      ' | ' +
      (pass ? 'PASS' : 'FAIL') +
      ' | ' +
      expected.replaceAll('|', '\\|') +
      ' |'
  )
  if (!pass) console.log('DETAIL ' + name + ' | ' + JSON.stringify(actual))
  return actual
}
function result(actual) {
  return actual && !actual.threw ? actual.value : undefined
}
function getTripById(id) {
  const raw = getTripRawById(id)
  if (!raw) return undefined
  const result = listTripsByShift(raw.shiftId)
  return result.ok ? result.data.find((trip) => trip.id === id) : undefined
}
function hasFieldErrors(value, fields) {
  return value?.ok === false && fields.every((field) => value.errors.some((error) => error.field === field))
}
function hasExactFieldError(value, field) {
  return value?.ok === false && value.errors.length === 1 && value.errors[0].field === field
}
function hasExactFieldErrorMessage(value, field, message) {
  return hasExactFieldError(value, field) && value.errors[0].message.includes(message)
}
function tripRowsSnapshot() {
  return JSON.stringify(db.prepare('SELECT * FROM Trip ORDER BY id').all())
}
function shiftRowsSnapshot() {
  return JSON.stringify(db.prepare('SELECT * FROM Shift ORDER BY id').all())
}
function shiftRowSnapshot(shiftId) {
  return JSON.stringify(db.prepare('SELECT * FROM Shift WHERE id = ?').get(shiftId))
}
function newShiftInput() {
  const sequence = fixtureSequence++
  const vehicleNo = 98000 + sequence
  const driverId = Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Validation Driver ' + sequence).lastInsertRowid)
  db.prepare('INSERT INTO Vehicle (vehicle_no, trailer_no, contractor_id) VALUES (?, ?, ?)').run(vehicleNo, vehicleNo + 1000, contractorId)
  return {
    vehicleNo,
    driverId,
    crusherCubicDefault: 1,
    clientCubicDefault: 1,
    startDate: '2026-02-01'
  }
}
function createOwnShift() {
  const input = newShiftInput()
  const created = createShift(input)
  if (!created.ok) throw new Error('Validation-shift setup failed: ' + JSON.stringify(created))
  return { ...input, id: created.data.id }
}
function tripInput(shiftId) {
  return {
    shiftId,
    tripDate: '2026-02-01',
    clientId,
    crusherCubic: 2,
    clientCubicReported: 2,
    fineAmount: 0,
    fineReason: '',
    location: '',
    crusherId,
    stonePrice: 10,
    crusherReceiptStatus: 'UNKNOWN',
    crusherReceiptNo: undefined,
    clientId,
    transportPrice: 10,
    clientPrice: 10,
    materialTypeId,
    recipientNameStatus: 'UNCLEAR',
    recipientName: '',
    clientReceiptNo: '',
    notes: ''
  }
}
function rejectedTripCreate(override) {
  const shift = createOwnShift()
  const before = tripRowsSnapshot()
  const response = createTrip({ ...tripInput(shift.id), ...override })
  return { response, unchanged: before === tripRowsSnapshot() }
}
function rejectedTripUpdate(override) {
  const shift = createOwnShift()
  const seeded = createTrip(tripInput(shift.id))
  if (!seeded.ok) throw new Error('Validation-trip setup failed: ' + JSON.stringify(seeded))
  const id = seeded.data.id
  const before = JSON.stringify(db.prepare('SELECT * FROM Trip WHERE id = ?').get(id))
  const response = updateTrip({ id, ...tripInput(shift.id), ...override })
  const after = JSON.stringify(db.prepare('SELECT * FROM Trip WHERE id = ?').get(id))
  return { response, unchanged: before === after }
}
function rejectedShiftCreate(override) {
  const input = { ...newShiftInput(), ...override }
  const before = shiftRowsSnapshot()
  const response = createShift(input)
  return { response, unchanged: before === shiftRowsSnapshot() }
}
function addClosingSheet(shiftId, filename) {
  const relativePath = 'docs/attachments/' + filename
  const attachmentDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'docs', 'attachments')
  fs.mkdirSync(attachmentDir, { recursive: true })
  fs.writeFileSync(path.join(attachmentDir, filename), Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00]))
  db.prepare("INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run('SHIFT', shiftId, 'CLOSING_SHEET', relativePath)
}
function createLedger(overrides = {}) {
  return createLedgerEntry({
    entryDate: '2026-01-10',
    driverId: driverId,
    movementType: 'ADVANCE',
    amount: 100,
    shiftId: null,
    contractorId: contractorId,
    notes: 'test',
    ...overrides
  })
}
function updateLedger(id, overrides = {}) {
  return updateLedgerEntry({
    id,
    entryDate: '2026-01-10',
    driverId,
    movementType: 'ADVANCE',
    amount: 100,
    shiftId: openShiftId,
    contractorId,
    notes: 'updated',
    ...overrides
  })
}

let db
let contractorId
let driverId
let clientId
let crusherId
let materialTypeId
let openShiftId
let closedShiftId
let closedLedgerId
let openLedgerId
let paymentId
let reopenedCountShiftId
let fixtureSequence = 0

try {
  db = initDatabase()
  console.log('| Case | Result | Expected |')
  console.log('| --- | --- | --- |')
  const contractorInsert = db.prepare('INSERT INTO TransportContractor (name) VALUES (?)').run('Verify Contractor')
  contractorId = Number(contractorInsert.lastInsertRowid)
  const driverInsert = db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Driver')
  driverId = Number(driverInsert.lastInsertRowid)
  const clientInsert = db.prepare('INSERT INTO Client (name) VALUES (?)').run('Verify Client')
  clientId = Number(clientInsert.lastInsertRowid)
  const crusherInsert = db.prepare('INSERT INTO Crusher (name) VALUES (?)').run('Verify Crusher')
  crusherId = Number(crusherInsert.lastInsertRowid)
  const materialTypeInsert = db.prepare('INSERT INTO MaterialType (name) VALUES (?)').run('Verify Material')
  materialTypeId = Number(materialTypeInsert.lastInsertRowid)
  db.prepare('INSERT INTO Vehicle (vehicle_no, trailer_no, contractor_id) VALUES (?, ?, ?)').run(97001, 97002, contractorId)
  db.prepare('INSERT INTO Vehicle (vehicle_no, trailer_no, contractor_id) VALUES (?, ?, ?)').run(97002, 97003, contractorId)
  for (const [vehicleNo, trailerNo] of [[97010, 97011], [97011, 97012], [97012, 97013], [97013, 97014], [97014, 97015], [97020, 97021], [97030, 97031], [97050, 97051]]) {
    db.prepare('INSERT INTO Vehicle (vehicle_no, trailer_no, contractor_id) VALUES (?, ?, ?)').run(vehicleNo, trailerNo, contractorId)
  }

  const openResult = createShift({
    vehicleNo: 97001,
    driverId,
    crusherCubicDefault: 1,
    clientCubicDefault: 1,
    startDate: '2026-01-01'
  })
  if (!openResult.ok) throw new Error('Open-shift setup failed: ' + JSON.stringify(openResult))
  openShiftId = openResult.data.id

  closedShiftId = 'VERIFY-CLOSED'
  db.prepare("INSERT INTO Shift (id, vehicle_no, driver_id, contractor_id, crusher_cubic_default, client_cubic_default, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CLOSED')").run(closedShiftId, 97001, driverId, contractorId, 1, 1, '2026-01-01', '2026-01-02')

  const seedClosedLedger = db.prepare('INSERT INTO Ledger (entry_date, driver_id, movement_type, amount, shift_id, contractor_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
  closedLedgerId = Number(seedClosedLedger.run('2026-01-02', driverId, 'ADVANCE', 100, closedShiftId, contractorId, 'closed legacy row').lastInsertRowid)

  const openLedgerResult = createLedger({ shiftId: openShiftId, contractorId: null })
  if (!openLedgerResult.ok) throw new Error('Open-ledger setup failed: ' + JSON.stringify(openLedgerResult))
  openLedgerId = openLedgerResult.data.id

  const closedFields = () => ({
    entryDate: '2026-01-10', driverId, movementType: 'ADVANCE', amount: 200,
    shiftId: closedShiftId, contractorId, notes: 'attempt'
  })

  runCase('D1 closed-entry amount update rejected', 'ok:false / exact field id / row unchanged', () => {
    const before = JSON.stringify(db.prepare('SELECT * FROM Ledger WHERE id = ?').get(closedLedgerId))
    const response = updateLedger(closedLedgerId, { amount: 200, shiftId: closedShiftId })
    return { response, unchanged: before === JSON.stringify(db.prepare('SELECT * FROM Ledger WHERE id = ?').get(closedLedgerId)) }
  }, (actual) => {
    const output = result(actual)
    return output?.unchanged === true && hasExactFieldError(output.response, 'id')
  })
  runCase('D2 clearing shift on closed entry rejected', 'ok:false / exact field id / row unchanged', () => {
    const before = JSON.stringify(db.prepare('SELECT * FROM Ledger WHERE id = ?').get(closedLedgerId))
    const response = updateLedger(closedLedgerId, { shiftId: null })
    return { response, unchanged: before === JSON.stringify(db.prepare('SELECT * FROM Ledger WHERE id = ?').get(closedLedgerId)) }
  }, (actual) => {
    const output = result(actual)
    return output?.unchanged === true && hasExactFieldError(output.response, 'id')
  })
  runCase('D3 create on closed shift rejected with shiftId field', 'ok:false / field shiftId', () => createLedger(closedFields()), (actual) => hasFieldErrors(result(actual), ['shiftId']))
  runCase('D4 move open entry to closed shift rejected', 'ok:false / field shiftId', () => updateLedger(openLedgerId, { shiftId: closedShiftId }), (actual) => hasFieldErrors(result(actual), ['shiftId']))
  runCase('D5 OTHER without shift with contractor and note accepted', 'ok:true and persisted note', () => createLedger({ shiftId: null, contractorId, movementType: 'OTHER', notes: 'manual correction' }), (actual) => {
    const created = result(actual)
    return created?.ok === true && db.prepare('SELECT notes FROM Ledger WHERE id = ?').get(created.data.id)?.notes === 'manual correction'
  })
  runCase('D6 delete closed-shift entry rejected', 'ok:false', () => deleteLedgerEntry({ id: closedLedgerId }), (actual) => {
    const deleted = result(actual)
    const before = db.prepare('SELECT id FROM Ledger WHERE id = ?').get(closedLedgerId)
    return deleted?.ok === false && before?.id === closedLedgerId
  })
  runCase('C1 OPEN close with empty reported count rejected', 'ok:false / field reportedTripCount and row still OPEN', () => {
    const shiftResult = createShift({
      vehicleNo: 97010,
      driverId: Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Open Close Driver').lastInsertRowid),
      crusherCubicDefault: 1,
      clientCubicDefault: 1,
      startDate: '2026-01-20'
    })
    if (!shiftResult.ok) return { shiftResult }
    const shiftId = shiftResult.data.id
    return { shiftId, closeResult: closeShift({ shiftId, endDate: '2026-01-21' }) }
  }, (actual) => {
    const output = result(actual)
    return output?.shiftId && output?.closeResult && !output.closeResult.ok && hasFieldErrors(output.closeResult, ['reportedTripCount']) && db.prepare('SELECT status FROM Shift WHERE id = ?').get(output.shiftId)?.status === 'OPEN'
  })
  runCase('C2 OPEN close with invalid reported count values rejected', 'ok:false / field reportedTripCount and row still OPEN', () => {
    const values = [2.5, -1, '3', Number.NaN]
    const generated = []
    for (const reportedTripCount of values) {
      const shiftResult = createShift({
        vehicleNo: 97011 + generated.length,
        driverId: Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Bad Count Driver ' + generated.length).lastInsertRowid),
        crusherCubicDefault: 1,
        clientCubicDefault: 1,
        startDate: '2026-01-22'
      })
      if (!shiftResult.ok) return { failure: shiftResult }
      const closeResult = closeShift({
        shiftId: shiftResult.data.id,
        endDate: '2026-01-23',
        reportedTripCount: reportedTripCount as unknown as number
      })
      generated.push({ shiftId: shiftResult.data.id, closeResult })
    }
    return { generated }
  }, (actual) => {
    const output = result(actual)
    const generated = output?.generated ?? []
    return generated.length === 4 && generated.every((entry) => entry.closeResult && !entry.closeResult.ok && hasFieldErrors(entry.closeResult, ['reportedTripCount']) && db.prepare('SELECT status FROM Shift WHERE id = ?').get(entry.shiftId)?.status === 'OPEN')
  })
  runCase('C3 createShift rejects reportedTripCount and stores NULL', 'ok:false for reported count field, DB stored NULL or no field', () => {
    const shiftResult = createShift({
      vehicleNo: 97001,
      driverId: Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Count Reject Driver').lastInsertRowid),
      crusherCubicDefault: 1,
      clientCubicDefault: 1,
      startDate: '2026-01-24',
      reportedTripCount: 99
    })
    return { shiftResult }
  }, (actual) => {
    const output = result(actual)
    return output?.shiftResult && !output.shiftResult.ok && hasFieldErrors(output.shiftResult, ['reportedTripCount'])
  })
  runCase('C4 second OPEN shift on same vehicle rejected on vehicleNo', 'ok:false / field vehicleNo / same vehicle already has open shift', () => {
    const firstDriverId = Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Vehicle Driver A').lastInsertRowid)
    const secondDriverId = Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Vehicle Driver B').lastInsertRowid)
    const first = createShift({ vehicleNo: 97002, driverId: firstDriverId, crusherCubicDefault: 1, clientCubicDefault: 1, startDate: '2026-01-25' })
    if (!first.ok) return { first }
    const second = createShift({ vehicleNo: 97002, driverId: secondDriverId, crusherCubicDefault: 1, clientCubicDefault: 1, startDate: '2026-01-26' })
    return { first, second }
  }, (actual) => {
    const output = result(actual)
    return output?.second && !output.second.ok && hasFieldErrors(output.second, ['vehicleNo'])
  })
  const invalidTripNumbers = [
    ['string', '10'],
    ['NaN', Number.NaN],
    ['negative', -1],
    ['zero', 0]
  ]
  for (const field of [
    'stonePrice',
    'transportPrice',
    'clientPrice',
    'crusherCubic',
    'clientCubicReported'
  ]) {
    for (const [label, value] of invalidTripNumbers) {
      runCase('V createTrip rejects ' + field + ' ' + label, 'ok:false / exact field ' + field + ' / Trip rows unchanged', () => rejectedTripCreate({ [field]: value }), (actual) => {
        const output = result(actual)
        return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, field)
      })
      runCase('V updateTrip rejects ' + field + ' ' + label, 'ok:false / exact field ' + field + ' / Trip row unchanged', () => rejectedTripUpdate({ [field]: value }), (actual) => {
        const output = result(actual)
        return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, field)
      })
    }
  }
  for (const operation of [
    ['createTrip', rejectedTripCreate],
    ['updateTrip', rejectedTripUpdate]
  ]) {
    const [name, reject] = operation
    runCase('V ' + name + ' impossible tripDate is not valid', 'ok:false / exact field tripDate / invalid-date message / no Trip changes', () => reject({ tripDate: '2026-13-45' }), (actual) => {
      const output = result(actual)
      return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'tripDate', 'غير صحيح')
    })
    runCase('V ' + name + ' empty tripDate is required', 'ok:false / exact field tripDate / required message / no Trip changes', () => reject({ tripDate: '' }), (actual) => {
      const output = result(actual)
      return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'tripDate', 'مطلوب')
    })
    runCase('V ' + name + ' invalid crusherReceiptStatus', 'ok:false / exact field crusherReceiptStatus / no Trip changes', () => reject({ crusherReceiptStatus: 'INVALID' }), (actual) => {
      const output = result(actual)
      return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, 'crusherReceiptStatus')
    })
    runCase('V ' + name + ' invalid recipientNameStatus', 'ok:false / exact field recipientNameStatus / no Trip changes', () => reject({ recipientNameStatus: 'INVALID' }), (actual) => {
      const output = result(actual)
      return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, 'recipientNameStatus')
    })
    runCase('V ' + name + ' negative fineAmount', 'ok:false / exact field fineAmount / non-negative money error / no Trip changes', () => reject({ fineAmount: -0.5 }), (actual) => {
      const output = result(actual)
      return !actual.threw &&
        output?.unchanged === true &&
        hasExactFieldError(output.response, 'fineAmount')
    })
    runCase('V ' + name + ' PROVIDED crusher receipt requires a number', 'ok:false / exact field crusherReceiptNo / no Trip changes', () => reject({ crusherReceiptStatus: 'PROVIDED', crusherReceiptNo: undefined }), (actual) => {
      const output = result(actual)
      return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, 'crusherReceiptNo')
    })
  }
  for (const field of ['crusherCubicDefault', 'clientCubicDefault']) {
    for (const [label, value] of [['zero', 0], ['negative', -1], ['string', '1']]) {
      runCase('V createShift rejects ' + field + ' ' + label, 'ok:false / exact field ' + field + ' / Shift rows unchanged', () => rejectedShiftCreate({ [field]: value }), (actual) => {
        const output = result(actual)
        return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, field)
      })
    }
  }
  runCase('V createShift impossible startDate is not valid', 'ok:false / exact field startDate / invalid-date message / no Shift insert', () => rejectedShiftCreate({ startDate: '2026-13-45' }), (actual) => {
    const output = result(actual)
    return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'startDate', 'غير صحيح')
  })
  runCase('V createShift empty startDate is required', 'ok:false / exact field startDate / required message / no Shift insert', () => rejectedShiftCreate({ startDate: '' }), (actual) => {
    const output = result(actual)
    return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'startDate', 'مطلوب')
  })
  runCase('V createShift rejects provided reportedTripCount without insert', 'ok:false / exact field reportedTripCount / no Shift insert', () => rejectedShiftCreate({ reportedTripCount: 0 }), (actual) => {
    const output = result(actual)
    return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, 'reportedTripCount')
  })
  runCase('V closeShift rejects endDate before startDate without changing shift', 'ok:false / exact field endDate / shift unchanged', () => {
    const shift = createOwnShift()
    const before = shiftRowSnapshot(shift.id)
    const response = closeShift({ shiftId: shift.id, endDate: '2026-01-31', reportedTripCount: 0 })
    return { response, unchanged: before === shiftRowSnapshot(shift.id) }
  }, (actual) => {
    const output = result(actual)
    return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, 'endDate')
  })
  runCase('V closeShift rejects mismatched valid count and leaves OPEN shift unchanged', 'ok:false / exact field tripCount / OPEN row unchanged', () => {
    const shift = createOwnShift()
    const before = shiftRowSnapshot(shift.id)
    const response = closeShift({ shiftId: shift.id, endDate: '2026-02-02', reportedTripCount: 1 })
    return {
      response,
      unchanged: before === shiftRowSnapshot(shift.id),
      status: db.prepare('SELECT status FROM Shift WHERE id = ?').get(shift.id)?.status
    }
  }, (actual) => {
    const output = result(actual)
    return !actual.threw &&
      output?.unchanged === true &&
      output.status === 'OPEN' &&
      hasExactFieldError(output.response, 'tripCount')
  })
  runCase('V closeShift succeeds when backup works without warning', 'ok:true / CLOSED shift / backup created / no backupWarning', () => {
    const shift = createOwnShift()
    addClosingSheet(shift.id, 'validation-backup-success.jpg')
    const backupDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'backups')
    const before = fs.existsSync(backupDir)
      ? new Set(fs.readdirSync(backupDir).filter((name) => name.startsWith('shift-tracker-')))
      : new Set()
    const response = closeShift({ shiftId: shift.id, endDate: '2026-02-02', reportedTripCount: 0 })
    const createdBackups = fs.existsSync(backupDir)
      ? fs.readdirSync(backupDir).filter((name) => name.startsWith('shift-tracker-') && !before.has(name))
      : []
    return {
      response,
      status: db.prepare('SELECT status FROM Shift WHERE id = ?').get(shift.id)?.status,
      createdBackups
    }
  }, (actual) => {
    const output = result(actual)
    return output?.response?.ok === true &&
      output.response.data.backupWarning === undefined &&
      output.status === 'CLOSED' &&
      output.createdBackups.length > 0
  })
  runCase('V closeShift backup failure still closes and returns warning', 'ok:true / CLOSED shift / backupWarning:true', () => {
    const shift = createOwnShift()
    addClosingSheet(shift.id, 'validation-backup-failure.jpg')
    const backupDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'backups')
    const parkedBackupDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'backups-before-failure-test')
    const hadBackupDir = fs.existsSync(backupDir)
    if (hadBackupDir) fs.renameSync(backupDir, parkedBackupDir)
    fs.writeFileSync(backupDir, 'blocked backup destination')
    let response
    try {
      response = closeShift({ shiftId: shift.id, endDate: '2026-02-02', reportedTripCount: 0 })
    } finally {
      fs.unlinkSync(backupDir)
      if (hadBackupDir) fs.renameSync(parkedBackupDir, backupDir)
    }
    return {
      response,
      status: db.prepare('SELECT status FROM Shift WHERE id = ?').get(shift.id)?.status
    }
  }, (actual) => {
    const output = result(actual)
    return output?.response?.ok === true &&
      output.response.data.backupWarning === true &&
      output.status === 'CLOSED'
  })
  runCase('V closeShift impossible endDate is not valid', 'ok:false / exact field endDate / invalid-date message / shift unchanged', () => {
    const shift = createOwnShift()
    const before = shiftRowSnapshot(shift.id)
    const response = closeShift({ shiftId: shift.id, endDate: '2026-13-45', reportedTripCount: 0 })
    return { response, unchanged: before === shiftRowSnapshot(shift.id) }
  }, (actual) => {
    const output = result(actual)
    return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'endDate', 'غير صحيح')
  })
  runCase('V closeShift empty endDate is required', 'ok:false / exact field endDate / required message / shift unchanged', () => {
    const shift = createOwnShift()
    const before = shiftRowSnapshot(shift.id)
    const response = closeShift({ shiftId: shift.id, endDate: '', reportedTripCount: 0 })
    return { response, unchanged: before === shiftRowSnapshot(shift.id) }
  }, (actual) => {
    const output = result(actual)
    return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'endDate', 'مطلوب')
  })
  runCase('V CLOSED shift with invalid count reports already-closed shiftId first', 'ok:false / exact field shiftId / row unchanged', () => {
    const shift = createOwnShift()
    db.prepare("UPDATE Shift SET status = 'CLOSED', end_date = ? WHERE id = ?").run('2026-02-02', shift.id)
    const before = shiftRowSnapshot(shift.id)
    const response = closeShift({ shiftId: shift.id, endDate: '2026-02-03', reportedTripCount: -1 })
    return { response, unchanged: before === shiftRowSnapshot(shift.id) }
  }, (actual) => {
    const output = result(actual)
    return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'shiftId', 'مقفولة بالفعل')
  })
  runCase('V vehicle becomes available after close and reopened shift does not block it', 'second OPEN rejects vehicleNo, close frees vehicle, REOPENED allows new shift', () => {
    const firstInput = newShiftInput()
    const vehicleNo = firstInput.vehicleNo
    const first = createShift(firstInput)
    if (!first.ok) return { first }
    const secondInput = { ...newShiftInput(), vehicleNo }
    const beforeRejectedCreate = shiftRowsSnapshot()
    const secondRejected = createShift(secondInput)
    const noInsert = beforeRejectedCreate === shiftRowsSnapshot()
    addClosingSheet(first.data.id, 'validation-vehicle-close.jpg')
    const firstClosed = closeShift({ shiftId: first.data.id, endDate: '2026-02-02', reportedTripCount: 0 })
    const thirdInput = { ...newShiftInput(), vehicleNo }
    const afterClose = createShift(thirdInput)
    if (!afterClose.ok) return { secondRejected, noInsert, firstClosed, afterClose }
    addClosingSheet(afterClose.data.id, 'validation-vehicle-close-again.jpg')
    const secondClosed = closeShift({ shiftId: afterClose.data.id, endDate: '2026-02-03', reportedTripCount: 0 })
    const reopened = reopenShift({ shiftId: first.data.id, reason: 'vehicle guard verification' })
    const fourthInput = { ...newShiftInput(), vehicleNo }
    const afterReopen = createShift(fourthInput)
    return { secondRejected, noInsert, firstClosed, afterClose, secondClosed, reopened, afterReopen }
  }, (actual) => {
    const output = result(actual)
    return output?.secondRejected?.ok === false &&
      hasExactFieldError(output.secondRejected, 'vehicleNo') &&
      output.noInsert === true &&
      output.firstClosed?.ok === true &&
      output.afterClose?.ok === true &&
      output.secondClosed?.ok === true &&
      output.reopened?.ok === true &&
      output.afterReopen?.ok === true
  })
  runCase('V createTrip accepts complete valid renderer payload with monetary fine', 'ok:true / row stores fineAmount 0.5 and empty optional strings preserved', () => {
    const shift = createOwnShift()
    const beforeCount = db.prepare('SELECT COUNT(*) AS count FROM Trip').get().count
    const response = createTrip({ ...tripInput(shift.id), fineAmount: 0.5 })
    const afterCount = db.prepare('SELECT COUNT(*) AS count FROM Trip').get().count
    const saved = response.ok ? getTripById(response.data.id) : undefined
    return { response, beforeCount, afterCount, saved }
  }, (actual) => {
    const output = result(actual)
    return output?.response?.ok === true &&
      output.afterCount === output.beforeCount + 1 &&
      output.saved?.fineAmount === 0.5 &&
      output.saved?.fineReason === '' &&
      output.saved?.location === '' &&
      output.saved?.recipientName === null &&
      output.saved?.clientReceiptNo === '' &&
      output.saved?.notes === ''
  })
  runCase('V updateTrip accepts complete valid payload', 'ok:true / updated price and monetary fine persisted', () => {
    const shift = createOwnShift()
    const seeded = createTrip(tripInput(shift.id))
    if (!seeded.ok) return { seeded }
    const response = updateTrip({ id: seeded.data.id, ...tripInput(shift.id), stonePrice: 11, fineAmount: 0.5 })
    return { response, saved: getTripById(seeded.data.id) }
  }, (actual) => {
    const output = result(actual)
    return output?.response?.ok === true && output.saved?.stonePrice === 11 && output.saved?.fineAmount === 0.5
  })
  runCase('V updateTrip accepts renderer-shaped empty optional fields from a DB row', 'ok:true / DB nulls map to blank strings and update succeeds', () => {
    const shift = createOwnShift()
    const seeded = createTrip(tripInput(shift.id))
    if (!seeded.ok) return { seeded }
    db.prepare(
      'UPDATE Trip SET fine_reason = NULL, location = NULL, recipient_name = NULL, client_receipt_no = NULL, notes = NULL WHERE id = ?'
    ).run(seeded.data.id)
    const row = getTripById(seeded.data.id)
    if (!row) return { missingRow: true }
    const rendererValues = {
      id: row.id,
      tripDate: row.tripDate,
      crusherCubic: row.crusherCubic,
      clientCubicReported: row.clientCubicReported,
      fineAmount: row.fineAmount,
      fineReason: row.fineReason ?? '',
      location: row.location ?? '',
      crusherId: row.crusherId,
      stonePrice: row.stonePrice ?? undefined,
      crusherReceiptStatus: row.crusherReceiptStatus,
      crusherReceiptNo: row.crusherReceiptNo ?? undefined,
      clientId: row.clientId,
      transportPrice: row.transportPrice,
      clientPrice: row.clientPrice,
      materialTypeId: row.materialTypeId ?? undefined,
      recipientNameStatus: row.recipientNameStatus,
      recipientName: row.recipientName ?? '',
      clientReceiptNo: row.clientReceiptNo ?? '',
      notes: row.notes ?? ''
    }
    const response = updateTrip(rendererValues)
    return { response, rendererValues, saved: getTripById(seeded.data.id) }
  }, (actual) => {
    const output = result(actual)
    return output?.response?.ok === true &&
      output.rendererValues.fineReason === '' &&
      output.rendererValues.location === '' &&
      output.rendererValues.recipientName === '' &&
      output.rendererValues.clientReceiptNo === '' &&
      output.rendererValues.notes === '' &&
      output.rendererValues.recipientNameStatus === 'UNCLEAR' &&
      output.saved?.fineReason === '' &&
      output.saved?.location === '' &&
      output.saved?.recipientName === null &&
      output.saved?.clientReceiptNo === '' &&
      output.saved?.notes === ''
  })
  runCase('R0 CLOSED shift with reported count returns already-closed shiftId error', 'ok:false / field shiftId / already closed', () => closeShift({ shiftId: closedShiftId, endDate: '2026-01-11', reportedTripCount: 0 }), (actual) => {
    const closed = result(actual)
    return !actual.threw && closed?.ok === false && closed.errors.some((error) => error.field === 'shiftId' && error.message === 'الوردية دي مقفولة بالفعل')
  })

  const secondClosedShiftId = 'VERIFY-CLOSED-2'
  db.prepare("INSERT INTO Shift (id, vehicle_no, driver_id, contractor_id, crusher_cubic_default, client_cubic_default, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CLOSED')").run(secondClosedShiftId, 97001, driverId, contractorId, 1, 1, '2026-01-03', '2026-01-04')

  runCase('R1 reopen closed shift with reason works', 'ok:true', () => reopenShift({ shiftId: closedShiftId, reason: 'correct end date' }), (actual) => {
    const reopened = result(actual)
    return reopened?.ok === true && db.prepare('SELECT status FROM Shift WHERE id = ?').get(closedShiftId)?.status === 'REOPENED'
  })
  runCase('R2 empty reason rejected', 'ok:false', () => reopenShift({ shiftId: secondClosedShiftId, reason: '   ' }), (actual) => result(actual)?.ok === false)
  runCase('R3 reopening OPEN shift rejected', 'ok:false', () => reopenShift({ shiftId: openShiftId, reason: 'not closed' }), (actual) => result(actual)?.ok === false)
  runCase('R4 ledger edit on reopened shift accepted', 'ok:true', () => updateLedgerEntry({ id: openLedgerId, entryDate: '2026-01-10', driverId, movementType: 'ADVANCE', amount: 230, shiftId: closedShiftId, contractorId, notes: 'reopened edit' }), (actual) => result(actual)?.ok === true)
  const reopenedTripId = 'TRIP-REOPENED'
  runCase('R5 createTrip on reopened shift accepted', 'ok:true', () => createTrip({
    shiftId: closedShiftId,
    tripDate: '2026-01-10',
    crusherCubic: 2,
    clientCubicReported: 2,
    crusherId,
    stonePrice: 100,
    crusherReceiptStatus: 'UNKNOWN',
    clientId,
    transportPrice: 50,
    clientPrice: 75,
    materialTypeId,
    recipientNameStatus: 'UNCLEAR',
    notes: 'reopened trip',
    clientReceiptNo: 'RCPT-1'
  }), (actual) => result(actual)?.ok === true)
  const reopenedTrip = db.prepare('SELECT id FROM Trip WHERE shift_id = ? ORDER BY trip_date DESC LIMIT 1').get(closedShiftId)
  if (reopenedTrip) {
    const tripAttachmentPath = 'docs/attachments/trip-reopened.jpg'
    const attachmentDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'docs', 'attachments')
    fs.mkdirSync(attachmentDir, { recursive: true })
    fs.writeFileSync(path.join(attachmentDir, 'trip-reopened.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00]))
    db.prepare("INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run('TRIP', reopenedTrip.id, 'CRUSHER_RECEIPT', tripAttachmentPath)
  }
  const newDriverId = Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify New Driver').lastInsertRowid)
  runCase('R6 createShift while another shift is reopened accepted', 'ok:true', () => createShift({
    vehicleNo: 97020,
    driverId: newDriverId,
    crusherCubicDefault: 1,
    clientCubicDefault: 1,
    startDate: '2026-01-20'
  }), (actual) => result(actual)?.ok === true)
  const closingAttachmentPath = 'docs/attachments/reopen-close-sheet.jpg'
  const closingAttachmentDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'docs', 'attachments')
  fs.mkdirSync(closingAttachmentDir, { recursive: true })
  fs.writeFileSync(path.join(closingAttachmentDir, 'reopen-close-sheet.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00]))
  db.prepare("INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run('SHIFT', closedShiftId, 'CLOSING_SHEET', closingAttachmentPath)
  runCase('R7 close reopened shift again returns CLOSED and records log', 'ok:true', () => closeShift({ shiftId: closedShiftId, endDate: '2026-01-12', reportedTripCount: 1 }), (actual) => {
    const closed = result(actual)
    return closed?.ok === true && db.prepare('SELECT status FROM Shift WHERE id = ?').get(closedShiftId)?.status === 'CLOSED' && db.prepare('SELECT closed_again_at FROM ShiftReopenLog WHERE shift_id = ? ORDER BY id DESC LIMIT 1').get(closedShiftId)?.closed_again_at != null
  })

  runCase('R8 re-close without a new count after adding a reopened-shift trip is rejected', 'initial close ok, reopen ok, trip creation ok, re-close rejects missing count', () => {
    const mismatchDriverId = Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Mismatch Driver').lastInsertRowid)
    const mismatchShiftResult = createShift({
      vehicleNo: 97030,
      driverId: mismatchDriverId,
      crusherCubicDefault: 1,
      clientCubicDefault: 1,
      startDate: '2026-01-21'
    })
    if (!mismatchShiftResult.ok) return { stage: 'createShift', result: mismatchShiftResult }

    const mismatchShiftId = mismatchShiftResult.data.id
    reopenedCountShiftId = mismatchShiftId
    const mismatchClosePath = 'docs/attachments/count-mismatch-close.jpg'
    const mismatchAttachmentDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'docs', 'attachments')
    fs.mkdirSync(mismatchAttachmentDir, { recursive: true })
    fs.writeFileSync(path.join(mismatchAttachmentDir, 'count-mismatch-close.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00]))
    db.prepare("INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run('SHIFT', mismatchShiftId, 'CLOSING_SHEET', mismatchClosePath)

    const initialClose = closeShift({ shiftId: mismatchShiftId, endDate: '2026-01-22', reportedTripCount: 0 })
    if (!initialClose.ok) return { stage: 'initialClose', initialClose }
    const reopenResult = reopenShift({ shiftId: mismatchShiftId, reason: 'add forgotten trip' })
    if (!reopenResult.ok) return { stage: 'reopen', initialClose, reopenResult }
    const tripResult = createTrip({
      shiftId: mismatchShiftId,
      tripDate: '2026-01-22',
      crusherCubic: 2,
      clientCubicReported: 2,
      crusherId,
      stonePrice: 100,
      crusherReceiptStatus: 'UNKNOWN',
      clientId,
      transportPrice: 50,
      clientPrice: 75,
      materialTypeId,
      recipientNameStatus: 'UNCLEAR',
      notes: 'forgotten trip after reopen'
    })
    if (!tripResult.ok) return { stage: 'createTrip', initialClose, reopenResult, tripResult }

    const tripAttachmentPath = 'docs/attachments/count-mismatch-trip.jpg'
    fs.writeFileSync(path.join(mismatchAttachmentDir, 'count-mismatch-trip.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00]))
    db.prepare("INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run('TRIP', tripResult.data.id, 'CRUSHER_RECEIPT', tripAttachmentPath)

    const recloseWithoutCount = closeShift({ shiftId: mismatchShiftId, endDate: '2026-01-23' })
    return { initialClose, reopenResult, tripResult, recloseWithoutCount }
  }, (actual) => {
    const sequence = result(actual)
    return sequence?.initialClose?.ok === true && sequence.reopenResult?.ok === true && sequence.tripResult?.ok === true && hasFieldErrors(sequence.recloseWithoutCount, ['reportedTripCount'])
  })
  runCase('R9 re-close with an incorrect reported count is rejected', 'ok:false / field tripCount and shift remains REOPENED', () => {
    if (!reopenedCountShiftId) return { ok: false, errors: [{ field: 'shiftId', message: 'R8 did not create its shift' }] }
    return closeShift({ shiftId: reopenedCountShiftId, endDate: '2026-01-23', reportedTripCount: 2 })
  }, (actual) => {
    const closed = result(actual)
    return hasFieldErrors(closed, ['tripCount']) && db.prepare('SELECT status FROM Shift WHERE id = ?').get(reopenedCountShiftId)?.status === 'REOPENED'
  })
  runCase('R10 re-close with the correct reported count closes shift and updates log', 'ok:true / status CLOSED, reported count 1, closed_again_at set', () => {
    if (!reopenedCountShiftId) return { ok: false, errors: [{ field: 'shiftId', message: 'R8 did not create its shift' }] }
    const result = closeShift({ shiftId: reopenedCountShiftId, endDate: '2026-01-23', reportedTripCount: 1 })
    return {
      result,
      status: db.prepare('SELECT status FROM Shift WHERE id = ?').get(reopenedCountShiftId)?.status,
      reportedTripCount: db.prepare('SELECT reported_trip_count FROM Shift WHERE id = ?').get(reopenedCountShiftId)?.reported_trip_count,
      closedAgainAt: db.prepare('SELECT closed_again_at FROM ShiftReopenLog WHERE shift_id = ? ORDER BY id DESC LIMIT 1').get(reopenedCountShiftId)?.closed_again_at
    }
  }, (actual) => {
    const closed = result(actual)
    return closed?.result?.ok === true && closed.status === 'CLOSED' && closed.reportedTripCount === 1 && closed.closedAgainAt != null
  })
  runCase('R11 OPEN close accepted with a valid reported count', 'ok:true / status CLOSED / reported count 0', () => {
    const shiftResult = createShift({
      vehicleNo: 97050,
      driverId: Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Open Close Accepted Driver').lastInsertRowid),
      crusherCubicDefault: 1,
      clientCubicDefault: 1,
      startDate: '2026-01-30'
    })
    if (!shiftResult.ok) return { shiftResult }
    const attachmentPath = 'docs/attachments/open-close-sheet.jpg'
    const attachmentDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'docs', 'attachments')
    fs.mkdirSync(attachmentDir, { recursive: true })
    fs.writeFileSync(path.join(attachmentDir, 'open-close-sheet.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00]))
    db.prepare("INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run('SHIFT', shiftResult.data.id, 'CLOSING_SHEET', attachmentPath)
    const closeResult = closeShift({ shiftId: shiftResult.data.id, endDate: '2026-01-31', reportedTripCount: 0 })
    return {
      shiftResult,
      closeResult,
      status: db.prepare('SELECT status FROM Shift WHERE id = ?').get(shiftResult.data.id)?.status,
      reportedTripCount: db.prepare('SELECT reported_trip_count FROM Shift WHERE id = ?').get(shiftResult.data.id)?.reported_trip_count
    }
  }, (actual) => {
    const output = result(actual)
    return output?.shiftResult?.ok === true && output?.closeResult?.ok === true && output?.status === 'CLOSED' && output?.reportedTripCount === 0
  })
  runCase('R12 invalid reported trip count type rejected without throwing', 'ok:false / field reportedTripCount', () => closeShift({ shiftId: openShiftId, endDate: '2026-01-11', reportedTripCount: '1' }), (actual) => !actual.threw && hasFieldErrors(result(actual), ['reportedTripCount']))
  runCase('R13 reopen rejects a non-string shiftId without throwing', 'ok:false / field shiftId', () => reopenShift({ shiftId: 123, reason: 'invalid input' }), (actual) => !actual.threw && hasFieldErrors(result(actual), ['shiftId']))
  runCase('R14 reopen rejects undefined input without throwing', 'ok:false / field shiftId', () => reopenShift(undefined), (actual) => !actual.threw && hasFieldErrors(result(actual), ['shiftId']))
  runCase('R15 REOPENED shift accepts reported count when closing', 'ok:true / status CLOSED / reported count 0 / reopen log closed', () => {
    const reopenResult = reopenShift({ shiftId: secondClosedShiftId, reason: 'verify reported count close' })
    if (!reopenResult.ok) return { reopenResult }
    const attachmentPath = 'docs/attachments/reopened-count-close.jpg'
    const attachmentDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'docs', 'attachments')
    fs.mkdirSync(attachmentDir, { recursive: true })
    fs.writeFileSync(path.join(attachmentDir, 'reopened-count-close.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00]))
    db.prepare("INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run('SHIFT', secondClosedShiftId, 'CLOSING_SHEET', attachmentPath)
    const closeResult = closeShift({ shiftId: secondClosedShiftId, endDate: '2026-01-05', reportedTripCount: 0 })
    return {
      reopenResult,
      closeResult,
      status: db.prepare('SELECT status FROM Shift WHERE id = ?').get(secondClosedShiftId)?.status,
      reportedTripCount: db.prepare('SELECT reported_trip_count FROM Shift WHERE id = ?').get(secondClosedShiftId)?.reported_trip_count,
      closedAgainAt: db.prepare('SELECT closed_again_at FROM ShiftReopenLog WHERE shift_id = ? ORDER BY id DESC LIMIT 1').get(secondClosedShiftId)?.closed_again_at
    }
  }, (actual) => {
    const closed = result(actual)
    return closed?.reopenResult?.ok === true && closed.closeResult?.ok === true && closed.status === 'CLOSED' && closed.reportedTripCount === 0 && closed.closedAgainAt != null
  })

  runCase('E1 update missing nullable fields errors on all four fields', 'errors include driverId, shiftId, contractorId, notes', () => updateLedgerEntry({ id: openLedgerId, entryDate: '2026-01-10', movementType: 'ADVANCE', amount: 100 }), (actual) => hasFieldErrors(result(actual), ['driverId', 'shiftId', 'contractorId', 'notes']))
  runCase('E2 invalid calendar date rejected on entryDate', 'error field entryDate', () => createLedger({ entryDate: '2026-02-30' }), (actual) => hasFieldErrors(result(actual), ['entryDate']))
  runCase('E3 driver FK error is result field error', 'ok:false / field driverId, no throw', () => createLedger({ driverId: 999999 }), (actual) => !actual.threw && hasFieldErrors(result(actual), ['driverId']))
  runCase('E3 shift FK error is result field error', 'ok:false / field shiftId, no throw', () => createLedger({ shiftId: 'NOPE' }), (actual) => !actual.threw && hasFieldErrors(result(actual), ['shiftId']))
  runCase('E3 contractor FK error is result field error', 'ok:false / field contractorId, no throw', () => createLedger({ shiftId: null, contractorId: 999999 }), (actual) => !actual.threw && hasFieldErrors(result(actual), ['contractorId']))
  runCase('E3 client payment FK error is result field error', 'ok:false / field clientId, no throw', () => createClientPayment({ entryDate: '2026-01-10', clientId: 999999, amount: 100, notes: null }), (actual) => !actual.threw && hasFieldErrors(result(actual), ['clientId']))

  runCase('E4 ledger NaN rejected on amount', 'error field amount', () => createLedger({ amount: Number.NaN }), (actual) => hasFieldErrors(result(actual), ['amount']))
  runCase('E4 client payment NaN rejected on amount', 'error field amount', () => createClientPayment({ entryDate: '2026-01-10', clientId, amount: Number.NaN, notes: null }), (actual) => hasFieldErrors(result(actual), ['amount']))
  runCase('E4 ledger zero rejected on amount', 'error field amount', () => createLedger({ amount: 0 }), (actual) => hasFieldErrors(result(actual), ['amount']))
  runCase('E4 client payment zero rejected on amount', 'error field amount', () => createClientPayment({ entryDate: '2026-01-10', clientId, amount: 0, notes: null }), (actual) => hasFieldErrors(result(actual), ['amount']))
  runCase('E4 ledger negative amount accepted', 'ok:true and amount -300 persisted', () => createLedger({ amount: -300 }), (actual) => {
    const created = result(actual)
    return created?.ok === true && db.prepare('SELECT amount FROM Ledger WHERE id = ?').get(created.data.id)?.amount === -30000
  })
  runCase('E4 client payment negative amount accepted', 'ok:true and amount -300 persisted', () => createClientPayment({ entryDate: '2026-01-10', clientId, amount: -300, notes: null }), (actual) => {
    const created = result(actual)
    return created?.ok === true && db.prepare('SELECT amount FROM ClientPayment WHERE id = ?').get(created.data.id)?.amount === -30000
  })

  const initialPayment = createClientPayment({ entryDate: '2026-01-10', clientId, amount: 50, notes: 'keep me' })
  if (!initialPayment.ok) throw new Error('Client payment setup failed: ' + JSON.stringify(initialPayment))
  paymentId = initialPayment.data.id
  runCase('E5 omitted payment notes rejected', 'error field notes', () => updateClientPayment({ id: paymentId, entryDate: '2026-01-10', clientId, amount: 50 }), (actual) => hasFieldErrors(result(actual), ['notes']))
  runCase('E5 explicit null clears payment notes', 'ok:true and database notes null', () => updateClientPayment({ id: paymentId, entryDate: '2026-01-10', clientId, amount: 50, notes: null }), (actual) => {
    const updated = result(actual)
    return updated?.ok === true && db.prepare('SELECT notes FROM ClientPayment WHERE id = ?').get(paymentId)?.notes === null
  })

  runCase('A1 client fixed fine, opening balance, payment, and cubic total', 'client charge 2000 - fine 200 - payment 1000 + opening 500 = 1300; cubic stays 20', () => {
    const client = createClient({
      name: 'Golden Client',
      openingBalance: 500,
      openingBalanceDate: '2026-02-15'
    })
    const contractor = createContractor({ name: 'Golden Contractor', openingBalance: 100 })
    if (!client.ok || !contractor.ok) throw new Error('Golden account setup failed')

    const shiftInput = newShiftInput()
    db.prepare('UPDATE Vehicle SET contractor_id = ? WHERE vehicle_no = ?').run(
      contractor.data.id,
      shiftInput.vehicleNo
    )
    const shiftResult = createShift(shiftInput)
    if (!shiftResult.ok) throw new Error('Golden shift setup failed')
    const trip = createTrip({
      ...tripInput(shiftResult.data.id),
      clientId: client.data.id,
      tripDate: '2026-02-01',
      crusherCubic: 22,
      clientCubicReported: 20,
      stonePrice: 50,
      transportPrice: 8,
      clientPrice: 100,
      fineAmount: 200,
      fineReason: 'Golden fine'
    })
    if (!trip.ok) throw new Error('Golden trip setup failed: ' + JSON.stringify(trip))
    const payment = createClientPayment({
      entryDate: '2026-02-02',
      clientId: client.data.id,
      amount: 1000,
      notes: null
    })
    const ledger = createLedgerEntry({
      entryDate: '2026-02-02',
      movementType: 'PAYMENT',
      amount: 1000,
      shiftId: null,
      contractorId: contractor.data.id,
      notes: 'Golden settlement'
    })
    if (!payment.ok || !ledger.ok) throw new Error('Golden settlement setup failed')

    const clientAccount = getClientAccount({ clientId: client.data.id })
    const clientStatement = getClientStatement({ clientId: client.data.id })
    const contractorAccount = getContractorAccount({ contractorId: contractor.data.id })
    const contractorStatement = getContractorStatement({ contractorId: contractor.data.id })
    const savedTrip = getTripById(trip.data.id)
    return {
      clientAccount,
      clientStatement,
      contractorAccount,
      contractorStatement,
      savedTrip,
      rawClientOpening: db.prepare('SELECT opening_balance FROM Client WHERE id = ?').get(client.data.id).opening_balance,
      rawContractorOpening: db.prepare('SELECT opening_balance FROM TransportContractor WHERE id = ?').get(contractor.data.id).opening_balance
    }
  }, (actual) => {
    const output = result(actual)
    return output?.clientAccount?.ok === true &&
      output.clientStatement?.ok === true &&
      output.contractorAccount?.ok === true &&
      output.contractorStatement?.ok === true &&
      output.clientAccount.data.receivableTotal === 2000 &&
      output.clientAccount.data.totalCubic === 20 &&
      output.clientAccount.data.paidTotal === 1000 &&
      output.clientAccount.data.balance === 1300 &&
      output.clientStatement.data.finalBalance === 1300 &&
      output.clientStatement.data.rows.some((row) => row.kind === 'FINE' && row.value === -200) &&
      output.contractorAccount.data.entries.some((entry) => entry.amount === 1000) &&
      output.contractorAccount.data.transportTotal === 160 &&
      output.contractorAccount.data.materialTotal === 1100 &&
      output.contractorAccount.data.ledgerTotal === 1000 &&
      output.contractorAccount.data.balance === 360 &&
      output.contractorStatement.data.finalBalance === 360 &&
      output.rawClientOpening === 50000 &&
      output.rawContractorOpening === 10000 &&
      output.savedTrip?.clientCubicReported === 20 &&
      output.savedTrip?.fineAmount === 200
  })
  runCase('A2 half-up line rounding and exact 2-decimal amounts', '13.99 x 3975.00 = 55610.25; 1.005 x 1.00 = 1.01', () => {
    const client = createClient({ name: 'Rounding Client' })
    if (!client.ok) throw new Error('Rounding client setup failed')
    const firstShift = createOwnShift()
    const first = createTrip({
      ...tripInput(firstShift.id),
      clientId: client.data.id,
      clientCubicReported: 13.99,
      clientPrice: 3975
    })
    const secondShift = createOwnShift()
    const second = createTrip({
      ...tripInput(secondShift.id),
      clientId: client.data.id,
      clientCubicReported: 1.005,
      clientPrice: 1
    })
    if (!first.ok || !second.ok) throw new Error('Rounding trip setup failed')
    const account = getClientAccount({ clientId: client.data.id })
    return {
      account,
      firstTrip: getTripById(first.data.id),
      secondTrip: getTripById(second.data.id),
      statement: getClientStatement({ clientId: client.data.id })
    }
  }, (actual) => {
    const output = result(actual)
    return output?.account?.ok === true &&
      output.account.data.receivableTotal === 55611.26 &&
      Math.abs(output.account.data.totalCubic - 14.995) < 1e-12 &&
      output.firstTrip?.clientPrice === 3975 &&
      output.secondTrip?.clientCubicReported === 1.005 &&
      output.statement?.ok === true &&
      output.statement.data.rows
        .filter((row) => row.kind === 'CHARGE')
        .map((row) => row.value)
        .join(',') === '55610.25,1.01'
  })
  runCase('A3 money boundary rejects three decimals and preserves 5.25', 'fine, trip prices, ledger, and payment reject 5.255; 5.25 stored as 525 and returned exactly', () => {
    const shift = createOwnShift()
    const rejectedFine = createTrip({ ...tripInput(shift.id), fineAmount: 5.255 })
    const rejectedPrice = createTrip({ ...tripInput(shift.id), stonePrice: 5.255 })
    const rejectedLedger = createLedgerEntry({
      entryDate: '2026-01-10',
      movementType: 'PAYMENT',
      amount: 5.255,
      shiftId: null,
      contractorId,
      notes: null
    })
    const rejectedPayment = createClientPayment({
      entryDate: '2026-01-10',
      clientId,
      amount: 5.255,
      notes: null
    })
    const rejectedOpening = createClient({ name: 'Invalid Opening', openingBalance: 5.255 })
    const acceptedClient = createClient({
      name: 'Exact Client',
      initialPrice: 5.25,
      openingBalance: 5.25
    })
    const acceptedContractor = createContractor({
      name: 'Exact Contractor',
      openingBalance: 5.25
    })
    const acceptedCrusher = createCrusher({ name: 'Exact Crusher', initialPrice: 5.25 })
    const accepted = createClientPayment({
      entryDate: '2026-01-10',
      clientId,
      amount: 5.25,
      notes: null
    })
    if (!accepted.ok) throw new Error('5.25 payment was rejected')
    const acceptedShift = createOwnShift()
    const acceptedTrip = createTrip({
      ...tripInput(acceptedShift.id),
      fineAmount: 5.25,
      stonePrice: 5.25,
      transportPrice: 5.25,
      clientPrice: 5.25
    })
    if (!acceptedTrip.ok) throw new Error('5.25 trip values were rejected')
    const listed = getClientAccount({ clientId })
    return {
      rejectedFine,
      rejectedPrice,
      rejectedLedger,
      rejectedPayment,
      rejectedOpening,
      acceptedClient,
      acceptedContractor,
      acceptedCrusher,
      rawAmount: db.prepare('SELECT amount FROM ClientPayment WHERE id = ?').get(accepted.data.id).amount,
      rawTrip: db.prepare(
        'SELECT fine_amount, stone_price, transport_price, client_price FROM Trip WHERE id = ?'
      ).get(acceptedTrip.data.id),
      publicTrip: getTripById(acceptedTrip.data.id),
      rawClient: acceptedClient.ok ? db.prepare('SELECT initial_price, opening_balance FROM Client WHERE id = ?').get(acceptedClient.data.id) : null,
      rawContractor: acceptedContractor.ok ? db.prepare('SELECT opening_balance FROM TransportContractor WHERE id = ?').get(acceptedContractor.data.id) : null,
      rawCrusher: acceptedCrusher.ok ? db.prepare('SELECT initial_price FROM Crusher WHERE id = ?').get(acceptedCrusher.data.id) : null,
      listed
    }
  }, (actual) => {
    const output = result(actual)
    return output?.rejectedFine?.ok === false &&
      output.rejectedFine.errors.some((error) => error.field === 'fineAmount') &&
      output.rejectedPrice?.ok === false &&
      output.rejectedPrice.errors.some((error) => error.field === 'stonePrice') &&
      output.rejectedLedger?.ok === false &&
      output.rejectedLedger.errors.some((error) => error.field === 'amount') &&
      output.rejectedPayment?.ok === false &&
      output.rejectedPayment.errors.some((error) => error.field === 'amount') &&
      output.rejectedOpening?.ok === false &&
      output.rejectedOpening.errors.some((error) => error.field === 'openingBalance') &&
      output.acceptedClient?.ok === true &&
      output.acceptedContractor?.ok === true &&
      output.acceptedCrusher?.ok === true &&
      output.rawAmount === 525 &&
      output.rawTrip?.fine_amount === 525 &&
      output.rawTrip?.stone_price === 525 &&
      output.rawTrip?.transport_price === 525 &&
      output.rawTrip?.client_price === 525 &&
      output.publicTrip?.fineAmount === 5.25 &&
      output.publicTrip?.stonePrice === 5.25 &&
      output.publicTrip?.transportPrice === 5.25 &&
      output.publicTrip?.clientPrice === 5.25 &&
      output.rawClient?.initial_price === 525 &&
      output.rawClient?.opening_balance === 525 &&
      output.rawContractor?.opening_balance === 525 &&
      output.rawCrusher?.initial_price === 525 &&
      output.listed?.ok === true &&
      output.listed.data.payments.some((row) => row.amount === 5.25)
  })
  runCase('A4 contractor snapshot survives vehicle reassignment', 'trip charge remains with contractor assigned when shift was created', () => {
    const original = createContractor({ name: 'Snapshot Original' })
    const reassigned = createContractor({ name: 'Snapshot New' })
    if (!original.ok || !reassigned.ok) throw new Error('Snapshot contractor setup failed')
    const shiftInput = newShiftInput()
    db.prepare('UPDATE Vehicle SET contractor_id = ? WHERE vehicle_no = ?').run(
      original.data.id,
      shiftInput.vehicleNo
    )
    const shift = createShift(shiftInput)
    if (!shift.ok) throw new Error('Snapshot shift setup failed')
    const trip = createTrip({
      ...tripInput(shift.data.id),
      clientCubicReported: 20,
      transportPrice: 8,
      crusherCubic: 22,
      stonePrice: 50
    })
    if (!trip.ok) throw new Error('Snapshot trip setup failed')
    db.prepare('UPDATE Vehicle SET contractor_id = ? WHERE vehicle_no = ?').run(
      reassigned.data.id,
      shiftInput.vehicleNo
    )
    return {
      original: getContractorAccount({ contractorId: original.data.id }),
      reassigned: getContractorAccount({ contractorId: reassigned.data.id }),
      savedShift: db.prepare('SELECT contractor_id FROM Shift WHERE id = ?').get(shift.data.id)
    }
  }, (actual) => {
    const output = result(actual)
    return output?.original?.ok === true &&
      output.original.data.transportTotal === 160 &&
      output.original.data.materialTotal === 1100 &&
      output.original.data.balance === 1260 &&
      output.reassigned?.ok === true &&
      output.reassigned.data.transportTotal === 0 &&
      output.reassigned.data.materialTotal === 0 &&
      output.savedShift?.contractor_id === db.prepare('SELECT id FROM TransportContractor WHERE name = ?').get('Snapshot Original').id
  })
  runCase('A5 financial totals agree across Accounts and Statements', 'all seeded client and contractor balances match their statement final balances', () => {
    const clients = db.prepare('SELECT id FROM Client ORDER BY id').all()
    const contractors = db.prepare('SELECT id FROM TransportContractor ORDER BY id').all()
    const clientMatches = clients.every(({ id }) => {
      const account = getClientAccount({ clientId: id })
      const statement = getClientStatement({ clientId: id })
      return account.ok && statement.ok && account.data.balance === statement.data.finalBalance
    })
    const contractorMatches = contractors.every(({ id }) => {
      const account = getContractorAccount({ contractorId: id })
      const statement = getContractorStatement({ contractorId: id })
      return account.ok && statement.ok && account.data.balance === statement.data.finalBalance
    })
    return { clientMatches, contractorMatches }
  }, (actual) => {
    const output = result(actual)
    return output?.clientMatches === true && output?.contractorMatches === true
  })
  runCase('A6 database enforces accounting constraints and partial open-shift uniqueness', 'duplicate OPEN vehicle/driver, invalid prices and bad dates fail; REOPENED permits a new OPEN shift', () => {
    const shiftInput = newShiftInput()
    const created = createShift(shiftInput)
    if (!created.ok) throw new Error('Constraint shift setup failed')
    const trip = createTrip(tripInput(created.data.id))
    if (!trip.ok) throw new Error('Constraint trip setup failed')
    const insertShiftSql = 'INSERT INTO Shift (' +
      'id, vehicle_no, driver_id, contractor_id, crusher_cubic_default, client_cubic_default, ' +
      "start_date, status) VALUES (?, ?, ?, ?, 1, 1, '2026-02-01', 'OPEN')"
    let duplicateVehicleRejected = false
    let duplicateDriverRejected = false
    try {
      db.prepare(insertShiftSql).run('SH-TEST-DUP-VEHICLE', shiftInput.vehicleNo, driverId, contractorId)
    } catch { duplicateVehicleRejected = true }
    const otherVehicle = newShiftInput()
    try {
      db.prepare(insertShiftSql).run('SH-TEST-DUP-DRIVER', otherVehicle.vehicleNo, shiftInput.driverId, contractorId)
    } catch { duplicateDriverRejected = true }

    let invalidZeroPriceRejected = false
    let invalidNegativePriceRejected = false
    let invalidZeroInitialPriceRejected = false
    let invalidDateRejected = false
    try { db.prepare('UPDATE Trip SET stone_price = 0 WHERE id = ?').run(trip.data.id) } catch { invalidZeroPriceRejected = true }
    try { db.prepare('UPDATE Trip SET transport_price = -1 WHERE id = ?').run(trip.data.id) } catch { invalidNegativePriceRejected = true }
    try { db.prepare('UPDATE Crusher SET initial_price = 0 WHERE id = ?').run(crusherId) } catch { invalidZeroInitialPriceRejected = true }
    try { db.prepare('UPDATE Trip SET trip_date = ? WHERE id = ?').run('not-a-date', trip.data.id) } catch { invalidDateRejected = true }

    db.prepare("UPDATE Shift SET status = 'REOPENED' WHERE id = ?").run(created.data.id)
    const reopenedCanStart = createShift(shiftInput)
    return {
      duplicateVehicleRejected,
      duplicateDriverRejected,
      invalidZeroPriceRejected,
      invalidNegativePriceRejected,
      invalidZeroInitialPriceRejected,
      invalidDateRejected,
      reopenedCanStart
    }
  }, (actual) => {
    const output = result(actual)
    return output?.duplicateVehicleRejected === true &&
      output.duplicateDriverRejected === true &&
      output.invalidZeroPriceRejected === true &&
      output.invalidNegativePriceRejected === true &&
      output.invalidZeroInitialPriceRejected === true &&
      output.invalidDateRejected === true &&
      output.reopenedCanStart?.ok === true
  })
  runCase('A7 closing a shift creates no automatic ledger settlement', 'ledger rows are unchanged by closeShift', () => {
    const shift = createOwnShift()
    addClosingSheet(shift.id, 'no-auto-settlement.jpg')
    const before = db.prepare('SELECT COUNT(*) as count FROM Ledger').get().count
    const closed = closeShift({ shiftId: shift.id, endDate: '2026-02-02', reportedTripCount: 0 })
    const after = db.prepare('SELECT COUNT(*) as count FROM Ledger').get().count
    return { closed, before, after }
  }, (actual) => {
    const output = result(actual)
    return output?.closed?.ok === true && output.before === output.after
  })

  console.log('SUMMARY ' + (outcomes.length === 0 ? 'PASS' : 'FAIL') + ' | failed cases: ' + JSON.stringify(outcomes))
  if (outcomes.length > 0) process.exitCode = 1
} finally {
  try { getDb().close() } catch {}
  fs.rmSync(process.env.SHIFT_TRACKER_USER_DATA, { recursive: true, force: true })
}
`

async function main() {
  process.env.SHIFT_TRACKER_USER_DATA = tempDir
  const originalLoad = Module._load
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') {
      return {
        app: { getPath: () => tempDir, quit: () => {} },
        dialog: { showErrorBox: () => {} }
      }
    }
    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    const buildResult = await build({
      stdin: {
        contents: entry,
        resolveDir: path.join(root, 'scripts'),
        sourcefile: 'verify-closed-shift-use-cases.entry.ts',
        loader: 'ts'
      },
      absWorkingDir: root,
      outfile: path.join(root, 'scripts', '.verify-closed-shift-use-cases.bundle.cjs'),
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron', 'better-sqlite3'],
      write: false,
      logLevel: 'silent'
    })
    const filename = path.join(root, 'scripts', '.verify-closed-shift-use-cases.bundle.cjs')
    const bundleModule = new Module(filename, module)
    bundleModule.filename = filename
    bundleModule.paths = Module._nodeModulePaths(root)
    bundleModule._compile(buildResult.outputFiles[0].text, filename)
  } catch (error) {
    console.error(
      `FAIL harness | actual: ${error instanceof Error ? error.stack : String(error)} | expected: bundle and execute real use cases`
    )
    process.exitCode = 1
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

main().then(() => {
  process.stdout.write('', () => process.exit(process.exitCode || 0))
})
