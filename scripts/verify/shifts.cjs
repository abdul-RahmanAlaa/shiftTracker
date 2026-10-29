/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = {
  runOpenCloseCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
    runCase('C1 OPEN close with empty reported count rejected', 'ok:false / field reportedTripCount and row still OPEN', async () => {
        const shiftResult = createShift({
          vehicleNo: 97010,
          driverId: Number(db.prepare('INSERT INTO Driver (name) VALUES (?)').run('Verify Open Close Driver').lastInsertRowid),
          crusherCubicDefault: 1,
          clientCubicDefault: 1,
          startDate: '2026-01-20'
        })
        if (!shiftResult.ok) return { shiftResult }
        const shiftId = shiftResult.data.id
        return { shiftId, closeResult: await closeShift({ shiftId, endDate: '2026-01-21' }) }
      }, (actual) => {
        const output = result(actual)
        return output?.shiftId && output?.closeResult && !output.closeResult.ok && hasFieldErrors(output.closeResult, ['reportedTripCount']) && db.prepare('SELECT status FROM Shift WHERE id = ?').get(output.shiftId)?.status === 'OPEN'
      })
      runCase('C2 OPEN close with invalid reported count values rejected', 'ok:false / field reportedTripCount and row still OPEN', async () => {
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
          const closeResult = await closeShift({
            shiftId: shiftResult.data.id,
            endDate: '2026-01-23',
            reportedTripCount: reportedTripCount
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
      
  },
  async runDateAndCloseCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
    runCase('V closeShift rejects endDate before startDate without changing shift', 'ok:false / exact field endDate / shift unchanged', async () => {
        const shift = createOwnShift()
        const before = shiftRowSnapshot(shift.id)
        const response = await closeShift({ shiftId: shift.id, endDate: '2026-01-31', reportedTripCount: 0 })
        return { response, unchanged: before === shiftRowSnapshot(shift.id) }
      }, (actual) => {
        const output = result(actual)
        return !actual.threw && output?.unchanged === true && hasExactFieldError(output.response, 'endDate')
      })
      runCase('V closeShift rejects mismatched valid count and leaves OPEN shift unchanged', 'ok:false / exact field tripCount / OPEN row unchanged', async () => {
        const shift = createOwnShift()
        const before = shiftRowSnapshot(shift.id)
        const response = await closeShift({ shiftId: shift.id, endDate: '2026-02-02', reportedTripCount: 1 })
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
      await runCase('V closeShift succeeds when backup works without warning', 'ok:true / CLOSED shift / backup created / no backupWarning', async () => {
        const shift = createOwnShift()
        addClosingSheet(shift.id, 'validation-backup-success.jpg')
        const backupDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'backups')
        const databaseDir = path.join(backupDir, 'db')
        const before = fs.existsSync(databaseDir)
          ? new Set(fs.readdirSync(databaseDir).filter((name) => name.startsWith('post-close-')))
          : new Set()
        const response = await closeShift({ shiftId: shift.id, endDate: '2026-02-02', reportedTripCount: 0 })
        const createdBackups = fs.existsSync(databaseDir)
          ? fs.readdirSync(databaseDir).filter((name) => name.startsWith('post-close-') && !before.has(name))
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
      await runCase('V closeShift backup failure still closes and returns warning', 'ok:true / CLOSED shift / backupWarning:true', async () => {
        const shift = createOwnShift()
        addClosingSheet(shift.id, 'validation-backup-failure.jpg')
        const backupDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'backups')
        const parkedBackupDir = path.join(process.env.SHIFT_TRACKER_USER_DATA, 'backups-before-failure-test')
        const hadBackupDir = fs.existsSync(backupDir)
        if (hadBackupDir) fs.renameSync(backupDir, parkedBackupDir)
        fs.writeFileSync(backupDir, 'blocked backup destination')
        let response
        try {
          response = await closeShift({ shiftId: shift.id, endDate: '2026-02-02', reportedTripCount: 0 })
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
      runCase('V closeShift impossible endDate is not valid', 'ok:false / exact field endDate / invalid-date message / shift unchanged', async () => {
        const shift = createOwnShift()
        const before = shiftRowSnapshot(shift.id)
        const response = await closeShift({ shiftId: shift.id, endDate: '2026-13-45', reportedTripCount: 0 })
        return { response, unchanged: before === shiftRowSnapshot(shift.id) }
      }, (actual) => {
        const output = result(actual)
        return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'endDate', 'غير صحيح')
      })
      runCase('V closeShift empty endDate is required', 'ok:false / exact field endDate / required message / shift unchanged', async () => {
        const shift = createOwnShift()
        const before = shiftRowSnapshot(shift.id)
        const response = await closeShift({ shiftId: shift.id, endDate: '', reportedTripCount: 0 })
        return { response, unchanged: before === shiftRowSnapshot(shift.id) }
      }, (actual) => {
        const output = result(actual)
        return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'endDate', 'مطلوب')
      })
      runCase('V CLOSED shift with invalid count reports already-closed shiftId first', 'ok:false / exact field shiftId / row unchanged', async () => {
        const shift = createOwnShift()
        db.prepare("UPDATE Shift SET status = 'CLOSED', end_date = ? WHERE id = ?").run('2026-02-02', shift.id)
        const before = shiftRowSnapshot(shift.id)
        const response = await closeShift({ shiftId: shift.id, endDate: '2026-02-03', reportedTripCount: -1 })
        return { response, unchanged: before === shiftRowSnapshot(shift.id) }
      }, (actual) => {
        const output = result(actual)
        return !actual.threw && output?.unchanged === true && hasExactFieldErrorMessage(output.response, 'shiftId', 'مقفولة بالفعل')
      })
      runCase('V vehicle becomes available after close and reopened shift does not block it', 'second OPEN rejects vehicleNo, close frees vehicle, REOPENED allows new shift', async () => {
        const firstInput = newShiftInput()
        const vehicleNo = firstInput.vehicleNo
        const first = createShift(firstInput)
        if (!first.ok) return { first }
        const secondInput = { ...newShiftInput(), vehicleNo }
        const beforeRejectedCreate = shiftRowsSnapshot()
        const secondRejected = createShift(secondInput)
        const noInsert = beforeRejectedCreate === shiftRowsSnapshot()
        addClosingSheet(first.data.id, 'validation-vehicle-close.jpg')
        const firstClosed = await closeShift({ shiftId: first.data.id, endDate: '2026-02-02', reportedTripCount: 0 })
        const thirdInput = { ...newShiftInput(), vehicleNo }
        const afterClose = createShift(thirdInput)
        if (!afterClose.ok) return { secondRejected, noInsert, firstClosed, afterClose }
        addClosingSheet(afterClose.data.id, 'validation-vehicle-close-again.jpg')
        const secondClosed = await closeShift({ shiftId: afterClose.data.id, endDate: '2026-02-03', reportedTripCount: 0 })
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
      
  }
}
