import { HashRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import {
  BookOpen,
  Calculator,
  ClipboardList,
  List,
  Settings,
  Truck,
  UploadCloud
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FloatingWindowsProvider } from '@/components/FloatingWindowsProvider'
import { cn } from '@/lib/utils'
import { AddTripPage } from '@/pages/AddTripPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { LedgerPage } from '@/pages/LedgerPage'
import { ImportPage } from '@/pages/ImportPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ShiftsPage } from '@/pages/ShiftsPage'
import { AllTripsPage } from '@/pages/AllTripsPage'

const navigationItems = [
  { to: '/', label: 'إضافة نقلة', icon: Truck },
  { to: '/shifts', label: 'الورديات', icon: ClipboardList },
  { to: '/all-trips', label: 'كل النقلات', icon: List },
  { to: '/ledger', label: 'سجل العهد والدفعات', icon: BookOpen },
  { to: '/accounts', label: 'الحسابات', icon: Calculator },
  { to: '/settings', label: 'بيانات أساسية', icon: Settings },
  { to: '/import', label: 'استيراد بيانات', icon: UploadCloud }
]

function AppLayout(): React.JSX.Element {
  return (
    <div className="app-shell" dir="rtl">
      <header className="app-navbar">
        <div className="app-navbar-brand">
          <p className="text-lg font-semibold text-foreground">Shift Tracker</p>
          <p className="mt-1 text-sm text-muted-foreground">إدارة النقل والورديات</p>
        </div>
        <nav className="app-navbar-nav" aria-label="التنقل الرئيسي">
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
                <span>{label}</span>
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
            <Route path="all-trips" element={<AllTripsPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </FloatingWindowsProvider>
    </HashRouter>
  )
}

export default App
