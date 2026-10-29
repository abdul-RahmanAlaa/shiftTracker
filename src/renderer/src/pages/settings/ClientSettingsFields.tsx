import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import type { ClientFormInput } from './settingsFormSchemas'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
export function ClientSettingsFields({
  form
}: {
  form: UseFormReturn<ClientFormInput>
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('clientsSettings.fields.name')}</FormLabel>
            <FormControl>
              <Input placeholder={t('clientsSettings.fields.name')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="initialPrice"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('common.defaultPrice')}</FormLabel>
            <FormControl>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t('common.defaultPrice')}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="location"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('clientsSettings.fields.location')}</FormLabel>
            <FormControl>
              <Input placeholder={t('clientsSettings.fields.location')} {...field} />
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
