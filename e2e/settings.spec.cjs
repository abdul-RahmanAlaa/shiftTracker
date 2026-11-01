/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  text,
  today,
  navigate,
  expectNoRawTranslationKeys,
  formItem,
  nextDialog,
  expectNotice,
  testWithApp
} = require('./helpers.cjs')

function inputField(key, labelKey, placeholderKey = labelKey) {
  return { key, labelKey, control: 'input', placeholderKey }
}

function selectField(key, labelKey, placeholderKey) {
  return { key, labelKey, control: 'select', placeholderKey }
}

const entityConfigs = [
  {
    name: 'vehicle',
    sectionKey: 'vehicles',
    fields: [
      inputField('vehicleNo', 'vehiclesSettings.fields.vehicleNo'),
      inputField('trailerNo', 'vehiclesSettings.fields.trailerNo'),
      selectField(
        'contractorId',
        'ledgerEntryForm.fields.contractor',
        'ledgerEntryForm.placeholders.contractor'
      ),
      inputField('defaultCubic', 'vehiclesSettings.fields.defaultCubic'),
      inputField('ownerName', 'vehiclesSettings.fields.ownerName')
    ],
    requiredFields: [
      { key: 'vehicleNo', validationKey: 'vehiclesSettings.validation.vehicleNoRequired' },
      { key: 'trailerNo', validationKey: 'vehiclesSettings.validation.trailerNoRequired' },
      { key: 'contractorId', validationKey: 'vehiclesSettings.validation.contractorRequired' }
    ],
    uniqueField: 'vehicleNo',
    rowText: (seedData) => String(seedData.firstVehicle.vehicleNo),
    seedValues: (seedData) => ({
      vehicleNo: String(seedData.firstVehicle.vehicleNo),
      trailerNo: String(seedData.firstVehicle.vehicleNo + 100),
      contractorId: seedData.contractor.name,
      defaultCubic: '',
      ownerName: ''
    }),
    createValues: (seedData) => ({
      vehicleNo: String(80000 + (Number(seedData.suffix.slice(-3)) || 1)),
      trailerNo: String(81000 + (Number(seedData.suffix.slice(-3)) || 1)),
      contractorId: seedData.contractor.name,
      defaultCubic: '3.5',
      ownerName: `E2E Vehicle Owner ${seedData.suffix}`
    }),
    editValues: (seedData) => ({
      vehicleNo: String(seedData.firstVehicle.vehicleNo),
      trailerNo: String(seedData.firstVehicle.vehicleNo + 600),
      contractorId: seedData.contractor.name,
      defaultCubic: '2.5',
      ownerName: `E2E Vehicle Owner Edit ${seedData.suffix}`
    }),
    deleteConfirmationKey: 'vehiclesSettings.deleteConfirmation',
    confirmationValues: (seedData) => ({ vehicleNo: seedData.firstVehicle.vehicleNo })
  },
  {
    name: 'driver',
    sectionKey: 'drivers',
    fields: [
      inputField('name', 'driversSettings.fields.name'),
      inputField('phone1', 'driversSettings.phone1'),
      inputField('phone2', 'driversSettings.phone2')
    ],
    requiredFields: [{ key: 'name', validationKey: 'driversSettings.validation.nameRequired' }],
    uniqueField: 'name',
    rowText: (seedData) => seedData.driver.name,
    seedValues: (seedData) => ({ name: seedData.driver.name, phone1: '', phone2: '' }),
    createValues: (seedData) => ({
      name: `E2E New Driver ${seedData.suffix}`,
      phone1: `555${seedData.suffix.slice(-8)}`,
      phone2: ''
    }),
    editValues: (seedData) => ({
      name: `E2E Edited Driver ${seedData.suffix}`,
      phone1: `555${seedData.suffix.slice(-8)}`,
      phone2: '5550102'
    }),
    deleteConfirmationKey: 'driversSettings.deleteConfirmation',
    confirmationValues: (seedData) => ({ name: seedData.driver.name })
  },
  {
    name: 'contractor',
    sectionKey: 'contractors',
    fields: [
      inputField('name', 'contractorsSettings.fields.name'),
      inputField('phone', 'contractorsSettings.phoneNumber'),
      inputField('openingBalance', 'common.openingBalance'),
      inputField('openingBalanceDate', 'common.openingBalanceDate')
    ],
    requiredFields: [{ key: 'name', validationKey: 'contractorsSettings.validation.nameRequired' }],
    uniqueField: 'name',
    rowText: (seedData) => seedData.contractor.name,
    seedValues: (seedData) => ({
      name: seedData.contractor.name,
      phone: '',
      openingBalance: '0',
      openingBalanceDate: ''
    }),
    createValues: (seedData) => ({
      name: `E2E New Contractor ${seedData.suffix}`,
      phone: `555${seedData.suffix.slice(-8)}`,
      openingBalance: '',
      openingBalanceDate: ''
    }),
    editValues: (seedData) => ({
      name: `E2E Edited Contractor ${seedData.suffix}`,
      phone: `555${seedData.suffix.slice(-8)}`,
      openingBalance: '125.50',
      openingBalanceDate: today()
    }),
    deleteConfirmationKey: 'contractorsSettings.deleteConfirmation',
    confirmationValues: (seedData) => ({ name: seedData.contractor.name })
  },
  {
    name: 'crusher',
    sectionKey: 'crushers',
    fields: [
      inputField('name', 'crushersSettings.fields.name'),
      inputField('initialPrice', 'common.defaultPrice')
    ],
    requiredFields: [{ key: 'name', validationKey: 'crushersSettings.validation.nameRequired' }],
    uniqueField: 'name',
    rowText: (seedData) => seedData.crusher.name,
    seedValues: (seedData) => ({ name: seedData.crusher.name, initialPrice: '7' }),
    createValues: (seedData) => ({
      name: `E2E New Crusher ${seedData.suffix}`,
      initialPrice: '9.25'
    }),
    editValues: (seedData) => ({
      name: `E2E Edited Crusher ${seedData.suffix}`,
      initialPrice: '8.5'
    }),
    deleteConfirmationKey: 'crushersSettings.deleteConfirmation',
    confirmationValues: (seedData) => ({ name: seedData.crusher.name })
  },
  {
    name: 'client',
    sectionKey: 'clients',
    fields: [
      inputField('name', 'clientsSettings.fields.name'),
      inputField('initialPrice', 'common.defaultPrice'),
      inputField('location', 'clientsSettings.fields.location'),
      inputField('openingBalance', 'common.openingBalance'),
      inputField('openingBalanceDate', 'common.openingBalanceDate')
    ],
    requiredFields: [{ key: 'name', validationKey: 'clientsSettings.validation.nameRequired' }],
    uniqueField: 'name',
    rowText: (seedData) => seedData.client.name,
    seedValues: (seedData) => ({
      name: seedData.client.name,
      initialPrice: '12',
      location: '',
      openingBalance: '0',
      openingBalanceDate: ''
    }),
    createValues: (seedData) => ({
      name: `E2E New Client ${seedData.suffix}`,
      initialPrice: '16.25',
      location: `E2E Location ${seedData.suffix}`,
      openingBalance: '',
      openingBalanceDate: ''
    }),
    editValues: (seedData) => ({
      name: `E2E Edited Client ${seedData.suffix}`,
      initialPrice: '17.5',
      location: `E2E Updated Location ${seedData.suffix}`,
      openingBalance: '75.25',
      openingBalanceDate: today()
    }),
    deleteConfirmationKey: 'clientsSettings.deleteConfirmation',
    confirmationValues: (seedData) => ({ name: seedData.client.name })
  },
  {
    name: 'material type',
    sectionKey: 'materialTypes',
    fields: [inputField('name', 'materialTypesSettings.fields.name')],
    requiredFields: [
      { key: 'name', validationKey: 'materialTypesSettings.validation.nameRequired' }
    ],
    uniqueField: 'name',
    rowText: (seedData) => seedData.materialType.name,
    seedValues: (seedData) => ({ name: seedData.materialType.name }),
    createValues: (seedData) => ({ name: `E2E New Material ${seedData.suffix}` }),
    editValues: (seedData) => ({ name: `E2E Edited Material ${seedData.suffix}` }),
    deleteConfirmationKey: 'materialTypesSettings.deleteConfirmation',
    confirmationValues: (seedData) => ({ name: seedData.materialType.name })
  }
]

