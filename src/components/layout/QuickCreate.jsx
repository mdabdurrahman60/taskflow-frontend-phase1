import { ChevronDown, Contact, LifeBuoy, ListPlus, Plus } from 'lucide-react'
import Popover from '../ui/Popover'
import { useToast } from '../ui/useToast'
import { useApp } from '../../store/useApp'

const ITEMS = [
  { key: 'task', label: 'New task', hint: 'Create a task or subtask', icon: ListPlus, permission: 'task.create', phase: 3 },
  { key: 'ticket', label: 'New helpdesk ticket', hint: 'Ask IT, Facilities or Admin', icon: LifeBuoy, permission: 'ticket.create', phase: 6 },
  { key: 'employee', label: 'New employee', hint: 'Add a person to the directory', icon: Contact, permission: 'employee.create', phase: 7 },
]

export default function QuickCreate() {
  const { can } = useApp()
  const toast = useToast()
  const items = ITEMS.filter((i) => can(i.permission))

  // The create forms arrive in later phases; until then the menu is honest about it.
  const choose = (item, close) => {
    close()
    toast({ title: `${item.label} form`, description: `This form is built in Phase ${item.phase}.`, type: 'info' })
  }

  return (
    <Popover
      panelClassName="w-64"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex h-9 items-center gap-1.5 rounded-md border border-brand-600 bg-brand-600 pl-2.5 pr-2 text-[13px] font-medium text-white shadow-card transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Create</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden="true" />
        </button>
      )}
    >
      {({ close }) => (
        <ul className="p-1.5" role="menu">
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => choose(item, close)}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-surface-2"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-[13px] font-medium text-ink">{item.label}</span>
                  <span className="block text-xs text-muted">{item.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  )
}
