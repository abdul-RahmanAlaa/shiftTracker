/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/explicit-function-return-type */

const {
  expect,
  fs,
  text,
  navigate,
  expectNoRawTranslationKeys,
  nextDialog,
  callApi,
  readDb,
  makeJpeg,
  makeTruncatedJpeg,
  makePng,
  makePdf,
  tripRow,
  testWithApp
} = require('./helpers.cjs')
const path = require('node:path')

function attachmentSection(scope, label) {
  return scope.getByRole('heading', { name: label, exact: true }).locator('xpath=..')
}

function imageError(page) {
  return page
    .getByText(text('receiptPhoto.errors.readImage'), { exact: true })
    .or(page.getByText(text('receiptPhoto.errors.loadImage'), { exact: true }))
}

async function waitForThumbnail(section, label) {
  await section.scrollIntoViewIfNeeded()
  const image = section.getByRole('img', { name: label, exact: true })
  const unavailable = section.getByText(text('receiptPhoto.unavailable'), { exact: true })
  await expect(image.or(unavailable)).toBeVisible()
  return { image, unavailable }
}

async function uploadImage(page, row, label, file) {
  const section = attachmentSection(row, label)
  await section
    .getByRole('button', {
      name: text('receiptPhoto.upload', { label }),
      exact: true
    })
    .click()
  await row.locator('input[type="file"]').setInputFiles(file)
  const cropDialog = page.getByRole('dialog').last()
  await expect(cropDialog).toBeVisible()
  const saveButton = cropDialog.getByRole('button', {
    name: text('receiptPhoto.save'),
    exact: true
  })
  await expect(saveButton).toBeEnabled()
  await saveButton.click()
  await expect(cropDialog).toBeHidden()
  return section
}

async function openShiftTrip(page, seedData) {
  await navigate(page, '/shifts', 'shifts.title')
  await expectNoRawTranslationKeys(page)
  await page.getByRole('row').filter({ hasText: seedData.shift.id }).click()
  await expectNoRawTranslationKeys(page)
  const row = tripRow(page, seedData.trip.id)
  await row.scrollIntoViewIfNeeded()
  return row
}

testWithApp('ATT-1 upload, crop, and preview a saved JPEG receipt', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  const label = text('receiptPhoto.labels.clientReceipt')
  const note = `E2E ATT-1 ${seedData.suffix}`
  const row = await openShiftTrip(page, seedData)
  const section = await uploadImage(page, row, label, {
    name: `${note}.jpg`,
    mimeType: 'image/jpeg',
    buffer: await makeJpeg(page, 320, 180)
  })

  const { image } = await waitForThumbnail(section, label)
  await expect(image).toBeVisible()
  const previewButton = section.getByRole('button', {
    name: text('receiptPhoto.preview', { label }),
    exact: true
  })
  await previewButton.click()
  const preview = page.getByRole('dialog').last()
  await expect(
    preview.getByRole('img', {
      name: text('receiptPhoto.fullImageAlt', { label }),
      exact: true
    })
  ).toBeVisible()
  await preview.getByRole('button', { name: text('common.close'), exact: true }).click()
  await expect(preview).toBeHidden()

  await page.reload()
  await expectNoRawTranslationKeys(page)
  const reloadedRow = tripRow(page, seedData.trip.id)
  await reloadedRow.scrollIntoViewIfNeeded()
  const reloadedSection = attachmentSection(reloadedRow, label)
  const reloaded = await waitForThumbnail(reloadedSection, label)
  await expect(reloaded.image).toBeVisible()
  await expect(
    reloadedSection.getByRole('button', {
      name: text('receiptPhoto.preview', { label }),
      exact: true
    })
  ).toBeVisible()
})

