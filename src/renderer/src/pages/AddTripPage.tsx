/* eslint-disable react-refresh/only-export-components */
import { ipcApi } from '@/lib/ipcErrors'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CreateShiftForm, createShiftSchema } from '@/components/CreateShiftForm'
import type { CreateShiftValues } from '@/components/CreateShiftForm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { TripEntryGrid } from '@/components/TripEntryGrid'
import { validateTripGridPayload } from './tripFormSchema'
import { useAddTripPage } from './useAddTripPage'

export { NumberField } from './NumberField'
export { TripForm } from './TripForm'
export { tripSchema } from './tripFormSchema'
export type { ResourceState, TripValues } from './tripFormSchema'

export function AddTripPage(): React.JSX.Element {
  const { t } = useTranslation()
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
  const {
    resources,
    selectedDriverId,
    openShift,
    shiftTripCount,
    checkingShift,
    resourceLoading,
    selectedDriverRef,
    loadDriverShift,
    selectDriver
  } = useAddTripPage((driverId) => createShiftForm.setValue('driverId', driverId))

  async function handleCreateShift(values: CreateShiftValues): Promise<boolean> {
    if (!values.driverId) return false
    const result = await ipcApi.createShift(values)
    if (!result.ok) {
      result.errors.forEach((error) => {
        if (error.field in values)
          createShiftForm.setError(error.field as keyof CreateShiftValues, {
            message: error.message
          })
      })
      return false
    }
    const currentDriverId = selectedDriverRef.current
    if (currentDriverId !== undefined) await loadDriverShift(currentDriverId)
    return true
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden" dir="rtl">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-56 flex-1 items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">{t('addTrip.title')}</h1>
            <p className="text-xs text-muted-foreground">{t('addTrip.subtitle')}</p>
          </div>
          <Select
            value={selectedDriverId ? String(selectedDriverId) : ''}
            onValueChange={(value) => void selectDriver(value)}
            disabled={resourceLoading}
          >
            <SelectTrigger className="w-48">
              <SelectValue
                placeholder={resourceLoading ? t('common.loading') : t('addTrip.selectDriver')}
              />
            </SelectTrigger>
            <SelectContent>
              {resources.drivers.map((driver) => (
                <SelectItem key={driver.id} value={String(driver.id)}>
                  {driver.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDriverId !== undefined && (
            <Button type="button" size="sm" variant="ghost" onClick={() => void selectDriver('')}>
              {t('tripGrid.clearDriver')}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {openShift && (
            <>
              <Badge variant="secondary">{openShift.id}</Badge>
              <Badge variant="outline">{openShift.vehicleNo}</Badge>
              <Badge variant="outline">{openShift.startDate}</Badge>
              <Badge variant="outline">
                {t('tripGrid.shiftTripCount', { count: shiftTripCount })}
              </Badge>
            </>
          )}
        </div>
      </header>

      {checkingShift && (
        <p className="shrink-0 text-sm text-muted-foreground">{t('common.loading')}</p>
      )}

      {selectedDriverId !== undefined && !checkingShift && !openShift && (
        <Card className="shrink-0">
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <p className="text-sm text-amber-400">{t('addTrip.noOpenShift')}</p>
            <CreateShiftForm
              form={createShiftForm}
              drivers={resources.drivers}
              vehicles={resources.vehicles}
              onSubmit={handleCreateShift}
            />
          </CardContent>
        </Card>
      )}

      {openShift && (
        <TripEntryGrid
          shift={openShift}
          resources={resources}
          validateTripPayload={validateTripGridPayload}
          onRefresh={() => {
            const currentDriverId = selectedDriverRef.current
            return currentDriverId === undefined
              ? Promise.resolve()
              : loadDriverShift(currentDriverId)
          }}
        />
      )}
    </div>
  )
}
