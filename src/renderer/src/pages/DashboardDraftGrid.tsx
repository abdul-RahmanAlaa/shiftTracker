import { Fragment, useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { DraftTripListRow } from '../../../preload/index.d'
import { useConfirm } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ipcApi } from '@/lib/ipcErrors'

type CreateDraftTripInput = Parameters<typeof ipcApi.createDraftTrip>[0]
type UpdateDraftTripInput = Parameters<typeof ipcApi.updateDraftTrip>[0]

type DraftGridValues = {
  vehicleNo: string
  tripDate: string
  timeOfDay: '' | 'MORNING' | 'EVENING'
  crusherId: string
  clientId: string
  cubic: string
  custodyAmount: string
  receiptNote: string
}

type DraftGridField = keyof DraftGridValues
type RowStatus = { state: 'idle' | 'saving' | 'saved' | 'error'; message?: string }
type EntityOption = { id: number; name: string }

const fields: DraftGridField[] = [
  'vehicleNo',
  'tripDate',
  'timeOfDay',
  'crusherId',
  'clientId',
  'cubic',
  'custodyAmount',
  'receiptNote'
]

function columnLabel(field: DraftGridField, t: (key: string) => string): string {
  switch (field) {
    case 'vehicleNo':
      return t('dashboard.columns.vehicleNo')
    case 'tripDate':
      return t('dashboard.columns.tripDate')
    case 'timeOfDay':
      return t('dashboard.columns.timeOfDay')
    case 'crusherId':
      return t('dashboard.columns.crusherId')
    case 'clientId':
      return t('dashboard.columns.clientId')
    case 'cubic':
      return t('dashboard.columns.cubic')
    case 'custodyAmount':
      return t('dashboard.columns.custodyAmount')
    case 'receiptNote':
      return t('dashboard.columns.receiptNote')
  }
}

