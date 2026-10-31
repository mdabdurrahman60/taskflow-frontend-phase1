import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canAssociateTaskWithProject,
  canManageProject,
  canViewProject,
  eligibleProjectManagers,
  eligibleProjectMembers,
} from './projectPermissions.js'

const project = { id: 'p-1', departmentId: 'd-mkt', projectManagerId: 'manager-1', teamMemberIds: ['exec-1'] }
const user = (role, id, departmentId, scopeDepartmentIds) => ({ role, id, departmentId, scopeDepartmentIds })

test('project management is limited to privileged roles and department scope', () => {
  assert.equal(canManageProject(user('superadmin', 'root', 'd-ops')), true)
  assert.equal(canManageProject(user('admin', 'admin', 'd-ops', ['d-ops'])), true)
  assert.equal(canManageProject(user('manager', 'manager-1', 'd-mkt')), true)
  for (const role of ['hr', 'support', 'executive']) {
    assert.equal(canManageProject(user(role, 'member', 'd-mkt')), false)
  }
  assert.equal(canManageProject(user('superadmin', 'root', 'd-ops'), project), true)
  assert.equal(canManageProject(user('admin', 'admin', 'd-ops', ['d-ops', 'd-mkt']), project), true)
  assert.equal(canManageProject(user('admin', 'admin', 'd-ops', ['d-ops']), project), false)
  assert.equal(canManageProject(user('manager', 'manager-1', 'd-mkt'), project), true)
  assert.equal(canManageProject(user('manager', 'manager-2', 'd-eng'), project), false)
  for (const role of ['hr', 'support', 'executive']) {
    assert.equal(canManageProject(user(role, 'member', 'd-mkt'), project), false)
  }
})

test('project visibility follows organizational scope and explicit membership', () => {
  assert.equal(canViewProject(user('superadmin', 'root', 'd-ops'), project), true)
  assert.equal(canViewProject(user('admin', 'admin', 'd-ops', ['d-ops']), project), false)
  assert.equal(canViewProject(user('manager', 'manager-2', 'd-eng'), project), false)
  assert.equal(canViewProject(user('executive', 'exec-1', 'd-ops'), project), true)
  assert.equal(canViewProject(user('executive', 'unassigned', 'd-mkt'), project), false)
  assert.equal(canViewProject(user('hr', 'other', 'd-hr'), project), false)
})

test('non-manager roles can see linked projects only through existing task visibility or membership', () => {
  const peopleProject = { id: 'people', departmentId: 'd-hr', projectManagerId: null, teamMemberIds: [] }
  const hrTask = { projectId: 'people', departmentId: 'd-hr', assigneeId: 'someone-else', reporterId: 'someone-else' }
  const privateTask = { projectId: 'people', departmentId: 'd-fin', assigneeId: 'someone-else', reporterId: 'someone-else' }
  assert.equal(canViewProject(user('hr', 'hr-1', 'd-hr'), peopleProject, [hrTask]), true)
  assert.equal(canViewProject(user('hr', 'hr-1', 'd-hr'), peopleProject, [privateTask]), false)
  assert.equal(canViewProject(user('executive', 'exec-1', 'd-mkt'), project, [{ ...hrTask, projectId: project.id, departmentId: 'd-mkt', assigneeId: 'exec-1' }]), true)
})

test('manager project members are limited to active support staff and executives in department', () => {
  const manager = user('manager', 'manager-1', 'd-mkt')
  const users = [
    { id: 'exec', role: 'executive', departmentId: 'd-mkt', status: 'Active' },
    { id: 'support', role: 'support', departmentId: 'd-mkt', status: 'Active' },
    { id: 'manager', role: 'manager', departmentId: 'd-mkt', status: 'Active' },
    { id: 'inactive', role: 'executive', departmentId: 'd-mkt', status: 'Inactive' },
    { id: 'other', role: 'executive', departmentId: 'd-eng', status: 'Active' },
  ]
  assert.deepEqual(eligibleProjectMembers(manager, users, 'd-mkt').map(({ id }) => id), ['exec', 'support'])
})

test('superadmin and admin project assignments follow organization-wide and authorized scopes', () => {
  const users = [
    { id: 'manager-mkt', role: 'manager', departmentId: 'd-mkt', status: 'Active' },
    { id: 'exec-ops', role: 'executive', departmentId: 'd-ops', status: 'Active' },
    { id: 'exec-fin', role: 'executive', departmentId: 'd-fin', status: 'Active' },
    { id: 'root', role: 'superadmin', departmentId: 'd-ops', status: 'Active' },
  ]
  const superadmin = user('superadmin', 'root', 'd-ops')
  const admin = user('admin', 'admin-1', 'd-ops', ['d-ops', 'd-mkt'])
  assert.deepEqual(eligibleProjectMembers(superadmin, users, 'd-mkt').map(({ id }) => id), ['manager-mkt', 'exec-ops', 'exec-fin', 'root'])
  assert.deepEqual(eligibleProjectMembers(admin, users, 'd-mkt').map(({ id }) => id), ['manager-mkt', 'exec-ops'])
  assert.deepEqual(eligibleProjectManagers(admin, users, 'd-mkt').map(({ id }) => id), ['manager-mkt'])
  assert.deepEqual(eligibleProjectMembers(admin, users, 'd-fin'), [])
})

test('task association requires visible project and matching department', () => {
  assert.equal(canAssociateTaskWithProject(user('manager', 'manager-1', 'd-mkt'), project, 'd-mkt'), true)
  assert.equal(canAssociateTaskWithProject(user('manager', 'manager-1', 'd-mkt'), project, 'd-eng'), false)
  assert.equal(canAssociateTaskWithProject(user('executive', 'other', 'd-ops'), project, 'd-mkt'), false)
})
