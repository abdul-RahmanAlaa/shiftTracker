import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'

export type PhotoKind = 'trip' | 'shift'

function directoryFor(kind: PhotoKind): string {
  return `${kind}s`
}

export function savePhoto(kind: PhotoKind, id: string, base64Jpeg: string): string {
  const directory = directoryFor(kind)
  const dir = join(app.getPath('userData'), 'docs', directory)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const filePath = join(dir, `${id}.jpg`)
  writeFileSync(filePath, Buffer.from(base64Jpeg, 'base64'))
  return join('docs', directory, `${id}.jpg`)
}

export function deletePhoto(kind: PhotoKind, id: string): void {
  const filePath = join(app.getPath('userData'), 'docs', directoryFor(kind), `${id}.jpg`)
  if (existsSync(filePath)) unlinkSync(filePath)
}

export function readPhotoAsDataUri(relativePath: string): string | null {
  const filePath = join(app.getPath('userData'), relativePath)
  if (!existsSync(filePath)) return null
  const buffer = readFileSync(filePath)
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}
