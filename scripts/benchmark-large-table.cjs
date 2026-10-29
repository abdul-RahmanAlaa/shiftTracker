/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { build } = require('esbuild')
const { _electron: electron, expect } = require('@playwright/test')
const ar = require('../src/renderer/src/i18n/locales/ar.json')

const root = path.resolve(__dirname, '..')
const electronPath = require('electron')

function text(key, interpolation = {}) {
  const translated = key.split('.').reduce((value, part) => value?.[part], ar)
  return Object.entries(interpolation).reduce(
    (value, [name, replacement]) => value.replaceAll(`{{${name}}}`, String(replacement)),
    translated
  )
}

async function benchmark() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'shift-tracker-large-table-'))
  let application

  try {
    const seedBundle = path.join(tempDirectory, 'benchmark-seed.bundle.cjs')
    const buildResult = await build({
      entryPoints: [path.join(__dirname, 'benchmark-large-table-seed.cjs')],
      absWorkingDir: root,
      outfile: seedBundle,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node22',
      external: ['electron', 'better-sqlite3'],
      logLevel: 'silent'
    })
    if (buildResult.errors.length > 0) throw new Error('Could not bundle benchmark seed script')

    const seedRun = spawnSync(electronPath, [seedBundle], {
      cwd: root,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_PATH: path.join(root, 'node_modules'),
        SHIFT_TRACKER_BENCHMARK_SEED: JSON.stringify({ appPath: tempDirectory })
      },
      encoding: 'utf8',
      windowsHide: true
    })
    if (seedRun.status !== 0) {
      throw new Error(`Benchmark seeding failed:\n${seedRun.stdout}\n${seedRun.stderr}`)
    }
    const seedLine = seedRun.stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith('BENCHMARK_SEED_RESULT='))
    if (!seedLine) throw new Error(`Benchmark seed result missing:\n${seedRun.stdout}`)
    const seedData = JSON.parse(seedLine.slice('BENCHMARK_SEED_RESULT='.length))

    application = await electron.launch({
      executablePath: electronPath,
      args: ['--user-data-dir=' + tempDirectory, root],
      cwd: root,
      env: process.env,
      timeout: 60_000
    })
    const page = await application.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.setViewportSize({ width: 1366, height: 768 })
    page.setDefaultTimeout(60_000)

    const renderStartedAt = Date.now()
    await page.evaluate(() => {
      window.location.hash = '#/all-trips'
    })
    await page.getByText(seedData.firstDriverName, { exact: true }).first().waitFor()
    const initialRenderMs = Date.now() - renderStartedAt
    const renderedRowsAtInitialLoad = await page.evaluate(
      () => document.querySelectorAll('tbody tr[data-slot="table-row"]').length
    )
    console.log(`BENCHMARK_STAGE_INITIAL_RENDER_MS=${initialRenderMs}`)

    const sortInteractionStartedAt = Date.now()
    await page.getByRole('button', { name: text('common.columns.date') }).click()
    const sortButton = page.getByRole('button', {
      name: text('dataTable.sortDescending'),
      exact: true
    })
    await sortButton.waitFor({ state: 'visible' })
    const sortMenuMs = Date.now() - sortInteractionStartedAt
    const sortStartedAt = Date.now()
    await sortButton.click()
    await page.waitForFunction(
      (latestDate) =>
        document.querySelector('tbody tr[data-slot="table-row"] td:nth-child(2)')?.textContent ===
        latestDate,
      seedData.latestTripDate
    )
    const sortMs = Date.now() - sortStartedAt
    console.log(`BENCHMARK_STAGE_SORT_MENU_MS=${sortMenuMs}`)
    console.log(`BENCHMARK_STAGE_SORT_APPLY_MS=${sortMs}`)

    await page.keyboard.press('Escape')
    const filterStartedAt = Date.now()
    await page.getByRole('button', { name: text('ledgerEntryForm.fields.driver') }).click()
    const searchInput = page.getByPlaceholder(text('dataTable.searchValues'))
    await searchInput.waitFor({ state: 'visible' })
    await searchInput.fill(seedData.firstDriverName)
    await page.getByRole('option', { name: seedData.firstDriverName, exact: true }).click()
    await page.waitForFunction(
      (count) => document.querySelectorAll('tbody tr[data-slot="table-row"]').length === count,
      seedData.filteredTripCount
    )
    const filterMs = Date.now() - filterStartedAt
    console.log(`BENCHMARK_STAGE_FILTER_MS=${filterMs}`)

    await page.keyboard.press('Escape')
    const selectAll = page.getByRole('checkbox', { name: text('dataTable.selectAllRows') })
    const selectAndSumStartedAt = Date.now()
    await selectAll.click()
    await expect(
      page.getByText(text('dataTable.selectedRows', { count: seedData.filteredTripCount }), {
        exact: true
      })
    ).toBeVisible()
    await expect(
      page.getByText(text('dataTable.total', { sum: String(seedData.expectedFilteredSum) }), {
        exact: true
      })
    ).toBeVisible()
    const filteredSelectAndSumMs = Date.now() - selectAndSumStartedAt
    console.log(`BENCHMARK_STAGE_FILTERED_SELECT_SUM_MS=${filteredSelectAndSumMs}`)

    await page.getByRole('button', { name: text('ledgerEntryForm.fields.driver') }).click()
    await page.getByRole('button', { name: text('dataTable.clearFilter'), exact: true }).click()
    await page.keyboard.press('Escape')
    const selectAllStartedAt = Date.now()
    await selectAll.click()
    await expect(
      page.getByText(text('dataTable.selectedRows', { count: seedData.expectedTotal }), {
        exact: true
      })
    ).toBeVisible()
    await expect(
      page.getByText(
        text('dataTable.total', {
          sum: Number(seedData.expectedTotal).toLocaleString('en-US')
        }),
        { exact: true }
      )
    ).toBeVisible()
    const selectAllSumMs = Date.now() - selectAllStartedAt
    console.log(`BENCHMARK_STAGE_SELECT_ALL_SUM_MS=${selectAllSumMs}`)
    const renderedRows = await page.evaluate(
      () => document.querySelectorAll('tbody tr[data-slot="table-row"]').length
    )

    console.log(
      JSON.stringify({
        rows: seedData.tripCount,
        shifts: seedData.shiftCount,
        renderedRowsAtInitialLoad,
        renderedRows,
        timingsMs: {
          initialRender: initialRenderMs,
          sort: sortMenuMs + sortMs,
          sortMenuOpen: sortMenuMs,
          sortApply: sortMs,
          filter: filterMs,
          filteredSelectAllSum: filteredSelectAndSumMs,
          selectAllSum: selectAllSumMs
        },
        thresholdMs: 1000
      })
    )
  } finally {
    if (application) await application.close()
    fs.rmSync(tempDirectory, { recursive: true, force: true })
  }
}

benchmark().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
