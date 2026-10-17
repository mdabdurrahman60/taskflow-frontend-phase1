import { Check } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import { useToast } from '../ui/useToast'
import { useApp } from '../../store/useApp'
import { DEMO_USER_BY_ROLE } from '../../data/mockUsers'
import { ROLES, ROLE_KEYS } from '../../data/roles'
import { canAccessPath } from '../../utils/navigation'

/** The six demo roles. Selecting one logs the demo in as that role's sample user. */
export default function RoleList({ onSelected }) {
  const { role, users, switchRole } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const choose = (key) => {
    if (key === role) return onSelected?.()
    const demoUser = users.find((u) => u.id === DEMO_USER_BY_ROLE[key])
    switchRole(key)
    // If the new role cannot open the current page, return to the overview.
    if (!canAccessPath(key, pathname)) navigate('/')
    toast({ title: `Now viewing as ${ROLES[key].label}`, description: `${demoUser.name}, ${demoUser.title}`, type: 'info' })
    onSelected?.()
  }

  return (
    <ul className="p-1.5">
      {ROLE_KEYS.map((key) => {
        const demoUser = users.find((u) => u.id === DEMO_USER_BY_ROLE[key])
        const active = key === role
        return (
          <li key={key}>
            <button
              type="button"
              onClick={() => choose(key)}
              aria-current={active ? 'true' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                active ? 'bg-brand-50' : 'hover:bg-surface-2'
              }`}
            >
              <Avatar user={demoUser} size="md" />
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-medium ${active ? 'text-brand-700' : 'text-ink'}`}>{ROLES[key].label}</span>
                <span className="block truncate text-xs text-muted">{demoUser.name}</span>
              </span>
              {active && <Check className="h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
