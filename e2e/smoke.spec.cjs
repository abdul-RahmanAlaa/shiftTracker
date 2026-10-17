/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const { test, expect, _electron: electron } = require('@playwright/test')
const { build } = require('esbuild')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const ar = require('../src/renderer/src/i18n/locales/ar.json')

const root = path.resolve(__dirname, '..')
const electronPath = require('electron')
const routes = [
  ['/', 'addTrip.title'],
  ['/shifts', 'shifts.title'],
  ['/shifts/:shiftId', 'shifts.title'],
  ['/all-trips', 'allTrips.title'],
  ['/accounts', 'accountsPage.title'],
  ['/statements', 'statementsPage.title'],
  ['/settings', 'settingsPage.title']
]

const rawTranslationIdentifier = /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\b/g

function text(key, interpolation = {}) {
  const translated = key.split('.').reduce((value, part) => value?.[part], ar)
  return Object.entries(interpolation).reduce(
    (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)),
    translated
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function captureStartupDatabasePath(tempDirectory) {
  const expectedDatabasePath = path.join(tempDirectory, 'shift-tracker.db')
  const startupProcess = spawn(electronPath, ['--user-data-dir=' + tempDirectory, root], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  let output = ''
  let timeout

  try {
    const startupOutput = await new Promise((resolve, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`Database path log not found:\n${output}`)),
        15_000
      )
      const checkOutput = (chunk) => {
        output += String(chunk)
        if (output.includes(expectedDatabasePath)) resolve(output)
      }
      startupProcess.stdout.on('data', checkOutput)
      startupProcess.stderr.on('data', checkOutput)
      startupProcess.once('error', reject)
      startupProcess.once('exit', (code) => {
        reject(new Error(`Electron exited before logging the database path (${code}):\n${output}`))
      })
    })
    const stopped = new Promise((resolve) => startupProcess.once('exit', resolve))
    startupProcess.kill()
    await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 5_000))])
    if (startupProcess.exitCode === null && startupProcess.signalCode === null) {
      startupProcess.kill()
      throw new Error('Startup log probe did not exit after being stopped')
    }
    return startupOutput
  } finally {
    clearTimeout(timeout)
    if (startupProcess.exitCode === null && startupProcess.signalCode === null)
      startupProcess.kill()
  }
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formItem(page, labelKey) {
  return page
    .locator('label')
    .filter({ hasText: text(labelKey) })
    .first()
    .locator('xpath=..')
}

async function selectOption(page, labelKey, optionText) {
  await page
    .getByRole('combobox', { name: new RegExp(`^${escapeRegExp(text(labelKey))}(?:\\s+\\*)?$`) })
    .click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

async function fillNumber(page, labelKey, value) {
  await formItem(page, labelKey).getByRole('spinbutton').fill(String(value))
}

function gridCell(page, labelKey, rowIndex = 0) {
  return page
    .getByRole('row')
    .nth(rowIndex + 1)
    .getByLabel(text(labelKey), { exact: true })
}

async function selectToday(page, labelKey, placeholderKey) {
  const item = formItem(page, labelKey)
  await item.getByRole('button', { name: text(placeholderKey), exact: true }).click()
  await page.locator(`[data-day="${today()}"] button`).click()
}

async function selectTodayByPlaceholder(page, placeholderKey) {
  await page.getByRole('button', { name: text(placeholderKey), exact: true }).click()
  await page.locator(`[data-day="${today()}"] button`).click()
  await page.keyboard.press('Escape')
}

async function pickDriverOnAddTrip(page, driverName) {
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name: driverName, exact: true }).click()
}

async function navigate(page, route, labelKey) {
  await page.getByRole('link', { name: text(labelKey), exact: true }).click()
  await expect(page.getByRole('heading', { name: text(labelKey) })).toBeVisible()
}

async function expectNoRawTranslationKeys(page) {
  const bodyText = await page.locator('body').innerText()
  expect(bodyText.match(rawTranslationIdentifier) ?? []).toEqual([])
}

