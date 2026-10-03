import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ClientsSettings } from '@/pages/settings/ClientsSettings'
import { ContractorsSettings } from '@/pages/settings/ContractorsSettings'
import { CrushersSettings } from '@/pages/settings/CrushersSettings'
import { DriversSettings } from '@/pages/settings/DriversSettings'
import { MaterialTypesSettings } from '@/pages/settings/MaterialTypesSettings'
import { VehiclesSettings } from '@/pages/settings/VehiclesSettings'

type SettingsSection =
  'vehicles' | 'drivers' | 'contractors' | 'crushers' | 'clients' | 'materialTypes'

const settingsItems: { id: SettingsSection; label: string }[] = [
  { id: 'vehicles', label: 'settingsPage.sections.vehicles' },
  { id: 'drivers', label: 'settingsPage.sections.drivers' },
  { id: 'contractors', label: 'settingsPage.sections.contractors' },
  { id: 'crushers', label: 'settingsPage.sections.crushers' },
  { id: 'clients', label: 'settingsPage.sections.clients' },
  { id: 'materialTypes', label: 'settingsPage.sections.materialTypes' }
]

export function SettingsPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState<SettingsSection>('vehicles')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('settingsPage.title')}</h1>
      <div className="settings-layout">
        <Card className="settings-menu">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('settingsPage.title')}</CardTitle>
          </CardHeader>
          <CardContent className="settings-navigation flex flex-col gap-1">
            {settingsItems.map((item) => (
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
          {activeSection === 'vehicles' && <VehiclesSettings />}
          {activeSection === 'drivers' && <DriversSettings />}
          {activeSection === 'contractors' && <ContractorsSettings />}
          {activeSection === 'crushers' && <CrushersSettings />}
          {activeSection === 'clients' && <ClientsSettings />}
          {activeSection === 'materialTypes' && <MaterialTypesSettings />}
        </div>
      </div>
    </div>
  )
}
