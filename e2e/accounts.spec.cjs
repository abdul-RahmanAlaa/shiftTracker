/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  text,
  today,
  navigate,
  expectNoRawTranslationKeys,
  formItem,
  selectOption,
  selectToday,
  nextDialog,
  callApi,
  testWithApp
} = require('./helpers.cjs')

async function section(page, key) {
  await page.getByRole('button', { name: text(key), exact: true }).click()
}

async function selectEntity(page, name, listMethod) {
  const result = await callApi(page, listMethod)
  expect(result.ok).toBe(true)
  expect(result.data.some((entity) => entity.name === name)).toBe(true)
  await page.getByRole('combobox').first().click()
  await page.getByRole('option', { name, exact: true }).click()
  await expect(page.getByText(name, { exact: true })).toBeVisible()
}

async function expectContractorBalance(page, expected) {
  const label = page.getByText(text('contractorAccount.summary.balance'), { exact: true })
  await expect(label.locator('xpath=..')).toContainText(expected)
}

async function expectClientBalance(page, expected) {
  const label = page.getByText(text('clientAccount.summary.balance'), { exact: true })
  await expect(label.locator('xpath=..')).toContainText(expected)
}

async function openMovementDialog(page) {
  await page.getByRole('button', { name: text('allMovements.addMovement'), exact: true }).click()
  return page.getByRole('dialog')
}

async function addLedgerEntry(page, values) {
  const dialog = await openMovementDialog(page)
  await selectToday(page, 'ledgerEntryForm.fields.date', 'ledgerEntryForm.placeholders.date')
  await selectOption(
    page,
    'ledgerEntryForm.fields.movementType',
    text(`ledgerEntryForm.movementTypes.${values.type}`)
  )
  await formItem(page, 'common.columns.amount').getByRole('spinbutton').fill(String(values.amount))
  if (values.driver) await selectOption(page, 'ledgerEntryForm.fields.driver', values.driver)
  if (values.shift) await selectOption(page, 'ledgerEntryForm.fields.shift', values.shift)
  if (values.contractor) {
    await selectOption(page, 'ledgerEntryForm.fields.contractor', values.contractor)
  }
  await formItem(page, 'common.columns.notes').locator('textarea').fill(values.note)
  await dialog
    .getByRole('button', { name: text('contractorsSettings.addSubmit'), exact: true })
    .click()
  await expect(dialog).toBeHidden()
}

async function selectClientOnAccounts(page, clientName) {
  await section(page, 'accountsPage.sections.client')
  await selectEntity(page, clientName, 'listClients')
}

async function reloadContractorAccount(page, contractorName) {
  await page.reload()
  await section(page, 'accountsPage.sections.contractor')
  await selectEntity(page, contractorName, 'listContractors')
}

async function reloadDriverHistory(page, driverName) {
  await page.reload()
  await section(page, 'accountsPage.sections.driver')
  await selectEntity(page, driverName, 'listDrivers')
}

testWithApp(
  'ACC-1 contractor ledger adds ADVANCE, PAYMENT, and OTHER with recalculated balances',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await selectEntity(page, seedData.contractor.name, 'listContractors')

    // Two trips contribute 2 x (1 x 8 transport + 1 x 12 material); 350 in seeded entries leaves -310.
    const movements = [
      { type: 'custody', amount: 11, note: `E2E ACC-1 advance ${seedData.suffix}`, balance: -321 },
      { type: 'payment', amount: 12, note: `E2E ACC-1 payment ${seedData.suffix}`, balance: -333 },
      { type: 'other', amount: 13, note: `E2E ACC-1 other ${seedData.suffix}`, balance: -346 }
    ]
    for (const movement of movements) {
      await addLedgerEntry(page, movement)
      await expect(page.getByRole('row').filter({ hasText: movement.note })).toBeVisible()
      await expectContractorBalance(page, movement.balance.toFixed(2))
      await reloadContractorAccount(page, seedData.contractor.name)
      await expect(page.getByRole('row').filter({ hasText: movement.note })).toBeVisible()
      await expectContractorBalance(page, movement.balance.toFixed(2))
    }
  }
)

