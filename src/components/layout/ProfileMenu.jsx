import { ChevronDown, RotateCcw, Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import Badge from '../ui/Badge'
import Popover from '../ui/Popover'
import { useToast } from '../ui/useToast'
import RoleList from './RoleList'
import { useApp } from '../../store/useApp'

export default function ProfileMenu() {
  const { currentUser, roleInfo, department, resetDemo } = useApp()
  const toast = useToast()
  const navigate = useNavigate()

  return (
    <Popover
      panelClassName="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className={`flex h-9 items-center gap-2 rounded-md border pl-1 pr-1.5 transition-colors hover:bg-surface-2 ${
            open ? 'border-line bg-surface-2' : 'border-transparent'
          }`}
        >
          <Avatar user={currentUser} size="md" />
          <span className="hidden min-w-0 text-left leading-tight xl:block">
            <span className="block max-w-[9rem] truncate text-[13px] font-medium text-ink">{currentUser.name}</span>
            <span className="block text-[11px] text-muted">{roleInfo.label}</span>
          </span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-faint xl:block" aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-3 border-b border-line-soft px-4 py-3.5">
            <Avatar user={currentUser} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{currentUser.name}</p>
              <p className="truncate text-xs text-muted">{currentUser.title}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Badge tone="red">{roleInfo.label}</Badge>
                <span className="truncate text-xs text-muted">{department?.name}</span>
              </div>
            </div>
          </div>

          <div className="border-b border-line-soft">
            <p className="px-4 pb-0 pt-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">Demo role</p>
            <RoleList onSelected={close} />
          </div>

          <ul className="p-1.5" role="menu">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  close()
                  navigate('/settings')
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2"
              >
                <Settings className="h-4 w-4 text-muted" aria-hidden="true" />
                Settings
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  resetDemo()
                  close()
                  toast({ title: 'Demo data reset', description: 'All sample data is back to its starting state.' })
                }}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2"
              >
                <RotateCcw className="h-4 w-4 text-muted" aria-hidden="true" />
                Reset demo data
              </button>
            </li>
          </ul>
        </>
      )}
    </Popover>
  )
}
