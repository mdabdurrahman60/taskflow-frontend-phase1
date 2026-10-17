import { Bell, CheckCheck, Clock, LifeBuoy, ListChecks, MessageSquare, TriangleAlert, Info } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Popover from '../ui/Popover'
import { useApp } from '../../store/useApp'
import { timeAgo } from '../../utils/dates'

const TYPE_ICONS = {
  task: ListChecks,
  comment: MessageSquare,
  ticket: LifeBuoy,
  deadline: Clock,
  escalation: TriangleAlert,
  system: Info,
}

export default function NotificationBell() {
  const { notifications, unreadCount, markNotificationRead, markAllRead } = useApp()
  const navigate = useNavigate()

  return (
    <Popover
      panelClassName="w-[22rem]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          className={`relative flex h-9 w-9 items-center justify-center rounded-md border text-ink-2 transition-colors hover:bg-surface-2 ${
            open ? 'border-line bg-surface-2' : 'border-transparent'
          }`}
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <div>
              <h2 className="text-[13px] font-semibold text-ink">Notifications</h2>
              <p className="text-xs text-muted">{unreadCount ? `${unreadCount} unread` : 'You are all caught up'}</p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-faint disabled:hover:bg-transparent"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-muted">No notifications yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line-soft overflow-y-auto">
              {notifications.map((n) => {
                const Icon = TYPE_ICONS[n.type] ?? Info
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        markNotificationRead(n.id)
                        close()
                        navigate(n.link)
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${n.read ? '' : 'bg-brand-50/40'}`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          n.type === 'escalation' ? 'bg-brand-50 text-brand-600' : 'bg-surface-2 text-muted'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className={`text-[13px] ${n.read ? 'font-medium text-ink-2' : 'font-semibold text-ink'}`}>{n.title}</span>
                          {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted">{n.body}</span>
                        <span className="mt-1 block text-[11px] text-faint">{timeAgo(n.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </Popover>
  )
}
