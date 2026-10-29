import { ipcApi } from '@/lib/ipcErrors'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { formatMoney } from '@/lib/numberFormat'
import { SettingsEntityPage } from '@/pages/settings/SettingsEntityPage'
import { useSettingsCrud } from '@/pages/settings/useSettingsCrud'
import { CrusherSettingsFields } from './CrusherSettingsFields'
import {
  crusherSchema,
  type Crusher,
  type CrusherFormInput,
  type CrusherFormValues
} from './settingsFormSchemas'

export function CrushersSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const crusherForm = useForm<CrusherFormInput>({
    resolver: zodResolver(crusherSchema, undefined, { raw: true }) as Resolver<CrusherFormInput>,
    defaultValues: { name: '', initialPrice: '' }
  })
  const crud = useSettingsCrud<Crusher, CrusherFormInput>({
    list: () => ipcApi.listCrushers(),
    save: async (editingCrusher, values) => {
      let parsedValues: CrusherFormValues
      try {
        parsedValues = crusherSchema.parse(values)
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.issues.forEach((issue) => {
            const field = issue.path[0]
            if (field === 'name' || field === 'initialPrice') {
              crusherForm.setError(field, { message: issue.message })
            }
          })
          return undefined
        }
        throw error
      }

      const result = editingCrusher
        ? await ipcApi.updateCrusher({ id: editingCrusher.id, ...parsedValues })
        : await ipcApi.createCrusher(parsedValues)
      if (!result.ok) {
        result.errors.forEach((error) => {
          if (error.field === 'name' || error.field === 'initialPrice') {
            crusherForm.setError(error.field, { message: error.message })
          }
        })
      }
      return result
    },
    remove: (crusher) => ipcApi.deleteCrusher({ id: crusher.id }),
    getRowId: (crusher) => crusher.id,
    getDeleteConfirmation: (crusher) =>
      t('crushersSettings.deleteConfirmation', { name: crusher.name }),
    resetForm: (crusher) =>
      crusherForm.reset(
        crusher
          ? {
              name: crusher.name,
              initialPrice: crusher.initialPrice === null ? '' : String(crusher.initialPrice)
            }
          : { name: '', initialPrice: '' }
      )
  })

  const columns: ColumnDef<Crusher, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') },
    {
      accessorKey: 'initialPrice',
      header: t('common.defaultPrice'),
      meta: { nowrap: true },
      cell: ({ getValue }) => {
        const value = getValue<number | null>()
        return value === null ? t('common.emptyCell') : formatMoney(value)
      }
    }
  ]

  return (
    <SettingsEntityPage
      title={t('crushersSettings.title')}
      addButtonText={t('crushersSettings.addButton')}
      addTitle={t('crushersSettings.addTitle')}
      editTitle={t('crushersSettings.editTitle')}
      actionsText={t('common.columns.actions')}
      editText={t('common.edit')}
      deleteText={t('common.delete')}
      addSubmitText={t('contractorsSettings.addSubmit')}
      saveEditText={t('contractorsSettings.saveEdit')}
      cancelText={t('common.cancel')}
      rows={crud.rows}
      loading={crud.loading}
      columns={columns}
      getRowId={(crusher) => String(crusher.id)}
      isEditing={crud.isEditing}
      dialogOpen={crud.dialogOpen}
      closeDisabled={crusherForm.formState.isSubmitting}
      onAdd={crud.openForCreate}
      onEdit={crud.openForEdit}
      onDelete={crud.deleteRow}
      onDialogOpenChange={crud.handleDialogOpenChange}
      onCancel={crud.closeDialog}
      onSubmit={crusherForm.handleSubmit(crud.save)}
      noValidate
    >
      <CrusherSettingsFields form={crusherForm} />
    </SettingsEntityPage>
  )
}
