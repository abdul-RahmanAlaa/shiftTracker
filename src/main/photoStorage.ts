import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

export function saveAttachmentPhoto(attachmentId: number, base64Jpeg: string): string {
  const dir = join(app.getPath('userData'), 'docs', 'attachments')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${attachmentId}.jpg`)
  writeFileSync(filePath, Buffer.from(base64Jpeg, 'base64'))
  return join('docs', 'attachments', `${attachmentId}.jpg`)
}

export function deleteAttachmentPhotoFile(relativePath: string): void {
  const filePath = join(app.getPath('userData'), relativePath)
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function readPhotoAsDataUri(relativePath: string): string | null {
  const filePath = join(app.getPath('userData'), relativePath)
  if (!existsSync(filePath)) return null
  const buffer = readFileSync(filePath)
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}
