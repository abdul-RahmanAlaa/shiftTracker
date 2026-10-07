import type { TFunction } from 'i18next'

export function labelForReceiptStatus(t: TFunction, status: string): string {
  switch (status) {
    case 'PROVIDED':
      return t('tripForm.receiptStatuses.value')
    case 'CONFIRMED_MISSING':
      return t('tripForm.receiptStatuses.noReceiptConfirmed')
    case 'UNKNOWN':
    default:
      return t('tripForm.receiptStatuses.unknown')
  }
}

export function labelForRecipientNameStatus(t: TFunction, status: string): string {
  switch (status) {
    case 'PROVIDED':
      return t('tripForm.recipientNameStatuses.provided')
    case 'UNCLEAR':
    default:
      return t('tripForm.recipientNameStatuses.unclear')
  }
}

export function labelForMovementType(t: TFunction, movementType: string): string {
  switch (movementType) {
    case 'ADVANCE':
      return t('ledgerEntryForm.movementTypes.custody')
    case 'PAYMENT':
      return t('ledgerEntryForm.movementTypes.payment')
    case 'OTHER':
    default:
      return t('ledgerEntryForm.movementTypes.other')
  }
}
