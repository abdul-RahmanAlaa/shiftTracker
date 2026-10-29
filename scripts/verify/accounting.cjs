/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = {
  runCoreAccountingCases(context) {
    let { db, runCase, runAsyncCase, result, clientId, contractorId, crusherId, materialTypeId, driverId, openShiftId, closedShiftId, closedLedgerId, openLedgerId, paymentId, reopenedCountShiftId, closedFields, newShiftInput, createOwnShift, tripInput, rejectedTripCreate, rejectedTripUpdate, rejectedShiftCreate, addClosingSheet, createLedger, updateLedger, getTripById, tripRowsSnapshot, shiftRowsSnapshot, shiftRowSnapshot, hasFieldErrors, hasExactFieldError, hasExactFieldErrorMessage, createShift, closeShift, reopenShift, createTrip, updateTrip, createLedgerEntry, updateLedgerEntry, deleteLedgerEntry, createClientPayment, updateClientPayment, createClient, createContractor, createCrusher, createMaterialType, getClientAccount, getContractorAccount, getClientStatement, getContractorStatement, createStatementOrderSamples, listTripLocations, listTripsByShift, fs, path } = context
    runCase('A1 client fixed fine, opening balance, payment, and cubic total', 'client charge 2000 - fine 200 - payment 1000 + opening 500 = 1300; cubic stays 20', () => {
        const client = createClient({
          name: 'Golden Client',
          openingBalance: 500,
          openingBalanceDate: '2026-02-15'
        })
        const contractor = createContractor({ name: 'Golden Contractor', openingBalance: 100 })
        if (!client.ok || !contractor.ok) throw new Error('Golden account setup failed')
    
        const shiftInput = newShiftInput()
        db.prepare('UPDATE Vehicle SET contractor_id = ? WHERE vehicle_no = ?').run(
          contractor.data.id,
          shiftInput.vehicleNo
        )
        const shiftResult = createShift(shiftInput)
        if (!shiftResult.ok) throw new Error('Golden shift setup failed')
        const trip = createTrip({
          ...tripInput(shiftResult.data.id),
          clientId: client.data.id,
          tripDate: '2026-02-01',
          crusherCubic: 22,
          clientCubicReported: 20,
          stonePrice: 50,
          transportPrice: 8,
          clientPrice: 100,
          fineAmount: 200,
          fineReason: 'Golden fine'
        })
        if (!trip.ok) throw new Error('Golden trip setup failed: ' + JSON.stringify(trip))
        const payment = createClientPayment({
          entryDate: '2026-02-02',
          clientId: client.data.id,
          amount: 1000,
          notes: null
        })
        const ledger = createLedgerEntry({
          entryDate: '2026-02-02',
          movementType: 'PAYMENT',
          amount: 1000,
          shiftId: null,
          contractorId: contractor.data.id,
          notes: 'Golden settlement'
        })
        if (!payment.ok || !ledger.ok) throw new Error('Golden settlement setup failed')
    
        const clientAccount = getClientAccount({ clientId: client.data.id })
        const clientStatement = getClientStatement({ clientId: client.data.id })
        const contractorAccount = getContractorAccount({ contractorId: contractor.data.id })
        const contractorStatement = getContractorStatement({ contractorId: contractor.data.id })
        const savedTrip = getTripById(trip.data.id)
        return {
          clientAccount,
          clientStatement,
          contractorAccount,
          contractorStatement,
          savedTrip,
          rawClientOpening: db.prepare('SELECT opening_balance FROM Client WHERE id = ?').get(client.data.id).opening_balance,
          rawContractorOpening: db.prepare('SELECT opening_balance FROM TransportContractor WHERE id = ?').get(contractor.data.id).opening_balance
        }
      }, (actual) => {
        const output = result(actual)
        return output?.clientAccount?.ok === true &&
          output.clientStatement?.ok === true &&
          output.contractorAccount?.ok === true &&
          output.contractorStatement?.ok === true &&
          output.clientAccount.data.receivableTotal === 2000 &&
          output.clientAccount.data.totalCubic === 20 &&
          output.clientAccount.data.paidTotal === 1000 &&
          output.clientAccount.data.balance === 1300 &&
          output.clientStatement.data.finalBalance === 1300 &&
          output.clientStatement.data.rows.some((row) => row.kind === 'FINE' && row.value === -200) &&
          output.contractorAccount.data.entries.some((entry) => entry.amount === 1000) &&
          output.contractorAccount.data.transportTotal === 160 &&
          output.contractorAccount.data.materialTotal === 1100 &&
          output.contractorAccount.data.ledgerTotal === 1000 &&
          output.contractorAccount.data.balance === 360 &&
          output.contractorStatement.data.finalBalance === 360 &&
          output.rawClientOpening === 50000 &&
          output.rawContractorOpening === 10000 &&
          output.savedTrip?.clientCubicReported === 20 &&
          output.savedTrip?.fineAmount === 200
      })
      runCase('A2 half-up line rounding and exact 2-decimal amounts', '13.99 x 3975.00 = 55610.25; 1.005 x 1.00 = 1.01', () => {
        const client = createClient({ name: 'Rounding Client' })
        if (!client.ok) throw new Error('Rounding client setup failed')
        const firstShift = createOwnShift()
        const first = createTrip({
          ...tripInput(firstShift.id),
          clientId: client.data.id,
          clientCubicReported: 13.99,
          clientPrice: 3975
        })
        const secondShift = createOwnShift()
        const second = createTrip({
          ...tripInput(secondShift.id),
          clientId: client.data.id,
          clientCubicReported: 1.005,
          clientPrice: 1
        })
        if (!first.ok || !second.ok) throw new Error('Rounding trip setup failed')
        const account = getClientAccount({ clientId: client.data.id })
        return {
          account,
          firstTrip: getTripById(first.data.id),
          secondTrip: getTripById(second.data.id),
          statement: getClientStatement({ clientId: client.data.id })
        }
      }, (actual) => {
        const output = result(actual)
        return output?.account?.ok === true &&
          output.account.data.receivableTotal === 55611.26 &&
          Math.abs(output.account.data.totalCubic - 14.995) < 1e-12 &&
          output.firstTrip?.clientPrice === 3975 &&
          output.secondTrip?.clientCubicReported === 1.005 &&
          output.statement?.ok === true &&
          output.statement.data.rows
            .filter((row) => row.kind === 'CHARGE')
            .map((row) => row.value)
            .join(',') === '55610.25,1.01'
      })
      runCase('A3 money boundary rejects three decimals and preserves 5.25', 'fine, trip prices, ledger, and payment reject 5.255; 5.25 stored as 525 and returned exactly', () => {
        const shift = createOwnShift()
        const rejectedFine = createTrip({ ...tripInput(shift.id), fineAmount: 5.255 })
        const rejectedPrice = createTrip({ ...tripInput(shift.id), stonePrice: 5.255 })
        const rejectedTransportPrice = rejectedTripCreate({ transportPrice: 5.255 })
        const rejectedClientPrice = rejectedTripCreate({ clientPrice: 5.255 })
        const rejectedUpdatePrice = rejectedTripUpdate({ clientPrice: 5.255 })
        const rejectedLedger = createLedgerEntry({
          entryDate: '2026-01-10',
          movementType: 'PAYMENT',
          amount: 5.255,
          shiftId: null,
          contractorId,
          notes: null
        })
        const rejectedPayment = createClientPayment({
          entryDate: '2026-01-10',
          clientId,
          amount: 5.255,
          notes: null
        })
        const rejectedOpening = createClient({ name: 'Invalid Opening', openingBalance: 5.255 })
        const acceptedClient = createClient({
          name: 'Exact Client',
          initialPrice: 5.25,
          openingBalance: 5.25
        })
        const acceptedContractor = createContractor({
          name: 'Exact Contractor',
          openingBalance: 5.25
        })
        const acceptedCrusher = createCrusher({ name: 'Exact Crusher', initialPrice: 5.25 })
        const accepted = createClientPayment({
          entryDate: '2026-01-10',
          clientId,
          amount: 5.25,
          notes: null
        })
        if (!accepted.ok) throw new Error('5.25 payment was rejected')
        const acceptedShift = createOwnShift()
        const acceptedTrip = createTrip({
          ...tripInput(acceptedShift.id),
          fineAmount: 5.25,
          stonePrice: 5.25,
          transportPrice: 5.25,
          clientPrice: 5.25
        })
        if (!acceptedTrip.ok) throw new Error('5.25 trip values were rejected')
        const listed = getClientAccount({ clientId })
        return {
          rejectedFine,
          rejectedPrice,
          rejectedTransportPrice,
          rejectedClientPrice,
          rejectedUpdatePrice,
          rejectedLedger,
          rejectedPayment,
          rejectedOpening,
          acceptedClient,
          acceptedContractor,
          acceptedCrusher,
          rawAmount: db.prepare('SELECT amount FROM ClientPayment WHERE id = ?').get(accepted.data.id).amount,
          rawTrip: db.prepare(
            'SELECT fine_amount, stone_price, transport_price, client_price FROM Trip WHERE id = ?'
          ).get(acceptedTrip.data.id),
          publicTrip: getTripById(acceptedTrip.data.id),
          rawClient: acceptedClient.ok ? db.prepare('SELECT initial_price, opening_balance FROM Client WHERE id = ?').get(acceptedClient.data.id) : null,
          rawContractor: acceptedContractor.ok ? db.prepare('SELECT opening_balance FROM TransportContractor WHERE id = ?').get(acceptedContractor.data.id) : null,
          rawCrusher: acceptedCrusher.ok ? db.prepare('SELECT initial_price FROM Crusher WHERE id = ?').get(acceptedCrusher.data.id) : null,
          listed
        }
      }, (actual) => {
        const output = result(actual)
        return output?.rejectedFine?.ok === false &&
          output.rejectedFine.errors.some((error) => error.field === 'fineAmount') &&
          output.rejectedPrice?.ok === false &&
          output.rejectedPrice.errors.some((error) => error.field === 'stonePrice') &&
          output.rejectedTransportPrice?.response?.ok === false &&
          output.rejectedTransportPrice.response.errors.some((error) => error.field === 'transportPrice') &&
          output.rejectedTransportPrice.unchanged &&
          output.rejectedClientPrice?.response?.ok === false &&
          output.rejectedClientPrice.response.errors.some((error) => error.field === 'clientPrice') &&
          output.rejectedClientPrice.unchanged &&
          output.rejectedUpdatePrice?.response?.ok === false &&
          output.rejectedUpdatePrice.response.errors.some((error) => error.field === 'clientPrice') &&
          output.rejectedUpdatePrice.unchanged &&
          output.rejectedLedger?.ok === false &&
          output.rejectedLedger.errors.some((error) => error.field === 'amount') &&
          output.rejectedPayment?.ok === false &&
          output.rejectedPayment.errors.some((error) => error.field === 'amount') &&
          output.rejectedOpening?.ok === false &&
          output.rejectedOpening.errors.some((error) => error.field === 'openingBalance') &&
          output.acceptedClient?.ok === true &&
          output.acceptedContractor?.ok === true &&
          output.acceptedCrusher?.ok === true &&
          output.rawAmount === 525 &&
          output.rawTrip?.fine_amount === 525 &&
          output.rawTrip?.stone_price === 525 &&
          output.rawTrip?.transport_price === 525 &&
          output.rawTrip?.client_price === 525 &&
          output.publicTrip?.fineAmount === 5.25 &&
          output.publicTrip?.stonePrice === 5.25 &&
          output.publicTrip?.transportPrice === 5.25 &&
          output.publicTrip?.clientPrice === 5.25 &&
          output.rawClient?.initial_price === 525 &&
          output.rawClient?.opening_balance === 525 &&
          output.rawContractor?.opening_balance === 525 &&
          output.rawCrusher?.initial_price === 525 &&
          output.listed?.ok === true &&
          output.listed.data.payments.some((row) => row.amount === 5.25)
      })
      
  }
}
