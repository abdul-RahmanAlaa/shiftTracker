/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  text,
  escapeRegExp,
  today,
  formItem,
  fillNumber,
  selectOption,
  selectToday,
  navigate,
  expectNoRawTranslationKeys,
  callApi,
  tripRow,
  testWithApp
} = require('./helpers.cjs')
const { format, parseISO } = require('date-fns')
const { arEG } = require('date-fns/locale')

function rowCell(row, index) {
  return row.locator('[data-slot="table-cell"]').nth(index)
}

testWithApp(
  'SD-1 OPEN shift summary and trips table match the saved shift',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
    await expect(page).toHaveURL(new RegExp(`/shifts/${seedData.shift.id}$`))
    await expectNoRawTranslationKeys(page)

    await expect(page.getByRole('heading', { name: seedData.shift.id, exact: true })).toBeVisible()
    await expect(page.getByText(seedData.driver.name, { exact: true })).toBeVisible()
    await expect(
      page.getByText(String(seedData.firstVehicle.vehicleNo), { exact: true })
    ).toBeVisible()
    await expect(page.getByText(text('shiftStatus.open'), { exact: true })).toBeVisible()
    await expect(tripRow(page, seedData.trip.id)).toBeVisible()
    await expect(page.getByText(text('shifts.shiftInfo.number'), { exact: true })).toBeVisible()

    await page.reload()
    await expect(tripRow(page, seedData.trip.id)).toBeVisible()
    await expect(page.getByText(seedData.driver.name, { exact: true })).toBeVisible()
  }
)

testWithApp('SD-2 edit dialog hydrates every saved trip field', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)
  await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
  await expectNoRawTranslationKeys(page)

  const result = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('Could not read the saved trip for edit hydration')
  const saved = result.data.find((trip) => trip.id === seedData.trip.id)
  expect(saved).toBeTruthy()
  if (!saved) throw new Error('Seeded trip was not returned by listTripsByShift')

  await tripRow(page, saved.id)
    .getByRole('button', { name: text('common.edit'), exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  const dateButton = formItem(dialog, 'tripForm.fields.tripDate').getByRole('button')
  await expect(dateButton).toHaveText(format(parseISO(saved.tripDate), 'PPP', { locale: arEG }))

  for (const [field, value] of [
    ['crusherCubic', saved.crusherCubic],
    ['clientCubic', saved.clientCubicReported],
    ['fineAmount', saved.fineAmount],
    ['stonePrice', saved.stonePrice],
    ['transportPrice', saved.transportPrice],
    ['clientPrice', saved.clientPrice]
  ]) {
    const key = field === 'clientCubic' ? 'tripForm.fields.clientCubic' : `tripForm.fields.${field}`
    await expect(formItem(dialog, key).getByRole('spinbutton')).toHaveValue(String(value))
  }

  for (const [key, value] of [
    ['tripForm.fields.fineReason', saved.fineReason ?? ''],
    ['tripForm.fields.clientReceiptNumber', saved.clientReceiptNo ?? ''],
    ['common.columns.notes', saved.notes ?? '']
  ]) {
    await expect(formItem(dialog, key).getByRole('textbox')).toHaveValue(value)
  }
  await expect(
    dialog
      .locator('label')
      .filter({ hasText: text('tripForm.fields.recipientName') })
      .last()
      .locator('xpath=..')
      .getByRole('textbox')
  ).toHaveValue(saved.recipientName ?? '')

  for (const [key, value] of [
    ['tripForm.fields.crusher', seedData.crusher.name],
    ['tripForm.fields.client', seedData.client.name],
    ['tripForm.fields.materialType', seedData.materialType.name],
    ['tripForm.fields.crusherReceiptStatus', text('tripForm.receiptStatuses.value')],
    ['tripForm.fields.recipientNameStatus', text('tripForm.receiptStatuses.value')]
  ]) {
    const combobox = dialog.getByRole('combobox', {
      name: new RegExp(`^${escapeRegExp(text(key))}(?:\\s+\\*)?$`)
    })
    await expect(combobox).toContainText(value)
  }
  await expect(
    formItem(dialog, 'tripForm.fields.crusherReceiptNumber').getByRole('spinbutton')
  ).toHaveValue(String(saved.crusherReceiptNo))

  await dialog.getByRole('button', { name: text('common.close'), exact: true }).click()
  await expect(dialog).toBeHidden()
})

