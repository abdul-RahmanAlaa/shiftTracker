import i18n from 'i18next'

export interface IpcFieldError {
  field: string
  message: string
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
    .filter((error) => {
      return error.field === '_form' || !knownFieldSet.has(error.field)
    })
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
          const knownFields = knownFormFields(methodName)
          const errors = getUnhandledIpcErrors(response, knownFields, translate)
          if (errors.length > 0) {
            const message =
              methodName.startsWith('delete') || methodName === 'removeAttachment'
                ? translate('ipcErrors.deleteFailed')
                : errors.map((error) => error.message).join('\n')
            window.alert(message)
          }
          return response
        })
      }
    }
  })
}

export function createIpcApi(): Window['api'] {
  return withIpcErrorHandling(window.api, (key) => String(i18n.t(key)))
}

function knownFormFields(methodName: string): string[] {
  switch (methodName) {
    case 'createDriver':
    case 'updateDriver':
      return ['name', 'phone1', 'phone2']
    case 'createClient':
    case 'updateClient':
      return ['name', 'initialPrice', 'location', 'openingBalance', 'openingBalanceDate']
    case 'createCrusher':
    case 'updateCrusher':
      return ['name', 'initialPrice']
    case 'createMaterialType':
    case 'updateMaterialType':
      return ['name']
    case 'createContractor':
    case 'updateContractor':
      return ['name', 'phone', 'openingBalance', 'openingBalanceDate']
    case 'createVehicle':
    case 'updateVehicle':
      return ['vehicleNo', 'trailerNo', 'contractorId', 'defaultCubic', 'ownerName']
    case 'createShift':
      return [
        'driverId',
        'vehicleNo',
        'crusherCubicDefault',
        'clientCubicDefault',
        'startDate',
        'reportedDestination',
        'notes'
      ]
    case 'closeShift':
      return [
        'shiftId',
        'endDate',
        'reportedTripCount',
        'tripCount',
        'closingAttachment',
        'tripAttachments'
      ]
    case 'reopenShift':
      return ['shiftId', 'reason']
    case 'createTrip':
    case 'updateTrip':
      return [
        'tripDate',
        'crusherCubic',
        'clientCubicReported',
        'fineAmount',
        'fineReason',
        'location',
        'crusherId',
        'stonePrice',
        'crusherReceiptStatus',
        'crusherReceiptNo',
        'clientId',
        'transportPrice',
        'clientPrice',
        'materialTypeId',
        'recipientNameStatus',
        'recipientName',
        'clientReceiptNo',
        'notes'
      ]
    case 'createLedgerEntry':
    case 'updateLedgerEntry':
      return ['entryDate', 'driverId', 'movementType', 'amount', 'shiftId', 'contractorId', 'notes']
    case 'createClientPayment':
    case 'updateClientPayment':
      return ['entryDate', 'clientId', 'amount', 'notes']
    case 'addAttachment':
      return ['entityType', 'entityId', 'kind', 'imageBase64']
    default:
      return []
  }
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
