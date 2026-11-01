/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  text,
  today,
  navigate,
  expectNoRawTranslationKeys,
  formItem,
  fillNumber,
  selectOption,
  selectToday,
  pickDriverOnAddTrip,
  callApi,
  arabicVariants,
  testWithApp
} = require('./helpers.cjs')

function gridInput(page, labelKey, rowIndex = 0) {
  return page.getByLabel(text(labelKey), { exact: true }).nth(rowIndex)
}

function tripDetailValue(page, labelKey) {
  return page.getByText(text(labelKey), { exact: true }).last().locator('xpath=..')
}

async function fillGridName(page, labelKey, value, rowIndex = 0) {
  const input = gridInput(page, labelKey, rowIndex)
  await input.fill(value)
  await input.press('Tab')
}

async function fillGridRowAt(page, seedData, rowIndex = 0, overrides = {}) {
  const values = {
    tripDate: today(),
    client: seedData.client.name,
    crusher: seedData.crusher.name,
    materialType: seedData.materialType.name,
    clientCubic: 2,
    crusherCubic: 2,
    stonePrice: 12,
    transportPrice: 8,
    clientPrice: 15,
    notes: `E2E Add Trip ${seedData.suffix}`,
    ...overrides
  }
  const nameFields = [
    ['client', 'tripForm.fields.client'],
    ['crusher', 'tripForm.fields.crusher'],
    ['materialType', 'tripForm.fields.materialType']
  ]
  for (const [field, labelKey] of nameFields) {
    await fillGridName(page, labelKey, String(values[field]), rowIndex)
  }
  const otherFields = [
    ['tripDate', 'tripForm.fields.tripDate'],
    ['clientCubic', 'tripForm.fields.clientCubic'],
    ['crusherCubic', 'tripForm.fields.crusherCubic'],
    ['stonePrice', 'tripForm.fields.stonePrice'],
    ['transportPrice', 'tripForm.fields.transportPrice'],
    ['clientPrice', 'tripForm.fields.clientPrice'],
    ['notes', 'common.columns.notes'],
    ['clientReceiptNo', 'tripForm.fields.clientReceiptNo'],
    ['recipient', 'tripForm.fields.recipientName'],
    ['location', 'tripForm.fields.location'],
    ['fineAmount', 'tripForm.fields.fineAmount'],
    ['fineReason', 'tripForm.fields.fineReason']
  ]
  for (const [field, labelKey] of otherFields) {
    if (values[field] !== undefined) {
      await gridInput(page, labelKey, rowIndex).fill(String(values[field]))
    }
  }
}

async function createHistoryTrip(page, seedData, values) {
  const result = await callApi(page, 'createTrip', {
    shiftId: seedData.shift.id,
    tripDate: today(),
    crusherCubic: 1,
    clientCubicReported: 1,
    fineAmount: 0,
    fineReason: '',
    location: values.location,
    crusherId: seedData.crusher.id,
    stonePrice: 12,
    crusherReceiptStatus: 'UNKNOWN',
    clientId: values.clientId ?? seedData.client.id,
    transportPrice: values.transportPrice,
    clientPrice: 15,
    materialTypeId: seedData.materialType.id,
    recipientNameStatus: 'UNCLEAR',
    clientReceiptNo: '',
    notes: values.notes ?? ''
  })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('Could not create trip-price history fixture')
  return result.data
}

testWithApp(
  'ADD-1 driver without an OPEN shift shows the inline create-shift form',
  async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)

    await expect(page.getByText(text('addTrip.noOpenShift'), { exact: true })).toBeVisible()
    await expect(formItem(page, 'createShift.fields.vehicle')).toBeVisible()
    await expect(formItem(page, 'createShift.fields.startDate')).toBeVisible()
    await expect(gridInput(page, 'tripForm.fields.tripDate')).toHaveCount(0)
  }
)

