import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { AppContext } from './appContext'
import { MOCK_USERS, DEMO_USER_BY_ROLE } from '../data/mockUsers'
import { MOCK_DEPARTMENTS } from '../data/mockDepartments'
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
  canCreateDepartment,
  canDeleteTask as checkCanDeleteTask,
  canEscalateTicket,
  canEditTask,
  canManageUser,
  canReassignTask,
  canUpdateTicket,
  canViewTask,
  canViewTicket,
} from '../permissions/taskPermissions'
import { daysFromNow, hoursAgo, minutesAgo, toISODate } from '../utils/dates'

const STORAGE_KEY = 'taskflow.demo.state.v1'
const DEFAULT_USER_ID = DEMO_USER_BY_ROLE.manager

function makeId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function makeUniqueId(prefix, records) {
  const usedIds = new Set(records.map((record) => record.id))
  let id = makeId(prefix)
  while (usedIds.has(id)) id = makeId(prefix)
  return id
}

function validManagerAssignment(managerId, departmentId, users) {
  if (!managerId) return true
  const manager = users.find((user) => user.id === managerId)
  if (!manager || manager.status !== 'Active' || !['superadmin', 'admin', 'manager', 'hr'].includes(manager.role)) return false
  return manager.departmentId === departmentId || ['superadmin', 'admin'].includes(manager.role)
}

function createInitialNotifications() {
  return [
    { id: 'n-01', userId: 'u-imran', type: 'task', title: 'Campaign briefing ready', body: 'The product launch campaign is ready for review.', link: '/my-tasks', createdAt: minutesAgo(20), read: false },
    { id: 'n-02', userId: 'u-imran', type: 'comment', title: 'New comment added', body: 'Ayesha commented on the product launch plan.', link: '/my-tasks', createdAt: minutesAgo(42), read: false },
    { id: 'n-03', userId: 'u-imran', type: 'deadline', title: 'Deadline approaching', body: 'The launch campaign due date is in 3 days.', link: '/my-tasks', createdAt: hoursAgo(2), read: false },
    { id: 'n-04', userId: 'u-ayesha', type: 'task', title: 'Task assigned', body: 'You were assigned the product launch campaign plan.', link: '/my-tasks', createdAt: minutesAgo(15), read: false },
    { id: 'n-05', userId: 'u-ayesha', type: 'comment', title: 'Subtask update', body: 'Rahim updated the product descriptions subtask.', link: '/my-tasks', createdAt: hoursAgo(1), read: false },
    { id: 'n-06', userId: 'u-arif', type: 'ticket', title: 'Support queue update', body: 'A new ticket was routed to the IT Support team.', link: '/helpdesk', createdAt: hoursAgo(7), read: true },
    { id: 'n-07', userId: 'u-mahmudul', type: 'deadline', title: 'Engineering review due soon', body: 'Two engineering tasks are close to their due dates.', link: '/team-tasks', createdAt: hoursAgo(3), read: false },
    { id: 'n-08', userId: 'u-kamal', type: 'system', title: 'Weekly summary ready', body: 'The organization summary is updated for this week.', link: '/reports', createdAt: hoursAgo(10), read: true },
  ]
}

function createInitialActivity() {
  return [
    { id: 'a-01', userId: 'u-imran', type: 'task', text: 'Imran created the launch campaign plan.', createdAt: hoursAgo(12) },
    { id: 'a-02', userId: 'u-sarah', type: 'subtask', text: 'Sarah completed Prepare product images.', createdAt: hoursAgo(5) },
    { id: 'a-03', userId: 'u-ayesha', type: 'task', text: 'Ayesha marked the launch campaign as In Progress.', createdAt: hoursAgo(2) },
    { id: 'a-04', userId: 'u-arif', type: 'ticket', text: 'Arif triaged a new IT support request.', createdAt: hoursAgo(9) },
  ]
}

function readStoredUserId() {
  try {
    const stored = localStorage.getItem('taskflow.demo.userId')
    return Object.values(DEMO_USER_BY_ROLE).includes(stored) ? stored : null
  } catch {
    return null
  }
}

function readStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const requiredCollections = ['users', 'departments', 'tasks', 'tickets', 'notifications', 'activity', 'projects']
    if (!parsed || requiredCollections.some((key) => !Array.isArray(parsed[key]))) return null
    if (!parsed.users.length || parsed.users.some((user) => !user?.id || !user?.role)) return null
    if (parsed.tasks.some((task) => !task?.id || !task?.title)) return null
    if (parsed.tickets.some((ticket) => !ticket?.id || !ticket?.title)) return null

    return {
      ...parsed,
      currentUserId: parsed.users.some((user) => user.id === parsed.currentUserId) ? parsed.currentUserId : readStoredUserId() || DEFAULT_USER_ID,
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
      assigneeId: 'u-ayesha',
      reporterId: 'u-imran',
      departmentId: 'd-mkt',
      projectId: 'p-launch',
      dueDate: daysFromNow(3),
      createdAt: hoursAgo(22),
      comments: [
        { id: 'c-1', userId: 'u-imran', text: 'Let us keep the launch checklist aligned with the sales push.', createdAt: hoursAgo(7) },
        { id: 'c-2', userId: 'u-ayesha', text: 'I am coordinating the copy and brief with the design crew.', createdAt: hoursAgo(2) },
      ],
      subtasks: [
        { id: 'S-101', title: 'Prepare product images', assigneeId: 'u-sarah', creatorId: 'u-imran', status: 'Completed', priority: 'High', dueDate: daysFromNow(-1), description: 'Prepare final visuals for campaign landing and social assets.', createdAt: hoursAgo(18), comments: [{ id: 'c-11', userId: 'u-imran', text: 'The selected visuals are on track.', createdAt: hoursAgo(5) }] },
        { id: 'S-102', title: 'Write product descriptions', assigneeId: 'u-rahim', creatorId: 'u-imran', status: 'In Progress', priority: 'High', dueDate: daysFromNow(2), description: 'Draft a concise product overview and feature highlights.', createdAt: hoursAgo(16), comments: [] },
        { id: 'S-103', title: 'Prepare social media captions', assigneeId: 'u-tanvir', creatorId: 'u-imran', status: 'To Do', priority: 'Medium', dueDate: daysFromNow(4), description: 'Create platform-specific captions for launch week.', createdAt: hoursAgo(10), comments: [] },
        { id: 'S-104', title: 'Review campaign materials', assigneeId: 'u-nusrat', creatorId: 'u-imran', status: 'In Review', priority: 'Medium', dueDate: daysFromNow(1), description: 'Approve all campaign copy and art direction.', createdAt: hoursAgo(9), comments: [] },
      ],
    },
    {
      id: 'T-2202',
      title: 'Finalize vendor onboarding pack',
      description: 'Tighten the procurement checklist and share onboarding docs with the finance and ops teams.',
      status: 'Backlog',
      priority: 'Medium',
      assigneeId: 'u-imran',
      reporterId: 'u-farhana',
      departmentId: 'd-mkt',
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
      assigneeId: 'u-shafiq',
      reporterId: 'u-mahmudul',
      departmentId: 'd-eng',
      projectId: 'p-platform',
      dueDate: daysFromNow(-2),
      createdAt: hoursAgo(30),
      comments: [{ id: 'c-3', userId: 'u-lamia', text: 'QA sign-off is in progress for this patch.', createdAt: hoursAgo(5) }],
      subtasks: [
        { id: 'S-201', title: 'Validate patch notes', assigneeId: 'u-lamia', creatorId: 'u-shafiq', status: 'Completed', priority: 'Critical', dueDate: daysFromNow(-3), description: 'Verify the patch summary matches the release notes.', createdAt: hoursAgo(40), comments: [] },
        { id: 'S-202', title: 'Confirm deployment checklist', assigneeId: 'u-rafi', creatorId: 'u-shafiq', status: 'Blocked', priority: 'High', dueDate: daysFromNow(1), description: 'Confirm rollback and staging readiness before deployment.', createdAt: hoursAgo(36), comments: [] },
      ],
    },
    {
      id: 'T-2204',
      title: 'Quarterly forecasting cleanup',
      description: 'Review forecasts and reconcile variance assumptions for the end-of-quarter report.',
      status: 'Completed',
      priority: 'Medium',
      assigneeId: 'u-sabrina',
      reporterId: 'u-kamal',
      departmentId: 'd-fin',
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
      assigneeId: 'u-maliha',
      reporterId: 'u-rubel',
      departmentId: 'd-hr',
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
      assigneeId: 'u-arif',
      reporterId: 'u-zubair',
      departmentId: 'd-it',
      projectId: 'p-it',
      dueDate: daysFromNow(1),
      createdAt: hoursAgo(18),
      comments: [{ id: 'c-4', userId: 'u-zubair', text: 'We need three additional approvals before we can order equipment.', createdAt: hoursAgo(2) }],
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
      requesterId: 'u-shafiq',
      assigneeId: 'u-arif',
      departmentId: 'd-it',
      status: 'In Progress',
      priority: 'High',
      createdAt: hoursAgo(8),
      updates: [
        { id: 'u-1', authorId: 'u-arif', type: 'public', message: 'I am reviewing the VPN logs and checking the affected access profile.', createdAt: hoursAgo(5) },
        { id: 'u-2', authorId: 'u-arif', type: 'internal', message: 'This is likely tied to certificate rotation for the engineering VPN profile.', createdAt: hoursAgo(4) },
      ],
      relatedTaskId: null,
    },
    {
      id: 'TKT-1042',
      title: 'Request for conference room booking changes',
      description: 'The room booking system needs updated equipment and access timing for the weekly ops sync.',
      requesterId: 'u-nabila',
      assigneeId: 'u-farhana',
      departmentId: 'd-ops',
      status: 'Triaged',
      priority: 'Medium',
      createdAt: hoursAgo(26),
      updates: [{ id: 'u-3', authorId: 'u-farhana', type: 'public', message: 'Thanks, I have passed this to the office admin team for review.', createdAt: hoursAgo(20) }],
      relatedTaskId: null,
    },
    {
      id: 'TKT-1043',
      title: 'Access request for new contractor',
      description: 'Please create access to the project board, email and shared drive for the contractor who starts Tuesday.',
      requesterId: 'u-maliha',
      assigneeId: 'u-tasnim',
      departmentId: 'd-hr',
      status: 'Waiting for Requester',
      priority: 'Medium',
      createdAt: hoursAgo(4),
      updates: [{ id: 'u-4', authorId: 'u-tasnim', type: 'public', message: 'I need the contractor identity and the access dates before I can finalize the setup.', createdAt: minutesAgo(15) }],
      relatedTaskId: null,
    },
    {
      id: 'TKT-1044',
      title: 'Campaign asset export is failing',
      description: 'The design export process is failing when we generate the final social files from the campaign library.',
      requesterId: 'u-rahim',
      assigneeId: 'u-arif',
      departmentId: 'd-mkt',
      status: 'Escalated',
      priority: 'High',
      createdAt: hoursAgo(9),
      updates: [{ id: 'u-5', authorId: 'u-arif', type: 'internal', message: 'Escalating to marketing engineering because the export timing issue is happening on the new asset pipeline.', createdAt: hoursAgo(3) }],
      relatedTaskId: null,
    },
  ]
}

