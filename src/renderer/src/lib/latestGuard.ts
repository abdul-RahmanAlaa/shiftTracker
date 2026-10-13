export interface LatestGuard {
  next(): number
  isLatest(token: number): boolean
  cancel(): void
}

export function createLatestGuard(): LatestGuard {
  let latestToken = 0

  return {
    next() {
      latestToken += 1
      return latestToken
    },
    isLatest(token) {
      return token === latestToken
    },
    cancel() {
      latestToken += 1
    }
  }
}