function fieldControl(dialog, field) {
  const item = formItem(dialog, field.labelKey)
  return field.control === 'select' ? item.getByRole('combobox') : item.locator('input')
}

function settingsKeyFor(config) {
  return config.name === 'material type' ? 'materialTypesSettings' : `${config.sectionKey}Settings`
}

async function setField(page, dialog, field, value) {
  const control = fieldControl(dialog, field)
  if (await control.isDisabled()) {
    if (field.control === 'select') {
      await expect(control).toContainText(String(value))
    } else {
      await expect(control).toHaveValue(String(value))
    }
    return
  }
  if (field.control === 'select') {
    await control.click()
    await page.getByRole('option', { name: String(value), exact: true }).click()
  } else {
    await control.fill(String(value))
  }
}

async function fillValues(page, dialog, config, values) {
  for (const field of config.fields) {
    if (Object.prototype.hasOwnProperty.call(values, field.key)) {
      await setField(page, dialog, field, values[field.key])
    }
  }
}

async function expectFieldValues(dialog, config, values) {
  for (const field of config.fields) {
    const control = fieldControl(dialog, field)
    if (field.control === 'select') {
      await expect(control).toContainText(String(values[field.key]))
    } else {
      await expect(control).toHaveValue(String(values[field.key] ?? ''))
    }
  }
}