async function expectTablesFit(page, label, measurements) {
  const containers = page.locator('[data-slot="table-container"]')
  const count = await containers.count()
  expect(count, `${label} should render a table`).toBeGreaterThan(0)

  for (let index = 0; index < count; index += 1) {
    const dimensions = await containers.nth(index).evaluate((element) => {
      const headers = Array.from(element.querySelectorAll('[data-slot="table-head"]'))
      const cells = Array.from(element.querySelectorAll('[data-slot="table-cell"]'))
      const wrappedCells = Array.from(
        element.querySelectorAll('[data-slot="table-cell"] > div:not(.whitespace-nowrap)')
      )
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        headersCentered: headers.every((header) => getComputedStyle(header).textAlign === 'center'),
        cellsCentered: cells.every((cell) => getComputedStyle(cell).textAlign === 'center'),
        wrappedCellsHaveTitles: wrappedCells.every((cell) => cell.getAttribute('title') !== null),
        textIsClamped: wrappedCells.every((cell) => getComputedStyle(cell).webkitLineClamp === '2')
      }
    })
    measurements.push({ label, index, ...dimensions })
    expect(dimensions.headersCentered, `${label} headers should be centered`).toBe(true)
    expect(dimensions.cellsCentered, `${label} cells should be centered`).toBe(true)
    expect(
      dimensions.wrappedCellsHaveTitles,
      `${label} wrapped cells should have full-text titles`
    ).toBe(true)
    expect(dimensions.textIsClamped, `${label} text should clamp after two lines`).toBe(true)
    expect(
      dimensions.scrollWidth,
      `${label} table ${index + 1} should not overflow horizontally`
    ).toBeLessThanOrEqual(dimensions.clientWidth)
  }
}

const testWithApp = test.extend({
  launchApp: async (
    // eslint-disable-next-line no-empty-pattern
    {},
    use,
    testInfo
  ) => {
    let session
    let allocatedDirectory
    const launch = async (mode) => {
      const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shift-tracker-e2e-'))
      allocatedDirectory = tempDirectory
      const suffix = `${process.pid}${Date.now()}`
      const seedBundle = path.join(tempDirectory, 'seed.bundle.cjs')
      const buildResult = await build({
        entryPoints: [path.join(root, 'e2e', 'seed.cjs')],
        absWorkingDir: root,
        outfile: seedBundle,
        bundle: true,
        platform: 'node',
        format: 'cjs',
        target: 'node22',
        external: ['electron', 'better-sqlite3'],
        logLevel: 'silent'
      })
      if (buildResult.errors.length > 0) throw new Error('Could not bundle E2E seed script')

      const seedEnvironment = {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_PATH: path.join(root, 'node_modules'),
        SHIFT_TRACKER_E2E_SEED: JSON.stringify({
          appPath: tempDirectory,
          mode,
          suffix
        })
      }
      const seedRun = spawnSync(electronPath, [seedBundle], {
        cwd: root,
        env: seedEnvironment,
        encoding: 'utf8',
        windowsHide: true
      })
      if (seedRun.status !== 0) {
        fs.rmSync(tempDirectory, { recursive: true, force: true })
        throw new Error(`E2E seeding failed:\n${seedRun.stdout}\n${seedRun.stderr}`)
      }
      const seedLine = seedRun.stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith('E2E_SEED_RESULT='))
      if (!seedLine) {
        fs.rmSync(tempDirectory, { recursive: true, force: true })
        throw new Error(`Seed result missing:\n${seedRun.stdout}`)
      }
      const seedData = JSON.parse(seedLine.slice('E2E_SEED_RESULT='.length))
      const startupLog = await captureStartupDatabasePath(tempDirectory)
      const application = await electron.launch({
        executablePath: electronPath,
        args: ['--user-data-dir=' + tempDirectory, root],
        cwd: root,
        env: process.env,
        timeout: 30_000
      })
      session = {
        application,
        page: null,
        startupLog,
        seedData,
        tempDirectory,
        actualUserData: '',
        databasePath: '',
        browserErrors: [],
        traceStarted: false
      }
      const page = await application.firstWindow()
      page.on('pageerror', (error) => session.browserErrors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') session.browserErrors.push(message.text())
      })
      await page.waitForLoadState('domcontentloaded')
      const actualUserData = await application.evaluate(({ app }) => app.getPath('userData'))
      const databasePath = path.join(actualUserData, 'shift-tracker.db')
      expect(startupLog).toContain(`[db] Database path: ${databasePath}`)
      expect(actualUserData).toBe(tempDirectory)
      expect(fs.existsSync(databasePath)).toBe(true)
      await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true })

      session.page = page
      session.actualUserData = actualUserData
      session.databasePath = databasePath
      session.traceStarted = true
      return session
    }

    try {
      await use(launch)
    } finally {
      if (session) {
        if (session.page && testInfo.status !== testInfo.expectedStatus) {
          await session.page.screenshot({
            path: testInfo.outputPath('failure.png'),
            fullPage: true
          })
        }
        if (session.page && session.traceStarted && testInfo.status !== testInfo.expectedStatus) {
          await session.page.context().tracing.stop({
            path: testInfo.outputPath('failure-trace.zip')
          })
        } else if (session.page && session.traceStarted) {
          await session.page.context().tracing.stop()
        }
        await session.application.close()
        fs.rmSync(session.tempDirectory, { recursive: true, force: true })
      } else if (allocatedDirectory) {
        fs.rmSync(allocatedDirectory, { recursive: true, force: true })
      }
    }
  }
})

