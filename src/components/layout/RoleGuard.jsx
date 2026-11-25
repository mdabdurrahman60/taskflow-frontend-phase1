import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../ui/Button'
import { useApp } from '../../store/useApp'
import { NAV_GROUPS } from '../../utils/navigation'

/**
 * Provides route-level UX guidance; the backend independently authorizes API requests.
 */
export default function RoleGuard({ pageKey, children }) {
  const { role, roleInfo } = useApp()
  const item = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === pageKey)

  if (item && !item.roles.includes(role)) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Lock className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-semibold text-ink">Access restricted</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          The {roleInfo.label} role cannot open {item.label}. Contact an administrator if you need access.
        </p>
        <Link to="/" className="mt-5 inline-block">
          <Button variant="primary">Back to Overview</Button>
        </Link>
      </div>
    )
  }
  return children
}
