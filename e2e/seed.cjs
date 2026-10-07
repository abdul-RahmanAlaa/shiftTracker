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

function requireCreated(result, entity) {
  if (!result.ok) throw new Error(`Could not seed ${entity}: ${JSON.stringify(result)}`)
  return result.data
}

function currentDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function seed() {
  const db = initDatabase()
  const contractor = requireCreated(
    createContractor({ name: `E2E Contractor ${suffix}` }),
    'contractor'
  )
  const driver = requireCreated(createDriver({ name: `E2E Driver ${suffix}` }), 'driver')
  const client = requireCreated(
    createClient({ name: `E2E Client ${suffix}`, initialPrice: 12 }),
    'client'
  )
  const crusher = requireCreated(
    createCrusher({ name: `E2E Crusher ${suffix}`, initialPrice: 7 }),
    'crusher'
  )
  const materialType = requireCreated(
    createMaterialType({ name: `E2E Material ${suffix}` }),
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

    if (mode === 'with-trip') {
      data.trip = requireCreated(
        createTrip({
          shiftId: data.shift.id,
          tripDate: currentDate(),
          crusherCubic: 1,
          clientCubicReported: 1,
          discountQty: 0,
          discountReason: '',
          location: '',
          crusherId: crusher.id,
          stonePrice: 12,
          crusherReceiptStatus: 'PROVIDED',
          crusherReceiptNo: 7001,
          clientId: client.id,
          transportPrice: 8,
          clientPrice: 15,
          materialTypeId: materialType.id,
          recipientNameStatus: 'PROVIDED',
          recipientName: `E2E Receiver ${suffix}`,
          clientReceiptNo: '',
          notes: ''
        }),
        'trip'
      )
      const relativePath = `docs/attachments/e2e-${suffix}.jpg`
      const attachmentDirectory = path.join(appPath, 'docs', 'attachments')
      fs.mkdirSync(attachmentDirectory, { recursive: true })
      fs.writeFileSync(
        path.join(attachmentDirectory, path.basename(relativePath)),
        Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00])
      )
      db.prepare(
        "INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      ).run('TRIP', data.trip.id, 'CRUSHER_RECEIPT', relativePath)

      const closingPath = `docs/attachments/e2e-close-${suffix}.jpg`
      fs.writeFileSync(
        path.join(attachmentDirectory, path.basename(closingPath)),
        Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00])
      )
      db.prepare(
        "INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      ).run('SHIFT', data.shift.id, 'CLOSING_SHEET', closingPath)
    }
  }

  db.close()
  console.log(`E2E_SEED_RESULT=${JSON.stringify(data)}`)
}

seed().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
