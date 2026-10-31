/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  fs,
  text,
  formItem,
  fillNumber,
  selectOption,
  selectToday,
  selectTodayByPlaceholder,
  navigate,
  expectNoRawTranslationKeys,
  callApi,
  readDb,
  makeJpeg,
  tripRow,
  testWithApp
} = require('./helpers.cjs')
const path = require('node:path')

async function selectShiftInDialog(page, shiftId, driverName) {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').first().click()
  await page.getByRole('option', { name: `${shiftId} (${driverName})`, exact: true }).click()
  return dialog
}

async function uploadImage(page, button, filename) {
  const fileInput = button
    .locator('xpath=ancestor::div[.//input[@type="file"]][1]')
    .locator('input[type="file"]')
  await button.click()
  await fileInput.setInputFiles({
    name: filename,
    mimeType: 'image/jpeg',
    buffer: await makeJpeg(page, 192, 128)
  })
  const cropDialog = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('button', { name: text('receiptPhoto.save'), exact: true }) })
  const saveButton = cropDialog.getByRole('button', {
    name: text('receiptPhoto.save'),
    exact: true
  })
  await expect(saveButton).toBeEnabled()
  await saveButton.click()
  await expect(cropDialog).toBeHidden()
}

async function expectPreview(page, label) {
  const thumbnail = page.getByRole('button', {
    name: text('receiptPhoto.preview', { label }),
    exact: true
  })
  await thumbnail.scrollIntoViewIfNeeded()
  const image = page.getByRole('img', { name: label, exact: true })
  await expect(image).toBeVisible()
  await thumbnail.click()
  await expect(
    page.getByRole('img', {
      name: text('receiptPhoto.fullImageAlt', { label }),
      exact: true
    })
  ).toBeVisible()
}

testWithApp(
  'SH-3 duplicate driver on another vehicle is rejected on the driver field',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)

    await page.getByRole('button', { name: text('createShift.title'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await selectOption(page, 'createShift.fields.driver', seedData.driver.name)
    await selectOption(page, 'createShift.fields.vehicle', String(seedData.secondVehicle.vehicleNo))
    await fillNumber(page, 'createShift.fields.crusherCubic', 1)
    await fillNumber(page, 'createShift.fields.clientCubic', 1)
    await selectToday(page, 'createShift.fields.startDate', 'createShift.placeholders.startDate')
    await dialog.getByRole('button', { name: text('createShift.submit'), exact: true }).click()

    const driverField = formItem(dialog, 'createShift.fields.driver')
    await expect(driverField.locator('p.text-destructive')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.open')
    )
  }
)

testWithApp('SH-4 create-shift validation and blank dialog reset', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)

  await page.getByRole('button', { name: text('createShift.title'), exact: true }).click()
  let dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: text('createShift.submit'), exact: true }).click()
  for (const field of ['driver', 'vehicle', 'crusherCubic', 'clientCubic', 'startDate']) {
    await expect(
      formItem(dialog, `createShift.fields.${field}`).locator('p.text-destructive')
    ).toBeVisible()
  }

  await selectOption(page, 'createShift.fields.driver', seedData.driver.name)
  await selectOption(page, 'createShift.fields.vehicle', String(seedData.firstVehicle.vehicleNo))
  await fillNumber(page, 'createShift.fields.crusherCubic', 2)
  await fillNumber(page, 'createShift.fields.clientCubic', 3)
  await selectToday(page, 'createShift.fields.startDate', 'createShift.placeholders.startDate')
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: text('common.close'), exact: true }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('button', { name: text('createShift.title'), exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox').nth(0)).toContainText(
    text('createShift.placeholders.driver')
  )
  await expect(dialog.getByRole('combobox').nth(1)).toContainText(
    text('createShift.placeholders.vehicle')
  )
  await expect(
    formItem(dialog, 'createShift.fields.crusherCubic').getByRole('spinbutton')
  ).toHaveValue('0')
  await expect(
    formItem(dialog, 'createShift.fields.clientCubic').getByRole('spinbutton')
  ).toHaveValue('0')
  await expect(formItem(dialog, 'createShift.fields.startDate').getByRole('button')).toContainText(
    text('createShift.placeholders.startDate')
  )
})

testWithApp('SH-8 close is blocked without a closing sheet', async ({ launchApp }) => {
  const app = await launchApp('open-shift')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)

  await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
  const dialog = await selectShiftInDialog(page, seedData.shift.id, seedData.driver.name)
  await expect(dialog.getByText(text('shifts.closingPhotoRequired'), { exact: true })).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true })
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
    text('shiftStatus.open')
  )
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
    text('shiftStatus.open')
  )
})

