/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  text,
  today,
  navigate,
  expectNoRawTranslationKeys,
  formItem,
  selectOption,
  fillNumber,
  selectToday,
  selectTodayByPlaceholder,
  pickDriverOnAddTrip,
  fillGridRow,
  nextDialog,
  expectNotice,
  testWithApp
} = require('./helpers.cjs')

async function selectClientOnAccounts(page, clientName) {
  await page.getByRole('combobox').click()
  await page.getByRole('option', { name: clientName, exact: true }).click()
  await expect(page.getByText(clientName, { exact: true })).toBeVisible()
}

async function clientBalance(page, expected) {
  const label = page.getByText(text('clientAccount.summary.balance'), { exact: true })
  await expect(label.locator('xpath=..').getByText(expected, { exact: true })).toBeVisible()
}

async function statementBalance(page, expected) {
  const label = page.getByText(text('statementsPage.totals.finalBalance'), { exact: true })
  await expect(label.locator('xpath=..').getByText(expected, { exact: true })).toBeVisible()
}

async function openClientStatement(page, clientName) {
  const picker = page.getByRole('combobox', { name: text('statementsPage.entity'), exact: true })
  await picker.click()
  await page.getByRole('option', { name: clientName, exact: true }).click()
  await expect(page.getByRole('heading', { name: clientName, exact: true })).toBeVisible()
}

testWithApp(
  'GOLD-1 UI-created opening balance, trip, fine, and payment match across Accounts and Statements',
  async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await navigate(page, '/settings', 'settingsPage.title')
    await expectNoRawTranslationKeys(page)
    await page
      .getByRole('button', { name: text('settingsPage.sections.clients'), exact: true })
      .click()
    const clientRow = page.getByRole('row').filter({ hasText: seedData.client.name })
    await clientRow.getByRole('button', { name: text('common.edit'), exact: true }).click()
    const clientDialog = page.getByRole('dialog')
    await formItem(page, 'common.openingBalance').getByRole('spinbutton').fill('500')
    await formItem(page, 'common.openingBalanceDate').locator('input').fill(today())
    await clientDialog
      .getByRole('button', { name: text('contractorsSettings.saveEdit'), exact: true })
      .click()
    await expect(clientDialog).toBeHidden()
    await expect(clientRow).toContainText('500.00')
    await page.reload()
    await page
      .getByRole('button', { name: text('settingsPage.sections.clients'), exact: true })
      .click()
    await expect(page.getByRole('row').filter({ hasText: seedData.client.name })).toContainText(
      '500.00'
    )

    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('button', { name: text('createShift.title'), exact: true }).click()
    const shiftDialog = page.getByRole('dialog')
    await selectOption(page, 'createShift.fields.driver', seedData.driver.name)
    await selectOption(page, 'createShift.fields.vehicle', String(seedData.firstVehicle.vehicleNo))
    await fillNumber(page, 'createShift.fields.crusherCubic', 1)
    await fillNumber(page, 'createShift.fields.clientCubic', 1)
    await selectToday(page, 'createShift.fields.startDate', 'createShift.placeholders.startDate')
    await shiftDialog.getByRole('button', { name: text('createShift.submit'), exact: true }).click()
    await expect(shiftDialog).toBeHidden()
    const createdShiftRow = page.getByRole('row').filter({ hasText: seedData.driver.name })
    await expect(createdShiftRow).toContainText(text('shiftStatus.open'))
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: seedData.driver.name })).toContainText(
      text('shiftStatus.open')
    )

    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)
    await page.getByRole('button', { name: text('tripGrid.showExtra'), exact: true }).click()
    const tripNote = `E2E GOLD-1 ${seedData.suffix}`
    await fillGridRow(page, {
      tripDate: today(),
      client: seedData.client.name,
      crusher: seedData.crusher.name,
      materialType: seedData.materialType.name,
      clientCubic: 20,
      crusherCubic: 20,
      stonePrice: 12,
      transportPrice: 8,
      clientPrice: 100,
      fineAmount: 200,
      fineReason: `E2E fine ${seedData.suffix}`,
      notes: tripNote
    })
    await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).click()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))
    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    const savedTripRow = page.getByRole('row').filter({ hasText: seedData.client.name })
    await expect(savedTripRow).toContainText(seedData.driver.name)
    await expect(savedTripRow).toContainText('20')
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: seedData.client.name })).toContainText(
      seedData.driver.name
    )

    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await page
      .getByRole('button', { name: text('accountsPage.sections.client'), exact: true })
      .click()
    await selectClientOnAccounts(page, seedData.client.name)
    await page.getByRole('button', { name: text('clientAccount.addPayment'), exact: true }).click()
    const paymentDialog = page.getByRole('dialog')
    await selectToday(
      page,
      'clientAccount.fields.paymentDate',
      'clientAccount.placeholders.paymentDate'
    )
    await formItem(page, 'common.columns.amount').getByRole('spinbutton').fill('1000')
    const paymentNote = `E2E GOLD-1 payment ${seedData.suffix}`
    await formItem(page, 'common.columns.notes').locator('textarea').fill(paymentNote)
    await paymentDialog
      .getByRole('button', { name: text('clientAccount.submitPayment'), exact: true })
      .click()
    await expect(paymentDialog).toBeHidden()

    // 500 opening + (20 x 100) trip - 200 fine - 1,000 payment = 1,300.
    const expectedBalance = (500 + 20 * 100 - 200 - 1000).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    await clientBalance(page, expectedBalance)
    await expect(page.getByRole('row').filter({ hasText: paymentNote })).toBeVisible()
    await page.reload()
    await page
      .getByRole('button', { name: text('accountsPage.sections.client'), exact: true })
      .click()
    await selectClientOnAccounts(page, seedData.client.name)
    await clientBalance(page, expectedBalance)

    await navigate(page, '/statements', 'statementsPage.title')
    await expectNoRawTranslationKeys(page)
    await openClientStatement(page, seedData.client.name)
    await statementBalance(page, expectedBalance)
    await expect(page.getByRole('row').filter({ hasText: paymentNote })).toBeVisible()
    await page.reload()
    await openClientStatement(page, seedData.client.name)
    await statementBalance(page, expectedBalance)
  }
)

