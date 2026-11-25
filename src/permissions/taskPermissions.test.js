import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canAssignSubtask,
  canAssignTask,
  canAssignTicket,
  canChangeTaskDepartment,
  canChangeTicketDepartment,
  canChangeTaskStatus,
  canCreateDepartment,
  canCreateSubtask,
  canCreateTask,
  canCreateTicket,
  canDeleteTask,
  canEscalateTicket,
  canManageDepartment,
  canManageUser,
  canReassignTask,
  canUpdateTicket,
  canViewTask,
  canViewTicket,
  getEligibleTaskAssignees,
} from './taskPermissions.js'

const testUserDetails = {
  superadmin: ['superadmin', 'd-ops', 'Active'],
  admin: ['admin', 'd-ops', 'Active', ['d-it', 'd-ops', 'd-hr']],
  manager: ['manager', 'd-mkt', 'Active'],
  hr: ['hr', 'd-hr', 'Active'],
  support: ['support', 'd-it', 'Active'],
  executive: ['executive', 'd-mkt', 'Active'],
  inactive: ['support', 'd-ops', 'Inactive'],
  engineeringSupport: ['support', 'd-eng', 'Active'],
  operationsSupport: ['support', 'd-ops', 'Active'],
  teammate: ['executive', 'd-mkt', 'Active'],
  itSupport: ['support', 'd-it', 'Active'],
}
const user = (id) => {
  const [role, departmentId, status, scopeDepartmentIds] = testUserDetails[id]
  return { id, role, departmentId, status, scopeDepartmentIds, name: 'Test User', title: 'Test role' }
}
const superadmin = user('superadmin')
const admin = user('admin')
const manager = user('manager')
const hr = user('hr')
const support = user('support')
const executive = user('executive')
const activeManagerInHR = { ...manager, id: 'manager-in-hr-test', departmentId: 'd-hr' }
const supportInHR = { ...support, id: 'support-in-hr-test', departmentId: 'd-hr' }
const executiveInHR = { ...executive, id: 'executive-in-hr-test', departmentId: 'd-hr' }
const marketingTask = { id: 'T-1', departmentId: 'd-mkt', projectId: 'p-launch', taskType: 'operational', assigneeId: executive.id, reporterId: manager.id }
const hrTask = { id: 'T-2', departmentId: 'd-hr', projectId: 'p-people', taskType: 'hr', assigneeId: hr.id }
const itTicket = { id: 'TKT-1', departmentId: 'd-it', requesterId: executive.id, assigneeId: support.id, status: 'Open' }

const assertAllowed = (result) => assert.equal(result.allowed, true, result.reason)
const assertDenied = (result) => assert.equal(result.allowed, false)

test('Superadmin can assign active users across departments but not inactive users', () => {
  assertAllowed(canCreateTask(superadmin, { departmentId: 'd-fin', taskType: 'operational' }))
  assertAllowed(canAssignTask(superadmin, user('engineeringSupport'), { departmentId: 'd-eng', taskType: 'operational' }))
  assertDenied(canAssignTask(superadmin, user('inactive'), { departmentId: 'd-ops', taskType: 'operational' }))
})

test('Admin assignments respect scope and cannot target Superadmin or peer Admins', () => {
  assertAllowed(canAssignTask(admin, support, { departmentId: 'd-it', taskType: 'support' }))
  assertAllowed(canAssignTask(admin, hr, { departmentId: 'd-hr', taskType: 'hr' }))
  assertDenied(canAssignTask(admin, superadmin, { departmentId: 'd-ops', taskType: 'operational' }))
  assertDenied(canAssignTask(admin, manager, { departmentId: 'd-eng', taskType: 'operational' }))
  assertDenied(canAssignTask(admin, { ...admin, id: 'other-admin' }, { departmentId: 'd-ops', taskType: 'operational' }))
})

test('Manager task assignment is self or Support/Executive in the same department', () => {
  assertAllowed(canAssignTask(manager, manager, { departmentId: 'd-mkt', taskType: 'operational' }))
  assertAllowed(canAssignTask(manager, executive, { departmentId: 'd-mkt', taskType: 'operational' }))
  assertDenied(canAssignTask(manager, hr, { departmentId: 'd-mkt', taskType: 'operational' }))
  assertDenied(canAssignTask(manager, user('engineeringSupport'), { departmentId: 'd-eng', taskType: 'operational' }))
  assertDenied(canAssignTask(manager, executive, { departmentId: 'd-mkt', taskType: 'hr' }))
})

test('HR assignments require HR work and eligible HR workflow targets', () => {
  assertAllowed(canCreateTask(hr, { departmentId: 'd-hr', taskType: 'onboarding' }))
  assertDenied(canCreateTask(hr, { departmentId: 'd-mkt', taskType: 'operational' }))
  assertAllowed(canAssignTask(hr, activeManagerInHR, { departmentId: 'd-hr', taskType: 'compliance' }))
  assertAllowed(canAssignTask(hr, supportInHR, { departmentId: 'd-hr', taskType: 'employee documentation' }))
  assertAllowed(canAssignTask(hr, executiveInHR, { departmentId: 'd-hr', taskType: 'workplace request' }))
  assertDenied(canAssignTask(hr, superadmin, { departmentId: 'd-hr', taskType: 'hr' }))
})

