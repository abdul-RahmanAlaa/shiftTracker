/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const Module = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const { appPath, mode, suffix } = JSON.parse(process.env.SHIFT_TRACKER_E2E_SEED)

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: { getPath: () => appPath, quit: () => {} },
      dialog: { showErrorBox: () => {} }
    }
  }
  return originalLoad.call(this, request, parent, isMain)
}

const { initDatabase } = require('../src/main/db')
const { createContractor } = require('../src/main/use-cases/createContractor')
const { createDriver } = require('../src/main/use-cases/createDriver')
const { createClient } = require('../src/main/use-cases/createClient')
const { createCrusher } = require('../src/main/use-cases/createCrusher')
const { createMaterialType } = require('../src/main/use-cases/createMaterialType')
const { createVehicle } = require('../src/main/use-cases/createVehicle')
const { createShift } = require('../src/main/use-cases/createShift')
const { createTrip } = require('../src/main/use-cases/createTrip')
const { createLedgerEntry } = require('../src/main/use-cases/createLedgerEntry')
const { createClientPayment } = require('../src/main/use-cases/createClientPayment')
const { closeShift } = require('../src/main/use-cases/closeShift')
const { reopenShift } = require('../src/main/use-cases/reopenShift')

function requireCreated(result, entity) {
  if (!result.ok) throw new Error(`Could not seed ${entity}: ${JSON.stringify(result)}`)
  return result.data
}

function currentDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addSeedAttachment(db, entityType, entityId, kind, filename) {
  const relativePath = `docs/attachments/${filename}`
  const attachmentDirectory = path.join(appPath, 'docs', 'attachments')
  fs.mkdirSync(attachmentDirectory, { recursive: true })
  fs.writeFileSync(
    path.join(attachmentDirectory, filename),
    Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00])
  )
  db.prepare(
    "INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(entityType, entityId, kind, relativePath)
}