testWithApp(
  'GOLD-2 deleting the golden trip removes its net contribution from both balances after reload',
  async ({ launchApp }) => {
    const app = await launchApp('golden')
    const { page, seedData } = app
    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    const row = page.getByRole('row').filter({ hasText: seedData.driver.name })
    const dialogPromise = nextDialog(page, 'accept')
    await row.getByRole('button', { name: text('common.delete'), exact: true }).click()
    await dialogPromise
    await expectNotice(page, 'ipcErrors.tripDeleted')
    await expect(row).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: seedData.trip.id })).toHaveCount(0)

    // Removing the trip removes its charge (20 x 100) and its 200 fine, a net 1,800.
    const removedTripValue = 20 * 100 - 200
    const expectedBalance = 1300 - removedTripValue
    const formattedBalance = expectedBalance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await page
      .getByRole('button', { name: text('accountsPage.sections.client'), exact: true })
      .click()
    await selectClientOnAccounts(page, seedData.client.name)
    await clientBalance(page, formattedBalance)
    await page.reload()
    await page
      .getByRole('button', { name: text('accountsPage.sections.client'), exact: true })
      .click()
    await selectClientOnAccounts(page, seedData.client.name)
    await clientBalance(page, formattedBalance)

    await navigate(page, '/statements', 'statementsPage.title')
    await expectNoRawTranslationKeys(page)
    await openClientStatement(page, seedData.client.name)
    await statementBalance(page, formattedBalance)
    await page.reload()
    await openClientStatement(page, seedData.client.name)
    await statementBalance(page, formattedBalance)
  }
)

testWithApp(
  'GOLD-3 closing the golden shift locks deletion and preserves the client balance',
  async ({ launchApp }) => {
    const app = await launchApp('golden')
    const { page, seedData } = app
    const expectedBalance = (500 + 20 * 100 - 200 - 1000).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('combobox').click()
    await page
      .getByRole('option', {
        name: `${seedData.shift.id} (${seedData.driver.name})`,
        exact: true
      })
      .click()
    await selectTodayByPlaceholder(page, 'shifts.closeDatePlaceholder')
    await dialog.getByRole('button', { name: text('shifts.closeSubmit'), exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: seedData.shift.id })).toContainText(
      text('shiftStatus.closed')
    )

    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    const tripRow = page.getByRole('row').filter({ hasText: seedData.driver.name })
    await expect(
      tripRow.getByRole('button', { name: text('common.delete'), exact: true })
    ).toHaveCount(0)
    await expect(tripRow.getByText(text('common.lockedShift'), { exact: true })).toBeVisible()

    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await page
      .getByRole('button', { name: text('accountsPage.sections.client'), exact: true })
      .click()
    await selectClientOnAccounts(page, seedData.client.name)
    await clientBalance(page, expectedBalance)
    await navigate(page, '/statements', 'statementsPage.title')
    await expectNoRawTranslationKeys(page)
    await openClientStatement(page, seedData.client.name)
    await statementBalance(page, expectedBalance)
  }
)