testWithApp('SD-3 save an edit updates row values and persists the trip', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)
  await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
  await expectNoRawTranslationKeys(page)

  await tripRow(page, seedData.trip.id)
    .getByRole('button', { name: text('common.edit'), exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await formItem(dialog, 'tripForm.fields.clientCubic').getByRole('spinbutton').fill('4')
  await formItem(dialog, 'tripForm.fields.clientPrice').getByRole('spinbutton').fill('25')
  await dialog.getByRole('button', { name: text('tripForm.submit'), exact: true }).click()
  await expect(dialog).toBeHidden()

  const editedRow = tripRow(page, seedData.trip.id)
  await expect(rowCell(editedRow, 4)).toHaveText('4')
  await expect(rowCell(editedRow, 5)).toHaveText('25.00')
  await page.reload()
  await expectNoRawTranslationKeys(page)
  const reloadedRow = tripRow(page, seedData.trip.id)
  await expect(rowCell(reloadedRow, 4)).toHaveText('4')
  await expect(rowCell(reloadedRow, 5)).toHaveText('25.00')
  const result = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('Could not verify the edited trip after reload')
  expect(result.data.find((trip) => trip.id === seedData.trip.id)).toMatchObject({
    clientCubicReported: 4,
    clientPrice: 25
  })
})

testWithApp('SD-4 edit validation preserves the saved trip', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)
  await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
  await expectNoRawTranslationKeys(page)

  const before = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
  expect(before.ok).toBe(true)
  if (!before.ok) throw new Error('Could not read the trip before validation')

  await tripRow(page, seedData.trip.id)
    .getByRole('button', { name: text('common.edit'), exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await formItem(dialog, 'tripForm.fields.clientCubic').getByRole('spinbutton').fill('')
  await dialog.getByRole('button', { name: text('tripForm.submit'), exact: true }).click()
  const clientCubic = formItem(dialog, 'tripForm.fields.clientCubic')
  await expect(clientCubic.getByRole('spinbutton')).toHaveAttribute('aria-invalid', 'true')
  await expect(clientCubic.locator('p.text-destructive')).toBeVisible()
  const after = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
  expect(after.ok).toBe(true)
  if (!after.ok) throw new Error('Could not read the trip after validation')
  expect(after.data).toEqual(before.data)

  await dialog.getByRole('button', { name: text('common.close'), exact: true }).click()
  await page.reload()
  await expect(tripRow(page, seedData.trip.id)).toBeVisible()
})

