/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = {
  async runReopenCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
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
    
      await runCase('R8 re-close without a new count after adding a reopened-shift trip is rejected', 'initial close ok, reopen ok, trip creation ok, re-close rejects missing count', async () => {
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
    
        const initialClose = await closeShift({ shiftId: mismatchShiftId, endDate: '2026-01-22', reportedTripCount: 0 })
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
    
        const recloseWithoutCount = await closeShift({ shiftId: mismatchShiftId, endDate: '2026-01-23' })
        return { initialClose, reopenResult, tripResult, recloseWithoutCount }
      }, (actual) => {
        const sequence = result(actual)
        return sequence?.initialClose?.ok === true && sequence.reopenResult?.ok === true && sequence.tripResult?.ok === true && hasFieldErrors(sequence.recloseWithoutCount, ['reportedTripCount'])
      })
      await runCase('R9 re-close with an incorrect reported count is rejected', 'ok:false / field tripCount and shift remains REOPENED', () => {
        if (!reopenedCountShiftId) return { ok: false, errors: [{ field: 'shiftId', message: 'R8 did not create its shift' }] }
        return closeShift({ shiftId: reopenedCountShiftId, endDate: '2026-01-23', reportedTripCount: 2 })
      }, (actual) => {
        const closed = result(actual)
        return hasFieldErrors(closed, ['tripCount']) && db.prepare('SELECT status FROM Shift WHERE id = ?').get(reopenedCountShiftId)?.status === 'REOPENED'
      })
      await runCase('R10 re-close with the correct reported count closes shift and updates log', 'ok:true / status CLOSED, reported count 1, closed_again_at set', async () => {
        if (!reopenedCountShiftId) return { ok: false, errors: [{ field: 'shiftId', message: 'R8 did not create its shift' }] }
        const result = await closeShift({ shiftId: reopenedCountShiftId, endDate: '2026-01-23', reportedTripCount: 1 })
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
      runCase('R11 OPEN close accepted with a valid reported count', 'ok:true / status CLOSED / reported count 0', async () => {
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
        const closeResult = await closeShift({ shiftId: shiftResult.data.id, endDate: '2026-01-31', reportedTripCount: 0 })
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
      runCase('R15 REOPENED shift accepts reported count when closing', 'ok:true / status CLOSED / reported count 0 / reopen log closed', async () => {
        const reopenResult = reopenShift({ shiftId: secondClosedShiftId, reason: 'verify reported count close' })
        if (!reopenResult.ok) return { reopenResult }
        const attachmentPath = 'docs/attachments/reopened-count-close.jpg'
        const attachmentDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'docs', 'attachments')
        fs.mkdirSync(attachmentDir, { recursive: true })
        fs.writeFileSync(path.join(attachmentDir, 'reopened-count-close.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x00]))
        db.prepare("INSERT INTO Attachment (entity_type, entity_id, kind, photo_path, created_at) VALUES (?, ?, ?, ?, datetime('now'))").run('SHIFT', secondClosedShiftId, 'CLOSING_SHEET', attachmentPath)
        const closeResult = await closeShift({ shiftId: secondClosedShiftId, endDate: '2026-01-05', reportedTripCount: 0 })
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
    
      
  }
}
