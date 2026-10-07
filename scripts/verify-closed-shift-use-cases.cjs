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
import { getTripById } from '../src/main/repository/tripRepository'

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
  return actual
}
function result(actual) {
  return actual && !actual.threw ? actual.value : undefined
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
    crusherCubic: 2,
    clientCubicReported: 2,
    discountQty: 0,
    discountReason: '',
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
  db.prepare("INSERT INTO Shift (id, vehicle_no, driver_id, crusher_cubic_default, client_cubic_default, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'CLOSED')").run(closedShiftId, 97001, driverId, 1, 1, '2026-01-01', '2026-01-02')

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
    runCase('V ' + name + ' negative discountQty', 'ok:false / exact field discountQty / non-negative number message / no Trip changes', () => reject({ discountQty: -0.5 }), (actual) => {
      const output = result(actual)
      return !actual.threw &&
        output?.unchanged === true &&
        hasExactFieldErrorMessage(output.response, 'discountQty', 'رقمًا غير سالب')
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
  runCase('V createTrip accepts complete valid renderer payload with decimal discount', 'ok:true / row inserted with discountQty 0.5 and empty optional strings preserved', () => {
    const shift = createOwnShift()
    const beforeCount = db.prepare('SELECT COUNT(*) AS count FROM Trip').get().count
    const response = createTrip({ ...tripInput(shift.id), discountQty: 0.5 })
    const afterCount = db.prepare('SELECT COUNT(*) AS count FROM Trip').get().count
    const saved = response.ok ? getTripById(response.data.id) : undefined
    return { response, beforeCount, afterCount, saved }
  }, (actual) => {
    const output = result(actual)
    return output?.response?.ok === true &&
      output.afterCount === output.beforeCount + 1 &&
      output.saved?.discountQty === 0.5 &&
      output.saved?.discountReason === '' &&
      output.saved?.location === '' &&
      output.saved?.recipientName === null &&
      output.saved?.clientReceiptNo === '' &&
      output.saved?.notes === ''
  })
  runCase('V updateTrip accepts complete valid payload', 'ok:true / updated price and decimal discount persisted', () => {
    const shift = createOwnShift()
    const seeded = createTrip(tripInput(shift.id))
    if (!seeded.ok) return { seeded }
    const response = updateTrip({ id: seeded.data.id, ...tripInput(shift.id), stonePrice: 11, discountQty: 0.5 })
    return { response, saved: getTripById(seeded.data.id) }
  }, (actual) => {
    const output = result(actual)
    return output?.response?.ok === true && output.saved?.stonePrice === 11 && output.saved?.discountQty === 0.5
  })
  runCase('V updateTrip accepts renderer-shaped empty optional fields from a DB row', 'ok:true / DB nulls map to blank strings and update succeeds', () => {
    const shift = createOwnShift()
    const seeded = createTrip(tripInput(shift.id))
    if (!seeded.ok) return { seeded }
    db.prepare(
      'UPDATE Trip SET discount_reason = NULL, location = NULL, recipient_name = NULL, client_receipt_no = NULL, notes = NULL WHERE id = ?'
    ).run(seeded.data.id)
    const row = getTripById(seeded.data.id)
    if (!row) return { missingRow: true }
    const rendererValues = {
      id: row.id,
      tripDate: row.tripDate,
      crusherCubic: row.crusherCubic,
      clientCubicReported: row.clientCubicReported,
      discountQty: row.discountQty,
      discountReason: row.discountReason ?? '',
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
      output.rendererValues.discountReason === '' &&
      output.rendererValues.location === '' &&
      output.rendererValues.recipientName === '' &&
      output.rendererValues.clientReceiptNo === '' &&
      output.rendererValues.notes === '' &&
      output.rendererValues.recipientNameStatus === 'UNCLEAR' &&
      output.saved?.discountReason === '' &&
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
  db.prepare("INSERT INTO Shift (id, vehicle_no, driver_id, crusher_cubic_default, client_cubic_default, start_date, end_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'CLOSED')").run(secondClosedShiftId, 97001, driverId, 1, 1, '2026-01-03', '2026-01-04')

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
    return created?.ok === true && db.prepare('SELECT amount FROM Ledger WHERE id = ?').get(created.data.id)?.amount === -300
  })
  runCase('E4 client payment negative amount accepted', 'ok:true and amount -300 persisted', () => createClientPayment({ entryDate: '2026-01-10', clientId, amount: -300, notes: null }), (actual) => {
    const created = result(actual)
    return created?.ok === true && db.prepare('SELECT amount FROM ClientPayment WHERE id = ?').get(created.data.id)?.amount === -300
  })

  const initialPayment = createClientPayment({ entryDate: '2026-01-10', clientId, amount: 50, notes: 'keep me' })
  if (!initialPayment.ok) throw new Error('Client payment setup failed: ' + JSON.stringify(initialPayment))
  paymentId = initialPayment.data.id
  runCase('E5 omitted payment notes rejected', 'error field notes', () => updateClientPayment({ id: paymentId, entryDate: '2026-01-10', clientId, amount: 50 }), (actual) => hasFieldErrors(result(actual), ['notes']))
  runCase('E5 explicit null clears payment notes', 'ok:true and database notes null', () => updateClientPayment({ id: paymentId, entryDate: '2026-01-10', clientId, amount: 50, notes: null }), (actual) => {
    const updated = result(actual)
    return updated?.ok === true && db.prepare('SELECT notes FROM ClientPayment WHERE id = ?').get(paymentId)?.notes === null
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