test('Support cannot assign arbitrary top-level work and can follow up only own assigned tickets', () => {
  assertDenied(canCreateTask(support, { departmentId: 'd-it', taskType: 'support' }))
  assertDenied(canAssignTask(support, executive, { departmentId: 'd-it', taskType: 'support' }))
  assertAllowed(canCreateTask(support, { departmentId: 'd-it', taskType: 'support', isTicketFollowUp: true, sourceTicketAssignedTo: support.id }))
  assertAllowed(canAssignTask(support, support, { departmentId: 'd-it', taskType: 'support', isTicketFollowUp: true, sourceTicketAssignedTo: support.id }))
  assertDenied(canCreateTask(support, { departmentId: 'd-it', taskType: 'support', isTicketFollowUp: true, sourceTicketAssignedTo: executive.id }))
  const operationsSupport = user('operationsSupport')
  assertDenied(canViewTask(operationsSupport, { id: 'T-IT', departmentId: 'd-it', assigneeId: null, reporterId: null }))
  assertAllowed(canViewTask(operationsSupport, { id: 'T-OPS', departmentId: 'd-ops', assigneeId: null, reporterId: null }))
  assertDenied(canAssignSubtask(support, executive, { id: 'T-IT', departmentId: 'd-it', assigneeId: support.id }))
})

test('Executive can self-assign personal work and collaborate only through eligible subtasks', () => {
  assertAllowed(canCreateTask(executive, { departmentId: 'd-mkt', taskType: 'personal' }))
  assertDenied(canCreateTask(executive, { departmentId: 'd-mkt', taskType: 'operational' }))
  assertDenied(canAssignTask(executive, manager, { departmentId: 'd-mkt', taskType: 'personal' }))
  assertAllowed(canCreateSubtask(executive, marketingTask))
  assertAllowed(canAssignSubtask(executive, user('teammate'), marketingTask))
  assertDenied(canAssignSubtask(executive, manager, marketingTask))
  assertDenied(canAssignSubtask(executive, user('engineeringSupport'), marketingTask))
})

test('Task view, edit, status, delete, and reassignment honor role scope', () => {
  assertAllowed(canViewTask(manager, marketingTask))
  assertDenied(canViewTask(manager, { ...marketingTask, departmentId: 'd-eng', reporterId: null, assigneeId: null }))
  assertAllowed(canChangeTaskStatus(executive, marketingTask))
  assertDenied(canChangeTaskStatus(executive, { ...marketingTask, assigneeId: manager.id, reporterId: null }))
  assertDenied(canChangeTaskDepartment(manager, marketingTask, 'd-eng'))
  assertAllowed(canReassignTask(manager, marketingTask, executive))
  assertDenied(canReassignTask(manager, marketingTask, hr))
  assertDenied(canDeleteTask(manager, { ...marketingTask, departmentId: 'd-eng' }))
})

test('Task and subtask assignee lists contain only eligible active users', () => {
  const users = Object.keys(testUserDetails).map(user)
  const managerAssignees = getEligibleTaskAssignees({ user: manager, users, taskContext: { departmentId: 'd-mkt', taskType: 'operational' } })
  assert.ok(managerAssignees.some((person) => person.id === manager.id))
  assert.ok(managerAssignees.every((person) => person.departmentId === 'd-mkt' && person.status === 'Active'))
  assert.ok(managerAssignees.every((person) => !['admin', 'superadmin', 'hr'].includes(person.role)))
})

test('Department management is restricted to Superadmin and Admin scope', () => {
  assertAllowed(canCreateDepartment(superadmin))
  assertDenied(canCreateDepartment(admin))
  assertAllowed(canManageDepartment(admin, { id: 'd-it' }))
  assertDenied(canManageDepartment(admin, { id: 'd-mkt' }))
  assertDenied(canManageDepartment(manager, { id: 'd-mkt' }))
})

test('Employee management prevents Admin role changes and protects Superadmin', () => {
  assertAllowed(canManageUser(admin, support, { title: 'Updated title' }))
  assertDenied(canManageUser(admin, support, { role: 'manager' }))
  assertDenied(canManageUser(admin, superadmin, { title: 'Unauthorized' }))
  assertAllowed(canManageUser(admin, null, { role: 'executive', departmentId: 'd-it' }))
  assertDenied(canManageUser(admin, null, { role: 'hr', departmentId: 'd-hr' }))
})

test('Ticket view, update, assignment, escalation, and department moves are scoped', () => {
  assertAllowed(canViewTicket(support, itTicket))
  assertAllowed(canUpdateTicket(support, itTicket))
  assertAllowed(canAssignTicket(support, itTicket, user('itSupport')))
  assertAllowed(canEscalateTicket(support, itTicket))
  assertDenied(canUpdateTicket(manager, { ...itTicket, departmentId: 'd-it', requesterId: null, assigneeId: null }))
  assertAllowed(canChangeTicketDepartment(admin, { ...itTicket, departmentId: 'd-it' }, 'd-hr'))
  assertDenied(canChangeTicketDepartment(manager, itTicket, 'd-mkt'))
  assertAllowed(canCreateTicket(executive, { title: 'Help request', requesterId: executive.id, assigneeId: executive.id }))
})