testWithApp(
  'ACC-2 contractor ledger edits an amount and deletes another entry with refreshed balance',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await selectEntity(page, seedData.contractor.name, 'listContractors')
    const freeNote = `E2E free movement ${seedData.suffix}`
    const openNote = `E2E open movement ${seedData.suffix}`
    const freeRow = page.getByRole('row').filter({ hasText: freeNote })
    await freeRow.getByRole('button', { name: text('common.edit'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await formItem(page, 'common.columns.amount').getByRole('spinbutton').fill('75')
    await dialog
      .getByRole('button', { name: text('contractorsSettings.saveEdit'), exact: true })
      .click()
    await expect(dialog).toBeHidden()
    await expect(freeRow).toContainText('75.00')
    await expectContractorBalance(page, '-335.00')
    await reloadContractorAccount(page, seedData.contractor.name)
    await expect(page.getByRole('row').filter({ hasText: freeNote })).toContainText('75.00')
    await expectContractorBalance(page, '-335.00')

    const openRow = page.getByRole('row').filter({ hasText: openNote })
    const confirmation = nextDialog(page, 'accept')
    await openRow.getByRole('button', { name: text('common.delete'), exact: true }).click()
    await confirmation
    await expect(openRow).toHaveCount(0)
    await expectContractorBalance(page, '-235.00')
    await reloadContractorAccount(page, seedData.contractor.name)
    await expect(page.getByRole('row').filter({ hasText: openNote })).toHaveCount(0)
    await expectContractorBalance(page, '-235.00')
  }
)

testWithApp(
  'ACC-3 driver history adds, edits, and deletes ledger entries',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await section(page, 'accountsPage.sections.driver')
    await selectEntity(page, seedData.driver.name, 'listDrivers')

    const movements = [
      { type: 'custody', amount: 11, note: `E2E ACC-3 advance ${seedData.suffix}` },
      { type: 'payment', amount: 12, note: `E2E ACC-3 payment ${seedData.suffix}` },
      { type: 'other', amount: 13, note: `E2E ACC-3 other ${seedData.suffix}` }
    ]
    for (const movement of movements) {
      await addLedgerEntry(page, {
        ...movement,
        contractor: seedData.contractor.name
      })
      await expect(page.getByRole('row').filter({ hasText: movement.note })).toBeVisible()
      await reloadDriverHistory(page, seedData.driver.name)
      await expect(page.getByRole('row').filter({ hasText: movement.note })).toBeVisible()
    }

    const advance = page.getByRole('row').filter({ hasText: movements[0].note })
    await advance.getByRole('button', { name: text('common.edit'), exact: true }).click()
    const editDialog = page.getByRole('dialog')
    await formItem(page, 'common.columns.amount').getByRole('spinbutton').fill('20')
    await editDialog
      .getByRole('button', { name: text('contractorsSettings.saveEdit'), exact: true })
      .click()
    await expect(editDialog).toBeHidden()
    await expect(advance).toContainText('20.00')
    await reloadDriverHistory(page, seedData.driver.name)
    await expect(page.getByRole('row').filter({ hasText: movements[0].note })).toContainText(
      '20.00'
    )

    const other = page.getByRole('row').filter({ hasText: movements[2].note })
    const confirmation = nextDialog(page, 'accept')
    await other.getByRole('button', { name: text('common.delete'), exact: true }).click()
    await confirmation
    await expect(other).toHaveCount(0)
    await reloadDriverHistory(page, seedData.driver.name)
    await expect(page.getByRole('row').filter({ hasText: movements[2].note })).toHaveCount(0)
  }
)

testWithApp(
  'ACC-4 a movement linked to an OPEN shift is saved and remains editable and deletable',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await selectEntity(page, seedData.contractor.name, 'listContractors')
    const note = `E2E ACC-4 open shift ${seedData.suffix}`
    await addLedgerEntry(page, {
      type: 'custody',
      amount: 25,
      note,
      shift: seedData.shift.id
    })
    const row = page.getByRole('row').filter({ hasText: note })
    await expect(row).toContainText(seedData.shift.id)
    await expect(row.getByRole('button', { name: text('common.edit'), exact: true })).toBeEnabled()
    await expect(
      row.getByRole('button', { name: text('common.delete'), exact: true })
    ).toBeEnabled()
    await reloadContractorAccount(page, seedData.contractor.name)
    await expect(page.getByRole('row').filter({ hasText: note })).toContainText(seedData.shift.id)
  }
)