testWithApp('ADD-2 create a shift inline from Add Trip', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const { page, seedData } = app
  await navigate(page, '/', 'addTrip.title')
  await expectNoRawTranslationKeys(page)
  await pickDriverOnAddTrip(page, seedData.driver.name)

  await selectOption(page, 'createShift.fields.vehicle', String(seedData.firstVehicle.vehicleNo))
  await fillNumber(page, 'createShift.fields.crusherCubic', 1)
  await fillNumber(page, 'createShift.fields.clientCubic', 1)
  await selectToday(page, 'createShift.fields.startDate', 'createShift.placeholders.startDate')
  await page.getByRole('button', { name: text('createShift.submit'), exact: true }).click()

  await expect(gridInput(page, 'tripForm.fields.tripDate')).toBeVisible()
  const createdShift = await callApi(page, 'getDriverOpenShift', {
    driverId: seedData.driver.id
  })
  expect(createdShift.ok).toBe(true)
  if (!createdShift.ok || !createdShift.data) throw new Error('Inline shift was not created')
  await expect(
    page.locator('header').last().getByText(createdShift.data.id, { exact: true })
  ).toBeVisible()
  await expect(
    page
      .locator('header')
      .last()
      .getByText(String(seedData.firstVehicle.vehicleNo), { exact: true })
  ).toBeVisible()
  await expect(
    page.locator('header').last().getByText(createdShift.data.startDate, { exact: true })
  ).toBeVisible()

  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)
  const shiftRow = page.getByRole('row').filter({ hasText: createdShift.data.id })
  await expect(shiftRow).toContainText(seedData.driver.name)
  await expect(shiftRow).toContainText(text('shiftStatus.open'))
  await page.reload()
  await expect(page.getByRole('row').filter({ hasText: createdShift.data.id })).toBeVisible()
})

testWithApp(
  'ADD-3 rapid driver switching keeps only the latest shift and chips',
  async ({ launchApp }) => {
    const app = await launchApp('two-shifts')
    const { page, seedData } = app
    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)

    const header = page.locator('header').last()
    await pickDriverOnAddTrip(page, seedData.driver.name)
    const rapidSwitch = header
      .getByRole('combobox')
      .click()
      .then(() =>
        page.getByRole('option', { name: seedData.secondDriver.name, exact: true }).click()
      )
      .then(() => header.getByRole('combobox').click())
      .then(() => page.getByRole('option', { name: seedData.driver.name, exact: true }).click())
    await rapidSwitch

    await expect(header.getByRole('combobox').first()).toContainText(seedData.driver.name)
    await expect(gridInput(page, 'tripForm.fields.tripDate')).toBeVisible()
    await expect(
      page.locator('header').last().getByText(seedData.shift.id, { exact: true })
    ).toBeVisible()
    await expect(
      page
        .locator('header')
        .last()
        .getByText(String(seedData.firstVehicle.vehicleNo), { exact: true })
    ).toBeVisible()
    await expect(page.locator('header').last().getByText(today(), { exact: true })).toBeVisible()
    await expect(
      page
        .locator('header')
        .last()
        .getByText(text('tripGrid.shiftTripCount', { count: 1 }), { exact: true })
    ).toBeVisible()
    await expect(
      page.locator('header').last().getByText(seedData.closedShift.id, { exact: true })
    ).toHaveCount(0)
    await expect(
      page
        .locator('header')
        .last()
        .getByText(String(seedData.secondVehicle.vehicleNo), { exact: true })
    ).toHaveCount(0)
  }
)

testWithApp('ADD-4 clearing the driver removes the grid and shift chips', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  await navigate(page, '/', 'addTrip.title')
  await expectNoRawTranslationKeys(page)
  await pickDriverOnAddTrip(page, seedData.driver.name)
  await expect(gridInput(page, 'tripForm.fields.tripDate')).toBeVisible()

  await page.getByRole('button', { name: text('tripGrid.clearDriver'), exact: true }).click()
  await expect(page.locator('header').getByRole('combobox').first()).toContainText(
    text('addTrip.selectDriver')
  )
  await expect(gridInput(page, 'tripForm.fields.tripDate')).toHaveCount(0)
  await expect(page.locator('header').getByText(seedData.shift.id, { exact: true })).toHaveCount(0)
  await expect(
    page.locator('header').getByText(String(seedData.firstVehicle.vehicleNo), { exact: true })
  ).toHaveCount(0)
})

