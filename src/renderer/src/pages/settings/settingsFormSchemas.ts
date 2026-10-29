import i18n from 'i18next'
import { z } from 'zod'
import { hasAtMostTwoDecimals } from '@/lib/money'

export const vehicleSchema = z.object({
  vehicleNo: z.number().int().positive(i18n.t('vehiclesSettings.validation.vehicleNoRequired')),
  trailerNo: z.number().int().positive(i18n.t('vehiclesSettings.validation.trailerNoRequired')),
  contractorId: z.number().int().positive(i18n.t('vehiclesSettings.validation.contractorRequired')),
  defaultCubic: z
    .number()
    .nonnegative(i18n.t('vehiclesSettings.validation.defaultCubicRequired'))
    .optional(),
  ownerName: z.string().optional()
})

export type VehicleFormValues = z.infer<typeof vehicleSchema>
export type Vehicle = {
  vehicleNo: number
  trailerNo: number
  contractorId: number
  defaultCubic: number | null
  ownerName: string | null
}
export type ContractorOption = { id: number; name: string }

export const clientSchema = z.object({
  name: z.string().min(1, i18n.t('clientsSettings.validation.nameRequired')),
  location: z.string().optional(),
  initialPrice: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined))
    .refine((val) => val === undefined || val > 0, i18n.t('common.validation.positivePrice'))
    .refine(
      (val) => val === undefined || hasAtMostTwoDecimals(val),
      i18n.t('common.validation.moneyDecimals')
    ),
  openingBalance: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined))
    .refine(
      (val) => val === undefined || hasAtMostTwoDecimals(val),
      i18n.t('common.validation.moneyDecimals')
    ),
  openingBalanceDate: z.string().optional()
})

export type ClientFormValues = z.infer<typeof clientSchema>
export type ClientFormInput = z.input<typeof clientSchema>
export type Client = {
  id: number
  name: string
  initialPrice: number | null
  location: string | null
  openingBalance: number
  openingBalanceDate: string | null
}

export const contractorSchema = z.object({
  name: z.string().min(1, i18n.t('contractorsSettings.validation.nameRequired')),
  phone: z.string().optional(),
  openingBalance: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined))
    .refine(
      (val) => val === undefined || hasAtMostTwoDecimals(val),
      i18n.t('common.validation.moneyDecimals')
    ),
  openingBalanceDate: z.string().optional()
})

export type ContractorFormValues = z.infer<typeof contractorSchema>
export type ContractorFormInput = z.input<typeof contractorSchema>
export type Contractor = {
  id: number
  name: string
  phone: string | null
  openingBalance: number
  openingBalanceDate: string | null
}

export const crusherSchema = z.object({
  name: z.string().min(1, i18n.t('crushersSettings.validation.nameRequired')),
  initialPrice: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined))
    .refine((val) => val === undefined || val > 0, i18n.t('common.validation.positivePrice'))
    .refine(
      (val) => val === undefined || hasAtMostTwoDecimals(val),
      i18n.t('common.validation.moneyDecimals')
    )
})

export type CrusherFormValues = z.infer<typeof crusherSchema>
export type CrusherFormInput = z.input<typeof crusherSchema>
export type Crusher = { id: number; name: string; initialPrice: number | null }
