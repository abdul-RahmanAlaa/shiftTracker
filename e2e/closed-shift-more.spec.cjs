/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  text,
  today,
  fillGridRow,
  navigate,
  expectNoRawTranslationKeys,
  pickDriverOnAddTrip,
  selectTodayByPlaceholder,
  callApi,
  closeShiftViaApi,
  relaunchApp,
  allTripsRow,
  tripRow,
  makeJpeg,
  readDb,
  testWithApp
} = require('./helpers.cjs')

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

async function expectPreview(page, scope, label) {
  await scope.getByRole('heading', { name: label, exact: true }).scrollIntoViewIfNeeded()
  const image = scope.getByRole('img', { name: label, exact: true })
  await expect(image).toBeVisible()
  const thumbnail = scope.getByRole('button', {
    name: text('receiptPhoto.preview', { label }),
    exact: true
  })
  await expect(thumbnail).toBeVisible()
  await thumbnail.scrollIntoViewIfNeeded()
  await thumbnail.click()
  await expect(
    page
      .getByRole('dialog')
      .last()
      .getByRole('img', {
        name: text('receiptPhoto.fullImageAlt', { label }),
        exact: true
      })
  ).toBeVisible()
  await page.keyboard.press('Escape')
}

async function expectReadOnlyAttachmentManager(scope, label) {
  await expect(scope.getByRole('button', { name: text('common.delete'), exact: true })).toHaveCount(
    0
  )
  await expect(
    scope.getByRole('button', {
      name: text('receiptPhoto.upload', { label }),
      exact: true
    })
  ).toHaveCount(0)
}

testWithApp(
  'ATT-6 CLOSED trip attachments are read-only and previewable in each details view',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
    await expect(page).toHaveURL(new RegExp(`/shifts/${seedData.shift.id}$`))
    await expectNoRawTranslationKeys(page)

    const receiptLabel = text('receiptPhoto.labels.clientReceipt')
    const detailsTripRow = tripRow(page, seedData.trip.id)
    await uploadImage(
      page,
      detailsTripRow.getByRole('button', {
        name: text('receiptPhoto.upload', { label: receiptLabel }),
        exact: true
      }),
      `E2E Closed receipt ${seedData.suffix}.jpg`
    )

    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
    const closeDialog = await selectShiftInDialog(page, seedData.shift.id, seedData.driver.name)
    await selectTodayByPlaceholder(page, 'shifts.closeDatePlaceholder')
    await closeDialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true }).click()
    await expect(closeDialog).toBeHidden()
    await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )

    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
    const closedTripRow = tripRow(page, seedData.trip.id)
    await closedTripRow.scrollIntoViewIfNeeded()
    await expectReadOnlyAttachmentManager(closedTripRow, receiptLabel)
    await expectPreview(page, closedTripRow, receiptLabel)

    await closedTripRow.getByRole('button', { name: text('common.details'), exact: true }).click()
    const shiftDetailsWindow = page
      .locator('.react-draggable')
      .filter({ hasText: text('allTrips.detailsTitle', { id: seedData.trip.id }) })
      .first()
    await expect(shiftDetailsWindow).toBeVisible()
    await expectReadOnlyAttachmentManager(shiftDetailsWindow, receiptLabel)
    await expectPreview(page, shiftDetailsWindow, receiptLabel)
    await shiftDetailsWindow
      .getByRole('button', { name: text('floatingWindow.closeAriaLabel'), exact: true })
      .click()

    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    const allTripsTrip = allTripsRow(page, seedData.driver.name)
    await allTripsTrip.getByRole('button', { name: text('common.details'), exact: true }).click()
    const allTripsDetailsWindow = page
      .locator('.react-draggable')
      .filter({ hasText: text('allTrips.detailsTitle', { id: seedData.trip.id }) })
      .last()
    await expect(allTripsDetailsWindow).toBeVisible()
    await expectReadOnlyAttachmentManager(allTripsDetailsWindow, receiptLabel)
    await expectPreview(page, allTripsDetailsWindow, receiptLabel)
  }
)