async function seed() {
  const db = initDatabase()
  const layoutName = `N${suffix.slice(-29)}`.padEnd(30, 'N').slice(0, 30)
  const displayName = mode === 'layout' ? layoutName : `E2E Contractor ${suffix}`
  const displayDriverName = mode === 'layout' ? layoutName : `E2E Driver ${suffix}`
  const displayClientName = mode === 'layout' ? layoutName : `E2E Client ${suffix}`
  const displayCrusherName = mode === 'layout' ? layoutName : `E2E Crusher ${suffix}`
  const displayMaterialName = mode === 'layout' ? layoutName : `E2E Material ${suffix}`
  const layoutNote = 'N'.repeat(120)
  const contractor = requireCreated(createContractor({ name: displayName }), 'contractor')
  const driver = requireCreated(createDriver({ name: displayDriverName }), 'driver')
  const client = requireCreated(
    createClient({
      name: displayClientName,
      initialPrice: 12,
      ...(mode === 'golden' ? { openingBalance: 500, openingBalanceDate: currentDate() } : {})
    }),
    'client'
  )
  const crusher = requireCreated(
    createCrusher({ name: displayCrusherName, initialPrice: 7 }),
    'crusher'
  )
  const materialType = requireCreated(
    createMaterialType({ name: displayMaterialName }),
    'material type'
  )
  const firstVehicleNo = 73000 + (Number(suffix.replace(/\D/g, '').slice(-3)) || 1)
  const firstVehicle = requireCreated(
    createVehicle({
      vehicleNo: firstVehicleNo,
      trailerNo: firstVehicleNo + 100,
      contractorId: contractor.id
    }),
    'first vehicle'
  )
  const secondVehicleNo = firstVehicleNo + 1
  const secondVehicle = requireCreated(
    createVehicle({
      vehicleNo: secondVehicleNo,
      trailerNo: secondVehicleNo + 100,
      contractorId: contractor.id
    }),
    'second vehicle'
  )
  const data = {
    contractor,
    driver,
    client,
    crusher,
    materialType,
    firstVehicle,
    secondVehicle,
    shift: null,
    trip: null,
    suffix
  }

  if (mode !== 'no-shift') {
    data.shift = requireCreated(
      createShift({
        vehicleNo: firstVehicleNo,
        driverId: driver.id,
        crusherCubicDefault: 1,
        clientCubicDefault: 1,
        startDate: currentDate()
      }),
      'shift'
    )

    if (
      mode === 'with-trip' ||
      mode === 'layout' ||
      mode === 'two-shifts' ||
      mode === 'accounts' ||
      mode === 'golden' ||
      mode === 'closed-shift' ||
      mode === 'reopened-shift' ||
      mode === 'references'
    ) {
      data.trip = requireCreated(
        createTrip({
          shiftId: data.shift.id,
          tripDate: currentDate(),
          crusherCubic: mode === 'golden' ? 20 : 1,
          clientCubicReported: mode === 'golden' ? 20 : 1,
          fineAmount: mode === 'golden' ? 200 : 0,
          fineReason: mode === 'golden' ? 'E2E golden fine' : '',
          location: '',
          crusherId: crusher.id,
          stonePrice: 12,
          crusherReceiptStatus: 'PROVIDED',
          crusherReceiptNo: 7001,
          clientId: client.id,
          transportPrice: 8,
          clientPrice: mode === 'golden' ? 100 : 15,
          materialTypeId: materialType.id,
          recipientNameStatus: 'PROVIDED',
          recipientName: `E2E Receiver ${suffix}`,
          clientReceiptNo: '',
          notes: mode === 'layout' ? layoutNote : ''
        }),
        'trip'
      )
      if (mode === 'layout') {
        requireCreated(
          createTrip({
            shiftId: data.shift.id,
            tripDate: currentDate(),
            crusherCubic: 1,
            clientCubicReported: 1,
            fineAmount: 0,
            fineReason: '',
            location: '',
            crusherId: crusher.id,
            stonePrice: 12,
            crusherReceiptStatus: 'PROVIDED',
            crusherReceiptNo: 7002,
            clientId: client.id,
            transportPrice: 8,
            clientPrice: 15,
            materialTypeId: materialType.id,
            recipientNameStatus: 'UNCLEAR',
            recipientName: '',
            clientReceiptNo: '',
            notes: layoutNote
          }),
          'long-text layout trip'
        )
      }
      addSeedAttachment(db, 'TRIP', data.trip.id, 'CRUSHER_RECEIPT', `e2e-${suffix}.jpg`)
      addSeedAttachment(db, 'SHIFT', data.shift.id, 'CLOSING_SHEET', `e2e-close-${suffix}.jpg`)

      if (mode === 'closed-shift') {
        const secondTrip = requireCreated(
          createTrip({
            shiftId: data.shift.id,
            tripDate: currentDate(),
            crusherCubic: 2,
            clientCubicReported: 2,
            fineAmount: 0,
            fineReason: '',
            location: '',
            crusherId: crusher.id,
            stonePrice: 12,
            crusherReceiptStatus: 'PROVIDED',
            crusherReceiptNo: 7002,
            clientId: client.id,
            transportPrice: 8,
            clientPrice: 15,
            materialTypeId: materialType.id,
            recipientNameStatus: 'PROVIDED',
            recipientName: `E2E Second Receiver ${suffix}`,
            clientReceiptNo: '',
            notes: ''
          }),
          'second closed-shift trip'
        )
        addSeedAttachment(db, 'TRIP', secondTrip.id, 'CRUSHER_RECEIPT', `e2e-second-${suffix}.jpg`)
        db.prepare(
          "UPDATE Shift SET status = 'CLOSED', end_date = ?, reported_trip_count = 2 WHERE id = ?"
        ).run(currentDate(), data.shift.id)
        Object.assign(data, { closedShift: data.shift, closedTrips: [data.trip, secondTrip] })
      }

      if (mode === 'reopened-shift') {
        requireCreated(
          await closeShift(
            { shiftId: data.shift.id, endDate: currentDate(), reportedTripCount: 1 },
            new Date()
          ),
          'reopened-shift initial close'
        )
        requireCreated(
          reopenShift({ shiftId: data.shift.id, reason: `E2E seed reopen ${suffix}` }),
          'reopened shift'
        )
      }

      if (mode === 'layout') {
        requireCreated(
          createLedgerEntry({
            entryDate: currentDate(),
            driverId: driver.id,
            movementType: 'ADVANCE',
            amount: 100,
            shiftId: data.shift.id,
            contractorId: contractor.id,
            notes: layoutNote
          }),
          'layout ledger entry'
        )
        requireCreated(
          createClientPayment({
            entryDate: currentDate(),
            clientId: client.id,
            amount: 100,
            notes: layoutNote
          }),
          'layout client payment'
        )
      }
    }
  }

  if (mode === 'two-shifts' || mode === 'accounts') {
    const secondDriver = requireCreated(
      createDriver({ name: `E2E Closed Driver ${suffix}` }),
      'second driver'
    )
    const closedShift = requireCreated(
      createShift({
        vehicleNo: secondVehicleNo,
        driverId: secondDriver.id,
        crusherCubicDefault: 1,
        clientCubicDefault: 1,
        startDate: currentDate()
      }),
      'closed shift'
    )
    const closedTrip = requireCreated(
      createTrip({
        shiftId: closedShift.id,
        tripDate: currentDate(),
        crusherCubic: 1,
        clientCubicReported: 1,
        fineAmount: 0,
        fineReason: '',
        location: '',
        crusherId: crusher.id,
        stonePrice: 12,
        crusherReceiptStatus: 'PROVIDED',
        crusherReceiptNo: 7002,
        clientId: client.id,
        transportPrice: 8,
        clientPrice: 15,
        materialTypeId: materialType.id,
        recipientNameStatus: 'PROVIDED',
        recipientName: `E2E Closed Receiver ${suffix}`,
        clientReceiptNo: '',
        notes: ''
      }),
      'closed trip'
    )
    addSeedAttachment(db, 'TRIP', closedTrip.id, 'CRUSHER_RECEIPT', `e2e-closed-${suffix}.jpg`)
    addSeedAttachment(
      db,
      'SHIFT',
      closedShift.id,
      'CLOSING_SHEET',
      `e2e-closed-close-${suffix}.jpg`
    )

    let ledger
    if (mode === 'accounts') {
      const open = requireCreated(
        createLedgerEntry({
          entryDate: currentDate(),
          driverId: driver.id,
          movementType: 'ADVANCE',
          amount: 100,
          shiftId: data.shift.id,
          contractorId: contractor.id,
          notes: `E2E open movement ${suffix}`
        }),
        'open-linked ledger entry'
      )
      const closed = requireCreated(
        createLedgerEntry({
          entryDate: currentDate(),
          driverId: secondDriver.id,
          movementType: 'ADVANCE',
          amount: 200,
          shiftId: closedShift.id,
          contractorId: contractor.id,
          notes: `E2E closed movement ${suffix}`
        }),
        'closed-linked ledger entry'
      )
      const free = requireCreated(
        createLedgerEntry({
          entryDate: currentDate(),
          movementType: 'PAYMENT',
          amount: 50,
          contractorId: contractor.id,
          notes: `E2E free movement ${suffix}`
        }),
        'free ledger entry'
      )
      ledger = { open, closed, free }
    }

    db.prepare(
      "UPDATE Shift SET status = 'CLOSED', end_date = ?, reported_trip_count = 1 WHERE id = ?"
    ).run(currentDate(), closedShift.id)
    Object.assign(data, { secondDriver, closedShift, closedTrip })
    if (ledger) data.ledger = ledger
  }

  if (mode === 'golden') {
    data.clientPayment = requireCreated(
      createClientPayment({
        entryDate: currentDate(),
        clientId: client.id,
        amount: 1000,
        notes: 'E2E golden payment'
      }),
      'golden client payment'
    )
  }

  db.close()
  console.log(`E2E_SEED_RESULT=${JSON.stringify(data)}`)
}

seed().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