testWithApp(
  'ACC-5 a CLOSED-shift movement is locked on contractor, driver, and all-movements ledgers',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    const note = `E2E closed movement ${seedData.suffix}`
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)

    await selectEntity(page, seedData.contractor.name, 'listContractors')
    let row = page.getByRole('row').filter({ hasText: note })
    await expect(row.getByRole('button', { name: text('common.edit'), exact: true })).toBeDisabled()
    await expect(
      row.getByRole('button', { name: text('common.edit'), exact: true })
    ).toHaveAttribute('title', text('common.lockedShift'))
    await expect(
      row.getByRole('button', { name: text('common.delete'), exact: true })
    ).toBeDisabled()
    await expect(
      row.getByRole('button', { name: text('common.delete'), exact: true })
    ).toHaveAttribute('title', text('common.lockedShift'))

    await section(page, 'accountsPage.sections.driver')
    await selectEntity(page, seedData.secondDriver.name, 'listDrivers')
    row = page.getByRole('row').filter({ hasText: note })
    await expect(row.getByRole('button', { name: text('common.edit'), exact: true })).toBeDisabled()
    await expect(
      row.getByRole('button', { name: text('common.delete'), exact: true })
    ).toBeDisabled()

    await section(page, 'accountsPage.sections.allMovements')
    row = page.getByRole('row').filter({ hasText: note })
    await expect(row.getByRole('button', { name: text('common.edit'), exact: true })).toBeDisabled()
    await expect(
      row.getByRole('button', { name: text('common.edit'), exact: true })
    ).toHaveAttribute('title', text('common.lockedShift'))
    await expect(
      row.getByRole('button', { name: text('common.delete'), exact: true })
    ).toBeDisabled()
    await expect(
      row.getByRole('button', { name: text('common.delete'), exact: true })
    ).toHaveAttribute('title', text('common.lockedShift'))
  }
)

testWithApp(
  'ACC-6 CLOSED shifts are unavailable in the form and the server rejects a crafted movement',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await section(page, 'accountsPage.sections.allMovements')
    const dialog = await openMovementDialog(page)
    const shiftField = formItem(page, 'ledgerEntryForm.fields.shift')
    await shiftField.getByRole('combobox').click()
    await expect(
      page.getByRole('option', { name: seedData.closedShift.id, exact: true })
    ).toHaveCount(0)
    await page.keyboard.press('Escape')
    await dialog.getByRole('button', { name: text('common.cancel'), exact: true }).click()
    await expect(dialog).toBeHidden()

    const note = `E2E ACC-6 rejected ${seedData.suffix}`
    const result = await callApi(page, 'createLedgerEntry', {
      entryDate: today(),
      driverId: seedData.secondDriver.id,
      movementType: 'ADVANCE',
      amount: 10,
      shiftId: seedData.closedShift.id,
      contractorId: seedData.contractor.id,
      notes: note
    })
    expect(result.ok).toBe(false)
    expect(result.errors.some((error) => error.field === 'shiftId')).toBe(true)
    await page.reload()
    await section(page, 'accountsPage.sections.allMovements')
    await expect(page.getByRole('row').filter({ hasText: note })).toHaveCount(0)
  }
)

