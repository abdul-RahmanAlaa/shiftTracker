import { ipcApi } from '@/lib/ipcErrors'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { formatQuantity } from '@/lib/numberFormat'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { SettingsEntityPage } from '@/pages/settings/SettingsEntityPage'
import { useSettingsCrud } from '@/pages/settings/useSettingsCrud'
import { VehicleSettingsFields } from '@/pages/settings/VehicleSettingsFields'
import {
  vehicleSchema,
  type ContractorOption,
  type Vehicle,
  type VehicleFormValues
} from './settingsFormSchemas'

export function VehiclesSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [contractors, setContractors] = useState<ContractorOption[]>([])
  const vehicleForm = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      vehicleNo: undefined,
      trailerNo: undefined,
      contractorId: undefined,
      defaultCubic: undefined,
      ownerName: ''
    }
  })
  const crud = useSettingsCrud<Vehicle, VehicleFormValues>({
    list: async () => {
      const [contractorsResult, vehiclesResult] = await Promise.all([
        ipcApi.listContractors(),
        ipcApi.listVehicles()
      ])
      if (contractorsResult.ok) setContractors(contractorsResult.data)
      return vehiclesResult
    },
    save: async (editingVehicle, values) => {
      const result = editingVehicle
        ? await ipcApi.updateVehicle(values)
        : await ipcApi.createVehicle(values)
      if (!result.ok) {
        result.errors.forEach((error) => {
          if (
            error.field === 'vehicleNo' ||
            error.field === 'trailerNo' ||
            error.field === 'contractorId' ||
            error.field === 'defaultCubic' ||
            error.field === 'ownerName'
          ) {
            vehicleForm.setError(error.field, { message: error.message })
          }
        })
      }
      return result
    },
    remove: (vehicle) => ipcApi.deleteVehicle({ vehicleNo: vehicle.vehicleNo }),
    getRowId: (vehicle) => vehicle.vehicleNo,
    getDeleteConfirmation: (vehicle) =>
      t('vehiclesSettings.deleteConfirmation', { vehicleNo: vehicle.vehicleNo }),
    resetForm: (vehicle) =>
      vehicleForm.reset(
        vehicle
          ? {
              vehicleNo: vehicle.vehicleNo,
              trailerNo: vehicle.trailerNo,
              contractorId: vehicle.contractorId,
              defaultCubic: vehicle.defaultCubic ?? undefined,
              ownerName: vehicle.ownerName ?? ''
            }
          : undefined
      )
  })

  const columns: ColumnDef<Vehicle, unknown>[] = [
    {
      accessorKey: 'vehicleNo',
      header: t('vehiclesSettings.fields.vehicleNo'),
      meta: { nowrap: true }
    },
    {
      accessorKey: 'trailerNo',
      header: t('vehiclesSettings.fields.trailerNo'),
      meta: { nowrap: true },
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      id: 'contractorName',
      accessorFn: (vehicle) =>
        contractors.find((contractor) => contractor.id === vehicle.contractorId)?.name ?? '-',
      header: t('ledgerEntryForm.fields.contractor')
    },
    {
      accessorKey: 'defaultCubic',
      header: t('vehiclesSettings.fields.defaultCubic'),
      meta: { nowrap: true },
      cell: ({ getValue }) => {
        const value = getValue<number | null>()
        return value === null ? t('common.emptyCell') : formatQuantity(value)
      }
    },
    {
      accessorKey: 'ownerName',
      header: t('vehiclesSettings.fields.ownerName'),
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    }
  ]

  return (
    <SettingsEntityPage
      title={t('vehiclesSettings.title')}
      addButtonText={t('vehiclesSettings.addButton')}
      addTitle={t('vehiclesSettings.addTitle')}
      editTitle={t('vehiclesSettings.editTitle')}
      actionsText={t('common.columns.actions')}
      editText={t('common.edit')}
      deleteText={t('common.delete')}
      addSubmitText={t('contractorsSettings.addSubmit')}
      saveEditText={t('contractorsSettings.saveEdit')}
      cancelText={t('common.cancel')}
      rows={crud.rows}
      loading={crud.loading}
      columns={columns}
      getRowId={(vehicle) => String(vehicle.vehicleNo)}
      isEditing={crud.isEditing}
      dialogOpen={crud.dialogOpen}
      closeDisabled={vehicleForm.formState.isSubmitting}
      onAdd={crud.openForCreate}
      onEdit={crud.openForEdit}
      onDelete={crud.deleteRow}
      onDialogOpenChange={crud.handleDialogOpenChange}
      onCancel={crud.closeDialog}
      onSubmit={vehicleForm.handleSubmit(crud.save)}
      noValidate
      formClassName="grid gap-4 md:grid-cols-2"
      footerClassName="md:col-span-2"
      tableClassName="mt-6"
      sumColumnId="defaultCubic"
      formatSum={formatQuantity}
    >
      <VehicleSettingsFields
        form={vehicleForm}
        contractors={contractors}
        isEditing={crud.isEditing}
      />
    </SettingsEntityPage>
  )
}
