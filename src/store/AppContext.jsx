import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { AppContext } from './appContext'
import { clearTaskIdentities, clearTicketIdentities, sanitizeLegacyAppState } from './legacyDataCleanup.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiClient } from '../api/apiClient.js'
import { ROLES } from '../data/roles'
import { can as canRole } from '../utils/permissions'
import {
  canAssignSubtask,
  canAssignTicket,
  canAssignTask,
  canChangeTaskDepartment,
  canChangeTaskStatus,
  canChangeTicketDepartment,
  canCreateTicket,
  canCreateSubtask,
  canCreateTask,
  canDeleteTask as checkCanDeleteTask,
  canEscalateTicket,
  canEditTask,
  canReassignTask,
  canUpdateTicket,
  canViewTask,
  canViewTicket,
} from '../permissions/taskPermissions'
import {
  canAssociateTaskWithProject,
  canManageProject,
  eligibleProjectManagers,
  eligibleProjectMembers,
} from '../permissions/projectPermissions'
import { daysFromNow, hoursAgo, minutesAgo, toISODate } from '../utils/dates'

const STORAGE_KEY = 'taskflow.demo.state.v1'
const DATA_CLEANUP_KEY = 'taskflow.demo.data-cleanup.v1'

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function makeUniqueId(prefix, records) {
  const usedIds = new Set(records.map((record) => record.id))
  let id = makeId(prefix)
  while (usedIds.has(id)) id = makeId(prefix)
  return id
}

function validProjectDate(value) {
  if (!value) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function cleanLegacyLocalData() {
  try {
    if (localStorage.getItem(DATA_CLEANUP_KEY) === '1') return
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeLegacyAppState(parsed)))
      }
    }
    localStorage.removeItem('taskflow.demo.userId')
    localStorage.setItem(DATA_CLEANUP_KEY, '1')
  } catch {
    // Keep the app usable when browser storage is unavailable or contains invalid legacy data.
  }
}

function readStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const requiredCollections = ['tasks', 'tickets', 'projects']
    if (!parsed || requiredCollections.some((key) => !Array.isArray(parsed[key]))) return null
    if (parsed.tasks.some((task) => !task?.id || !task?.title)) return null
    if (parsed.tickets.some((ticket) => !ticket?.id || !ticket?.title)) return null

    return {
      ...parsed,
      currentUserId: null,
      users: [],
      departments: [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      activity: Array.isArray(parsed.activity) ? parsed.activity : [],
      projects: normalizeStoredProjects(parsed.projects, [], parsed.tasks),
      tasks: parsed.tasks.map((task) => ({ ...task, comments: Array.isArray(task.comments) ? task.comments : [], subtasks: Array.isArray(task.subtasks) ? task.subtasks : [] })),
      tickets: parsed.tickets.map((ticket) => ({ ...ticket, updates: Array.isArray(ticket.updates) ? ticket.updates : [] })),
    }
  } catch {
    return null
  }
}

