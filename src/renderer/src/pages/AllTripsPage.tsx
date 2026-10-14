import { ipcApi } from '@/lib/ipcErrors'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/DataTable'
import { TripDetailsContent } from '@/components/TripDetailsContent'
import { useFloatingWindows } from '@/components/FloatingWindowsContext'
import { formatQuantity } from '@/lib/numberFormat'

type AllTripsRow = Extract<
  Awaited<ReturnType<typeof ipcApi.listAllTrips>>,
  { ok: true }
>['data'][number]

export function AllTripsPage(): React.JSX.Element {
  const [trips, setTrips] = useState<AllTripsRow[]>([])
  const [loading, setLoading] = useState(true)
  const { openWindow } = useFloatingWindows()
  const { t } = useTranslation()

  const columns: ColumnDef<AllTripsRow, unknown>[] = [
    { accessorKey: 'tripDate', header: t('common.columns.date') },
    { accessorKey: 'shiftId', header: t('common.columns.shift') },
    { accessorKey: 'driverName', header: t('ledgerEntryForm.fields.driver') },
    { accessorKey: 'vehicleNo', header: t('vehiclesSettings.fields.vehicleNo') },
    { accessorKey: 'crusherName', header: t('tripForm.fields.crusher') },
    { accessorKey: 'clientName', header: t('tripForm.fields.client') },
    {
      accessorKey: 'clientCubicReported',
      header: t('tripDetails.fields.clientCubicReported'),
      cell: ({ getValue }) => formatQuantity(getValue<number>())
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            openWindow(
              row.original.id,
              t('allTrips.detailsTitle', { id: row.original.id }),
              <TripDetailsContent trip={row.original} />
            )
          }
        >
          {t('common.details')}
        </Button>
      )
    }
  ]

  useEffect(() => {
    void ipcApi.listAllTrips().then((result) => {
      if (result.ok) setTrips(result.data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('allTrips.title')}</h1>
      <DataTable
        columns={columns}
        data={trips}
        loading={loading}
        getRowId={(row) => row.id}
        enableRowSelection
        sumColumnId="clientCubicReported"
        formatSum={formatQuantity}
        initialSorting={[{ id: 'tripDate', desc: false }]}
      />
    </div>
  )
}
