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

module.exports = {
  expect,
  fs,
  spawn,
  root,
  electronPath,
  text,
  escapeRegExp,
  captureStartupDatabasePath,
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
  routes,
  testWithApp
}