function buildInitialTasks() {
  return [
    {
      id: 'T-2201',
      title: 'Prepare Product Launch Campaign',
      description: 'Coordinate campaign assets, copy, assets and launch scheduling for the next product release.',
      status: 'In Progress',
      priority: 'High',
      projectId: 'p-launch',
      dueDate: daysFromNow(3),
      createdAt: hoursAgo(22),
      comments: [
        { id: 'c-1', text: 'Let us keep the launch checklist aligned with the sales push.', createdAt: hoursAgo(7) },
        { id: 'c-2', text: 'I am coordinating the copy and brief with the design crew.', createdAt: hoursAgo(2) },
      ],
      subtasks: [
        { id: 'S-101', title: 'Prepare product images', status: 'Completed', priority: 'High', dueDate: daysFromNow(-1), description: 'Prepare final visuals for campaign landing and social assets.', createdAt: hoursAgo(18), comments: [{ id: 'c-11', text: 'The selected visuals are on track.', createdAt: hoursAgo(5) }] },
        { id: 'S-102', title: 'Write product descriptions', status: 'In Progress', priority: 'High', dueDate: daysFromNow(2), description: 'Draft a concise product overview and feature highlights.', createdAt: hoursAgo(16), comments: [] },
        { id: 'S-103', title: 'Prepare social media captions', status: 'To Do', priority: 'Medium', dueDate: daysFromNow(4), description: 'Create platform-specific captions for launch week.', createdAt: hoursAgo(10), comments: [] },
        { id: 'S-104', title: 'Review campaign materials', status: 'In Review', priority: 'Medium', dueDate: daysFromNow(1), description: 'Approve all campaign copy and art direction.', createdAt: hoursAgo(9), comments: [] },
      ],
    },
    {
      id: 'T-2202',
      title: 'Finalize vendor onboarding pack',
      description: 'Tighten the procurement checklist and share onboarding docs with the finance and ops teams.',
      status: 'Backlog',
      priority: 'Medium',
      projectId: 'p-partners',
      dueDate: daysFromNow(9),
      createdAt: hoursAgo(26),
      comments: [],
      subtasks: [],
    },
    {
      id: 'T-2203',
      title: 'Release security patch review',
      description: 'Review the production vulnerability backlog before the final release cut.',
      status: 'In Review',
      priority: 'Critical',
      projectId: 'p-platform',
      dueDate: daysFromNow(-2),
      createdAt: hoursAgo(30),
      comments: [{ id: 'c-3', text: 'QA sign-off is in progress for this patch.', createdAt: hoursAgo(5) }],
      subtasks: [
        { id: 'S-201', title: 'Validate patch notes', status: 'Completed', priority: 'Critical', dueDate: daysFromNow(-3), description: 'Verify the patch summary matches the release notes.', createdAt: hoursAgo(40), comments: [] },
        { id: 'S-202', title: 'Confirm deployment checklist', status: 'Blocked', priority: 'High', dueDate: daysFromNow(1), description: 'Confirm rollback and staging readiness before deployment.', createdAt: hoursAgo(36), comments: [] },
      ],
    },
    {
      id: 'T-2204',
      title: 'Quarterly forecasting cleanup',
      description: 'Review forecasts and reconcile variance assumptions for the end-of-quarter report.',
      status: 'Completed',
      priority: 'Medium',
      projectId: 'p-finance',
      dueDate: daysFromNow(-4),
      createdAt: hoursAgo(80),
      comments: [],
      subtasks: [],
    },
    {
      id: 'T-2205',
      title: 'Employee onboarding checklist',
      description: 'Complete all documentation and setup for the next cohort of new hires.',
      status: 'To Do',
      priority: 'High',
      projectId: 'p-people',
      dueDate: daysFromNow(6),
      createdAt: hoursAgo(54),
      comments: [],
      subtasks: [],
    },
    {
      id: 'T-2206',
      title: 'Laptop replacement review',
      description: 'Review the current device stock and finalize the replacement timeline for the support queue.',
      status: 'Blocked',
      priority: 'High',
      projectId: 'p-it',
      dueDate: daysFromNow(1),
      createdAt: hoursAgo(18),
      comments: [{ id: 'c-4', text: 'We need three additional approvals before we can order equipment.', createdAt: hoursAgo(2) }],
      subtasks: [],
    },
  ]
}

function buildInitialTickets() {
  return [
    {
      id: 'TKT-1041',
      title: 'VPN access is not working on my laptop',
      description: 'The VPN client keeps disconnecting after login. I need access for the weekend installation work.',
      status: 'In Progress',
      priority: 'High',
      createdAt: hoursAgo(8),
      updates: [
        { id: 'u-1', type: 'public', message: 'I am reviewing the VPN logs and checking the affected access profile.', createdAt: hoursAgo(5) },
        { id: 'u-2', type: 'internal', message: 'This is likely tied to certificate rotation for the engineering VPN profile.', createdAt: hoursAgo(4) },
      ],
      relatedTaskId: null,
    },
    {
      id: 'TKT-1042',
      title: 'Request for conference room booking changes',
      description: 'The room booking system needs updated equipment and access timing for the weekly ops sync.',
      status: 'Triaged',
      priority: 'Medium',
      createdAt: hoursAgo(26),
      updates: [{ id: 'u-3', type: 'public', message: 'Thanks, I have passed this to the office admin team for review.', createdAt: hoursAgo(20) }],
      relatedTaskId: null,
    },
    {
      id: 'TKT-1043',
      title: 'Access request for new contractor',
      description: 'Please create access to the project board, email and shared drive for the contractor who starts Tuesday.',
      status: 'Waiting for Requester',
      priority: 'Medium',
      createdAt: hoursAgo(4),
      updates: [{ id: 'u-4', type: 'public', message: 'I need the contractor identity and the access dates before I can finalize the setup.', createdAt: minutesAgo(15) }],
      relatedTaskId: null,
    },
    {
      id: 'TKT-1044',
      title: 'Campaign asset export is failing',
      description: 'The design export process is failing when we generate the final social files from the campaign library.',
      status: 'Escalated',
      priority: 'High',
      createdAt: hoursAgo(9),
      updates: [{ id: 'u-5', type: 'internal', message: 'Escalating to engineering because the export timing issue is happening on the new asset pipeline.', createdAt: hoursAgo(3) }],
      relatedTaskId: null,
    },
  ]
}