testWithApp(
  'ATT-2 deleting a receipt removes its list item, file, and database row',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const label = text('receiptPhoto.labels.crusherReceipt')
    const row = await openShiftTrip(page, seedData)
    const section = attachmentSection(row, label)
    const result = await callApi(page, 'listEntityAttachments', {
      entityType: 'TRIP',
      entityId: seedData.trip.id
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Could not inspect the receipt attachment before deletion')
    const attachment = result.data.find((item) => item.kind === 'CRUSHER_RECEIPT')
    expect(attachment).toBeTruthy()
    if (!attachment) throw new Error('Seeded crusher receipt attachment is missing')
    const file = path.join(app.tempDirectory, attachment.photoPath)
    expect(fs.existsSync(file)).toBe(true)

    await waitForThumbnail(section, label)
    const deleteButton = section.getByRole('button', { name: text('common.delete'), exact: true })
    await deleteButton.focus()
    const dialogPromise = nextDialog(page, 'accept')
    await deleteButton.press('Enter')
    expect(await dialogPromise).toBe(text('receiptPhoto.confirmDelete', { label }))
    await expect(deleteButton).toHaveCount(0)
    await expect(
      section.getByRole('button', { name: text('receiptPhoto.upload', { label }), exact: true })
    ).toBeVisible()
    expect(fs.existsSync(file)).toBe(false)

    const database = readDb(app)
    const record = database.prepare('SELECT id FROM Attachment WHERE id = ?').get(attachment.id)
    database.close()
    expect(record).toBeUndefined()

    await page.reload()
    await expectNoRawTranslationKeys(page)
    const reloadedRow = tripRow(page, seedData.trip.id)
    await expect(
      attachmentSection(reloadedRow, label).getByRole('button', {
        name: text('receiptPhoto.upload', { label }),
        exact: true
      })
    ).toBeVisible()
  }
)

// BUG-7: A selected PDF opens the cropper without a visible rejection message.
testWithApp.fixme(
  'ATT-3 a PDF is rejected with a visible error and is not stored',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const label = text('receiptPhoto.labels.clientReceipt')
    const row = await openShiftTrip(page, seedData)
    const section = attachmentSection(row, label)
    await section
      .getByRole('button', { name: text('receiptPhoto.upload', { label }), exact: true })
      .click()
    await row.locator('input[type="file"]').setInputFiles({
      name: `E2E ATT-3 ${seedData.suffix}.pdf`,
      mimeType: 'application/pdf',
      buffer: makePdf()
    })

    await expect(imageError(page)).toBeVisible()
    await expect(page.getByRole('heading', { name: text('shifts.title') })).toBeVisible()
    expect(app.browserErrors).toEqual([])
    const result = await callApi(page, 'listEntityAttachments', {
      entityType: 'TRIP',
      entityId: seedData.trip.id
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Could not verify rejected PDF was not stored')
    expect(result.data.some((item) => item.kind === 'CLIENT_RECEIPT')).toBe(false)
  }
)

// BUG-8: An undecodable image stays in the cropper without a visible error.
testWithApp.fixme(
  'ATT-4 undecodable JPEG fixtures show an error and are not stored',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const label = text('receiptPhoto.labels.clientReceipt')
    const row = await openShiftTrip(page, seedData)
    const section = attachmentSection(row, label)
    const fixtures = [
      {
        name: `E2E ATT-4 truncated ${seedData.suffix}.jpg`,
        bytes: await makeTruncatedJpeg(page)
      },
      {
        name: `E2E ATT-4 random ${seedData.suffix}.jpg`,
        bytes: Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x13, 0x37, 0x42, 0x99, 0x10, 0x55, 0x00, 0xff, 0x12
        ])
      }
    ]
    for (const fixture of fixtures) {
      const decodes = await page.evaluate(async (base64) => {
        const image = new Image()
        image.src = `data:image/jpeg;base64,${base64}`
        try {
          await image.decode()
          return true
        } catch {
          return false
        }
      }, fixture.bytes.toString('base64'))
      expect(decodes).toBe(false)

      await section
        .getByRole('button', { name: text('receiptPhoto.upload', { label }), exact: true })
        .click()
      await row.locator('input[type="file"]').setInputFiles({
        name: fixture.name,
        mimeType: 'image/jpeg',
        buffer: fixture.bytes
      })
      await expect(imageError(page)).toBeVisible()
      await expect(page.getByRole('heading', { name: text('shifts.title') })).toBeVisible()
      expect(app.browserErrors).toEqual([])
      const result = await callApi(page, 'listEntityAttachments', {
        entityType: 'TRIP',
        entityId: seedData.trip.id
      })
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Could not verify undecodable JPEG was not stored')
      expect(result.data.some((item) => item.kind === 'CLIENT_RECEIPT')).toBe(false)
    }
  }
)

// BUG-9: At 1366x768 the receipt section overlays the delete button and blocks pointer clicks.
testWithApp.fixme('ATT-10 receipt delete button is reachable by pointer', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  const label = text('receiptPhoto.labels.crusherReceipt')
  const row = await openShiftTrip(page, seedData)
  const section = attachmentSection(row, label)
  const deleteButton = section.getByRole('button', { name: text('common.delete'), exact: true })
  await deleteButton.scrollIntoViewIfNeeded()
  const dialogPromise = nextDialog(page, 'accept')
  await deleteButton.click()
  expect(await dialogPromise).toBe(text('receiptPhoto.confirmDelete', { label }))
  await expect(deleteButton).toHaveCount(0)
})

