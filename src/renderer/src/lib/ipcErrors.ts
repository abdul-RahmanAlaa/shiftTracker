import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import i18n from 'i18next'
import type { CreateShiftInput } from '../../../main/use-cases/createShift'
import type { CloseShiftInput } from '../../../main/use-cases/closeShift'
import type { ReopenShiftInput } from '../../../main/use-cases/reopenShift'

export interface IpcFieldError {
  field: string
  message: string
}

type ApiMethod = keyof Window['api']
type ApiInput<Method extends ApiMethod> = Parameters<Window['api'][Method]>[0]
type ApiFieldRecord<Method extends ApiMethod> = Record<keyof ApiInput<Method>, true>

function defineApiFields<Method extends ApiMethod>(
  fields: ApiFieldRecord<Method>
): readonly string[] {
  return Object.keys(fields)
}

const apiFieldNames = {
  createDriver: defineApiFields<'createDriver'>({ name: true, phone1: true, phone2: true }),
  updateDriver: defineApiFields<'updateDriver'>({
    id: true,
    name: true,
    phone1: true,
    phone2: true
  }),
  createClient: defineApiFields<'createClient'>({
    name: true,
    initialPrice: true,
    location: true,
    openingBalance: true,
    openingBalanceDate: true
  }),
  updateClient: defineApiFields<'updateClient'>({
    id: true,
    name: true,
    initialPrice: true,
    location: true,
    openingBalance: true,
    openingBalanceDate: true
  }),
  createCrusher: defineApiFields<'createCrusher'>({ name: true, initialPrice: true }),
  updateCrusher: defineApiFields<'updateCrusher'>({ id: true, name: true, initialPrice: true }),
  createMaterialType: defineApiFields<'createMaterialType'>({ name: true }),
  updateMaterialType: defineApiFields<'updateMaterialType'>({ id: true, name: true }),
  createContractor: defineApiFields<'createContractor'>({
    name: true,
    phone: true,
    openingBalance: true,
    openingBalanceDate: true
  }),
  updateContractor: defineApiFields<'updateContractor'>({
    id: true,
    name: true,
    phone: true,
    openingBalance: true,
    openingBalanceDate: true
  }),
  createVehicle: defineApiFields<'createVehicle'>({
    vehicleNo: true,
    trailerNo: true,
    contractorId: true,
    defaultCubic: true,
    ownerName: true
  }),
  updateVehicle: defineApiFields<'updateVehicle'>({
    vehicleNo: true,
    trailerNo: true,
    contractorId: true,
    defaultCubic: true,
    ownerName: true
  }),
  createShift: Object.keys({
    vehicleNo: true,
    driverId: true,
    crusherCubicDefault: true,
    clientCubicDefault: true,
    startDate: true,
    reportedDestination: true,
    notes: true
  } satisfies Record<keyof CreateShiftInput, true>),
  closeShift: Object.keys({
    shiftId: true,
    endDate: true,
    reportedTripCount: true
  } satisfies Record<keyof CloseShiftInput, true>),
  reopenShift: Object.keys({
    shiftId: true,
    reason: true
  } satisfies Record<keyof ReopenShiftInput, true>),
  createTrip: defineApiFields<'createTrip'>({
    shiftId: true,
    tripDate: true,
    crusherCubic: true,
    clientCubicReported: true,
    fineAmount: true,
    fineReason: true,
    location: true,
    crusherId: true,
    stonePrice: true,
    crusherReceiptStatus: true,
    crusherReceiptNo: true,
    clientId: true,
    transportPrice: true,
    clientPrice: true,
    materialTypeId: true,
    recipientNameStatus: true,
    recipientName: true,
    clientReceiptNo: true,
    notes: true
  }),
  updateTrip: defineApiFields<'updateTrip'>({
    id: true,
    tripDate: true,
    crusherCubic: true,
    clientCubicReported: true,
    fineAmount: true,
    fineReason: true,
    location: true,
    crusherId: true,
    stonePrice: true,
    crusherReceiptStatus: true,
    crusherReceiptNo: true,
    clientId: true,
    transportPrice: true,
    clientPrice: true,
    materialTypeId: true,
    recipientNameStatus: true,
    recipientName: true,
    clientReceiptNo: true,
    notes: true
  }),
  createLedgerEntry: defineApiFields<'createLedgerEntry'>({
    entryDate: true,
    driverId: true,
    movementType: true,
    amount: true,
    shiftId: true,
    contractorId: true,
    notes: true
  }),
  updateLedgerEntry: defineApiFields<'updateLedgerEntry'>({
    id: true,
    entryDate: true,
    driverId: true,
    movementType: true,
    amount: true,
    shiftId: true,
    contractorId: true,
    notes: true
  }),
  createClientPayment: defineApiFields<'createClientPayment'>({
    entryDate: true,
    clientId: true,
    amount: true,
    notes: true
  }),
  updateClientPayment: defineApiFields<'updateClientPayment'>({
    id: true,
    entryDate: true,
    clientId: true,
    amount: true,
    notes: true
  }),
  addAttachment: defineApiFields<'addAttachment'>({
    entityType: true,
    entityId: true,
    kind: true,
    imageBase64: true
  })
} satisfies Partial<Record<ApiMethod, readonly string[]>>

