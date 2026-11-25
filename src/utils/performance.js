const DAY_IN_MS = 24 * 60 * 60 * 1000

export function toDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatPercent(value) {
  if (!Number.isFinite(value)) return 'N/A'
  return `${value.toFixed(1)}%`
}

export function formatSignedPoints(value) {
  if (!Number.isFinite(value)) return 'N/A'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value}`
}

export function getCompletionOutcome(task) {
  if (!task || task.status !== 'Completed') return 'pending'

  const deadline = toDate(task.dueDate)
  const completedAt = toDate(task.completedAt) || toDate(task.updatedAt) || toDate(task.createdAt)

  if (!deadline || !completedAt) return 'unknown'

  const diffInDays = Math.ceil((completedAt.getTime() - deadline.getTime()) / DAY_IN_MS)
  if (diffInDays < 0) return 'early'
  if (diffInDays === 0) return 'on-time'
  if (diffInDays === 1) return 'late-1'
  if (diffInDays >= 2 && diffInDays <= 3) return 'late-2-3'
  return 'late-4-plus'
}

export function getTaskPointValue(task) {
  if (!task || task.status !== 'Completed' || !task.dueDate) return 0

  const outcome = getCompletionOutcome(task)

  switch (outcome) {
    case 'early':
      return 12
    case 'on-time':
      return 10
    case 'late-1':
      return 5
    case 'late-2-3':
      return 0
    case 'late-4-plus':
      return -5
    default:
      return 0
  }
}

export function getQualityScore(task) {
  if (!task) return null
  const value = task.qualityScore ?? task.quality ?? task.qualityRating ?? task.reviewScore ?? task.review?.score ?? task.review?.rating
  if (value === undefined || value === null || value === '') return null
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function getQualityLabel(task) {
  const score = getQualityScore(task)
  if (score === null) return 'N/A'
  if (score >= 5) return 'Excellent'
  if (score >= 3) return 'Good'
  if (score >= 1) return 'Satisfactory'
  if (score === 0) return 'Needs Improvement'
  return 'Poor'
}

export function getEmployeePerformance(employeeId, tasks, options = {}) {
  const rangeStart = options.startDate ? toDate(options.startDate) : null
  const rangeEnd = options.endDate ? toDate(options.endDate) : null
  const now = new Date()

  const relevantTasks = tasks.filter((task) => {
    if (task.assigneeId !== employeeId) return false
    if (task.status === 'Cancelled') return false

    if (task.createdAt) {
      const createdAt = toDate(task.createdAt)
      if (createdAt && rangeStart && createdAt < rangeStart) return false
      if (createdAt && rangeEnd && createdAt > rangeEnd) return false
    }

    if (task.dueDate) {
      const dueDate = toDate(task.dueDate)
      if (dueDate && rangeStart && dueDate < rangeStart) return false
      if (dueDate && rangeEnd && dueDate > rangeEnd) return false
    }

    return true
  })

  const eligibleTasks = relevantTasks.filter((task) => !!task.dueDate)
  const completedTasks = relevantTasks.filter((task) => task.status === 'Completed')
  const completedEligible = completedTasks.filter((task) => !!task.dueDate)

  const earlyTasks = completedEligible.filter((task) => getCompletionOutcome(task) === 'early')
  const onTimeTasks = completedEligible.filter((task) => getCompletionOutcome(task) === 'on-time')
  const caughtUpTasks = completedEligible.filter((task) => ['early', 'on-time'].includes(getCompletionOutcome(task)))

  const earnedPoints = completedEligible.reduce((total, task) => total + Math.max(0, getTaskPointValue(task)), 0)
  const deductions = completedEligible.reduce((total, task) => total + Math.max(0, -getTaskPointValue(task)), 0)
  const totalPoints = completedEligible.reduce((total, task) => total + getTaskPointValue(task), 0)
  const completedCount = completedEligible.length
  const onTimeRate = completedCount ? (onTimeTasks.length / completedCount) * 100 : 0
  const earlyRate = completedCount ? (earlyTasks.length / completedCount) * 100 : 0
  const completionRate = eligibleTasks.length ? (completedCount / eligibleTasks.length) * 100 : 0

  const overdueTasks = relevantTasks.filter((task) => {
    if (!task.dueDate || task.status === 'Completed' || task.status === 'Cancelled') return false
    const dueDate = toDate(task.dueDate)
    return Boolean(dueDate && dueDate < now)
  }).length

  const qualityScores = completedEligible
    .map((task) => getQualityScore(task))
    .filter((value) => value !== null)

  const qualityAverage = qualityScores.length ? qualityScores.reduce((sum, value) => sum + value, 0) / qualityScores.length : null

  const recentPointHistory = completedEligible.slice(0, 5).map((task) => ({
    id: task.id,
    title: task.title,
    date: toDate(task.completedAt) || toDate(task.updatedAt) || toDate(task.createdAt) || new Date(),
    points: getTaskPointValue(task),
    reason: task.reason || `${getCompletionOutcome(task).replace('-', ' ')} completion`,
  }))

  return {
    assignedTasks: relevantTasks.length,
    eligibleTasks: eligibleTasks.length,
    completedTasks: completedCount,
    earlyTasks: earlyTasks.length,
    onTimeTasks: onTimeTasks.length,
    overdueTasks,
    totalPoints,
    earnedPoints,
    deductions,
    completionRate,
    onTimeRate,
    earlyRate,
    qualityAverage,
    qualityScore: qualityAverage === null ? null : Number(qualityAverage.toFixed(1)),
    recentPointHistory,
    completedOnTimeOrEarly: caughtUpTasks.length,
  }
}

export function getPerformanceTrend(employeeId, tasks, options = {}) {
  const rangeEnd = options.endDate ? toDate(options.endDate) : new Date()
  const rangeStart = options.startDate ? toDate(options.startDate) : new Date(rangeEnd.getTime() - (90 * DAY_IN_MS))
  const windowSize = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / DAY_IN_MS))
  const previousWindowEnd = new Date(rangeStart.getTime() - 1)
  const previousWindowStart = new Date(previousWindowEnd.getTime() - (windowSize * DAY_IN_MS))

  const current = getEmployeePerformance(employeeId, tasks, { startDate: rangeStart, endDate: rangeEnd })
  const previous = getEmployeePerformance(employeeId, tasks, { startDate: previousWindowStart, endDate: previousWindowEnd })

  if (!current.completedTasks && !previous.completedTasks) return 0
  if (!previous.completedTasks) return 100

  return ((current.completionRate - previous.completionRate) / previous.completionRate) * 100
}

export function getEmployeePerformanceRows(users, tasks, departments, role, currentUserId, options = {}) {
  const rowUsers = users.filter((user) => {
    if (role === 'superadmin') return true
    if (role === 'admin') return user.role !== 'superadmin'
    if (role === 'manager') return user.departmentId && user.departmentId === departments.find((department) => department.headId === currentUserId)?.id
    return user.id === currentUserId
  })

  return rowUsers.map((user) => {
    const summary = getEmployeePerformance(user.id, tasks, options)
    return {
      ...user,
      departmentName: departments.find((department) => department.id === user.departmentId)?.name || 'Unassigned',
      summary,
    }
  })
}
