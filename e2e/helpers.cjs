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
  await page
    .getByRole('navigation', { name: text('app.navigationLabel'), exact: true })
    .getByRole('link', { name: text(labelKey), exact: true })
    .click()
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

function nextDialog(page, action) {
  let nativeDialogFired = false
  let resolveNativeDialog
  const nativeDialogPromise = new Promise((resolve) => {
    resolveNativeDialog = resolve
  })
  const onNativeDialog = (dialog) => {
    nativeDialogFired = true
    void dialog.dismiss()
    resolveNativeDialog()
  }
  page.on('dialog', onNativeDialog)

  return (async () => {
    try {
      const dialog = page.getByRole('dialog')
      const appDialogAppeared = expect(dialog)
        .toBeVisible()
        .then(() => true)
      const openedInApp = await Promise.race([
        appDialogAppeared,
        nativeDialogPromise.then(() => false)
      ])
      expect(nativeDialogFired, 'Delete confirmation must not open a native dialog').toBe(false)
      expect(openedInApp).toBe(true)
      await expect(dialog).toHaveAttribute('dir', 'rtl')

      const message = await dialog.getByTestId('confirm-dialog-message').innerText()
      if (action === 'escape') {
        await page.keyboard.press('Escape')
      } else {
        const key = action === 'accept' ? 'common.confirm' : 'common.cancel'
        await dialog.getByRole('button', { name: text(key), exact: true }).click()
      }

      expect(nativeDialogFired, 'Delete confirmation must not open a native dialog').toBe(false)
      return message
    } finally {
      page.off('dialog', onNativeDialog)
    }
  })()
}

async function expectNotice(page, key) {
  await expect(page.getByRole('status').filter({ hasText: text(key) })).toBeVisible()
}

async function closeShiftViaApi(page, shiftId) {
  const endDate = today()
  const result = await page.evaluate(
    ({ shiftId: id, endDate: date }) =>
      window.api.closeShift({ shiftId: id, endDate: date, reportedTripCount: 1 }),
    { shiftId, endDate }
  )
  expect(result.ok).toBe(true)
}

async function openShiftDetails(page, shiftId) {
  await page.setViewportSize({ width: 1366, height: 768 })
  await navigate(page, '/shifts', 'shifts.title')
  const shiftRow = page.getByRole('row').filter({ hasText: shiftId })
  await shiftRow.locator('[data-slot="table-cell"]').nth(1).click()
  await expect(page).toHaveURL(new RegExp(`/shifts/${escapeRegExp(shiftId)}$`))
  await expect(page.getByRole('heading', { name: shiftId, exact: true })).toBeVisible()
}

async function callApi(page, method, input) {
  return page.evaluate(([apiMethod, apiInput]) => window.api[apiMethod](apiInput), [method, input])
}

async function relaunchApp(session) {
  await session.application.close()
  session.page = null
  session.traceStarted = false
  const application = await electron.launch({
    executablePath: electronPath,
    args: ['--user-data-dir=' + session.tempDirectory, root],
    cwd: root,
    env: process.env,
    timeout: 30_000
  })
  session.application = application
  const actualUserData = await application.evaluate(({ app }) => app.getPath('userData'))
  expect(actualUserData).toBe(session.tempDirectory)
  const page = await application.firstWindow()
  page.on('pageerror', (error) => session.browserErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') session.browserErrors.push(message.text())
  })
  await page.waitForLoadState('domcontentloaded')
  await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true })

  session.page = page
  session.traceStarted = true
  return session
}

function allTripsRow(page, driverName) {
  return page.getByRole('row').filter({ hasText: driverName })
}

function tripRow(page, tripId) {
  return page.getByRole('row').filter({ hasText: tripId })
}

async function makeJpeg(page, width, height) {
  const imageBase64 = await page.evaluate(
    ({ imageWidth, imageHeight }) => {
      const canvas = document.createElement('canvas')
      canvas.width = imageWidth
      canvas.height = imageHeight
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Could not create JPEG fixture canvas')
      const gradient = context.createLinearGradient(0, 0, imageWidth, imageHeight)
      gradient.addColorStop(0, '#17324d')
      gradient.addColorStop(1, '#e58c45')
      context.fillStyle = gradient
      context.fillRect(0, 0, imageWidth, imageHeight)
      context.fillStyle = '#ffffff'
      context.fillRect(imageWidth / 4, imageHeight / 4, imageWidth / 2, imageHeight / 2)
      return canvas.toDataURL('image/jpeg', 0.92).replace(/^data:image\/jpeg;base64,/, '')
    },
    { imageWidth: width, imageHeight: height }
  )
  return Buffer.from(imageBase64, 'base64')
}

