import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import type { ContractorOption, VehicleFormValues } from './settingsFormSchemas'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

export function VehicleSettingsFields({
  form,
  contractors,
  isEditing
}: {
  form: UseFormReturn<VehicleFormValues>
  contractors: ContractorOption[]
  isEditing: boolean
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="vehicleNo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('vehiclesSettings.fields.vehicleNo')}</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder={t('vehiclesSettings.fields.vehicleNo')}
                disabled={isEditing}
                value={field.value ?? ''}
                onChange={(event) =>
                  field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="trailerNo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('vehiclesSettings.fields.trailerNo')}</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder={t('vehiclesSettings.fields.trailerNo')}
                value={field.value ?? ''}
                onChange={(event) =>
                  field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="contractorId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('ledgerEntryForm.fields.contractor')}</FormLabel>
            <Select
              value={field.value ? String(field.value) : ''}
              onValueChange={(value) => field.onChange(Number(value))}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={t('ledgerEntryForm.placeholders.contractor')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {contractors.map((contractor) => (
                  <SelectItem key={contractor.id} value={String(contractor.id)}>
                    {contractor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="defaultCubic"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('vehiclesSettings.fields.defaultCubic')}</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder={t('vehiclesSettings.fields.defaultCubic')}
                value={field.value ?? ''}
                onChange={(event) =>
                  field.onChange(event.target.value === '' ? undefined : Number(event.target.value))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="ownerName"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('vehiclesSettings.fields.ownerName')}</FormLabel>
            <FormControl>
              <Input placeholder={t('vehiclesSettings.fields.ownerName')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  )
}