testWithApp('SH-9 close is blocked when a trip has no attachment', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)

  const attachmentsResult = await callApi(page, 'listEntityAttachments', {
    entityType: 'TRIP',
    entityId: seedData.trip.id
  })
  expect(attachmentsResult.ok).toBe(true)
  if (!attachmentsResult.ok) throw new Error('Could not inspect seeded trip attachments')
  const receipt = attachmentsResult.data[0]
  expect(receipt).toBeTruthy()
  const removed = await callApi(page, 'removeAttachment', { id: receipt.id })
  expect(removed.ok).toBe(true)

  await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
  const dialog = await selectShiftInDialog(page, seedData.shift.id, seedData.driver.name)
  await expect(
    dialog.getByText(text('shifts.tripsMissingAttachments', { tripIds: seedData.trip.id }), {
      exact: true
    })
  ).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true })
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
    text('shiftStatus.open')
  )
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
    text('shiftStatus.open')
  )
})

testWithApp('SH-10 closing sheet uploads, persists, and previews', async ({ launchApp }) => {
  const app = await launchApp('open-shift')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)

  await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
  let dialog = await selectShiftInDialog(page, seedData.shift.id, seedData.driver.name)
  const label = text('receiptPhoto.labels.closingSheet')
  await uploadImage(
    page,
    dialog.getByRole('button', { name: text('receiptPhoto.addDocument') }),
    `E2E Closing ${seedData.suffix}.jpg`
  )
  await expectPreview(page, label)

  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: text('common.close'), exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.reload()
  await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
  dialog = await selectShiftInDialog(page, seedData.shift.id, seedData.driver.name)
  await expectPreview(page, label)
})

testWithApp('SH-11 reopening a CLOSED shift requires a reason', async ({ launchApp }) => {
  const app = await launchApp('closed-shift')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)

  await page.getByRole('button', { name: text('shifts.reopenCardTitle'), exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').click()
  await page
    .getByRole('option', {
      name: `${seedData.closedShift.id} (${seedData.driver.name})`,
      exact: true
    })
    .click()
  await expect(
    dialog.getByRole('button', { name: text('shifts.reopenSubmit'), exact: true })
  ).toBeDisabled()

  await dialog
    .getByPlaceholder(text('shifts.reopenReasonPlaceholder'), { exact: true })
    .fill(`E2E reopen ${seedData.suffix}`)
  await dialog.getByRole('button', { name: text('shifts.reopenSubmit'), exact: true }).click()
  await expect(dialog).toBeHidden()
  const row = page.getByRole('row').filter({ hasText: seedData.closedShift.id })
  await expect(row).toContainText(text('shiftStatus.reopened'))
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: seedData.closedShift.id })).toContainText(
    text('shiftStatus.reopened')
  )
})