testWithApp(
  'S1 routes render without browser errors or raw translation identifiers',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')

    for (const [route, labelKey] of routes) {
      if (route === '/') {
        await navigate(app.page, route, labelKey)
        await expectNoRawTranslationKeys(app.page)
        continue
      }
      if (route === '/shifts/:shiftId') {
        await app.page.getByRole('row').filter({ hasText: app.seedData.shift.id }).click()
        await expect(app.page).toHaveURL(new RegExp(`/shifts/${app.seedData.shift.id}`))
        await expectNoRawTranslationKeys(app.page)
        continue
      }
      await navigate(app.page, route, labelKey)
      await expectNoRawTranslationKeys(app.page)
    }

    expect(app.browserErrors).toEqual([])
    expect(
      await app.application.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
    ).toBe(app.tempDirectory)
  }
)

testWithApp(
  'S2 creates a shift in the UI without a count field and rejects a duplicate vehicle',
  async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const page = app.page
    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('link', { name: text('settingsPage.title'), exact: true }).click()
    await expect(page.getByRole('heading', { name: text('settingsPage.title') })).toBeVisible()
    await page
      .getByRole('button', { name: text('settingsPage.sections.drivers'), exact: true })
      .click()
    await page.getByRole('button', { name: text('driversSettings.addButton'), exact: true }).click()
    const secondDriverName = `E2E Second Driver ${app.seedData.suffix}`
    await page.getByLabel(text('driversSettings.fields.name')).fill(secondDriverName)
    await page
      .getByRole('button', { name: text('contractorsSettings.addSubmit'), exact: true })
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()
    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('button', { name: text('createShift.title'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(text('shifts.reportedTripCount'), { exact: true })).toHaveCount(0)
    await selectOption(page, 'createShift.fields.driver', app.seedData.driver.name)
    await selectOption(
      page,
      'createShift.fields.vehicle',
      String(app.seedData.firstVehicle.vehicleNo)
    )
    await fillNumber(page, 'createShift.fields.crusherCubic', 1)
    await fillNumber(page, 'createShift.fields.clientCubic', 1)
    await selectToday(page, 'createShift.fields.startDate', 'createShift.placeholders.startDate')
    await dialog.getByRole('button', { name: text('createShift.submit'), exact: true }).click()
    await expect(dialog).toBeHidden()

    await page.getByRole('button', { name: text('createShift.title'), exact: true }).click()
    const duplicateDialog = page.getByRole('dialog')
    await selectOption(page, 'createShift.fields.driver', secondDriverName)
    await selectOption(
      page,
      'createShift.fields.vehicle',
      String(app.seedData.firstVehicle.vehicleNo)
    )
    await fillNumber(page, 'createShift.fields.crusherCubic', 1)
    await fillNumber(page, 'createShift.fields.clientCubic', 1)
    await selectToday(page, 'createShift.fields.startDate', 'createShift.placeholders.startDate')
    await duplicateDialog
      .getByRole('button', { name: text('createShift.submit'), exact: true })
      .click()
    const vehicleField = formItem(duplicateDialog, 'createShift.fields.vehicle')
    await expect(vehicleField.locator('p.text-destructive')).toBeVisible()
  }
)

testWithApp(
  'S3 grid rejects zero price, double-click saves one receipt-free note trip, then shows details labels',
  async ({ launchApp }) => {
    const app = await launchApp('open-shift')
    const page = app.page
    await navigate(page, '/', 'addTrip.title')
    await pickDriverOnAddTrip(page, app.seedData.driver.name)
    await expect(gridCell(page, 'tripForm.fields.tripDate')).toHaveValue(today())
    await gridCell(page, 'tripForm.fields.client').fill(app.seedData.client.name)
    await gridCell(page, 'tripForm.fields.client').press('Tab')
    await gridCell(page, 'tripForm.fields.crusher').fill(app.seedData.crusher.name)
    await gridCell(page, 'tripForm.fields.crusher').press('Tab')
    await gridCell(page, 'tripForm.fields.materialType').fill(app.seedData.materialType.name)
    await gridCell(page, 'tripForm.fields.materialType').press('Tab')
    await gridCell(page, 'tripForm.fields.clientCubic').fill('150')
    await expect(gridCell(page, 'tripForm.fields.clientCubic')).not.toHaveClass(/ring-amber-500/)
    await gridCell(page, 'tripForm.fields.clientCubic').fill('151')
    await expect(gridCell(page, 'tripForm.fields.clientCubic')).toHaveClass(/ring-amber-500/)
    await gridCell(page, 'tripForm.fields.stonePrice').fill('0')
    await gridCell(page, 'tripForm.fields.stonePrice').press('Tab')
    await expect(gridCell(page, 'tripForm.fields.stonePrice')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    await gridCell(page, 'tripForm.fields.stonePrice').fill('12')
    await gridCell(page, 'tripForm.fields.transportPrice').fill('8')
    await gridCell(page, 'tripForm.fields.clientPrice').fill('15')
    const uniqueNote = `Double save ${process.pid} ${Date.now()}`
    await gridCell(page, 'common.columns.notes').fill(uniqueNote)
    await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).dblclick()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))
    await expect(page.getByRole('status')).toBeHidden()

    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('row').filter({ hasText: app.seedData.shift.id }).click()
    await expect(
      page.getByRole('heading', { name: new RegExp(app.seedData.shift.id) })
    ).toBeVisible()
    let tripRows = page.getByRole('row')
    let noteMatches = 0
    const tripRowCount = await tripRows.count()
    expect(tripRowCount).toBeGreaterThan(1)
    for (let index = 1; index < tripRowCount; index += 1) {
      const editButton = tripRows
        .nth(index)
        .getByRole('button', { name: text('common.edit'), exact: true })
      await editButton.focus()
      await editButton.press('Enter')
      const dialog = page.getByRole('dialog')
      const noteField = dialog.getByLabel(text('common.columns.notes'))
      if ((await noteField.inputValue()) === uniqueNote) noteMatches += 1
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      tripRows = page.getByRole('row')
    }
    expect(noteMatches).toBe(1)

    await navigate(page, '/', 'addTrip.title')
    await pickDriverOnAddTrip(page, app.seedData.driver.name)
    await gridCell(page, 'tripForm.fields.client').fill(app.seedData.client.name)
    await gridCell(page, 'tripForm.fields.client').press('Tab')
    await gridCell(page, 'tripForm.fields.crusher').fill(app.seedData.crusher.name)
    await gridCell(page, 'tripForm.fields.crusher').press('Tab')
    await gridCell(page, 'tripForm.fields.materialType').fill(app.seedData.materialType.name)
    await gridCell(page, 'tripForm.fields.materialType').press('Tab')
    await gridCell(page, 'tripForm.fields.stonePrice').fill('12')
    await gridCell(page, 'tripForm.fields.transportPrice').fill('8')
    await gridCell(page, 'tripForm.fields.clientPrice').fill('15')
    await page.getByRole('button', { name: text('tripGrid.showExtra'), exact: true }).click()
    await gridCell(page, 'tripForm.fields.crusherReceiptNumber').fill('7002')
    await gridCell(page, 'tripForm.fields.recipientName').fill(`E2E Receiver ${process.pid}`)
    await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).click()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))
    await expect(page.getByRole('status')).toBeHidden()

    await navigate(page, '/all-trips', 'allTrips.title')
    await page
      .getByRole('row')
      .nth(2)
      .getByRole('button', { name: text('common.details'), exact: true })
      .click()
    await expect(
      page.getByText(text('tripForm.receiptStatuses.value'), { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(text('tripForm.recipientNameStatuses.provided'), { exact: true })
    ).toBeVisible()
  }
)