testWithApp(
  'ADD-7 required-field errors stay on their rows while valid rows save',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const validClientName = `E2E ADD-7 Client ${seedData.suffix}`
    const validNote = `E2E ADD-7 valid ${seedData.suffix}`
    const client = await callApi(page, 'createClient', {
      name: validClientName,
      initialPrice: 10
    })
    expect(client.ok).toBe(true)
    if (!client.ok) throw new Error('Could not create unique valid-row client fixture')
    await page.reload()

    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)

    await fillGridName(page, 'tripForm.fields.client', validClientName)
    await fillGridName(page, 'tripForm.fields.crusher', seedData.crusher.name)
    await fillGridName(page, 'tripForm.fields.materialType', seedData.materialType.name)
    await gridInput(page, 'tripForm.fields.transportPrice').fill('8')
    await gridInput(page, 'common.columns.notes').fill(validNote)
    const invalidRows = [{ crusher: '' }, { client: '' }, { clientCubic: '' }, { crusherCubic: '' }]
    for (const [invalidIndex, values] of invalidRows.entries()) {
      await page.getByRole('button', { name: text('tripGrid.addRow'), exact: true }).click()
      const rowIndex = invalidIndex + 1
      const noteField = gridInput(page, 'common.columns.notes', rowIndex)
      await noteField.fill(`E2E ADD-7 invalid ${rowIndex} ${seedData.suffix}`)
      if ('clientCubic' in values || 'crusherCubic' in values) {
        const cubicField =
          'clientCubic' in values ? 'tripForm.fields.clientCubic' : 'tripForm.fields.crusherCubic'
        await gridInput(page, cubicField, rowIndex).fill('')
      }
      const invalidField =
        'crusher' in values
          ? 'tripForm.fields.crusher'
          : 'client' in values
            ? 'tripForm.fields.client'
            : 'clientCubic' in values
              ? 'tripForm.fields.clientCubic'
              : 'tripForm.fields.crusherCubic'
      await expect(gridInput(page, invalidField, rowIndex)).toHaveAttribute('aria-invalid', 'true')
    }

    await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).click()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))
    await expect(gridInput(page, 'tripForm.fields.crusher')).toHaveAttribute('aria-invalid', 'true')
    await expect(gridInput(page, 'tripForm.fields.client', 1)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    await expect(gridInput(page, 'tripForm.fields.clientCubic', 2)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    await expect(gridInput(page, 'tripForm.fields.crusherCubic', 3)).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    await expect(gridInput(page, 'common.columns.notes', 0)).toHaveValue(
      `E2E ADD-7 invalid 1 ${seedData.suffix}`
    )
    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    await expectNoRawTranslationKeys(page)
    const savedRow = page.getByRole('row').filter({ hasText: validClientName })
    await expect(savedRow).toBeVisible()
    await savedRow.getByRole('button', { name: text('common.details'), exact: true }).click()
    await expect(page.getByText(validNote, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: text('floatingWindow.closeAriaLabel') }).click()
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: validClientName })).toBeVisible()
    const trips = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    expect(trips.ok).toBe(true)
    if (!trips.ok) throw new Error('Could not verify required-field save results')
    expect(trips.data.filter((trip) => trip.notes === validNote)).toHaveLength(1)
  }
)

