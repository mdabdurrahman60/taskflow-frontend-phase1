import test from 'node:test'
import assert from 'node:assert/strict'
import { MOCK_USERS } from '../data/mockUsers.js'
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

const user = (id) => MOCK_USERS.find((person) => person.id === id)
const superadmin = user('u-kamal')
const admin = user('u-farhana')
const manager = user('u-imran')
const hr = user('u-maliha')
const support = user('u-arif')
const executive = user('u-ayesha')
const activeManagerInHR = { ...manager, id: 'u-hr-manager', departmentId: 'd-hr' }
const supportInHR = { ...support, id: 'u-hr-support', departmentId: 'd-hr' }
const executiveInHR = { ...executive, id: 'u-hr-executive', departmentId: 'd-hr' }
const marketingTask = { id: 'T-1', departmentId: 'd-mkt', projectId: 'p-launch', taskType: 'operational', assigneeId: executive.id, reporterId: manager.id }
const hrTask = { id: 'T-2', departmentId: 'd-hr', projectId: 'p-people', taskType: 'hr', assigneeId: hr.id }
const itTicket = { id: 'TKT-1', departmentId: 'd-it', requesterId: executive.id, assigneeId: support.id, status: 'Open' }

const assertAllowed = (result) => assert.equal(result.allowed, true, result.reason)
const assertDenied = (result) => assert.equal(result.allowed, false)

test('Superadmin can assign active users across departments but not inactive users', () => {
  assertAllowed(canCreateTask(superadmin, { departmentId: 'd-fin', taskType: 'operational' }))
  assertAllowed(canAssignTask(superadmin, user('u-shafiq'), { departmentId: 'd-eng', taskType: 'operational' }))
  assertDenied(canAssignTask(superadmin, user('u-sohel'), { departmentId: 'd-ops', taskType: 'operational' }))
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
  assertDenied(canAssignTask(manager, user('u-shafiq'), { departmentId: 'd-eng', taskType: 'operational' }))
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
  const operationsSupport = user('u-nabila')
  assertDenied(canViewTask(operationsSupport, { id: 'T-IT', departmentId: 'd-it', assigneeId: null, reporterId: null }))
  assertAllowed(canViewTask(operationsSupport, { id: 'T-OPS', departmentId: 'd-ops', assigneeId: null, reporterId: null }))
  assertDenied(canAssignSubtask(support, executive, { id: 'T-IT', departmentId: 'd-it', assigneeId: support.id }))
})

test('Executive can self-assign personal work and collaborate only through eligible subtasks', () => {
  assertAllowed(canCreateTask(executive, { departmentId: 'd-mkt', taskType: 'personal' }))
  assertDenied(canCreateTask(executive, { departmentId: 'd-mkt', taskType: 'operational' }))
  assertDenied(canAssignTask(executive, manager, { departmentId: 'd-mkt', taskType: 'personal' }))
  assertAllowed(canCreateSubtask(executive, marketingTask))
  assertAllowed(canAssignSubtask(executive, user('u-sarah'), marketingTask))
  assertDenied(canAssignSubtask(executive, manager, marketingTask))
  assertDenied(canAssignSubtask(executive, user('u-shafiq'), marketingTask))
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
  const managerAssignees = getEligibleTaskAssignees({ user: manager, users: MOCK_USERS, taskContext: { departmentId: 'd-mkt', taskType: 'operational' } })
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
  assertAllowed(canManageUser(admin, user('u-arif'), { title: 'Updated title' }))
  assertDenied(canManageUser(admin, user('u-arif'), { role: 'manager' }))
  assertDenied(canManageUser(admin, superadmin, { title: 'Unauthorized' }))
  assertAllowed(canManageUser(admin, null, { role: 'executive', departmentId: 'd-it' }))
  assertDenied(canManageUser(admin, null, { role: 'hr', departmentId: 'd-hr' }))
})

test('Ticket view, update, assignment, escalation, and department moves are scoped', () => {
  assertAllowed(canViewTicket(support, itTicket))
  assertAllowed(canUpdateTicket(support, itTicket))
  assertAllowed(canAssignTicket(support, itTicket, user('u-tasnim')))
  assertAllowed(canEscalateTicket(support, itTicket))
  assertDenied(canUpdateTicket(manager, { ...itTicket, departmentId: 'd-it', requesterId: null, assigneeId: null }))
  assertAllowed(canChangeTicketDepartment(admin, { ...itTicket, departmentId: 'd-it' }, 'd-hr'))
  assertDenied(canChangeTicketDepartment(manager, itTicket, 'd-mkt'))
  assertAllowed(canCreateTicket(executive, { title: 'Help request', requesterId: executive.id, assigneeId: executive.id }))
})