const pageDisplaysNonFieldErrors = new Set(['createTrip', 'closeShift', 'reopenShift'])

let noticeRoot: Root | undefined
let noticeContainer: HTMLDivElement | undefined
let noticeTimer: number | undefined
let dismissTimer: number | undefined
let pendingNotices: string[] = []
let visibleNotice: string | undefined
const recentNotices = new Map<string, number>()

function showNotice(message: string): void {
  const now = Date.now()
  for (const [recentMessage, timestamp] of recentNotices) {
    if (now - timestamp >= 3000) recentNotices.delete(recentMessage)
  }
  if (recentNotices.has(message)) return
  recentNotices.set(message, now)
  if (!pendingNotices.includes(message)) pendingNotices.push(message)

  if (noticeTimer === undefined) {
    noticeTimer = window.setTimeout(() => {
      noticeTimer = undefined
      visibleNotice = pendingNotices.join('\n')
      pendingNotices = []
      if (dismissTimer !== undefined) window.clearTimeout(dismissTimer)
      renderNotice()
      dismissTimer = window.setTimeout(() => {
        visibleNotice = undefined
        dismissTimer = undefined
        renderNotice()
      }, 5000)
    }, 75)
  }
}

function renderNotice(): void {
  if (!visibleNotice) {
    noticeRoot?.render(null)
    return
  }
  if (!noticeContainer) {
    noticeContainer = document.createElement('div')
    document.body.appendChild(noticeContainer)
    noticeRoot = createRoot(noticeContainer)
  }
  noticeRoot?.render(
    createElement(
      'div',
      {
        role: 'status',
        'aria-live': 'polite',
        className:
          'fixed bottom-4 left-4 z-[100] flex max-w-md items-start gap-4 rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-lg'
      },
      createElement('span', { className: 'whitespace-pre-line' }, visibleNotice),
      createElement(
        'button',
        {
          type: 'button',
          className: 'text-muted-foreground hover:text-foreground',
          'aria-label': String(i18n.t('common.close')),
          onClick: dismissNotice
        },
        '×'
      )
    )
  )
}

function dismissNotice(): void {
  if (dismissTimer !== undefined) window.clearTimeout(dismissTimer)
  dismissTimer = undefined
  visibleNotice = undefined
  renderNotice()
}

function notifyErrors(methodName: string, errors: IpcFieldError[]): void {
  if (methodName.startsWith('delete') || methodName === 'removeAttachment') {
    showNotice(String(i18n.t('ipcErrors.deleteFailed')))
    return
  }

  const unexpected = errors.find((error) => error.field === '_form')
  if (unexpected) {
    showNotice(String(i18n.t('ipcErrors.unexpected')))
    return
  }
  if (pageDisplaysNonFieldErrors.has(methodName)) return
  for (const error of errors) showNotice(error.message)
}

export function getUnhandledIpcErrors(
  result: unknown,
  knownFields: readonly string[],
  translate: (key: string) => string
): IpcFieldError[] {
  if (typeof result !== 'object' || result === null || !('ok' in result) || result.ok !== false) {
    return []
  }
  if (!('errors' in result) || !Array.isArray(result.errors)) return []

  const knownFieldSet = new Set(knownFields)
  return result.errors
    .filter(isFieldError)
    .filter((error) => error.field === '_form' || !knownFieldSet.has(error.field))
    .map((error) => ({
      field: error.field,
      message:
        error.message === 'UNEXPECTED_ERROR' ? translate('ipcErrors.unexpected') : error.message
    }))
}

export function withIpcErrorHandling<T extends object>(
  api: T,
  translate: (key: string) => string
): T {
  const wrappedApi = Object.assign({}, api)
  return new Proxy(wrappedApi, {
    get(target, property, receiver) {
      const method = Reflect.get(target, property, receiver)
      if (typeof method !== 'function') return method

      return (...args: unknown[]) => {
        const result: unknown = Reflect.apply(method, target, args)
        if (!(result instanceof Promise)) return result

        return result.then((response: unknown) => {
          const methodName = String(property)
          const knownFields = getKnownFormFields(methodName)
          const errors = getUnhandledIpcErrors(response, knownFields, translate)
          if (errors.length > 0) notifyErrors(methodName, errors)
          return response
        })
      }
    }
  })
}

export function getKnownFormFields(methodName: string): readonly string[] {
  return isFieldMethod(methodName) ? apiFieldNames[methodName] : []
}

export const ipcApi = withIpcErrorHandling(window.api, (key) => String(i18n.t(key)))

function isFieldMethod(methodName: string): methodName is keyof typeof apiFieldNames {
  return Object.prototype.hasOwnProperty.call(apiFieldNames, methodName)
}

function isFieldError(value: unknown): value is IpcFieldError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'field' in value &&
    typeof value.field === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  )
}
