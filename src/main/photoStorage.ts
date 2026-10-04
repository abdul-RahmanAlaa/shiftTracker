import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join, resolve, sep } from 'path'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB decoded
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])

function attachmentsDir(): string {
  return join(app.getPath('userData'), 'docs', 'attachments')
}

function resolveSafeAttachmentPath(relativePath: string): string {
  const base = resolve(attachmentsDir())
  const resolved = resolve(join(app.getPath('userData'), relativePath))
  if (resolved !== base && !resolved.startsWith(base + sep)) {
    throw new Error('مسار الملف غير صالح')
  }
  return resolved
}

export function saveAttachmentPhoto(attachmentId: number, base64Jpeg: string): string {
  const buffer = Buffer.from(base64Jpeg, 'base64')

  if (buffer.length === 0) {
    throw new Error('الصورة فاضية')
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw new Error('حجم الصورة أكبر من الحد المسموح (5 ميجابايت)')
  }
  if (!buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    throw new Error('الملف مش صورة JPEG صالحة')
  }

  const dir = attachmentsDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const relativePath = join('docs', 'attachments', `${attachmentId}.jpg`)
  const filePath = resolveSafeAttachmentPath(relativePath)
  writeFileSync(filePath, buffer)
  return relativePath
}

export function deleteAttachmentPhotoFile(relativePath: string): void {
  const filePath = resolveSafeAttachmentPath(relativePath)
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function readPhotoAsDataUri(relativePath: string): string | null {
  const filePath = resolveSafeAttachmentPath(relativePath)
  if (!existsSync(filePath)) return null
  const buffer = readFileSync(filePath)
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

export function attachmentFileExists(relativePath: string): boolean {
  const filePath = resolveSafeAttachmentPath(relativePath)
  return existsSync(filePath)
}
