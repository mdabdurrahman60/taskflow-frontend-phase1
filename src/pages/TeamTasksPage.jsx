import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import TaskDescription from '../components/ui/TaskDescription'
import RoleGuard from '../components/layout/RoleGuard'
import { useApp } from '../store/useApp'
import { useToast } from '../components/ui/useToast'
import { isOverdue } from '../utils/dates'
import { canChangeTaskStatus, canViewTask } from '../permissions/taskPermissions'

function taskProgress(task) {
  const subtasks = task.subtasks || []
  if (!subtasks.length) return { completed: 0, total: 0, percent: 0 }
  const completed = subtasks.filter((subtask) => subtask.status === 'Completed').length
  return { completed, total: subtasks.length, percent: Math.round((completed / subtasks.length) * 100) }
}

export default function TeamTasksPage() {
  const { currentUser, users, departments, tasks, role, updateTask, addActivity, addNotification } = useApp()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')

  const visibleTasks = useMemo(() => {
    const scopeIds = currentUser?.scopeDepartmentIds || [currentUser.departmentId]
    return [...tasks]
      .filter((task) => {
        const matchesDepartment = departmentFilter === 'All' || task.departmentId === departmentFilter
        const matchesAssignee = assigneeFilter === 'All' || task.assigneeId === assigneeFilter
        const matchesStatus = statusFilter === 'All' || task.status === statusFilter
        const matchesSearch = !search.trim() || task.title.toLowerCase().includes(search.toLowerCase()) || task.id.toLowerCase().includes(search.toLowerCase())
        const allowed = canViewTask(currentUser, task).allowed && (['superadmin', 'admin'].includes(role) || scopeIds.includes(task.departmentId))
        return matchesDepartment && matchesAssignee && matchesStatus && matchesSearch && allowed
      })
      .sort((a, b) => new Date(a.dueDate || '9999-12-31') - new Date(b.dueDate || '9999-12-31'))
  }, [tasks, currentUser, role, search, departmentFilter, assigneeFilter, statusFilter])

  const toggleStatus = (task) => {
    const nextStatus = task.status === 'Completed' ? 'In Progress' : 'Completed'
    const updated = updateTask(task.id, { status: nextStatus })
    if (updated === false) {
      toast({ title: 'Permission denied', description: 'This task status could not be changed.', type: 'error' })
      return
    }
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'task', text: `${currentUser.name} moved ${task.title} to ${nextStatus}.`, createdAt: new Date().toISOString() })
    const recipientId = task.assigneeId === currentUser.id ? task.reporterId : task.assigneeId
    if (recipientId && recipientId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: recipientId, type: 'task', title: 'Task status updated', body: `${currentUser.name} moved "${task.title}" to ${nextStatus}.`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
  }

  return (
    <RoleGuard pageKey="team-tasks">
      <PageHeader title="Team Tasks" description="Work across your team or scope, including subtasks delegated between colleagues." />

      <Card className="mb-4">
        <CardBody className="grid gap-3 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tasks or IDs" className="h-9 w-full rounded-md border border-line bg-surface pl-9 text-[13px]" />
          </div>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All assignees</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All status</option>
            {['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {visibleTasks.map((task) => {
          const progress = taskProgress(task)
          const assignee = users.find((user) => user.id === task.assigneeId)
          const isOverdueTask = isOverdue(task.dueDate, task.status)
          return (
            <Card key={task.id}>
              <CardHeader title={task.title} subtitle={task.id} action={canChangeTaskStatus(currentUser, task).allowed && <Button size="sm" variant="secondary" onClick={() => toggleStatus(task)}>{task.status === 'Completed' ? 'Reopen' : 'Complete'}</Button>} />
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={task.priority === 'Critical' ? 'red' : task.priority === 'High' ? 'amber' : task.priority === 'Low' ? 'blue' : 'neutral'}>{task.priority}</Badge>
                  <Badge tone="neutral">{task.status}</Badge>
                  {isOverdueTask && <Badge tone="red">Overdue</Badge>}
                </div>
                {task.description && <TaskDescription value={task.description} />}

                <div className="flex items-center justify-between text-[12px] text-muted">
                  <span>{assignee?.name ?? 'Unassigned'}</span>
                  <span>{task.dueDate ? `Due ${task.dueDate}` : 'No due date'}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-muted">
                    <span>Subtask progress</span>
                    <span>{progress.completed}/{progress.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2">
                    <div className="h-2 rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} />
                  </div>
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {visibleTasks.length === 0 && (
        <Card className="mt-4">
          <CardBody className="text-center text-[13px] text-muted">No tasks match the current team filters.</CardBody>
        </Card>
      )}
    </RoleGuard>
  )
}
