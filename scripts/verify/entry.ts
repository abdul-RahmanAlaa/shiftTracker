
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import { initDatabase, getDb, SCHEMA, CURRENT_VERSION } from '../../src/main/db'
import { MigrationError, runMigrations } from '../../src/main/migrations'
import {
  BackupService,
  createVerifiedDatabaseBackup,
  initializeBackupService,
  syncAttachmentMirror,
  verifyDatabaseSnapshot
} from '../../src/main/backup'
import fs from 'node:fs'
import path from 'node:path'
import { createLedgerEntry, updateLedgerEntry, deleteLedgerEntry } from '../../src/main/use-cases/createLedgerEntry'
import { createClientPayment, updateClientPayment } from '../../src/main/use-cases/createClientPayment'
import { createShift } from '../../src/main/use-cases/createShift'
import { closeShift } from '../../src/main/use-cases/closeShift'
import { createTrip, updateTrip } from '../../src/main/use-cases/createTrip'
import { reopenShift } from '../../src/main/use-cases/reopenShift'
import {
  getTripById as getTripRawById,
  listTripLocations
} from '../../src/main/repository/tripRepository'
import { listTripsByShift } from '../../src/main/use-cases/listTripData'
import { createClient } from '../../src/main/use-cases/createClient'
import { createContractor } from '../../src/main/use-cases/createContractor'
import { createCrusher } from '../../src/main/use-cases/createCrusher'
import { createMaterialType } from '../../src/main/use-cases/createMaterialType'
import { getClientAccount, getContractorAccount } from '../../src/main/use-cases/getAccounts'
import { getClientStatement, getContractorStatement } from '../../src/main/use-cases/getStatement'
import { wrapHandler } from '../../src/main/ipcWrapper'
import {
  getKnownFormFields,
  getUnhandledIpcErrors
} from '../../src/renderer/src/lib/ipcErrors'
import { createLatestGuard } from '../../src/renderer/src/lib/latestGuard'
import * as tripGrid from '../../src/renderer/src/lib/tripGrid'
import { getSuggestedTripPrices } from '../../src/main/use-cases/suggestTripPrices'
import createBackupSuite from './backup.cjs'
import createFixtureHelpers from './fixtures.cjs'
import createPriceSuite from './prices.cjs'
import createGridSuite from './grid.cjs'
import createMigrationSuite from './migrations.cjs'
import createMigrationFixtures from './migration-fixtures.cjs'
import createMigrationBackupSuite from './migration-backup-cases.cjs'
import ledgerSuite from './ledger.cjs'
import shiftsSuite from './shifts.cjs'
import tripsSuite from './trips.cjs'
import shiftReopenSuite from './shift-reopen.cjs'
import accountingSuite from './accounting.cjs'
import accountConsistencySuite from './accounting-accounts.cjs'
import statementsSuite from './statements.cjs'

const outcomes = []
const pendingCases = []
const harnessUserData = process.env.SHIFT_TRACKER_USER_DATA
const migrationRoot = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'migration-cases')
globalThis.__migrationDialog = []
globalThis.__migrationQuitCount = 0