function buildInitialProjects() {
  return [
    { id: 'p-launch', name: 'Product Launch', description: 'Coordinate campaign assets and launch scheduling.', priority: 'High', status: 'Active', startDate: daysFromNow(-14), deadline: daysFromNow(30), color: '#DC2626' },
    { id: 'p-platform', name: 'Platform Release', description: 'Prepare and deliver the next platform release.', priority: 'Critical', status: 'Active', startDate: daysFromNow(-10), deadline: daysFromNow(21), color: '#2563EB' },
    { id: 'p-people', name: 'People Ops', description: 'Coordinate people operations initiatives.', priority: 'Medium', status: 'Planning', startDate: daysFromNow(1), deadline: daysFromNow(45), color: '#7C3AED' },
    { id: 'p-it', name: 'IT Modernization', description: 'Improve internal systems and IT operations.', priority: 'High', status: 'Active', startDate: daysFromNow(-20), deadline: daysFromNow(60), color: '#0891B2' },
    { id: 'p-finance', name: 'Finance Review', description: 'Review financial operations and reporting.', priority: 'Low', status: 'Completed', startDate: daysFromNow(-60), deadline: daysFromNow(-2), color: '#16A34A' },
    { id: 'p-partners', name: 'Vendor Onboarding', description: 'Streamline partner and vendor onboarding.', priority: 'Medium', status: 'Active', startDate: daysFromNow(-5), deadline: daysFromNow(35), color: '#D97706' },
  ]
}

function normalizeStoredProjects(projects, users, tasks) {
  return projects.map((project) => {
    const projectManagerId = project.projectManagerId || project.ownerId || null
    const linkedTasks = tasks.filter((task) => task.projectId === project.id)
    const departmentId = project.departmentId
      || users.find((user) => user.id === projectManagerId)?.departmentId
      || linkedTasks[0]?.departmentId
      || ''
    return {
      ...project,
      projectManagerId,
      ownerId: project.ownerId || projectManagerId,
      teamMemberIds: Array.isArray(project.teamMemberIds)
        ? project.teamMemberIds
        : [...new Set(linkedTasks.map((task) => task.assigneeId).filter(Boolean))],
      departmentId,
      priority: project.priority || 'Medium',
      status: project.status === 'Closed' ? 'Completed' : (project.status || 'Planning'),
      startDate: project.startDate || '',
      deadline: project.deadline || '',
      description: project.description || '',
    }
  })
}

function createInitialState() {
  const tasks = clearTaskIdentities(buildInitialTasks())
  const tickets = clearTicketIdentities(buildInitialTickets())
  const base = {
    currentUserId: null,
    users: [],
    departments: [],
    tasks,
    tickets,
    notifications: [],
    activity: [],
    projects: buildInitialProjects().map((project) => ({
      ...project,
      projectManagerId: null,
      ownerId: null,
      teamMemberIds: [],
      departmentId: null,
    })),
  }

  return base
}

function readInitialState() {
  cleanLegacyLocalData()
  const stored = readStoredState()
  return stored || createInitialState()
}

