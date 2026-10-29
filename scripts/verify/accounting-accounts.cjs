/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = {
  runAccountConsistencyCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
    runCase('A4 contractor snapshot survives vehicle reassignment', 'trip charge remains with contractor assigned when shift was created', () => {
        const original = createContractor({ name: 'Snapshot Original' })
        const reassigned = createContractor({ name: 'Snapshot New' })
        if (!original.ok || !reassigned.ok) throw new Error('Snapshot contractor setup failed')
        const shiftInput = newShiftInput()
        db.prepare('UPDATE Vehicle SET contractor_id = ? WHERE vehicle_no = ?').run(
          original.data.id,
          shiftInput.vehicleNo
        )
        const shift = createShift(shiftInput)
        if (!shift.ok) throw new Error('Snapshot shift setup failed')
        const trip = createTrip({
          ...tripInput(shift.data.id),
          clientCubicReported: 20,
          transportPrice: 8,
          crusherCubic: 22,
          stonePrice: 50
        })
        if (!trip.ok) throw new Error('Snapshot trip setup failed')
        db.prepare('UPDATE Vehicle SET contractor_id = ? WHERE vehicle_no = ?').run(
          reassigned.data.id,
          shiftInput.vehicleNo
        )
        return {
          original: getContractorAccount({ contractorId: original.data.id }),
          reassigned: getContractorAccount({ contractorId: reassigned.data.id }),
          savedShift: db.prepare('SELECT contractor_id FROM Shift WHERE id = ?').get(shift.data.id)
        }
      }, (actual) => {
        const output = result(actual)
        return output?.original?.ok === true &&
          output.original.data.transportTotal === 160 &&
          output.original.data.materialTotal === 1100 &&
          output.original.data.balance === 1260 &&
          output.reassigned?.ok === true &&
          output.reassigned.data.transportTotal === 0 &&
          output.reassigned.data.materialTotal === 0 &&
          output.savedShift?.contractor_id === db.prepare('SELECT id FROM TransportContractor WHERE name = ?').get('Snapshot Original').id
      })
      runCase('A5 financial totals agree across Accounts and Statements', 'all seeded client and contractor balances match their statement final balances', () => {
        const clients = db.prepare('SELECT id FROM Client ORDER BY id').all()
        const contractors = db.prepare('SELECT id FROM TransportContractor ORDER BY id').all()
        const clientMatches = clients.every(({ id }) => {
          const account = getClientAccount({ clientId: id })
          const statement = getClientStatement({ clientId: id })
          return account.ok && statement.ok && account.data.balance === statement.data.finalBalance
        })
        const contractorMatches = contractors.every(({ id }) => {
          const account = getContractorAccount({ contractorId: id })
          const statement = getContractorStatement({ contractorId: id })
          return account.ok && statement.ok && account.data.balance === statement.data.finalBalance
        })
        return { clientMatches, contractorMatches }
      }, (actual) => {
        const output = result(actual)
        return output?.clientMatches === true && output?.contractorMatches === true
      })
      runCase('A6 database enforces accounting constraints and partial open-shift uniqueness', 'duplicate OPEN vehicle/driver, invalid prices and bad dates fail; REOPENED permits a new OPEN shift', () => {
        const shiftInput = newShiftInput()
        const created = createShift(shiftInput)
        if (!created.ok) throw new Error('Constraint shift setup failed')
        const trip = createTrip(tripInput(created.data.id))
        if (!trip.ok) throw new Error('Constraint trip setup failed')
        const insertShiftSql = 'INSERT INTO Shift (' +
          'id, vehicle_no, driver_id, contractor_id, crusher_cubic_default, client_cubic_default, ' +
          "start_date, status) VALUES (?, ?, ?, ?, 1, 1, '2026-02-01', 'OPEN')"
        let duplicateVehicleRejected = false
        let duplicateDriverRejected = false
        try {
          db.prepare(insertShiftSql).run('SH-TEST-DUP-VEHICLE', shiftInput.vehicleNo, driverId, contractorId)
        } catch { duplicateVehicleRejected = true }
        const otherVehicle = newShiftInput()
        try {
          db.prepare(insertShiftSql).run('SH-TEST-DUP-DRIVER', otherVehicle.vehicleNo, shiftInput.driverId, contractorId)
        } catch { duplicateDriverRejected = true }
    
        let invalidZeroPriceRejected = false
        let invalidNegativePriceRejected = false
        let invalidZeroInitialPriceRejected = false
        try { db.prepare('UPDATE Trip SET stone_price = 0 WHERE id = ?').run(trip.data.id) } catch { invalidZeroPriceRejected = true }
        try { db.prepare('UPDATE Trip SET transport_price = -1 WHERE id = ?').run(trip.data.id) } catch { invalidNegativePriceRejected = true }
        try { db.prepare('UPDATE Crusher SET initial_price = 0 WHERE id = ?').run(crusherId) } catch { invalidZeroInitialPriceRejected = true }
    
        const ledger = createLedger()
        const payment = createClientPayment({
          entryDate: '2026-02-01',
          clientId,
          amount: 100,
          notes: 'Date constraint fixture'
        })
        if (!ledger.ok || !payment.ok) throw new Error('Date constraint fixture setup failed')
        const dateChecks = [
          { label: 'Shift.start_date', sql: 'UPDATE Shift SET start_date = ? WHERE id = ?', id: created.data.id },
          { label: 'Shift.end_date', sql: 'UPDATE Shift SET end_date = ? WHERE id = ?', id: created.data.id },
          { label: 'Trip.trip_date', sql: 'UPDATE Trip SET trip_date = ? WHERE id = ?', id: trip.data.id },
          { label: 'Ledger.entry_date', sql: 'UPDATE Ledger SET entry_date = ? WHERE id = ?', id: ledger.data.id },
          { label: 'ClientPayment.entry_date', sql: 'UPDATE ClientPayment SET entry_date = ? WHERE id = ?', id: payment.data.id },
          { label: 'Client.opening_balance_date', sql: 'UPDATE Client SET opening_balance_date = ? WHERE id = ?', id: clientId },
          { label: 'TransportContractor.opening_balance_date', sql: 'UPDATE TransportContractor SET opening_balance_date = ? WHERE id = ?', id: contractorId }
        ]
        const invalidDates = ['2026-13-45', '2026-00-10', '2026-02-30', 'not-a-date']
        const dateResults = dateChecks.map((check) => {
          const rejected = invalidDates.map((date) => {
            try {
              db.prepare(check.sql).run(date, check.id)
              return false
            } catch {
              return true
            }
          })
          let validAccepted = false
          try {
            db.prepare(check.sql).run('2026-02-28', check.id)
            validAccepted = true
          } catch {}
          console.log(
            'DATE CHECK ' + check.label +
              ' | invalid rejected ' + rejected.filter(Boolean).length + '/' + invalidDates.length +
              ' | valid accepted ' + validAccepted
          )
          return { label: check.label, rejected, validAccepted }
        })
    
        db.prepare("UPDATE Shift SET status = 'REOPENED' WHERE id = ?").run(created.data.id)
        const reopenedCanStart = createShift(shiftInput)
        return {
          duplicateVehicleRejected,
          duplicateDriverRejected,
          invalidZeroPriceRejected,
          invalidNegativePriceRejected,
          invalidZeroInitialPriceRejected,
          dateResults,
          reopenedCanStart
        }
      }, (actual) => {
        const output = result(actual)
        return output?.duplicateVehicleRejected === true &&
          output.duplicateDriverRejected === true &&
          output.invalidZeroPriceRejected === true &&
          output.invalidNegativePriceRejected === true &&
          output.invalidZeroInitialPriceRejected === true &&
          output.dateResults.length === 7 &&
          output.dateResults.every(
            (dateCheck) =>
              dateCheck.rejected.every(Boolean) && dateCheck.validAccepted
          ) &&
          output.reopenedCanStart?.ok === true
      })
      runCase('A8 required statement indexes are used by query planner', 'Trip(client_id), Shift(contractor_id), Ledger(driver_id), and Ledger(shift_id) use indexes', () => {
        const queries = [
          { label: 'Trip by client_id', table: 'Trip', sql: 'EXPLAIN QUERY PLAN SELECT id FROM Trip WHERE client_id = ?', value: clientId },
          { label: 'Shift by contractor_id', table: 'Shift', sql: 'EXPLAIN QUERY PLAN SELECT id FROM Shift WHERE contractor_id = ?', value: contractorId },
          { label: 'Ledger by driver_id', table: 'Ledger', sql: 'EXPLAIN QUERY PLAN SELECT id FROM Ledger WHERE driver_id = ?', value: driverId },
          { label: 'Ledger by shift_id', table: 'Ledger', sql: 'EXPLAIN QUERY PLAN SELECT id FROM Ledger WHERE shift_id = ?', value: openShiftId }
        ]
        const plans = queries.map((query) => {
          const details = db.prepare(query.sql).all(query.value).map((row) => row.detail)
          console.log('QUERY PLAN ' + query.label + ' | ' + details.join(' ; '))
          return { ...query, details }
        })
        return { plans }
      }, (actual) => {
        const output = result(actual)
        return output?.plans.length === 4 &&
          output.plans.every(
            (plan) =>
              plan.details.some((detail) => /USING (?:COVERING )?INDEX/.test(detail)) &&
              !plan.details.some((detail) => detail.includes('SCAN ' + plan.table))
          )
      })
      runCase('A7 closing a shift creates no automatic ledger settlement', 'ledger rows are unchanged by closeShift', async () => {
        const shift = createOwnShift()
        addClosingSheet(shift.id, 'no-auto-settlement.jpg')
        const before = db.prepare('SELECT COUNT(*) as count FROM Ledger').get().count
        const closed = await closeShift({ shiftId: shift.id, endDate: '2026-02-02', reportedTripCount: 0 })
        const after = db.prepare('SELECT COUNT(*) as count FROM Ledger').get().count
        return { closed, before, after }
      }, (actual) => {
        const output = result(actual)
        return output?.closed?.ok === true && output.before === output.after
      })
    
      
  }
}
