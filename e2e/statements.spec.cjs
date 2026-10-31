/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const { expect, text, navigate, expectNoRawTranslationKeys, testWithApp } = require('./helpers.cjs')

function statementRows(page) {
  return page.locator('[data-slot="table-container"] tbody tr')
}

async function selectStatementEntity(page, name) {
  await page.getByRole('combobox', { name: text('statementsPage.entity') }).click()
  await page.getByRole('option', { name, exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

testWithApp(
  'ST-1 client statement lists opening, trip, fine, and payment rows in order',
  async ({ launchApp }) => {
    const app = await launchApp('golden')
    const { page, seedData } = app
    await navigate(page, '/statements', 'statementsPage.title')
    await expectNoRawTranslationKeys(page)
    await selectStatementEntity(page, seedData.client.name)

    const rows = statementRows(page)
    await expect(rows).toHaveCount(4)
    await expect(rows.nth(0)).toContainText(text('statementsPage.openingBalanceDescription'))
    await expect(rows.nth(1)).toContainText(`E2E golden trip note ${seedData.suffix}`)
    await expect(rows.nth(2)).toContainText(text('statementsPage.fineDescription'))
    await expect(rows.nth(2)).toContainText(`E2E golden fine`)
    await expect(rows.nth(3)).toContainText(`E2E golden payment`)
  }
)

testWithApp(
  'ST-2 contractor statement separates transport and material, shows its sign note, and excludes material from quantity',
  async ({ launchApp }) => {
    const app = await launchApp('golden')
    const { page, seedData } = app
    await navigate(page, '/statements', 'statementsPage.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('combobox', { name: text('statementsPage.entityType') }).click()
    await page.getByRole('option', { name: text('statementsPage.contractor'), exact: true }).click()
    await selectStatementEntity(page, seedData.contractor.name)

    await expect(
      page.getByText(text('contractorAccount.balanceSignNote'), { exact: true })
    ).toBeVisible()
    const rows = statementRows(page)
    await expect(rows).toHaveCount(3)
    await expect(rows.nth(1)).toContainText(text('statementsPage.transportComponent'))
    await expect(rows.nth(2)).toContainText(text('statementsPage.materialComponent'))
    const quantity = page
      .getByText(text('statementsPage.totals.quantity'), { exact: true })
      .locator('xpath=..')
    await expect(quantity).toContainText('20')
    await expect(quantity).not.toContainText('40')
  }
)

testWithApp(
  'ST-4 statement totals precede the table and money values use grouped formatting',
  async ({ launchApp }) => {
    const app = await launchApp('golden')
    const { page, seedData } = app
    await navigate(page, '/statements', 'statementsPage.title')
    await expectNoRawTranslationKeys(page)
    await selectStatementEntity(page, seedData.client.name)

    const order = await page.evaluate(() => {
      const summary = document.querySelector('dl')
      const table = document.querySelector('[data-slot="table-container"]')
      return Boolean(
        summary &&
        table &&
        (summary.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
      )
    })
    expect(order).toBe(true)
    await expect(statementRows(page).nth(1)).toContainText('2,000.00')
    await expect(
      page.getByText(text('statementsPage.totals.value'), { exact: true }).locator('xpath=..')
    ).toContainText('2,000.00')
  }
)

testWithApp('ST-5 statement prompts before an entity is selected', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const { page } = app
  await navigate(page, '/statements', 'statementsPage.title')
  await expectNoRawTranslationKeys(page)

  await expect(page.getByText(text('statementsPage.selectPrompt'), { exact: true })).toBeVisible()
  await expect(page.locator('[data-slot="table-container"]')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
})

testWithApp(
  'ST-6 switching client selection shows only the selected client statement',
  async ({ launchApp }) => {
    const app = await launchApp('two-shifts')
    const { page, seedData } = app
    const secondClientName = `E2E Statement Client ${seedData.suffix}`
    await navigate(page, '/settings', 'settingsPage.title')
    await expectNoRawTranslationKeys(page)
    await page
      .getByRole('button', { name: text('settingsPage.sections.clients'), exact: true })
      .click()
    await page.getByRole('button', { name: text('clientsSettings.addButton'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await page.getByLabel(text('clientsSettings.fields.name')).fill(secondClientName)
    await dialog
      .getByRole('button', { name: text('contractorsSettings.addSubmit'), exact: true })
      .click()
    await expect(dialog).toBeHidden()
    await page.reload()
    await page
      .getByRole('button', { name: text('settingsPage.sections.clients'), exact: true })
      .click()
    await expect(page.getByRole('row').filter({ hasText: secondClientName })).toBeVisible()

    await navigate(page, '/statements', 'statementsPage.title')
    await expectNoRawTranslationKeys(page)
    await selectStatementEntity(page, seedData.client.name)
    await expect(statementRows(page)).toHaveCount(3)
    await selectStatementEntity(page, secondClientName)
    await expect(statementRows(page)).toHaveCount(1)
    await expect(statementRows(page).first()).toContainText(
      text('statementsPage.openingBalanceDescription')
    )
    await expect(page.getByText(text('statementsPage.noMovements'), { exact: true })).toBeVisible()
  }
)