testWithApp(
  'ADD-8 paste maps quoted TSV cells and ignores blank lines and trailing newline',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)

    const headerKeys = [
      'tripForm.fields.tripDate',
      'tripForm.fields.client',
      'tripForm.fields.crusher',
      'tripForm.fields.materialType',
      'tripForm.fields.clientCubic',
      'tripForm.fields.crusherCubic',
      'tripForm.fields.stonePrice',
      'tripForm.fields.transportPrice',
      'tripForm.fields.clientPrice',
      'tripForm.fields.crusherReceiptNumber',
      'common.columns.notes'
    ]
    const header = headerKeys.map((key) => text(key)).join('\t')
    const quote = (value) => `"${value.replaceAll('"', '""')}"`
    const firstNote = `E2E ADD-8 "quoted"\tcell ${seedData.suffix}`
    const secondNote = `E2E ADD-8 second ${seedData.suffix}`
    const row = (clientCubic, crusherCubic, stonePrice, transportPrice, clientPrice, notes) =>
      [
        today(),
        seedData.client.name,
        seedData.crusher.name,
        seedData.materialType.name,
        clientCubic,
        crusherCubic,
        stonePrice,
        transportPrice,
        clientPrice,
        '',
        quote(notes)
      ].join('\t')
    const clipboardText = [
      header,
      row('2', '3', '12', '8', '15', firstNote),
      '',
      row('4', '5', '13', '9', '16', secondNote),
      ''
    ].join('\n')
    const eventWasCancelled = await gridInput(page, 'tripForm.fields.tripDate').evaluate(
      (input, clipboard) => {
        const clipboardData = new DataTransfer()
        clipboardData.setData('text/plain', clipboard)
        const event = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData
        })
        return !input.dispatchEvent(event)
      },
      clipboardText
    )
    expect(eventWasCancelled).toBe(true)

    const expectedRows = [
      {
        values: ['2', '3', '12', '8', '15', firstNote],
        fields: [
          'tripForm.fields.clientCubic',
          'tripForm.fields.crusherCubic',
          'tripForm.fields.stonePrice',
          'tripForm.fields.transportPrice',
          'tripForm.fields.clientPrice',
          'common.columns.notes'
        ]
      },
      {
        values: ['4', '5', '13', '9', '16', secondNote],
        fields: [
          'tripForm.fields.clientCubic',
          'tripForm.fields.crusherCubic',
          'tripForm.fields.stonePrice',
          'tripForm.fields.transportPrice',
          'tripForm.fields.clientPrice',
          'common.columns.notes'
        ]
      }
    ]
    await expect(page.getByLabel(text('tripForm.fields.client'), { exact: true })).toHaveCount(2)
    for (const [rowIndex, expected] of expectedRows.entries()) {
      await expect(gridInput(page, 'tripForm.fields.tripDate', rowIndex)).toHaveValue(today())
      await expect(gridInput(page, 'tripForm.fields.crusherReceiptNumber', rowIndex)).toHaveValue(
        ''
      )
      await expect(gridInput(page, 'tripForm.fields.client', rowIndex)).toHaveValue(
        seedData.client.name
      )
      await expect(gridInput(page, 'tripForm.fields.crusher', rowIndex)).toHaveValue(
        seedData.crusher.name
      )
      await expect(gridInput(page, 'tripForm.fields.materialType', rowIndex)).toHaveValue(
        seedData.materialType.name
      )
      for (const [index, field] of expected.fields.entries()) {
        await expect(gridInput(page, field, rowIndex)).toHaveValue(expected.values[index])
      }
    }
  }
)

testWithApp(
  'ADD-9 suggestions use last trip and entity defaults per material',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const materialName = `E2E ADD-9 Material ${seedData.suffix}`
    const material = await callApi(page, 'createMaterialType', { name: materialName })
    expect(material.ok).toBe(true)
    if (!material.ok) throw new Error('Could not create second material fixture')
    await page.reload()

    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)
    await fillGridName(page, 'tripForm.fields.client', seedData.client.name)
    await fillGridName(page, 'tripForm.fields.crusher', seedData.crusher.name)
    await fillGridName(page, 'tripForm.fields.materialType', seedData.materialType.name)
    await expect(gridInput(page, 'tripForm.fields.stonePrice')).toHaveValue('12')
    await expect(gridInput(page, 'tripForm.fields.clientPrice')).toHaveValue('15')
    await expect(gridInput(page, 'tripForm.fields.stonePrice')).toHaveClass(/bg-amber-50/)
    await expect(gridInput(page, 'tripForm.fields.clientPrice')).toHaveClass(/bg-amber-50/)

    await page.getByRole('button', { name: text('tripGrid.addRow'), exact: true }).click()
    await fillGridName(page, 'tripForm.fields.client', seedData.client.name, 1)
    await fillGridName(page, 'tripForm.fields.crusher', seedData.crusher.name, 1)
    await fillGridName(page, 'tripForm.fields.materialType', materialName, 1)
    await expect(gridInput(page, 'tripForm.fields.stonePrice', 1)).toHaveValue('7')
    await expect(gridInput(page, 'tripForm.fields.clientPrice', 1)).toHaveValue('12')
    await expect(gridInput(page, 'tripForm.fields.stonePrice', 1)).toHaveClass(/bg-amber-50/)
    await expect(gridInput(page, 'tripForm.fields.clientPrice', 1)).toHaveClass(/bg-amber-50/)
  }
)

