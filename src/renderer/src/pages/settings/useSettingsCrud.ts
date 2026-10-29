import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfirm } from '@/components/ConfirmDialog'
import type { IpcFieldError } from '@/lib/ipcErrors'

type SettingsRowsResult<Row> = { ok: true; data: Row[] } | { ok: false; errors: IpcFieldError[] }

type SettingsMutationResult = { ok: true; data: unknown } | { ok: false; errors: IpcFieldError[] }

interface SettingsCrudOptions<Row, Values> {
  list: () => Promise<SettingsRowsResult<Row>>
  save: (editingRow: Row | null, values: Values) => Promise<SettingsMutationResult | undefined>
  remove: (row: Row) => Promise<SettingsMutationResult>
  getRowId: (row: Row) => string | number
  getDeleteConfirmation: (row: Row) => string
  resetForm: (row: Row | null) => void
}

interface SettingsCrudResult<Row, Values> {
  rows: Row[]
  loading: boolean
  editingRow: Row | null
  isEditing: boolean
  dialogOpen: boolean
  reload: () => Promise<void>
  openForCreate: () => void
  openForEdit: (row: Row) => void
  closeDialog: () => void
  handleDialogOpenChange: (open: boolean) => void
  save: (values: Values) => Promise<void>
  deleteRow: (row: Row) => Promise<void>
}

export function useSettingsCrud<Row, Values>(
  options: SettingsCrudOptions<Row, Values>
): SettingsCrudResult<Row, Values> {
  const requestConfirmation = useConfirm()
  const optionsRef = useRef(options)
  const latestRequest = useRef(0)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRow, setEditingRow] = useState<Row | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const reload = useCallback(async (): Promise<void> => {
    const requestId = ++latestRequest.current
    setLoading(true)
    try {
      const result = await optionsRef.current.list()
      if (requestId === latestRequest.current && result.ok) setRows(result.data)
    } finally {
      if (requestId === latestRequest.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const requestId = ++latestRequest.current
    void optionsRef.current
      .list()
      .then((result) => {
        if (requestId === latestRequest.current && result.ok) setRows(result.data)
      })
      .finally(() => {
        if (requestId === latestRequest.current) setLoading(false)
      })
    return () => {
      if (requestId === latestRequest.current) latestRequest.current += 1
    }
  }, [])

  const openForCreate = useCallback((): void => {
    setEditingRow(null)
    optionsRef.current.resetForm(null)
    setDialogOpen(true)
  }, [])

  const openForEdit = useCallback((row: Row): void => {
    setEditingRow(row)
    optionsRef.current.resetForm(row)
    setDialogOpen(true)
  }, [])

  const closeDialog = useCallback((): void => {
    setDialogOpen(false)
    setEditingRow(null)
    optionsRef.current.resetForm(null)
  }, [])

  const handleDialogOpenChange = useCallback(
    (open: boolean): void => {
      if (open) setDialogOpen(true)
      else closeDialog()
    },
    [closeDialog]
  )

  const save = useCallback(
    async (values: Values): Promise<void> => {
      const result = await optionsRef.current.save(editingRow, values)
      if (!result?.ok) return
      closeDialog()
      await reload()
    },
    [closeDialog, editingRow, reload]
  )

  const deleteRow = useCallback(
    async (row: Row): Promise<void> => {
      if (
        !(await requestConfirmation({
          message: optionsRef.current.getDeleteConfirmation(row)
        }))
      )
        return
      const result = await optionsRef.current.remove(row)
      if (!result.ok) return
      if (
        editingRow !== null &&
        optionsRef.current.getRowId(editingRow) === optionsRef.current.getRowId(row)
      ) {
        closeDialog()
      }
      await reload()
    },
    [closeDialog, editingRow, reload, requestConfirmation]
  )

  return {
    rows,
    loading,
    editingRow,
    isEditing: editingRow !== null,
    dialogOpen,
    reload,
    openForCreate,
    openForEdit,
    closeDialog,
    handleDialogOpenChange,
    save,
    deleteRow
  }
}
