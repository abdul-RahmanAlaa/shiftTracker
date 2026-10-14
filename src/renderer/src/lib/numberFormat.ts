const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
const quantityFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 3
})

export function formatMoney(value: number): string {
  return moneyFormatter.format(value)
}

export function formatQuantity(value: number): string {
  return quantityFormatter.format(value)
}