function sortByPriority(priority) {
  return { Critical: 4, High: 3, Medium: 2, Low: 1 }[priority] ?? 0
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_STATE':
      return action.state
    case 'SET_DIRECTORY':
      return { ...state, users: action.users, departments: action.departments }
    case 'UPDATE_TASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.id ? { ...task, ...action.changes } : task)),
      }
    }
    case 'ADD_TASK': {
      return {
        ...state,
        tasks: [action.task, ...state.tasks],
      }
    }
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((task) => task.id !== action.id),
      }
    case 'UPDATE_SUBTASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.taskId) return task
          return {
            ...task,
            subtasks: task.subtasks.map((subtask) => (subtask.id === action.subtaskId ? { ...subtask, ...action.changes } : subtask)),
          }
        }),
      }
    }
    case 'ADD_SUBTASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.taskId ? { ...task, subtasks: [...task.subtasks, action.subtask] } : task)),
      }
    }
    case 'DELETE_SUBTASK': {
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.taskId ? { ...task, subtasks: task.subtasks.filter((subtask) => subtask.id !== action.subtaskId) } : task)),
      }
    }
    case 'ADD_TASK_COMMENT': {
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.taskId ? { ...task, comments: [...task.comments, action.comment] } : task)),
      }
    }
    case 'ADD_SUBTASK_COMMENT': {
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (task.id !== action.taskId) return task
          return {
            ...task,
            subtasks: task.subtasks.map((subtask) => (subtask.id === action.subtaskId ? { ...subtask, comments: [...(subtask.comments || []), action.comment] } : subtask)),
          }
        }),
      }
    }
    case 'ADD_TICKET':
      return { ...state, tickets: [action.ticket, ...state.tickets] }
    case 'UPDATE_TICKET': {
      return {
        ...state,
        tickets: state.tickets.map((ticket) => (ticket.id === action.id ? { ...ticket, ...action.changes } : ticket)),
      }
    }
    case 'ADD_TICKET_UPDATE': {
      return {
        ...state,
        tickets: state.tickets.map((ticket) => (ticket.id === action.ticketId ? { ...ticket, updates: [...(ticket.updates || []), action.update] } : ticket)),
      }
    }
    case 'ADD_PROJECT':
      return { ...state, projects: [action.project, ...state.projects] }
    case 'UPDATE_PROJECT':
      return { ...state, projects: state.projects.map((project) => (project.id === action.id ? { ...project, ...action.changes } : project)) }
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((project) => project.id !== action.id),
        tasks: state.tasks.map((task) => (task.projectId === action.id ? { ...task, projectId: null } : task)),
      }
    case 'ADD_ACTIVITY':
      return {
        ...state,
        activity: [action.entry, ...state.activity].slice(0, 50),
      }
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.notification, ...state.notifications],
      }
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      }
    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.userId === action.userId ? { ...n, read: true } : n)),
      }
    case 'RESET_DEMO':
      return { ...createInitialState(), users: state.users, departments: state.departments }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, readInitialState)
  const { user: authenticatedUser } = useAuth()
  const [directoryError, setDirectoryError] = useState('')
  const [directoryLoading, setDirectoryLoading] = useState(false)

  const persist = useCallback((nextState) => {
    try {
      const prototypeState = { ...nextState }
      delete prototypeState.users
      delete prototypeState.departments
      delete prototypeState.currentUserId
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prototypeState))
    } catch {
      // Browser storage may be unavailable.
    }
  }, [])

  const refreshDirectory = useCallback(async () => {
    if (!authenticatedUser) {
      dispatch({ type: 'SET_DIRECTORY', users: [], departments: [] })
      setDirectoryError('')
      setDirectoryLoading(false)
      return []
    }

    setDirectoryError('')
    setDirectoryLoading(true)
    try {
      const canReadDepartments = ['SUPERADMIN', 'ADMIN', 'MANAGER', 'HR'].includes(String(authenticatedUser.role).toUpperCase())
      const [response, departmentsResponse] = await Promise.all([
        apiClient.employees.list(),
        canReadDepartments ? apiClient.departments.list() : Promise.resolve({ data: [] }),
      ])
      if (!Array.isArray(response?.data)) throw new Error('The employee list response was invalid.')
      if (!Array.isArray(departmentsResponse?.data)) throw new Error('The department list response was invalid.')
      const users = response.data.map((employee) => ({
        ...employee,
        role: String(employee.role || '').toLowerCase(),
        status: String(employee.status || '').toUpperCase() === 'ACTIVE'
          ? 'Active'
          : String(employee.status || '').toUpperCase() === 'INACTIVE' ? 'Inactive' : 'On Leave',
        department: employee.department ?? null,
        departmentId: employee.departmentId ?? employee.department?.id ?? null,
      }))
      const departments = departmentsResponse.data.sort((left, right) => left.name.localeCompare(right.name))
      dispatch({ type: 'SET_DIRECTORY', users, departments })
      return users
    } catch (error) {
      dispatch({ type: 'SET_DIRECTORY', users: [], departments: [] })
      setDirectoryError(error instanceof Error ? error.message : 'The employee directory could not be loaded.')
      throw error
    } finally {
      setDirectoryLoading(false)
    }
  }, [authenticatedUser])

  useEffect(() => {
    refreshDirectory().catch(() => {})
  }, [refreshDirectory])

  const currentUser = useMemo(() => {
    if (!authenticatedUser) return null
    return {
      ...authenticatedUser,
      role: authenticatedUser.role.toLowerCase(),
      status: authenticatedUser.status === 'ACTIVE' ? 'Active' : authenticatedUser.status === 'INACTIVE' ? 'Inactive' : 'On Leave',
      scopeDepartmentIds: authenticatedUser.departmentScopeIds?.length
        ? authenticatedUser.departmentScopeIds
        : undefined,
    }
  }, [authenticatedUser])
  const role = currentUser?.role ?? 'executive'

  const markNotificationRead = useCallback((id) => {
    const notification = state.notifications.find((item) => item.id === id)
    if (!notification || notification.userId !== currentUser?.id) return false
    dispatch({ type: 'MARK_NOTIFICATION_READ', id })
    return true
  }, [currentUser?.id, state.notifications])
  const markAllRead = useCallback(() => dispatch({ type: 'MARK_ALL_READ', userId: currentUser?.id }), [currentUser?.id])
  const resetDemo = useCallback(() => dispatch({ type: 'RESET_DEMO' }), [])

  const updateTask = useCallback((id, changes) => {
    const task = state.tasks.find((item) => item.id === id)
    if (!task || !canEditTask(currentUser, task).allowed) return false
    if (['id', 'creatorId', 'reporterId', 'createdAt', 'sourceTicketId', 'comments', 'subtasks'].some((key) => key in changes)) return false
    if (changes.parentTaskId) return false
    const projectId = changes.projectId === '' ? null : (changes.projectId ?? task.projectId)
    if (projectId) {
      const project = state.projects.find((item) => item.id === projectId)
      const departmentId = changes.departmentId ?? task.departmentId
      if (!canAssociateTaskWithProject(currentUser, project, departmentId)) return false
    }
    if (changes.status !== undefined && changes.status !== task.status && !canChangeTaskStatus(currentUser, task).allowed) return false
    if (changes.assigneeId !== undefined && changes.assigneeId !== task.assigneeId) {
      const targetUser = state.users.find((user) => user.id === changes.assigneeId)
      if (!canReassignTask(currentUser, task, targetUser).allowed) return false
    }
    if (changes.departmentId !== undefined && changes.departmentId !== task.departmentId && !canChangeTaskDepartment(currentUser, task, changes.departmentId).allowed) return false
    if (changes.taskType !== undefined && changes.taskType !== task.taskType) {
      const targetUser = state.users.find((user) => user.id === (changes.assigneeId ?? task.assigneeId))
      if (!canAssignTask(currentUser, targetUser, { ...task, ...changes }).allowed) return false
    }
    dispatch({ type: 'UPDATE_TASK', id, changes: changes.projectId === '' ? { ...changes, projectId: null } : changes })
    if (changes.projectId !== undefined && (changes.projectId || null) !== (task.projectId || null)) {
      const projectId = changes.projectId || null
      const project = state.projects.find((item) => item.id === projectId) || state.projects.find((item) => item.id === task.projectId)
      if (project) {
        const now = new Date().toISOString()
        dispatch({ type: 'ADD_ACTIVITY', entry: { id: makeUniqueId('a', state.activity), userId: currentUser.id, type: 'project', projectId: project.id, text: projectId
          ? `${currentUser.name} linked task "${task.title}" to "${project.name}".`
          : `${currentUser.name} removed task "${task.title}" from "${project.name}".`, createdAt: now } })
        if (projectId) {
          for (const userId of new Set([project.projectManagerId, ...(project.teamMemberIds || [])].filter(Boolean))) {
            if (userId !== currentUser.id && userId !== (changes.assigneeId ?? task.assigneeId)) dispatch({ type: 'ADD_NOTIFICATION', notification: { id: makeUniqueId('n', state.notifications), userId, type: 'project', title: 'Task added to project', body: `"${task.title}" was linked to "${project.name}".`, link: '/projects', createdAt: now, read: false } })
          }
        }
      }
    }
    return true
  }, [currentUser, state.activity, state.notifications, state.projects, state.tasks, state.users])

  const createTask = useCallback((task) => {
    if (task.parentTaskId) return false
    const taskContext = {
      taskType: task.taskType,
      departmentId: task.departmentId,
      projectId: task.projectId,
      isTicketFollowUp: !!task.sourceTicketId,
      sourceTicketAssignedTo: state.tickets.find((ticket) => ticket.id === task.sourceTicketId)?.assigneeId,
    }
    const assignee = state.users.find((user) => user.id === task.assigneeId)
    if (!canCreateTask(currentUser, taskContext).allowed || !canAssignTask(currentUser, assignee, taskContext).allowed) return false
    const projectId = task.projectId || null
    if (projectId && !canAssociateTaskWithProject(currentUser, state.projects.find((project) => project.id === projectId), task.departmentId)) return false
    const normalized = {
      ...task,
      projectId,
      id: task.id && !state.tasks.some((existing) => existing.id === task.id) ? task.id : makeUniqueId('T', state.tasks),
      creatorId: currentUser.id,
      reporterId: currentUser.id,
      comments: task.comments || [],
      subtasks: task.subtasks || [],
      createdAt: task.createdAt || new Date().toISOString(),
    }
    dispatch({ type: 'ADD_TASK', task: normalized })
    const project = state.projects.find((item) => item.id === projectId)
    if (project) {
      const now = new Date().toISOString()
      dispatch({ type: 'ADD_ACTIVITY', entry: { id: makeUniqueId('a', state.activity), userId: currentUser.id, type: 'project', projectId, text: `${currentUser.name} added task "${normalized.title}" to "${project.name}".`, createdAt: now } })
      for (const userId of new Set([project.projectManagerId, ...(project.teamMemberIds || [])].filter(Boolean))) {
        if (userId !== currentUser.id && userId !== normalized.assigneeId) dispatch({ type: 'ADD_NOTIFICATION', notification: { id: makeUniqueId('n', state.notifications), userId, type: 'project', title: 'Task added to project', body: `"${normalized.title}" was added to "${project.name}".`, link: '/projects', createdAt: now, read: false } })
      }
    }
    return normalized.id
  }, [currentUser, state.activity, state.notifications, state.projects, state.tasks, state.tickets, state.users])

  const deleteTask = useCallback((id) => {
    const task = state.tasks.find((item) => item.id === id)
    if (!checkCanDeleteTask(currentUser, task).allowed) return false
    dispatch({ type: 'DELETE_TASK', id })
    return true
  }, [currentUser, state.tasks])

  const addTaskComment = useCallback((taskId, comment) => {
    const task = state.tasks.find((item) => item.id === taskId)
    if (!canViewTask(currentUser, task).allowed) return false
    dispatch({ type: 'ADD_TASK_COMMENT', taskId, comment: { ...comment, id: makeUniqueId('c', task.comments || []), userId: currentUser.id } })
    return true
  }, [currentUser, state.tasks])

  const addSubtask = useCallback((taskId, subtask) => {
    const parentTask = state.tasks.find((task) => task.id === taskId)
    const assignee = state.users.find((user) => user.id === subtask.assigneeId)
    if (!parentTask || parentTask.parentTaskId || !canCreateSubtask(currentUser, parentTask).allowed || !canAssignSubtask(currentUser, assignee, parentTask).allowed) return false
    const existingIds = state.tasks.flatMap((task) => task.subtasks || [])
    const normalized = {
      ...subtask,
      id: subtask.id && !existingIds.some((item) => item.id === subtask.id) ? subtask.id : makeUniqueId('S', existingIds),
      parentTaskId: parentTask.id,
      creatorId: currentUser.id,
    }
    dispatch({ type: 'ADD_SUBTASK', taskId, subtask: normalized })
    return normalized.id
  }, [currentUser, state.tasks, state.users])

  const updateSubtask = useCallback((taskId, subtaskId, changes) => {
    const parentTask = state.tasks.find((task) => task.id === taskId)
    const subtask = parentTask?.subtasks?.find((item) => item.id === subtaskId)
    if (!subtask || !canEditTask(currentUser, parentTask).allowed) return false
    if (['id', 'creatorId', 'parentTaskId', 'comments'].some((key) => key in changes)) return false
    if (changes.status !== undefined && changes.status !== subtask.status && !canChangeTaskStatus(currentUser, parentTask).allowed) return false
    if (changes.assigneeId !== undefined && changes.assigneeId !== subtask.assigneeId) {
      const targetUser = state.users.find((user) => user.id === changes.assigneeId)
      if (!canAssignSubtask(currentUser, targetUser, parentTask).allowed) return false
    }
    dispatch({ type: 'UPDATE_SUBTASK', taskId, subtaskId, changes })
    return true
  }, [currentUser, state.tasks, state.users])

  const deleteSubtask = useCallback((taskId, subtaskId) => {
    const parentTask = state.tasks.find((task) => task.id === taskId)
    if (!canEditTask(currentUser, parentTask).allowed) return false
    dispatch({ type: 'DELETE_SUBTASK', taskId, subtaskId })
    return true
  }, [currentUser, state.tasks])

  const addSubtaskComment = useCallback((taskId, subtaskId, comment) => {
    const parentTask = state.tasks.find((task) => task.id === taskId)
    const subtask = parentTask?.subtasks?.find((item) => item.id === subtaskId)
    if (!subtask || !canViewTask(currentUser, parentTask).allowed) return false
    dispatch({ type: 'ADD_SUBTASK_COMMENT', taskId, subtaskId, comment: { ...comment, id: makeUniqueId('c', subtask.comments || []), userId: currentUser.id } })
    return true
  }, [currentUser, state.tasks])

  const addActivity = useCallback((entry) => {
    dispatch({ type: 'ADD_ACTIVITY', entry })
  }, [])

  const addNotification = useCallback((notification) => {
    dispatch({ type: 'ADD_NOTIFICATION', notification })
  }, [])

  const createTicket = useCallback((ticket) => {
    const assignee = state.users.find((user) => user.id === ticket.assigneeId)
    if (!canCreateTicket(currentUser, { ...ticket, assignee }).allowed) return false
    if (ticket.assigneeId && !assignee) return false
    const normalized = {
      ...ticket,
      id: ticket.id && !state.tickets.some((item) => item.id === ticket.id) ? ticket.id : makeUniqueId('TKT', state.tickets),
      createdById: currentUser.id,
      updates: (ticket.updates || []).map((update) => ({ ...update, authorId: currentUser.id })),
    }
    dispatch({ type: 'ADD_TICKET', ticket: normalized })
    return normalized.id
  }, [currentUser, state.users])

  const updateTicket = useCallback((id, changes) => {
    const ticket = state.tickets.find((item) => item.id === id)
    if (!canUpdateTicket(currentUser, ticket).allowed) return false
    if (['id', 'requesterId', 'createdById', 'createdAt', 'updates'].some((key) => key in changes)) return false
    if (changes.departmentId !== undefined && changes.departmentId !== ticket.departmentId && !canChangeTicketDepartment(currentUser, ticket, changes.departmentId).allowed) return false
    if (changes.status === 'Escalated' && ticket.status !== 'Escalated' && !canEscalateTicket(currentUser, ticket).allowed) return false
    if (changes.assigneeId !== undefined && changes.assigneeId !== ticket.assigneeId) {
      const targetUser = state.users.find((user) => user.id === changes.assigneeId)
      if (!canAssignTicket(currentUser, ticket, targetUser).allowed) return false
    }
    dispatch({ type: 'UPDATE_TICKET', id, changes })
    return true
  }, [currentUser, state.tickets, state.users])

  const addTicketUpdate = useCallback((ticketId, update) => {
    const ticket = state.tickets.find((item) => item.id === ticketId)
    if (!canViewTicket(currentUser, ticket).allowed) return false
    if (update.type === 'internal' && !['superadmin', 'admin', 'support'].includes(currentUser.role)) return false
    dispatch({ type: 'ADD_TICKET_UPDATE', ticketId, update: { ...update, id: makeUniqueId('u', ticket.updates || []), authorId: currentUser.id } })
    return true
  }, [currentUser, state.tickets])

  const projectFormIsValid = useCallback((project, existingId = null) => {
    if (typeof project.name !== 'string' || !project.name.trim() || typeof project.id !== 'string' || !project.id.trim()
      || !state.departments.some((department) => department.id === project.departmentId)) return false
    if (!canManageProject(currentUser, project)) return false
    if (!validProjectDate(project.startDate) || !validProjectDate(project.deadline)) return false
    if (project.startDate && project.deadline && project.deadline < project.startDate) return false
    if (!['Low', 'Medium', 'High', 'Critical'].includes(project.priority)) return false
    if (!['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'].includes(project.status)) return false
    if (project.budget !== '' && project.budget != null && (!Number.isFinite(Number(project.budget)) || Number(project.budget) < 0)) return false
    if (!existingId && state.projects.some((item) => item.id.toLowerCase() === project.id.toLowerCase())) return false
    if (project.color && !/^#[0-9a-f]{6}$/i.test(project.color)) return false
    if (project.projectManagerId && !eligibleProjectManagers(currentUser, state.users, project.departmentId).some((user) => user.id === project.projectManagerId)) return false
    const eligibleMembers = new Set(eligibleProjectMembers(currentUser, state.users, project.departmentId).map((user) => user.id))
    return Array.isArray(project.teamMemberIds) && new Set(project.teamMemberIds).size === project.teamMemberIds.length
      && project.teamMemberIds.every((userId) => eligibleMembers.has(userId))
  }, [currentUser, state.departments, state.projects, state.users])

  const generateProjectId = useCallback(() => makeUniqueId('PRJ', state.projects), [state.projects])

  const createProject = useCallback((project) => {
    if (!project || typeof project !== 'object' || typeof project.name !== 'string' || !Array.isArray(project.teamMemberIds ?? [])) return false
    const candidate = {
      ...project,
      name: project.name?.trim(),
      teamMemberIds: [...new Set(project.teamMemberIds || [])],
    }
    if (!canManageProject(currentUser, candidate) || !projectFormIsValid(candidate)) return false
    const now = new Date().toISOString()
    const normalized = {
      ...candidate,
      projectManagerId: candidate.projectManagerId || null,
      ownerId: candidate.projectManagerId || null,
      description: candidate.description || '',
      budget: candidate.budget === '' || candidate.budget == null ? null : Number(candidate.budget),
      createdBy: currentUser.id,
      createdAt: now,
      updatedAt: now,
    }
    dispatch({ type: 'ADD_PROJECT', project: normalized })
    dispatch({ type: 'ADD_ACTIVITY', entry: { id: makeUniqueId('a', state.activity), userId: currentUser.id, type: 'project', projectId: normalized.id, text: `${currentUser.name} created project "${normalized.name}".`, createdAt: now } })
    for (const userId of new Set([normalized.projectManagerId, ...normalized.teamMemberIds].filter(Boolean))) {
      if (userId !== currentUser.id) dispatch({ type: 'ADD_NOTIFICATION', notification: { id: makeUniqueId('n', state.notifications), userId, type: 'project', title: 'Added to a project', body: `${currentUser.name} added you to "${normalized.name}".`, link: '/projects', createdAt: now, read: false } })
    }
    return normalized.id
  }, [currentUser, projectFormIsValid, state.activity, state.notifications])

  const updateProject = useCallback((id, changes) => {
    const existing = state.projects.find((item) => item.id === id)
    if (!existing || !changes || typeof changes !== 'object' || !Array.isArray(changes.teamMemberIds ?? existing.teamMemberIds ?? [])
      || (changes.name !== undefined && typeof changes.name !== 'string')
      || !canManageProject(currentUser, existing) || (changes.id !== undefined && changes.id !== id)
      || ['createdBy', 'createdAt'].some((key) => key in changes)) return false
    const candidate = {
      ...existing,
      ...changes,
      name: (changes.name ?? existing.name)?.trim(),
      teamMemberIds: [...new Set(changes.teamMemberIds ?? existing.teamMemberIds ?? [])],
    }
    if (!projectFormIsValid(candidate, id)) return false
    const now = new Date().toISOString()
    const normalizedChanges = {
      ...changes,
      name: candidate.name,
      projectManagerId: candidate.projectManagerId || null,
      ownerId: candidate.projectManagerId || null,
      teamMemberIds: candidate.teamMemberIds,
      budget: candidate.budget === '' || candidate.budget == null ? null : Number(candidate.budget),
      updatedAt: now,
    }
    dispatch({ type: 'UPDATE_PROJECT', id, changes: normalizedChanges })
    const statusChanged = candidate.status !== existing.status
    const addedMembers = candidate.teamMemberIds.filter((userId) => !(existing.teamMemberIds || []).includes(userId))
    const removedMembers = (existing.teamMemberIds || []).filter((userId) => !candidate.teamMemberIds.includes(userId))
    if (candidate.projectManagerId && candidate.projectManagerId !== existing.projectManagerId) addedMembers.push(candidate.projectManagerId)
    if (existing.projectManagerId && candidate.projectManagerId !== existing.projectManagerId) removedMembers.push(existing.projectManagerId)
    dispatch({ type: 'ADD_ACTIVITY', entry: { id: makeUniqueId('a', state.activity), userId: currentUser.id, type: 'project', projectId: id, text: statusChanged
      ? `${currentUser.name} changed "${candidate.name}" to ${candidate.status}.`
      : `${currentUser.name} updated project "${candidate.name}".`, createdAt: now } })
    for (const userId of new Set([...(statusChanged ? [candidate.projectManagerId, ...candidate.teamMemberIds] : []), ...addedMembers].filter(Boolean))) {
      if (userId !== currentUser.id) dispatch({ type: 'ADD_NOTIFICATION', notification: { id: makeUniqueId('n', state.notifications), userId, type: 'project', title: statusChanged ? 'Project updated' : 'Added to a project', body: statusChanged ? `"${candidate.name}" is now ${candidate.status}.` : `${currentUser.name} added you to "${candidate.name}".`, link: '/projects', createdAt: now, read: false } })
    }
    for (const userId of new Set(removedMembers)) {
      if (userId !== currentUser.id) dispatch({ type: 'ADD_NOTIFICATION', notification: { id: makeUniqueId('n', state.notifications), userId, type: 'project', title: 'Project team updated', body: `You were removed from "${candidate.name}".`, link: '/projects', createdAt: now, read: false } })
    }
    return true
  }, [currentUser, projectFormIsValid, state.activity, state.notifications, state.projects])

  const deleteProject = useCallback((id) => {
    const project = state.projects.find((item) => item.id === id)
    if (!project || !canManageProject(currentUser, project)) return false
    dispatch({ type: 'DELETE_PROJECT', id })
    dispatch({ type: 'ADD_ACTIVITY', entry: { id: makeUniqueId('a', state.activity), userId: currentUser.id, type: 'project', projectId: id, text: `${currentUser.name} deleted project "${project.name}".`, createdAt: new Date().toISOString() } })
    return true
  }, [currentUser, state.activity, state.projects])

  const value = useMemo(() => {
    const myNotifications = state.notifications
      .filter((n) => n.userId === currentUser?.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return {
      ...state,
      currentUser,
      role,
      roleInfo: ROLES[role],
      department: currentUser?.department ?? state.departments.find((d) => d.id === currentUser?.departmentId),
      notifications: myNotifications,
      unreadCount: myNotifications.filter((n) => !n.read).length,
      directoryError,
      directoryLoading,
      refreshDirectory,
      can: (permission) => canRole(role, permission),
      getUser: (id) => state.users.find((u) => u.id === id),
      getDepartment: (id) => state.departments.find((d) => d.id === id),
      getTaskById: (id) => state.tasks.find((task) => task.id === id),
      getTicketById: (id) => state.tickets.find((ticket) => ticket.id === id),
      markNotificationRead,
      markAllRead,
      resetDemo,
      updateTask,
      createTask,
      deleteTask,
      addTaskComment,
      addSubtask,
      updateSubtask,
      deleteSubtask,
      addSubtaskComment,
      addActivity,
      addNotification,
      createTicket,
      updateTicket,
      addTicketUpdate,
      generateProjectId,
      createProject,
      updateProject,
      deleteProject,
      dueSoon: state.tasks.filter((task) => task.dueDate && !['Completed', 'Cancelled'].includes(task.status) && task.dueDate <= daysFromNow(3)),
      priorityWeight: sortByPriority,
      statusOptions: ['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'],
      priorityOptions: ['Low', 'Medium', 'High', 'Critical'],
      ticketStatuses: ['Open', 'Triaged', 'In Progress', 'Waiting for Requester', 'Escalated', 'Resolved', 'Closed'],
      saveDemoState: persist,
    }
  }, [state, currentUser, role, directoryError, directoryLoading, refreshDirectory, markNotificationRead, markAllRead, resetDemo, updateTask, createTask, deleteTask, addTaskComment, addSubtask, updateSubtask, deleteSubtask, addSubtaskComment, addActivity, addNotification, createTicket, updateTicket, addTicketUpdate, generateProjectId, createProject, updateProject, deleteProject, persist])

  useEffect(() => {
    persist(state)
  }, [state, persist])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
