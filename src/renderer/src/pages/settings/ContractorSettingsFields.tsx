import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import type { ContractorFormInput } from './settingsFormSchemas'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
export function ContractorSettingsFields({
  form
}: {
  form: UseFormReturn<ContractorFormInput>
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('contractorsSettings.fields.name')}</FormLabel>
            <FormControl>
              <Input placeholder={t('contractorsSettings.fields.name')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('contractorsSettings.phoneNumber')}</FormLabel>
            <FormControl>
              <Input type="text" placeholder={t('contractorsSettings.phoneNumber')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="openingBalance"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('common.openingBalance')}</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="openingBalanceDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('common.openingBalanceDate')}</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  )
}