testWithApp(
  'S7 trip grid saves valid rows and retains a server-rejected duplicate receipt',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const page = app.page
    await navigate(page, '/', 'addTrip.title')
    await pickDriverOnAddTrip(page, app.seedData.driver.name)
    await page.getByRole('button', { name: text('tripGrid.showExtra'), exact: true }).click()
    await gridCell(page, 'tripForm.fields.client').fill(app.seedData.client.name)
    await gridCell(page, 'tripForm.fields.client').press('Tab')
    await gridCell(page, 'tripForm.fields.crusher').fill(app.seedData.crusher.name)
    await gridCell(page, 'tripForm.fields.crusher').press('Tab')
    await gridCell(page, 'tripForm.fields.materialType').fill(app.seedData.materialType.name)
    await gridCell(page, 'tripForm.fields.materialType').press('Tab')
    await gridCell(page, 'tripForm.fields.stonePrice').fill('12')
    await gridCell(page, 'tripForm.fields.transportPrice').fill('8')
    await gridCell(page, 'tripForm.fields.clientPrice').fill('15')
    await gridCell(page, 'tripForm.fields.crusherReceiptNumber').fill('7002')
    await gridCell(page, 'tripForm.fields.recipientName').fill('First receiver')

    await page.getByRole('button', { name: text('tripGrid.addRow'), exact: true }).click()
    await gridCell(page, 'tripForm.fields.client', 1).fill(app.seedData.client.name)
    await gridCell(page, 'tripForm.fields.client', 1).press('Tab')
    await gridCell(page, 'tripForm.fields.crusher', 1).fill(app.seedData.crusher.name)
    await gridCell(page, 'tripForm.fields.crusher', 1).press('Tab')
    await gridCell(page, 'tripForm.fields.materialType', 1).fill(app.seedData.materialType.name)
    await gridCell(page, 'tripForm.fields.materialType', 1).press('Tab')
    await gridCell(page, 'tripForm.fields.stonePrice', 1).fill('12')
    await gridCell(page, 'tripForm.fields.transportPrice', 1).fill('8')
    await gridCell(page, 'tripForm.fields.clientPrice', 1).fill('15')
    await gridCell(page, 'tripForm.fields.crusherReceiptNumber', 1).fill('7001')
    await gridCell(page, 'tripForm.fields.recipientName', 1).fill('Second receiver')

    await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).click()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))
    await expect(page.getByRole('status')).toContainText(
      text('tripGrid.failedNotice', { count: 1 })
    )
    await expect(gridCell(page, 'tripForm.fields.crusherReceiptNumber')).toHaveValue('7001')
    await expect(gridCell(page, 'tripForm.fields.crusherReceiptNumber')).toHaveAttribute(
      'aria-invalid',
      'true'
    )

    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('row').filter({ hasText: app.seedData.shift.id }).click()
    await expect(page.getByRole('row')).toHaveCount(3)
  }
)

