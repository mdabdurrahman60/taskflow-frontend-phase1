import test from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeLegacyAppState } from './legacyDataCleanup.js'

test('legacy cleanup removes employee and department data while retaining prototype work', () => {
  const legacyState = {
    currentUserId: 'legacy-user',
    users: [{ id: 'legacy-user' }],
    departments: [{ id: 'legacy-department' }],
    notifications: [{ userId: 'legacy-user', title: 'Old notification' }],
    activity: [{ userId: 'legacy-user', text: 'Old activity' }],
    preferences: { compactMode: true },
    tasks: [{
      id: 'task-1',
      title: 'Prototype task',
      status: 'In Progress',
      assigneeId: 'legacy-user',
      departmentId: 'legacy-department',
      comments: [{ userId: 'legacy-user', text: 'Comment retained' }],
      subtasks: [{ id: 'subtask-1', assigneeId: 'legacy-user', departmentId: 'legacy-department', comments: [{ userId: 'legacy-user', text: 'Subtask comment retained' }] }],
    }],
    tickets: [{
      id: 'ticket-1',
      title: 'Prototype ticket',
      requesterId: 'legacy-user',
      assigneeId: 'legacy-user',
      departmentId: 'legacy-department',
      updates: [{ authorId: 'legacy-user', message: 'Update retained' }],
    }],
    projects: [{
      id: 'project-1',
      name: 'Prototype project',
      projectManagerId: 'legacy-user',
      ownerId: 'legacy-user',
      createdBy: 'legacy-user',
      teamMemberIds: ['legacy-user'],
      departmentId: 'legacy-department',
    }],
  }

  const cleaned = sanitizeLegacyAppState(legacyState)

  assert.deepEqual(cleaned.users, [])
  assert.deepEqual(cleaned.departments, [])
  assert.equal(cleaned.currentUserId, null)
  assert.deepEqual(cleaned.notifications, [])
  assert.deepEqual(cleaned.activity, [])
  assert.deepEqual(cleaned.preferences, { compactMode: true })
  assert.equal(cleaned.tasks[0].title, 'Prototype task')
  assert.equal(cleaned.tasks[0].assigneeId, null)
  assert.equal(cleaned.tasks[0].departmentId, null)
  assert.equal('userId' in cleaned.tasks[0].comments[0], false)
  assert.equal(cleaned.tasks[0].subtasks[0].assigneeId, null)
  assert.equal(cleaned.tasks[0].subtasks[0].departmentId, null)
  assert.equal('userId' in cleaned.tasks[0].subtasks[0].comments[0], false)
  assert.equal(cleaned.tickets[0].requesterId, null)
  assert.equal(cleaned.tickets[0].assigneeId, null)
  assert.equal(cleaned.tickets[0].departmentId, null)
  assert.equal('authorId' in cleaned.tickets[0].updates[0], false)
  assert.equal(cleaned.projects[0].projectManagerId, null)
  assert.deepEqual(cleaned.projects[0].teamMemberIds, [])
  assert.equal(cleaned.projects[0].departmentId, null)
})
