import { ipcApi } from '@/lib/ipcErrors'
import { createLatestGuard } from '@/lib/latestGuard'
import { useCallback, useEffect, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { SubmitButton } from '@/components/SubmitButton'
import {
  LedgerEntryForm,
  ledgerEntrySchema,
  type LedgerEntryFormValues
} from '@/components/LedgerEntryForm'
import { Button } from '@/components/ui/button'
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
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { AccountCard, LedgerEntriesTable, type LedgerRow } from './AccountTables'

type Driver = { id: number; name: string }
type Contractor = { id: number; name: string }
type Shift = { id: string; status: string }
const emptyValue = '__none__'

export function DriverHistoryPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [selectedDriverId, setSelectedDriverId] = useState<number>()
  const [historyReloadVersion, setHistoryReloadVersion] = useState(0)
  const [history, setHistory] = useState<LedgerRow[]>([])
  const historyLoadGuard = useRef(createLatestGuard())
  const [shifts, setShifts] = useState<Shift[]>([])
  const [editingEntry, setEditingEntry] = useState<LedgerRow | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const ledgerForm = useForm<LedgerEntryFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: {
      entryDate: '',
      driverId: undefined,
      movementType: 'ADVANCE',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    } as LedgerEntryFormValues
  })

  const loadHistory = useCallback(async (driverId: number): Promise<void> => {
    const token = historyLoadGuard.current.next()
    const result = await ipcApi.getDriverHistory({ driverId })
    if (!historyLoadGuard.current.isLatest(token)) return
    if (result.ok) {
      setHistory(result.data)
    } else {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    void Promise.all([ipcApi.listDrivers(), ipcApi.listContractors(), ipcApi.listShifts()]).then(
      ([driversResult, contractorsResult, shiftsResult]) => {
        if (driversResult.ok) setDrivers(driversResult.data)
        if (contractorsResult.ok) setContractors(contractorsResult.data)
        if (shiftsResult.ok) setShifts(shiftsResult.data)
      }
    )
  }, [])

  useEffect(() => () => historyLoadGuard.current.cancel(), [])

  useEffect(() => {
    if (selectedDriverId === undefined) return
    historyLoadGuard.current.cancel()
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void loadHistory(selectedDriverId)
    })
    return () => {
      cancelled = true
    }
  }, [historyReloadVersion, loadHistory, selectedDriverId])

  async function handleChange(value: string): Promise<void> {
    if (value === emptyValue) {
      historyLoadGuard.current.cancel()
      setSelectedDriverId(undefined)
      setHistory([])
      return
    }
    const driverId = Number(value)
    historyLoadGuard.current.cancel()
    setSelectedDriverId(driverId)
  }

  function getDefaultLedgerValues(driverId?: number): LedgerEntryFormValues {
    return {
      entryDate: '',
      driverId,
      movementType: 'ADVANCE',
      amount: 0,
      shiftId: undefined,
      contractorId: undefined,
      notes: ''
    }
  }

  function openCreateEntryDialog(): void {
    setEditingEntry(null)
    ledgerForm.reset(getDefaultLedgerValues(selectedDriverId))
    setIsCreateDialogOpen(true)
  }

  function isEntryLocked(entry: LedgerRow): boolean {
    return Boolean(
      entry.shiftId &&
      shifts.some((shift) => shift.id === entry.shiftId && shift.status === 'CLOSED')
    )
  }

  function openEditEntryDialog(entry: LedgerRow): void {
    setEditingEntry(entry)
    ledgerForm.reset({
      entryDate: entry.entryDate,
      driverId: entry.driverId ?? undefined,
      movementType: entry.movementType as 'ADVANCE' | 'PAYMENT' | 'OTHER',
      amount: Number(entry.amount),
      shiftId: entry.shiftId ?? undefined,
      contractorId: entry.contractorId ?? undefined,
      notes: entry.notes ?? ''
    } as LedgerEntryFormValues)
    setIsEditDialogOpen(true)
  }

  async function handleSaveEntry(values: LedgerEntryFormValues): Promise<void> {
    const result = editingEntry
      ? await ipcApi.updateLedgerEntry({
          id: editingEntry.id,
          ...values,
          driverId: values.driverId ?? null,
          shiftId: values.shiftId ?? null,
          contractorId: values.contractorId ?? null,
          notes: values.notes?.trim() || null
        } satisfies Parameters<typeof ipcApi.updateLedgerEntry>[0])
      : await ipcApi.createLedgerEntry(
          values satisfies Parameters<typeof ipcApi.createLedgerEntry>[0]
        )
    if (result.ok) {
      setIsEditDialogOpen(false)
      setIsCreateDialogOpen(false)
      setEditingEntry(null)
      ledgerForm.reset(getDefaultLedgerValues())
      setHistoryReloadVersion((version) => version + 1)
    } else {
      result.errors.forEach((error) => {
        if (error.field in values) {
          ledgerForm.setError(error.field as keyof LedgerEntryFormValues, {
            message: error.message
          })
        }
      })
    }
  }

  async function handleDeleteEntry(entry: LedgerRow): Promise<void> {
    if (!confirm(t('allMovements.deleteConfirmation', { id: entry.id }))) return
    const result = await ipcApi.deleteLedgerEntry({ id: entry.id })
    if (result.ok) {
      setHistoryReloadVersion((version) => version + 1)
    }
  }

  return (
    <AccountCard title={t('driverHistory.title')}>
      <Select
        value={selectedDriverId ? String(selectedDriverId) : emptyValue}
        onValueChange={(value) => void handleChange(value)}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('driverHistory.selectDriver')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptyValue}>{t('driverHistory.selectDriver')}</SelectItem>
          {drivers.map((driver) => (
            <SelectItem key={driver.id} value={String(driver.id)}>
              {driver.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedDriverId ? (
        <>
          <div className="flex justify-end">
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={(open) => {
                setIsCreateDialogOpen(open)
                if (!open) {
                  setEditingEntry(null)
                  ledgerForm.reset(getDefaultLedgerValues())
                }
              }}
            >
              <DialogTrigger asChild>
                <Button type="button" onClick={openCreateEntryDialog}>
                  {t('allMovements.addMovement')}
                </Button>
              </DialogTrigger>
              <DialogContent
                className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
                closeDisabled={ledgerForm.formState.isSubmitting}
              >
                <DialogHeader>
                  <DialogTitle>{t('allMovements.addMovement')}</DialogTitle>
                </DialogHeader>
                <LedgerEntryForm
                  form={ledgerForm}
                  onSubmit={handleSaveEntry}
                  drivers={drivers}
                  contractors={contractors}
                  shifts={shifts}
                  lockedDriverId={selectedDriverId}
                  requireContractorId
                  submitLabel={t('contractorsSettings.addSubmit')}
                />
              </DialogContent>
            </Dialog>
          </div>
          <LedgerEntriesTable
            entries={history}
            onEditEntry={openEditEntryDialog}
            onDeleteEntry={handleDeleteEntry}
            getIsEntryLocked={isEntryLocked}
          />
          <Dialog
            open={isEditDialogOpen}
            onOpenChange={(open) => {
              setIsEditDialogOpen(open)
              if (!open) {
                setEditingEntry(null)
                ledgerForm.reset({
                  entryDate: '',
                  driverId: undefined,
                  movementType: 'ADVANCE',
                  amount: 0,
                  shiftId: undefined,
                  contractorId: undefined,
                  notes: ''
                } as LedgerEntryFormValues)
              }
            }}
          >
            <DialogContent
              className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
              closeDisabled={ledgerForm.formState.isSubmitting}
            >
              <DialogHeader>
                <DialogTitle>{t('allMovements.editTitle')}</DialogTitle>
              </DialogHeader>
              <Form {...ledgerForm}>
                <form
                  onSubmit={ledgerForm.handleSubmit(handleSaveEntry)}
                  className="grid gap-4 md:grid-cols-2"
                >
                  <FormField
                    control={ledgerForm.control}
                    name="entryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('ledgerEntryForm.fields.date')}</FormLabel>
                        <FormControl>
                          <DatePicker
                            value={field.value}
                            onChange={field.onChange}
                            placeholder={t('ledgerEntryForm.placeholders.date')}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ledgerForm.control}
                    name="movementType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('ledgerEntryForm.fields.movementType')}</FormLabel>
                        <Select value={field.value ?? ''} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t('ledgerEntryForm.placeholders.movementType')}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ADVANCE">
                              {t('ledgerEntryForm.movementTypes.custody')}
                            </SelectItem>
                            <SelectItem value="PAYMENT">
                              {t('ledgerEntryForm.movementTypes.payment')}
                            </SelectItem>
                            <SelectItem value="OTHER">
                              {t('ledgerEntryForm.movementTypes.other')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ledgerForm.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('common.columns.amount')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
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
                    control={ledgerForm.control}
                    name="driverId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('ledgerEntryForm.fields.driver')}</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : emptyValue}
                          onValueChange={(value) =>
                            field.onChange(value === emptyValue ? undefined : Number(value))
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('ledgerEntryForm.none.driver')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={emptyValue}>
                              {t('ledgerEntryForm.none.driver')}
                            </SelectItem>
                            {drivers.map((driver) => (
                              <SelectItem key={driver.id} value={String(driver.id)}>
                                {driver.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ledgerForm.control}
                    name="shiftId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('ledgerEntryForm.fields.shift')}</FormLabel>
                        <Select
                          value={field.value ?? emptyValue}
                          onValueChange={(value) =>
                            field.onChange(value === emptyValue ? undefined : value)
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('ledgerEntryForm.none.shift')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={emptyValue}>
                              {t('ledgerEntryForm.none.shift')}
                            </SelectItem>
                            {shifts.map((shift) => (
                              <SelectItem key={shift.id} value={shift.id}>
                                {shift.id}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={ledgerForm.control}
                    name="contractorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('ledgerEntryForm.fields.contractor')}</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : emptyValue}
                          onValueChange={(value) =>
                            field.onChange(value === emptyValue ? undefined : Number(value))
                          }
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue
                                placeholder={t('ledgerEntryForm.placeholders.contractor')}
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={emptyValue}>
                              {t('ledgerEntryForm.placeholders.contractor')}
                            </SelectItem>
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
                    control={ledgerForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>{t('common.columns.notes')}</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="md:col-span-2">
                    <SubmitButton isSubmitting={ledgerForm.formState.isSubmitting}>
                      {t('contractorsSettings.saveEdit')}
                    </SubmitButton>
                    <DialogClose asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={ledgerForm.formState.isSubmitting}
                      >
                        {t('common.cancel')}
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('driverHistory.selectDriverHint')}</p>
      )}
    </AccountCard>
  )
}
