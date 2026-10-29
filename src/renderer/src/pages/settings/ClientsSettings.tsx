import { ipcApi } from '@/lib/ipcErrors'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useForm, type Resolver } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { formatMoney } from '@/lib/numberFormat'
import { SettingsEntityPage } from '@/pages/settings/SettingsEntityPage'
import { useSettingsCrud } from '@/pages/settings/useSettingsCrud'
import { ClientSettingsFields } from './ClientSettingsFields'
import {
  clientSchema,
  type Client,
  type ClientFormInput,
  type ClientFormValues
} from './settingsFormSchemas'

export function ClientsSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const clientForm = useForm<ClientFormInput>({
    resolver: zodResolver(clientSchema, undefined, { raw: true }) as Resolver<ClientFormInput>,
    defaultValues: {
      name: '',
      location: '',
      initialPrice: '',
      openingBalance: '',
      openingBalanceDate: ''
    }
  })
  const crud = useSettingsCrud<Client, ClientFormInput>({
    list: () => ipcApi.listClients(),
    save: async (editingClient, values) => {
      let parsedValues: ClientFormValues
      try {
        parsedValues = clientSchema.parse(values)
      } catch (error) {
        if (error instanceof z.ZodError) {
          error.issues.forEach((issue) => {
            const field = issue.path[0]
            if (
              field === 'name' ||
              field === 'location' ||
              field === 'initialPrice' ||
              field === 'openingBalance' ||
              field === 'openingBalanceDate'
            ) {
              clientForm.setError(field, { message: issue.message })
            }
          })
          return undefined
        }
        throw error
      }

      const result = editingClient
        ? await ipcApi.updateClient({ id: editingClient.id, ...parsedValues })
        : await ipcApi.createClient(parsedValues)
      if (!result.ok) {
        result.errors.forEach((error) => {
          if (
            error.field === 'name' ||
            error.field === 'location' ||
            error.field === 'initialPrice' ||
            error.field === 'openingBalance' ||
            error.field === 'openingBalanceDate'
          ) {
            clientForm.setError(error.field, { message: error.message })
          }
        })
      }
      return result
    },
    remove: (client) => ipcApi.deleteClient({ id: client.id }),
    getRowId: (client) => client.id,
    getDeleteConfirmation: (client) =>
      t('clientsSettings.deleteConfirmation', { name: client.name }),
    resetForm: (client) =>
      clientForm.reset(
        client
          ? {
              name: client.name,
              location: client.location ?? '',
              initialPrice: client.initialPrice === null ? '' : String(client.initialPrice),
              openingBalance: String(client.openingBalance ?? 0),
              openingBalanceDate: client.openingBalanceDate ?? ''
            }
          : {
              name: '',
              location: '',
              initialPrice: '',
              openingBalance: '',
              openingBalanceDate: ''
            }
      )
  })

  const columns: ColumnDef<Client, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') },
    {
      accessorKey: 'initialPrice',
      header: t('common.defaultPrice'),
      meta: { nowrap: true },
      cell: ({ getValue }) => {
        const value = getValue<number | null>()
        return value === null ? t('common.emptyCell') : formatMoney(value)
      }
    },
    {
      accessorKey: 'location',
      header: t('clientsSettings.fields.location'),
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      accessorKey: 'openingBalance',
      header: t('common.openingBalance'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatMoney(getValue<number>())
    },
    {
      accessorKey: 'openingBalanceDate',
      header: t('common.openingBalanceDate'),
      meta: { nowrap: true },
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    }
  ]

  return (
    <SettingsEntityPage
      title={t('clientsSettings.title')}
      addButtonText={t('clientsSettings.addButton')}
      addTitle={t('clientsSettings.addTitle')}
      editTitle={t('clientsSettings.editTitle')}
      actionsText={t('common.columns.actions')}
      editText={t('common.edit')}
      deleteText={t('common.delete')}
      addSubmitText={t('contractorsSettings.addSubmit')}
      saveEditText={t('contractorsSettings.saveEdit')}
      cancelText={t('common.cancel')}
      rows={crud.rows}
      loading={crud.loading}
      columns={columns}
      getRowId={(client) => String(client.id)}
      isEditing={crud.isEditing}
      dialogOpen={crud.dialogOpen}
      closeDisabled={clientForm.formState.isSubmitting}
      onAdd={crud.openForCreate}
      onEdit={crud.openForEdit}
      onDelete={crud.deleteRow}
      onDialogOpenChange={crud.handleDialogOpenChange}
      onCancel={crud.closeDialog}
      onSubmit={clientForm.handleSubmit(crud.save)}
      noValidate
    >
      <ClientSettingsFields form={clientForm} />
    </SettingsEntityPage>
  )
}