async function makeTruncatedJpeg(page) {
  const image = await makeJpeg(page, 32, 32)
  return image.subarray(0, Math.floor(image.length / 2))
}

function makePng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=',
    'base64'
  )
}

function makePdf() {
  return Buffer.from(
    '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'
  )
}

function arabicVariants() {
  // These escaped names isolate Arabic normalization from source-file encoding and other test text.
  return {
    matching: {
      stored: '\u0623\u062d\u0645\u062f',
      input: '\u0627\u062d\u0645\u062f'
    },
    ambiguous: {
      first: '\u0623\u062d\u0645\u062f',
      second: '\u0627\u062d\u0645\u062f',
      input: '\u0627\u062d\u0645\u062f'
    }
  }
}

function readDb(session) {
  const Database = require('better-sqlite3')
  return new Database(path.join(session.tempDirectory, 'shift-tracker.db'), { readonly: true })
}

async function fillGridRow(page, values, rowIndex = 0) {
  const textFields = {
    client: 'tripForm.fields.client',
    crusher: 'tripForm.fields.crusher',
    materialType: 'tripForm.fields.materialType',
    location: 'tripForm.fields.location',
    notes: 'common.columns.notes',
    crusherReceipt: 'tripForm.fields.crusherReceiptNumber',
    clientReceiptNo: 'tripForm.fields.clientReceiptNo',
    recipient: 'tripForm.fields.recipientName',
    fineReason: 'tripForm.fields.fineReason'
  }
  const numberFields = {
    clientCubic: 'tripForm.fields.clientCubic',
    crusherCubic: 'tripForm.fields.crusherCubic',
    stonePrice: 'tripForm.fields.stonePrice',
    transportPrice: 'tripForm.fields.transportPrice',
    clientPrice: 'tripForm.fields.clientPrice',
    fineAmount: 'tripForm.fields.fineAmount'
  }

  if (values.tripDate !== undefined) {
    await gridCell(page, 'tripForm.fields.tripDate', rowIndex).fill(values.tripDate)
  }
  for (const [field, labelKey] of Object.entries(textFields)) {
    if (values[field] !== undefined) {
      const cell = gridCell(page, labelKey, rowIndex)
      await cell.fill(String(values[field]))
      if (field === 'client' || field === 'crusher' || field === 'materialType') {
        await cell.press('Tab')
      }
    }
  }
  for (const [field, labelKey] of Object.entries(numberFields)) {
    if (values[field] !== undefined) {
      await gridCell(page, labelKey, rowIndex).fill(String(values[field]))
    }
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
        seedData,
        tempDirectory,
        browserErrors: [],
        traceStarted: false
      }
      const actualUserData = await application.evaluate(({ app }) => app.getPath('userData'))
      expect(actualUserData).toBe(tempDirectory)
      const page = await application.firstWindow()
      page.on('pageerror', (error) => session.browserErrors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') session.browserErrors.push(message.text())
      })
      await page.waitForLoadState('domcontentloaded')
      const databasePath = path.join(tempDirectory, 'shift-tracker.db')
      expect(fs.existsSync(databasePath)).toBe(true)
      await page.context().tracing.start({ screenshots: true, snapshots: true, sources: true })

      session.page = page
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

module.exports = {
  expect,
  fs,
  spawn,
  root,
  electronPath,
  text,
  escapeRegExp,
  today,
  formItem,
  selectOption,
  fillNumber,
  gridCell,
  selectToday,
  selectTodayByPlaceholder,
  pickDriverOnAddTrip,
  navigate,
  expectNoRawTranslationKeys,
  expectTablesFit,
  rawTranslationIdentifier,
  nextDialog,
  expectNotice,
  closeShiftViaApi,
  openShiftDetails,
  callApi,
  relaunchApp,
  allTripsRow,
  tripRow,
  makeJpeg,
  makeTruncatedJpeg,
  makePng,
  makePdf,
  arabicVariants,
  readDb,
  fillGridRow,
  routes,
  testWithApp
}
