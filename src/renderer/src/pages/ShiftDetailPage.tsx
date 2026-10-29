import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { Eye, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import { AttachmentManager } from '@/components/AttachmentManager'
import { ShiftBreadcrumb } from '@/components/ShiftBreadcrumb'
import { TripDetailsContent } from '@/components/TripDetailsContent'
import { useFloatingWindows } from '@/components/FloatingWindowsContext'
import { formatMoney, formatQuantity } from '@/lib/numberFormat'
import { ShiftTripDialogs } from './ShiftTripDialogs'

import type { AllTripsRow, TripRow } from './useShiftDetailPage'
import { useShiftDetailPage } from './useShiftDetailPage'

export function ShiftDetailPage(): React.JSX.Element {
  const { t } = useTranslation()
  const { openWindow } = useFloatingWindows()
  const { shiftId = '' } = useParams()
  const {
    shift,
    trips,
    loadedShiftId,
    resources,
    editTripForm,
    addTripForm,
    editingTripId,
    setEditingTripId,
    isAddTripDialogOpen,
    setIsAddTripDialogOpen,
    editCrusherReceiptStatus,
    editRecipientNameStatus,
    addCrusherReceiptStatus,
    addRecipientNameStatus,
    openAddTripDialog,
    handleCreateTrip,
    startEditingTrip,
    handleUpdateTrip,
    handleDeleteTrip
  } = useShiftDetailPage(shiftId)

  function openTripDetails(trip: TripRow): void {
    const detailsTrip: AllTripsRow = {
      ...trip,
      driverName: shift?.driverName ?? t('common.emptyCell'),
      vehicleNo: shift?.vehicleNo ?? 0,
      shiftStatus: shift?.status ?? 'OPEN',
      crusherName:
        resources.crushers.find((crusher) => crusher.id === trip.crusherId)?.name ??
        t('common.emptyCell'),
      clientName:
        resources.clients.find((client) => client.id === trip.clientId)?.name ??
        t('common.emptyCell'),
      materialTypeName:
        resources.materialTypes.find((materialType) => materialType.id === trip.materialTypeId)
          ?.name ?? null
    }

    openWindow(
      trip.id,
      t('allTrips.detailsTitle', { id: trip.id }),
      <TripDetailsContent trip={detailsTrip} />
    )
  }

  const isShiftClosed = shift?.status === 'CLOSED'
  const loading = loadedShiftId !== shiftId
  const tripColumns: ColumnDef<TripRow, unknown>[] = [
    { accessorKey: 'id', header: t('common.columns.id'), meta: { nowrap: true } },
    {
      accessorKey: 'tripDate',
      header: t('tripForm.fields.tripDate'),
      meta: { nowrap: true }
    },
    {
      accessorKey: 'crusherCubic',
      header: t('tripForm.fields.crusherCubic'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatQuantity(getValue<number>())
    },
    {
      accessorKey: 'clientCubicReported',
      header: t('tripForm.fields.clientCubic'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatQuantity(getValue<number>())
    },
    {
      accessorKey: 'clientPrice',
      header: t('tripForm.fields.clientPrice'),
      meta: { nowrap: true },
      cell: ({ getValue }) => formatMoney(getValue<number>())
    },
    {
      id: 'receiptPhoto',
      header: t('tripDetails.attachmentsTitle'),
      meta: { nowrap: true },
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <AttachmentManager entityType="TRIP" entityId={row.original.id} readOnly={isShiftClosed} />
      )
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      meta: { nowrap: true },
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('common.details')}
            title={t('common.details')}
            onClick={() => openTripDetails(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {isShiftClosed ? (
            <span className="text-sm text-muted-foreground">{t('common.lockedShift')}</span>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startEditingTrip(row.original)}
              >
                {t('common.edit')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleDeleteTrip(row.original)}
              >
                {t('common.delete')}
              </Button>
            </>
          )}
        </div>
      )
    }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <ShiftBreadcrumb currentPage={shiftId} />
      <h1 className="text-2xl font-semibold">{shiftId}</h1>
      {!loading && !shift ? (
        <p className="text-sm text-muted-foreground">{t('shifts.shiftNotFound')}</p>
      ) : (
        <>
          {shift && (
            <Card>
              <CardHeader>
                <CardTitle>{t('shifts.shiftInfo.number')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('ledgerEntryForm.fields.driver')}
                  </p>
                  <p>{shift.driverName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('vehiclesSettings.fields.vehicleNo')}
                  </p>
                  <p>{shift.vehicleNo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('shifts.columns.status')}</p>
                  <Badge>
                    {t(
                      shift.status === 'OPEN'
                        ? 'shiftStatus.open'
                        : shift.status === 'REOPENED'
                          ? 'shiftStatus.reopened'
                          : 'shiftStatus.closed'
                    )}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('createShift.fields.startDate')}
                  </p>
                  <p>{shift.startDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('shifts.columns.endDate')}</p>
                  <p>{shift.endDate ?? t('common.emDash')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('createShift.fields.crusherCubic')}
                  </p>
                  <p>{formatQuantity(shift.crusherCubicDefault)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {t('createShift.fields.clientCubic')}
                  </p>
                  <p>{formatQuantity(shift.clientCubicDefault)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('shifts.columns.tripCount')}</p>
                  <p>{formatQuantity(shift.actualTripCount)}</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>{t('shifts.tripsTitle', { id: shift?.id ?? shiftId })}</CardTitle>
              {shift?.status === 'REOPENED' && (
                <Button type="button" variant="outline" onClick={openAddTripDialog}>
                  <Plus className="h-4 w-4" />
                  {t('shifts.addTrip')}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              <ShiftTripDialogs
                isAddTripDialogOpen={isAddTripDialogOpen}
                setIsAddTripDialogOpen={setIsAddTripDialogOpen}
                addTripForm={addTripForm}
                editTripForm={editTripForm}
                editingTripId={editingTripId}
                setEditingTripId={setEditingTripId}
                resources={resources}
                addCrusherReceiptStatus={addCrusherReceiptStatus}
                addRecipientNameStatus={addRecipientNameStatus}
                editCrusherReceiptStatus={editCrusherReceiptStatus}
                editRecipientNameStatus={editRecipientNameStatus}
                handleCreateTrip={handleCreateTrip}
                handleUpdateTrip={handleUpdateTrip}
              />

              <DataTable
                columns={tripColumns}
                data={trips}
                loading={loading}
                getRowId={(trip) => trip.id}
                enableRowSelection
                emptyMessage={t('shifts.emptyTrips')}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
