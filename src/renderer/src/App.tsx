import { useState } from 'react'

function App(): React.JSX.Element {
  const [contractorName, setContractorName] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [trailerNo, setTrailerNo] = useState('')
  const [vehicleContractorId, setVehicleContractorId] = useState('')
  const [driverName, setDriverName] = useState('')
  const [shiftVehicleNo, setShiftVehicleNo] = useState('')
  const [shiftDriverId, setShiftDriverId] = useState('')
  const [crusherCubic, setCrusherCubic] = useState('')
  const [clientCubic, setClientCubic] = useState('')
  const [startDate, setStartDate] = useState('')
  const [closeShiftId, setCloseShiftId] = useState('')
  const [endDate, setEndDate] = useState('')

  const [log, setLog] = useState<string[]>([])

  function addLog(msg: string): void {
    setLog((prev) => [msg, ...prev])
  }

  async function handleCreateContractor(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.createContractor({ name: contractorName })
    addLog(
      result.ok
        ? `✅ مقاول: ${result.data?.name} (id: ${result.data?.id})`
        : `❌ مقاول: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) setContractorName('')
  }

  async function handleCreateVehicle(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.createVehicle({
      vehicleNo: Number(vehicleNo),
      trailerNo: trailerNo ? Number(trailerNo) : undefined,
      contractorId: Number(vehicleContractorId)
    })
    addLog(
      result.ok
        ? `✅ عربية: ${result.data?.vehicleNo}`
        : `❌ عربية: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) {
      setVehicleNo('')
      setTrailerNo('')
      setVehicleContractorId('')
    }
  }

  async function handleCreateDriver(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const result = await window.api.createDriver({ name: driverName })
    addLog(
      result.ok
        ? `✅ سائق: ${result.data?.name} (id: ${result.data?.id})`
        : `❌ سائق: ${result.errors?.map((x) => x.message).join(', ')}`
    )
    if (result.ok) setDriverName('')
  }

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
    <div style={{ padding: 24, display: 'flex', gap: 24 }}>
      <div style={{ flex: 1 }}>
        <h3>1) مقاول نقل</h3>
        <form onSubmit={handleCreateContractor}>
          <input
            value={contractorName}
            onChange={(e) => setContractorName(e.target.value)}
            placeholder="اسم المقاول"
          />
          <button type="submit">إضافة</button>
        </form>

        <h3>2) عربية</h3>
        <form onSubmit={handleCreateVehicle}>
          <input
            value={vehicleNo}
            onChange={(e) => setVehicleNo(e.target.value)}
            placeholder="رقم السيارة"
          />
          <input
            value={trailerNo}
            onChange={(e) => setTrailerNo(e.target.value)}
            placeholder="رقم المقطورة (اختياري)"
          />
          <input
            value={vehicleContractorId}
            onChange={(e) => setVehicleContractorId(e.target.value)}
            placeholder="id المقاول"
          />
          <button type="submit">إضافة</button>
        </form>

        <h3>3) سائق</h3>
        <form onSubmit={handleCreateDriver}>
          <input
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="اسم السائق"
          />
          <button type="submit">إضافة</button>
        </form>

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

      <div style={{ flex: 1 }}>
        <h3>Log</h3>
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  )
}

export default App
