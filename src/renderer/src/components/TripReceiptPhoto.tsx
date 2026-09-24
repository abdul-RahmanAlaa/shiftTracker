import { useEffect, useRef, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { RotateCcw, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

interface TripReceiptPhotoProps {
  tripId: string
  photoPath: string | null
  onPhotoChange: (newPath: string | null) => void
}

function createImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', reject)
    image.src = source
  })
}

function getRotatedSize(
  width: number,
  height: number,
  rotation: number
): {
  width: number
  height: number
} {
  const radians = (rotation * Math.PI) / 180
  return {
    width: Math.abs(Math.cos(radians) * width) + Math.abs(Math.sin(radians) * height),
    height: Math.abs(Math.sin(radians) * width) + Math.abs(Math.cos(radians) * height)
  }
}

async function createCroppedImage(
  imageSource: string,
  crop: Area,
  rotation: number
): Promise<string> {
  const image = await createImage(imageSource)
  const rotatedSize = getRotatedSize(image.naturalWidth, image.naturalHeight, rotation)
  const rotatedCanvas = document.createElement('canvas')
  const rotatedContext = rotatedCanvas.getContext('2d')
  if (!rotatedContext) throw new Error('تعذر تجهيز الصورة')

  rotatedCanvas.width = Math.round(rotatedSize.width)
  rotatedCanvas.height = Math.round(rotatedSize.height)
  rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2)
  rotatedContext.rotate((rotation * Math.PI) / 180)
  rotatedContext.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

  const croppedCanvas = document.createElement('canvas')
  const croppedContext = croppedCanvas.getContext('2d')
  if (!croppedContext) throw new Error('تعذر قص الصورة')

  croppedCanvas.width = Math.round(crop.width)
  croppedCanvas.height = Math.round(crop.height)
  croppedContext.drawImage(
    rotatedCanvas,
    Math.round(crop.x),
    Math.round(crop.y),
    Math.round(crop.width),
    Math.round(crop.height),
    0,
    0,
    Math.round(crop.width),
    Math.round(crop.height)
  )

  const scale = Math.min(1, 1600 / Math.max(croppedCanvas.width, croppedCanvas.height))
  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = Math.max(1, Math.round(croppedCanvas.width * scale))
  outputCanvas.height = Math.max(1, Math.round(croppedCanvas.height * scale))
  const outputContext = outputCanvas.getContext('2d')
  if (!outputContext) throw new Error('تعذر تصدير الصورة')
  outputContext.drawImage(
    croppedCanvas,
    0,
    0,
    croppedCanvas.width,
    croppedCanvas.height,
    0,
    0,
    outputCanvas.width,
    outputCanvas.height
  )

  return outputCanvas.toDataURL('image/jpeg', 0.85)
}

export function TripReceiptPhoto({
  tripId,
  photoPath,
  onPhotoChange
}: TripReceiptPhotoProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cachedPathRef = useRef<string | null>(null)
  const cachedDataUriRef = useRef<string | null>(null)
  const [thumbnailDataUri, setThumbnailDataUri] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!photoPath) {
      cachedPathRef.current = null
      cachedDataUriRef.current = null
      queueMicrotask(() => {
        if (!cancelled) setThumbnailDataUri(null)
      })
      return () => {
        cancelled = true
      }
    }
    if (cachedPathRef.current === photoPath && cachedDataUriRef.current) {
      const cachedDataUri = cachedDataUriRef.current
      queueMicrotask(() => {
        if (!cancelled) setThumbnailDataUri(cachedDataUri)
      })
      return () => {
        cancelled = true
      }
    }

    setIsLoading(true)
    void window.api.getTripPhoto({ photoPath }).then((result) => {
      if (cancelled) return
      const dataUri = result.ok ? result.data.dataUri : null
      cachedPathRef.current = photoPath
      cachedDataUriRef.current = dataUri
      setThumbnailDataUri(dataUri)
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [photoPath])

  function openFilePicker(): void {
    fileInputRef.current?.click()
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setImageToCrop(reader.result)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      setRotation(0)
      setCroppedAreaPixels(null)
      setSaveError(null)
      setIsCropDialogOpen(true)
    }
    reader.readAsDataURL(file)
  }

  function handleCropComplete(_croppedArea: Area, pixels: Area): void {
    setCroppedAreaPixels(pixels)
  }

  function closeCropDialog(): void {
    setIsCropDialogOpen(false)
    setImageToCrop(null)
    setSaveError(null)
  }

  async function handleSave(): Promise<void> {
    if (!imageToCrop || !croppedAreaPixels) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const dataUri = await createCroppedImage(imageToCrop, croppedAreaPixels, rotation)
      const imageBase64 = dataUri.replace(/^data:image\/jpeg;base64,/, '')
      const result = await window.api.saveTripPhoto({ tripId, imageBase64 })
      if (!result.ok) {
        setSaveError(result.errors.map((error) => error.message).join(', '))
        return
      }
      cachedPathRef.current = result.data.path
      cachedDataUriRef.current = dataUri
      setThumbnailDataUri(dataUri)
      onPhotoChange(result.data.path)
      closeCropDialog()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'تعذر حفظ الصورة')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(): Promise<void> {
    if (!confirm('متأكد إنك عايز تمسح صورة الإيصال؟')) return
    const result = await window.api.deleteTripPhoto({ tripId })
    if (!result.ok) return
    cachedPathRef.current = null
    cachedDataUriRef.current = null
    setThumbnailDataUri(null)
    onPhotoChange(null)
  }

  return (
    <div className="flex min-w-32 items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {!photoPath ? (
        <Button type="button" variant="outline" size="sm" onClick={openFilePicker}>
          رفع صورة إيصال
        </Button>
      ) : (
        <>
          {isLoading ? (
            <span className="text-sm text-muted-foreground">جاري التحميل...</span>
          ) : thumbnailDataUri ? (
            <button
              type="button"
              className="overflow-hidden rounded-md border"
              onClick={() => setIsPreviewDialogOpen(true)}
              aria-label="معاينة صورة الإيصال"
            >
              <img
                src={thumbnailDataUri}
                alt="صورة إيصال النقلة"
                className="h-16 w-16 object-cover"
              />
            </button>
          ) : (
            <span className="text-sm text-muted-foreground">الصورة غير متاحة</span>
          )}
          <Button type="button" variant="outline" size="sm" onClick={openFilePicker}>
            تغيير
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={() => void handleDelete()}>
            مسح
          </Button>
        </>
      )}

      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>صورة إيصال النقلة</DialogTitle>
          </DialogHeader>
          {thumbnailDataUri && (
            <img
              src={thumbnailDataUri}
              alt="صورة إيصال النقلة بالحجم الكامل"
              className="max-h-[75vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCropDialogOpen} onOpenChange={(open) => !open && closeCropDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تعديل صورة الإيصال</DialogTitle>
          </DialogHeader>
          {imageToCrop && (
            <>
              <div className="relative h-105 w-full overflow-hidden rounded-md bg-black">
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={undefined}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={handleCropComplete}
                />
              </div>
              <label className="grid gap-2 text-sm">
                التكبير
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRotation((value) => value - 90)}
                >
                  <RotateCcw className="h-4 w-4" />
                  تدوير لليسار
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRotation((value) => value + 90)}
                >
                  <RotateCw className="h-4 w-4" />
                  تدوير لليمين
                </Button>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            </>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={closeCropDialog}>
                إلغاء
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || !croppedAreaPixels}
            >
              {isSaving ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
