import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
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

const contractorSchema = z.object({
  name: z.string().min(1, i18n.t('contractorsSettings.validation.nameRequired')),
  phone: z.string().optional()
})

type ContractorFormValues = z.infer<typeof contractorSchema>
type Contractor = { id: number; name: string; phone: string | null }

export function ContractorsSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [loading, setLoading] = useState(true)
  const [editingContractorId, setEditingContractorId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const contractorForm = useForm<ContractorFormValues>({
    resolver: zodResolver(contractorSchema),
    defaultValues: { name: '', phone: '' }
  })

  async function loadContractors(): Promise<void> {
    setLoading(true)
    const result = await window.api.listContractors()
    if (result.ok) setContractors(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void window.api.listContractors().then((result) => {
      if (result.ok) setContractors(result.data)
      setLoading(false)
    })
  }, [])

  async function handleSaveContractor(values: ContractorFormValues): Promise<void> {
    const result = editingContractorId
      ? await window.api.updateContractor({ id: editingContractorId, ...values })
      : await window.api.createContractor(values)
    if (result.ok) {
      setIsDialogOpen(false)
      contractorForm.reset({ name: '', phone: '' })
      setEditingContractorId(null)
      await loadContractors()
    } else {
      result.errors.forEach((error) => {
        if (error.field === 'name' || error.field === 'phone') {
          contractorForm.setError(error.field, { message: error.message })
        }
      })
    }
  }

  function startEditingContractor(contractor: Contractor): void {
    setEditingContractorId(contractor.id)
    contractorForm.reset({ name: contractor.name, phone: contractor.phone ?? '' })
    setIsDialogOpen(true)
  }

  function cancelEditingContractor(): void {
    setEditingContractorId(null)
    contractorForm.reset({ name: '', phone: '' })
    setIsDialogOpen(false)
  }

  async function handleDeleteContractor(contractor: Contractor): Promise<void> {
    if (!confirm(t('contractorsSettings.deleteConfirmation', { name: contractor.name }))) return
    const result = await window.api.deleteContractor({ id: contractor.id })
    if (result.ok) {
      if (editingContractorId === contractor.id) cancelEditingContractor()
      await loadContractors()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingContractorId(null)
      contractorForm.reset({ name: '', phone: '' })
    }
  }

  const columns: ColumnDef<Contractor, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') },
    {
      accessorKey: 'phone',
      header: t('contractorsSettings.phoneNumber'),
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
            onClick={() => startEditingContractor(row.original)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteContractor(row.original)}
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
        <CardTitle>{t('contractorsSettings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingContractorId(null)
                contractorForm.reset({ name: '', phone: '' })
              }}
            >
              {t('contractorsSettings.addButton')}
            </Button>
          </DialogTrigger>
          <DialogContent closeDisabled={contractorForm.formState.isSubmitting}>
            <DialogHeader>
              <DialogTitle>
                {editingContractorId
                  ? t('contractorsSettings.editTitle')
                  : t('contractorsSettings.addTitle')}
              </DialogTitle>
            </DialogHeader>
            <Form {...contractorForm}>
              <form
                onSubmit={contractorForm.handleSubmit(handleSaveContractor)}
                className="grid gap-4"
              >
                <FormField
                  control={contractorForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('contractorsSettings.fields.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('contractorsSettings.fields.name')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contractorForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('contractorsSettings.phoneNumber')}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder={t('contractorsSettings.phoneNumber')}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <SubmitButton isSubmitting={contractorForm.formState.isSubmitting}>
                    {editingContractorId
                      ? t('contractorsSettings.saveEdit')
                      : t('contractorsSettings.addSubmit')}
                  </SubmitButton>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={contractorForm.formState.isSubmitting}
                      onClick={cancelEditingContractor}
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
            data={contractors}
            loading={loading}
            getRowId={(contractor) => String(contractor.id)}
            enableRowSelection
          />
        </div>
      </CardContent>
    </Card>
  )
}
