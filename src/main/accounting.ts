const MONEY_SCALE = 100n

function decimalParts(value: number): { numerator: bigint; denominator: bigint } | null {
  if (!Number.isFinite(value)) return null
  const match = value
    .toString()
    .toLowerCase()
    .match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/)
  if (!match) return null

  const fraction = match[3] ?? ''
  const exponent = Number(match[4] ?? 0)
  let numerator = BigInt(`${match[1]}${match[2]}${fraction}`)
  let denominator = 10n ** BigInt(fraction.length)
  if (exponent > 0) numerator *= 10n ** BigInt(exponent)
  if (exponent < 0) denominator *= 10n ** BigInt(-exponent)
  return { numerator, denominator }
}

export function toMinorUnits(value: number): number | null {
  const parts = decimalParts(value)
  if (!parts) return null
  const scaledNumerator = parts.numerator * MONEY_SCALE
  if (scaledNumerator % parts.denominator !== 0n) return null
  const minorUnits = scaledNumerator / parts.denominator
  if (
    minorUnits > BigInt(Number.MAX_SAFE_INTEGER) ||
    minorUnits < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return null
  }
  return Number(minorUnits)
}

export function fromMinorUnits(value: number): number {
  return value / 100
}

export function multiplyQuantityByMinorUnits(quantity: number, unitPriceMinor: number): number {
  const parts = decimalParts(quantity)
  if (!parts || !Number.isSafeInteger(unitPriceMinor)) {
    throw new Error('Invalid accounting input')
  }
  const numerator = parts.numerator * BigInt(unitPriceMinor)
  const denominator = parts.denominator
  const rounded =
    numerator >= 0n
      ? (numerator + denominator / 2n) / denominator
      : -((-numerator + denominator / 2n) / denominator)
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER) || rounded < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('Accounting amount exceeds the supported range')
  }
  return Number(rounded)
}

export function sumMinorUnits(values: number[]): number {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error('Accounting total exceeds the supported range')
  }
  return Number(total)
}

export interface ClientTripAccountingInput {
  clientCubicReported: number
  clientPriceMinor: number
  fineAmountMinor: number
}

export interface ClientTripAccounting {
  chargeMinor: number
  fineMinor: number
  balanceChangeMinor: number
}

export function calculateClientTrip(input: ClientTripAccountingInput): ClientTripAccounting {
  const chargeMinor = multiplyQuantityByMinorUnits(
    input.clientCubicReported,
    input.clientPriceMinor
  )
  return {
    chargeMinor,
    fineMinor: input.fineAmountMinor,
    balanceChangeMinor: chargeMinor - input.fineAmountMinor
  }
}

export interface ContractorTripAccountingInput {
  clientCubicReported: number
  transportPriceMinor: number
  crusherCubic: number
  stonePriceMinor: number
}

export interface ContractorTripAccounting {
  transportMinor: number
  materialMinor: number
}

export function calculateContractorTrip(
  input: ContractorTripAccountingInput
): ContractorTripAccounting {
  return {
    transportMinor: multiplyQuantityByMinorUnits(
      input.clientCubicReported,
      input.transportPriceMinor
    ),
    materialMinor: multiplyQuantityByMinorUnits(input.crusherCubic, input.stonePriceMinor)
  }
}

export interface ClientAccountingTrip extends ClientTripAccountingInput {
  id: string
  date: string
  description: string | null
  fineReason: string | null
}

export interface ContractorAccountingTrip extends ContractorTripAccountingInput {
  id: string
  date: string
  description: string | null
}

export interface ClientAccountingInput {
  openingBalanceMinor: number
  trips: ClientAccountingTrip[]
  paymentsMinor: number[]
}

export interface ClientAccountingTotals {
  receivableMinor: number
  fineMinor: number
  paidMinor: number
  balanceMinor: number
  totalCubic: number
}

export function calculateClientAccount(input: ClientAccountingInput): ClientAccountingTotals {
  const tripAccounting = input.trips.map(calculateClientTrip)
  const receivableMinor = sumMinorUnits(tripAccounting.map((trip) => trip.chargeMinor))
  const fineMinor = sumMinorUnits(tripAccounting.map((trip) => trip.fineMinor))
  const paidMinor = sumMinorUnits(input.paymentsMinor)
  const totalCubic = input.trips.reduce((total, trip) => total + trip.clientCubicReported, 0)
  return {
    receivableMinor,
    fineMinor,
    paidMinor,
    totalCubic,
    balanceMinor: sumMinorUnits([
      input.openingBalanceMinor,
      receivableMinor,
      -fineMinor,
      -paidMinor
    ])
  }
}

export interface ContractorAccountingInput {
  openingBalanceMinor: number
  trips: ContractorAccountingTrip[]
  settlementsMinor: number[]
}

export interface ContractorAccountingTotals {
  transportMinor: number
  materialMinor: number
  settlementsMinor: number
  balanceMinor: number
}

export function calculateContractorAccount(
  input: ContractorAccountingInput
): ContractorAccountingTotals {
  const tripAccounting = input.trips.map(calculateContractorTrip)
  const transportMinor = sumMinorUnits(tripAccounting.map((trip) => trip.transportMinor))
  const materialMinor = sumMinorUnits(tripAccounting.map((trip) => trip.materialMinor))
  const settlementsMinor = sumMinorUnits(input.settlementsMinor)
  return {
    transportMinor,
    materialMinor,
    settlementsMinor,
    balanceMinor: sumMinorUnits([
      input.openingBalanceMinor,
      transportMinor,
      materialMinor,
      -settlementsMinor
    ])
  }
}