testWithApp(
  'ADD-10 transport suggestion prefers location, falls back to client, or stays empty',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const exactLocation = `E2E ADD-10 Exact ${seedData.suffix}`
    const fallbackLocation = `E2E ADD-10 Fallback ${seedData.suffix}`
    const noHistoryClient = `E2E ADD-10 Client ${seedData.suffix}`

    await createHistoryTrip(page, seedData, {
      location: exactLocation,
      transportPrice: 22
    })
    await createHistoryTrip(page, seedData, { location: '', transportPrice: 19 })
    const client = await callApi(page, 'createClient', {
      name: noHistoryClient,
      initialPrice: 10
    })
    expect(client.ok).toBe(true)
    if (!client.ok) throw new Error('Could not create no-history client fixture')
    await page.reload()

    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)
    await page.getByRole('button', { name: text('tripGrid.showExtra'), exact: true }).click()
    await fillGridName(page, 'tripForm.fields.client', seedData.client.name)
    await fillGridName(page, 'tripForm.fields.crusher', seedData.crusher.name)
    await fillGridName(page, 'tripForm.fields.materialType', seedData.materialType.name)
    await gridInput(page, 'tripForm.fields.location').fill(exactLocation)
    await expect(gridInput(page, 'tripForm.fields.transportPrice')).toHaveValue('22')

    await page.getByRole('button', { name: text('tripGrid.addRow'), exact: true }).click()
    await fillGridName(page, 'tripForm.fields.client', seedData.client.name, 1)
    await fillGridName(page, 'tripForm.fields.crusher', seedData.crusher.name, 1)
    await fillGridName(page, 'tripForm.fields.materialType', seedData.materialType.name, 1)
    await gridInput(page, 'tripForm.fields.location', 1).fill(fallbackLocation)
    await expect(gridInput(page, 'tripForm.fields.transportPrice', 1)).toHaveValue('19')

    await page.getByRole('button', { name: text('tripGrid.addRow'), exact: true }).click()
    await fillGridName(page, 'tripForm.fields.client', noHistoryClient, 2)
    await fillGridName(page, 'tripForm.fields.crusher', seedData.crusher.name, 2)
    await fillGridName(page, 'tripForm.fields.materialType', seedData.materialType.name, 2)
    await gridInput(page, 'tripForm.fields.location', 2).fill(fallbackLocation)
    await expect(gridInput(page, 'tripForm.fields.transportPrice', 2)).toHaveValue('')
  }
)

testWithApp(
  'ADD-11 suggestions refresh on material change without overwriting edited prices',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const clientName = `E2E ADD-11 Client ${seedData.suffix}`
    const note = `E2E ADD-11 ${seedData.suffix}`
    const client = await callApi(page, 'createClient', { name: clientName, initialPrice: 10 })
    expect(client.ok).toBe(true)
    if (!client.ok) throw new Error('Could not create ADD-11 client fixture')
    await createHistoryTrip(page, seedData, {
      clientId: client.data.id,
      location: '',
      transportPrice: 8
    })
    await page.reload()

    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)

    await fillGridName(page, 'tripForm.fields.client', clientName)
    await fillGridName(page, 'tripForm.fields.crusher', seedData.crusher.name)
    await expect(gridInput(page, 'tripForm.fields.stonePrice')).toHaveValue('7')
    await expect(gridInput(page, 'tripForm.fields.clientPrice')).toHaveValue('10')
    await gridInput(page, 'tripForm.fields.clientPrice').fill('31')
    await fillGridName(page, 'tripForm.fields.materialType', seedData.materialType.name)
    await expect(gridInput(page, 'tripForm.fields.stonePrice')).toHaveValue('12')
    await expect(gridInput(page, 'tripForm.fields.clientPrice')).toHaveValue('31')

    await fillGridRowAt(page, seedData, 0, {
      client: clientName,
      clientCubic: 3,
      clientPrice: '31',
      notes: note
    })
    await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).click()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))
    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    const clientRows = page.getByRole('row').filter({ hasText: clientName })
    await expect(clientRows).toHaveCount(2)
    let savedRow
    for (let rowIndex = 0; rowIndex < 2; rowIndex += 1) {
      const row = clientRows.nth(rowIndex)
      const cellTexts = await row.locator('[data-slot="table-cell"]').allInnerTexts()
      if (cellTexts.includes('3')) savedRow = row
    }
    expect(savedRow).toBeDefined()
    if (!savedRow) throw new Error('Could not locate ADD-11 saved trip row')
    await expect(savedRow).toBeVisible()
    await savedRow.getByRole('button', { name: text('common.details'), exact: true }).click()
    await expect(page.getByText(note, { exact: true })).toBeVisible()
    await page.getByRole('button', { name: text('floatingWindow.closeAriaLabel') }).click()
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: clientName })).toHaveCount(2)
    const trips = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    expect(trips.ok).toBe(true)
    if (!trips.ok) throw new Error('Could not verify saved material suggestion trip')
    expect(trips.data.some((trip) => trip.notes === note)).toBe(true)
  }
)