testWithApp(
  'S4 pre-fills actual trip count, rejects mismatch, and closes with attachments',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const page = app.page
    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox').first().click()
    await page
      .getByRole('option', {
        name: `${app.seedData.shift.id} (${app.seedData.driver.name})`,
        exact: true
      })
      .click()
    const countField = dialog.getByLabel(text('shifts.reportedTripCount'))
    await expect(countField).toHaveValue('1')
    await fillNumber(page, 'shifts.reportedTripCount', 2)
    await selectTodayByPlaceholder(page, 'shifts.closeDatePlaceholder')
    await dialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true }).click()
    await expect(countField.locator('xpath=..').locator('p.text-destructive')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('row').filter({ hasText: app.seedData.shift.id })).toContainText(
      text('shiftStatus.open')
    )

    await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
    const retryDialog = page.getByRole('dialog')
    await retryDialog.getByRole('combobox').first().click()
    await page
      .getByRole('option', {
        name: `${app.seedData.shift.id} (${app.seedData.driver.name})`,
        exact: true
      })
      .click()
    const retryCountField = retryDialog.getByLabel(text('shifts.reportedTripCount'))
    await expect(retryCountField).toHaveValue('1')
    await selectTodayByPlaceholder(page, 'shifts.closeDatePlaceholder')
    await retryDialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true }).click()
    await expect(retryDialog).toBeHidden()
    await expect(page.getByRole('row').filter({ hasText: app.seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
)

testWithApp(
  'S5 contractor statement shows the balance note and client statement does not',
  async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const page = app.page
    await navigate(page, '/statements', 'statementsPage.title')
    const note = text('contractorAccount.balanceSignNote')
    await page.getByLabel(text('statementsPage.entityType')).click()
    await page.getByRole('option', { name: text('statementsPage.contractor'), exact: true }).click()
    await expect(page.getByText(note, { exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: text('statementsPage.entity'), exact: true }).click()
    await page.getByRole('option', { name: app.seedData.contractor.name, exact: true }).click()
    await expect(page.getByText(note, { exact: true })).toBeVisible()

    await page.getByLabel(text('statementsPage.entityType')).click()
    await page.getByRole('option', { name: text('statementsPage.client'), exact: true }).click()
    await expect(page.getByText(note, { exact: true })).toHaveCount(0)
    await page.getByRole('combobox', { name: text('statementsPage.entity'), exact: true }).click()
    await page.getByRole('option', { name: app.seedData.client.name, exact: true }).click()
    await expect(page.getByText(note, { exact: true })).toHaveCount(0)
  }
)

testWithApp('S6 second instance exits and focuses the existing app', async ({ launchApp }) => {
  const first = await launchApp('with-trip')
  const page = first.page
  await expect(page.getByRole('heading', { name: text('addTrip.title') })).toBeVisible()

  const databaseFilesBefore = fs
    .readdirSync(first.tempDirectory)
    .filter((name) => name.startsWith('shift-tracker.db'))
    .sort()
  expect(databaseFilesBefore).toContain('shift-tracker.db')
  expect(
    databaseFilesBefore.every((name) => /^shift-tracker\.db(?:-(?:wal|shm))?$/.test(name))
  ).toBe(true)
  expect(databaseFilesBefore.filter((name) => name.endsWith('-wal'))).toHaveLength(1)
  expect(databaseFilesBefore.filter((name) => name.endsWith('-shm'))).toHaveLength(1)

  const secondStartedAt = Date.now()
  const second = spawn(electronPath, ['--user-data-dir=' + first.tempDirectory, root], {
    cwd: root,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  })
  let secondOutput = ''
  second.stdout.on('data', (chunk) => {
    secondOutput += String(chunk)
  })
  second.stderr.on('data', (chunk) => {
    secondOutput += String(chunk)
  })
  const secondExit = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 15_000)
    second.once('exit', (code, signal) => {
      clearTimeout(timeout)
      resolve({ code, signal })
    })
    second.once('error', (error) => {
      clearTimeout(timeout)
      resolve({ error })
    })
  })
  const secondElapsed = Date.now() - secondStartedAt
  if (secondExit === null) {
    second.kill()
    throw new Error('Second Electron process did not exit within 15 seconds')
  }

  expect(secondExit).toEqual({ code: 0, signal: null })
  expect(secondElapsed).toBeLessThan(15_000)
  expect(secondOutput).not.toContain('[db] Database path:')
  await expect(page.getByRole('heading', { name: text('addTrip.title') })).toBeVisible()
  expect(await first.application.windows()).toHaveLength(1)
  expect(
    fs
      .readdirSync(first.tempDirectory)
      .filter((name) => name.startsWith('shift-tracker.db'))
      .sort()
  ).toEqual(databaseFilesBefore)
})

