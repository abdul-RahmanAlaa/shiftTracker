import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/SubmitButton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/DataTable'
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

const clientSchema = z.object({
  name: z.string().min(1, i18n.t('clientsSettings.validation.nameRequired')),
  location: z.string().optional(),
  initialPrice: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined))
    .refine((val) => val === undefined || val >= 0, i18n.t('common.validation.positivePrice')),
  openingBalance: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined)),
  openingBalanceDate: z.string().optional()
})

type ClientFormValues = z.infer<typeof clientSchema>
type ClientFormInput = z.input<typeof clientSchema>
type Client = {
  id: number
  name: string
  initialPrice: number | null
  location: string | null
  openingBalance: number
  openingBalanceDate: string | null
}

export function ClientsSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [editingClientId, setEditingClientId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const clientForm = useForm<ClientFormInput>({
    resolver: zodResolver(clientSchema, undefined, { raw: true }) as Resolver<ClientFormInput>,
    defaultValues: {
      name: '',
      location: '',
      initialPrice: '',
      openingBalance: '',
      openingBalanceDate: ''
    }
  })

  async function loadClients(): Promise<void> {
    setLoading(true)
    const result = await window.api.listClients()
    if (result.ok) setClients(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void window.api.listClients().then((result) => {
      if (result.ok) setClients(result.data)
      setLoading(false)
    })
  }, [])

  async function handleSaveClient(values: ClientFormInput): Promise<void> {
    let parsedValues: ClientFormValues
    try {
      parsedValues = clientSchema.parse(values)
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          const field = issue.path[0]
          if (typeof field === 'string') {
            clientForm.setError(field as keyof ClientFormInput, { message: issue.message })
          }
        })
        return
      }
      throw error
    }

    const result = editingClientId
      ? await window.api.updateClient({ id: editingClientId, ...parsedValues })
      : await window.api.createClient(parsedValues)
    if (result.ok) {
      setIsDialogOpen(false)
      clientForm.reset()
      setEditingClientId(null)
      await loadClients()
    } else {
      result.errors.forEach((error) => {
        if (error.field in clientForm.getValues()) {
          clientForm.setError(error.field as keyof ClientFormInput, { message: error.message })
        }
      })
    }
  }

  function startEditingClient(client: Client): void {
    setEditingClientId(client.id)
    clientForm.reset({
      name: client.name,
      location: client.location ?? '',
      initialPrice: client.initialPrice === null ? '' : String(client.initialPrice),
      openingBalance: String(client.openingBalance ?? 0),
      openingBalanceDate: client.openingBalanceDate ?? ''
    })
    setIsDialogOpen(true)
  }

  function cancelEditingClient(): void {
    setEditingClientId(null)
    clientForm.reset()
    setIsDialogOpen(false)
  }

  async function handleDeleteClient(client: Client): Promise<void> {
    if (!confirm(t('clientsSettings.deleteConfirmation', { name: client.name }))) return
    const result = await window.api.deleteClient({ id: client.id })
    if (result.ok) {
      if (editingClientId === client.id) cancelEditingClient()
      await loadClients()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingClientId(null)
      clientForm.reset()
    }
  }

  const columns: ColumnDef<Client, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') },
    {
      accessorKey: 'initialPrice',
      header: t('common.defaultPrice'),
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      accessorKey: 'location',
      header: t('clientsSettings.fields.location'),
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      accessorKey: 'openingBalance',
      header: t('common.openingBalance'),
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      accessorKey: 'openingBalanceDate',
      header: t('common.openingBalanceDate'),
      cell: ({ getValue }) => getValue() ?? t('common.emptyCell')
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => startEditingClient(row.original)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteClient(row.original)}
          >
            {t('common.delete')}
          </Button>
        </div>
      )
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('clientsSettings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingClientId(null)
                clientForm.reset()
              }}
            >
              {t('clientsSettings.addButton')}
            </Button>
          </DialogTrigger>
          <DialogContent closeDisabled={clientForm.formState.isSubmitting}>
            <DialogHeader>
              <DialogTitle>
                {editingClientId ? t('clientsSettings.editTitle') : t('clientsSettings.addTitle')}
              </DialogTitle>
            </DialogHeader>
            <Form {...clientForm}>
              <form
                noValidate
                onSubmit={clientForm.handleSubmit(handleSaveClient)}
                className="grid gap-4"
              >
                <FormField
                  control={clientForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('clientsSettings.fields.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('clientsSettings.fields.name')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
                  name="initialPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.defaultPrice')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          placeholder={t('common.defaultPrice')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('clientsSettings.fields.location')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('clientsSettings.fields.location')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
                  name="openingBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.openingBalance')}</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={clientForm.control}
                  name="openingBalanceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.openingBalanceDate')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <SubmitButton isSubmitting={clientForm.formState.isSubmitting}>
                    {editingClientId
                      ? t('contractorsSettings.saveEdit')
                      : t('contractorsSettings.addSubmit')}
                  </SubmitButton>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={clientForm.formState.isSubmitting}
                      onClick={cancelEditingClient}
                    >
                      {t('common.cancel')}
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        <div className="mt-6">
          <DataTable
            columns={columns}
            data={clients}
            loading={loading}
            getRowId={(client) => String(client.id)}
            enableRowSelection
          />
        </div>
      </CardContent>
    </Card>
  )
}
