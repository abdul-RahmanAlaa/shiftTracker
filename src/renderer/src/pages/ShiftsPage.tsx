import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type { AddLog } from '@/App'

type ShiftListRow = {
  id: string
  vehicleNo: number
  driverId: number
  driverName: string
  crusherCubicDefault: number
  clientCubicDefault: number
  status: string
  startDate: string
  endDate: string | null
  actualTripCount: number
}

export function ShiftsPage(): React.JSX.Element {
  const { addLog } = useOutletContext<{ addLog: AddLog }>()
  const [shifts, setShifts] = useState<ShiftListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [shiftVehicleNo, setShiftVehicleNo] = useState('')
  const [shiftDriverId, setShiftDriverId] = useState('')
  const [crusherCubic, setCrusherCubic] = useState('')
  const [clientCubic, setClientCubic] = useState('')
  const [startDate, setStartDate] = useState('')
  const [closeShiftId, setCloseShiftId] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    void window.api.listShifts().then((result) => {
      if (result.ok) setShifts(result.data)
      setLoading(false)
    })
  }, [])

  async function handleCreateShift(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.createShift({
      vehicleNo: Number(shiftVehicleNo),
      driverId: Number(shiftDriverId),
      crusherCubicDefault: Number(crusherCubic),
      clientCubicDefault: Number(clientCubic),
      startDate
    })
    addLog(
      result.ok
        ? `✅ وردية اتفتحت: ${result.data?.id}`
        : `❌ وردية: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) setCloseShiftId(result.data?.id ?? '')
  }

  async function handleCloseShift(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.closeShift({ shiftId: closeShiftId, endDate })
    addLog(
      result.ok
        ? `✅ وردية اتقفلت: ${result.data?.id}`
        : `❌ قفل الوردية: ${result.errors?.map((x) => x.message).join(', ')}`
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">الورديات</h1>

      <Card>
        <CardHeader>
          <CardTitle>سجل الورديات</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">جاري التحميل...</p>
          ) : shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد بيانات بعد</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم الوردية</TableHead>
                  <TableHead>السائق</TableHead>
                  <TableHead>رقم السيارة</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>تاريخ البداية</TableHead>
                  <TableHead>تاريخ النهاية</TableHead>
                  <TableHead>عدد النقلات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>{shift.id}</TableCell>
                    <TableCell>{shift.driverName}</TableCell>
                    <TableCell>{shift.vehicleNo}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          shift.status === 'مفتوحة'
                            ? 'border-transparent bg-green-600 text-white hover:bg-green-600'
                            : 'border-transparent bg-gray-500 text-white hover:bg-gray-500'
                        }
                      >
                        {shift.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{shift.startDate}</TableCell>
                    <TableCell>{shift.endDate ?? '—'}</TableCell>
                    <TableCell>{shift.actualTripCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <h3>4) فتح وردية</h3>
      <form onSubmit={handleCreateShift}>
        <input
          value={shiftVehicleNo}
          onChange={(e) => setShiftVehicleNo(e.target.value)}
          placeholder="رقم السيارة"
        />
        <input
          value={shiftDriverId}
          onChange={(e) => setShiftDriverId(e.target.value)}
          placeholder="id السائق"
        />
        <input
          value={crusherCubic}
          onChange={(e) => setCrusherCubic(e.target.value)}
          placeholder="تكعيب الكسارة"
        />
        <input
          value={clientCubic}
          onChange={(e) => setClientCubic(e.target.value)}
          placeholder="تكعيب العميل"
        />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <button type="submit">فتح وردية</button>
      </form>

      <h3>5) قفل وردية</h3>
      <form onSubmit={handleCloseShift}>
        <input
          value={closeShiftId}
          onChange={(e) => setCloseShiftId(e.target.value)}
          placeholder="رقم الوردية (SH-xxxx)"
        />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <button type="submit">قفل الوردية</button>
      </form>
    </div>
  )
}