testWithApp(
  'F4 DataTables fit a 1366x768 viewport with long names and notes',
  async ({ launchApp }) => {
    const app = await launchApp('layout')
    const page = app.page
    const measurements = []
    const longNote = 'N'.repeat(120)
    await page.setViewportSize({ width: 1366, height: 768 })

    await navigate(page, '/shifts', 'shifts.title')
    await expectTablesFit(page, 'Shifts', measurements)
    await page.getByRole('row').filter({ hasText: app.seedData.shift.id }).click()
    await expect(page).toHaveURL(new RegExp(`/shifts/${app.seedData.shift.id}`))
    await expect(page.locator('[data-slot="table-container"] tbody tr').first()).toBeVisible()
    await page
      .getByRole('button', { name: text('common.details'), exact: true })
      .first()
      .click()
    await expect(page.getByText(text('tripForm.fields.location'), { exact: true })).toBeVisible()
    await page.getByRole('button', { name: text('floatingWindow.closeAriaLabel') }).click()
    await expectTablesFit(page, 'Shift details', measurements)

    await navigate(page, '/all-trips', 'allTrips.title')
    await expectTablesFit(page, 'All trips', measurements)

    await navigate(page, '/settings', 'settingsPage.title')
    const settingsSections = [
      ['vehicles', app.seedData.contractor.name],
      ['drivers', app.seedData.driver.name],
      ['contractors', app.seedData.contractor.name],
      ['crushers', app.seedData.crusher.name],
      ['clients', app.seedData.client.name],
      ['materialTypes', app.seedData.materialType.name]
    ]
    for (const [section, expectedName] of settingsSections) {
      await page
        .getByRole('button', {
          name: text(`settingsPage.sections.${section}`),
          exact: true
        })
        .click()
      const table = page.locator('[data-slot="table-container"]')
      await expect(table.first()).toBeVisible()
      await expect(table).toContainText(expectedName)
      await expect(
        table.locator('[data-slot="table-cell"] > div').filter({ hasText: expectedName }).first()
      ).toHaveAttribute('title', expectedName)
      await expectTablesFit(page, `Settings ${section}`, measurements)
    }

    await navigate(page, '/accounts', 'accountsPage.title')
    const accountSections = [
      ['contractor', 'accountsPage.sections.contractor'],
      ['driver', 'accountsPage.sections.driver'],
      ['client', 'accountsPage.sections.client'],
      ['all-movements', 'accountsPage.sections.allMovements']
    ]
    for (const [section, labelKey] of accountSections) {
      await page.getByRole('button', { name: text(labelKey), exact: true }).click()
      if (section !== 'all-movements') {
        await page.getByRole('combobox').first().click()
        const optionName =
          section === 'contractor'
            ? app.seedData.contractor.name
            : section === 'driver'
              ? app.seedData.driver.name
              : app.seedData.client.name
        await page.getByRole('option', { name: optionName, exact: true }).click()
        await expect(page.locator('[data-slot="table-container"]').first()).toBeVisible()
        await expect(page.locator('[data-slot="table-container"] tbody tr').first()).toBeVisible()
      } else {
        await expect(page.locator('[data-slot="table-container"] tbody tr').first()).toBeVisible()
      }
      await expectTablesFit(page, `Accounts ${section}`, measurements)
      if (section === 'contractor' || section === 'client' || section === 'all-movements') {
        await expect(
          page.locator('[data-slot="table-cell"] > div').filter({ hasText: longNote }).first()
        ).toHaveAttribute('title', longNote)
      }
    }

    await navigate(page, '/statements', 'statementsPage.title')
    await page.getByRole('combobox', { name: text('statementsPage.entity'), exact: true }).click()
    await page.getByRole('option', { name: app.seedData.client.name, exact: true }).click()
    await expect(page.locator('[data-slot="table-container"] tbody tr').first()).toBeVisible()
    await expectTablesFit(page, 'Client statement', measurements)
    await expect(
      page.locator('[data-slot="table-cell"] > div').filter({ hasText: longNote }).first()
    ).toHaveAttribute('title', longNote)

    await page.getByLabel(text('statementsPage.entityType')).click()
    await page.getByRole('option', { name: text('statementsPage.contractor'), exact: true }).click()
    await page.getByRole('combobox', { name: text('statementsPage.entity'), exact: true }).click()
    await page.getByRole('option', { name: app.seedData.contractor.name, exact: true }).click()
    await expect(page.locator('[data-slot="table-container"] tbody tr').first()).toBeVisible()
    await expectTablesFit(page, 'Contractor statement', measurements)

    console.log(`F4_TABLE_WIDTHS=${JSON.stringify(measurements)}`)
  }
)
