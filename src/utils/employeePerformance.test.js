import test from 'node:test'
import assert from 'node:assert/strict'
import { buildEmployeePerformanceReport, getPerformanceDateRange } from './employeePerformance.js'
import { can } from './permissions.js'

const now = new Date(2024, 4, 17, 12)
const departments = [
  { id: 'marketing', name: 'Marketing' },
  { id: 'engineering', name: 'Engineering' },
]
const users = [
  { id: 'manager', name: 'Manager', role: 'manager', departmentId: 'marketing', status: 'Active' },
  { id: 'in-scope', name: 'In Scope', role: 'executive', departmentId: 'marketing', status: 'Active' },
  { id: 'out-of-scope', name: 'Out of Scope', role: 'executive', departmentId: 'engineering', status: 'Active' },
]

test('calculates daily, weekly, monthly, last-three-full-month, and custom ranges locally', () => {
  assert.deepEqual(getPerformanceDateRange({ period: 'daily', date: '2024-05-07' }, now), { startDate: '2024-05-07', endDate: '2024-05-07' })
  assert.deepEqual(getPerformanceDateRange({ period: 'weekly', date: '2024-05-08' }, now), { startDate: '2024-05-06', endDate: '2024-05-12' })
  assert.deepEqual(getPerformanceDateRange({ period: 'monthly', month: '2024-05' }, now), { startDate: '2024-05-01', endDate: '2024-05-17' })
  assert.deepEqual(getPerformanceDateRange({ period: 'last3months' }, now), { startDate: '2024-02-01', endDate: '2024-04-30' })
  assert.deepEqual(getPerformanceDateRange({ period: 'custom', startDate: '2024-05-01', endDate: '2024-05-10' }, now), { startDate: '2024-05-01', endDate: '2024-05-10' })
  assert.ok(getPerformanceDateRange({ period: 'custom', startDate: '2024-05-11', endDate: '2024-05-10' }, now).error)
  assert.ok(getPerformanceDateRange({ period: 'daily', date: '2024-05-18' }, now).error)
})

test('restricts managers to their department and distinguishes created work from dated completions', () => {
  const tasks = [
    { id: 'in-range', title: 'New in-scope task', status: 'In Progress', assigneeId: 'in-scope', departmentId: 'marketing', createdAt: '2024-05-07T10:00:00.000Z', dueDate: '2024-05-16', subtasks: [{ id: 'subtask', title: 'Subtask', status: 'To Do', assigneeId: 'in-scope', createdAt: '2024-05-08T10:00:00.000Z' }] },
    { id: 'completed-earlier-created', title: 'Earlier task', status: 'Completed', assigneeId: 'in-scope', departmentId: 'marketing', createdAt: '2024-04-01T10:00:00.000Z', completedAt: '2024-05-09T10:00:00.000Z', dueDate: '2024-05-10', subtasks: [] },
    { id: 'outside', title: 'Out-of-scope task', status: 'Completed', assigneeId: 'out-of-scope', departmentId: 'engineering', createdAt: '2024-05-07T10:00:00.000Z', subtasks: [] },
  ]
  const report = buildEmployeePerformanceReport({
    currentUser: users[0],
    users,
    departments,
    tasks,
    range: { startDate: '2024-05-01', endDate: '2024-05-17' },
    now,
  })

  assert.deepEqual(report.employees.map((row) => row.employee.id), ['manager', 'in-scope'])
  assert.equal(report.totalCreated, 2)
  assert.equal(report.employees.find((row) => row.employee.id === 'in-scope').totalCreated, 2)
  assert.equal(report.employees.find((row) => row.employee.id === 'in-scope').completedCurrently, 0)
  assert.equal(report.employees.find((row) => row.employee.id === 'in-scope').reportItems.find((item) => item.id === 'completed-earlier-created').periodEvent, 'Completed in range')
  assert.equal(report.completedInPeriod, 1)
  assert.equal(report.assignmentDatesAvailable, false)
  assert.equal(report.pendingAtPeriodEnd, null)
})

test('supports an empty period without dividing by zero', () => {
  const report = buildEmployeePerformanceReport({
    currentUser: users[0],
    users,
    departments,
    tasks: [],
    range: { startDate: '2024-05-01', endDate: '2024-05-17' },
    now,
  })
  assert.equal(report.totalCreated, 0)
  assert.equal(report.completionRate, 0)
  assert.equal(report.overdue, 0)
  assert.equal(report.completedInPeriod, null)
})

test('computes on-time, late, and average-duration metrics only from recorded completion dates', () => {
  const report = buildEmployeePerformanceReport({
    currentUser: users[0],
    users,
    departments,
    tasks: [
      { id: 'ontime', title: 'On-time task', status: 'Completed', assigneeId: 'in-scope', departmentId: 'marketing', createdAt: '2024-05-01T10:00:00.000Z', dueDate: '2024-05-09', completedAt: '2024-05-08T10:00:00.000Z', subtasks: [] },
      { id: 'late', title: 'Late task', status: 'Completed', assigneeId: 'in-scope', departmentId: 'marketing', createdAt: '2024-05-02T10:00:00.000Z', dueDate: '2024-05-07', completedAt: '2024-05-08T10:00:00.000Z', subtasks: [] },
    ],
    range: { startDate: '2024-05-01', endDate: '2024-05-17' },
    now,
  })
  const employeeReport = report.employees.find((row) => row.employee.id === 'in-scope')
  assert.equal(employeeReport.completedInPeriod, 2)
  assert.equal(employeeReport.completedOnTime, 1)
  assert.equal(employeeReport.completedLate, 1)
  assert.equal(employeeReport.onTimeRate, 50)
  assert.equal(employeeReport.averageCompletionDays, 6.5)
})

test('grants report access only to Superadmin, Admin, and Manager', () => {
  for (const role of ['superadmin', 'admin', 'manager']) {
    assert.equal(can(role, 'report.employeePerformance'), true)
  }
  for (const role of ['hr', 'support', 'executive']) {
    assert.equal(can(role, 'report.employeePerformance'), false)
  }
})
