import { useEffect, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/DataTable'
import { TripDetailsContent } from '@/components/TripDetailsContent'
import { useFloatingWindows } from '@/components/FloatingWindowsContext'

type AllTripsRow = Extract<
  Awaited<ReturnType<typeof window.api.listAllTrips>>,
  { ok: true }
>['data'][number]

export function AllTripsPage(): React.JSX.Element {
  const [trips, setTrips] = useState<AllTripsRow[]>([])
  const [loading, setLoading] = useState(true)
  const { openWindow } = useFloatingWindows()

  const columns: ColumnDef<AllTripsRow, unknown>[] = [
    { accessorKey: 'tripDate', header: 'التاريخ' },
    { accessorKey: 'shiftId', header: 'الوردية' },
    { accessorKey: 'driverName', header: 'السائق' },
    { accessorKey: 'vehicleNo', header: 'رقم العربية' },
    { accessorKey: 'crusherName', header: 'الكسارة' },
    { accessorKey: 'clientName', header: 'العميل' },
    { accessorKey: 'effectiveClientCubic', header: 'الصافي' },
    {
      id: 'actions',
      header: 'الإجراءات',
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
              `تفاصيل النقلة ${row.original.id}`,
              <TripDetailsContent trip={row.original} />
            )
          }
        >
          تفاصيل
        </Button>
      )
    }
  ]

  useEffect(() => {
    void window.api.listAllTrips().then((result) => {
      if (result.ok) setTrips(result.data)
      setLoading(false)
    })
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">كل النقلات</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      ) : (
        <DataTable
          columns={columns}
          data={trips}
          getRowId={(row) => row.id}
          enableRowSelection
          sumColumnId="effectiveClientCubic"
          initialSorting={[{ id: 'tripDate', desc: false }]}
        />
      )}
    </div>
  )
}
