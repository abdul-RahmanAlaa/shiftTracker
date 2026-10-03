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

const crusherSchema = z.object({
  name: z.string().min(1, i18n.t('crushersSettings.validation.nameRequired')),
  initialPrice: z
    .string()
    .optional()
    .transform((val) => (val && val.trim() !== '' ? Number(val) : undefined))
    .refine((val) => val === undefined || val >= 0, i18n.t('common.validation.positivePrice'))
})

type CrusherFormValues = z.infer<typeof crusherSchema>
type CrusherFormInput = z.input<typeof crusherSchema>
type Crusher = { id: number; name: string; initialPrice: number | null }

export function CrushersSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [crushers, setCrushers] = useState<Crusher[]>([])
  const [loading, setLoading] = useState(true)
  const [editingCrusherId, setEditingCrusherId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const crusherForm = useForm<CrusherFormInput>({
    resolver: zodResolver(crusherSchema, undefined, { raw: true }) as Resolver<CrusherFormInput>,
    defaultValues: { name: '', initialPrice: '' }
  })

  async function loadCrushers(): Promise<void> {
    setLoading(true)
    const result = await window.api.listCrushers()
    if (result.ok) setCrushers(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void window.api.listCrushers().then((result) => {
      if (result.ok) setCrushers(result.data)
      setLoading(false)
    })
  }, [])

  async function handleSaveCrusher(values: CrusherFormInput): Promise<void> {
    let parsedValues: CrusherFormValues
    try {
      parsedValues = crusherSchema.parse(values)
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((issue) => {
          const field = issue.path[0]
          if (typeof field === 'string') {
            crusherForm.setError(field as keyof CrusherFormInput, { message: issue.message })
          }
        })
        return
      }
      throw error
    }

    const result = editingCrusherId
      ? await window.api.updateCrusher({ id: editingCrusherId, ...parsedValues })
      : await window.api.createCrusher(parsedValues)
    if (result.ok) {
      setIsDialogOpen(false)
      crusherForm.reset()
      setEditingCrusherId(null)
      await loadCrushers()
    } else {
      result.errors.forEach((error) => {
        if (error.field === 'name' || error.field === 'initialPrice') {
          crusherForm.setError(error.field, { message: error.message })
        }
      })
    }
  }

  function startEditingCrusher(crusher: Crusher): void {
    setEditingCrusherId(crusher.id)
    crusherForm.reset({
      name: crusher.name,
      initialPrice: crusher.initialPrice === null ? '' : String(crusher.initialPrice)
    })
    setIsDialogOpen(true)
  }

  function cancelEditingCrusher(): void {
    setEditingCrusherId(null)
    crusherForm.reset()
    setIsDialogOpen(false)
  }

  async function handleDeleteCrusher(crusher: Crusher): Promise<void> {
    if (!confirm(t('crushersSettings.deleteConfirmation', { name: crusher.name }))) return
    const result = await window.api.deleteCrusher({ id: crusher.id })
    if (result.ok) {
      if (editingCrusherId === crusher.id) cancelEditingCrusher()
      await loadCrushers()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingCrusherId(null)
      crusherForm.reset()
    }
  }

  const columns: ColumnDef<Crusher, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') },
    {
      accessorKey: 'initialPrice',
      header: t('common.defaultPrice'),
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
            onClick={() => startEditingCrusher(row.original)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteCrusher(row.original)}
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
        <CardTitle>{t('crushersSettings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingCrusherId(null)
                crusherForm.reset()
              }}
            >
              {t('crushersSettings.addButton')}
            </Button>
          </DialogTrigger>
          <DialogContent closeDisabled={crusherForm.formState.isSubmitting}>
            <DialogHeader>
              <DialogTitle>
                {editingCrusherId
                  ? t('crushersSettings.editTitle')
                  : t('crushersSettings.addTitle')}
              </DialogTitle>
            </DialogHeader>
            <Form {...crusherForm}>
              <form
                noValidate
                onSubmit={crusherForm.handleSubmit(handleSaveCrusher)}
                className="grid gap-4"
              >
                <FormField
                  control={crusherForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crushersSettings.fields.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('crushersSettings.fields.name')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={crusherForm.control}
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
                <DialogFooter>
                  <SubmitButton isSubmitting={crusherForm.formState.isSubmitting}>
                    {editingCrusherId
                      ? t('contractorsSettings.saveEdit')
                      : t('contractorsSettings.addSubmit')}
                  </SubmitButton>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={crusherForm.formState.isSubmitting}
                      onClick={cancelEditingCrusher}
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
            data={crushers}
            loading={loading}
            getRowId={(crusher) => String(crusher.id)}
            enableRowSelection
          />
        </div>
      </CardContent>
    </Card>
  )
}
