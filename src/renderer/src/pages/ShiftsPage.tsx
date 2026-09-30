import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { LockKeyhole, Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { CreateShiftForm, createShiftSchema } from '@/components/CreateShiftForm'
import type { CreateShiftValues } from '@/components/CreateShiftForm'
import { DataTable } from '@/components/DataTable'
import { ReceiptPhoto } from '@/components/ReceiptPhoto'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePicker } from '@/components/ui/date-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

type ShiftListRow = Extract<
  Awaited<ReturnType<typeof window.api.listShifts>>,
  { ok: true }
>['data'][number]

export function ShiftsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [shifts, setShifts] = useState<ShiftListRow[]>([])
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([])
  const [vehicles, setVehicles] = useState<
    { vehicleNo: number; trailerNo: number; contractorId: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [closeShiftId, setCloseShiftId] = useState('')
  const [endDate, setEndDate] = useState('')
  const createShiftForm = useForm<CreateShiftValues>({
    resolver: zodResolver(createShiftSchema),
    defaultValues: {
      driverId: undefined,
      vehicleNo: undefined,
      crusherCubicDefault: 0,
      clientCubicDefault: 0,
      startDate: '',
      reportedDestination: '',
      reportedTripCount: undefined,
      notes: ''
    }
  })

  useEffect(() => {
    void Promise.all([
      window.api.listShifts(),
      window.api.listDrivers(),
      window.api.listVehicles()
    ]).then(([shiftResult, driversResult, vehiclesResult]) => {
      if (shiftResult.ok) setShifts(shiftResult.data)
      if (driversResult.ok) setDrivers(driversResult.data)
      if (vehiclesResult.ok) setVehicles(vehiclesResult.data)
      setLoading(false)
    })
  }, [])

  async function loadShifts(): Promise<void> {
    const result = await window.api.listShifts()
    if (result.ok) setShifts(result.data)
  }

  async function handleCreateShift(values: CreateShiftValues): Promise<boolean> {
    const result = await window.api.createShift(values)
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (error.field in values) {
          createShiftForm.setError(error.field as keyof CreateShiftValues, {
            message: error.message
          })
        }
      })
      return false
    }
    createShiftForm.reset()
    setIsOpenDialogOpen(false)
    await loadShifts()
    return true
  }

  function handleClosingPhotoChange(shiftId: string, photoPath: string | null): void {
    setShifts((previous) =>
      previous.map((shift) =>
        shift.id === shiftId ? { ...shift, closingPhotoPath: photoPath } : shift
      )
    )
  }

  async function handleCloseShift(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    const result = await window.api.closeShift({ shiftId: closeShiftId, endDate })
    if (!result.ok) return
    setIsCloseDialogOpen(false)
    setCloseShiftId('')
    setEndDate('')
    await loadShifts()
  }

  const shiftToClose = shifts.find((shift) => shift.id === closeShiftId)
  const hasClosingPhoto = Boolean(shiftToClose?.closingPhotoPath?.trim())
  const columns: ColumnDef<ShiftListRow, unknown>[] = [
    { accessorKey: 'id', header: t('shifts.shiftInfo.number') },
    { accessorKey: 'driverName', header: t('ledgerEntryForm.fields.driver') },
    { accessorKey: 'vehicleNo', header: t('vehiclesSettings.fields.vehicleNo') },
    {
      accessorKey: 'status',
      header: t('shifts.columns.status'),
      cell: ({ getValue }) => (
        <Badge
          className={
            getValue() === 'OPEN'
              ? 'border-transparent bg-green-600 text-white hover:bg-green-600'
              : 'border-transparent bg-gray-500 text-white hover:bg-gray-500'
          }
        >
          {t(getValue() === 'OPEN' ? 'shiftStatus.open' : 'shiftStatus.closed')}
        </Badge>
      )
    },
    { accessorKey: 'startDate', header: t('shifts.columns.startDate') },
    {
      id: 'endDate',
      accessorFn: (shift) => shift.endDate ?? t('common.emDash'),
      header: t('shifts.columns.endDate')
    },
    { accessorKey: 'actualTripCount', header: t('shifts.columns.tripCount') }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('shifts.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Dialog
            open={isOpenDialogOpen}
            onOpenChange={(open) => {
              setIsOpenDialogOpen(open)
              if (!open) createShiftForm.reset()
            }}
          >
            <Button type="button" onClick={() => setIsOpenDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('createShift.title')}
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{t('createShift.title')}</DialogTitle>
              </DialogHeader>
              <CreateShiftForm
                form={createShiftForm}
                drivers={drivers}
                vehicles={vehicles}
                onSubmit={handleCreateShift}
                inline
              />
            </DialogContent>
          </Dialog>
          <Dialog
            open={isCloseDialogOpen}
            onOpenChange={(open) => {
              setIsCloseDialogOpen(open)
              if (!open) {
                setCloseShiftId('')
                setEndDate('')
              }
            }}
          >
            <Button type="button" variant="outline" onClick={() => setIsCloseDialogOpen(true)}>
              <LockKeyhole className="h-4 w-4" />
              {t('shifts.closeCardTitle')}
            </Button>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t('shifts.closeCardTitle')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCloseShift} className="grid gap-4 md:grid-cols-2">
                <Select value={closeShiftId} onValueChange={setCloseShiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('shifts.selectShift')} />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts
                      .filter((shift) => shift.status === 'OPEN')
                      .map((shift) => (
                        <SelectItem key={shift.id} value={shift.id}>
                          {shift.id} ({shift.driverName})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <DatePicker
                  value={endDate}
                  onChange={setEndDate}
                  placeholder={t('shifts.closeDatePlaceholder')}
                />
                {shiftToClose && (
                  <div className="flex flex-col gap-2 md:col-span-2">
                    <p className="text-sm font-medium">{t('receiptPhoto.labels.shift')}</p>
                    <ReceiptPhoto
                      entityKind="shift"
                      entityId={shiftToClose.id}
                      photoPath={shiftToClose.closingPhotoPath}
                      onPhotoChange={(photoPath) =>
                        handleClosingPhotoChange(shiftToClose.id, photoPath)
                      }
                      savePhoto={(entityId, imageBase64) =>
                        window.api.saveShiftPhoto({ shiftId: entityId, imageBase64 })
                      }
                      deletePhoto={(entityId) => window.api.deleteShiftPhoto({ shiftId: entityId })}
                      getPhoto={(photoPath) => window.api.getShiftPhoto({ photoPath })}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    type="submit"
                    disabled={!closeShiftId || !endDate || !hasClosingPhoto}
                    title={!hasClosingPhoto ? t('shifts.closingPhotoRequired') : undefined}
                  >
                    {t('shifts.closeSubmit')}
                  </Button>
                  {!hasClosingPhoto && closeShiftId && (
                    <p className="text-sm text-muted-foreground">
                      {t('shifts.closingPhotoRequired')}
                    </p>
                  )}
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <Card className="min-h-0 flex-1">
        <CardHeader>
          <CardTitle>{t('shifts.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-col">
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : (
            <DataTable
              columns={columns}
              data={shifts}
              getRowId={(shift) => shift.id}
              enableRowSelection
              onRowClick={(shift) => navigate(`/shifts/${encodeURIComponent(shift.id)}`)}
              emptyMessage={t('dataTable.emptyMessage')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
