import { toISODate } from './dates.js'
import { ROLES } from '../data/roles.js'

const DAY_MS = 24 * 60 * 60 * 1000
const PENDING_STATUSES = new Set(['Backlog', 'To Do', 'In Review', 'Blocked'])
const CLOSED_STATUSES = new Set(['Completed', 'Cancelled'])

export function parseLocalDate(value) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function clampToToday(date, today) {
  return date > today ? today : date
}

function monthEnd(year, month) {
  return new Date(year, month + 1, 0)
}

export function getPerformanceDateRange({ period, date, month, startDate, endDate }, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let start
  let end

  if (period === 'daily') {
    start = parseLocalDate(date)
    if (!start) return { error: 'Choose a valid report date.' }
    if (start > today) return { error: 'Future dates cannot be reported.' }
    end = start
  } else if (period === 'weekly') {
    const selectedDate = parseLocalDate(date)
    if (!selectedDate) return { error: 'Choose a valid date in the report week.' }
    if (selectedDate > today) return { error: 'Future dates cannot be reported.' }
    start = new Date(selectedDate)
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    end = new Date(start)
    end.setDate(end.getDate() + 6)
    end = clampToToday(end, today)
  } else if (period === 'monthly') {
    if (!/^\d{4}-\d{2}$/.test(month || '')) return { error: 'Choose a valid report month.' }
    const [year, monthIndex] = month.split('-').map(Number)
    start = new Date(year, monthIndex - 1, 1)
    if (start.getFullYear() !== year || start.getMonth() !== monthIndex - 1 || start > today) {
      return { error: 'Choose a valid month that is not in the future.' }
    }
    end = clampToToday(monthEnd(year, monthIndex - 1), today)
  } else if (period === 'last3months') {
    start = new Date(today.getFullYear(), today.getMonth() - 3, 1)
    end = new Date(today.getFullYear(), today.getMonth(), 0)
  } else if (period === 'custom') {
    start = parseLocalDate(startDate)
    end = parseLocalDate(endDate)
    if (!start || !end) return { error: 'Choose valid start and end dates.' }
    if (start > end) return { error: 'The start date must be on or before the end date.' }
    if (end > today) return { error: 'Future dates cannot be reported.' }
  } else {
    return { error: 'Choose a supported report period.' }
  }

  return { startDate: toISODate(start), endDate: toISODate(end) }
}

export function getAuthorizedDepartmentIds(user, departments) {
  if (user?.role === 'superadmin') return departments.map((department) => department.id)
  if (user?.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return departments.filter((department) => scope.includes(department.id)).map((department) => department.id)
  }
  if (user?.role === 'manager') return departments.some((department) => department.id === user.departmentId) ? [user.departmentId] : []
  return []
}

function asReportWorkItems(tasks) {
  return tasks.flatMap((task) => {
    if (task.archived || task.isArchived || task.archivedAt) return []
    const parentItem = { ...task, parentTaskId: null, workItemType: 'Task', departmentId: task.departmentId }
    const subtasks = (Array.isArray(task.subtasks) ? task.subtasks : [])
      .filter((subtask) => !subtask.archived && !subtask.isArchived && !subtask.archivedAt)
      .map((subtask) => ({
        ...subtask,
        title: `${task.title}: ${subtask.title}`,
        parentTaskId: task.id,
        workItemType: 'Subtask',
        departmentId: task.departmentId,
      }))
    return [parentItem, ...subtasks]
  })
}

function isInRange(value, range) {
  const date = parseLocalDate(value)
  if (!date) return false
  const isoDate = toISODate(date)
  return isoDate >= range.startDate && isoDate <= range.endDate
}

function isOverdue(item, today) {
  return !!item.dueDate && item.dueDate < today && !CLOSED_STATUSES.has(item.status)
}

function percent(numerator, denominator) {
  return denominator ? Math.round((numerator / denominator) * 100) : 0
}

