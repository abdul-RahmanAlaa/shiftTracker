import type { ReactNode, FormEventHandler } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { DataTable } from '@/components/DataTable'
import { SubmitButton } from '@/components/SubmitButton'

interface SettingsEntityPageProps<Row> {
  title: string
  addButtonText: string
  addTitle: string
  editTitle: string
  actionsText: string
  editText: string
  deleteText: string
  addSubmitText: string
  saveEditText: string
  cancelText: string
  rows: Row[]
  loading: boolean
  columns: ColumnDef<Row, unknown>[]
  getRowId: (row: Row) => string
  isEditing: boolean
  dialogOpen: boolean
  closeDisabled: boolean
  onAdd: () => void
  onEdit: (row: Row) => void
  onDelete: (row: Row) => void
  onDialogOpenChange: (open: boolean) => void
  onCancel: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  noValidate?: boolean
  formClassName?: string
  footerClassName?: string
  tableClassName?: string
  sumColumnId?: string
  formatSum?: (value: number) => string
  children: ReactNode
}

export function SettingsEntityPage<Row>({
  title,
  addButtonText,
  addTitle,
  editTitle,
  actionsText,
  editText,
  deleteText,
  addSubmitText,
  saveEditText,
  cancelText,
  rows,
  loading,
  columns,
  getRowId,
  isEditing,
  dialogOpen,
  closeDisabled,
  onAdd,
  onEdit,
  onDelete,
  onDialogOpenChange,
  onCancel,
  onSubmit,
  noValidate,
  formClassName = 'grid gap-4',
  footerClassName,
  tableClassName = 'mt-6 flex min-h-0 flex-1 flex-col',
  sumColumnId,
  formatSum,
  children
}: SettingsEntityPageProps<Row>): React.JSX.Element {
  const tableColumns: ColumnDef<Row, unknown>[] = [
    ...columns,
    {
      id: 'actions',
      header: actionsText,
      meta: { nowrap: true },
      enableSorting: false,
      enableColumnFilter: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(row.original)}>
            {editText}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void onDelete(row.original)}
          >
            {deleteText}
          </Button>
        </div>
      )
    }
  ]

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
          <DialogTrigger asChild>
            <Button type="button" onClick={onAdd}>
              {addButtonText}
            </Button>
          </DialogTrigger>
          <DialogContent closeDisabled={closeDisabled}>
            <DialogHeader>
              <DialogTitle>{isEditing ? editTitle : addTitle}</DialogTitle>
            </DialogHeader>
            <form noValidate={noValidate} onSubmit={onSubmit} className={formClassName}>
              {children}
              <DialogFooter className={footerClassName}>
                <SubmitButton isSubmitting={closeDisabled}>
                  {isEditing ? saveEditText : addSubmitText}
                </SubmitButton>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={closeDisabled}
                    onClick={onCancel}
                  >
                    {cancelText}
                  </Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <div className={tableClassName}>
          <DataTable
            columns={tableColumns}
            data={rows}
            loading={loading}
            getRowId={getRowId}
            enableRowSelection
            sumColumnId={sumColumnId}
            formatSum={formatSum}
          />
        </div>
      </CardContent>
    </Card>
  )
}
