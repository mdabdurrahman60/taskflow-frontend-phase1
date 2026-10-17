import {
  LayoutDashboard,
  CheckSquare,
  Users,
  FolderKanban,
  Columns3,
  LifeBuoy,
  Contact,
  Building2,
  ChartColumn,
  Settings,
} from 'lucide-react'
import { ROLE_KEYS } from '../data/roles'

// Single source of truth for the sidebar, breadcrumbs, route guards and search.
// `roles` decides which demo roles can see/open each page (simulation only).

const ALL = ROLE_KEYS

export const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { key: 'overview', path: '/', end: true, label: 'Overview', icon: LayoutDashboard, roles: ALL },
      { key: 'my-tasks', path: '/my-tasks', label: 'My Tasks', icon: CheckSquare, roles: ALL },
      {
        key: 'team-tasks',
        path: '/team-tasks',
        label: 'Team Tasks',
        labelByRole: { superadmin: 'Organization Tasks', admin: 'Department Tasks', hr: 'People Ops Tasks' },
        icon: Users,
        roles: ['superadmin', 'admin', 'manager', 'hr'],
      },
      { key: 'projects', path: '/projects', label: 'Projects', icon: FolderKanban, roles: ['superadmin', 'admin', 'manager', 'hr', 'executive'] },
      { key: 'kanban', path: '/kanban', label: 'Kanban Board', icon: Columns3, roles: ALL },
    ],
  },
  {
    label: 'Support',
    items: [{ key: 'helpdesk', path: '/helpdesk', label: 'Helpdesk', icon: LifeBuoy, roles: ALL }],
  },
  {
    label: 'Organization',
    items: [
      { key: 'employees', path: '/employees', label: 'Employees', icon: Contact, roles: ['superadmin', 'admin', 'manager', 'hr'] },
      { key: 'departments', path: '/departments', label: 'Departments', icon: Building2, roles: ['superadmin', 'admin'] },
      { key: 'reports', path: '/reports', label: 'Reports', icon: ChartColumn, roles: ['superadmin', 'admin', 'manager', 'hr', 'support'] },
      { key: 'employee-performance-reports', path: '/employee-performance-reports', label: 'Employee Performance Reports', icon: ChartColumn, roles: ['superadmin', 'admin', 'manager'] },
    ],
  },
  {
    label: 'System',
      items: [
        { key: 'settings', path: '/settings', label: 'Settings', icon: Settings, roles: ALL },
        { key: 'role-permissions', path: '/role-permissions', label: 'Role Permissions', icon: Settings, roles: ['superadmin', 'admin', 'manager', 'hr'] },
      ],
  },
]

/** Sidebar groups for a role, with role-specific labels resolved. */
export function getNavForRole(role) {
  return NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => item.roles.includes(role))
      .map((item) => ({ ...item, groupLabel: group.label, label: item.labelByRole?.[role] ?? item.label })),
  })).filter((group) => group.items.length > 0)
}

function matches(item, pathname) {
  if (item.path === '/') return pathname === '/'
  return pathname === item.path || pathname.startsWith(`${item.path}/`)
}

export function findNavItem(pathname) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((i) => matches(i, pathname))
    if (item) return { group, item }
  }
  return null
}

/** Unknown paths return true so the 404 page can handle them. */
export function canAccessPath(role, pathname) {
  const found = findNavItem(pathname)
  return found ? found.item.roles.includes(role) : true
}

export function getBreadcrumbs(pathname, role) {
  const found = findNavItem(pathname)
  if (!found) return [{ label: 'Page not found' }]
  const label = found.item.labelByRole?.[role] ?? found.item.label
  return [{ label: found.group.label }, { label }]
}