function today(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function blankValues(): DraftGridValues {
  return {
    vehicleNo: '',
    tripDate: today(),
    timeOfDay: '',
    crusherId: '',
    clientId: '',
    cubic: '',
    custodyAmount: '',
    receiptNote: ''
  }
}

function valuesFromDraft(draft: DraftTripListRow): DraftGridValues {
  return {
    vehicleNo: String(draft.vehicle_no),
    tripDate: draft.trip_date,
    timeOfDay: draft.time_of_day ?? '',
    crusherId: draft.crusher_id === null ? '' : String(draft.crusher_id),
    clientId: draft.client_id === null ? '' : String(draft.client_id),
    cubic: draft.cubic === null ? '' : String(draft.cubic),
    custodyAmount: draft.custody_amount === null ? '' : String(draft.custody_amount),
    receiptNote: draft.receipt_note ?? ''
  }
}

function nullableNumber(value: string): number | null {
  if (value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : Number.NaN
}

function createInput(values: DraftGridValues): CreateDraftTripInput {
  const cubic = nullableNumber(values.cubic)
  const custodyAmount = nullableNumber(values.custodyAmount)
  return {
    vehicleNo: Number(values.vehicleNo),
    tripDate: values.tripDate,
    ...(values.timeOfDay ? { timeOfDay: values.timeOfDay } : {}),
    ...(values.crusherId ? { crusherId: Number(values.crusherId) } : {}),
    ...(values.clientId ? { clientId: Number(values.clientId) } : {}),
    ...(cubic === null ? {} : { cubic }),
    ...(custodyAmount === null ? {} : { custodyAmount }),
    receiptNote: values.receiptNote
  }
}

export function DashboardDraftGrid({
  drafts,
  vehicles,
  crushers,
  clients,
  loading,
  onRefresh,
  onDetails,
  onPromote
}: {
  drafts: DraftTripListRow[]
  vehicles: { vehicle_no: number; driver_name: string | null }[]
  crushers: EntityOption[]
  clients: EntityOption[]
  loading: boolean
  onRefresh: () => void
  onDetails: (draft: DraftTripListRow) => void
  onPromote: (draft: DraftTripListRow) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const requestConfirmation = useConfirm()
  const [valuesById, setValuesById] = useState<Record<number, DraftGridValues>>({})
  const valuesByIdRef = useRef(valuesById)
  useEffect(() => {
    valuesByIdRef.current = valuesById
  }, [valuesById])
  const [newValues, setNewValues] = useState<DraftGridValues>(blankValues)
  const [statuses, setStatuses] = useState<Record<number, RowStatus>>({})
  const [newStatus, setNewStatus] = useState<RowStatus>({ state: 'idle' })
  const revisions = useRef(new Map<number, number>())
  const savedRevisions = useRef(new Map<number, number>())
  const savingIds = useRef(new Set<number>())
  const cellRefs = useRef(new Map<string, HTMLElement>())
  const newVehicleRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setValuesById((current) => {
      const next = { ...current }
      const ids = new Set(drafts.map((draft) => draft.id))
      for (const id of Object.keys(next)) {
        if (!ids.has(Number(id))) {
          delete next[Number(id)]
          revisions.current.delete(Number(id))
          savedRevisions.current.delete(Number(id))
        }
      }
      for (const draft of drafts) next[draft.id] ??= valuesFromDraft(draft)
      return next
    })
  }, [drafts])

  function setCellRef(rowId: string, field: DraftGridField, element: HTMLElement | null): void {
    const key = `${rowId}:${field}`
    if (element) cellRefs.current.set(key, element)
    else cellRefs.current.delete(key)
  }

  function focusCell(rowId: string, field: DraftGridField): void {
    cellRefs.current.get(`${rowId}:${field}`)?.focus()
  }

  function updateExisting(id: number, field: DraftGridField, value: string): void {
    setValuesById((current) => {
      const draft = drafts.find((item) => item.id === id)
      if (!draft) return current
      const values = current[id] ?? valuesFromDraft(draft)
      return { ...current, [id]: { ...values, [field]: value } }
    })
    revisions.current.set(id, (revisions.current.get(id) ?? 0) + 1)
    setStatuses((current) => ({ ...current, [id]: { state: 'idle' } }))
  }

  function updateNew(field: DraftGridField, value: string): void {
    setNewValues((current) => ({ ...current, [field]: value }))
    setNewStatus({ state: 'idle' })
  }

  function onCellBlur(rowId: string, isNew: boolean, event: FocusEvent<HTMLElement>): void {
    const row = event.currentTarget.closest('tr')
    if (row && event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return
    if (isNew) void saveNewDraft()
    else void saveExistingDraft(Number(rowId))
  }

  function onCellKeyDown(
    event: KeyboardEvent<HTMLElement>,
    rowId: string,
    isNew: boolean,
    field: DraftGridField
  ): void {
    if (event.key !== 'Enter' && event.key !== 'Tab') return
    if (event.key === 'Enter' && event.target instanceof HTMLSelectElement) return
    event.preventDefault()
    const rowFields = [...fields]
    const fieldIndex = rowFields.indexOf(field)
    const direction = event.key === 'Tab' && event.shiftKey ? -1 : 1
    const nextIndex = fieldIndex + direction
    if (nextIndex >= 0 && nextIndex < rowFields.length) {
      focusCell(rowId, rowFields[nextIndex])
      return
    }

    if (isNew) {
      void saveNewDraft()
      return
    }
    const rowIndex = drafts.findIndex((draft) => draft.id === Number(rowId))
    const nextDraft = drafts[rowIndex + direction]
    if (nextDraft) {
      focusCell(String(nextDraft.id), direction > 0 ? fields[0] : fields[fields.length - 1])
      return
    }
    if (direction > 0) focusCell('new', fields[0])
  }

  function onCellEscape(
    event: KeyboardEvent<HTMLElement>,
    rowId: string,
    isNew: boolean,
    field: DraftGridField
  ): void {
    if (event.key !== 'Escape') return
    event.preventDefault()
    if (isNew) {
      setNewValues((current) => ({ ...current, [field]: blankValues()[field] }))
      return
    }
    const draft = drafts.find((item) => item.id === Number(rowId))
    if (!draft) return
    setValuesById((current) => ({
      ...current,
      [draft.id]: {
        ...(current[draft.id] ?? valuesFromDraft(draft)),
        [field]: valuesFromDraft(draft)[field]
      }
    }))
  }

  async function saveNewDraft(): Promise<void> {
    if (!newValues.vehicleNo || !newValues.tripDate || newStatus.state === 'saving') return
    setNewStatus({ state: 'saving' })
    const result = await ipcApi.createDraftTrip(createInput(newValues))
    if (!result.ok) {
      setNewStatus({
        state: 'error',
        message: result.errors.map((error) => error.message).join(', ')
      })
      return
    }
    setNewValues(blankValues())
    setNewStatus({ state: 'saved' })
    onRefresh()
    requestAnimationFrame(() => newVehicleRef.current?.focus())
  }

  async function saveExistingDraft(id: number): Promise<void> {
    if (savingIds.current.has(id)) return
    const revision = revisions.current.get(id) ?? 0
    if (revision <= (savedRevisions.current.get(id) ?? 0)) return
    const draft = drafts.find((item) => item.id === id)
    const values = valuesByIdRef.current[id]
    if (!draft || !values) return

    savingIds.current.add(id)
    setStatuses((current) => ({ ...current, [id]: { state: 'saving' } }))
    const input: UpdateDraftTripInput = {
      id,
      tripDate: values.tripDate,
      timeOfDay: values.timeOfDay || null,
      crusherId: nullableNumber(values.crusherId),
      clientId: nullableNumber(values.clientId),
      cubic: nullableNumber(values.cubic),
      custodyAmount: nullableNumber(values.custodyAmount),
      custodyDate: draft.custody_date,
      custodyTime: draft.custody_time,
      receiptNote: values.receiptNote || null,
      notes: draft.notes
    }
    const result = await ipcApi.updateDraftTrip(input)
    savingIds.current.delete(id)
    if (!result.ok) {
      setStatuses((current) => ({
        ...current,
        [id]: { state: 'error', message: result.errors.map((error) => error.message).join(', ') }
      }))
    } else {
      savedRevisions.current.set(id, revision)
      setStatuses((current) => ({ ...current, [id]: { state: 'saved' } }))
      onRefresh()
    }
    if ((revisions.current.get(id) ?? 0) > revision) void saveExistingDraft(id)
  }

  async function deleteDraft(id: number): Promise<void> {
    if (!(await requestConfirmation({ message: t('dashboard.confirmDeleteDraft') }))) return
    const result = await ipcApi.deleteDraftTrip({ id })
    if (result.ok) onRefresh()
    else {
      setStatuses((current) => ({
        ...current,
        [id]: { state: 'error', message: result.errors.map((error) => error.message).join(', ') }
      }))
    }
  }

  function rowStatus(status: RowStatus): string {
    if (status.state === 'saving') return t('dashboard.rowSaving')
    if (status.state === 'saved') return t('dashboard.rowSaved')
    if (status.state === 'error') return t('dashboard.rowError')
    return t('dashboard.rowReady')
  }

  function renderExistingRow(draft: DraftTripListRow): React.JSX.Element {
    const id = String(draft.id)
    const values = valuesById[draft.id] ?? valuesFromDraft(draft)
    const status = statuses[draft.id] ?? { state: 'idle' as const }
    return (
      <Fragment key={draft.id}>
        <tr>
          <td className="p-1">
            <Input
              value={`${draft.vehicle_no} · ${draft.driver_name ?? t('common.emDash')}`}
              readOnly
              className="h-8 min-w-0 px-1 text-xs"
              aria-label={t('dashboard.vehicle')}
              data-grid-cell="true"
              ref={(element) => setCellRef(id, 'vehicleNo', element)}
              onBlur={(event) => onCellBlur(id, false, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, false, 'vehicleNo')
                onCellKeyDown(event, id, false, 'vehicleNo')
              }}
            />
          </td>
          <td className="p-1">
            <GridInput
              rowId={id}
              field="tripDate"
              label={t('dashboard.date')}
              value={values.tripDate}
              type="date"
              setRef={setCellRef}
              onChange={(value) => updateExisting(draft.id, 'tripDate', value)}
              onBlur={(event) => onCellBlur(id, false, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, false, 'tripDate')
                onCellKeyDown(event, id, false, 'tripDate')
              }}
            />
          </td>
          <td className="p-1">
            <TimeToggle
              rowId={id}
              value={values.timeOfDay}
              setRef={setCellRef}
              onChange={(value) => updateExisting(draft.id, 'timeOfDay', value)}
              onBlur={(event) => onCellBlur(id, false, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, false, 'timeOfDay')
                onCellKeyDown(event, id, false, 'timeOfDay')
              }}
            />
          </td>
          <td className="p-1">
            <EntityCombobox
              rowId={id}
              field="crusherId"
              label={t('dashboard.crusher')}
              value={values.crusherId}
              options={crushers}
              onChange={(value) => updateExisting(draft.id, 'crusherId', value)}
              setRef={setCellRef}
              onBlur={(event) => onCellBlur(id, false, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, false, 'crusherId')
                onCellKeyDown(event, id, false, 'crusherId')
              }}
            />
          </td>
          <td className="p-1">
            <EntityCombobox
              rowId={id}
              field="clientId"
              label={t('dashboard.client')}
              value={values.clientId}
              options={clients}
              onChange={(value) => updateExisting(draft.id, 'clientId', value)}
              setRef={setCellRef}
              onBlur={(event) => onCellBlur(id, false, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, false, 'clientId')
                onCellKeyDown(event, id, false, 'clientId')
              }}
            />
          </td>
          <td className="p-1">
            <GridInput
              rowId={id}
              field="cubic"
              label={t('dashboard.cubic')}
              value={values.cubic}
              type="number"
              setRef={setCellRef}
              onChange={(value) => updateExisting(draft.id, 'cubic', value)}
              onBlur={(event) => onCellBlur(id, false, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, false, 'cubic')
                onCellKeyDown(event, id, false, 'cubic')
              }}
            />
          </td>
          <td className="p-1">
            <GridInput
              rowId={id}
              field="custodyAmount"
              label={t('dashboard.custody')}
              value={values.custodyAmount}
              type="number"
              setRef={setCellRef}
              onChange={(value) => updateExisting(draft.id, 'custodyAmount', value)}
              onBlur={(event) => onCellBlur(id, false, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, false, 'custodyAmount')
                onCellKeyDown(event, id, false, 'custodyAmount')
              }}
            />
          </td>
          <td className="p-1">
            <GridInput
              rowId={id}
              field="receiptNote"
              label={t('dashboard.receipt')}
              value={values.receiptNote}
              type="text"
              setRef={setCellRef}
              onChange={(value) => updateExisting(draft.id, 'receiptNote', value)}
              onBlur={(event) => onCellBlur(id, false, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, false, 'receiptNote')
                onCellKeyDown(event, id, false, 'receiptNote')
              }}
            />
          </td>
          <td className="p-1">
            <div className="flex flex-wrap gap-1">
              <Button type="button" size="sm" variant="outline" onClick={() => onDetails(draft)}>
                {t('dashboard.details')}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onPromote(draft)}>
                {t('dashboard.promote')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void deleteDraft(draft.id)}
              >
                {t('dashboard.deleteDraft')}
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">{rowStatus(status)}</span>
          </td>
        </tr>
        {status.message && (
          <tr>
            <td colSpan={9} className="px-2 pb-2 text-xs text-destructive">
              {status.message}
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  function renderNewRow(): React.JSX.Element {
    const id = 'new'
    return (
      <Fragment>
        <tr>
          <td className="p-1">
            <Select
              value={newValues.vehicleNo}
              onValueChange={(value) => updateNew('vehicleNo', value)}
            >
              <SelectTrigger
                ref={(element) => {
                  newVehicleRef.current = element
                  setCellRef(id, 'vehicleNo', element)
                }}
                data-grid-cell="true"
                aria-label={t('dashboard.vehicle')}
                className="h-8 min-w-0 px-1 text-xs"
                onBlur={(event) => onCellBlur(id, true, event)}
                onKeyDown={(event) => {
                  onCellEscape(event, id, true, 'vehicleNo')
                  onCellKeyDown(event, id, true, 'vehicleNo')
                }}
              >
                <SelectValue placeholder={t('dashboard.vehicle')} />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.vehicle_no} value={String(vehicle.vehicle_no)}>
                    {vehicle.vehicle_no} · {vehicle.driver_name ?? t('common.emDash')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </td>
          <td className="p-1">
            <GridInput
              rowId={id}
              field="tripDate"
              label={t('dashboard.date')}
              value={newValues.tripDate}
              type="date"
              setRef={setCellRef}
              onChange={(value) => updateNew('tripDate', value)}
              onBlur={(event) => onCellBlur(id, true, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, true, 'tripDate')
                onCellKeyDown(event, id, true, 'tripDate')
              }}
            />
          </td>
          <td className="p-1">
            <TimeToggle
              rowId={id}
              value={newValues.timeOfDay}
              setRef={setCellRef}
              onChange={(value) => updateNew('timeOfDay', value)}
              onBlur={(event) => onCellBlur(id, true, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, true, 'timeOfDay')
                onCellKeyDown(event, id, true, 'timeOfDay')
              }}
            />
          </td>
          <td className="p-1">
            <EntityCombobox
              rowId={id}
              field="crusherId"
              label={t('dashboard.crusher')}
              value={newValues.crusherId}
              options={crushers}
              onChange={(value) => updateNew('crusherId', value)}
              setRef={setCellRef}
              onBlur={(event) => onCellBlur(id, true, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, true, 'crusherId')
                onCellKeyDown(event, id, true, 'crusherId')
              }}
            />
          </td>
          <td className="p-1">
            <EntityCombobox
              rowId={id}
              field="clientId"
              label={t('dashboard.client')}
              value={newValues.clientId}
              options={clients}
              onChange={(value) => updateNew('clientId', value)}
              setRef={setCellRef}
              onBlur={(event) => onCellBlur(id, true, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, true, 'clientId')
                onCellKeyDown(event, id, true, 'clientId')
              }}
            />
          </td>
          <td className="p-1">
            <GridInput
              rowId={id}
              field="cubic"
              label={t('dashboard.cubic')}
              value={newValues.cubic}
              type="number"
              setRef={setCellRef}
              onChange={(value) => updateNew('cubic', value)}
              onBlur={(event) => onCellBlur(id, true, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, true, 'cubic')
                onCellKeyDown(event, id, true, 'cubic')
              }}
            />
          </td>
          <td className="p-1">
            <GridInput
              rowId={id}
              field="custodyAmount"
              label={t('dashboard.custody')}
              value={newValues.custodyAmount}
              type="number"
              setRef={setCellRef}
              onChange={(value) => updateNew('custodyAmount', value)}
              onBlur={(event) => onCellBlur(id, true, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, true, 'custodyAmount')
                onCellKeyDown(event, id, true, 'custodyAmount')
              }}
            />
          </td>
          <td className="p-1">
            <GridInput
              rowId={id}
              field="receiptNote"
              label={t('dashboard.receipt')}
              value={newValues.receiptNote}
              type="text"
              setRef={setCellRef}
              onChange={(value) => updateNew('receiptNote', value)}
              onBlur={(event) => onCellBlur(id, true, event)}
              onKeyDown={(event) => {
                onCellEscape(event, id, true, 'receiptNote')
                onCellKeyDown(event, id, true, 'receiptNote')
              }}
            />
          </td>
          <td className="p-1">
            <span className="text-xs text-muted-foreground">{rowStatus(newStatus)}</span>
          </td>
        </tr>
        {newStatus.message && (
          <tr>
            <td colSpan={9} className="px-2 pb-2 text-xs text-destructive">
              {newStatus.message}
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

  return (
    <div className="w-full min-w-0 overflow-x-hidden rounded-md border">
      <table className="w-full table-fixed border-collapse text-xs">
        <colgroup>
          <col className="w-[12%]" />
          <col className="w-[11%]" />
          <col className="w-[8%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[8%]" />
          <col className="w-[9%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead>
          <tr className="bg-muted/50 text-right">
            {fields.map((field) => (
              <th key={field} className="truncate px-1 py-2 font-medium">
                {columnLabel(field, t)}
              </th>
            ))}
            <th className="px-1 py-2 font-medium">{t('common.columns.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map(renderExistingRow)}
          {renderNewRow()}
        </tbody>
      </table>
      {loading && (
        <p className="p-2 text-center text-xs text-muted-foreground">{t('common.loading')}</p>
      )}
    </div>
  )
}

function GridInput({
  rowId,
  field,
  label,
  value,
  type,
  setRef,
  onChange,
  onBlur,
  onKeyDown
}: {
  rowId: string
  field: DraftGridField
  label: string
  value: string
  type: 'date' | 'number' | 'text'
  setRef: (rowId: string, field: DraftGridField, element: HTMLElement | null) => void
  onChange: (value: string) => void
  onBlur: (event: FocusEvent<HTMLElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}): React.JSX.Element {
  return (
    <Input
      ref={(element) => setRef(rowId, field, element)}
      value={value}
      type={type}
      min={type === 'number' ? '0' : undefined}
      step={field === 'custodyAmount' ? '1' : 'any'}
      aria-label={label}
      data-grid-cell="true"
      className="h-8 min-w-0 px-1 text-xs"
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  )
}

function TimeToggle({
  rowId,
  value,
  setRef,
  onChange,
  onBlur,
  onKeyDown
}: {
  rowId: string
  value: DraftGridValues['timeOfDay']
  setRef: (rowId: string, field: DraftGridField, element: HTMLElement | null) => void
  onChange: (value: string) => void
  onBlur: (event: FocusEvent<HTMLElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  return (
    <Button
      ref={(element) => setRef(rowId, 'timeOfDay', element)}
      type="button"
      variant="outline"
      data-grid-cell="true"
      aria-label={t('dashboard.timeOfDay')}
      className="h-8 w-full min-w-0 truncate px-1 text-xs"
      onClick={() => onChange(value === 'MORNING' ? 'EVENING' : 'MORNING')}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      {value
        ? t(value === 'MORNING' ? 'dashboard.morning' : 'dashboard.evening')
        : t('common.emDash')}
    </Button>
  )
}

function EntityCombobox({
  rowId,
  field,
  label,
  value,
  options,
  onChange,
  setRef,
  onBlur,
  onKeyDown
}: {
  rowId: string
  field: 'crusherId' | 'clientId'
  label: string
  value: string
  options: EntityOption[]
  onChange: (value: string) => void
  setRef: (rowId: string, field: DraftGridField, element: HTMLElement | null) => void
  onBlur: (event: FocusEvent<HTMLElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const selected = options.find((option) => String(option.id) === value)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={(element) => setRef(rowId, field, element)}
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          data-grid-cell="true"
          className="h-8 w-full min-w-0 justify-start overflow-hidden px-1 text-xs"
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !open) {
              event.preventDefault()
              setOpen(true)
              return
            }
            onKeyDown(event)
          }}
        >
          <span className="truncate">{selected?.name ?? t('common.emDash')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(14rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput autoFocus placeholder={t('dashboard.searchEntities')} />
          <CommandList>
            <CommandEmpty>{t('dashboard.noMatchingEntities')}</CommandEmpty>
            <CommandItem
              value="__none__"
              onSelect={() => {
                onChange('')
                setOpen(false)
              }}
            >
              {t('common.emDash')}
            </CommandItem>
            {options.map((option) => (
              <CommandItem
                key={option.id}
                value={option.name}
                onSelect={() => {
                  onChange(String(option.id))
                  setOpen(false)
                }}
              >
                {option.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
