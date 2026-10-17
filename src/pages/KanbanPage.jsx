import { useMemo, useState } from 'react'
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd'
import { Search } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import RoleGuard from '../components/layout/RoleGuard'
import Badge from '../components/ui/Badge'
import { Card, CardBody } from '../components/ui/Card'
import { useApp } from '../store/useApp'
import { useToast } from '../components/ui/useToast'
import { isOverdue } from '../utils/dates'
import { canChangeTaskStatus, canViewTask } from '../permissions/taskPermissions'

export default function KanbanPage() {
  const { currentUser, users, tasks, updateTask, addActivity, addNotification, statusOptions } = useApp()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const visibleTasks = useMemo(() => tasks.filter((task) => {
    const query = search.trim().toLowerCase()
    return canViewTask(currentUser, task).allowed && (!query || task.title.toLowerCase().includes(query) || task.id.toLowerCase().includes(query))
  }), [tasks, currentUser, search])

  const moveTask = (task, nextStatus) => {
    const check = canChangeTaskStatus(currentUser, task)
    if (!check.allowed) {
      toast({ title: 'Permission denied', description: check.reason, type: 'error' })
      return
    }
    const updated = updateTask(task.id, { status: nextStatus })
    if (updated === false) {
      toast({ title: 'Permission denied', description: 'This task status could not be changed.', type: 'error' })
      return
    }
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'task', text: `${currentUser.name} moved ${task.title} to ${nextStatus}.`, createdAt: new Date().toISOString() })
    const recipientId = task.assigneeId === currentUser.id ? task.reporterId : task.assigneeId
    if (recipientId && recipientId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: recipientId, type: 'task', title: 'Task status updated', body: `${currentUser.name} moved "${task.title}" to ${nextStatus}.`, link: '/my-tasks', createdAt: new Date().toISOString(), read: false })
  }

  const onDragEnd = ({ draggableId, destination }) => {
    if (!destination) return
    const task = visibleTasks.find((item) => item.id === draggableId)
    if (task && task.status !== destination.droppableId) moveTask(task, destination.droppableId)
  }

  return (
    <RoleGuard pageKey="kanban">
      <PageHeader title="Kanban Board" description="Tasks in your authorized scope, with permission-checked status movement." />
      <div className="mb-4 max-w-md">
        <label className="relative block">
          <span className="sr-only">Search tasks</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks or IDs" className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[13px]" />
        </label>
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid gap-3 xl:grid-cols-3 2xl:grid-cols-6">
          {statusOptions.map((status) => {
            const columnTasks = visibleTasks.filter((task) => task.status === status)
            return (
              <section key={status} className="min-w-0 rounded-md border border-line bg-surface p-2">
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <h2 className="text-[12px] font-semibold text-ink">{status}</h2>
                  <Badge tone="neutral">{columnTasks.length}</Badge>
                </div>
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className={`min-h-28 space-y-2 rounded ${snapshot.isDraggingOver ? 'bg-brand-50/60' : ''}`}>
                      {columnTasks.map((task, index) => {
                        const mayMove = canChangeTaskStatus(currentUser, task).allowed
                        const assignee = users.find((user) => user.id === task.assigneeId)
                        return (
                          <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!mayMove}>
                            {(dragProvided) => (
                              <article ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps} className="rounded border border-line bg-white p-3 shadow-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-[10px] font-semibold text-muted">{task.id}</span>
                                  <Badge tone={task.priority === 'Critical' ? 'red' : task.priority === 'High' ? 'amber' : 'neutral'}>{task.priority}</Badge>
                                </div>
                                <h3 className="mt-2 text-[12px] font-semibold text-ink">{task.title}</h3>
                                <p className="mt-2 truncate text-[11px] text-muted">{assignee?.name || 'Unassigned'}</p>
                                <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted">
                                  <span>{task.dueDate ? `Due ${task.dueDate}` : 'No due date'}</span>
                                  {isOverdue(task.dueDate, task.status) && <Badge tone="red">Late</Badge>}
                                </div>
                                {mayMove && <label className="mt-2 block"><span className="sr-only">Move {task.title}</span><select value={task.status} onChange={(event) => moveTask(task, event.target.value)} className="h-7 w-full rounded border border-line bg-white px-1.5 text-[10px]">{statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>}
                              </article>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                      {!columnTasks.length && <p className="px-2 py-4 text-center text-[11px] text-faint">No tasks</p>}
                    </div>
                  )}
                </Droppable>
              </section>
            )
          })}
        </div>
      </DragDropContext>
      {!visibleTasks.length && <Card className="mt-4"><CardBody className="text-center text-[13px] text-muted">No tasks in your authorized scope match this search.</CardBody></Card>}
    </RoleGuard>
  )
}