async function openSettings(page, config) {
  await navigate(page, '/settings', 'settingsPage.title')
  await expectNoRawTranslationKeys(page)
  await page
    .getByRole('button', { name: text(`settingsPage.sections.${config.sectionKey}`), exact: true })
    .click()
  await expect(
    page.getByRole('button', {
      name: text(`${settingsKeyFor(config)}.addButton`),
      exact: true
    })
  ).toBeVisible()
}

async function openAdd(page, config) {
  const settingsKey = settingsKeyFor(config)
  await page.getByRole('button', { name: text(`${settingsKey}.addButton`), exact: true }).click()
  return page.getByRole('dialog')
}

function findRow(page, rowText) {
  return page
    .getByRole('row')
    .filter({ hasText: String(rowText) })
    .first()
}

async function submitDialog(page, dialog, editing = false) {
  const submitKey = editing ? 'contractorsSettings.saveEdit' : 'contractorsSettings.addSubmit'
  await dialog.getByRole('button', { name: text(submitKey), exact: true }).click()
}

for (const config of entityConfigs) {
  testWithApp(`SET-1 create (${config.name})`, async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await openSettings(page, config)
    const values = config.createValues(seedData)
    const dialog = await openAdd(page, config)
    await fillValues(page, dialog, config, values)
    await submitDialog(page, dialog)
    await expect(dialog).toBeHidden()
    await expect(findRow(page, values[config.uniqueField])).toBeVisible()
    await page.reload()
    await page
      .getByRole('button', {
        name: text(`settingsPage.sections.${config.sectionKey}`),
        exact: true
      })
      .click()
    await expect(findRow(page, values[config.uniqueField])).toBeVisible()
  })

  testWithApp(`SET-2 edit hydration and save (${config.name})`, async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await openSettings(page, config)
    const originalRowText = config.rowText(seedData)
    const row = findRow(page, originalRowText)
    await row.getByRole('button', { name: text('common.edit'), exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expectFieldValues(dialog, config, config.seedValues(seedData))
    const values = config.editValues(seedData)
    await fillValues(page, dialog, config, values)
    await submitDialog(page, dialog, true)
    await expect(dialog).toBeHidden()
    await expect(findRow(page, values[config.uniqueField])).toBeVisible()
    await page.reload()
    await page
      .getByRole('button', {
        name: text(`settingsPage.sections.${config.sectionKey}`),
        exact: true
      })
      .click()
    await expect(findRow(page, values[config.uniqueField])).toBeVisible()
  })

  testWithApp(`SET-3 delete unreferenced row (${config.name})`, async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await openSettings(page, config)
    const values = config.createValues(seedData)
    const dialog = await openAdd(page, config)
    await fillValues(page, dialog, config, values)
    await submitDialog(page, dialog)
    await expect(dialog).toBeHidden()
    const row = findRow(page, values[config.uniqueField])
    await expect(row).toBeVisible()
    const confirmation = nextDialog(page, 'accept')
    await row.getByRole('button', { name: text('common.delete'), exact: true }).click()
    expect(await confirmation).toBe(
      text(
        config.deleteConfirmationKey,
        config.name === 'vehicle' ? { vehicleNo: values.vehicleNo } : { name: values.name }
      )
    )
    await expect(row).toHaveCount(0)
    await page.reload()
    await page
      .getByRole('button', {
        name: text(`settingsPage.sections.${config.sectionKey}`),
        exact: true
      })
      .click()
    await expect(findRow(page, values[config.uniqueField])).toHaveCount(0)
  })

  testWithApp(`SET-4 required fields (${config.name})`, async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await openSettings(page, config)
    const dialog = await openAdd(page, config)
    await submitDialog(page, dialog)
    for (const requiredField of config.requiredFields) {
      await expect(
        formItem(
          dialog,
          config.fields.find((field) => field.key === requiredField.key).labelKey
        ).locator('p.text-destructive')
      ).toBeVisible()
    }
    await dialog.getByRole('button', { name: text('common.cancel'), exact: true }).click()
    await page.reload()
    await page
      .getByRole('button', {
        name: text(`settingsPage.sections.${config.sectionKey}`),
        exact: true
      })
      .click()
    await expect(findRow(page, config.createValues(seedData)[config.uniqueField])).toHaveCount(0)
  })

  testWithApp(`SET-5 duplicate key (${config.name})`, async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await openSettings(page, config)
    await expect(findRow(page, config.rowText(seedData))).toBeVisible()
    const duplicateValues = config.createValues(seedData)
    const seededValues = config.seedValues(seedData)
    duplicateValues[config.uniqueField] = seededValues[config.uniqueField]
    const dialog = await openAdd(page, config)
    await fillValues(page, dialog, config, duplicateValues)
    await submitDialog(page, dialog)
    await expect(dialog).toBeVisible()
    const uniqueField = config.fields.find((field) => field.key === config.uniqueField)
    await expect(formItem(dialog, uniqueField.labelKey).locator('p.text-destructive')).toBeVisible()
    await dialog.getByRole('button', { name: text('common.cancel'), exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.reload()
    await page
      .getByRole('button', {
        name: text(`settingsPage.sections.${config.sectionKey}`),
        exact: true
      })
      .click()
    await expect(findRow(page, duplicateValues[config.uniqueField])).toHaveCount(1)
  })

  const runBlankAddTest = async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await openSettings(page, config)
    await findRow(page, config.rowText(seedData))
      .getByRole('button', { name: text('common.edit'), exact: true })
      .click()
    const editDialog = page.getByRole('dialog')
    await editDialog.getByRole('button', { name: text('common.cancel'), exact: true }).click()
    await expect(editDialog).toBeHidden()
    const addDialog = await openAdd(page, config)
    for (const field of config.fields) {
      const control = fieldControl(addDialog, field)
      if (field.control === 'select') {
        await expect(control).toContainText(text(field.placeholderKey))
      } else {
        await expect(control).toHaveValue('')
      }
    }
  }

  if (config.name === 'vehicle' || config.name === 'driver') {
    // BUG-1: Opening Add after Edit retains the edited vehicle or driver values.
    testWithApp.fixme(`SET-6 Add dialog is blank after Edit (${config.name})`, runBlankAddTest)
  } else {
    testWithApp(`SET-6 Add dialog is blank after Edit (${config.name})`, runBlankAddTest)
  }
}

