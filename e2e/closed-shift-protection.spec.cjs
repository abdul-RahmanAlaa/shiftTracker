/* eslint-disable @typescript-eslint/no-require-imports */

const {
  testWithApp,
  expect,
  text,
  navigate,
  nextDialog,
  expectNotice,
  closeShiftViaApi,
  openShiftDetails,
  allTripsRow
} = require('./helpers.cjs')

testWithApp('AT-5 deletes a trip from an OPEN shift in All Trips', async ({ launchApp }) => {
  const app = await launchApp('two-shifts')
  const { page, seedData } = app
  await navigate(page, '/all-trips', 'allTrips.title')

  const openRow = allTripsRow(page, seedData.driver.name)
  const closedRow = allTripsRow(page, seedData.secondDriver.name)
  const deleteButton = openRow.getByRole('button', {
    name: text('common.delete'),
    exact: true
  })
  await expect(deleteButton).toBeVisible()
  const dialogPromise = nextDialog(page, 'accept')
  await deleteButton.click()
  expect(await dialogPromise).toBe(
    text('allTrips.deleteTripConfirmation', { id: seedData.trip.id })
  )

  await expectNotice(page, 'ipcErrors.tripDeleted')
  await expect(openRow).toHaveCount(0)
  await expect(closedRow).toBeVisible()

  await page.reload()
  await expect(allTripsRow(page, seedData.driver.name)).toHaveCount(0)
  await expect(allTripsRow(page, seedData.secondDriver.name)).toBeVisible()

  await openShiftDetails(page, seedData.shift.id)
  await expect(page.getByRole('row').filter({ hasText: seedData.trip.id })).toHaveCount(0)
})

testWithApp('AT-6 cancel keeps the trip in All Trips', async ({ launchApp }) => {
  const app = await launchApp('two-shifts')
  const { page, seedData } = app
  await navigate(page, '/all-trips', 'allTrips.title')

  const row = allTripsRow(page, seedData.driver.name)
  const dialogPromise = nextDialog(page, 'dismiss')
  await row.getByRole('button', { name: text('common.delete'), exact: true }).click()
  expect(await dialogPromise).toBe(
    text('allTrips.deleteTripConfirmation', { id: seedData.trip.id })
  )

  await expect(row).toBeVisible()
  await expect(
    page.getByRole('status').filter({ hasText: text('ipcErrors.tripDeleted') })
  ).toHaveCount(0)
})

testWithApp('AT-7/AT-8 only OPEN-shift trips show Delete', async ({ launchApp }) => {
  const app = await launchApp('two-shifts')
  const { page, seedData } = app
  await navigate(page, '/all-trips', 'allTrips.title')

  const openRow = allTripsRow(page, seedData.driver.name)
  const closedRow = allTripsRow(page, seedData.secondDriver.name)
  await expect(
    openRow.getByRole('button', { name: text('common.delete'), exact: true })
  ).toBeVisible()
  await expect(
    closedRow.getByRole('button', { name: text('common.delete'), exact: true })
  ).toHaveCount(0)
  await expect(closedRow.getByText(text('common.lockedShift'), { exact: true })).toBeVisible()
  await expect(
    openRow.getByRole('button', { name: text('common.details'), exact: true })
  ).toBeVisible()
  await expect(
    closedRow.getByRole('button', { name: text('common.details'), exact: true })
  ).toBeVisible()
})