testWithApp(
  'ACC-7 client payment add, edit to a negative amount, and delete recalculate balance',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await selectClientOnAccounts(page, seedData.client.name)
    // Two seeded trips contribute 2 x (1 x 15); no opening balance, fine, or client payment exists.
    const initialBalance = 2 * 1 * 15
    await expectClientBalance(page, initialBalance.toFixed(2))

    await page.getByRole('button', { name: text('clientAccount.addPayment'), exact: true }).click()
    let dialog = page.getByRole('dialog')
    await selectToday(
      page,
      'clientAccount.fields.paymentDate',
      'clientAccount.placeholders.paymentDate'
    )
    await formItem(page, 'common.columns.amount').getByRole('spinbutton').fill('100')
    const note = `E2E ACC-7 payment ${seedData.suffix}`
    await formItem(page, 'common.columns.notes').locator('textarea').fill(note)
    await dialog
      .getByRole('button', { name: text('clientAccount.submitPayment'), exact: true })
      .click()
    await expect(dialog).toBeHidden()
    let expected = initialBalance - 100
    await expectClientBalance(page, expected.toFixed(2))
    await expect(page.getByRole('row').filter({ hasText: note })).toContainText('100.00')
    await page.reload()
    await selectClientOnAccounts(page, seedData.client.name)
    await expectClientBalance(page, expected.toFixed(2))

    await page
      .getByRole('row')
      .filter({ hasText: note })
      .getByRole('button', { name: text('common.edit'), exact: true })
      .click()
    dialog = page.getByRole('dialog')
    await formItem(page, 'common.columns.amount').getByRole('spinbutton').fill('-25')
    await dialog
      .getByRole('button', { name: text('contractorsSettings.saveEdit'), exact: true })
      .click()
    await expect(dialog).toBeHidden()
    expected += 100 - -25
    await expectClientBalance(page, expected.toFixed(2))
    await expect(page.getByRole('row').filter({ hasText: note })).toContainText('-25.00')
    await page.reload()
    await selectClientOnAccounts(page, seedData.client.name)
    await expectClientBalance(page, expected.toFixed(2))

    const paymentRow = page.getByRole('row').filter({ hasText: note })
    const confirmation = nextDialog(page, 'accept')
    await paymentRow.getByRole('button', { name: text('common.delete'), exact: true }).click()
    await confirmation
    await expect(paymentRow).toHaveCount(0)
    expected -= 0 - -25
    await expectClientBalance(page, expected.toFixed(2))
    await page.reload()
    await selectClientOnAccounts(page, seedData.client.name)
    await expectClientBalance(page, expected.toFixed(2))
    await expect(page.getByRole('row').filter({ hasText: note })).toHaveCount(0)
  }
)

testWithApp(
  'ACC-8 All Movements filters by driver, sorts by amount, and opens notes and shift details',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await section(page, 'accountsPage.sections.allMovements')
    const note = `E2E ACC-8 filtered ${seedData.suffix}`
    await addLedgerEntry(page, {
      type: 'other',
      amount: 125,
      note,
      driver: seedData.driver.name,
      shift: seedData.shift.id
    })
    const row = page.getByRole('row').filter({ hasText: note })
    await page.reload()
    await section(page, 'accountsPage.sections.allMovements')

    const driverHeader = page
      .locator('[data-slot="table-container"]')
      .getByRole('button', { name: text('ledgerEntryForm.fields.driver'), exact: true })
    await driverHeader.click()
    await page.getByRole('option', { name: seedData.driver.name, exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: seedData.secondDriver.name })).toHaveCount(
      0
    )
    await expect(page.getByRole('row').filter({ hasText: note })).toBeVisible()
    await page.keyboard.press('Escape')
    await page
      .locator('[data-slot="table-container"]')
      .getByRole('button', { name: text('common.columns.amount'), exact: true })
      .click()
    await page.getByRole('button', { name: text('dataTable.sortAscending'), exact: true }).click()
    const amountRows = page.getByRole('row').filter({ hasText: seedData.driver.name })
    await expect(amountRows).toHaveCount(2)
    await expect(amountRows.nth(0)).toContainText('100.00')
    await expect(amountRows.nth(1)).toContainText('125.00')

    await row.getByRole('button', { name: text('common.details'), exact: true }).click()
    const details = page.locator('.react-draggable').filter({ hasText: note })
    await expect(details).toBeVisible()
    await expect(details.getByText(text('ledgerEntryDetails.notes'), { exact: true })).toBeVisible()
    await expect(details).toContainText(note)
    await expect(details.getByText(text('ledgerEntryDetails.shift'), { exact: true })).toBeVisible()
    await expect(details).toContainText(seedData.shift.id)
  }
)