testWithApp(
  'SD-9 REOPENED shift accepts a trip through the full TripForm dialog',
  async ({ launchApp }) => {
    const app = await launchApp('reopened-shift')
    const { page, seedData } = app
    const note = `E2E SD-9 reopened trip ${seedData.suffix}`
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
    await expectNoRawTranslationKeys(page)
    await expect(page.getByText(text('shiftStatus.reopened'), { exact: true })).toBeVisible()

    await page.getByRole('button', { name: text('shifts.addTrip'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await selectToday(page, 'tripForm.fields.tripDate', 'tripForm.placeholders.tripDate')
    await fillNumber(page, 'tripForm.fields.crusherCubic', 2)
    await fillNumber(page, 'tripForm.fields.clientCubic', 3)
    await fillNumber(page, 'tripForm.fields.fineAmount', 0)
    await selectOption(page, 'tripForm.fields.crusher', seedData.crusher.name)
    await fillNumber(page, 'tripForm.fields.stonePrice', 12)
    await selectOption(
      page,
      'tripForm.fields.crusherReceiptStatus',
      text('tripForm.receiptStatuses.noReceiptConfirmed')
    )
    await selectOption(page, 'tripForm.fields.client', seedData.client.name)
    await selectOption(page, 'tripForm.fields.materialType', seedData.materialType.name)
    await fillNumber(page, 'tripForm.fields.transportPrice', 8)
    await fillNumber(page, 'tripForm.fields.clientPrice', 15)
    await formItem(dialog, 'common.columns.notes').getByRole('textbox').fill(note)
    await dialog.getByRole('button', { name: text('tripForm.submit'), exact: true }).click()
    await expect(dialog).toBeHidden()

    const result = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Could not verify the new REOPENED-shift trip')
    const created = result.data.find((trip) => trip.notes === note)
    expect(created).toBeTruthy()
    if (!created) throw new Error('The REOPENED-shift trip was not saved')
    await expect(tripRow(page, created.id)).toBeVisible()
    await page.reload()
    await expect(tripRow(page, created.id)).toBeVisible()
  }
)

testWithApp(
  'SD-10 trip details show every receipt and recipient status label',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const statuses = [
      { receipt: 'PROVIDED', recipient: 'PROVIDED' },
      { receipt: 'CONFIRMED_MISSING', recipient: 'UNCLEAR' },
      { receipt: 'UNKNOWN', recipient: 'UNCLEAR' }
    ]
    const createdTrips = []
    for (const [index, status] of statuses.entries()) {
      const result = await callApi(page, 'createTrip', {
        shiftId: seedData.shift.id,
        tripDate: today(),
        crusherCubic: 1,
        clientCubicReported: 1,
        fineAmount: 0,
        fineReason: '',
        location: '',
        crusherId: seedData.crusher.id,
        stonePrice: 12,
        crusherReceiptStatus: status.receipt,
        ...(status.receipt === 'PROVIDED' ? { crusherReceiptNo: 8801 + index } : {}),
        clientId: seedData.client.id,
        transportPrice: 8,
        clientPrice: 15,
        materialTypeId: seedData.materialType.id,
        recipientNameStatus: status.recipient,
        ...(status.recipient === 'PROVIDED'
          ? { recipientName: `E2E SD-10 Recipient ${index}` }
          : {}),
        clientReceiptNo: '',
        notes: `E2E SD-10 status ${index} ${seedData.suffix}`
      })
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error(`Could not create trip for status pair ${index}`)
      createdTrips.push({ id: result.data.id, ...status })
    }

    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
    await expectNoRawTranslationKeys(page)

    for (const [index, trip] of createdTrips.entries()) {
      const note = `E2E SD-10 status ${index} ${seedData.suffix}`
      const row = tripRow(page, trip.id)
      await row.getByRole('button', { name: text('common.details'), exact: true }).click()
      const details = page.locator('.react-draggable').filter({ hasText: note })
      await expect(details).toBeVisible()
      const statusValues = details.locator('dd')
      const receiptLabel =
        trip.receipt === 'PROVIDED'
          ? 'tripForm.receiptStatuses.value'
          : trip.receipt === 'CONFIRMED_MISSING'
            ? 'tripForm.receiptStatuses.noReceiptConfirmed'
            : 'tripForm.receiptStatuses.unknown'
      const recipientLabel =
        trip.recipient === 'PROVIDED'
          ? 'tripForm.receiptStatuses.value'
          : 'tripForm.recipientNameStatuses.unclear'
      for (const labelKey of [receiptLabel, recipientLabel]) {
        await expect(statusValues.getByText(text(labelKey), { exact: true })).toBeVisible()
      }
      await details
        .getByRole('button', { name: text('floatingWindow.closeAriaLabel'), exact: true })
        .click()
    }
  }
)

testWithApp('SD-11 breadcrumb returns to the shifts list', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)
  await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
  await expectNoRawTranslationKeys(page)
  await page
    .getByRole('navigation', { name: text('shifts.breadcrumb') })
    .getByRole('link', { name: text('shifts.title'), exact: true })
    .click()
  await expect(page).toHaveURL(/#\/shifts$/)
  await expect(page.getByRole('heading', { name: text('shifts.title') })).toBeVisible()
})
