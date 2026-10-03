import { useEffect, useRef, useState } from 'react'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
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

type AttachmentEntityType = 'TRIP' | 'SHIFT'
type AttachmentRow = Extract<
  Awaited<ReturnType<typeof window.api.listEntityAttachments>>,
  { ok: true }
>['data'][number]
type AttachmentKind = AttachmentRow['kind']

interface AttachmentManagerProps {
  entityType: AttachmentEntityType
  entityId: string
  onAttachmentsChange?: () => void
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
  if (!rotatedContext) throw new Error(i18n.t('receiptPhoto.errors.prepareImage'))

  rotatedCanvas.width = Math.round(rotatedSize.width)
  rotatedCanvas.height = Math.round(rotatedSize.height)
  rotatedContext.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2)
  rotatedContext.rotate((rotation * Math.PI) / 180)
  rotatedContext.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

  const croppedCanvas = document.createElement('canvas')
  const croppedContext = croppedCanvas.getContext('2d')
  if (!croppedContext) throw new Error(i18n.t('receiptPhoto.errors.cropImage'))

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
  if (!outputContext) throw new Error(i18n.t('receiptPhoto.errors.exportImage'))
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

export function AttachmentManager({
  entityType,
  entityId,
  onAttachmentsChange
}: AttachmentManagerProps): React.JSX.Element {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<AttachmentRow[]>([])
  const [attachmentPhotos, setAttachmentPhotos] = useState<Record<number, string | null>>({})
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null)
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [kindToAdd, setKindToAdd] = useState<AttachmentKind | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [operationError, setOperationError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentRow | null>(null)

  const tripKinds: AttachmentKind[] = ['CRUSHER_RECEIPT', 'CLIENT_RECEIPT']
  const requestKey = `${entityType}:${entityId}:${refreshToken}`
  const isLoading = loadedRequestKey !== requestKey

  function kindLabel(kind: AttachmentKind): string {
    switch (kind) {
      case 'CRUSHER_RECEIPT':
        return t('receiptPhoto.labels.crusherReceipt')
      case 'CLIENT_RECEIPT':
        return t('receiptPhoto.labels.clientReceipt')
      case 'CLOSING_SHEET':
        return t('receiptPhoto.labels.closingSheet')
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadAttachments(): Promise<void> {
      const result = await window.api.listEntityAttachments({ entityType, entityId })
      if (cancelled) return
      const nextAttachments = result.ok ? result.data : []
      setAttachments(nextAttachments)
      const photoResults = await Promise.all(
        nextAttachments.map(async (attachment) => {
          const photoResult = await window.api.getAttachmentPhoto({
            photoPath: attachment.photoPath
          })
          return [attachment.id, photoResult.ok ? photoResult.data.dataUri : null] as const
        })
      )
      if (cancelled) return
      setAttachmentPhotos(Object.fromEntries(photoResults))
      setLoadedRequestKey(requestKey)
    }

    void loadAttachments()
    return () => {
      cancelled = true
    }
  }, [entityType, entityId, refreshToken, requestKey])

  function openFilePicker(kind: AttachmentKind): void {
    setKindToAdd(kind)
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
    reader.onerror = () => setSaveError(t('receiptPhoto.errors.readImage'))
    reader.readAsDataURL(file)
  }

  function handleCropComplete(_croppedArea: Area, pixels: Area): void {
    setCroppedAreaPixels(pixels)
  }

  function closeCropDialog(): void {
    setIsCropDialogOpen(false)
    setImageToCrop(null)
    setKindToAdd(null)
    setSaveError(null)
  }

  async function handleSave(): Promise<void> {
    if (!imageToCrop || !croppedAreaPixels || !kindToAdd) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const dataUri = await createCroppedImage(imageToCrop, croppedAreaPixels, rotation)
      const imageBase64 = dataUri.replace(/^data:image\/jpeg;base64,/, '')
      const result = await window.api.addAttachment({
        entityType,
        entityId,
        kind: kindToAdd,
        imageBase64
      })
      if (!result.ok) {
        setSaveError(result.errors.map((error) => error.message).join(', '))
        return
      }
      setRefreshToken((previous) => previous + 1)
      onAttachmentsChange?.()
      closeCropDialog()
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('receiptPhoto.errors.saveImage'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(attachment: AttachmentRow): Promise<void> {
    const label = kindLabel(attachment.kind)
    if (!confirm(t('receiptPhoto.confirmDelete', { label }))) return
    setOperationError(null)
    const result = await window.api.removeAttachment({ id: attachment.id })
    if (!result.ok) {
      setOperationError(result.errors.map((error) => error.message).join(', '))
      return
    }
    setRefreshToken((previous) => previous + 1)
    onAttachmentsChange?.()
  }

  function renderAttachment(attachment: AttachmentRow): React.JSX.Element {
    const label = kindLabel(attachment.kind)
    const photoDataUri = attachmentPhotos[attachment.id]
    return (
      <div key={attachment.id} className="flex items-center gap-2">
        {photoDataUri ? (
          <button
            type="button"
            className="overflow-hidden rounded-md border"
            onClick={() => setPreviewAttachment(attachment)}
            aria-label={t('receiptPhoto.preview', { label })}
          >
            <img src={photoDataUri} alt={label} className="h-16 w-16 object-cover" />
          </button>
        ) : (
          <span className="text-sm text-muted-foreground">{t('receiptPhoto.unavailable')}</span>
        )}
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => void handleDelete(attachment)}
        >
          {t('common.delete')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
      {entityType === 'TRIP' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {tripKinds.map((kind) => {
            const kindAttachments = attachments.filter((attachment) => attachment.kind === kind)
            const label = kindLabel(kind)
            return (
              <section key={kind} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{label}</h3>
                {kindAttachments.map(renderAttachment)}
                {kindAttachments.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openFilePicker(kind)}
                  >
                    {t('receiptPhoto.upload', { label })}
                  </Button>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t('receiptPhoto.closingDocuments')}</h3>
          {attachments
            .filter((attachment) => attachment.kind === 'CLOSING_SHEET')
            .map(renderAttachment)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => openFilePicker('CLOSING_SHEET')}
          >
            {t('receiptPhoto.addDocument')}
          </Button>
        </section>
      )}
      {operationError && <p className="text-sm text-destructive">{operationError}</p>}

      <Dialog
        open={previewAttachment !== null}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewAttachment ? kindLabel(previewAttachment.kind) : ''}</DialogTitle>
          </DialogHeader>
          {previewAttachment && attachmentPhotos[previewAttachment.id] && (
            <img
              src={attachmentPhotos[previewAttachment.id] ?? undefined}
              alt={t('receiptPhoto.fullImageAlt', { label: kindLabel(previewAttachment.kind) })}
              className="max-h-[75vh] w-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isCropDialogOpen} onOpenChange={(open) => !open && closeCropDialog()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t('receiptPhoto.editTitle', { label: kindToAdd ? kindLabel(kindToAdd) : '' })}
            </DialogTitle>
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
                {t('receiptPhoto.zoom')}
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
                  {t('receiptPhoto.rotateLeft')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRotation((value) => value + 90)}
                >
                  <RotateCw className="h-4 w-4" />
                  {t('receiptPhoto.rotateRight')}
                </Button>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            </>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={closeCropDialog}>
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving || !croppedAreaPixels}
            >
              {isSaving ? t('receiptPhoto.saving') : t('receiptPhoto.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
