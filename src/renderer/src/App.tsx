import { HashRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, Calculator, ClipboardList, List, Settings, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingWindowsProvider } from '@/components/FloatingWindowsProvider'
import { cn } from '@/lib/utils'
import { AddTripPage } from '@/pages/AddTripPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ShiftsPage } from '@/pages/ShiftsPage'
import { ShiftDetailPage } from '@/pages/ShiftDetailPage'
import { AllTripsPage } from '@/pages/AllTripsPage'
import { StatementsPage } from '@/pages/StatementsPage'

const navigationItems = [
  { to: '/', label: 'addTrip.title', icon: Truck },
  { to: '/shifts', label: 'shifts.title', icon: ClipboardList },
  { to: '/all-trips', label: 'allTrips.title', icon: List },
  { to: '/accounts', label: 'accountsPage.title', icon: Calculator },
  { to: '/statements', label: 'statementsPage.title', icon: BookOpen },
  { to: '/settings', label: 'settingsPage.title', icon: Settings }
]

function AppLayout(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="app-shell" dir="rtl">
      <header className="app-navbar">
        <div className="app-navbar-brand">
          <p className="text-lg font-semibold text-foreground">{t('app.name')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('app.subtitle')}</p>
        </div>
        <nav className="app-navbar-nav" aria-label={t('app.navigationLabel')}>
          {navigationItems.map(({ to, label, icon: Icon }) => (
            <Button key={to} asChild variant="ghost" className="w-auto justify-start gap-2">
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground',
                    isActive && 'bg-secondary text-secondary-foreground'
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{t(label)}</span>
              </NavLink>
            </Button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <div className="app-page">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <FloatingWindowsProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<AddTripPage />} />
            <Route path="shifts" element={<ShiftsPage />} />
            <Route path="shifts/:shiftId" element={<ShiftDetailPage />} />
            <Route path="all-trips" element={<AllTripsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="statements" element={<StatementsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </FloatingWindowsProvider>
    </HashRouter>
  )
}

export default App
