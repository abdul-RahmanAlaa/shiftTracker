/* eslint-disable @typescript-eslint/explicit-function-return-type, @typescript-eslint/no-require-imports, no-unused-vars */
module.exports = async function runDraftTripCustodyCases(context) {
  const {
    db,
    runCase,
    result,
    createOwnShift,
    tripInput,
    createDraftTrip,
    updateDraftTrip,
    listDraftTrips,
    deleteDraftTrip,
    promoteDraftTrip,
    closeShift,
    createLedger,
    addAttachment,
    listEntityAttachments,
    removeAttachment,
    deleteLedgerEntry,
    getOpenShiftCards,
    addClosingSheet,
    fs,
    path,
    harnessUserData,
    driverId,
    contractorId
  } = context

  runCase(
    'D1 draft list joins driver and OPEN shift',
    'created draft has driver_name and shift_id from its vehicle OPEN shift',
    () => {
      const shift = createOwnShift()
      const created = createDraftTrip({ vehicleNo: shift.vehicleNo, tripDate: '2026-02-01' })
      const listed = listDraftTrips()
      const draft = created.ok ? listed.data.find((row) => row.id === created.data.id) : undefined
      return {
        created,
        driverName: db.prepare('SELECT name FROM Driver WHERE id = ?').get(shift.driverId)?.name,
        draft
      }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.created?.ok === true &&
        value.draft?.driver_name === value.driverName &&
        value.draft?.shift_id !== null
      )
    }
  )

  runCase(
    'D2 draft validation returns Arabic messages',
    'invalid draft fields return readable messages rather than raw uppercase codes',
    () => {
      const shift = createOwnShift()
      const valid = { vehicleNo: shift.vehicleNo, tripDate: '2026-02-01' }
      const responses = [
        createDraftTrip({ ...valid, vehicleNo: 0 }),
        createDraftTrip({ ...valid, timeOfDay: 'NOON' }),
        createDraftTrip({ ...valid, crusherId: 0 }),
        createDraftTrip({ ...valid, clientId: 0 }),
        createDraftTrip({ ...valid, cubic: -1 }),
        createDraftTrip({ ...valid, custodyAmount: 1.5 }),
        createDraftTrip({ ...valid, custodyDate: '2026-02-31' }),
        createDraftTrip({ ...valid, custodyTime: '24:00' })
      ]
      const errors = responses.flatMap((response) =>
        response.ok ? [] : response.errors.map((error) => error.message)
      )
      return { responses, errors }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.responses.length === 8 &&
        value.responses.every((response) => response.ok === false) &&
        value.errors.length >= 8 &&
        value.errors.every((message) => !/^[A-Z_]+$/.test(message))
      )
    }
  )

  runCase(
    'D11 omitted custody date preserves while null clears',
    'update distinguishes an omitted custody date from an explicit clear',
    () => {
      const shift = createOwnShift()
      const draft = createDraftTrip({
        vehicleNo: shift.vehicleNo,
        tripDate: '2026-02-01',
        custodyAmount: 50,
        custodyDate: '2026-02-02'
      })
      if (!draft.ok) return { draft }
      const common = {
        id: draft.data.id,
        tripDate: '2026-02-01',
        timeOfDay: null,
        crusherId: null,
        clientId: null,
        cubic: null,
        custodyAmount: 50,
        custodyTime: null,
        receiptNote: null,
        notes: null
      }
      const preserved = updateDraftTrip(common)
      const afterPreserve = db
        .prepare('SELECT custody_date AS custodyDate FROM DraftTrip WHERE id = ?')
        .get(draft.data.id)?.custodyDate
      const cleared = updateDraftTrip({ ...common, custodyDate: null })
      const afterClear = db
        .prepare('SELECT custody_date AS custodyDate FROM DraftTrip WHERE id = ?')
        .get(draft.data.id)?.custodyDate
      return { preserved, afterPreserve, cleared, afterClear }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.preserved?.ok === true &&
        value.afterPreserve === '2026-02-02' &&
        value.cleared?.ok === true &&
        value.afterClear === null
      )
    }
  )

  runCase(
    'D3 rejected trip promotion is atomic',
    'failed trip validation keeps the draft and writes neither trip nor ledger',
    () => {
      const shift = createOwnShift()
      const draft = createDraftTrip({
        vehicleNo: shift.vehicleNo,
        tripDate: '2026-02-01',
        custodyAmount: 125
      })
      if (!draft.ok) return { draft }
      const tripCount = db.prepare('SELECT COUNT(*) AS count FROM Trip').get().count
      const ledgerCount = db.prepare('SELECT COUNT(*) AS count FROM Ledger').get().count
      const response = promoteDraftTrip({
        ...tripInput(shift.id),
        draftId: draft.data.id,
        crusherCubic: 0
      })
      return {
        response,
        draftExists:
          db.prepare('SELECT 1 FROM DraftTrip WHERE id = ?').get(draft.data.id) !== undefined,
        tripCountUnchanged:
          db.prepare('SELECT COUNT(*) AS count FROM Trip').get().count === tripCount,
        ledgerCountUnchanged:
          db.prepare('SELECT COUNT(*) AS count FROM Ledger').get().count === ledgerCount
      }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.response?.ok === false &&
        value.draftExists &&
        value.tripCountUnchanged &&
        value.ledgerCountUnchanged
      )
    }
  )

  runCase(
    'D4 promotion carries draft time of day',
    'successful promotion creates timed Trip and removes DraftTrip',
    () => {
      const shift = createOwnShift()
      const draft = createDraftTrip({
        vehicleNo: shift.vehicleNo,
        tripDate: '2026-02-01',
        timeOfDay: 'MORNING'
      })
      if (!draft.ok) return { draft }
      const response = promoteDraftTrip({ ...tripInput(shift.id), draftId: draft.data.id })
      const trip = response.ok
        ? db
            .prepare('SELECT time_of_day AS timeOfDay FROM Trip WHERE id = ?')
            .get(response.data.tripId)
        : undefined
      return {
        response,
        trip,
        draftExists:
          db.prepare('SELECT 1 FROM DraftTrip WHERE id = ?').get(draft.data.id) !== undefined
      }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.response?.ok === true &&
        value.response.data.ledgerId === null &&
        value.trip?.timeOfDay === 'MORNING' &&
        !value.draftExists
      )
    }
  )

  runCase(
    'D5 promotion creates draft custody advance',
    'ledger stores custody date/time, shift parties, and amount in minor units',
    () => {
      const shift = createOwnShift()
      const draft = createDraftTrip({
        vehicleNo: shift.vehicleNo,
        tripDate: '2026-02-02',
        custodyAmount: 123,
        custodyDate: '2026-02-03',
        custodyTime: '14:25'
      })
      if (!draft.ok) return { draft }
      const response = promoteDraftTrip({ ...tripInput(shift.id), draftId: draft.data.id })
      const ledger =
        response.ok && response.data.ledgerId !== null
          ? db
              .prepare(
                `SELECT entry_date AS entryDate, entry_time AS entryTime, driver_id AS driverId,
                        movement_type AS movementType, amount, shift_id AS shiftId,
                        contractor_id AS contractorId
                 FROM Ledger WHERE id = ?`
              )
              .get(response.data.ledgerId)
          : undefined
      return { response, ledger, shift }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.response?.ok === true &&
        value.ledger?.entryDate === '2026-02-03' &&
        value.ledger?.entryTime === '14:25' &&
        value.ledger?.driverId === value.shift.driverId &&
        value.ledger?.movementType === 'ADVANCE' &&
        value.ledger?.amount === 12300 &&
        value.ledger?.shiftId === value.shift.id &&
        value.ledger?.contractorId === contractorId
      )
    }
  )

  runCase(
    'D6 explicit null custody suppresses draft advance',
    'promotion with custody null creates no ledger entry',
    () => {
      const shift = createOwnShift()
      const draft = createDraftTrip({
        vehicleNo: shift.vehicleNo,
        tripDate: '2026-02-04',
        custodyAmount: 200
      })
      if (!draft.ok) return { draft }
      const before = db.prepare('SELECT COUNT(*) AS count FROM Ledger').get().count
      const response = promoteDraftTrip({
        ...tripInput(shift.id),
        draftId: draft.data.id,
        custody: null
      })
      const after = db.prepare('SELECT COUNT(*) AS count FROM Ledger').get().count
      return { response, before, after }
    },
    (actual) => {
      const value = result(actual)
      return value?.response?.ok === true && value.before === value.after
    }
  )

  runCase(
    'D7 ledger insert failure rolls promotion back',
    'failed ledger step removes new Trip and preserves DraftTrip',
    () => {
      const shift = createOwnShift()
      const draft = createDraftTrip({
        vehicleNo: shift.vehicleNo,
        tripDate: '2026-02-05'
      })
      if (!draft.ok) return { draft }
      const tripCount = db.prepare('SELECT COUNT(*) AS count FROM Trip').get().count
      const ledgerCount = db.prepare('SELECT COUNT(*) AS count FROM Ledger').get().count
      db.exec(
        `CREATE TRIGGER reject_promotion_ledger
         BEFORE INSERT ON Ledger
         BEGIN SELECT RAISE(FAIL, 'test ledger failure'); END;`
      )
      let response
      try {
        response = promoteDraftTrip({
          ...tripInput(shift.id),
          draftId: draft.data.id,
          custody: { entryDate: '2026-02-05', amount: 100 }
        })
      } finally {
        db.exec('DROP TRIGGER IF EXISTS reject_promotion_ledger')
      }
      return {
        response,
        draftExists:
          db.prepare('SELECT 1 FROM DraftTrip WHERE id = ?').get(draft.data.id) !== undefined,
        tripCountUnchanged:
          db.prepare('SELECT COUNT(*) AS count FROM Trip').get().count === tripCount,
        ledgerCountUnchanged:
          db.prepare('SELECT COUNT(*) AS count FROM Ledger').get().count === ledgerCount
      }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.response?.ok === false &&
        value.response.errors.every((error) => !/^[A-Z_]+$/.test(error.message)) &&
        value.draftExists &&
        value.tripCountUnchanged &&
        value.ledgerCountUnchanged
      )
    }
  )

  await context.runAsyncCase(
    'D8 close shift waits for vehicle drafts',
    'draft prevents close; removing it allows close',
    async () => {
      const shift = createOwnShift()
      const draft = createDraftTrip({ vehicleNo: shift.vehicleNo, tripDate: '2026-02-06' })
      if (!draft.ok) return { draft }
      addClosingSheet(shift.id, 'draft-guard-' + shift.id + '.jpg')
      const blocked = await closeShift({
        shiftId: shift.id,
        endDate: '2026-02-07',
        reportedTripCount: 0
      })
      const statusWhileBlocked = db
        .prepare('SELECT status FROM Shift WHERE id = ?')
        .get(shift.id)?.status
      deleteDraftTrip({ id: draft.data.id })
      const closed = await closeShift({
        shiftId: shift.id,
        endDate: '2026-02-07',
        reportedTripCount: 0
      })
      return { blocked, statusWhileBlocked, closed }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.blocked?.ok === false &&
        value.blocked.errors[0]?.message.includes('1 مسودة') &&
        value.statusWhileBlocked === 'OPEN' &&
        value.closed?.ok === true
      )
    }
  )

  runCase(
    'D9 ledger transfer attachments add, remove, and cascade on delete',
    'attachment is listed and file/row are removed by attachment and ledger deletion',
    () => {
      const shift = createOwnShift()
      const firstLedger = createLedger({
        driverId: shift.driverId,
        shiftId: shift.id,
        contractorId: null
      })
      if (!firstLedger.ok) return { firstLedger }
      const imageBase64 = Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00]).toString('base64')
      const first = addAttachment({
        entityType: 'LEDGER',
        entityId: String(firstLedger.data.id),
        kind: 'TRANSFER_RECEIPT',
        imageBase64
      })
      if (!first.ok) return { firstLedger, first }
      const listed = listEntityAttachments({
        entityType: 'LEDGER',
        entityId: String(firstLedger.data.id)
      })
      const firstFile = path.join(harnessUserData, first.data.path)
      const removed = removeAttachment({ id: first.data.id })
      const firstFileRemoved = !fs.existsSync(firstFile)

      const secondLedger = createLedger({
        driverId: shift.driverId,
        shiftId: shift.id,
        contractorId: null
      })
      if (!secondLedger.ok)
        return { firstLedger, first, listed, removed, firstFileRemoved, secondLedger }
      const second = addAttachment({
        entityType: 'LEDGER',
        entityId: String(secondLedger.data.id),
        kind: 'TRANSFER_RECEIPT',
        imageBase64
      })
      if (!second.ok)
        return { firstLedger, first, listed, removed, firstFileRemoved, secondLedger, second }
      const secondFile = path.join(harnessUserData, second.data.path)
      const deleted = deleteLedgerEntry({ id: secondLedger.data.id })
      const secondAttachment = db
        .prepare('SELECT id FROM Attachment WHERE id = ?')
        .get(second.data.id)
      return {
        first,
        listed,
        removed,
        firstFileRemoved,
        deleted,
        secondAttachment,
        secondFileRemoved: !fs.existsSync(secondFile)
      }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.first?.ok === true &&
        value.listed?.ok === true &&
        value.listed.data.length === 1 &&
        value.listed.data[0].kind === 'TRANSFER_RECEIPT' &&
        value.removed?.ok === true &&
        value.firstFileRemoved &&
        value.deleted?.ok === true &&
        value.secondAttachment === undefined &&
        value.secondFileRemoved
      )
    }
  )

  runCase(
    'D10 dashboard selects deterministic last custody',
    'latest date/time/id custody row supplies amount, date, and time',
    () => {
      const shift = createOwnShift()
      const insert = db.prepare(
        `INSERT INTO Ledger
          (entry_date, entry_time, driver_id, movement_type, amount, shift_id, contractor_id)
         VALUES (?, ?, ?, 'ADVANCE', ?, ?, ?)`
      )
      insert.run('2099-12-31', '09:00', shift.driverId, 10000, shift.id, contractorId)
      insert.run('2099-12-31', '09:00', shift.driverId, 30000, shift.id, contractorId)
      insert.run('2099-12-31', null, shift.driverId, 40000, shift.id, contractorId)
      const card = getOpenShiftCards(db).find((row) => row.shift_id === shift.id)
      return { card }
    },
    (actual) => {
      const value = result(actual)
      return (
        value?.card?.last_custody_amount === 30000 &&
        value.card.last_custody_date === '2099-12-31' &&
        value.card.last_custody_time === '09:00'
      )
    }
  )
}
