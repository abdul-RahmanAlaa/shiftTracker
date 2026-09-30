import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function ShiftBreadcrumb({ currentPage }: { currentPage: string }): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('shifts.breadcrumb')} className="flex items-center gap-2 text-sm">
      <Button asChild variant="link" className="h-auto p-0">
        <Link to="/shifts">{t('shifts.title')}</Link>
      </Button>
      <span aria-hidden="true" className="text-muted-foreground">
        /
      </span>
      <span className="text-muted-foreground">{currentPage}</span>
    </nav>
  )
}