testWithApp('ATT-9 PNG is cropped as an image and saved as JPEG', async ({ launchApp }) => {
  const app = await launchApp('with-trip')
  const { page, seedData } = app
  const label = text('receiptPhoto.labels.clientReceipt')
  const row = await openShiftTrip(page, seedData)
  const payload = {
    entityType: 'TRIP',
    entityId: seedData.trip.id,
    kind: 'CLIENT_RECEIPT'
  }
  const validJpeg = await makeJpeg(page, 320, 180)
  const positiveControl = await callApi(page, 'addAttachment', {
    ...payload,
    imageBase64: validJpeg.toString('base64')
  })
  expect(positiveControl.ok).toBe(true)
  if (!positiveControl.ok) throw new Error('Valid JPEG control attachment was rejected')

  const controlList = await callApi(page, 'listEntityAttachments', {
    entityType: 'TRIP',
    entityId: seedData.trip.id
  })
  expect(controlList.ok).toBe(true)
  if (!controlList.ok) throw new Error('Could not inspect valid JPEG control attachment')
  const controlAttachment = controlList.data.find((item) => item.kind === 'CLIENT_RECEIPT')
  expect(controlAttachment).toBeTruthy()
  if (!controlAttachment) throw new Error('Valid JPEG control attachment was not listed')
  const controlDelete = await callApi(page, 'removeAttachment', { id: controlAttachment.id })
  expect(controlDelete.ok).toBe(true)
  if (!controlDelete.ok) throw new Error('Could not remove valid JPEG control attachment')

  let contentValidationError
  for (const bytes of [makePng(), makePdf()]) {
    const result = await callApi(page, 'addAttachment', {
      ...payload,
      imageBase64: bytes.toString('base64')
    })
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Non-JPEG bytes unexpectedly passed attachment validation')
    expect(result.errors).toContainEqual({
      field: 'imageBase64',
      message: expect.stringContaining('JPEG')
    })
    contentValidationError ??= result.errors.find((error) => error.field === 'imageBase64')
    expect(result.errors.find((error) => error.field === 'imageBase64')?.message).toBe(
      contentValidationError?.message
    )
    expect(
      result.errors.some((error) => error.field === 'imageBase64' && error.message.includes('JPEG'))
    ).toBe(true)

    const listed = await callApi(page, 'listEntityAttachments', {
      entityType: 'TRIP',
      entityId: seedData.trip.id
    })
    expect(listed.ok).toBe(true)
    if (!listed.ok) throw new Error('Could not verify rejected non-JPEG bytes were not stored')
    expect(listed.data.some((item) => item.kind === 'CLIENT_RECEIPT')).toBe(false)
  }

  const section = attachmentSection(row, label)
  await section
    .getByRole('button', { name: text('receiptPhoto.upload', { label }), exact: true })
    .click()
  await row.locator('input[type="file"]').setInputFiles({
    name: `E2E ATT-9 ${seedData.suffix}.png`,
    mimeType: 'image/png',
    buffer: makePng()
  })
  const cropDialog = page.getByRole('dialog').last()
  await expect(cropDialog).toBeVisible()
  const saveButton = cropDialog.getByRole('button', {
    name: text('receiptPhoto.save'),
    exact: true
  })
  await expect(saveButton).toBeEnabled()
  await saveButton.click()
  await expect(cropDialog).toBeHidden()
  await waitForThumbnail(section, label)

  const result = await callApi(page, 'listEntityAttachments', {
    entityType: 'TRIP',
    entityId: seedData.trip.id
  })
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error('Could not inspect the saved PNG-converted image')
  const attachment = result.data.find((item) => item.kind === 'CLIENT_RECEIPT')
  expect(attachment).toBeTruthy()
  if (!attachment) throw new Error('The PNG-converted image was not saved')
  const saved = fs.readFileSync(path.join(app.tempDirectory, attachment.photoPath))
  expect(saved.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
})

testWithApp(
  'ATT-5 crop, rotate, and zoom controls change the saved JPEG output',
  async ({ launchApp }) => {
    const app = await launchApp('with-trip')
    const { page, seedData } = app
    const label = text('receiptPhoto.labels.clientReceipt')
    const row = await openShiftTrip(page, seedData)
    const section = attachmentSection(row, label)
    const original = await makeJpeg(page, 320, 180)
    await section
      .getByRole('button', { name: text('receiptPhoto.upload', { label }), exact: true })
      .click()
    await row.locator('input[type="file"]').setInputFiles({
      name: `E2E ATT-5 ${seedData.suffix}.jpg`,
      mimeType: 'image/jpeg',
      buffer: original
    })
    const cropDialog = page.getByRole('dialog').last()
    await expect(cropDialog).toBeVisible()
    const zoom = cropDialog.getByRole('slider', { name: text('receiptPhoto.zoom'), exact: true })
    await zoom.focus()
    await zoom.press('End')
    await expect(zoom).toHaveValue('3')
    await cropDialog
      .getByRole('button', { name: text('receiptPhoto.rotateRight'), exact: true })
      .click()
    await expect(cropDialog.locator('img')).toHaveAttribute('style', /rotate\(90deg\)/)

    const save = cropDialog.getByRole('button', { name: text('receiptPhoto.save'), exact: true })
    await expect(save).toBeEnabled()
    await save.click()
    await expect(cropDialog).toBeHidden()
    await waitForThumbnail(section, label)

    const result = await callApi(page, 'listEntityAttachments', {
      entityType: 'TRIP',
      entityId: seedData.trip.id
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Could not inspect the saved edited image')
    const attachment = result.data.find((item) => item.kind === 'CLIENT_RECEIPT')
    expect(attachment).toBeTruthy()
    if (!attachment) throw new Error('The edited image was not saved')
    const saved = fs.readFileSync(path.join(app.tempDirectory, attachment.photoPath))
    expect(saved.equals(original)).toBe(false)
  }
)