function buildInitialProjects() {
  return [
    { id: 'p-launch', name: 'Product Launch', status: 'Active', ownerId: 'u-imran' },
    { id: 'p-platform', name: 'Platform Release', status: 'Active', ownerId: 'u-mahmudul' },
    { id: 'p-people', name: 'People Ops', status: 'Planning', ownerId: 'u-maliha' },
    { id: 'p-it', name: 'IT Modernization', status: 'Active', ownerId: 'u-zubair' },
    { id: 'p-finance', name: 'Finance Review', status: 'Closed', ownerId: 'u-sabrina' },
    { id: 'p-partners', name: 'Vendor Onboarding', status: 'Active', ownerId: 'u-imran' },
  ]
}

function createInitialState(currentUserId) {
  const userId = currentUserId ?? readStoredUserId() ?? DEFAULT_USER_ID
  const base = {
    currentUserId: userId,
    users: MOCK_USERS.map((u) => ({ ...u })),
    departments: MOCK_DEPARTMENTS.map((d) => ({ ...d })),
    tasks: buildInitialTasks(),
    tickets: buildInitialTickets(),
    notifications: createInitialNotifications(),
    activity: createInitialActivity(),
    projects: buildInitialProjects(),
  }

  return base
}

function readInitialState() {
  const stored = readStoredState()
  if (stored) {
    return {
      ...stored,
      currentUserId: stored.currentUserId || readStoredUserId() || DEFAULT_USER_ID,
    }
  }
  return createInitialState()
}

