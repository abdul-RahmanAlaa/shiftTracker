import type Database from 'better-sqlite3'

export interface Migration {
  version: number
  name: string
  foreignKeys?: 'off'
  up(db: Database.Database): void
}

export const migrations: Migration[] = []