testWithApp(
  'SH-12 re-closing after adding a trip stores the updated count',
  async ({ launchApp }) => {
    const app = await launchApp('closed-shift')
    const { page, seedData } = app
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)

    await page.getByRole('button', { name: text('shifts.reopenCardTitle'), exact: true }).click()
    let reopenDialog = page.getByRole('dialog')
    await reopenDialog.getByRole('combobox').click()
    await page
      .getByRole('option', {
        name: `${seedData.closedShift.id} (${seedData.driver.name})`,
        exact: true
      })
      .click()
    await reopenDialog
      .getByPlaceholder(text('shifts.reopenReasonPlaceholder'), { exact: true })
      .fill(`E2E re-close ${seedData.suffix}`)
    await reopenDialog
      .getByRole('button', { name: text('shifts.reopenSubmit'), exact: true })
      .click()
    await expect(reopenDialog).toBeHidden()

    const shiftRow = page.getByRole('row').filter({ hasText: seedData.closedShift.id })
    await shiftRow.click()
    await expect(page).toHaveURL(new RegExp(`/shifts/${seedData.closedShift.id}$`))
    await expectNoRawTranslationKeys(page)
    await page.getByRole('button', { name: text('shifts.addTrip'), exact: true }).click()
    const addDialog = page.getByRole('dialog')
    await selectToday(page, 'tripForm.fields.tripDate', 'tripForm.placeholders.tripDate')
    await fillNumber(page, 'tripForm.fields.crusherCubic', 3)
    await fillNumber(page, 'tripForm.fields.clientCubic', 3)
    await fillNumber(page, 'tripForm.fields.fineAmount', 0)
    await selectOption(page, 'tripForm.fields.crusher', seedData.crusher.name)
    await fillNumber(page, 'tripForm.fields.stonePrice', 12)
    await selectOption(page, 'tripForm.fields.client', seedData.client.name)
    await selectOption(page, 'tripForm.fields.materialType', seedData.materialType.name)
    await fillNumber(page, 'tripForm.fields.transportPrice', 8)
    await fillNumber(page, 'tripForm.fields.clientPrice', 15)
    await addDialog.getByRole('button', { name: text('tripForm.submit'), exact: true }).click()
    await expect(addDialog).toBeHidden()
    await expect(page.getByRole('row')).toHaveCount(4)

    const db = readDb(app)
    const addedTrip = db
      .prepare('SELECT id FROM Trip WHERE shift_id = ? ORDER BY id DESC LIMIT 1')
      .get(seedData.closedShift.id)
    db.close()
    expect(addedTrip).toBeTruthy()
    const addedTripRow = tripRow(page, addedTrip.id)
    const receiptLabel = text('receiptPhoto.labels.crusherReceipt')
    await uploadImage(
      page,
      addedTripRow.getByRole('button', {
        name: text('receiptPhoto.upload', { label: receiptLabel }),
        exact: true
      }),
      `E2E Reclose ${seedData.suffix}.jpg`
    )

    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
    const closeDialog = await selectShiftInDialog(
      page,
      seedData.closedShift.id,
      seedData.driver.name
    )
    await closeDialog.getByLabel(text('shifts.reportedTripCount')).fill('3')
    await expect(closeDialog.getByLabel(text('shifts.reportedTripCount'))).toHaveValue('3')
    await selectTodayByPlaceholder(page, 'shifts.closeDatePlaceholder')
    await closeDialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true }).click()
    await expect(closeDialog).toBeHidden()
    const closedRow = page.getByRole('row').filter({ hasText: seedData.closedShift.id })
    await expect(closedRow).toContainText(text('shiftStatus.closed'))
    await expect(closedRow.locator('[data-slot="table-cell"]').last()).toContainText('3')

    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: seedData.closedShift.id })).toContainText(
      text('shiftStatus.closed')
    )
    const persistedDb = readDb(app)
    const shift = persistedDb
      .prepare('SELECT reported_trip_count FROM Shift WHERE id = ?')
      .get(seedData.closedShift.id)
    persistedDb.close()
    expect(shift.reported_trip_count).toBe(3)
  }
)

testWithApp('SH-13 backup failure warns but the shift closes', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData, tempDirectory } = app
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)

  const backupsPath = path.join(tempDirectory, 'backups')
  const originalBackupsPath = path.join(tempDirectory, 'backups-before-test')
  await expect.poll(() => fs.existsSync(backupsPath)).toBe(true)
  fs.renameSync(backupsPath, originalBackupsPath)
  fs.writeFileSync(backupsPath, 'E2E blocking file')

  try {
    await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
    const dialog = await selectShiftInDialog(page, seedData.shift.id, seedData.driver.name)
    await selectTodayByPlaceholder(page, 'shifts.closeDatePlaceholder')
    await dialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('alert')).toContainText(text('shifts.closeBackupWarning'))
    await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )
  } finally {
    fs.rmSync(backupsPath, { force: true })
    fs.renameSync(originalBackupsPath, backupsPath)
  }
})

testWithApp(
  'SH-14 shift list shows its key fields and opens shift details',
  async ({ launchApp }) => {
    const app = await launchApp('two-shifts')
    const { page, seedData } = app
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)

    for (const headerKey of [
      'shifts.shiftInfo.number',
      'ledgerEntryForm.fields.driver',
      'vehiclesSettings.fields.vehicleNo',
      'shifts.columns.status',
      'shifts.columns.startDate',
      'shifts.columns.endDate',
      'shifts.columns.tripCount'
    ]) {
      await expect(page.getByRole('columnheader', { name: text(headerKey) })).toBeVisible()
    }
    const openRow = page.getByRole('row').filter({ hasText: seedData.shift.id })
    await expect(openRow).toContainText(seedData.driver.name)
    await expect(openRow).toContainText(String(seedData.firstVehicle.vehicleNo))
    await expect(openRow).toContainText(text('shiftStatus.open'))
    await expect(openRow.locator('[data-slot="table-cell"]').last()).toContainText('1')

    await openRow.click()
    await expect(page).toHaveURL(new RegExp(`/shifts/${seedData.shift.id}$`))
    await expect(page.getByRole('heading', { name: seedData.shift.id, exact: true })).toBeVisible()
  }
)
