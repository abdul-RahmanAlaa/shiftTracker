/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  fs,
  text,
  formItem,
  fillNumber,
  selectOption,
  selectToday,
  navigate,
  callApi,
  testWithApp
} = require('./helpers.cjs')
const path = require('node:path')

const navigation = [
  ['/', 'addTrip.title'],
  ['/shifts', 'shifts.title'],
  ['/all-trips', 'allTrips.title'],
  ['/accounts', 'accountsPage.title'],
  ['/statements', 'statementsPage.title'],
  ['/settings', 'settingsPage.title']
]

async function openShiftDetails(page, seedData) {
  await navigate(page, '/shifts', 'shifts.title')
  await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
  await expect(page).toHaveURL(new RegExp(`/shifts/${seedData.shift.id}$`))
}

async function updateTrip(page, seedData) {
  await openShiftDetails(page, seedData)
  const tripRow = page.getByRole('row').filter({ hasText: seedData.trip.id })
  await tripRow.getByRole('button', { name: text('common.edit'), exact: true }).click()
  const dialog = page.getByRole('dialog')
  await formItem(dialog, 'common.columns.notes')
    .getByRole('textbox')
    .fill(`E2E Notice ${seedData.suffix}`)
  await dialog.getByRole('button', { name: text('tripForm.submit'), exact: true }).click()
}

testWithApp('NAV-2 only the clicked navigation item is active', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const nav = app.page.getByRole('navigation', { name: text('app.navigationLabel'), exact: true })
  const links = nav.getByRole('link')
  await expect(links).toHaveCount(navigation.length)

  for (const [route, labelKey] of navigation) {
    const link = nav.getByRole('link', { name: text(labelKey), exact: true })
    await link.click()
    await expect(app.page).toHaveURL(new RegExp(`#${route === '/' ? '\\/' : route}$`))
    const activeLink = nav.locator('a[aria-current="page"]')
    await expect(activeLink).toHaveCount(1)
    await expect(activeLink).toHaveAttribute('href', route === '/' ? '#/' : `#${route}`)
    for (const [otherRoute, otherLabelKey] of navigation) {
      if (otherRoute === route) continue
      await expect(
        nav.getByRole('link', { name: text(otherLabelKey), exact: true })
      ).not.toHaveAttribute('aria-current', 'page')
    }
  }
})

// BUG-10: NavLink marks the active route with aria-current but the visual active classes are lost.
testWithApp.fixme('NAV-2 active navigation item has a visual highlight', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const nav = app.page.getByRole('navigation', { name: text('app.navigationLabel'), exact: true })
  for (const [, labelKey] of navigation) {
    const link = nav.getByRole('link', { name: text(labelKey), exact: true })
    await link.click()
    await expect(link).toHaveClass(/bg-secondary/)
  }
})

testWithApp('NAV-3 unknown routes redirect to Add Trip', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  await app.page.evaluate(() => {
    window.location.hash = '#/does-not-exist'
  })
  await expect(app.page).toHaveURL(/#\/$/)
  await expect(
    app.page.getByRole('heading', { name: text('addTrip.title'), exact: true })
  ).toBeVisible()
})

testWithApp('NAV-4 healthy backup status shows no warning', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const status = await callApi(app.page, 'getBackupStatus')
  expect(status).not.toHaveProperty('ok')
  expect(status.lastError).toBeNull()
  await expect(
    app.page.getByRole('status').filter({ hasText: text('backupStatus.warning') })
  ).toHaveCount(0)
})

testWithApp('NAV-4 failed daily backup shows a startup warning', async ({ launchApp }) => {
  const app = await launchApp('no-shift', {
    beforeLaunch(tempDirectory) {
      fs.writeFileSync(path.join(tempDirectory, 'backups'), 'not a directory')
    }
  })
  const warning = app.page.getByRole('status').filter({ hasText: text('backupStatus.warning') })
  await expect(warning).toBeVisible()
  const backupPath = path.join(app.tempDirectory, 'backups')
  expect(fs.statSync(backupPath).isFile()).toBe(true)
  fs.unlinkSync(backupPath)
})

