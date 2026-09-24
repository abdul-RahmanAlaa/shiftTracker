import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

export function savePhotoForTrip(tripId: string, base64Jpeg: string): string {
  const dir = join(app.getPath('userData'), 'docs', 'trips')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${tripId}.jpg`)
  writeFileSync(filePath, Buffer.from(base64Jpeg, 'base64'))
  return join('docs', 'trips', `${tripId}.jpg`)
}

export function deletePhotoForTrip(tripId: string): void {
  const filePath = join(app.getPath('userData'), 'docs', 'trips', `${tripId}.jpg`)
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function readPhotoAsDataUri(relativePath: string): string | null {
  const filePath = join(app.getPath('userData'), relativePath)
  if (!existsSync(filePath)) return null
  const buffer = readFileSync(filePath)
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}
