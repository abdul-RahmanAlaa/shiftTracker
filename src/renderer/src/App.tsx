import { useState } from 'react'
import { HashRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { BookOpen, Calculator, ClipboardList, Settings, Truck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { SettingsPage } from '@/pages/SettingsPage'
import { ShiftsPage } from '@/pages/ShiftsPage'

export type AddLog = (message: string) => void

const navigationItems = [
  { to: '/', label: 'إضافة نقلة', icon: Truck },
  { to: '/shifts', label: 'الورديات', icon: ClipboardList },
  { to: '/ledger', label: 'سجل العهد والدفعات', icon: BookOpen },
  { to: '/accounts', label: 'الحسابات', icon: Calculator },
  { to: '/settings', label: 'بيانات أساسية', icon: Settings }
]

function PlaceholderPage(): React.JSX.Element {
  return <div className="flex min-h-64 items-center justify-center text-2xl text-muted-foreground">قريبًا</div>
}

function AppLayout(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([])

  function addLog(message: string): void {
    setLog((previous) => [message, ...previous])
  }

  return (
    <div className="app-shell" dir="rtl">
      <aside className="app-sidebar">
        <div className="border-b border-border px-5 py-6">
          <p className="text-lg font-semibold text-foreground">Shift Tracker</p>
          <p className="mt-1 text-sm text-muted-foreground">إدارة النقل والورديات</p>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="التنقل الرئيسي">
          {navigationItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive && 'bg-accent text-accent-foreground'
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="app-main">
        <div className="app-page">
          <Outlet context={{ addLog }} />
        </div>
        <Card className="app-log-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">السجل</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto pt-0">
            {log.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد عمليات بعد</p>
            ) : (
              <div className="space-y-2 text-sm">
                {log.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<PlaceholderPage />} />
          <Route path="shifts" element={<ShiftsPage />} />
          <Route path="ledger" element={<PlaceholderPage />} />
          <Route path="accounts" element={<PlaceholderPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