function runCase(name, expected, operation, passes) {
  const finish = (actual) => {
    const pass = passes(actual)
    if (!pass) outcomes.push(name)
    console.log(
      '| ' +
        name.replaceAll('|', '\|') +
        ' | ' +
        (pass ? 'PASS' : 'FAIL') +
        ' | ' +
        expected.replaceAll('|', '\|') +
        ' |'
    )
    if (!pass) console.log('DETAIL ' + name + ' | ' + JSON.stringify(actual))
  }
  try {
    const value = operation()
    if (value && typeof value.then === 'function') {
      const pending = Promise.resolve(value).then(
        (resolved) => finish({ threw: false, value: resolved }),
        (error) => finish({ threw: true, error: error instanceof Error ? error.message : String(error) })
      )
      pendingCases.push(pending)
      return pending
    }
    finish({ threw: false, value })
  } catch (error) {
    finish({ threw: true, error: error instanceof Error ? error.message : String(error) })
  }
}
async function runAsyncCase(name, expected, operation, passes) {
  let actual
  try {
    actual = { threw: false, value: await operation() }
  } catch (error) {
    actual = { threw: true, error: error instanceof Error ? error.message : String(error) }
  }
  const pass = passes(actual)
  if (!pass) outcomes.push(name)
  console.log(
    '| ' +
      name.replaceAll('|', '\|') +
      ' | ' +
      (pass ? 'PASS' : 'FAIL') +
      ' | ' +
      expected.replaceAll('|', '\|') +
      ' |'
  )
  if (!pass) console.log('DETAIL ' + name + ' | ' + JSON.stringify(actual))
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

async function runHarness() {
try {
  console.log('| Case | Result | Expected |')
  console.log('| --- | --- | --- |')
  const migrationContext = { migrationRoot, fs, path, Database, crypto, initDatabase, getDb, SCHEMA, CURRENT_VERSION, MigrationError, runMigrations, createVerifiedDatabaseBackup, runCase, result }
  const migrationFixtures = createMigrationFixtures(migrationContext)
  createMigrationSuite({ ...migrationContext, ...migrationFixtures })()
  createMigrationBackupSuite({ ...migrationContext, ...migrationFixtures })()

  process.env.SHIFT_TRACKER_USER_DATA = harnessUserData
  db = initDatabase()
  initializeBackupService(harnessUserData, db)
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
  const fixtureHelpers = createFixtureHelpers({ db, contractorId, driverId, clientId, crusherId, materialTypeId, openShiftId, nextFixtureSequence: () => fixtureSequence++, createShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, listTripsByShift, getTripRawById, fs, path, createClientPayment })
  const { getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, nextFixtureSequence } = fixtureHelpers

  createPriceSuite({ db, clientId, crusherId, materialTypeId, openShiftId, runCase, result, createTrip, createClient, createCrusher, getSuggestedTripPrices, getTripById, hasFieldErrors, hasExactFieldError })()
  createGridSuite({ tripGrid, runCase, result, createOwnShift, createTrip, tripInput, listTripLocations, db })()

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

    const testContext = { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, nextFixtureSequence: () => fixtureSequence++, listTripLocations, listTripsByShift, fs, path }
  ledgerSuite.runClosedShiftCases(testContext)
  shiftsSuite.runOpenCloseCases(testContext)
await Promise.all(pendingCases)
    tripsSuite.runInvalidPayloadCases(testContext)
  await shiftsSuite.runDateAndCloseCases(testContext)
  tripsSuite.runAcceptedPayloadCases(testContext)
  await shiftReopenSuite.runReopenCases(testContext)
  ledgerSuite.runEntryValidationCases(testContext)
  accountingSuite.runCoreAccountingCases(testContext)
  accountConsistencySuite.runAccountConsistencyCases(testContext)
await runAsyncCase('E1 IPC wrapper passes through success and failure results unchanged', 'both result objects retain identity', async () => {
    const success = { ok: true, data: { id: 1 } }
    const failure = { ok: false, errors: [{ field: 'name', message: 'invalid' }] }
    const passSuccess = await wrapHandler(() => success)()
    const passFailure = await wrapHandler(() => failure)()
    return { passSuccess, passFailure, success, failure }
  }, (actual) => {
    const output = result(actual)
    return output?.passSuccess === output?.success && output?.passFailure === output?.failure
  })
  await runAsyncCase('E2 IPC wrapper converts a thrown error and logs once', 'exact sentinel failure, one log, no throw', async () => {
    const logged = []
    const wrapped = wrapHandler(() => {
      throw new Error('private detail')
    }, (error) => logged.push(error))
    const value = await wrapped()
    return { value, logged }
  }, (actual) => {
    const output = result(actual)
    return output?.value?.ok === false &&
      output.value.errors.length === 1 &&
      output.value.errors[0].field === '_form' &&
      output.value.errors[0].message === 'UNEXPECTED_ERROR' &&
      output.logged.length === 1 &&
      output.logged[0] instanceof Error
  })
  await runAsyncCase('E3 IPC wrapper converts a rejected promise', 'exact sentinel failure, no throw', async () => {
    const value = await wrapHandler(() => Promise.reject(new Error('private detail')))()
    return value
  }, (actual) => {
    const value = result(actual)
    return value?.ok === false &&
      value.errors.length === 1 &&
      value.errors[0].field === '_form' &&
      value.errors[0].message === 'UNEXPECTED_ERROR'
  })
  runCase('E4 renderer IPC helper returns translated form and unknown-field errors', 'two errors returned; known field omitted', () => {
    return getUnhandledIpcErrors(
      {
        ok: false,
        errors: [
          { field: '_form', message: 'UNEXPECTED_ERROR' },
          { field: 'unknown', message: 'validation' },
          { field: 'name', message: 'field validation' }
        ]
      },
      ['name'],
      (key) => 'translated:' + key
    )
  }, (actual) => {
    const errors = result(actual)
    return errors?.length === 2 &&
      errors[0].field === '_form' &&
      errors[0].message === 'translated:ipcErrors.unexpected' &&
      errors[1].field === 'unknown' &&
      errors[1].message === 'validation'
  })
    statementsSuite.runStatementCases(testContext)
runCase('E5 typed IPC form field names match every input shape', 'all input field lists match exactly', () => {
    const expected = {
      createDriver: ['name', 'phone1', 'phone2'],
      updateDriver: ['id', 'name', 'phone1', 'phone2'],
      createClient: ['name', 'initialPrice', 'location', 'openingBalance', 'openingBalanceDate'],
      updateClient: ['id', 'name', 'initialPrice', 'location', 'openingBalance', 'openingBalanceDate'],
      createCrusher: ['name', 'initialPrice'],
      updateCrusher: ['id', 'name', 'initialPrice'],
      createMaterialType: ['name'],
      updateMaterialType: ['id', 'name'],
      createContractor: ['name', 'phone', 'openingBalance', 'openingBalanceDate'],
      updateContractor: ['id', 'name', 'phone', 'openingBalance', 'openingBalanceDate'],
      createVehicle: ['vehicleNo', 'trailerNo', 'contractorId', 'defaultCubic', 'ownerName'],
      updateVehicle: ['vehicleNo', 'trailerNo', 'contractorId', 'defaultCubic', 'ownerName'],
      createShift: ['vehicleNo', 'driverId', 'crusherCubicDefault', 'clientCubicDefault', 'startDate', 'reportedDestination', 'notes'],
      closeShift: ['shiftId', 'endDate', 'reportedTripCount'],
      reopenShift: ['shiftId', 'reason'],
      createTrip: ['shiftId', 'tripDate', 'crusherCubic', 'clientCubicReported', 'fineAmount', 'fineReason', 'location', 'crusherId', 'stonePrice', 'crusherReceiptStatus', 'crusherReceiptNo', 'clientId', 'transportPrice', 'clientPrice', 'materialTypeId', 'recipientNameStatus', 'recipientName', 'clientReceiptNo', 'notes'],
      updateTrip: ['id', 'tripDate', 'crusherCubic', 'clientCubicReported', 'fineAmount', 'fineReason', 'location', 'crusherId', 'stonePrice', 'crusherReceiptStatus', 'crusherReceiptNo', 'clientId', 'transportPrice', 'clientPrice', 'materialTypeId', 'recipientNameStatus', 'recipientName', 'clientReceiptNo', 'notes'],
      createLedgerEntry: ['entryDate', 'driverId', 'movementType', 'amount', 'shiftId', 'contractorId', 'notes'],
      updateLedgerEntry: ['id', 'entryDate', 'driverId', 'movementType', 'amount', 'shiftId', 'contractorId', 'notes'],
      createClientPayment: ['entryDate', 'clientId', 'amount', 'notes'],
      updateClientPayment: ['id', 'entryDate', 'clientId', 'amount', 'notes'],
      addAttachment: ['entityType', 'entityId', 'kind', 'imageBase64']
    }
    return Object.entries(expected).map(([method, fields]) => ({
      method,
      expected: fields,
      actual: getKnownFormFields(method)
    }))
  }, (actual) => {
    const cases = result(actual)
    return cases?.length === 22 &&
      cases.every((item) => JSON.stringify(item.actual) === JSON.stringify(item.expected))
  })
  runCase('R1 latest guard accepts only the newest token', 'older token rejected and newest token accepted', () => {
    const guard = createLatestGuard()
    const olderToken = guard.next()
    const latestToken = guard.next()
    return {
      olderAccepted: guard.isLatest(olderToken),
      latestAccepted: guard.isLatest(latestToken)
    }
  }, (actual) => {
    const value = result(actual)
    return value?.olderAccepted === false && value.latestAccepted === true
  })
  runCase('R2 latest guard cancellation invalidates outstanding tokens', 'all old tokens rejected and a post-cancel token accepted', () => {
    const guard = createLatestGuard()
    const outstandingTokens = [guard.next(), guard.next()]
    guard.cancel()
    const postCancelToken = guard.next()
    return {
      outstandingAccepted: outstandingTokens.map((token) => guard.isLatest(token)),
      postCancelAccepted: guard.isLatest(postCancelToken)
    }
  }, (actual) => {
    const value = result(actual)
    return value?.outstandingAccepted?.length === 2 &&
      value.outstandingAccepted.every((accepted) => accepted === false) &&
      value.postCancelAccepted === true
  })
  await runAsyncCase('R3 latest guard discards stale async load results', 'only B is applied when A resolves after B', async () => {
    const guard = createLatestGuard()
    const applied = []
    let resolveA
    let resolveB
    async function load(promise) {
      const token = guard.next()
      const value = await promise
      if (guard.isLatest(token)) applied.push(value)
    }
    const loadA = load(new Promise((resolve) => { resolveA = resolve }))
    const loadB = load(new Promise((resolve) => { resolveB = resolve }))
    resolveB('B')
    await loadB
    resolveA('A')
    await loadA
    return applied
  }, (actual) => JSON.stringify(result(actual)) === JSON.stringify(['B']))

  await Promise.all(pendingCases)
  await createBackupSuite({ fs, path, harnessUserData, db, BackupService, result, runAsyncCase, CURRENT_VERSION, verifyDatabaseSnapshot, syncAttachmentMirror, initializeBackupService, createOwnShift, addClosingSheet, closeShift })()
  console.log('SUMMARY ' + (outcomes.length === 0 ? 'PASS' : 'FAIL') + ' | failed cases: ' + JSON.stringify(outcomes))
  if (outcomes.length > 0) process.exitCode = 1
} finally {
  try { getDb().close() } catch {}
  process.env.SHIFT_TRACKER_USER_DATA = harnessUserData
  fs.rmSync(harnessUserData, { recursive: true, force: true })
}
}

globalThis.__useCaseRun = runHarness()
