import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Check, ChevronDown, Eye, Filter, ListFilter, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import RoleGuard from '../components/layout/RoleGuard'
import { useApp } from '../store/useApp'
import { useToast } from '../components/ui/useToast'
import Avatar from '../components/ui/Avatar'
import TaskDescription from '../components/ui/TaskDescription'
import { isOverdue, timeAgo } from '../utils/dates'
import { sanitizeTaskDescriptionHtml, taskDescriptionToHtml } from '../utils/taskDescription'
import {
  canAssignSubtask,
  canAssignTask,
  canChangeTaskStatus,
  canChangeTaskDepartment,
  canCreateSubtask,
  canCreateTask,
  canDeleteTask,
  canEditTask,
  canReassignTask,
  canViewTask,
  getEligibleSubtaskAssignees,
  getEligibleTaskAssignees,
  normalizeTaskType,
} from '../permissions/taskPermissions'

const ALL = 'All'
const RichTextEditor = lazy(() => import('../components/ui/RichTextEditor'))

const defaultTaskForm = (user) => ({
  title: '',
  description: '',
  status: 'To Do',
  priority: 'Medium',
  taskType: user.role === 'hr' ? 'hr' : user.role === 'executive' ? 'personal' : user.role === 'support' ? 'support' : 'operational',
  assigneeId: user.id,
  departmentId: user.departmentId,
  projectId: 'p-launch',
  tags: '',
  parentTaskId: '',
  dueDate: '',
})

function taskProgress(task) {
  if (!task.subtasks?.length) return { completed: 0, total: 0, percent: 0 }
  const completed = task.subtasks.filter((subtask) => subtask.status === 'Completed').length
  return { completed, total: task.subtasks.length, percent: Math.round((completed / task.subtasks.length) * 100) }
}

function priorityTone(priority) {
  return priority === 'Critical' ? 'red' : priority === 'High' ? 'amber' : priority === 'Low' ? 'blue' : 'neutral'
}

