/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  fs,
  text,
  navigate,
  expectNoRawTranslationKeys,
  nextDialog,
  expectNotice,
  callApi,
  readDb,
  allTripsRow,
  testWithApp
} = require('./helpers.cjs')
const path = require('node:path')

function dataRows(page) {
  return page.locator('tbody tr')
}

testWithApp(
  'AT-1 All Trips sorts ascending and descending by vehicle number',
  async ({ launchApp }) => {
    const app = await launchApp('two-shifts')
    const { page, seedData } = app
    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)

    const rowVehicles = () =>
      dataRows(page).evaluateAll((rows) =>
        rows.map((row) => Number(row.querySelectorAll('[data-slot="table-cell"]')[3]?.textContent))
      )
    const header = page.getByRole('button', { name: text('vehiclesSettings.fields.vehicleNo') })
    await header.click()
    await page.getByRole('button', { name: text('dataTable.sortAscending'), exact: true }).click()
    await expect
      .poll(rowVehicles)
      .toEqual([seedData.firstVehicle.vehicleNo, seedData.secondVehicle.vehicleNo])

    await expect(
      page.getByRole('button', { name: text('dataTable.sortDescending'), exact: true })
    ).toBeVisible()
    await page.getByRole('button', { name: text('dataTable.sortDescending'), exact: true }).click()
    await expect
      .poll(rowVehicles)
      .toEqual([seedData.secondVehicle.vehicleNo, seedData.firstVehicle.vehicleNo])
  }
)

testWithApp('AT-2 All Trips filters by driver and clears the filter', async ({ launchApp }) => {
  const app = await launchApp('two-shifts')
  const { page, seedData } = app
  await navigate(page, '/all-trips', 'allTrips.title')
  await expectNoRawTranslationKeys(page)

  await page.getByRole('button', { name: text('ledgerEntryForm.fields.driver') }).click()
  await page.getByRole('option', { name: seedData.driver.name, exact: true }).click()
  await expect(dataRows(page)).toHaveCount(1)
  await expect(allTripsRow(page, seedData.driver.name)).toBeVisible()
  await expect(allTripsRow(page, seedData.secondDriver.name)).toHaveCount(0)

  await page.getByRole('button', { name: text('dataTable.clearFilter'), exact: true }).click()
  await expect(dataRows(page)).toHaveCount(2)
  await expect(allTripsRow(page, seedData.driver.name)).toBeVisible()
  await expect(allTripsRow(page, seedData.secondDriver.name)).toBeVisible()
})

testWithApp(
  'AT-3 selected-row sum equals the selected client cubic inputs',
  async ({ launchApp }) => {
    const app = await launchApp('two-shifts')
    const { page, seedData } = app
    const openResult = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    const closedResult = await callApi(page, 'listTripsByShift', {
      shiftId: seedData.closedShift.id
    })
    expect(openResult.ok).toBe(true)
    expect(closedResult.ok).toBe(true)
    if (!openResult.ok || !closedResult.ok) throw new Error('Could not load selected-sum inputs')
    const selectedTrips = [openResult.data[0], closedResult.data[0]]
    expect(selectedTrips.every(Boolean)).toBe(true)
    const expectedSum = selectedTrips.reduce(
      (sum, trip) => sum + (trip?.clientCubicReported ?? 0),
      0
    )
    const formattedSum = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(
      expectedSum
    )

    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    for (const [index, trip] of selectedTrips.entries()) {
      if (!trip) throw new Error('A selected-sum trip was missing from its shift')
      const driverName = index === 0 ? seedData.driver.name : seedData.secondDriver.name
      await allTripsRow(page, driverName)
        .getByRole('checkbox', { name: text('dataTable.selectRow'), exact: true })
        .check()
    }
    await expect(
      page.getByText(text('dataTable.selectedRows', { count: selectedTrips.length }), {
        exact: true
      })
    ).toBeVisible()
    await expect(
      page.getByText(text('dataTable.total', { sum: formattedSum }), { exact: true })
    ).toBeVisible()
  }
)

testWithApp('AT-4 All Trips details reuse the existing trip window', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/all-trips', 'allTrips.title')
  await expectNoRawTranslationKeys(page)

  const row = allTripsRow(page, seedData.driver.name)
  const detailsButton = row.getByRole('button', { name: text('common.details'), exact: true })
  await detailsButton.click()
  const window = page.locator('.react-draggable').filter({ hasText: seedData.trip.id })
  await expect(window).toBeVisible()
  await window.locator('.floating-window-titlebar').dragTo(page.locator('body'), {
    targetPosition: { x: 1100, y: 30 }
  })
  await detailsButton.click()
  await expect(page.locator('.react-draggable')).toHaveCount(1)
  await window
    .getByRole('button', { name: text('floatingWindow.minimizeAriaLabel'), exact: true })
    .click()
  await expect(window).toBeHidden()
  await detailsButton.click()
  await expect(page.locator('.react-draggable')).toHaveCount(1)
  await expect(window).toBeVisible()
  await expect(window.getByText(seedData.trip.id, { exact: true })).toBeVisible()
})

testWithApp(
  'AT-11 deleting an attached OPEN-shift trip removes its file and database row',
  async ({ launchApp }) => {
    const app = await launchApp('two-shifts')
    const { page, seedData } = app
    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)

    const attachments = await callApi(page, 'listEntityAttachments', {
      entityType: 'TRIP',
      entityId: seedData.trip.id
    })
    expect(attachments.ok).toBe(true)
    if (!attachments.ok) throw new Error('Could not read the trip attachment before deletion')
    expect(attachments.data).toHaveLength(1)
    const attachment = attachments.data[0]
    const attachmentFile = path.join(app.tempDirectory, attachment.photoPath)
    expect(fs.existsSync(attachmentFile)).toBe(true)

    const row = allTripsRow(page, seedData.driver.name)
    const dialogPromise = nextDialog(page, 'accept')
    await row.getByRole('button', { name: text('common.delete'), exact: true }).click()
    expect(await dialogPromise).toBe(
      text('allTrips.deleteTripConfirmation', { id: seedData.trip.id })
    )
    await expectNotice(page, 'ipcErrors.tripDeleted')
    await expect(row).toHaveCount(0)
    await expect(allTripsRow(page, seedData.secondDriver.name)).toBeVisible()

    expect(fs.existsSync(attachmentFile)).toBe(false)
    const database = readDb(app)
    const databaseAttachment = database
      .prepare('SELECT id FROM Attachment WHERE id = ?')
      .get(attachment.id)
    const databaseTrip = database.prepare('SELECT id FROM Trip WHERE id = ?').get(seedData.trip.id)
    database.close()
    expect(databaseAttachment).toBeUndefined()
    expect(databaseTrip).toBeUndefined()

    await page.reload()
    await expect(allTripsRow(page, seedData.driver.name)).toHaveCount(0)
    await expect(allTripsRow(page, seedData.secondDriver.name)).toBeVisible()
  }
)

testWithApp('AT-12 All Trips shows the empty state when no trips exist', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const { page } = app
  await navigate(page, '/all-trips', 'allTrips.title')
  await expectNoRawTranslationKeys(page)
  await expect(page.getByText(text('dataTable.emptyMessage'), { exact: true })).toBeVisible()
  await expect(dataRows(page)).toHaveCount(0)

  await page.reload()
  await expect(page.getByText(text('dataTable.emptyMessage'), { exact: true })).toBeVisible()
})
