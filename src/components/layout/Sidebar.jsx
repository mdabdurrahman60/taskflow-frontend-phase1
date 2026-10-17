import { NavLink } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useApp } from '../../store/useApp'
import { getNavForRole } from '../../utils/navigation'
import { describeScope } from '../../utils/scope'

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-card">
        <img src="/favicon.svg" alt="MIT TaskFlow Logo" className="h-4.5 w-4.5" /> 
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">MIT TaskFlow</span>
    </div>
  )
}

export default function Sidebar({ onClose }) {
  const { role, currentUser, departments } = useApp()
  const groups = getNavForRole(role)

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Logo />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4 pt-2">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ key, path, end, label, icon: Icon }) => (
                <li key={key}>
                  <NavLink
                    to={path}
                    end={end}
                    className={({ isActive }) =>
                      `group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors ${
                        isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r bg-brand-600" aria-hidden="true" />}
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-brand-600' : 'text-muted group-hover:text-ink-2'}`} aria-hidden="true" />
                        <span className="truncate">{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-line p-3">
        <div className="rounded-md bg-surface px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Your scope</p>
          <p className="mt-0.5 truncate text-[13px] font-medium text-ink" title={describeScope(currentUser, departments)}>
            {describeScope(currentUser, departments)}
          </p>
        </div>
      </div>
    </div>
  )
}