for (const config of entityConfigs) {
  testWithApp(`SET-7 blocked delete (${config.name})`, async ({ launchApp }) => {
    const app = await launchApp('references')
    const { page, seedData } = app
    await openSettings(page, config)
    const rowText = config.rowText(seedData)
    const row = findRow(page, rowText)
    await expect(row).toBeVisible()
    const confirmation = nextDialog(page, 'accept')
    await row.getByRole('button', { name: text('common.delete'), exact: true }).click()
    const values =
      config.name === 'vehicle'
        ? { vehicleNo: seedData.firstVehicle.vehicleNo }
        : config.confirmationValues(seedData)
    expect(await confirmation).toBe(text(config.deleteConfirmationKey, values))
    await expectNotice(page, 'ipcErrors.deleteFailed')
    await expect(row).toBeVisible()
    await page.reload()
    await page
      .getByRole('button', {
        name: text(`settingsPage.sections.${config.sectionKey}`),
        exact: true
      })
      .click()
    await expect(findRow(page, rowText)).toBeVisible()
  })
}

for (const entityName of ['client', 'contractor']) {
  const config = entityConfigs.find((candidate) => candidate.name === entityName)
  const settingsKey = entityName === 'client' ? 'clientsSettings' : 'contractorsSettings'

  for (const scenario of [
    { name: 'balance without date', balance: '50', date: '' },
    { name: 'date without balance', balance: '', date: today() }
  ]) {
    // BUG-2: Client and contractor opening-balance fields are saved without requiring the pair.
    testWithApp.fixme(
      `SET-8 ${scenario.name} requires both fields (${entityName})`,
      async ({ launchApp }) => {
        const app = await launchApp('no-shift')
        const { page } = app
        await openSettings(page, config)
        const dialog = await openAdd(page, config)
        await fieldControl(
          dialog,
          config.fields.find((field) => field.key === 'name')
        ).fill(`E2E SET-8 ${entityName} ${app.seedData.suffix}`)
        await fieldControl(
          dialog,
          config.fields.find((field) => field.key === 'openingBalance')
        ).fill(scenario.balance)
        await fieldControl(
          dialog,
          config.fields.find((field) => field.key === 'openingBalanceDate')
        ).fill(scenario.date)
        await submitDialog(page, dialog)
        const invalidField = scenario.balance ? 'openingBalanceDate' : 'openingBalance'
        await expect(
          formItem(dialog, `${settingsKey}.fields.${invalidField}`).locator('p.text-destructive')
        ).toBeVisible()
      }
    )
  }
}

