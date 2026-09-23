import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AddLog } from '@/App'
import { ContractorsSettings } from '@/pages/settings/ContractorsSettings'
import { DriversSettings } from '@/pages/settings/DriversSettings'
import { VehiclesSettings } from '@/pages/settings/VehiclesSettings'

type SettingsSection = 'vehicles' | 'drivers' | 'contractors'

const settingsItems: { id: SettingsSection; label: string }[] = [
  { id: 'vehicles', label: 'العربيات' },
  { id: 'drivers', label: 'السائقون' },
  { id: 'contractors', label: 'المقاولون' }
]

export function SettingsPage(): React.JSX.Element {
  const { addLog } = useOutletContext<{ addLog: AddLog }>()
  const [activeSection, setActiveSection] = useState<SettingsSection>('vehicles')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">بيانات أساسية</h1>
      <div className="settings-layout">
        <Card className="settings-menu">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">بيانات أساسية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {settingsItems.map((item) => (
              <Button
                key={item.id}
                variant={activeSection === item.id ? 'secondary' : 'ghost'}
                className={cn('w-full justify-start', activeSection === item.id && 'text-secondary-foreground')}
                onClick={() => setActiveSection(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="min-w-0">
          {activeSection === 'vehicles' && <VehiclesSettings addLog={addLog} />}
          {activeSection === 'drivers' && <DriversSettings addLog={addLog} />}
          {activeSection === 'contractors' && <ContractorsSettings addLog={addLog} />}
        </div>
      </div>
    </div>
  )
}
