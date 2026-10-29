/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = function (context) {
  const { db, contractorId, driverId, clientId, crusherId, materialTypeId, openShiftId, nextFixtureSequence, createShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, listTripsByShift, getTripRawById, fs, path, createClientPayment } = context
  function getTripById(id) {
    const raw = getTripRawById(id)
    if (!raw) return undefined
    const result = listTripsByShift(raw.shiftId)
    return result.ok ? result.data.find((trip) => trip.id === id) : undefined
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
    const sequence = nextFixtureSequence()
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
  return { getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, nextFixtureSequence }
}
