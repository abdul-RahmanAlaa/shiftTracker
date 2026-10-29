/* eslint-disable @typescript-eslint/no-require-imports */

const { testWithApp, expect, text, navigate, callApi } = require('./helpers.cjs')

testWithApp('ATT-7 A closing sheet cannot be added to a CLOSED shift', async ({ launchApp }) => {
  const app = await launchApp('two-shifts')
  const { page, seedData } = app
  await navigate(page, '/shifts', 'shifts.title')

  await page.getByRole('button', { name: text('shifts.closeCardTitle'), exact: true }).click()
  const dialog = page.getByRole('dialog')
  const shiftSelect = dialog.getByRole('combobox')
  await shiftSelect.click()

  const openShiftOption = page.getByRole('option', {
    name: `${seedData.shift.id} (${seedData.driver.name})`,
    exact: true
  })
  const closedShiftOption = page.getByRole('option', {
    name: `${seedData.closedShift.id} (${seedData.secondDriver.name})`,
    exact: true
  })
  await expect(openShiftOption).toBeVisible()
  await expect(closedShiftOption).toHaveCount(0)
  await openShiftOption.click()

  await expect(
    dialog.getByRole('button', { name: text('receiptPhoto.addDocument'), exact: true })
  ).toBeVisible()

  const listInput = { entityType: 'SHIFT', entityId: seedData.closedShift.id }
  const beforeResult = await callApi(page, 'listEntityAttachments', listInput)
  expect(beforeResult.ok).toBe(true)
  if (!beforeResult.ok) throw new Error('Could not list seeded closed-shift attachments')
  expect(beforeResult.data).toHaveLength(1)
  expect(beforeResult.data[0].kind).toBe('CLOSING_SHEET')

  const imageBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create JPEG fixture canvas')
    context.fillRect(0, 0, 1, 1)
    return canvas.toDataURL('image/jpeg').replace(/^data:image\/jpeg;base64,/, '')
  })
  const addResult = await callApi(page, 'addAttachment', {
    ...listInput,
    kind: 'CLOSING_SHEET',
    imageBase64
  })
  expect(addResult.ok).toBe(false)

  const afterResult = await callApi(page, 'listEntityAttachments', listInput)
  expect(afterResult.ok).toBe(true)
  if (!afterResult.ok) throw new Error('Could not list closed-shift attachments after rejection')
  expect(afterResult.data).toEqual(beforeResult.data)
})
