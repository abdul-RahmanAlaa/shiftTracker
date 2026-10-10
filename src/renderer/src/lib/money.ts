export function hasAtMostTwoDecimals(value: number): boolean {
  return Number.isFinite(value) && Number(value.toFixed(2)) === value
}
