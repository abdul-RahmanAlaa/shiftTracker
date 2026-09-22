import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { AddLog } from '@/App'

export function ShiftsPage(): React.JSX.Element {
  const { addLog } = useOutletContext<{ addLog: AddLog }>()
  const [shiftVehicleNo, setShiftVehicleNo] = useState('')
  const [shiftDriverId, setShiftDriverId] = useState('')
  const [crusherCubic, setCrusherCubic] = useState('')
  const [clientCubic, setClientCubic] = useState('')
  const [startDate, setStartDate] = useState('')
  const [closeShiftId, setCloseShiftId] = useState('')
  const [endDate, setEndDate] = useState('')

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