function sortByPriority(priority) {
  return { Critical: 4, High: 3, Medium: 2, Low: 1 }[priority] ?? 0
}

function reducer(state, action) {
  switch (action.type) {
    case 'SWITCH_ROLE': {
      const userId = DEMO_USER_BY_ROLE[action.role]
      if (!userId) return state
      try {
        localStorage.setItem('taskflow.demo.userId', userId)
      } catch {
        // ignore storage issues in demo mode
      }

      return { ...state, currentUserId: userId }
    }
    case 'SET_STATE':
      return action.state
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
    case 'ADD_USER':
      return {
        ...state,
        users: [...state.users, action.user],
      }
    case 'UPDATE_USER': {
      return {
        ...state,
        users: state.users.map((user) => (user.id === action.id ? { ...user, ...action.changes } : user)),
      }
    }
    case 'ADD_DEPARTMENT':
      return { ...state, departments: [...state.departments, action.department] }
    case 'UPDATE_DEPARTMENT':
      return { ...state, departments: state.departments.map((department) => (department.id === action.id ? { ...department, ...action.changes } : department)) }
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
      try {
        localStorage.setItem('taskflow.demo.userId', DEFAULT_USER_ID)
      } catch {
        // ignore storage issues in demo mode
      }
      return createInitialState(DEFAULT_USER_ID)
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, readInitialState)

  const persist = useCallback((nextState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
    } catch {
      // storage unavailable in the browser demo
    }
  }, [])

  const currentUser = useMemo(() => state.users.find((u) => u.id === state.currentUserId), [state.users, state.currentUserId])
  const role = currentUser?.role ?? 'manager'

  const switchRole = useCallback((r) => dispatch({ type: 'SWITCH_ROLE', role: r }), [])
  const markNotificationRead = useCallback((id) => {
    const notification = state.notifications.find((item) => item.id === id)
    if (!notification || notification.userId !== currentUser.id) return false
    dispatch({ type: 'MARK_NOTIFICATION_READ', id })
    return true
  }, [currentUser.id, state.notifications])
  const markAllRead = useCallback(() => dispatch({ type: 'MARK_ALL_READ', userId: state.currentUserId }), [state.currentUserId])
  const resetDemo = useCallback(() => dispatch({ type: 'RESET_DEMO' }), [])

  const updateTask = useCallback((id, changes) => {
    const task = state.tasks.find((item) => item.id === id)
    if (!task || !canEditTask(currentUser, task).allowed) return false
    if (['id', 'creatorId', 'reporterId', 'createdAt', 'sourceTicketId', 'comments', 'subtasks'].some((key) => key in changes)) return false
    if (changes.parentTaskId) return false
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
    dispatch({ type: 'UPDATE_TASK', id, changes })
    return true
  }, [currentUser, state.tasks, state.users])

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
    const normalized = {
      ...task,
      id: task.id && !state.tasks.some((existing) => existing.id === task.id) ? task.id : makeUniqueId('T', state.tasks),
      creatorId: currentUser.id,
      reporterId: currentUser.id,
      comments: task.comments || [],
      subtasks: task.subtasks || [],
      createdAt: task.createdAt || new Date().toISOString(),
    }
    dispatch({ type: 'ADD_TASK', task: normalized })
    return normalized.id
  }, [currentUser, state.tasks, state.tickets, state.users])

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

  const updateEmployee = useCallback((id, changes) => {
    const employee = state.users.find((user) => user.id === id)
    if (!canManageUser(currentUser, employee, changes).allowed) return false
    const departmentId = changes.departmentId ?? employee?.departmentId
    const managerId = changes.managerId ?? employee?.managerId
    if ((changes.id !== undefined && changes.id !== id) || !validManagerAssignment(managerId, departmentId, state.users)) return false
    dispatch({ type: 'UPDATE_USER', id, changes })
    return true
  }, [currentUser, state.users])

  const createEmployee = useCallback((employee) => {
    if (!employee?.id) {
      return
    }

    const exists = state.users.some((user) => user.id === employee.id)
    const existing = state.users.find((user) => user.id === employee.id)
    const allowed = canManageUser(currentUser, existing, { role: employee.role, departmentId: employee.departmentId })
    if (!allowed.allowed || (existing && employee.id !== existing.id) || !validManagerAssignment(employee.managerId, employee.departmentId, state.users)) return false
    dispatch({ type: exists ? 'UPDATE_USER' : 'ADD_USER', id: employee.id, user: employee, changes: employee })
    return true
  }, [currentUser, state.users])

  const updateDepartment = useCallback((id, changes) => {
    const department = state.departments.find((item) => item.id === id)
    if (!canManageDepartment(currentUser, department).allowed) return false
    if (changes.headId && !state.users.some((user) => user.id === changes.headId && user.departmentId === id)) return false
    dispatch({ type: 'UPDATE_DEPARTMENT', id, changes })
    return true
  }, [currentUser, state.departments, state.users])

  const createDepartment = useCallback((department) => {
    if (!canCreateDepartment(currentUser).allowed) return false
    const id = department.id && !state.departments.some((item) => item.id === department.id)
      ? department.id
      : makeUniqueId('d', state.departments)
    dispatch({ type: 'ADD_DEPARTMENT', department: { ...department, id } })
    return id
  }, [currentUser, state.departments])

  const value = useMemo(() => {
    const myNotifications = state.notifications
      .filter((n) => n.userId === state.currentUserId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    return {
      ...state,
      currentUser,
      role,
      roleInfo: ROLES[role],
      department: state.departments.find((d) => d.id === currentUser?.departmentId),
      notifications: myNotifications,
      unreadCount: myNotifications.filter((n) => !n.read).length,
      can: (permission) => canRole(role, permission),
      getUser: (id) => state.users.find((u) => u.id === id),
      getDepartment: (id) => state.departments.find((d) => d.id === id),
      getTaskById: (id) => state.tasks.find((task) => task.id === id),
      getTicketById: (id) => state.tickets.find((ticket) => ticket.id === id),
      switchRole,
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
      updateEmployee,
      createEmployee,
      updateDepartment,
      createDepartment,
      dueSoon: state.tasks.filter((task) => task.dueDate && !['Completed', 'Cancelled'].includes(task.status) && task.dueDate <= daysFromNow(3)),
      priorityWeight: sortByPriority,
      statusOptions: ['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'],
      priorityOptions: ['Low', 'Medium', 'High', 'Critical'],
      ticketStatuses: ['Open', 'Triaged', 'In Progress', 'Waiting for Requester', 'Escalated', 'Resolved', 'Closed'],
      saveDemoState: persist,
    }
  }, [state, currentUser, role, switchRole, markNotificationRead, markAllRead, resetDemo, updateTask, createTask, deleteTask, addTaskComment, addSubtask, updateSubtask, deleteSubtask, addSubtaskComment, addActivity, addNotification, createTicket, updateTicket, addTicketUpdate, updateEmployee, createEmployee, updateDepartment, createDepartment, persist])

  useEffect(() => {
    persist(state)
  }, [state, persist])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
