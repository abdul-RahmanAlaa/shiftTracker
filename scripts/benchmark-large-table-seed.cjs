/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const Module = require('node:module')
const { appPath } = JSON.parse(process.env.SHIFT_TRACKER_BENCHMARK_SEED)

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

function dateForTrip(index) {
  const date = new Date(Date.UTC(2025, 0, 1 + (index % 365)))
  return date.toISOString().slice(0, 10)
}

function seed() {
  const db = initDatabase()
  const suffix = `${process.pid}-${Date.now()}`
  const contractor = requireCreated(
    createContractor({ name: `Benchmark Contractor ${suffix}` }),
    'contractor'
  )
  const client = requireCreated(
    createClient({ name: `Benchmark Client ${suffix}`, initialPrice: 12 }),
    'client'
  )
  const crusher = requireCreated(
    createCrusher({ name: `Benchmark Crusher ${suffix}`, initialPrice: 7 }),
    'crusher'
  )
  const materialType = requireCreated(
    createMaterialType({ name: `Benchmark Material ${suffix}` }),
    'material type'
  )
  const tripCountPerShift = 160
  let firstDriverName = ''

  for (let shiftIndex = 0; shiftIndex < 50; shiftIndex += 1) {
    const driverName = `Benchmark Driver ${String(shiftIndex + 1).padStart(2, '0')} ${suffix}`
    const driver = requireCreated(createDriver({ name: driverName }), 'driver')
    if (shiftIndex === 0) firstDriverName = driverName

    const vehicleNo = 90000 + shiftIndex
    requireCreated(
      createVehicle({
        vehicleNo,
        trailerNo: 91000 + shiftIndex,
        contractorId: contractor.id
      }),
      'vehicle'
    )
    const shift = requireCreated(
      createShift({
        vehicleNo,
        driverId: driver.id,
        crusherCubicDefault: 1,
        clientCubicDefault: 1,
        startDate: '2025-01-01'
      }),
      'shift'
    )

    for (let tripIndex = 0; tripIndex < tripCountPerShift; tripIndex += 1) {
      const globalIndex = shiftIndex * tripCountPerShift + tripIndex
      requireCreated(
        createTrip({
          shiftId: shift.id,
          tripDate: dateForTrip(globalIndex),
          crusherCubic: 1,
          clientCubicReported: 1,
          fineAmount: 0,
          fineReason: '',
          location: '',
          crusherId: crusher.id,
          stonePrice: 12,
          crusherReceiptStatus: 'UNKNOWN',
          clientId: client.id,
          transportPrice: 8,
          clientPrice: 15,
          materialTypeId: materialType.id,
          recipientNameStatus: 'UNCLEAR',
          recipientName: '',
          clientReceiptNo: '',
          notes: ''
        }),
        'trip'
      )
    }
  }

  db.close()
  console.log(
    `BENCHMARK_SEED_RESULT=${JSON.stringify({
      tripCount: 8000,
      shiftCount: 50,
      tripCountPerShift,
      firstDriverName,
      filteredTripCount: tripCountPerShift,
      expectedFilteredSum: tripCountPerShift,
      expectedTotal: 8000,
      latestTripDate: '2025-12-31'
    })}`
  )
}

seed()
