/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = {
  runClosedShiftCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
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
      
  },
  runEntryValidationCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
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
    
      
  }
}