testWithApp(
  'ADD-11 material is optional for suggestions but required to save',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const clientName = `E2E ADD-11 Client ${seedData.suffix}`
    const note = `E2E ADD-11 material required ${seedData.suffix}`
    const client = await callApi(page, 'createClient', { name: clientName, initialPrice: 10 })
    expect(client.ok).toBe(true)
    if (!client.ok) throw new Error('Could not create ADD-11 client fixture')
    await createHistoryTrip(page, seedData, {
      clientId: client.data.id,
      location: '',
      transportPrice: 8
    })
    await page.reload()

    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)
    await fillGridName(page, 'tripForm.fields.client', clientName)
    await fillGridName(page, 'tripForm.fields.crusher', seedData.crusher.name)

    await expect(gridInput(page, 'tripForm.fields.stonePrice')).toHaveValue('7')
    await expect(gridInput(page, 'tripForm.fields.clientPrice')).toHaveValue('10')
    const material = gridInput(page, 'tripForm.fields.materialType')
    await expect(material).toHaveValue('')
    await expect(material).toHaveAttribute('aria-invalid', 'true')
    const saveButton = page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true })
    await expect(saveButton).toBeDisabled()
    let trips = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    expect(trips.ok).toBe(true)
    if (!trips.ok) throw new Error('Could not verify trip absence before material selection')
    expect(trips.data.some((trip) => trip.notes === note)).toBe(false)

    await fillGridName(page, 'tripForm.fields.materialType', seedData.materialType.name)
    await expect(material).toHaveAttribute('aria-invalid', 'false')
    await expect(gridInput(page, 'tripForm.fields.stonePrice')).toHaveValue('12')
    await expect(gridInput(page, 'tripForm.fields.clientPrice')).toHaveValue('15')
    await gridInput(page, 'common.columns.notes').fill(note)
    await expect(saveButton).toBeEnabled()
    await saveButton.click()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))
    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    const savedClientRows = page.getByRole('row').filter({ hasText: clientName })
    await expect(savedClientRows).toHaveCount(2)
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: clientName })).toHaveCount(2)
    trips = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    expect(trips.ok).toBe(true)
    if (!trips.ok) throw new Error('Could not verify saved trip after material selection')
    expect(trips.data.some((trip) => trip.notes === note)).toBe(true)
  }
)

testWithApp(
  'ADD-12 Ctrl+D copies only the focused column from the row above',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)

    await gridInput(page, 'tripForm.fields.clientCubic').fill('3')
    await gridInput(page, 'tripForm.fields.stonePrice').fill('17')
    await page.getByRole('button', { name: text('tripGrid.addRow'), exact: true }).click()
    await expect(gridInput(page, 'tripForm.fields.clientCubic', 1)).toHaveValue('1')
    await gridInput(page, 'tripForm.fields.clientCubic', 1).press('Control+d')

    await expect(gridInput(page, 'tripForm.fields.clientCubic', 1)).toHaveValue('3')
    await expect(gridInput(page, 'tripForm.fields.stonePrice', 1)).toHaveValue('')
    await expect(gridInput(page, 'tripForm.fields.client', 1)).toHaveValue('')
  }
)

testWithApp(
  'ADD-13 comma-formatted cubic values are invalid and are not saved',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)
    const tripsBefore = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    expect(tripsBefore.ok).toBe(true)
    if (!tripsBefore.ok) throw new Error('Could not read initial trip count')

    const cubic = gridInput(page, 'tripForm.fields.clientCubic')
    for (const invalidValue of ['1,5', '1,000']) {
      await cubic.fill(invalidValue)
      await expect(cubic).toHaveAttribute('aria-invalid', 'true')
      await expect(page.getByRole('button', { name: text('tripGrid.saveAll') })).toBeDisabled()
    }
    const tripsAfter = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    expect(tripsAfter.ok).toBe(true)
    if (!tripsAfter.ok) throw new Error('Could not read trip count after invalid cubic input')
    expect(tripsAfter.data).toHaveLength(tripsBefore.data.length)
  }
)

