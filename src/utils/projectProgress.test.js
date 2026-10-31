import test from 'node:test'
import assert from 'node:assert/strict'
import { getProjectProgress } from './projectProgress.js'

test('project progress is zero for a project with no tasks', () => {
  assert.deepEqual(getProjectProgress([]), { completed: 0, total: 0, pending: 0, percent: 0 })
})

test('project progress derives completed and pending counts directly from current task states', () => {
  const tasks = [{ status: 'Completed' }, { status: 'In Progress' }, { status: 'Cancelled' }]
  assert.deepEqual(getProjectProgress(tasks), { completed: 1, total: 3, pending: 2, percent: 33 })
  tasks[1].status = 'Completed'
  assert.deepEqual(getProjectProgress(tasks), { completed: 2, total: 3, pending: 1, percent: 67 })
})
