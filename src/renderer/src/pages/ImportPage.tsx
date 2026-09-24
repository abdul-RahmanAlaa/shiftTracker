import { useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type ImportError = { row: number; field: string; message: string }

const importCsvHeaders =
  'old_shift_no,driver_name,vehicle_no,shift_start_date,shift_end_date,shift_crusher_cubic_default,shift_client_cubic_default,trip_date,crusher_cubic,client_cubic_reported,discount_qty,discount_reason,location,crusher_name,stone_price,crusher_receipt_status,crusher_receipt_no,client_name,transport_price,client_price,recipient_name_status,recipient_name,client_receipt_no,notes'
const importCsvDescription =
  'احذف هذا السطر قبل الرفع, اسم السائق, رقم العربية, تاريخ بداية الوردية, تاريخ نهاية الوردية, تكعيب الكسارة الافتراضي للوردية, تكعيب العميل الافتراضي للوردية, تاريخ النقلة, تكعيب الكسارة, تكعيب العميل, كمية الخصم, سبب الخصم, المكان, اسم الكسارة, سعر الحجر, حالة إيصال الكسارة (قيمة/مفيش (متأكد)/مش معروف), رقم إيصال الكسارة, اسم العميل, سعر النقل, سعر العميل, حالة اسم المستلم (قيمة/مش واضح), اسم المستلم, رقم إيصال العميل, ملاحظات'
const importCsvExample =
  'SH-OLD-1,أحمد محمد,1645,2026-01-01,2026-01-05,25,24,2026-01-02,25,24,0,,الكسارة الرئيسية,اسم كسارة تجريبي,150,قيمة,1001,اسم عميل تجريبي,80,200,مش واضح,,,ملاحظة تجريبية'

export function ImportPage(): React.JSX.Element {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<ImportError[]>([])
  const [summary, setSummary] = useState<{ shiftsCreated: number; tripsCreated: number } | null>(
    null
  )
  const [fileError, setFileError] = useState<string | null>(null)

  function handleDownloadTemplate(): void {
    const csvText = `\uFEFF${importCsvHeaders}\n${importCsvDescription}\n${importCsvExample}\n`
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'نموذج_استيراد.csv'
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
      else setFileError('تعذر قراءة الملف')
    }
    reader.onerror = () => setFileError('تعذر قراءة الملف')
    reader.readAsText(file)
  }

  async function handleImport(): Promise<void> {
    if (!csvText) {
      setFileError('اختار ملف CSV الأول')
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
      setFileError(error instanceof Error ? error.message : 'حدث خطأ أثناء الاستيراد')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">استيراد بيانات</h1>
      <Card>
        <CardHeader>
          <CardTitle>استيراد بيانات من CSV</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
            تحميل نموذج CSV
          </Button>
          <Input type="file" accept=".csv" onChange={handleFileChange} />
          {fileName && <p className="text-sm text-muted-foreground">الملف المختار: {fileName}</p>}
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={isLoading || !csvText}
          >
            <UploadCloud className="h-4 w-4" />
            {isLoading ? 'جاري الاستيراد...' : 'استيراد'}
          </Button>
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {summary && (
            <Badge className="bg-green-600 text-white hover:bg-green-600">
              تم استيراد {summary.shiftsCreated} وردية و{summary.tripsCreated} نقلة بنجاح
            </Badge>
          )}
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>أخطاء الاستيراد</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رقم السطر</TableHead>
                  <TableHead>الخطأ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errors.map((error, index) => (
                  <TableRow key={`${error.row}-${error.field}-${index}`}>
                    <TableCell>{error.row === 0 ? 'عام' : error.row}</TableCell>
                    <TableCell>
                      {error.field}: {error.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