testWithApp(
  'ADD-14 normalized Arabic client names resolve and ambiguous variants are flagged',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const variants = arabicVariants()
    const matchingClient = await callApi(page, 'createClient', {
      name: variants.matching.stored,
      initialPrice: 11
    })
    expect(matchingClient.ok).toBe(true)
    if (!matchingClient.ok) throw new Error('Could not create normalized-name fixture')
    await page.reload()

    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)
    await fillGridRowAt(page, seedData, 0, {
      client: variants.matching.input,
      notes: `E2E ADD-14 matching ${seedData.suffix}`
    })
    await expect(gridInput(page, 'tripForm.fields.client')).toHaveAttribute('aria-invalid', 'false')
    await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).click()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))
    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    await expect(page.getByRole('row').filter({ hasText: variants.matching.stored })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: variants.matching.stored })).toBeVisible()

    const ambiguousClient = await callApi(page, 'createClient', {
      name: variants.ambiguous.second,
      initialPrice: 13
    })
    expect(ambiguousClient.ok).toBe(true)
    if (!ambiguousClient.ok) throw new Error('Could not create ambiguous-name fixture')
    await page.reload()
    await navigate(page, '/', 'addTrip.title')
    await pickDriverOnAddTrip(page, seedData.driver.name)
    await gridInput(page, 'tripForm.fields.client').fill(variants.ambiguous.input)
    await gridInput(page, 'tripForm.fields.client').press('Tab')
    await expect(gridInput(page, 'tripForm.fields.client')).toHaveAttribute('aria-invalid', 'true')
  }
)

testWithApp(
  'ADD-16 saved trips appear with the same values in All Trips and Shift Details',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const clientName = `E2E ADD-16 Client ${seedData.suffix}`
    const note = `E2E ADD-16 note ${seedData.suffix}`
    const client = await callApi(page, 'createClient', { name: clientName, initialPrice: 10 })
    expect(client.ok).toBe(true)
    if (!client.ok) throw new Error('Could not create unique client fixture')
    await page.reload()

    await navigate(page, '/', 'addTrip.title')
    await expectNoRawTranslationKeys(page)
    await pickDriverOnAddTrip(page, seedData.driver.name)
    await fillGridRowAt(page, seedData, 0, {
      client: clientName,
      clientCubic: 3,
      crusherCubic: 4,
      stonePrice: 9,
      transportPrice: 7,
      clientPrice: 18,
      notes: note
    })
    await page.getByRole('button', { name: text('tripGrid.saveAll'), exact: true }).click()
    await expect(page.getByRole('status')).toContainText(text('tripGrid.savedNotice', { count: 1 }))

    const trips = await callApi(page, 'listTripsByShift', { shiftId: seedData.shift.id })
    expect(trips.ok).toBe(true)
    if (!trips.ok) throw new Error('Could not read saved trip')
    const savedTrip = trips.data.find((trip) => trip.notes === note)
    expect(savedTrip).toBeDefined()
    if (!savedTrip) throw new Error('Saved ADD-16 trip is missing')

    await navigate(page, '/all-trips', 'allTrips.title')
    await expectNoRawTranslationKeys(page)
    const allTripsRow = page.getByRole('row').filter({ hasText: clientName })
    await expect(allTripsRow).toContainText(seedData.crusher.name)
    await expect(allTripsRow).toContainText('3')
    await allTripsRow.getByRole('button', { name: text('common.details'), exact: true }).click()
    await expect(page.getByText(note, { exact: true })).toBeVisible()
    await expect(tripDetailValue(page, 'tripForm.fields.clientPrice')).toContainText('18.00')
    await page.getByRole('button', { name: text('floatingWindow.closeAriaLabel') }).click()

    await page.reload()
    await expect(page.getByRole('row').filter({ hasText: clientName })).toBeVisible()
    await navigate(page, '/shifts', 'shifts.title')
    await expectNoRawTranslationKeys(page)
    await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
    await expect(page).toHaveURL(new RegExp(`/shifts/${seedData.shift.id}$`))
    await expectNoRawTranslationKeys(page)

    const shiftTripRow = page.getByRole('row').filter({ hasText: savedTrip.id })
    await expect(shiftTripRow).toContainText(today())
    await expect(shiftTripRow).toContainText('4')
    await expect(shiftTripRow).toContainText('3')
    await expect(shiftTripRow).toContainText('18.00')
    await shiftTripRow.getByRole('button', { name: text('common.details'), exact: true }).click()
    await expect(page.getByText(note, { exact: true })).toBeVisible()
    await expect(tripDetailValue(page, 'tripForm.fields.clientPrice')).toContainText('18.00')
  }
)
