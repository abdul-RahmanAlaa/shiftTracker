import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const vehicleSchema = z.object({
  vehicleNo: z.number().int().positive(i18n.t('vehiclesSettings.validation.vehicleNoRequired')),
  trailerNo: z.number().int().positive(i18n.t('vehiclesSettings.validation.trailerNoRequired')),
  contractorId: z.number().int().positive(i18n.t('vehiclesSettings.validation.contractorRequired')),
  defaultCubic: z
    .number()
    .nonnegative(i18n.t('vehiclesSettings.validation.defaultCubicRequired'))
    .optional(),
  ownerName: z.string().optional()
})

type VehicleFormValues = z.infer<typeof vehicleSchema>
type Vehicle = {
  vehicleNo: number
  trailerNo: number
  contractorId: number
  defaultCubic: number | null
  ownerName: string | null
}

export function VehiclesSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [contractors, setContractors] = useState<{ id: number; name: string }[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [editingVehicleNo, setEditingVehicleNo] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
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

  async function loadVehicles(): Promise<void> {
    setLoading(true)
    const [contractorsResult, vehiclesResult] = await Promise.all([
      window.api.listContractors(),
      window.api.listVehicles()
    ])
    if (contractorsResult.ok) setContractors(contractorsResult.data)
    if (vehiclesResult.ok) setVehicles(vehiclesResult.data)
    setLoading(false)
  }

  useEffect(() => {
    void Promise.all([window.api.listContractors(), window.api.listVehicles()]).then(
      ([contractorsResult, vehiclesResult]) => {
        if (contractorsResult.ok) setContractors(contractorsResult.data)
        if (vehiclesResult.ok) setVehicles(vehiclesResult.data)
        setLoading(false)
      }
    )
  }, [])

  async function handleSaveVehicle(values: VehicleFormValues): Promise<void> {
    const result = editingVehicleNo
      ? await window.api.updateVehicle(values)
      : await window.api.createVehicle(values)
    if (result.ok) {
      setIsDialogOpen(false)
      vehicleForm.reset()
      setEditingVehicleNo(null)
      await loadVehicles()
    } else {
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
  }

  function startEditingVehicle(vehicle: Vehicle): void {
    setEditingVehicleNo(vehicle.vehicleNo)
    vehicleForm.reset({
      vehicleNo: vehicle.vehicleNo,
      trailerNo: vehicle.trailerNo,
      contractorId: vehicle.contractorId,
      defaultCubic: vehicle.defaultCubic ?? undefined,
      ownerName: vehicle.ownerName ?? ''
    })
    setIsDialogOpen(true)
  }

  function cancelEditingVehicle(): void {
    setEditingVehicleNo(null)
    vehicleForm.reset()
    setIsDialogOpen(false)
  }

  async function handleDeleteVehicle(vehicleNo: number): Promise<void> {
    if (!confirm(t('vehiclesSettings.deleteConfirmation', { vehicleNo }))) return
    const result = await window.api.deleteVehicle({ vehicleNo })
    if (result.ok) {
      if (editingVehicleNo === vehicleNo) cancelEditingVehicle()
      await loadVehicles()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingVehicleNo(null)
      vehicleForm.reset()
    }
  }

  const columns: ColumnDef<Vehicle, unknown>[] = [
    { accessorKey: 'vehicleNo', header: t('vehiclesSettings.fields.vehicleNo') },
    {
      accessorKey: 'trailerNo',
      header: t('vehiclesSettings.fields.trailerNo'),
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
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      accessorKey: 'ownerName',
      header: t('vehiclesSettings.fields.ownerName'),
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => startEditingVehicle(row.original)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteVehicle(row.original.vehicleNo)}
          >
            {t('common.delete')}
          </Button>
        </div>
      )
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('vehiclesSettings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingVehicleNo(null)
                vehicleForm.reset()
              }}
            >
              {t('vehiclesSettings.addButton')}
            </Button>
          </DialogTrigger>
          <DialogContent closeDisabled={vehicleForm.formState.isSubmitting}>
            <DialogHeader>
              <DialogTitle>
                {editingVehicleNo !== null
                  ? t('vehiclesSettings.editTitle')
                  : t('vehiclesSettings.addTitle')}
              </DialogTitle>
            </DialogHeader>
            <Form {...vehicleForm}>
              <form
                noValidate
                onSubmit={vehicleForm.handleSubmit(handleSaveVehicle)}
                className="grid gap-4 md:grid-cols-2"
              >
                <FormField
                  control={vehicleForm.control}
                  name="vehicleNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('vehiclesSettings.fields.vehicleNo')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={t('vehiclesSettings.fields.vehicleNo')}
                          disabled={editingVehicleNo !== null}
                          value={field.value ?? ''}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value === '' ? undefined : Number(event.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
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
                            field.onChange(
                              event.target.value === '' ? undefined : Number(event.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
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
                            <SelectValue
                              placeholder={t('ledgerEntryForm.placeholders.contractor')}
                            />
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
                  control={vehicleForm.control}
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
                            field.onChange(
                              event.target.value === '' ? undefined : Number(event.target.value)
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={vehicleForm.control}
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
                <DialogFooter className="md:col-span-2">
                  <SubmitButton isSubmitting={vehicleForm.formState.isSubmitting}>
                    {editingVehicleNo !== null
                      ? t('contractorsSettings.saveEdit')
                      : t('contractorsSettings.addSubmit')}
                  </SubmitButton>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={vehicleForm.formState.isSubmitting}
                      onClick={cancelEditingVehicle}
                    >
                      {t('common.cancel')}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={vehicles}
            loading={loading}
            getRowId={(vehicle) => String(vehicle.vehicleNo)}
            enableRowSelection
            sumColumnId="defaultCubic"
          />
        </div>
      </CardContent>
    </Card>
  )
}
