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

const materialTypeSchema = z.object({
  name: z.string().min(1, i18n.t('materialTypesSettings.validation.nameRequired'))
})

type MaterialTypeFormInput = z.input<typeof materialTypeSchema>
type MaterialType = { id: number; name: string }

export function MaterialTypesSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const materialTypeForm = useForm<MaterialTypeFormInput>({
    resolver: zodResolver(materialTypeSchema),
    defaultValues: { name: '' }
  })
  const crud = useSettingsCrud<MaterialType, MaterialTypeFormInput>({
    list: () => ipcApi.listMaterialTypes(),
    save: async (editingMaterialType, values) => {
      const result = editingMaterialType
        ? await ipcApi.updateMaterialType({ id: editingMaterialType.id, ...values })
        : await ipcApi.createMaterialType(values)
      if (!result.ok && result.errors.some((error) => error.field === 'name')) {
        const error = result.errors.find((item) => item.field === 'name')
        if (error) materialTypeForm.setError('name', { message: error.message })
      }
      return result
    },
    remove: (materialType) => ipcApi.deleteMaterialType({ id: materialType.id }),
    getRowId: (materialType) => materialType.id,
    getDeleteConfirmation: (materialType) =>
      t('materialTypesSettings.deleteConfirmation', { name: materialType.name }),
    resetForm: (materialType) =>
      materialTypeForm.reset(materialType ? { name: materialType.name } : { name: '' })
  })

  const columns: ColumnDef<MaterialType, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') }
  ]

  return (
    <SettingsEntityPage
      title={t('materialTypesSettings.title')}
      addButtonText={t('materialTypesSettings.addButton')}
      addTitle={t('materialTypesSettings.addTitle')}
      editTitle={t('materialTypesSettings.editTitle')}
      actionsText={t('common.columns.actions')}
      editText={t('common.edit')}
      deleteText={t('common.delete')}
      addSubmitText={t('contractorsSettings.addSubmit')}
      saveEditText={t('contractorsSettings.saveEdit')}
      cancelText={t('common.cancel')}
      rows={crud.rows}
      loading={crud.loading}
      columns={columns}
      getRowId={(materialType) => String(materialType.id)}
      isEditing={crud.isEditing}
      dialogOpen={crud.dialogOpen}
      closeDisabled={materialTypeForm.formState.isSubmitting}
      onAdd={crud.openForCreate}
      onEdit={crud.openForEdit}
      onDelete={crud.deleteRow}
      onDialogOpenChange={crud.handleDialogOpenChange}
      onCancel={crud.closeDialog}
      onSubmit={materialTypeForm.handleSubmit(crud.save)}
      noValidate
    >
      <Form {...materialTypeForm}>
        <FormField
          control={materialTypeForm.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('materialTypesSettings.fields.name')}</FormLabel>
              <FormControl>
                <Input placeholder={t('materialTypesSettings.fields.name')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    </SettingsEntityPage>
  )
}