testWithApp(
  'ACC-9 ledger form validates empty amount, zero amount, missing date, and resets after cancel',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)
    await section(page, 'accountsPage.sections.allMovements')
    let dialog = await openMovementDialog(page)
    await dialog
      .getByRole('button', { name: text('contractorsSettings.addSubmit'), exact: true })
      .click()
    await expect(
      formItem(page, 'common.columns.amount').locator('p.text-destructive')
    ).toBeVisible()
    await expect(
      formItem(page, 'ledgerEntryForm.fields.date').locator('p.text-destructive')
    ).toBeVisible()

    await selectToday(page, 'ledgerEntryForm.fields.date', 'ledgerEntryForm.placeholders.date')
    const amount = formItem(page, 'common.columns.amount').getByRole('spinbutton')
    await amount.fill('')
    await dialog
      .getByRole('button', { name: text('contractorsSettings.addSubmit'), exact: true })
      .click()
    await expect(
      formItem(page, 'common.columns.amount').locator('p.text-destructive')
    ).toBeVisible()
    await amount.fill('0')
    await dialog
      .getByRole('button', { name: text('contractorsSettings.addSubmit'), exact: true })
      .click()
    await expect(
      formItem(page, 'common.columns.amount').locator('p.text-destructive')
    ).toBeVisible()

    await amount.fill('5')
    await dialog.getByRole('button', { name: text('common.cancel'), exact: true }).click()
    await expect(dialog).toBeHidden()
    dialog = await openMovementDialog(page)
    await expect(formItem(page, 'ledgerEntryForm.fields.date').getByRole('button')).toContainText(
      text('ledgerEntryForm.placeholders.date')
    )
    await expect(formItem(page, 'common.columns.amount').getByRole('spinbutton')).toHaveValue('0')
    await expect(formItem(page, 'common.columns.notes').locator('textarea')).toHaveValue('')
    await dialog.getByRole('button', { name: text('common.cancel'), exact: true }).click()
    await expect(dialog).toBeHidden()
  }
)

testWithApp(
  'ACC-10 switching between contractor, driver, client, and all-movements sections clears stale rows',
  async ({ launchApp }) => {
    const app = await launchApp('accounts')
    const { page, seedData } = app
    await navigate(page, '/accounts', 'accountsPage.title')
    await expectNoRawTranslationKeys(page)

    await selectEntity(page, seedData.contractor.name, 'listContractors')
    await expect(
      page.getByRole('row').filter({ hasText: `E2E free movement ${seedData.suffix}` })
    ).toBeVisible()

    await section(page, 'accountsPage.sections.driver')
    await selectEntity(page, seedData.driver.name, 'listDrivers')
    await expect(
      page.getByRole('row').filter({ hasText: `E2E open movement ${seedData.suffix}` })
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: `E2E closed movement ${seedData.suffix}` })
    ).toHaveCount(0)

    await selectClientOnAccounts(page, seedData.client.name)
    await expect(
      page.getByText(text('clientAccount.summary.balance'), { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: `E2E open movement ${seedData.suffix}` })
    ).toHaveCount(0)

    await section(page, 'accountsPage.sections.allMovements')
    await expect(
      page.getByRole('row').filter({ hasText: `E2E free movement ${seedData.suffix}` })
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: `E2E open movement ${seedData.suffix}` })
    ).toBeVisible()
    await expect(
      page.getByRole('row').filter({ hasText: `E2E closed movement ${seedData.suffix}` })
    ).toBeVisible()
  }
)
