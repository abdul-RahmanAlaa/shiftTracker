import i18n from 'i18next'
import { z } from 'zod'
import { hasAtMostTwoDecimals } from '@/lib/money'
import type { TripGridPayload } from '@/lib/tripGrid'

export type NamedOption = { id: number; name: string }
export type OpenShift = {
  id: string
  vehicleNo: number
  driverId: number
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
  startDate: string
  endDate: string | null
}

export type ResourceState = {
  drivers: NamedOption[]
  vehicles: { vehicleNo: number; trailerNo: number; contractorId: number }[]
  crushers: NamedOption[]
  clients: NamedOption[]
  materialTypes: NamedOption[]
  locations: string[]
}

export const tripSchema = z
  .object({
    tripDate: z.string().min(1, i18n.t('tripForm.validation.tripDateRequired')),
    crusherCubic: z.number().positive(i18n.t('tripForm.validation.crusherCubicRequired')),
    clientCubicReported: z.number().positive(i18n.t('tripForm.validation.clientCubicRequired')),
    fineAmount: z
      .number()
      .nonnegative(i18n.t('tripForm.validation.fineAmountNonNegative'))
      .refine(hasAtMostTwoDecimals, i18n.t('common.validation.moneyDecimals'))
      .optional(),
    fineReason: z.string().optional(),
    location: z.string().optional(),
    crusherId: z.number().int().positive(i18n.t('tripForm.validation.crusherRequired')),
    stonePrice: z
      .number()
      .positive(i18n.t('tripForm.validation.stonePriceRequired'))
      .refine(hasAtMostTwoDecimals, i18n.t('common.validation.moneyDecimals')),
    crusherReceiptStatus: z.enum(['PROVIDED', 'CONFIRMED_MISSING', 'UNKNOWN']),
    crusherReceiptNo: z
      .number()
      .int()
      .positive(i18n.t('tripForm.validation.crusherReceiptNumberRequired'))
      .optional(),
    clientId: z.number().int().positive(i18n.t('tripForm.validation.clientRequired')),
    materialTypeId: z.number().int().positive(i18n.t('tripForm.validation.materialTypeRequired')),
    transportPrice: z
      .number()
      .positive(i18n.t('tripForm.validation.transportPriceRequired'))
      .refine(hasAtMostTwoDecimals, i18n.t('common.validation.moneyDecimals')),
    clientPrice: z
      .number()
      .positive(i18n.t('tripForm.validation.clientPriceRequired'))
      .refine(hasAtMostTwoDecimals, i18n.t('common.validation.moneyDecimals')),
    recipientNameStatus: z.enum(['PROVIDED', 'UNCLEAR']),
    recipientName: z.string().optional(),
    clientReceiptNo: z.string().optional(),
    notes: z.string().optional()
  })
  .superRefine((values, context) => {
    if (values.crusherReceiptStatus === 'PROVIDED' && !values.crusherReceiptNo) {
      context.addIssue({
        code: 'custom',
        path: ['crusherReceiptNo'],
        message: i18n.t('tripForm.validation.crusherReceiptNumberRequired')
      })
    }
    if (values.recipientNameStatus === 'PROVIDED' && !values.recipientName?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['recipientName'],
        message: i18n.t('tripForm.validation.recipientNameRequired')
      })
    }
  })

export type TripValues = z.infer<typeof tripSchema>

export function validateTripGridPayload(
  payload: TripGridPayload
): { field: string; message: string }[] {
  const parsed = tripSchema.safeParse(payload)
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => ({
        field: String(issue.path[0] ?? '_form'),
        message: issue.message
      }))
}
