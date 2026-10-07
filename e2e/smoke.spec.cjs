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

function text(key) {
  return key.split('.').reduce((value, part) => value?.[part], ar)
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

async function fillText(page, labelKey, value) {
  await page
    .getByRole('textbox', {
      name: new RegExp(`^${escapeRegExp(text(labelKey))}(?:\\s+\\*)?$`)
    })
    .fill(value)
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
  'S3 rejects zero price then saves a trip with correct detail labels',
  async ({ launchApp }) => {
    const app = await launchApp('open-shift')
    const page = app.page
    await navigate(page, '/', 'addTrip.title')
    await pickDriverOnAddTrip(page, app.seedData.driver.name)
    await expect(page.getByText(text('addTrip.steps.tripDetails'), { exact: true })).toBeVisible()
    await selectToday(page, 'tripForm.fields.tripDate', 'tripForm.placeholders.tripDate')
    await fillNumber(page, 'tripForm.fields.stonePrice', 0)
    await selectOption(page, 'tripForm.fields.crusher', app.seedData.crusher.name)
    await selectOption(page, 'tripForm.fields.client', app.seedData.client.name)
    await selectOption(page, 'tripForm.fields.materialType', app.seedData.materialType.name)
    await fillNumber(page, 'tripForm.fields.transportPrice', 8)
    await fillNumber(page, 'tripForm.fields.clientPrice', 15)
    await page.getByRole('button', { name: text('tripForm.submit'), exact: true }).click()
    const priceField = formItem(page, 'tripForm.fields.stonePrice')
    await expect(priceField.getByText(text('tripForm.validation.stonePriceRequired'))).toBeVisible()
    await fillNumber(page, 'tripForm.fields.stonePrice', 12)
    await selectOption(
      page,
      'tripForm.fields.crusherReceiptStatus',
      text('tripForm.receiptStatuses.value')
    )
    await fillNumber(page, 'tripForm.fields.crusherReceiptNumber', 7002)
    await selectOption(
      page,
      'tripForm.fields.recipientNameStatus',
      text('tripForm.receiptStatuses.value')
    )
    await fillText(page, 'tripForm.fields.recipientName', `E2E Receiver ${process.pid}`)
    await page.getByRole('button', { name: text('tripForm.submit'), exact: true }).click()
    await expect(
      page.getByText(new RegExp(text('addTrip.logs.created').split('{{')[0]))
    ).toBeVisible()

    await navigate(page, '/shifts', 'shifts.title')
    await page.getByRole('row').filter({ hasText: app.seedData.shift.id }).click()
    await expect(
      page.getByRole('heading', { name: new RegExp(app.seedData.shift.id) })
    ).toBeVisible()
    const tripRows = page.getByRole('row')
    await expect(tripRows).toHaveCount(2)
    await navigate(page, '/all-trips', 'allTrips.title')
    await page
      .getByRole('row')
      .nth(1)
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
