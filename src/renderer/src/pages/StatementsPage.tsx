import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type EntityType = 'client' | 'contractor'
type ClientOption = Extract<
  Awaited<ReturnType<typeof window.api.listClients>>,
  { ok: true }
>['data'][number]
type ContractorOption = Extract<
  Awaited<ReturnType<typeof window.api.listContractors>>,
  { ok: true }
>['data'][number]
type Statement = Extract<
  Awaited<ReturnType<typeof window.api.getClientStatement>>,
  { ok: true }
>['data']
type StatementRow = Statement['rows'][number]

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function formatNumber(value: number | null | undefined, emptyCell: string): string {
  return value === null || value === undefined ? emptyCell : numberFormatter.format(value)
}

export function StatementsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [entityType, setEntityType] = useState<EntityType>('client')
  const [clients, setClients] = useState<ClientOption[]>([])
  const [contractors, setContractors] = useState<ContractorOption[]>([])
  const [entitiesLoading, setEntitiesLoading] = useState(true)
  const [entitiesError, setEntitiesError] = useState(false)
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null)
  const [entityPickerOpen, setEntityPickerOpen] = useState(false)
  const [requestVersion, setRequestVersion] = useState(0)
  const [statement, setStatement] = useState<Statement | null>(null)
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementError, setStatementError] = useState(false)

  const entities = entityType === 'client' ? clients : contractors
  const selectedEntity = entities.find((entity) => entity.id === selectedEntityId)

  useEffect(() => {
    let cancelled = false
    void Promise.all([window.api.listClients(), window.api.listContractors()])
      .then(([clientsResult, contractorsResult]) => {
        if (cancelled) return
        if (clientsResult.ok) setClients(clientsResult.data)
        if (contractorsResult.ok) setContractors(contractorsResult.data)
        setEntitiesError(!clientsResult.ok || !contractorsResult.ok)
        setEntitiesLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setEntitiesError(true)
        setEntitiesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (selectedEntityId === null) return

    let cancelled = false

    const request =
      entityType === 'client'
        ? window.api.getClientStatement({ clientId: selectedEntityId })
        : window.api.getContractorStatement({ contractorId: selectedEntityId })

    void request
      .then((result) => {
        if (cancelled) return
        if (result.ok) setStatement(result.data)
        else setStatementError(true)
        setStatementLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setStatementError(true)
        setStatementLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [entityType, requestVersion, selectedEntityId])

  function handleEntityTypeChange(value: EntityType): void {
    setEntityType(value)
    setSelectedEntityId(null)
    setStatement(null)
    setStatementLoading(false)
    setStatementError(false)
  }

  const columns: ColumnDef<StatementRow, unknown>[] = [
    { accessorKey: 'date', header: t('statementsPage.columns.date') },
    {
      accessorKey: 'description',
      header: t('statementsPage.columns.description'),
      cell: ({ row }) => {
        if (row.original.kind === 'OPENING') {
          return t('statementsPage.openingBalanceDescription')
        }

        if (entityType === 'contractor' && row.original.kind === 'PAYMENT') {
          switch (row.original.description) {
            case 'ADVANCE':
              return t('ledgerEntryForm.movementTypes.custody')
            case 'PAYMENT':
              return t('ledgerEntryForm.movementTypes.payment')
            case 'OTHER':
              return t('ledgerEntryForm.movementTypes.other')
          }
        }

        return row.original.description ?? t('common.emptyCell')
      }
    },
    {
      accessorKey: 'quantity',
      header: t('statementsPage.columns.quantity'),
      cell: ({ row }) => formatNumber(row.original.quantity, t('common.emptyCell'))
    },
    {
      accessorKey: 'price',
      header: t('statementsPage.columns.price'),
      cell: ({ row }) => formatNumber(row.original.price, t('common.emptyCell'))
    },
    {
      accessorKey: 'value',
      header: t('statementsPage.columns.value'),
      cell: ({ row }) => formatNumber(row.original.value, t('common.emptyCell'))
    },
    {
      accessorKey: 'payment',
      header: t('statementsPage.columns.payment'),
      cell: ({ row }) => formatNumber(row.original.payment, t('common.emptyCell'))
    },
    {
      accessorKey: 'runningBalance',
      header: t('statementsPage.columns.runningBalance'),
      cell: ({ row }) => (
        <span className={cn('font-medium', row.original.runningBalance < 0 && 'text-destructive')}>
          {formatNumber(row.original.runningBalance, t('common.emptyCell'))}
        </span>
      )
    },
    {
      accessorKey: 'notes',
      header: t('statementsPage.columns.notes'),
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    }
  ]

  const rows = statement?.rows ?? []
  const totalQuantity = rows.reduce((total, row) => total + (row.quantity ?? 0), 0)
  const totalValue = rows.reduce(
    (total, row) => total + (row.kind === 'CHARGE' ? (row.value ?? 0) : 0),
    0
  )
  const totalPayments = rows.reduce((total, row) => total + (row.payment ?? 0), 0)

  return (
    <div className="flex h-full min-h-0 flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('statementsPage.title')}</h1>

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="statement-entity-type">
              {t('statementsPage.entityType')}
            </label>
            <Select
              value={entityType}
              onValueChange={(value) => handleEntityTypeChange(value as EntityType)}
            >
              <SelectTrigger id="statement-entity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">{t('statementsPage.client')}</SelectItem>
                <SelectItem value="contractor">{t('statementsPage.contractor')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-medium">{t('statementsPage.entity')}</span>
            <Popover open={entityPickerOpen} onOpenChange={setEntityPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={entityPickerOpen}
                  aria-label={t('statementsPage.entity')}
                  className="w-full justify-between font-normal"
                  disabled={entitiesLoading || entitiesError}
                >
                  <span className="truncate">
                    {selectedEntity?.name ?? t('statementsPage.selectEntity')}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('statementsPage.searchEntity')} />
                  <CommandList>
                    <CommandEmpty>{t('statementsPage.noMatchingEntities')}</CommandEmpty>
                    {entities.map((entity) => (
                      <CommandItem
                        key={entity.id}
                        value={`${entity.name} ${entity.id}`}
                        onSelect={() => {
                          setSelectedEntityId(entity.id)
                          setStatement(null)
                          setStatementLoading(true)
                          setStatementError(false)
                          setRequestVersion((version) => version + 1)
                          setEntityPickerOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            'ml-2 h-4 w-4',
                            selectedEntityId === entity.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        {entity.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {entitiesLoading && (
            <p className="text-sm text-muted-foreground md:col-span-2">
              {t('statementsPage.loadingEntities')}
            </p>
          )}
          {entitiesError && (
            <p className="text-sm text-destructive md:col-span-2">
              {t('statementsPage.entitiesError')}
            </p>
          )}
        </CardContent>
      </Card>

      {selectedEntityId === null ? (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          {t('statementsPage.selectPrompt')}
        </div>
      ) : statementError ? (
        <p role="alert" className="text-sm text-destructive">
          {t('statementsPage.statementError')}
        </p>
      ) : (
        <Card className="min-h-0">
          <CardContent className="grid gap-4 pt-6">
            {statementLoading && (
              <p role="status" className="text-sm text-muted-foreground">
                {t('statementsPage.loadingStatement')}
              </p>
            )}
            {statement && (
              <>
                <h2 className="text-lg font-semibold">{statement.entityName}</h2>
                {!statementLoading &&
                  statement.rows.length > 0 &&
                  statement.rows.every((row) => row.kind === 'OPENING') && (
                    <p className="text-sm text-muted-foreground">
                      {t('statementsPage.noMovements')}
                    </p>
                  )}
              </>
            )}
            <DataTable
              columns={columns}
              data={rows}
              loading={statementLoading}
              emptyMessage={t('statementsPage.noRows')}
            />
            {statement && !statementLoading && (
              <dl className="grid gap-3 rounded-md border p-4 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t('statementsPage.totals.quantity')}
                  </dt>
                  <dd className="font-semibold">
                    {formatNumber(totalQuantity, t('common.emptyCell'))}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t('statementsPage.totals.value')}
                  </dt>
                  <dd className="font-semibold">
                    {formatNumber(totalValue, t('common.emptyCell'))}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t('statementsPage.totals.payments')}
                  </dt>
                  <dd className="font-semibold">
                    {formatNumber(totalPayments, t('common.emptyCell'))}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t('statementsPage.totals.finalBalance')}
                  </dt>
                  <dd
                    className={cn(
                      'font-semibold',
                      statement.finalBalance < 0 && 'text-destructive'
                    )}
                  >
                    {formatNumber(statement.finalBalance, t('common.emptyCell'))}
                  </dd>
                </div>
              </dl>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
