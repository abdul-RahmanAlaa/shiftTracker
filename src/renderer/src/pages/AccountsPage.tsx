import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AllMovementsPage } from '@/pages/accounts/AllMovementsPage'
import { ClientAccountPage } from '@/pages/accounts/ClientAccountPage'
import { ContractorAccountPage } from '@/pages/accounts/ContractorAccountPage'
import { DriverHistoryPage } from '@/pages/accounts/DriverHistoryPage'

type AccountsSection = 'contractor' | 'driver' | 'client' | 'all-movements'

const accountsItems: { id: AccountsSection; label: string }[] = [
  { id: 'contractor', label: 'accountsPage.sections.contractor' },
  { id: 'driver', label: 'accountsPage.sections.driver' },
  { id: 'client', label: 'accountsPage.sections.client' },
  { id: 'all-movements', label: 'accountsPage.sections.allMovements' }
]

export function AccountsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState<AccountsSection>('contractor')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('accountsPage.title')}</h1>
      <div className="settings-layout">
        <Card className="settings-menu">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('accountsPage.title')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {accountsItems.map((item) => (
              <Button
                key={item.id}
                variant={activeSection === item.id ? 'secondary' : 'ghost'}
                className={cn(
                  'w-full justify-start',
                  activeSection === item.id && 'text-secondary-foreground'
                )}
                onClick={() => setActiveSection(item.id)}
              >
                {t(item.label)}
              </Button>
            ))}
          </CardContent>
        </Card>
        <div className="min-w-0">
          {activeSection === 'contractor' && <ContractorAccountPage />}
          {activeSection === 'driver' && <DriverHistoryPage />}
          {activeSection === 'client' && <ClientAccountPage />}
          {activeSection === 'all-movements' && <AllMovementsPage />}
        </div>
      </div>
    </div>
  )
}