function buildEmployeeMetrics(employee, items, range, today) {
  const createdInPeriod = items.filter((item) => isInRange(item.createdAt, range))
  const completedCurrently = createdInPeriod.filter((item) => item.status === 'Completed')
  const inProgress = createdInPeriod.filter((item) => item.status === 'In Progress')
  const pending = createdInPeriod.filter((item) => PENDING_STATUSES.has(item.status))
  const overdue = createdInPeriod.filter((item) => isOverdue(item, today))
  const completedInPeriod = items.filter((item) => item.status === 'Completed' && isInRange(item.completedAt, range))
  const completedWithDeadline = completedInPeriod.filter((item) => item.dueDate && parseLocalDate(item.dueDate))
  const completedOnTime = completedWithDeadline.filter((item) => toISODate(parseLocalDate(item.completedAt)) <= item.dueDate)
  const completedLate = completedWithDeadline.filter((item) => toISODate(parseLocalDate(item.completedAt)) > item.dueDate)
  const durations = completedInPeriod.flatMap((item) => {
    const created = parseLocalDate(item.createdAt)
    const completed = parseLocalDate(item.completedAt)
    return created && completed && completed >= created ? [(completed - created) / DAY_MS] : []
  })
  const reportItemsById = new Map()
  for (const item of createdInPeriod) {
    reportItemsById.set(`${item.workItemType}-${item.id}`, { ...item, periodEvent: 'Created in range' })
  }
  for (const item of completedInPeriod) {
    const key = `${item.workItemType}-${item.id}`
    const existing = reportItemsById.get(key)
    reportItemsById.set(key, { ...item, periodEvent: existing ? 'Created and completed in range' : 'Completed in range' })
  }

  return {
    employee,
    items: createdInPeriod,
    reportItems: [...reportItemsById.values()],
    totalCreated: createdInPeriod.length,
    completedCurrently: completedCurrently.length,
    inProgress: inProgress.length,
    pending: pending.length,
    overdue: overdue.length,
    completionRate: percent(completedCurrently.length, createdInPeriod.length),
    completedInPeriod: completedInPeriod.length,
    completedInPeriodAvailable: completedInPeriod.length > 0 || items.some((item) => Boolean(item.completedAt)),
    completionDatesAvailable: items.some((item) => Boolean(item.completedAt)),
    completedWithDeadline: completedWithDeadline.length,
    completedOnTime: completedOnTime.length,
    completedLate: completedLate.length,
    onTimeRate: completedWithDeadline.length ? percent(completedOnTime.length, completedWithDeadline.length) : null,
    averageCompletionDays: durations.length ? durations.reduce((total, value) => total + value, 0) / durations.length : null,
    pendingAtPeriodEnd: null,
    today,
  }
}

export function buildEmployeePerformanceReport({
  currentUser,
  users,
  departments,
  tasks,
  range,
  selectedDepartmentId = 'all',
  selectedEmployeeId = 'all',
  statusFilter = 'all',
  search = '',
  now = new Date(),
}) {
  const authorizedDepartmentIds = getAuthorizedDepartmentIds(currentUser, departments)
  const authorizedDepartments = departments.filter((department) => authorizedDepartmentIds.includes(department.id))
  const departmentById = new Map(departments.map((department) => [department.id, department]))
  const employees = users.filter((employee) =>
    authorizedDepartmentIds.includes(employee.departmentId)
    && (selectedDepartmentId === 'all' || employee.departmentId === selectedDepartmentId)
    && (selectedEmployeeId === 'all' || employee.id === selectedEmployeeId)
    && employee.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .map((employee) => ({
      ...employee,
      roleLabel: ROLES[employee.role]?.label ?? employee.role,
      departmentName: departmentById.get(employee.departmentId)?.name ?? 'Department not recorded',
    }))

  const visibleEmployeeIds = new Set(employees.map((employee) => employee.id))
  const today = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const workItems = asReportWorkItems(tasks).filter((item) =>
    authorizedDepartmentIds.includes(item.departmentId)
    && (selectedDepartmentId === 'all' || item.departmentId === selectedDepartmentId)
    && (statusFilter === 'all' || item.status === statusFilter)
    && visibleEmployeeIds.has(item.assigneeId))

  const employeesWithMetrics = employees.map((employee) => buildEmployeeMetrics(
    employee,
    workItems.filter((item) => item.assigneeId === employee.id),
    range,
    today,
  ))

  const allCreatedItems = employeesWithMetrics.flatMap((report) => report.items)
  const completedCurrent = allCreatedItems.filter((item) => item.status === 'Completed').length
  const overdueCurrent = allCreatedItems.filter((item) => isOverdue(item, today)).length
  const completionDatesAvailable = workItems.some((item) => Boolean(item.completedAt))

  return {
    employees: employeesWithMetrics,
    departments: authorizedDepartments.filter((department) => selectedDepartmentId === 'all' || department.id === selectedDepartmentId),
    totalEmployees: employeesWithMetrics.length,
    totalCreated: allCreatedItems.length,
    completedCurrently: completedCurrent,
    completionRate: percent(completedCurrent, allCreatedItems.length),
    overdue: overdueCurrent,
    completedInPeriod: completionDatesAvailable
      ? employeesWithMetrics.reduce((total, report) => total + report.completedInPeriod, 0)
      : null,
    completionDatesAvailable,
    pendingAtPeriodEnd: null,
    assignmentDatesAvailable: false,
    statusHistoryAvailable: false,
    taskStatusOptions: [...new Set(asReportWorkItems(tasks).map((item) => item.status).filter(Boolean))].sort(),
  }
}

export function formatReportDate(isoDate) {
  const date = parseLocalDate(isoDate)
  return date ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date) : 'Not recorded'
}

export function completionDisplay(value) {
  return value === null || value === undefined ? 'Not available' : `${value}%`
}
