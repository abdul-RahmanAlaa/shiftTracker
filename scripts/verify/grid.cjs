/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = function (context) {
  const { tripGrid, runCase, result, createOwnShift, createTrip, tripInput, listTripLocations, db } = context
  function runTripGridCases() {
    runCase('G1 digits and separators normalize', 'Arabic digits and separators become Latin decimal text', () => ({
      normalized: tripGrid.normalizeDigits('١٬٢٥٠٫٥٠'),
      Persian: tripGrid.normalizeDigits('۱۲۳'),
      arabicNumber: tripGrid.parseNumberCell('١٬٢٥٠٫٥٠', { money: true })
    }), (actual) => {
      const value = result(actual)
      return value?.normalized === '1,250.50' && value.Persian === '123' &&
        value.arabicNumber?.ok === true && value.arabicNumber.value === 1250.5
    })
    runCase('G2 numbers and comma grouping validate strictly', 'valid grouping accepted; malformed commas, locale mix, and excess money decimals rejected', () => ({
      grouped: tripGrid.parseNumberCell('1,250.50', { money: true }),
      groupedDecimal: tripGrid.parseNumberCell('12,345.5', { money: true }),
      mixed: tripGrid.parseNumberCell('1.250,5', { money: true }),
      tooPrecise: tripGrid.parseNumberCell('5.255', { money: true }),
      malformed: ['1,25', '1,2345', '12,34,567', ',5', '5,'].map((input) =>
        tripGrid.parseNumberCell(input, { money: true })
      )
    }), (actual) => {
      const value = result(actual)
      return value?.grouped?.ok === true && value.grouped.value === 1250.5 &&
        value.groupedDecimal?.ok === true && value.groupedDecimal.value === 12345.5 &&
        value.mixed?.ok === false && value.tooPrecise?.ok === false &&
        value.malformed?.length === 5 && value.malformed.every((entry) => entry.ok === false)
    })
    runCase('G3 real dates parse', 'ISO and D/M/YYYY accepted, impossible date rejected', () => ({
      iso: tripGrid.parseDateCell('2026-10-14'),
      slash: tripGrid.parseDateCell('14/10/2026'),
      slashPadded: tripGrid.parseDateCell('03/10/2026'),
      slashUnpadded: tripGrid.parseDateCell('3/10/2026'),
      impossible: tripGrid.parseDateCell('2026-13-45')
    }), (actual) => {
      const value = result(actual)
      return value?.iso?.ok === true && value.iso.value === '2026-10-14' &&
        value.slash?.ok === true && value.slash.value === '2026-10-14' &&
        value.slashPadded?.ok === true && value.slashPadded.value === '2026-10-03' &&
        value.slashUnpadded?.ok === true && value.slashUnpadded.value === '2026-10-03' &&
        value.impossible?.ok === false
    })
    runCase('G4 crusher receipt smart cell', 'empty UNKNOWN, number PROVIDED, dash missing, malformed values rejected', () => ({
      empty: tripGrid.parseReceiptCell(''),
      number: tripGrid.parseReceiptCell('123'),
      missing: tripGrid.parseReceiptCell('-'),
      text: tripGrid.parseReceiptCell('abc'),
      decimal: tripGrid.parseReceiptCell('12.5'),
      zero: tripGrid.parseReceiptCell('0')
    }), (actual) => {
      const value = result(actual)
      return value?.empty?.ok === true && value.empty.value.crusherReceiptStatus === 'UNKNOWN' &&
        value.number?.ok === true && value.number.value.crusherReceiptStatus === 'PROVIDED' &&
        value.number.value.crusherReceiptNo === 123 &&
        value.missing?.ok === true && value.missing.value.crusherReceiptStatus === 'CONFIRMED_MISSING' &&
        value.text?.ok === false && value.decimal?.ok === false && value.zero?.ok === false
    })
    runCase('G5 recipient smart cell', 'empty maps to UNCLEAR and text maps to PROVIDED', () => ({
      empty: tripGrid.parseRecipientCell(''),
      provided: tripGrid.parseRecipientCell('  Samir  ')
    }), (actual) => {
      const value = result(actual)
      return value?.empty?.recipientNameStatus === 'UNCLEAR' &&
        value.provided?.recipientNameStatus === 'PROVIDED' &&
        value.provided.recipientName === 'Samir'
    })
    runCase('G6 Excel and CSV paste parsing', 'quoted tabs, 2x3 block, header skip, and trailing newline', () => ({
      block: tripGrid.parsePaste('a\tb\tc\nd\te\tf\n'),
      quoted: tripGrid.parsePaste('"a\tb"\tc\n'),
      header: tripGrid.parsePaste('Date\tClient\n2026-10-14\tAcme', ['Date'])
    }), (actual) => {
      const value = result(actual)
      return JSON.stringify(value?.block) === JSON.stringify([['a', 'b', 'c'], ['d', 'e', 'f']]) &&
        JSON.stringify(value?.quoted) === JSON.stringify([['a\tb', 'c']]) &&
        JSON.stringify(value?.header) === JSON.stringify([['2026-10-14', 'Acme']])
    })
    runCase('G7 names resolve by case and collapsed spaces', 'normalized exact name resolves while unknown text does not', () => ({
      match: tripGrid.resolveName('  aCME   Materials ', [{ id: 9, name: 'Acme Materials' }]),
      unknown: tripGrid.resolveName('Acme Other', [{ id: 9, name: 'Acme Materials' }])
    }), (actual) => {
      const value = result(actual)
      return value?.match?.id === 9 && value.unknown === null
    })
    runCase('G8 smart cells build exact createTrip payload', 'all user fields and statuses map to the createTrip contract', () => tripGrid.buildTripPayload({
      tripDate: '14/10/2026',
      client: 'Client',
      crusher: 'Crusher',
      materialType: 'Stone',
      clientId: 11,
      crusherId: 12,
      materialTypeId: 13,
      clientCubic: '2',
      crusherCubic: '3',
      stonePrice: '5.25',
      transportPrice: '6.50',
      clientPrice: '8',
      crusherReceipt: '123',
      notes: 'note',
      clientReceiptNo: 'C-1',
      recipient: 'Receiver',
      location: 'North',
      fineAmount: '1.25',
      fineReason: 'reason'
    }, 'SHIFT-1'), (actual) => {
      const value = result(actual)
      const expected = {
        shiftId: 'SHIFT-1',
        tripDate: '2026-10-14',
        clientId: 11,
        crusherId: 12,
        materialTypeId: 13,
        clientCubicReported: 2,
        crusherCubic: 3,
        stonePrice: 5.25,
        transportPrice: 6.5,
        clientPrice: 8,
        crusherReceiptStatus: 'PROVIDED',
        crusherReceiptNo: 123,
        recipientNameStatus: 'PROVIDED',
        recipientName: 'Receiver',
        notes: 'note',
        clientReceiptNo: 'C-1',
        location: 'North',
        fineAmount: 1.25,
        fineReason: 'reason'
      }
      return value?.payload !== undefined &&
        Object.keys(value.payload).length === Object.keys(expected).length &&
        Object.keys(expected).every((key) => value.payload[key] === expected[key]) &&
        Object.keys(value.errors).length === 0
    })
    runCase('G9 server errors map to grid cells', 'smart receipt and recipient fields map correctly; _form remains row message', () => tripGrid.mapServerErrors([
      { field: 'tripDate', message: 'date' },
      { field: 'clientId', message: 'client' },
      { field: 'crusherId', message: 'crusher' },
      { field: 'materialTypeId', message: 'material' },
      { field: 'clientCubicReported', message: 'client cubic' },
      { field: 'crusherCubic', message: 'crusher cubic' },
      { field: 'stonePrice', message: 'stone price' },
      { field: 'transportPrice', message: 'transport price' },
      { field: 'clientPrice', message: 'client price' },
      { field: 'crusherReceiptNo', message: 'receipt no' },
      { field: 'crusherReceiptStatus', message: 'receipt status' },
      { field: 'recipientName', message: 'recipient' },
      { field: 'recipientNameStatus', message: 'recipient status' },
      { field: 'clientReceiptNo', message: 'client receipt' },
      { field: 'notes', message: 'notes' },
      { field: 'location', message: 'location' },
      { field: 'fineAmount', message: 'fine' },
      { field: 'fineReason', message: 'reason' },
      { field: '_form', message: 'form' }
    ]), (actual) => {
      const value = result(actual)
      return value?.cells?.tripDate === 'date' && value.cells.client === 'client' &&
        value.cells.crusher === 'crusher' && value.cells.materialType === 'material' &&
        value.cells.clientCubic === 'client cubic' && value.cells.crusherCubic === 'crusher cubic' &&
        value.cells.stonePrice === 'stone price' && value.cells.transportPrice === 'transport price' &&
        value.cells.clientPrice === 'client price' && value.cells.crusherReceipt === 'receipt status' &&
        value.cells.recipient === 'recipient status' && value.cells.clientReceiptNo === 'client receipt' &&
        value.cells.notes === 'notes' && value.cells.location === 'location' &&
        value.cells.fineAmount === 'fine' && value.cells.fineReason === 'reason' &&
        value.rowMessage === 'form'
    })
    runCase(
      'G10 cubic cells reject comma grouping while money accepts it',
      'comma-formatted values are invalid cubic cells and valid grouped money',
      () => {
        const inputs = ['1,250', '0,500', '22,500']
        return inputs.map((input) => ({
          cubic: tripGrid.parseNumberCell(input, { allowGrouping: false }),
          money: tripGrid.parseNumberCell(input, { money: true })
        }))
      },
      (actual) => {
        const values = result(actual)
        return (
          values?.length === 3 &&
          values.every(
            (entry) =>
              entry.cubic?.ok === false &&
              entry.money?.ok === true &&
              entry.money.value !== null
          ) &&
          values[0].money.value === 1250 &&
          values[1].money.value === 500 &&
          values[2].money.value === 22500
        )
      }
    )
    runCase(
      'G11 cubic warning threshold is above 150',
      '150 is not warned and values above 150 are warned',
      () => ({
        atLimit: tripGrid.isCubicQuantityHigh(150),
        aboveLimit: tripGrid.isCubicQuantityHigh(150.01)
      }),
      (actual) => result(actual)?.atLimit === false && result(actual)?.aboveLimit === true
    )
    runCase(
      'G12 paste ignores empty lines',
      'empty lines in the middle and trailing newline are omitted',
      () => tripGrid.parsePaste('a\tb\n\nc\td\n'),
      (actual) =>
        JSON.stringify(result(actual)) === JSON.stringify([
          ['a', 'b'],
          ['c', 'd']
        ])
    )
    runCase(
      'G13 names normalize Arabic variants and reject ambiguity',
      'plain alef resolves hamza alef; normalized collisions are ambiguous; unknown stays unresolved',
      () => ({
        match: tripGrid.resolveName('\u0627\u062d\u0645\u062f', [
          { id: 1, name: '\u0623\u062d\u0645\u062f' }
        ]),
        variants: tripGrid.resolveName('\u0645\u0648\u0633\u0649   \u0645\u062f\u0631\u0633\u0647', [
          { id: 2, name: '\u0645\u0648\u0633\u064a\u0651\u0640 \u0645\u062f\u0631\u0633\u0629' }
        ]),
        caseAndSpacing: tripGrid.resolveName('mixed   case', [
          { id: 6, name: 'MiXeD Case' }
        ]),
        ambiguous: tripGrid.resolveName('same name', [
          { id: 3, name: 'Same   Name' },
          { id: 4, name: 'same name' }
        ]),
        unknown: tripGrid.resolveName('missing', [{ id: 5, name: 'other' }])
      }),
      (actual) => {
        const value = result(actual)
        return (
          value?.match?.id === 1 &&
          value.variants?.id === 2 &&
          value.caseAndSpacing?.id === 6 &&
          value.ambiguous?.ambiguous === true &&
          value.unknown === null
        )
      }
    )
    runCase(
      'R locations omit empty stored values',
      'a trip with empty location is stored, but the location list omits the empty string',
      () => {
        const shift = createOwnShift()
        const trip = createTrip({ ...tripInput(shift.id), location: '' })
        if (!trip.ok) return { trip, locations: listTripLocations() }
        return {
          trip,
          storedLocation: db.prepare('SELECT location FROM Trip WHERE id = ?').get(trip.data.id)
            ?.location,
          locations: listTripLocations()
        }
      },
      (actual) => {
        const value = result(actual)
        return (
          value?.trip?.ok === true &&
          value.storedLocation === '' &&
          !value.locations.includes('')
        )
      }
    )
  }
  return runTripGridCases
}
