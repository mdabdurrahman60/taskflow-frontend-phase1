import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmployeePerformancePdf, createTeamPerformancePdf } from './employeePerformancePdf.js'

const range = { startDate: '2024-01-01', endDate: '2024-01-31' }

function makeEmployeeReport(index, itemCount) {
  const employee = {
    id: `employee-${index}`,
    name: `Employee ${index}`,
    roleLabel: 'Executive',
    departmentName: 'Marketing',
  }
  const items = Array.from({ length: itemCount }, (_, itemIndex) => ({
    id: `task-${index}-${itemIndex}`,
    workItemType: 'Task',
    title: `Task ${itemIndex} with a deliberately long title that should wrap safely on the PDF page`,
    status: itemIndex % 3 ? 'In Progress' : 'Completed',
    periodEvent: 'Created in range',
    createdAt: '2024-01-05T10:00:00.000Z',
    dueDate: '2024-01-20',
  }))
  return {
    employee,
    items,
    reportItems: items,
    totalCreated: itemCount,
    completedCurrently: Math.ceil(itemCount / 3),
    inProgress: itemCount - Math.ceil(itemCount / 3),
    pending: 0,
    overdue: 0,
    completionRate: itemCount ? Math.round((Math.ceil(itemCount / 3) / itemCount) * 100) : 0,
    completedInPeriod: 0,
    completedInPeriodAvailable: false,
    completionDatesAvailable: false,
    completedOnTime: 0,
    completedLate: 0,
    onTimeRate: null,
    averageCompletionDays: null,
    pendingAtPeriodEnd: null,
  }
}

function makeReport(employeeCount, itemCount) {
  const employees = Array.from({ length: employeeCount }, (_, index) => makeEmployeeReport(index + 1, itemCount))
  const totalCreated = employeeCount * itemCount
  const completedCurrently = employees.reduce((total, employee) => total + employee.completedCurrently, 0)
  return {
    employees,
    totalEmployees: employeeCount,
    totalCreated,
    completedCurrently,
    completionRate: totalCreated ? Math.round((completedCurrently / totalCreated) * 100) : 0,
    overdue: 0,
    completedInPeriod: null,
    completionDatesAvailable: false,
  }
}

test('individual PDF task tables paginate instead of truncating long reports', () => {
  const report = makeReport(1, 80)
  const doc = createEmployeePerformancePdf({ report, range, employee: report.employees[0].employee })
  assert.ok(doc.internal.getNumberOfPages() > 1)
})

test('team PDF comparison and employee task tables paginate across many employees', () => {
  const report = makeReport(12, 15)
  const doc = createTeamPerformancePdf({ report, range, statusLabel: 'All statuses' })
  assert.ok(doc.internal.getNumberOfPages() > 1)
})
