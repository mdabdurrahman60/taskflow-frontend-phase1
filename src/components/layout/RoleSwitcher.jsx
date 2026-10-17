import { ChevronDown, Repeat2 } from 'lucide-react'
import Popover from '../ui/Popover'
import RoleList from './RoleList'
import { useApp } from '../../store/useApp'

/** The visible Demo Role Switcher in the top bar. */
export default function RoleSwitcher() {
  const { roleInfo } = useApp()
  return (
    <Popover
      panelClassName="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex h-9 items-center gap-2 rounded-md border border-brand-200 bg-brand-50 px-2.5 text-[13px] font-medium text-brand-700 transition-colors hover:bg-brand-100"
        >
          <Repeat2 className="h-4 w-4" aria-hidden="true" />
          <span className="hidden text-xs font-normal text-brand-700/80 xl:inline">Demo role</span>
          <span className="hidden sm:inline">{roleInfo.label}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="border-b border-line-soft px-3.5 py-2.5">
            <p className="text-[13px] font-semibold text-ink">Switch demo role</p>
            <p className="text-xs text-muted">See TaskFlow through each role's eyes.</p>
          </div>
          <RoleList onSelected={close} />
        </>
      )}
    </Popover>
  )
}
