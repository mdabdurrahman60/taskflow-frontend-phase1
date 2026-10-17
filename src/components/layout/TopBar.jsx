import { useState } from 'react'
import { Menu, Search, X } from 'lucide-react'
import Breadcrumbs from './Breadcrumbs'
import GlobalSearch from './GlobalSearch'
import NotificationBell from './NotificationBell'
import ProfileMenu from './ProfileMenu'
import QuickCreate from './QuickCreate'
import RoleSwitcher from './RoleSwitcher'

export default function TopBar({ onMenu }) {
  const [mobileSearch, setMobileSearch] = useState(false)

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-3 sm:px-4 lg:px-6">
      <button
        type="button"
        onClick={onMenu}
        className="rounded-md p-2 text-ink-2 hover:bg-surface-2 lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1 md:flex-none lg:w-56 lg:shrink-0">
        <Breadcrumbs />
      </div>

      <div className="mx-auto hidden w-full max-w-md md:block">
        <GlobalSearch hotkey />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => setMobileSearch(true)}
          className="rounded-md p-2 text-ink-2 hover:bg-surface-2 md:hidden"
          aria-label="Search"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
        <RoleSwitcher />
        <QuickCreate />
        <NotificationBell />
        <ProfileMenu />
      </div>

      {mobileSearch && (
        <div className="absolute inset-0 z-40 flex items-center gap-2 bg-white px-3 md:hidden">
          <GlobalSearch autoFocus onDone={() => setMobileSearch(false)} />
          <button
            type="button"
            onClick={() => setMobileSearch(false)}
            className="rounded-md p-2 text-ink-2 hover:bg-surface-2"
            aria-label="Close search"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </header>
  )
}