testWithApp(
  'ATT-8 a stale close dialog reports rejected attachment changes',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
    const dialog = await selectShiftInDialog(page, seedData.shift.id, seedData.driver.name)
    const before = await callApi(page, 'listEntityAttachments', {
      entityType: 'SHIFT',
      entityId: seedData.shift.id
    })
    expect(before.ok).toBe(true)
    if (!before.ok) throw new Error('Could not inspect closing-sheet attachments before close')

    await closeShiftViaApi(page, seedData.shift.id)
    const addButton = dialog.getByRole('button', {
      name: text('receiptPhoto.addDocument'),
      exact: true
    })
    const fileInput = addButton
      .locator('xpath=ancestor::div[.//input[@type="file"]][1]')
      .locator('input[type="file"]')
    await addButton.click()
    await fileInput.setInputFiles({
      name: `E2E Stale closing sheet ${seedData.suffix}.jpg`,
      mimeType: 'image/jpeg',
      buffer: await makeJpeg(page, 192, 128)
    })
    const cropDialog = page.getByRole('dialog').last()
    const saveButton = cropDialog.getByRole('button', {
      name: text('receiptPhoto.save'),
      exact: true
    })
    await expect(saveButton).toBeEnabled()
    await saveButton.click()
    await expect(cropDialog.locator('.text-destructive').filter({ hasText: /\S/ })).toBeVisible()
    const after = await callApi(page, 'listEntityAttachments', {
      entityType: 'SHIFT',
      entityId: seedData.shift.id
    })
    expect(after.ok).toBe(true)
    if (!after.ok) throw new Error('Could not inspect closing-sheet attachments after rejection')
    expect(after.data).toEqual(before.data)
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )
  }
)

testWithApp('RT-2 created trip data persists across app restart', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/', 'addTrip.title')
  await expectNoRawTranslationKeys(page)
  await pickDriverOnAddTrip(page, seedData.driver.name)
  const note = `E2E Restart ${seedData.suffix}`
  await fillGridRow(page, {
    tripDate: today(),
    client: seedData.client.name,
    crusher: seedData.crusher.name,
    materialType: seedData.materialType.name,
    clientCubic: 2,
    crusherCubic: 2,
    stonePrice: 12,
    transportPrice: 8,
    clientPrice: 15,
    notes: note
  })
  await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).click()
  await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))

  const database = readDb(app)
  const createdTrip = database.prepare('SELECT id FROM Trip WHERE notes = ?').get(note)
  database.close()
  expect(createdTrip).toBeTruthy()

  const expectCreatedTripListed = async (targetPage) => {
    const row = allTripsRow(targetPage, seedData.driver.name).filter({
      has: targetPage.getByRole('cell', { name: '2', exact: true })
    })
    await expect(row).toHaveCount(1)
    await row.getByRole('button', { name: text('common.details'), exact: true }).click()
    const details = targetPage
      .locator('.react-draggable')
      .filter({ hasText: text('allTrips.detailsTitle', { id: createdTrip.id }) })
    await expect(details).toBeVisible()
    await details
      .getByRole('button', { name: text('floatingWindow.closeAriaLabel'), exact: true })
      .click()
  }

  await page.reload()
  await navigate(page, '/all-trips', 'allTrips.title')
  await expectNoRawTranslationKeys(page)
  await expectCreatedTripListed(page)
  await relaunchApp(app)
  await expect(app.page.getByRole('heading', { name: text('addTrip.title') })).toBeVisible()
  await navigate(app.page, '/all-trips', 'allTrips.title')
  await expectNoRawTranslationKeys(app.page)
  await expectCreatedTripListed(app.page)
})

testWithApp(
  'RT-3 CLOSED status and trip lock persist across app restart',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
    const dialog = await selectShiftInDialog(page, seedData.shift.id, seedData.driver.name)
    await selectTodayByPlaceholder(page, 'shifts.closeDatePlaceholder')
    await dialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )

    await relaunchApp(app)
    await expectNoRawTranslationKeys(app.page)
    await navigate(app.page, '/shifts', 'shifts.title')
    await expect(app.page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )
    await navigate(app.page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(app.page)
    const closedTrip = allTripsRow(app.page, seedData.driver.name)
    await expect(closedTrip.getByText(text('common.lockedShift'), { exact: true })).toBeVisible()
    await expect(
      closedTrip.getByRole('button', { name: text('common.delete'), exact: true })
    ).toHaveCount(0)
  }
)
