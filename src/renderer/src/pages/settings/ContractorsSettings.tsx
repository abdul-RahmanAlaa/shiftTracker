import { ipcApi } from '@/lib/ipcErrors'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { SettingsEntityPage } from '@/pages/settings/SettingsEntityPage'
import { useSettingsCrud } from '@/pages/settings/useSettingsCrud'
import { ContractorSettingsFields } from './ContractorSettingsFields'
import {
  contractorSchema,
  type Contractor,
  type ContractorFormInput,
  type ContractorFormValues
} from './settingsFormSchemas'

export function ContractorsSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const contractorForm = useForm<ContractorFormInput>({
    resolver: zodResolver(contractorSchema, undefined, {
      raw: true
    }) as Resolver<ContractorFormInput>,
    defaultValues: { name: '', phone: '', openingBalance: '', openingBalanceDate: '' }
  })
  const crud = useSettingsCrud<Contractor, ContractorFormInput>({
    list: () => ipcApi.listContractors(),
    save: async (editingContractor, values) => {
      let parsedValues: ContractorFormValues
      try {
        parsedValues = contractorSchema.parse(values)
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.issues.forEach((issue) => {
            const field = issue.path[0]
            if (
              field === 'name' ||
              field === 'phone' ||
              field === 'openingBalance' ||
              field === 'openingBalanceDate'
            ) {
              contractorForm.setError(field, { message: issue.message })
            }
          })
          return undefined
        }
        throw error
      }

      const result = editingContractor
        ? await ipcApi.updateContractor({ id: editingContractor.id, ...parsedValues })
        : await ipcApi.createContractor(parsedValues)
      if (!result.ok) {
        result.errors.forEach((error) => {
          if (
            error.field === 'name' ||
            error.field === 'phone' ||
            error.field === 'openingBalance' ||
            error.field === 'openingBalanceDate'
          ) {
            contractorForm.setError(error.field, { message: error.message })
          }
        })
      }
      return result
    },
    remove: (contractor) => ipcApi.deleteContractor({ id: contractor.id }),
    getRowId: (contractor) => contractor.id,
    getDeleteConfirmation: (contractor) =>
      t('contractorsSettings.deleteConfirmation', { name: contractor.name }),
    resetForm: (contractor) =>
      contractorForm.reset(
        contractor
          ? {
              name: contractor.name,
              phone: contractor.phone ?? '',
              openingBalance: String(contractor.openingBalance ?? 0),
              openingBalanceDate: contractor.openingBalanceDate ?? ''
            }
          : { name: '', phone: '', openingBalance: '', openingBalanceDate: '' }
      )
  })

  const columns: ColumnDef<Contractor, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') },
    {
      accessorKey: 'phone',
      header: t('contractorsSettings.phoneNumber'),
      meta: { nowrap: true },
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    }
  ]

  return (
    <SettingsEntityPage
      title={t('contractorsSettings.title')}
      addButtonText={t('contractorsSettings.addButton')}
      addTitle={t('contractorsSettings.addTitle')}
      editTitle={t('contractorsSettings.editTitle')}
      actionsText={t('common.columns.actions')}
      editText={t('common.edit')}
      deleteText={t('common.delete')}
      addSubmitText={t('contractorsSettings.addSubmit')}
      saveEditText={t('contractorsSettings.saveEdit')}
      cancelText={t('common.cancel')}
      rows={crud.rows}
      loading={crud.loading}
      columns={columns}
      getRowId={(contractor) => String(contractor.id)}
      isEditing={crud.isEditing}
      dialogOpen={crud.dialogOpen}
      closeDisabled={contractorForm.formState.isSubmitting}
      onAdd={crud.openForCreate}
      onEdit={crud.openForEdit}
      onDelete={crud.deleteRow}
      onDialogOpenChange={crud.handleDialogOpenChange}
      onCancel={crud.closeDialog}
      onSubmit={contractorForm.handleSubmit(crud.save)}
    >
      <ContractorSettingsFields form={contractorForm} />
    </SettingsEntityPage>
  )
}
