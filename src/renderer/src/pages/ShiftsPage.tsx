import { ipcApi } from '@/lib/ipcErrors'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import type { ColumnDef } from '@tanstack/react-table'
import { createShiftSchema } from '@/components/CreateShiftForm'
import type { CreateShiftValues } from '@/components/CreateShiftForm'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatQuantity } from '@/lib/numberFormat'
import {
  useShiftsPageData,
  type CloseShiftValues,
  type ReopenShiftValues,
  type ShiftListRow
} from './useShiftsPageData'
import { ShiftsDialogs } from './ShiftsDialogs'

export function ShiftsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [closeShiftErrors, setCloseShiftErrors] = useState<string[]>([])
  const [closeShiftBackupWarning, setCloseShiftBackupWarning] = useState(false)
  const [reopenShiftRootError, setReopenShiftRootError] = useState<string | null>(null)
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false)
  const closeShiftForm = useForm<CloseShiftValues>({
    defaultValues: { shiftId: '', endDate: '' }
  })
  const closeShiftId = useWatch({ control: closeShiftForm.control, name: 'shiftId' })
  const endDate = useWatch({ control: closeShiftForm.control, name: 'endDate' })
  const reportedTripCount = useWatch({ control: closeShiftForm.control, name: 'reportedTripCount' })
  const {
    shifts,
    drivers,
    vehicles,
    loading,
    closingAttachments,
    tripsMissingAttachments,
    loadedCloseRequirementsShiftId,
    loadShifts,
    refreshCloseRequirements,
    clearCloseRequirements
  } = useShiftsPageData(closeShiftId)
  const reopenShiftForm = useForm<ReopenShiftValues>({
    defaultValues: { shiftId: '', reason: '' }
  })
  const reopenShiftId = useWatch({ control: reopenShiftForm.control, name: 'shiftId' })
  const reopenReason = useWatch({ control: reopenShiftForm.control, name: 'reason' })
  const createShiftForm = useForm<CreateShiftValues>({
    resolver: zodResolver(createShiftSchema),
    defaultValues: {
      driverId: undefined,
      vehicleNo: undefined,
      crusherCubicDefault: 0,
      clientCubicDefault: 0,
      startDate: '',
      reportedDestination: '',
      notes: ''
    }
  })

  async function handleCreateShift(values: CreateShiftValues): Promise<boolean> {
    const result = await ipcApi.createShift(values)
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

  async function handleCloseShift(values: CloseShiftValues): Promise<void> {
    setCloseShiftErrors([])
    setCloseShiftBackupWarning(false)
    const result = await ipcApi.closeShift({
      shiftId: values.shiftId,
      endDate: values.endDate,
      reportedTripCount: values.reportedTripCount
    })
    if (!result.ok) {
      const tripCountError = result.errors.find(
        (error) => error.field === 'reportedTripCount' || error.field === 'tripCount'
      )
      if (tripCountError) {
        closeShiftForm.setError('reportedTripCount', { message: tripCountError.message })
      }
      setCloseShiftErrors(
        result.errors
          .filter((error) => error.field !== 'reportedTripCount' && error.field !== 'tripCount')
          .map((error) => error.message)
      )
      return
    }
    setIsCloseDialogOpen(false)
    closeShiftForm.reset()
    clearCloseRequirements()
    setCloseShiftErrors([])
    setCloseShiftBackupWarning(result.data.backupWarning === true)
    await loadShifts()
  }

  async function handleReopenShift(values: ReopenShiftValues): Promise<void> {
    setReopenShiftRootError(null)
    const result = await ipcApi.reopenShift(values)
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (error.field === 'shiftId' || error.field === 'reason') {
          reopenShiftForm.setError(error.field, {
            message: error.message
          })
        } else if (error.field === 'root') {
          setReopenShiftRootError(error.message)
        }
      })
      return
    }
    setIsReopenDialogOpen(false)
    reopenShiftForm.reset()
    await loadShifts()
  }

  const shiftToClose = shifts.find((shift) => shift.id === closeShiftId)
  const hasClosingDocument = closingAttachments.length > 0
  const checkingCloseRequirements =
    Boolean(closeShiftId) && loadedCloseRequirementsShiftId !== closeShiftId
  const columns: ColumnDef<ShiftListRow, unknown>[] = [
    { accessorKey: 'id', header: t('shifts.shiftInfo.number'), meta: { nowrap: true } },
    { accessorKey: 'driverName', header: t('ledgerEntryForm.fields.driver') },
    {
      accessorKey: 'vehicleNo',
      header: t('vehiclesSettings.fields.vehicleNo'),
      meta: { nowrap: true }
    },
    {
      accessorKey: 'status',
      header: t('shifts.columns.status'),
      meta: { nowrap: true },
      cell: ({ getValue }) => {
        const status = String(getValue())
        const statusKey = status === 'OPEN' ? 'open' : status === 'REOPENED' ? 'reopened' : 'closed'
        const colorClass =
          status === 'OPEN'
            ? 'border-transparent bg-green-600 text-white hover:bg-green-600'
            : status === 'REOPENED'
              ? 'border-transparent bg-amber-500 text-white hover:bg-amber-500'
              : 'border-transparent bg-gray-500 text-white hover:bg-gray-500'

        return <Badge className={colorClass}>{t(`shiftStatus.${statusKey}`)}</Badge>
      }
    },
    {
      accessorKey: 'startDate',
      header: t('shifts.columns.startDate'),
      meta: { nowrap: true }
    },
    {
      id: 'endDate',
      accessorFn: (shift) => shift.endDate ?? t('common.emDash'),
      header: t('shifts.columns.endDate'),
      meta: { nowrap: true }
    },
    {
      accessorKey: 'actualTripCount',
      header: t('shifts.columns.tripCount'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatQuantity(getValue<number>())
    }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      {closeShiftBackupWarning && (
        <p role="alert" className="text-sm text-destructive">
          {t('shifts.closeBackupWarning')}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('shifts.title')}</h1>
        <ShiftsDialogs
          shifts={shifts}
          drivers={drivers}
          vehicles={vehicles}
          createShiftForm={createShiftForm}
          closeShiftForm={closeShiftForm}
          reopenShiftForm={reopenShiftForm}
          isOpenDialogOpen={isOpenDialogOpen}
          setIsOpenDialogOpen={setIsOpenDialogOpen}
          isCloseDialogOpen={isCloseDialogOpen}
          setIsCloseDialogOpen={setIsCloseDialogOpen}
          isReopenDialogOpen={isReopenDialogOpen}
          setIsReopenDialogOpen={setIsReopenDialogOpen}
          closeShiftId={closeShiftId}
          endDate={endDate}
          reportedTripCount={reportedTripCount}
          reopenShiftId={reopenShiftId}
          reopenReason={reopenReason}
          reopenShiftRootError={reopenShiftRootError}
          setReopenShiftRootError={setReopenShiftRootError}
          closeShiftErrors={closeShiftErrors}
          tripsMissingAttachments={tripsMissingAttachments}
          shiftToClose={shiftToClose}
          hasClosingDocument={hasClosingDocument}
          checkingCloseRequirements={checkingCloseRequirements}
          refreshCloseRequirements={refreshCloseRequirements}
          handleCreateShift={handleCreateShift}
          handleCloseShift={handleCloseShift}
          handleReopenShift={handleReopenShift}
        />
      </div>
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader>
          <CardTitle>{t('shifts.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          <DataTable
            columns={columns}
            data={shifts}
            loading={loading}
            getRowId={(shift) => shift.id}
            enableRowSelection
            onRowClick={(shift) => navigate(`/shifts/${encodeURIComponent(shift.id)}`)}
            emptyMessage={t('dataTable.emptyMessage')}
          />
        </CardContent>
      </Card>
    </div>
  )
}
