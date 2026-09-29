import { useState } from 'react'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import type { ColumnDef } from '@tanstack/react-table'
import { UploadCloud } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type ImportError = { row: number; field: string; message: string }

const importCsvHeaders =
  'old_shift_no,driver_name,vehicle_no,shift_start_date,shift_end_date,shift_crusher_cubic_default,shift_client_cubic_default,trip_date,crusher_cubic,client_cubic_reported,discount_qty,discount_reason,location,crusher_name,stone_price,crusher_receipt_status,crusher_receipt_no,client_name,transport_price,client_price,recipient_name_status,recipient_name,client_receipt_no,notes'

const t = i18n.t

const importErrorColumns: ColumnDef<ImportError, unknown>[] = [
  {
    id: 'row',
    accessorFn: (error) => (error.row === 0 ? t('importPage.errors.general') : error.row),
    header: t('importPage.errors.rowNumber')
  },
  {
    id: 'message',
    accessorFn: (error) => `${error.field}: ${error.message}`,
    header: t('importPage.errors.error')
  }
]

export function ImportPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<ImportError[]>([])
  const [summary, setSummary] = useState<{ shiftsCreated: number; tripsCreated: number } | null>(
    null
  )
  const [fileError, setFileError] = useState<string | null>(null)

  function handleDownloadTemplate(): void {
    const csvText = `\uFEFF${importCsvHeaders}\n${t('importPage.csv.description')}\n${t('importPage.csv.example')}\n`
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = t('importPage.csv.templateFileName')
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setCsvText('')
    setErrors([])
    setSummary(null)
    setFileError(null)

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setCsvText(reader.result)
      else setFileError(t('importPage.errors.readFile'))
    }
    reader.onerror = () => setFileError(t('importPage.errors.readFile'))
    reader.readAsText(file)
  }

  async function handleImport(): Promise<void> {
    if (!csvText) {
      setFileError(t('importPage.errors.selectFileFirst'))
      return
    }
    setIsLoading(true)
    setErrors([])
    setSummary(null)
    setFileError(null)
    try {
      const result = await window.api.importCsvData({ csvText })
      if (result.ok) {
        setSummary(result.data)
      } else {
        setErrors(
          result.errors
            .map((error) => ({ row: error.row, field: error.field, message: error.message }))
            .sort((first, second) => first.row - second.row)
        )
      }
    } catch (error) {
      setFileError(error instanceof Error ? error.message : t('importPage.errors.importFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('importPage.title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('importPage.cardTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
            {t('importPage.downloadTemplate')}
          </Button>
          <Input type="file" accept=".csv" onChange={handleFileChange} />
          {fileName && (
            <p className="text-sm text-muted-foreground">
              {t('importPage.selectedFile', { fileName })}
            </p>
          )}
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={isLoading || !csvText}
          >
            <UploadCloud className="h-4 w-4" />
            {isLoading ? t('importPage.importing') : t('importPage.submit')}
          </Button>
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {summary && (
            <Badge className="bg-green-600 text-white hover:bg-green-600">
              {t('importPage.successSummary', {
                shifts: summary.shiftsCreated,
                trips: summary.tripsCreated
              })}
            </Badge>
          )}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t('importPage.errors.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={importErrorColumns}
              data={errors}
              getRowId={(error) => `${error.row}-${error.field}`}
              emptyMessage={t('importPage.errors.empty')}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