for (const config of [
  entityConfigs.find((candidate) => candidate.name === 'crusher'),
  entityConfigs.find((candidate) => candidate.name === 'client')
]) {
  testWithApp(`SET-9 rejects a negative initial price (${config.name})`, async ({ launchApp }) => {
    const app = await launchApp('no-shift')
    const { page, seedData } = app
    await openSettings(page, config)
    const dialog = await openAdd(page, config)
    const values = config.createValues(seedData)
    values.initialPrice = '-1'
    await fillValues(page, dialog, config, values)
    await submitDialog(page, dialog)
    await expect(dialog).toBeVisible()
    await expect(
      formItem(dialog, 'common.defaultPrice').locator('p.text-destructive')
    ).toContainText(text('common.validation.positivePrice'))
  })
}

testWithApp('SET-9 rejects a negative default cubic (vehicle)', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const { page, seedData } = app
  const config = entityConfigs.find((candidate) => candidate.name === 'vehicle')
  await openSettings(page, config)
  const dialog = await openAdd(page, config)
  const values = config.createValues(seedData)
  values.defaultCubic = '-1'
  await fillValues(page, dialog, config, values)
  await submitDialog(page, dialog)
  await expect(dialog).toBeVisible()
  await expect(
    formItem(dialog, 'vehiclesSettings.fields.defaultCubic').locator('p.text-destructive')
  ).toContainText(text('vehiclesSettings.validation.defaultCubicRequired'))
})

// BUG-3: Driver phone fields accept alphabetic text without validation.
testWithApp.fixme('SET-9 rejects a non-numeric phone (driver)', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const { page, seedData } = app
  const config = entityConfigs.find((candidate) => candidate.name === 'driver')
  await openSettings(page, config)
  const dialog = await openAdd(page, config)
  const values = config.createValues(seedData)
  values.phone1 = 'E2E phone'
  await fillValues(page, dialog, config, values)
  await submitDialog(page, dialog)
  await expect(dialog).toBeVisible()
  await expect(
    formItem(dialog, 'driversSettings.phone1').locator('p.text-destructive')
  ).toBeVisible()
})

testWithApp('SET-10 vehicle requires a contractor (vehicle)', async ({ launchApp }) => {
  const app = await launchApp('no-shift')
  const { page, seedData } = app
  const config = entityConfigs.find((candidate) => candidate.name === 'vehicle')
  await openSettings(page, config)
  const dialog = await openAdd(page, config)
  const values = config.createValues(seedData)
  delete values.contractorId
  await fillValues(page, dialog, config, values)
  await submitDialog(page, dialog)
  await expect(
    formItem(dialog, 'ledgerEntryForm.fields.contractor').locator('p.text-destructive')
  ).toBeVisible()
  await expect(dialog).toBeVisible()
})
