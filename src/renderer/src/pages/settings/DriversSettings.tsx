import { ipcApi } from '@/lib/ipcErrors'
import { zodResolver } from '@hookform/resolvers/zod'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SettingsEntityPage } from '@/pages/settings/SettingsEntityPage'
import { useSettingsCrud } from '@/pages/settings/useSettingsCrud'

const driverSchema = z.object({
  name: z.string().min(1, i18n.t('driversSettings.validation.nameRequired')),
  phone1: z.string().optional(),
  phone2: z.string().optional()
})

type DriverFormValues = z.infer<typeof driverSchema>
type Driver = { id: number; name: string; phone1: string | null; phone2: string | null }

export function DriversSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const driverForm = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: { name: '', phone1: '', phone2: '' }
  })
  const crud = useSettingsCrud<Driver, DriverFormValues>({
    list: () => ipcApi.listDrivers(),
    save: async (editingDriver, values) => {
      const result = editingDriver
        ? await ipcApi.updateDriver({ id: editingDriver.id, ...values })
        : await ipcApi.createDriver(values)
      if (!result.ok) {
        result.errors.forEach((error) => {
          if (error.field === 'name' || error.field === 'phone1' || error.field === 'phone2') {
            driverForm.setError(error.field, { message: error.message })
          }
        })
      }
      return result
    },
    remove: (driver) => ipcApi.deleteDriver({ id: driver.id }),
    getRowId: (driver) => driver.id,
    getDeleteConfirmation: (driver) =>
      t('driversSettings.deleteConfirmation', { name: driver.name }),
    resetForm: (driver) =>
      driverForm.reset(
        driver
          ? { name: driver.name, phone1: driver.phone1 ?? '', phone2: driver.phone2 ?? '' }
          : undefined
      )
  })

  const columns: ColumnDef<Driver, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') },
    {
      accessorKey: 'phone1',
      header: t('driversSettings.phone1'),
      meta: { nowrap: true },
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      accessorKey: 'phone2',
      header: t('driversSettings.phone2'),
      meta: { nowrap: true },
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    }
  ]

  return (
    <SettingsEntityPage
      title={t('driversSettings.title')}
      addButtonText={t('driversSettings.addButton')}
      addTitle={t('driversSettings.addTitle')}
      editTitle={t('driversSettings.editTitle')}
      actionsText={t('common.columns.actions')}
      editText={t('common.edit')}
      deleteText={t('common.delete')}
      addSubmitText={t('contractorsSettings.addSubmit')}
      saveEditText={t('contractorsSettings.saveEdit')}
      cancelText={t('common.cancel')}
      rows={crud.rows}
      loading={crud.loading}
      columns={columns}
      getRowId={(driver) => String(driver.id)}
      isEditing={crud.isEditing}
      dialogOpen={crud.dialogOpen}
      closeDisabled={driverForm.formState.isSubmitting}
      onAdd={crud.openForCreate}
      onEdit={crud.openForEdit}
      onDelete={crud.deleteRow}
      onDialogOpenChange={crud.handleDialogOpenChange}
      onCancel={crud.closeDialog}
      onSubmit={driverForm.handleSubmit(crud.save)}
    >
      <Form {...driverForm}>
        <FormField
          control={driverForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('driversSettings.fields.name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('driversSettings.fields.name')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={driverForm.control}
          name="phone1"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('driversSettings.phone1')}</FormLabel>
              <FormControl>
                <Input type="text" placeholder={t('driversSettings.phone1')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={driverForm.control}
          name="phone2"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('driversSettings.phone2')}</FormLabel>
              <FormControl>
                <Input type="text" placeholder={t('driversSettings.phone2')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </SettingsEntityPage>
  )
}
