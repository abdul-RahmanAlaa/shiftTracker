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

const materialTypeSchema = z.object({
  name: z.string().min(1, i18n.t('materialTypesSettings.validation.nameRequired'))
})

type MaterialTypeFormInput = z.input<typeof materialTypeSchema>
type MaterialType = { id: number; name: string }

export function MaterialTypesSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [materialTypes, setMaterialTypes] = useState<MaterialType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingMaterialTypeId, setEditingMaterialTypeId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const materialTypeForm = useForm<MaterialTypeFormInput>({
    resolver: zodResolver(materialTypeSchema),
    defaultValues: { name: '' }
  })

  async function loadMaterialTypes(): Promise<void> {
    setLoading(true)
    const result = await window.api.listMaterialTypes()
    if (result.ok) setMaterialTypes(result.data)
    setLoading(false)
  }

  useEffect(() => {
    void window.api.listMaterialTypes().then((result) => {
      if (result.ok) setMaterialTypes(result.data)
      setLoading(false)
    })
  }, [])

  async function handleSaveMaterialType(values: MaterialTypeFormInput): Promise<void> {
    const result = editingMaterialTypeId
      ? await window.api.updateMaterialType({ id: editingMaterialTypeId, ...values })
      : await window.api.createMaterialType(values)

    if (result.ok) {
      setIsDialogOpen(false)
      materialTypeForm.reset({ name: '' })
      setEditingMaterialTypeId(null)
      await loadMaterialTypes()
    } else {
      result.errors.forEach((error) => {
        if (error.field === 'name') {
          materialTypeForm.setError('name', { message: error.message })
        }
      })
    }
  }

  function startEditingMaterialType(materialType: MaterialType): void {
    setEditingMaterialTypeId(materialType.id)
    materialTypeForm.reset({ name: materialType.name })
    setIsDialogOpen(true)
  }

  function cancelEditingMaterialType(): void {
    setEditingMaterialTypeId(null)
    materialTypeForm.reset({ name: '' })
    setIsDialogOpen(false)
  }

  async function handleDeleteMaterialType(materialType: MaterialType): Promise<void> {
    if (!confirm(t('materialTypesSettings.deleteConfirmation', { name: materialType.name }))) return
    const result = await window.api.deleteMaterialType({ id: materialType.id })
    if (result.ok) {
      if (editingMaterialTypeId === materialType.id) cancelEditingMaterialType()
      await loadMaterialTypes()
    }
  }

  function handleDialogChange(open: boolean): void {
    setIsDialogOpen(open)
    if (!open) {
      setEditingMaterialTypeId(null)
      materialTypeForm.reset({ name: '' })
    }
  }

  const columns: ColumnDef<MaterialType, unknown>[] = [
    { accessorKey: 'name', header: t('common.columns.name') },
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
            onClick={() => startEditingMaterialType(row.original)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void handleDeleteMaterialType(row.original)}
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
        <CardTitle>{t('materialTypesSettings.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button
              type="button"
              onClick={() => {
                setEditingMaterialTypeId(null)
                materialTypeForm.reset({ name: '' })
              }}
            >
              {t('materialTypesSettings.addButton')}
            </Button>
          </DialogTrigger>
          <DialogContent closeDisabled={materialTypeForm.formState.isSubmitting}>
            <DialogHeader>
              <DialogTitle>
                {editingMaterialTypeId
                  ? t('materialTypesSettings.editTitle')
                  : t('materialTypesSettings.addTitle')}
              </DialogTitle>
            </DialogHeader>
            <Form {...materialTypeForm}>
              <form
                noValidate
                onSubmit={materialTypeForm.handleSubmit(handleSaveMaterialType)}
                className="grid gap-4"
              >
                <FormField
                  control={materialTypeForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('materialTypesSettings.fields.name')}</FormLabel>
                      <FormControl>
                        <Input placeholder={t('materialTypesSettings.fields.name')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <SubmitButton isSubmitting={materialTypeForm.formState.isSubmitting}>
                    {editingMaterialTypeId
                      ? t('contractorsSettings.saveEdit')
                      : t('contractorsSettings.addSubmit')}
                  </SubmitButton>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={materialTypeForm.formState.isSubmitting}
                      onClick={cancelEditingMaterialType}
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
            data={materialTypes}
            loading={loading}
            getRowId={(materialType) => String(materialType.id)}
            enableRowSelection
          />
        </div>
      </CardContent>
    </Card>
  )
}