export default function MyTasksPage() {
  const { currentUser, users, departments, tasks, updateTask, createTask, deleteTask, addTaskComment, addSubtask, updateSubtask, deleteSubtask, addSubtaskComment, addNotification, addActivity } = useApp()
  const previousUserId = useRef(currentUser.id)
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const [selectedTaskId, setSelectedTaskId] = useState(tasks[0]?.id ?? null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [priorityFilter, setPriorityFilter] = useState(ALL)
  const [assigneeFilter, setAssigneeFilter] = useState(ALL)
  const [departmentFilter, setDepartmentFilter] = useState(ALL)
  const [dueFilter, setDueFilter] = useState(ALL)
  const [sortBy, setSortBy] = useState('dueDate')
  const [viewMode, setViewMode] = useState('list')
  const [taskModalOpen, setTaskModalOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [taskForm, setTaskForm] = useState(defaultTaskForm(currentUser))
  const [taskErrors, setTaskErrors] = useState({})
  const [newComment, setNewComment] = useState('')
  const [newSubtask, setNewSubtask] = useState({ title: '', assigneeId: currentUser.id, dueDate: '', description: '', priority: 'Medium', status: 'To Do' })
  const [subtaskErrors, setSubtaskErrors] = useState({})

  const eligibleTaskAssignees = useMemo(() => {
    const selectedParent = tasks.find((task) => task.id === taskForm.parentTaskId)
    if (selectedParent) return getEligibleSubtaskAssignees({ user: currentUser, users, parentTask: selectedParent })
    const context = {
      departmentId: taskForm.departmentId || currentUser.departmentId,
      projectId: taskForm.projectId || 'p-launch',
      taskType: taskForm.taskType,
    }
    return getEligibleTaskAssignees({ user: currentUser, users, taskContext: context })
  }, [currentUser, taskForm.departmentId, taskForm.parentTaskId, taskForm.projectId, tasks, users])

  useEffect(() => {
    if (eligibleTaskAssignees.length && !eligibleTaskAssignees.some((user) => user.id === taskForm.assigneeId)) {
      setTaskForm((form) => ({ ...form, assigneeId: eligibleTaskAssignees[0].id }))
    }
  }, [eligibleTaskAssignees, taskForm.assigneeId])

  useEffect(() => {
    if (searchParams.get('new') === 'task') {
      openNewTaskModal()
      setSearchParams({})
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (previousUserId.current === currentUser.id) return
    previousUserId.current = currentUser.id
    setTaskModalOpen(false)
    setTaskForm(defaultTaskForm(currentUser))
    setNewSubtask({ title: '', assigneeId: currentUser.id, dueDate: '', description: '', priority: 'Medium', status: 'To Do' })
  }, [currentUser.id])

  useEffect(() => {
    if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0]?.id ?? null)
    }
  }, [selectedTaskId, tasks])

  const visibleTasks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...tasks]
      .filter((task) => canViewTask(currentUser, task).allowed)
      .filter((task) => {
        const matchesQuery = !q || task.title.toLowerCase().includes(q) || task.id.toLowerCase().includes(q)
        const matchesStatus = statusFilter === ALL || task.status === statusFilter
        const matchesPriority = priorityFilter === ALL || task.priority === priorityFilter
        const matchesAssignee = assigneeFilter === ALL || task.assigneeId === assigneeFilter
        const matchesDept = departmentFilter === ALL || task.departmentId === departmentFilter
        const matchesDue =
          dueFilter === ALL ||
          (dueFilter === 'overdue' && isOverdue(task.dueDate, task.status)) ||
          (dueFilter === 'soon' && task.dueDate && !isOverdue(task.dueDate, task.status) && new Date(task.dueDate) <= new Date(Date.now() + 5 * 86400000)) ||
          (dueFilter === 'noDueDate' && !task.dueDate)
        return matchesQuery && matchesStatus && matchesPriority && matchesAssignee && matchesDept && matchesDue
      })
      .sort((a, b) => {
        if (sortBy === 'dueDate') return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31')
        if (sortBy === 'priority') return (['Critical', 'High', 'Medium', 'Low'].indexOf(b.priority) - ['Critical', 'High', 'Medium', 'Low'].indexOf(a.priority))
        return new Date(b.createdAt) - new Date(a.createdAt)
      })
  }, [tasks, currentUser, search, statusFilter, priorityFilter, assigneeFilter, departmentFilter, dueFilter, sortBy])

  const selectedTask = visibleTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? null
  const eligibleSubtaskAssignees = useMemo(
    () => getEligibleSubtaskAssignees({ user: currentUser, users, parentTask: selectedTask }),
    [currentUser, selectedTask, users],
  )

  useEffect(() => {
    if (eligibleSubtaskAssignees.length && !eligibleSubtaskAssignees.some((user) => user.id === newSubtask.assigneeId)) {
      setNewSubtask((form) => ({ ...form, assigneeId: eligibleSubtaskAssignees[0].id }))
    } else if (!eligibleSubtaskAssignees.length && newSubtask.assigneeId) {
      setNewSubtask((form) => ({ ...form, assigneeId: '' }))
    }
  }, [eligibleSubtaskAssignees, newSubtask.assigneeId])

  const openNewTaskModal = () => {
    setEditingTaskId(null)
    setTaskForm(defaultTaskForm(currentUser))
    setTaskErrors({})
    setTaskModalOpen(true)
  }

  const openEditTask = (task) => {
    setEditingTaskId(task.id)
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      taskType: task.taskType || normalizeTaskType(task),
      assigneeId: task.assigneeId,
      departmentId: task.departmentId,
      projectId: task.projectId || 'p-launch',
      tags: (task.tags || []).join(', '),
      parentTaskId: task.parentTaskId || '',
      dueDate: task.dueDate || '',
    })
    setTaskErrors({})
    setTaskModalOpen(true)
  }

  const validateTaskForm = () => {
    const errors = {}
    if (!taskForm.title.trim()) errors.title = 'Task title is required.'
    if (!taskForm.assigneeId) errors.assigneeId = 'Choose an assignee.'
    if (!taskForm.dueDate) errors.dueDate = 'Due date is required.'
    if (!taskForm.departmentId) errors.departmentId = 'Department is required.'

    const targetUser = users.find((user) => user.id === taskForm.assigneeId)
    const permissionContext = {
      departmentId: taskForm.departmentId,
      projectId: taskForm.projectId,
      taskType: taskForm.taskType,
    }
    const parentTask = taskForm.parentTaskId ? tasks.find((task) => task.id === taskForm.parentTaskId) : null

    if (targetUser) {
      const existingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : null
      const check = parentTask
        ? canAssignSubtask(currentUser, targetUser, parentTask)
        : editingTaskId
          ? existingTask?.assigneeId !== targetUser.id
            ? canReassignTask(currentUser, existingTask, targetUser)
            : canEditTask(currentUser, existingTask)
          : canAssignTask(currentUser, targetUser, permissionContext)

      if (!check.allowed) {
        errors.assigneeId = check.reason
      }
    }

    const createCheck = editingTaskId
      ? canEditTask(currentUser, tasks.find((task) => task.id === editingTaskId))
      : parentTask
        ? canCreateSubtask(currentUser, parentTask)
        : canCreateTask(currentUser, permissionContext)
    if (!createCheck.allowed) {
      errors.permission = createCheck.reason
    }
    const editingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : null
    if (editingTask && editingTask.status !== taskForm.status) {
      const statusCheck = canChangeTaskStatus(currentUser, editingTask)
      if (!statusCheck.allowed) errors.permission = statusCheck.reason
    }
    if (editingTask && editingTask.departmentId !== taskForm.departmentId) {
      const departmentCheck = canChangeTaskDepartment(currentUser, editingTask, taskForm.departmentId)
      if (!departmentCheck.allowed) errors.permission = departmentCheck.reason
    }

    return errors
  }

  const handleTaskPermissionError = (check) => {
    if (!check?.allowed) {
      toast({ title: 'Permission denied', description: check?.reason ?? 'You do not have access to this action.', type: 'error' })
      return true
    }
    return false
  }

  const handleTaskSave = (event) => {
    event.preventDefault()
    const errors = validateTaskForm()
    setTaskErrors(errors)
    if (Object.keys(errors).length) return

    const targetUser = users.find((user) => user.id === taskForm.assigneeId)
    const permissionContext = {
      departmentId: taskForm.departmentId,
      projectId: taskForm.projectId,
      taskType: taskForm.taskType,
    }

    const existingTask = editingTaskId ? tasks.find((task) => task.id === editingTaskId) : null
    const parentTask = taskForm.parentTaskId ? tasks.find((task) => task.id === taskForm.parentTaskId) : null
    const permissionCheck = editingTaskId
      ? canEditTask(currentUser, existingTask)
      : parentTask
        ? canCreateSubtask(currentUser, parentTask)
        : canCreateTask(currentUser, permissionContext)

    if (handleTaskPermissionError(permissionCheck)) return
    const assignmentCheck = parentTask
      ? canAssignSubtask(currentUser, targetUser, parentTask)
      : editingTaskId && existingTask.assigneeId !== targetUser.id
        ? canReassignTask(currentUser, existingTask, targetUser)
        : canAssignTask(currentUser, targetUser, permissionContext)
    if (handleTaskPermissionError(assignmentCheck)) return
    if (editingTaskId && existingTask.status !== taskForm.status && handleTaskPermissionError(canChangeTaskStatus(currentUser, existingTask))) return
    if (editingTaskId && existingTask.departmentId !== taskForm.departmentId && handleTaskPermissionError(canChangeTaskDepartment(currentUser, existingTask, taskForm.departmentId))) return

    if (!editingTaskId && parentTask) {
      const subtask = {
        id: `S-${Math.floor(Math.random() * 90000) + 10000}`,
        title: taskForm.title.trim(),
        description: sanitizeTaskDescriptionHtml(taskDescriptionToHtml(taskForm.description)),
        assigneeId: taskForm.assigneeId,
        creatorId: currentUser.id,
        status: taskForm.status,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || null,
        tags: taskForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        createdAt: new Date().toISOString(),
        comments: [],
      }
      const createdId = addSubtask(parentTask.id, subtask)
      if (!createdId) {
        toast({ title: 'Subtask not created', description: 'The parent task or selected assignee is no longer eligible.', type: 'error' })
        return
      }
      addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'subtask', text: `${currentUser.name} created the subtask "${subtask.title}" on ${parentTask.title}.`, createdAt: new Date().toISOString() })
      if (subtask.assigneeId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: subtask.assigneeId, type: 'task', title: 'Subtask assigned', body: `${currentUser.name} assigned you "${subtask.title}".`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
      setTaskModalOpen(false)
      toast({ title: 'Subtask created', description: `The subtask was added to ${parentTask.title}.`, type: 'success' })
      return
    }

    const taskPayload = {
      ...taskForm,
      title: taskForm.title.trim(),
      description: sanitizeTaskDescriptionHtml(taskDescriptionToHtml(taskForm.description)),
      assigneeId: taskForm.assigneeId,
      status: taskForm.status,
      priority: taskForm.priority,
      departmentId: taskForm.departmentId,
      projectId: taskForm.projectId,
      taskType: taskForm.taskType,
      tags: taskForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      ...(taskForm.parentTaskId ? {} : { parentTaskId: null }),
      dueDate: taskForm.dueDate,
      ...(!editingTaskId ? { createdAt: new Date().toISOString() } : {}),
    }

    if (editingTaskId) {
      const updated = updateTask(editingTaskId, taskPayload)
      if (updated === false) {
        toast({ title: 'Permission denied', description: 'The task could not be updated with these changes.', type: 'error' })
        return
      }
      if (existingTask.assigneeId !== taskPayload.assigneeId) {
        const assignedUser = users.find((user) => user.id === taskPayload.assigneeId)
        addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'task', text: `${currentUser.name} reassigned ${taskPayload.title} to ${assignedUser?.name ?? 'a teammate'}.`, createdAt: new Date().toISOString() })
        if (taskPayload.assigneeId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: taskPayload.assigneeId, type: 'task', title: 'Task reassigned', body: `${currentUser.name} assigned you "${taskPayload.title}".`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
      } else {
        addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'task', text: `${currentUser.name} updated ${taskPayload.title}.`, createdAt: new Date().toISOString() })
      }
      if (existingTask.status !== taskPayload.status) {
        addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'task', text: `${currentUser.name} moved ${taskPayload.title} to ${taskPayload.status}.`, createdAt: new Date().toISOString() })
        const recipientId = existingTask.assigneeId === currentUser.id ? existingTask.reporterId : existingTask.assigneeId
        if (recipientId && recipientId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: recipientId, type: 'task', title: 'Task status updated', body: `${currentUser.name} moved "${taskPayload.title}" to ${taskPayload.status}.`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
      }
      toast({ title: 'Task updated', description: 'The task changes are now reflected across the demo.', type: 'success' })
    } else {
      const generatedId = createTask({ ...taskPayload, comments: [], subtasks: [] })
      if (!generatedId) {
        toast({ title: 'Task not created', description: 'The current role cannot create or assign this task.', type: 'error' })
        return
      }
      setSelectedTaskId(generatedId)
      addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'task', text: `${currentUser.name} created ${taskPayload.title}.`, createdAt: new Date().toISOString() })
      if (taskPayload.assigneeId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: taskPayload.assigneeId, type: 'task', title: 'New task assigned', body: `${currentUser.name} assigned you "${taskPayload.title}".`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
      toast({ title: 'Task created', description: 'The new task is live in the shared task queue.', type: 'success' })
    }

    setTaskModalOpen(false)
    setEditingTaskId(null)
  }

  const handleDeleteTask = (task) => {
    if (!window.confirm(`Delete ${task.title}? This action cannot be undone.`)) return
    const permissionCheck = canDeleteTask(currentUser, task)
    if (handleTaskPermissionError(permissionCheck)) return
    const deleted = deleteTask(task.id)
    if (deleted === false) {
      toast({ title: 'Permission denied', description: 'You cannot delete this task.', type: 'error' })
      return
    }
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'task', text: `${currentUser.name} deleted ${task.title}.`, createdAt: new Date().toISOString() })
    setSelectedTaskId(null)
    toast({ title: 'Task deleted', description: `${task.title} was removed from the client demo.`, type: 'info' })
  }

  const handleStatusChange = (taskId, nextStatus) => {
    const task = tasks.find((item) => item.id === taskId)
    const permissionCheck = canChangeTaskStatus(currentUser, task)
    if (handleTaskPermissionError(permissionCheck)) return
    const updated = updateTask(taskId, { status: nextStatus })
    if (updated === false) {
      toast({ title: 'Permission denied', description: 'The task status could not be changed.', type: 'error' })
      return
    }
    if (task) {
      addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'task', text: `${currentUser.name} moved ${task.title} to ${nextStatus}.`, createdAt: new Date().toISOString() })
      const recipientId = task.assigneeId === currentUser.id ? task.reporterId : task.assigneeId
      if (recipientId && recipientId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: recipientId, type: 'task', title: 'Task status updated', body: `${currentUser.name} moved "${task.title}" to ${nextStatus}.`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
    }
  }

  const handleTaskComment = (event) => {
    event.preventDefault()
    if (!newComment.trim() || !selectedTask) return
    const comment = { id: `c-${Date.now()}`, userId: currentUser.id, text: newComment.trim(), createdAt: new Date().toISOString() }
    const added = addTaskComment(selectedTask.id, comment)
    if (added === false) {
      toast({ title: 'Permission denied', description: 'You cannot comment on this task.', type: 'error' })
      return
    }
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'comment', text: `${currentUser.name} commented on ${selectedTask.title}.`, createdAt: new Date().toISOString() })
    const commentRecipientId = selectedTask.assigneeId === currentUser.id ? selectedTask.reporterId : selectedTask.assigneeId
    if (commentRecipientId && commentRecipientId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: commentRecipientId, type: 'comment', title: 'New comment', body: `${currentUser.name} commented on "${selectedTask.title}".`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
    setNewComment('')
  }

  const handleSubtaskCreate = (event) => {
    event.preventDefault()
    if (!selectedTask) return
    const permissionCheck = canCreateSubtask(currentUser, selectedTask)
    if (handleTaskPermissionError(permissionCheck)) return

    const targetUser = users.find((user) => user.id === newSubtask.assigneeId)
    const assignmentCheck = canAssignSubtask(currentUser, targetUser, selectedTask)
    if (handleTaskPermissionError(assignmentCheck)) return

    const errors = {}
    if (!newSubtask.title.trim()) errors.title = 'Subtask title is required.'
    if (!newSubtask.assigneeId) errors.assigneeId = 'Choose an assignee.'
    setSubtaskErrors(errors)
    if (Object.keys(errors).length) return

    const subtask = {
      id: `S-${Math.floor(Math.random() * 90000) + 10000}`,
      title: newSubtask.title.trim(),
      description: newSubtask.description.trim(),
      assigneeId: newSubtask.assigneeId,
      creatorId: currentUser.id,
      status: newSubtask.status,
      priority: newSubtask.priority,
      dueDate: newSubtask.dueDate || null,
      createdAt: new Date().toISOString(),
      comments: [],
    }
    const createdId = addSubtask(selectedTask.id, subtask)
    if (!createdId) {
      toast({ title: 'Subtask not created', description: 'The parent task or selected assignee is no longer eligible.', type: 'error' })
      return
    }
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'subtask', text: `${currentUser.name} created the subtask "${subtask.title}" on ${selectedTask.title}.`, createdAt: new Date().toISOString() })
    if (subtask.assigneeId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: subtask.assigneeId, type: 'task', title: 'Subtask assigned', body: `${currentUser.name} assigned you "${subtask.title}".`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
    setNewSubtask({ title: '', assigneeId: currentUser.id, dueDate: '', description: '', priority: 'Medium', status: 'To Do' })
    setSubtaskErrors({})
  }

  const handleSubtaskToggle = (taskId, subtaskId, nextStatus) => {
    const parentTask = tasks.find((task) => task.id === taskId)
    if (handleTaskPermissionError(canEditTask(currentUser, parentTask))) return
    updateSubtask(taskId, subtaskId, { status: nextStatus })
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'subtask', text: `${currentUser.name} updated a subtask to ${nextStatus}.`, createdAt: new Date().toISOString() })
  }

  const handleSubtaskDelete = (taskId, subtaskId) => {
    if (!window.confirm('Delete this subtask?')) return
    const parentTask = tasks.find((task) => task.id === taskId)
    if (handleTaskPermissionError(canEditTask(currentUser, parentTask))) return
    deleteSubtask(taskId, subtaskId)
  }

  const handleSubtaskReassign = (taskId, subtaskId, assigneeId) => {
    const parentTask = tasks.find((task) => task.id === taskId)
    const targetUser = users.find((user) => user.id === assigneeId)
    const permissionCheck = canAssignSubtask(currentUser, targetUser, parentTask)
    if (handleTaskPermissionError(permissionCheck)) return
    const subtask = parentTask?.subtasks?.find((item) => item.id === subtaskId)
    if (subtask?.assigneeId === assigneeId) return
    const updated = updateSubtask(taskId, subtaskId, { assigneeId })
    if (updated === false) return
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'subtask', text: `${currentUser.name} reassigned "${subtask.title}" to ${targetUser.name}.`, createdAt: new Date().toISOString() })
    if (targetUser.id !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: targetUser.id, type: 'task', title: 'Subtask assigned', body: `${currentUser.name} assigned you "${subtask.title}".`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
  }

  const handleSubtaskComment = (event, taskId, subtaskId) => {
    event.preventDefault()
    const input = document.getElementById(`subtask-comment-${subtaskId}`)
    const text = input?.value?.trim()
    if (!text) return
    addSubtaskComment(taskId, subtaskId, { id: `c-${Date.now()}`, userId: currentUser.id, text, createdAt: new Date().toISOString() })
    const parentTask = tasks.find((task) => task.id === taskId)
    const subtask = parentTask?.subtasks?.find((item) => item.id === subtaskId)
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'comment', text: `${currentUser.name} commented on subtask "${subtask?.title ?? 'work item'}".`, createdAt: new Date().toISOString() })
    input.value = ''
  }

  return (
    <RoleGuard pageKey="my-tasks">
      <PageHeader
        title="My Tasks"
        description="Everything assigned to you, with search, filters and list or board views."
        actions={canCreateTask(currentUser, { departmentId: currentUser.departmentId, taskType: currentUser.role === 'hr' ? 'hr' : currentUser.role === 'executive' ? 'personal' : 'operational' }).allowed && (
          <Button variant="primary" icon={Plus} onClick={openNewTaskModal}>
            New task
          </Button>
        )}
      />

      <Card className="mb-4">
        <CardBody className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by task title or ID" className="h-9 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-[13px] text-ink outline-none focus:border-brand-500" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value={ALL}>All status</option>
              {['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value={ALL}>All priority</option>
              {['Critical', 'High', 'Medium', 'Low'].map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
            <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value={ALL}>All assignee</option>
              {users.filter((user) => visibleTasks.some((task) => task.assigneeId === user.id)).map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value={ALL}>All departments</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>{department.name}</option>
              ))}
            </select>
            <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value={ALL}>Due date</option>
              <option value="overdue">Overdue</option>
              <option value="soon">Due soon</option>
              <option value="noDueDate">No due date</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value="dueDate">Sort by due date</option>
              <option value="priority">Sort by priority</option>
              <option value="createdAt">Newest first</option>
            </select>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader title="Task queue" subtitle={`${visibleTasks.length} visible tasks`} action={<div className="inline-flex rounded-md border border-line bg-surface p-1"><button type="button" onClick={() => setViewMode('list')} className={`rounded px-2 py-1 text-[11px] ${viewMode === 'list' ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>List</button><button type="button" onClick={() => setViewMode('kanban')} className={`rounded px-2 py-1 text-[11px] ${viewMode === 'kanban' ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>Board</button></div>} />
          <CardBody className="max-h-[780px] overflow-y-auto p-0">
            {visibleTasks.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-muted">No tasks match the current filters.</div>
            ) : viewMode === 'kanban' ? (
              <div className="grid gap-2 p-2 sm:grid-cols-2">
                {['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map((status) => {
                  const statusTasks = visibleTasks.filter((task) => task.status === status)
                  return <section key={status} className="min-w-0 rounded-md border border-line-soft bg-surface p-2">
                    <div className="mb-2 flex items-center justify-between"><h3 className="text-[11px] font-semibold text-ink">{status}</h3><Badge tone="neutral">{statusTasks.length}</Badge></div>
                    <div className="space-y-2">
                      {statusTasks.map((task) => <article key={task.id} className={`rounded border bg-white p-2 ${selectedTask?.id === task.id ? 'border-brand-300' : 'border-line-soft'}`}>
                        <button type="button" onClick={() => setSelectedTaskId(task.id)} className="w-full text-left"><span className="text-[10px] font-semibold text-muted">{task.id}</span><p className="mt-1 text-[12px] font-medium text-ink">{task.title}</p><p className="mt-1 text-[10px] text-muted">{users.find((user) => user.id === task.assigneeId)?.name ?? 'Unassigned'}</p></button>
                        {canChangeTaskStatus(currentUser, task).allowed && <select aria-label={`Move ${task.title}`} value={task.status} onChange={(event) => handleStatusChange(task.id, event.target.value)} className="mt-2 h-7 w-full rounded border border-line bg-white px-1.5 text-[10px]">{['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map((nextStatus) => <option key={nextStatus} value={nextStatus}>{nextStatus}</option>)}</select>}
                      </article>)}
                      {!statusTasks.length && <p className="py-3 text-center text-[10px] text-faint">No tasks</p>}
                    </div>
                  </section>
                })}
              </div>
            ) : (
              <ul className="divide-y divide-line-soft">
                {visibleTasks.map((task) => {
                  const progress = taskProgress(task)
                  const assignee = users.find((user) => user.id === task.assigneeId)
                  const overdue = isOverdue(task.dueDate, task.status)
                  return (
                    <li key={task.id} className={`p-3 ${selectedTask?.id === task.id ? 'bg-brand-50/40' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => setSelectedTaskId(task.id)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-muted">{task.id}</span>
                            <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                            {overdue && <Badge tone="red">Overdue</Badge>}
                          </div>
                          <p className="mt-2 truncate text-[14px] font-semibold text-ink">{task.title}</p>
                        </button>
                        <div className="flex items-center gap-1">
                          {canEditTask(currentUser, task).allowed && <button type="button" onClick={() => openEditTask(task)} className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Edit task"><Pencil className="h-4 w-4" /></button>}
                          {canDeleteTask(currentUser, task).allowed && <button type="button" onClick={() => handleDeleteTask(task)} className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Delete task"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Avatar user={assignee} size="sm" />
                          <span className="text-[12px] text-muted">{assignee?.name ?? 'Unassigned'}</span>
                        </div>
                        {canChangeTaskStatus(currentUser, task).allowed && <select value={task.status} onChange={(e) => handleStatusChange(task.id, e.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-[11px] text-ink">
                          {['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-muted">
                        <span>{task.dueDate ? `Due ${task.dueDate}` : 'No due date'}</span>
                        {progress.total > 0 && <span>{progress.completed}/{progress.total} complete</span>}
                      </div>
                      {progress.total > 0 && (
                        <div className="mt-2 h-2 rounded-full bg-surface-2">
                          <div className="h-2 rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          {selectedTask ? (
            <>
              <CardHeader title={selectedTask.title} subtitle={`${selectedTask.id} · ${selectedTask.status}`} action={canEditTask(currentUser, selectedTask).allowed && <Button size="sm" variant="secondary" onClick={() => openEditTask(selectedTask)}>Edit task</Button>} />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={priorityTone(selectedTask.priority)}>{selectedTask.priority}</Badge>
                  <Badge tone="neutral">{selectedTask.departmentId ? departments.find((d) => d.id === selectedTask.departmentId)?.name : 'Unassigned department'}</Badge>
                  <Badge tone="blue">{selectedTask.subtasks?.length ?? 0} subtasks</Badge>
                </div>

                {selectedTask.description ? <TaskDescription value={selectedTask.description} /> : <p className="text-[13px] text-ink-2">No description provided.</p>}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Assignee</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Avatar user={users.find((user) => user.id === selectedTask.assigneeId)} size="sm" />
                      <span className="text-[13px] font-medium text-ink">{users.find((user) => user.id === selectedTask.assigneeId)?.name ?? 'Unassigned'}</span>
                    </div>
                  </div>
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Due date</p>
                    <p className="mt-2 text-[13px] font-medium text-ink">{selectedTask.dueDate || 'No due date'}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-ink">Subtasks</h3>
                    <span className="text-[11px] text-muted">{taskProgress(selectedTask).completed}/{taskProgress(selectedTask).total} complete</span>
                  </div>
                  {canCreateSubtask(currentUser, selectedTask).allowed && <form onSubmit={handleSubtaskCreate} className="mb-3 space-y-2 rounded-md border border-line-soft bg-surface p-3">
                    <input value={newSubtask.title} onChange={(e) => setNewSubtask({ ...newSubtask, title: e.target.value })} placeholder="Add subtask title" className="h-9 w-full rounded-md border border-line bg-white px-2 text-[13px]" />
                    {subtaskErrors.title && <p className="text-[11px] text-brand-700">{subtaskErrors.title}</p>}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select disabled={!eligibleSubtaskAssignees.length} value={newSubtask.assigneeId} onChange={(e) => setNewSubtask({ ...newSubtask, assigneeId: e.target.value })} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
                        {eligibleSubtaskAssignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                      </select>
                      <input type="date" value={newSubtask.dueDate} onChange={(e) => setNewSubtask({ ...newSubtask, dueDate: e.target.value })} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]" />
                    </div>
                    {!eligibleSubtaskAssignees.length && <p role="status" className="text-[11px] text-muted">No eligible assignees are available for subtasks on this parent.</p>}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <select value={newSubtask.priority} onChange={(e) => setNewSubtask({ ...newSubtask, priority: e.target.value })} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
                        {['Low', 'Medium', 'High', 'Critical'].map((level) => <option key={level} value={level}>{level}</option>)}
                      </select>
                      <select value={newSubtask.status} onChange={(e) => setNewSubtask({ ...newSubtask, status: e.target.value })} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
                        {['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                    <textarea value={newSubtask.description} onChange={(e) => setNewSubtask({ ...newSubtask, description: e.target.value })} rows={2} placeholder="Subtask notes" className="w-full rounded-md border border-line bg-white px-2 py-2 text-[13px]" />
                    <div className="flex justify-end"><Button disabled={!eligibleSubtaskAssignees.length} type="submit" size="sm" variant="primary">Add subtask</Button></div>
                  </form>}

                  <div className="space-y-3">
                    {selectedTask.subtasks?.length ? selectedTask.subtasks.map((subtask) => (
                      <div key={subtask.id} className="rounded-md border border-line-soft bg-surface p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[13px] font-medium text-ink">{subtask.title}</p>
                            <p className="mt-1 text-[11px] text-muted">{subtask.assigneeId ? users.find((user) => user.id === subtask.assigneeId)?.name : 'Unassigned'} • {subtask.priority}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {canEditTask(currentUser, selectedTask).allowed && <button type="button" onClick={() => handleSubtaskToggle(selectedTask.id, subtask.id, subtask.status === 'Completed' ? 'In Progress' : 'Completed')} className="rounded p-1.5 text-muted hover:bg-white" aria-label="Toggle subtask status"><Check className="h-4 w-4" /></button>}
                            {canEditTask(currentUser, selectedTask).allowed && <button type="button" onClick={() => handleSubtaskDelete(selectedTask.id, subtask.id)} className="rounded p-1.5 text-muted hover:bg-white" aria-label="Delete subtask"><Trash2 className="h-4 w-4" /></button>}
                          </div>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {canEditTask(currentUser, selectedTask).allowed && <select value={subtask.assigneeId} onChange={(e) => handleSubtaskReassign(selectedTask.id, subtask.id, e.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-[11px]">
                            {eligibleSubtaskAssignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                          </select>}
                          {canChangeTaskStatus(currentUser, selectedTask).allowed && <select value={subtask.status} onChange={(e) => handleSubtaskToggle(selectedTask.id, subtask.id, e.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-[11px]">
                            {['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>}
                        </div>
                        {canEditTask(currentUser, selectedTask).allowed ? <textarea value={subtask.description || ''} onChange={(e) => updateSubtask(selectedTask.id, subtask.id, { description: e.target.value })} rows={2} className="mt-2 w-full rounded-md border border-line bg-white px-2 py-2 text-[12px]" /> : <p className="mt-2 text-[12px] text-ink-2">{subtask.description}</p>}
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted">
                          <span>{subtask.dueDate ? `Due ${subtask.dueDate}` : 'No due date'}</span>
                          <span>{subtask.comments?.length ?? 0} comments</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {(subtask.comments || []).map((comment) => (
                            <div key={comment.id} className="rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink-2">
                              <span className="font-medium">{users.find((user) => user.id === comment.userId)?.name ?? 'Unknown'}:</span> {comment.text}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <input id={`subtask-comment-${subtask.id}`} placeholder="Add subtask comment" className="h-8 flex-1 rounded-md border border-line bg-white px-2 text-[12px]" />
                          <button type="button" onClick={(event) => handleSubtaskComment(event, selectedTask.id, subtask.id)} className="rounded-md border border-line bg-white px-2 text-[12px] text-ink">Add</button>
                        </div>
                      </div>
                    )) : <p className="text-[12px] text-muted">No subtasks yet.</p>}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-ink">Task comments</h3>
                  <div className="space-y-2">
                    {(selectedTask.comments || []).map((comment) => (
                      <div key={comment.id} className="rounded-md border border-line-soft bg-surface px-3 py-2 text-[12px] text-ink-2">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-medium text-ink">{users.find((user) => user.id === comment.userId)?.name ?? 'Unknown'}</span>
                          <span className="text-[10px] text-muted">{timeAgo(comment.createdAt)}</span>
                        </div>
                        {comment.text}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleTaskComment} className="mt-3 flex gap-2">
                    <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Add comment" className="h-9 flex-1 rounded-md border border-line bg-surface px-2 text-[13px]" />
                    <Button type="submit" size="sm">Send</Button>
                  </form>
                </div>
              </CardBody>
            </>
          ) : (
            <CardBody className="flex min-h-[320px] items-center justify-center text-[13px] text-muted">Select a task to review the details.</CardBody>
          )}
        </Card>
      </div>

      {taskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-line bg-white p-5 shadow-pop">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{editingTaskId ? 'Edit task' : 'Create task'}</h2>
                <p className="text-xs text-muted">Keep the task aligned with the shared team data.</p>
              </div>
              <button type="button" onClick={() => setTaskModalOpen(false)} className="rounded p-1.5 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleTaskSave} className="space-y-4">
              {taskErrors.permission && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{taskErrors.permission}</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="task-title" className="mb-1 block text-[12px] font-medium text-ink">Title</label>
                  <input id="task-title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" />
                  {taskErrors.title && <p className="mt-1 text-[11px] text-brand-700">{taskErrors.title}</p>}
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="task-description" className="mb-1 block text-[12px] font-medium text-ink">Description</label>
                  <Suspense fallback={<div className="min-h-40 rounded-md border border-line bg-surface p-3 text-[12px] text-muted">Loading rich-text editor…</div>}>
                    <RichTextEditor id="task-description" value={taskForm.description} onChange={(description) => setTaskForm((form) => ({ ...form, description }))} />
                  </Suspense>
                </div>
                <div>
                  <label htmlFor="task-type" className="mb-1 block text-[12px] font-medium text-ink">Task type</label>
                  <select id="task-type" value={taskForm.taskType} onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {['operational', 'hr', 'support', 'personal'].map((type) => <option key={type} value={type}>{type === 'hr' ? 'HR workflow' : type === 'support' ? 'Support follow-up' : type === 'personal' ? 'Personal' : 'Operational'}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-parent" className="mb-1 block text-[12px] font-medium text-ink">Parent task (optional)</label>
                  <select id="task-parent" value={taskForm.parentTaskId} disabled={!!editingTaskId} onChange={(e) => setTaskForm({ ...taskForm, parentTaskId: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    <option value="">Top-level task</option>
                    {tasks.filter((task) => task.id !== editingTaskId && !task.parentTaskId && canCreateSubtask(currentUser, task).allowed).map((task) => <option key={task.id} value={task.id}>{task.id} · {task.title}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="task-tags" className="mb-1 block text-[12px] font-medium text-ink">Tags or category</label>
                  <input id="task-tags" value={taskForm.tags} onChange={(e) => setTaskForm({ ...taskForm, tags: e.target.value })} placeholder="e.g. onboarding, release" className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" />
                </div>
                <div>
                  <label htmlFor="task-assignee" className="mb-1 block text-[12px] font-medium text-ink">Assignee</label>
                  <select id="task-assignee" value={taskForm.assigneeId} onChange={(e) => setTaskForm({ ...taskForm, assigneeId: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {eligibleTaskAssignees.length ? (
                      eligibleTaskAssignees.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)
                    ) : null}
                  </select>
                  {!eligibleTaskAssignees.length && <p className="mt-1 text-[11px] text-muted">No eligible assignees for this task scope. Change the type, department, or parent task.</p>}
                  {taskErrors.assigneeId && <p className="mt-1 text-[11px] text-brand-700">{taskErrors.assigneeId}</p>}
                </div>
                <div>
                  <label htmlFor="task-department" className="mb-1 block text-[12px] font-medium text-ink">Department</label>
                  <select id="task-department" value={taskForm.departmentId} onChange={(e) => setTaskForm({ ...taskForm, departmentId: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                  {taskErrors.departmentId && <p className="mt-1 text-[11px] text-brand-700">{taskErrors.departmentId}</p>}
                </div>
                <div>
                  <label htmlFor="task-priority" className="mb-1 block text-[12px] font-medium text-ink">Priority</label>
                  <select id="task-priority" value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-status" className="mb-1 block text-[12px] font-medium text-ink">Status</label>
                  <select id="task-status" value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-project" className="mb-1 block text-[12px] font-medium text-ink">Project</label>
                  <select id="task-project" value={taskForm.projectId} onChange={(e) => setTaskForm({ ...taskForm, projectId: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {['p-launch', 'p-platform', 'p-people', 'p-it', 'p-finance', 'p-partners'].map((projectId) => <option key={projectId} value={projectId}>{projectId}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="task-due-date" className="mb-1 block text-[12px] font-medium text-ink">Due date</label>
                  <input id="task-due-date" type="date" value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" />
                  {taskErrors.dueDate && <p className="mt-1 text-[11px] text-brand-700">{taskErrors.dueDate}</p>}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setTaskModalOpen(false)}>Cancel</Button>
                <Button variant="primary" type="submit">{editingTaskId ? 'Save changes' : 'Create task'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RoleGuard>
  )
}
