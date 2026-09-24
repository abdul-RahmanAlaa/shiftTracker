import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
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
  vehicleNo: z.number().int().positive('رقم السيارة مطلوب'),
  trailerNo: z.number().int().positive('رقم المقطورة يجب أن يكون رقمًا موجبًا'),
  contractorId: z.number().int().positive('المقاول مطلوب'),
  defaultCubic: z.number().nonnegative('التكعيب الافتراضي لازم يكون رقم موجب').optional(),
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
    if (!confirm(`متأكد إنك عايز تمسح العربية ${vehicleNo}؟`)) return
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
    { accessorKey: 'vehicleNo', header: 'رقم السيارة' },
    { accessorKey: 'trailerNo', header: 'رقم المقطورة', cell: ({ getValue }) => getValue() ?? '-' },
    {
      id: 'contractorName',
      accessorFn: (vehicle) =>
        contractors.find((contractor) => contractor.id === vehicle.contractorId)?.name ?? '-',
      header: 'المقاول'
    },
    {
      accessorKey: 'defaultCubic',
      header: 'التكعيب الافتراضي',
      cell: ({ getValue }) => getValue() ?? '-'
    },
    {
      accessorKey: 'ownerName',
      header: 'صاحب السيارة',
      cell: ({ getValue }) => getValue() ?? '-'
    },
    {
      id: 'actions',
      header: 'إجراءات',
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
            تعديل
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteVehicle(row.original.vehicleNo)}
          >
            مسح
          </Button>
        </div>
      )
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>العربيات</CardTitle>
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
              إضافة عربية
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingVehicleNo !== null ? 'تعديل عربية' : 'إضافة عربية جديدة'}
              </DialogTitle>
            </DialogHeader>
            <Form {...vehicleForm}>
              <form
                onSubmit={vehicleForm.handleSubmit(handleSaveVehicle)}
                className="grid gap-4 md:grid-cols-2"
              >
                <FormField
                  control={vehicleForm.control}
                  name="vehicleNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رقم السيارة</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="رقم السيارة"
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
                      <FormLabel>رقم المقطورة</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="رقم المقطورة"
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
                      <FormLabel>المقاول</FormLabel>
                      <Select
                        value={field.value ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المقاول" />
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
                      <FormLabel>التكعيب الافتراضي</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="التكعيب الافتراضي"
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
                      <FormLabel>صاحب السيارة</FormLabel>
                      <FormControl>
                        <Input placeholder="صاحب السيارة" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="md:col-span-2">
                  <Button type="submit">
                    {editingVehicleNo !== null ? 'حفظ التعديل' : 'إضافة'}
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="outline" onClick={cancelEditingVehicle}>
                      إلغاء
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <div className="mt-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : (
            <DataTable
              columns={columns}
              data={vehicles}
              getRowId={(vehicle) => String(vehicle.vehicleNo)}
              enableRowSelection
              sumColumnId="defaultCubic"
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