testWithApp(
  'SHR-2 floating window moves, resizes, minimizes, restores, and closes',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    await openShiftDetails(app.page, app.seedData)
    const tripRow = app.page.getByRole('row').filter({ hasText: app.seedData.trip.id })
    await tripRow.getByRole('button', { name: text('common.details'), exact: true }).click()
    const floatingWindow = app.page.locator('.react-draggable')
    await expect(floatingWindow).toHaveCount(1)
    await expect(floatingWindow).toBeVisible()

    const initialPosition = await floatingWindow.boundingBox()
    const titlebar = floatingWindow.locator('.floating-window-titlebar')
    const titlebarBox = await titlebar.boundingBox()
    expect(initialPosition).toBeTruthy()
    expect(titlebarBox).toBeTruthy()
    if (!initialPosition || !titlebarBox) throw new Error('Floating window geometry is unavailable')
    const titlebarStart = {
      x: titlebarBox.x + titlebarBox.width * 0.3,
      y: titlebarBox.y + titlebarBox.height / 2
    }
    await app.page.mouse.move(titlebarStart.x, titlebarStart.y)
    await app.page.mouse.down()
    await app.page.mouse.move(titlebarStart.x + 90, titlebarStart.y + 60, { steps: 6 })
    await app.page.mouse.up()
    await expect
      .poll(async () => (await floatingWindow.boundingBox())?.x)
      .not.toBe(initialPosition.x)

    const beforeResize = await floatingWindow.boundingBox()
    const resizeHandle = floatingWindow.locator('[style*="se-resize"]')
    await expect(resizeHandle).toBeVisible()
    const resizeBox = await resizeHandle.boundingBox()
    expect(beforeResize).toBeTruthy()
    expect(resizeBox).toBeTruthy()
    if (!beforeResize || !resizeBox)
      throw new Error('Floating window resize geometry is unavailable')
    await app.page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2)
    await app.page.mouse.down()
    await app.page.mouse.move(
      resizeBox.x + resizeBox.width / 2 + 100,
      resizeBox.y + resizeBox.height / 2 + 80,
      { steps: 6 }
    )
    await app.page.mouse.up()
    await expect
      .poll(async () => {
        const box = await floatingWindow.boundingBox()
        return box ? { width: box.width, height: box.height } : null
      })
      .not.toEqual({ width: beforeResize.width, height: beforeResize.height })

    await floatingWindow
      .getByRole('button', { name: text('floatingWindow.minimizeAriaLabel'), exact: true })
      .click()
    await expect(floatingWindow).toBeHidden()
    await app.page
      .getByRole('button', {
        name: text('allTrips.detailsTitle', { id: app.seedData.trip.id }),
        exact: true
      })
      .click()
    await expect(floatingWindow).toBeVisible()
    await floatingWindow
      .getByRole('button', { name: text('floatingWindow.closeAriaLabel'), exact: true })
      .click()
    await expect(app.page.locator('.react-draggable')).toHaveCount(0)
  }
)

testWithApp(
  'SHR-3 notice errors can be dismissed and success auto-dismisses',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip', {
      beforeLaunch(tempDirectory) {
        fs.writeFileSync(path.join(tempDirectory, 'backups'), 'not a directory')
      }
    })
    const errorNotice = app.page
      .getByRole('status')
      .filter({ hasText: text('backupStatus.warning') })
    await expect(errorNotice).toBeVisible()
    await errorNotice.getByRole('button', { name: text('common.close'), exact: true }).click()
    await expect(errorNotice).toBeHidden()
    fs.unlinkSync(path.join(app.tempDirectory, 'backups'))

    await updateTrip(app.page, app.seedData)
    const successNotice = app.page
      .getByRole('status')
      .filter({ hasText: text('ipcErrors.tripUpdated') })
    await expect(successNotice).toBeVisible()
    // The source timer is 3 seconds; allow 1.5 seconds for renderer scheduling.
    await expect(successNotice).toBeHidden({ timeout: 4500 })
  }
)

testWithApp(
  'SHR-4 Create Shift, Trip, and Ledger forms reset after cancel',
  async ({ launchApp }) => {
    const app = await launchApp('reopened-shift')
    const page = app.page
    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('button', { name: text('createShift.title'), exact: true }).click()
    let dialog = page.getByRole('dialog')
    await formItem(dialog, 'common.columns.notes').getByRole('textbox').fill('E2E shift draft')
    await selectOption(page, 'createShift.fields.driver', app.seedData.driver.name)
    await selectOption(
      page,
      'createShift.fields.vehicle',
      String(app.seedData.firstVehicle.vehicleNo)
    )
    await fillNumber(page, 'createShift.fields.crusherCubic', 12)
    await fillNumber(page, 'createShift.fields.clientCubic', 13)
    await selectToday(page, 'createShift.fields.startDate', 'createShift.placeholders.startDate')
    await dialog.getByRole('button', { name: text('common.close'), exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: text('createShift.title'), exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(formItem(dialog, 'common.columns.notes').getByRole('textbox')).toHaveValue('')
    await expect(formItem(dialog, 'createShift.fields.startDate')).toContainText(
      text('createShift.placeholders.startDate')
    )
    await dialog.getByRole('button', { name: text('common.close'), exact: true }).click()

    await openShiftDetails(page, app.seedData)
    await page.getByRole('button', { name: text('shifts.addTrip'), exact: true }).click()
    dialog = page.getByRole('dialog')
    await formItem(dialog, 'common.columns.notes').getByRole('textbox').fill('E2E trip draft')
    await dialog.getByRole('button', { name: text('common.close'), exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: text('shifts.addTrip'), exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(formItem(dialog, 'common.columns.notes').getByRole('textbox')).toHaveValue('')
    await expect(formItem(dialog, 'tripForm.fields.tripDate')).toContainText(
      text('tripForm.placeholders.tripDate')
    )
    await dialog.getByRole('button', { name: text('common.close'), exact: true }).click()

    await navigate(page, '/accounts', 'accountsPage.title')
    await page
      .getByRole('button', { name: text('accountsPage.sections.allMovements'), exact: true })
      .click()
    await page.getByRole('button', { name: text('allMovements.addMovement'), exact: true }).click()
    dialog = page.getByRole('dialog')
    await formItem(dialog, 'common.columns.notes').getByRole('textbox').fill('E2E ledger draft')
    await dialog.getByRole('button', { name: text('common.cancel'), exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.getByRole('button', { name: text('allMovements.addMovement'), exact: true }).click()
    dialog = page.getByRole('dialog')
    await expect(formItem(dialog, 'common.columns.notes').getByRole('textbox')).toHaveValue('')
    await expect(formItem(dialog, 'common.columns.amount').getByRole('spinbutton')).toHaveValue('0')
  }
)
