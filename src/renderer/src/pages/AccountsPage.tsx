import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AllMovementsPage } from '@/pages/accounts/AllMovementsPage'
import { ClientAccountPage } from '@/pages/accounts/ClientAccountPage'
import { ContractorAccountPage } from '@/pages/accounts/ContractorAccountPage'
import { DriverHistoryPage } from '@/pages/accounts/DriverHistoryPage'

type AccountsSection = 'contractor' | 'driver' | 'client' | 'all-movements'

const accountsItems: { id: AccountsSection; label: string }[] = [
  { id: 'contractor', label: 'حساب المقاول' },
  { id: 'driver', label: 'سجل السائق' },
  { id: 'client', label: 'حساب العميل' },
  { id: 'all-movements', label: 'كل الحركات' }
]

export function AccountsPage(): React.JSX.Element {
  const [activeSection, setActiveSection] = useState<AccountsSection>('contractor')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">الحسابات</h1>
      <div className="settings-layout">
        <Card className="settings-menu">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">الحسابات</CardTitle>
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
                {item.label}
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
