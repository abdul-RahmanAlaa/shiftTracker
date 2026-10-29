/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = {
  runStatementCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, nextFixtureSequence, listTripLocations, listTripsByShift, fs, path } = context
    function createStatementOrderSamples() {
      const sequence = nextFixtureSequence()
      const date = '2026-03-15'
      const materialTwo = createMaterialType({ name: 'Statement order material two ' + sequence })
      const materialTen = createMaterialType({ name: 'Statement order material ten ' + sequence })
      if (!materialTwo.ok || !materialTen.ok) throw new Error('Statement materials setup failed')
    
      function createSample(suffix, ids, insertionOrder, reversePayments) {
        const client = createClient({
          name: 'Statement order client ' + suffix + ' ' + sequence,
          openingBalance: 100,
          openingBalanceDate: date
        })
        const contractor = createContractor({
          name: 'Statement order contractor ' + suffix + ' ' + sequence,
          openingBalance: 50,
          openingBalanceDate: date
        })
        if (!client.ok || !contractor.ok) throw new Error('Statement entity setup failed')
    
        const shiftInput = newShiftInput()
        db.prepare('UPDATE Vehicle SET contractor_id = ? WHERE vehicle_no = ?').run(
          contractor.data.id,
          shiftInput.vehicleNo
        )
        const shift = createShift(shiftInput)
        if (!shift.ok) throw new Error('Statement shift setup failed: ' + JSON.stringify(shift))
    
        const tripKinds = {
          two: { id: ids.two, materialTypeId: materialTwo.data.id, notes: 'Trip two' },
          ten: {
            id: ids.ten,
            materialTypeId: materialTen.data.id,
            notes: 'Trip ten'
          }
        }
        for (const kind of insertionOrder) {
          const tripKind = tripKinds[kind]
          const trip = createTrip({
            ...tripInput(shift.data.id),
            clientId: client.data.id,
            tripDate: date,
            clientCubicReported: 1,
            crusherCubic: 2,
            materialTypeId: tripKind.materialTypeId,
            fineAmount: kind === 'two' ? 5 : 0,
            fineReason: kind === 'two' ? 'Order fine' : '',
            notes: tripKind.notes
          })
          if (!trip.ok) throw new Error('Statement trip setup failed: ' + JSON.stringify(trip))
          db.prepare('UPDATE Trip SET id = ? WHERE id = ?').run(tripKind.id, trip.data.id)
        }
    
        const clientPayments = [
          { amount: 3, notes: 'Payment A' },
          { amount: 7, notes: 'Payment B' }
        ]
        for (const payment of reversePayments ? clientPayments.reverse() : clientPayments) {
          const result = createClientPayment({
            entryDate: date,
            clientId: client.data.id,
            amount: payment.amount,
            notes: payment.notes
          })
          if (!result.ok) throw new Error('Statement client payment setup failed')
        }
    
        const contractorPayments = [
          { movementType: 'ADVANCE', amount: 3, notes: 'Ledger A' },
          { movementType: 'PAYMENT', amount: 7, notes: 'Ledger B' }
        ]
        const ledgerEntryIds = []
        for (const payment of reversePayments ? contractorPayments.reverse() : contractorPayments) {
          const result = createLedgerEntry({
            entryDate: date,
            movementType: payment.movementType,
            amount: payment.amount,
            shiftId: null,
            contractorId: contractor.data.id,
            notes: payment.notes
          })
          if (!result.ok) throw new Error('Statement contractor payment setup failed')
          ledgerEntryIds.push(result.data.id)
        }
    
        const clientStatement = getClientStatement({ clientId: client.data.id })
        const contractorStatement = getContractorStatement({ contractorId: contractor.data.id })
        if (!clientStatement.ok || !contractorStatement.ok) {
          throw new Error('Statement generation failed')
        }
        for (const id of ledgerEntryIds) {
          const deleted = deleteLedgerEntry({ id })
          if (!deleted.ok) throw new Error('Statement contractor payment cleanup failed')
        }
        return {
          clientRows: clientStatement.data.rows,
          contractorRows: contractorStatement.data.rows
        }
      }
    
      return [
        createSample(
          'first',
          { two: 'TRP-' + sequence + '-2', ten: 'TRP-' + sequence + '-10' },
          ['ten', 'two'],
          false
        ),
        createSample(
          'second',
          { two: 'TRP-' + sequence + '-102', ten: 'TRP-' + sequence + '-110' },
          ['two', 'ten'],
          true
        )
      ]
    }

    runCase('S1 client trip charge carries notes and fine keeps its reason', 'charge note is exact and fine note remains the fine reason', () => {
        const shift = createOwnShift()
        const trip = createTrip({
          ...tripInput(shift.id),
          tripDate: '2026-02-11',
          fineAmount: 0.5,
          fineReason: 'S1 fine reason',
          notes: 'S1 trip note'
        })
        if (!trip.ok) return { trip }
        const statement = getClientStatement({ clientId })
        if (!statement.ok) return { statement }
        return {
          charge: statement.data.rows.find(
            (row) => row.kind === 'CHARGE' && row.date === '2026-02-11'
          ),
          fine: statement.data.rows.find(
            (row) => row.kind === 'FINE' && row.date === '2026-02-11'
          )
        }
      }, (actual) => {
        const value = result(actual)
        return value?.charge?.notes === 'S1 trip note' && value.fine?.notes === 'S1 fine reason'
      })
      runCase('S2 blank trip notes become null in client statement', 'empty-string notes normalize to null', () => {
        const shift = createOwnShift()
        const trip = createTrip({ ...tripInput(shift.id), tripDate: '2026-02-12', notes: '' })
        if (!trip.ok) return { trip }
        const statement = getClientStatement({ clientId })
        if (!statement.ok) return { statement }
        return statement.data.rows.find(
          (row) => row.kind === 'CHARGE' && row.date === '2026-02-12'
        )
      }, (actual) => result(actual)?.notes === null)
      runCase('S3 contractor trip note appears only on transport', 'transport note is exact and material note is null', () => {
        const shift = createOwnShift()
        const trip = createTrip({
          ...tripInput(shift.id),
          tripDate: '2026-02-13',
          notes: 'S3 contractor trip note'
        })
        if (!trip.ok) return { trip }
        const statement = getContractorStatement({ contractorId })
        if (!statement.ok) return { statement }
        return {
          transport: statement.data.rows.find(
            (row) =>
              row.kind === 'CHARGE' &&
              row.component === 'TRANSPORT' &&
              row.date === '2026-02-13'
          ),
          material: statement.data.rows.find(
            (row) =>
              row.kind === 'CHARGE' &&
              row.component === 'MATERIAL' &&
              row.date === '2026-02-13'
          )
        }
      }, (actual) => {
        const value = result(actual)
        return (
          value?.transport?.notes === 'S3 contractor trip note' &&
          value.material?.notes === null
        )
      })
      runCase('S4 account and statement balances match after noted trip', 'client and contractor balances equal statement final balances', () => {
        const shift = createOwnShift()
        const trip = createTrip({
          ...tripInput(shift.id),
          tripDate: '2026-02-14',
          notes: 'S4 balance trip note'
        })
        if (!trip.ok) return { trip }
        const clientAccount = getClientAccount({ clientId })
        const clientStatement = getClientStatement({ clientId })
        const contractorAccount = getContractorAccount({ contractorId })
        const contractorStatement = getContractorStatement({ contractorId })
        return { clientAccount, clientStatement, contractorAccount, contractorStatement }
      }, (actual) => {
        const value = result(actual)
        return (
          value?.clientAccount?.ok === true &&
          value?.clientStatement?.ok === true &&
          value?.contractorAccount?.ok === true &&
          value?.contractorStatement?.ok === true &&
          value.clientAccount.data.balance === value.clientStatement.data.finalBalance &&
          value.contractorAccount.data.balance === value.contractorStatement.data.finalBalance
        )
      })
    runCase(
        'S5 same-date client statement order is numeric and insertion-stable',
        'opening, numeric trip charges and fines, then canonically ordered payments',
        () => createStatementOrderSamples(),
        (actual) => {
          const samples = result(actual)
          const firstRows = samples?.[0]?.clientRows
          const secondRows = samples?.[1]?.clientRows
          const order = firstRows?.map((row) => {
            if (row.kind === 'OPENING') return 'OPENING'
            if (row.kind === 'FINE') return 'FINE:' + row.notes
            if (row.kind === 'CHARGE') {
              return row.description?.includes('material two') ? 'CHARGE:TWO' : 'CHARGE:TEN'
            }
            return 'PAYMENT:' + row.description
          })
          return (
            order?.join('|') ===
              'OPENING|CHARGE:TWO|FINE:Order fine|CHARGE:TEN|PAYMENT:Payment A|PAYMENT:Payment B' &&
            JSON.stringify(firstRows) === JSON.stringify(secondRows)
          )
        }
      )
      runCase(
        'S6 same-date contractor statement orders transport before material',
        'numeric trip IDs, transport before material, then canonically ordered payments',
        () => createStatementOrderSamples(),
        (actual) => {
          const samples = result(actual)
          const firstRows = samples?.[0]?.contractorRows
          const secondRows = samples?.[1]?.contractorRows
          const order = firstRows?.map((row) => {
            if (row.kind === 'OPENING') return 'OPENING'
            if (row.kind === 'PAYMENT') return 'PAYMENT:' + row.description + ':' + row.notes
            const trip = row.description?.includes('material two') ? 'TWO' : 'TEN'
            return 'CHARGE:' + row.component + ':' + trip
          })
          return (
            order?.join('|') ===
              'OPENING|CHARGE:TRANSPORT:TWO|CHARGE:MATERIAL:TWO|CHARGE:TRANSPORT:TEN|CHARGE:MATERIAL:TEN|PAYMENT:ADVANCE:Ledger A|PAYMENT:PAYMENT:Ledger B' &&
            JSON.stringify(firstRows) === JSON.stringify(secondRows)
          )
        }
      )
        
  }
}
