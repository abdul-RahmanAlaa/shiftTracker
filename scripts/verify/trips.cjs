/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = {
  runInvalidPayloadCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
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
      
  },
  runAcceptedPayloadCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
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
      
  }
}
