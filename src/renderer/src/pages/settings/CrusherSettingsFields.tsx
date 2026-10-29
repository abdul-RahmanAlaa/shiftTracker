import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'
import type { CrusherFormInput } from './settingsFormSchemas'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
export function CrusherSettingsFields({
  form
}: {
  form: UseFormReturn<CrusherFormInput>
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('crushersSettings.fields.name')}</FormLabel>
            <FormControl>
              <Input placeholder={t('crushersSettings.fields.name')} {...field} />
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
    </Form>
  )
}
