import { z } from 'zod'
import arMessages from '../renderer/src/i18n/locales/ar.json'
import { toMinorUnits } from './accounting'

export const validationMessages = {
  tripDateRequired: arMessages.tripForm.validation.tripDateRequired,
  tripDateInvalid: arMessages.tripForm.validation.tripDateInvalid,
  fineAmountNonNegative: arMessages.tripForm.validation.fineAmountNonNegative,
  moneyDecimals: arMessages.common.validation.moneyDecimals,
  positivePrice: arMessages.common.validation.positivePrice,
  shiftStartDateRequired: arMessages.createShift.validation.startDateRequired,
  shiftStartDateInvalid: arMessages.createShift.validation.startDateInvalid,
  shiftEndDateRequired: arMessages.shifts.validation.endDateRequired,
  shiftEndDateInvalid: arMessages.shifts.validation.endDateInvalid
}

export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function dateStringSchema(
  requiredMessage: string,
  invalidMessage = requiredMessage
): z.ZodString {
  return z
    .string({ error: requiredMessage })
    .min(1, requiredMessage)
    .refine((value) => value.length === 0 || isRealDate(value), invalidMessage)
}

export function positiveIntegerSchema(message: string): z.ZodNumber {
  return z.number({ error: message }).int(message).finite(message).positive(message)
}

export function nonNegativeIntegerSchema(message: string): z.ZodNumber {
  return z.number({ error: message }).int(message).finite(message).min(0, message)
}

export function positiveNumberSchema(message: string): z.ZodNumber {
  return z.number({ error: message }).finite(message).gt(0, message)
}

export function nonNegativeNumberSchema(message: string): z.ZodNumber {
  return z.number({ error: message }).finite(message).min(0, message)
}

export function moneySchema(message: string): z.ZodNumber {
  return z
    .number({ error: message })
    .finite(message)
    .refine((value) => toMinorUnits(value) !== null, validationMessages.moneyDecimals)
}

export function positiveMoneySchema(message: string): z.ZodNumber {
  return moneySchema(message).gt(0, message)
}

export function nonNegativeMoneySchema(message: string): z.ZodNumber {
  return moneySchema(message).min(0, message)
}