testWithApp('AT-9 reopening restores Delete', async ({ launchApp }) => {
  const app = await launchApp('two-shifts')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')

  await page.getByRole('button', { name: text('shifts.reopenCardTitle'), exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('combobox').click()
  await page
    .getByRole('option', {
      name: `${seedData.closedShift.id} (${seedData.secondDriver.name})`,
      exact: true
    })
    .click()
  await dialog
    .getByPlaceholder(text('shifts.reopenReasonPlaceholder'), { exact: true })
    .fill('E2E reopen verification')
  await dialog.getByRole('button', { name: text('shifts.reopenSubmit'), exact: true }).click()

  const shiftRow = page.getByRole('row').filter({ hasText: seedData.closedShift.id })
  await expect(shiftRow).toContainText(text('shiftStatus.reopened'))
  await navigate(page, '/all-trips', 'allTrips.title')
  const reopenedRow = allTripsRow(page, seedData.secondDriver.name)
  await expect(
    reopenedRow.getByRole('button', { name: text('common.delete'), exact: true })
  ).toBeVisible()
  await expect(reopenedRow.getByText(text('common.lockedShift'), { exact: true })).toHaveCount(0)
})

testWithApp('AT-10 server rejects a stale delete', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/all-trips', 'allTrips.title')

  const row = allTripsRow(page, seedData.driver.name)
  await expect(row.getByRole('button', { name: text('common.delete'), exact: true })).toBeVisible()
  await closeShiftViaApi(page, seedData.shift.id)

  const dialogPromise = nextDialog(page, 'accept')
  await row.getByRole('button', { name: text('common.delete'), exact: true }).click()
  await dialogPromise
  await expectNotice(page, 'ipcErrors.deleteFailed')
  await expect(row).toBeVisible()

  await page.reload()
  const closedRow = allTripsRow(page, seedData.driver.name)
  await expect(closedRow).toBeVisible()
  await expect(closedRow.getByText(text('common.lockedShift'), { exact: true })).toBeVisible()
  await expect(
    closedRow.getByRole('button', { name: text('common.delete'), exact: true })
  ).toHaveCount(0)
})

testWithApp('SD-5 deletes a trip in Shift Details', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await openShiftDetails(page, seedData.shift.id)

  const tripRow = page.getByRole('row').filter({ hasText: seedData.trip.id })
  await tripRow.scrollIntoViewIfNeeded()
  const actionsCell = tripRow.locator('[data-slot="table-cell"]').last()
  const dialogPromise = nextDialog(page, 'accept')
  await actionsCell.getByRole('button', { name: text('common.delete'), exact: true }).click()
  expect(await dialogPromise).toBe(text('shifts.deleteTripConfirmation', { id: seedData.trip.id }))
  await expectNotice(page, 'ipcErrors.tripDeleted')
  await expect(tripRow).toHaveCount(0)
})

testWithApp('SD-6 cancel keeps the trip in Shift Details', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await openShiftDetails(page, seedData.shift.id)

  const tripRow = page.getByRole('row').filter({ hasText: seedData.trip.id })
  await tripRow.scrollIntoViewIfNeeded()
  const actionsCell = tripRow.locator('[data-slot="table-cell"]').last()
  const dialogPromise = nextDialog(page, 'dismiss')
  await actionsCell.getByRole('button', { name: text('common.delete'), exact: true }).click()
  expect(await dialogPromise).toBe(text('shifts.deleteTripConfirmation', { id: seedData.trip.id }))
  await expect(tripRow).toBeVisible()
  await expect(
    page.getByRole('status').filter({ hasText: text('ipcErrors.tripDeleted') })
  ).toHaveCount(0)
})

testWithApp('SD-7 CLOSED shift locks edit and delete', async ({ launchApp }) => {
  const app = await launchApp('two-shifts')
  const { page, seedData } = app
  await openShiftDetails(page, seedData.closedShift.id)

  const tripRow = page.getByRole('row').filter({ hasText: seedData.closedTrip.id })
  await tripRow.scrollIntoViewIfNeeded()
  const actionsCell = tripRow.locator('[data-slot="table-cell"]').last()
  await expect(
    actionsCell.getByRole('button', { name: text('common.edit'), exact: true })
  ).toHaveCount(0)
  await expect(
    actionsCell.getByRole('button', { name: text('common.delete'), exact: true })
  ).toHaveCount(0)
  await expect(tripRow.getByText(text('common.lockedShift'), { exact: true })).toBeVisible()
  await actionsCell.getByRole('button', { name: text('common.details'), exact: true }).click()
  await expect(
    page.getByText(text('allTrips.detailsTitle', { id: seedData.closedTrip.id }), {
      exact: true
    })
  ).toBeVisible()
})

testWithApp('SD-8 server rejects a stale delete in Shift Details', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await openShiftDetails(page, seedData.shift.id)
  await closeShiftViaApi(page, seedData.shift.id)

  const tripRow = page.getByRole('row').filter({ hasText: seedData.trip.id })
  await tripRow.scrollIntoViewIfNeeded()
  const actionsCell = tripRow.locator('[data-slot="table-cell"]').last()
  const dialogPromise = nextDialog(page, 'accept')
  await actionsCell.getByRole('button', { name: text('common.delete'), exact: true }).click()
  await dialogPromise
  await expectNotice(page, 'ipcErrors.deleteFailed')
  await expect(tripRow).toBeVisible()
})
