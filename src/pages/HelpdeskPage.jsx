import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import RoleGuard from '../components/layout/RoleGuard'
import { useApp } from '../store/useApp'
import { useToast } from '../components/ui/useToast'
import { timeAgo } from '../utils/dates'
import { canAssignTicket, canCreateTask, canCreateTicket, canEscalateTicket, canUpdateTicket, canViewTicket } from '../permissions/taskPermissions'

const ticketDefault = (currentUserId) => ({
  title: '',
  description: '',
  requesterId: currentUserId,
  assigneeId: currentUserId,
  priority: 'Medium',
  departmentId: 'd-it',
  status: 'Open',
})

export default function HelpdeskPage() {
  const { currentUser, users, departments, tickets, createTicket, updateTicket, addTicketUpdate, createTask, addNotification, addActivity } = useApp()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [ticketModalOpen, setTicketModalOpen] = useState(false)
  const [selectedTicketId, setSelectedTicketId] = useState(tickets[0]?.id ?? null)
  const [ticketForm, setTicketForm] = useState(ticketDefault(currentUser.id))
  const [replyText, setReplyText] = useState('')
  const [replyType, setReplyType] = useState('public')
  const eligibleAssignees = users.filter((user) => user.id === currentUser.id || canAssignTicket(currentUser, ticketForm, user).allowed)

  const visibleTickets = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter((ticket) => canViewTicket(currentUser, ticket).allowed).filter((ticket) => {
      const matchesQuery = !q || ticket.title.toLowerCase().includes(q) || ticket.id.toLowerCase().includes(q) || users.find((u) => u.id === ticket.requesterId)?.name.toLowerCase().includes(q)
      const matchesStatus = statusFilter === 'All' || ticket.status === statusFilter
      const matchesPriority = priorityFilter === 'All' || ticket.priority === priorityFilter
      const matchesAssignee = assigneeFilter === 'All' || ticket.assigneeId === assigneeFilter
      return matchesQuery && matchesStatus && matchesPriority && matchesAssignee
    })
  }, [tickets, users, currentUser, search, statusFilter, priorityFilter, assigneeFilter])

  const selectedTicket = visibleTickets.find((ticket) => ticket.id === selectedTicketId) ?? visibleTickets[0] ?? null

  const onTicketChange = (ticketId, text, type = 'ticket') => {
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type, text, createdAt: new Date().toISOString() })
  }

  const handleCreateTicket = (event) => {
    event.preventDefault()
    if (!ticketForm.title.trim()) {
      toast({ title: 'Ticket needs a title', description: 'Add a brief summary before creating the ticket.', type: 'error' })
      return
    }
    const assignee = users.find((user) => user.id === ticketForm.assigneeId)
    const createCheck = canCreateTicket(currentUser, { ...ticketForm, assignee })
    if (!createCheck.allowed) {
      toast({ title: 'Permission denied', description: createCheck.reason, type: 'error' })
      return
    }
    if (ticketForm.assigneeId !== currentUser.id && !canAssignTicket(currentUser, ticketForm, assignee).allowed) {
      toast({ title: 'Permission denied', description: 'You cannot assign this ticket to the selected employee.', type: 'error' })
      return
    }

    const newTicket = {
      title: ticketForm.title.trim(),
      description: ticketForm.description.trim(),
      requesterId: ticketForm.requesterId,
      assigneeId: ticketForm.assigneeId,
      departmentId: ticketForm.departmentId,
      status: ticketForm.status,
      priority: ticketForm.priority,
      createdAt: new Date().toISOString(),
      updates: [{ id: `u-${Date.now()}`, authorId: currentUser.id, type: 'public', message: 'Ticket created.', createdAt: new Date().toISOString() }],
      relatedTaskId: null,
    }

    const createdId = createTicket(newTicket)
    if (!createdId) {
      toast({ title: 'Ticket not created', description: 'The ticket failed its authorization checks.', type: 'error' })
      return
    }
    setSelectedTicketId(createdId)
    onTicketChange(createdId, `${currentUser.name} created ${newTicket.title}.`, 'task')
    if (ticketForm.assigneeId !== currentUser.id) addNotification({ id: `n-${Date.now()}`, userId: ticketForm.assigneeId, type: 'ticket', title: 'New ticket assigned', body: `${currentUser.name} assigned you "${newTicket.title}".`, link: '/helpdesk', createdAt: new Date().toISOString(), read: false })
    setTicketModalOpen(false)
    setTicketForm(ticketDefault(currentUser.id))
    toast({ title: 'Ticket created', description: 'The new helpdesk request is now in the queue.', type: 'success' })
  }

  const handleStatusUpdate = (ticketId, nextStatus) => {
    if (nextStatus === 'Escalated') {
      const ticket = tickets.find((item) => item.id === ticketId)
      handleEscalate(ticket)
      return
    }
    const ticket = tickets.find((item) => item.id === ticketId)
    const updateCheck = canUpdateTicket(currentUser, ticket)
    if (!updateCheck.allowed) {
      toast({ title: 'Permission denied', description: updateCheck.reason, type: 'error' })
      return
    }
    const updated = updateTicket(ticketId, { status: nextStatus })
    if (updated === false) {
      toast({ title: 'Permission denied', description: 'This ticket could not be updated.', type: 'error' })
      return
    }
    addTicketUpdate(ticketId, { type: 'public', message: `Status changed to ${nextStatus}.`, createdAt: new Date().toISOString() })
    onTicketChange(ticketId, `${currentUser.name} updated ticket status to ${nextStatus}.`, 'ticket')
  }

  const handleTicketReassign = (ticket, assigneeId) => {
    const targetUser = users.find((user) => user.id === assigneeId)
    if (ticket.assigneeId === assigneeId) return
    const check = canAssignTicket(currentUser, ticket, targetUser)
    if (!check.allowed) {
      toast({ title: 'Permission denied', description: check.reason, type: 'error' })
      return
    }
    const updated = updateTicket(ticket.id, { assigneeId })
    if (updated === false) return
    addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'ticket', text: `${currentUser.name} assigned ${ticket.id} to ${targetUser.name}.`, createdAt: new Date().toISOString() })
    addNotification({ id: `n-${Date.now()}`, userId: targetUser.id, type: 'ticket', title: 'Ticket assigned', body: `${currentUser.name} assigned you "${ticket.title}".`, link: '/helpdesk', createdAt: new Date().toISOString(), read: false })
    toast({ title: 'Ticket reassigned', description: `${ticket.id} is now assigned to ${targetUser.name}.`, type: 'success' })
  }

  const handleEscalate = (ticket) => {
    if (!ticket) return
    const check = canEscalateTicket(currentUser, ticket)
    if (!check.allowed) {
      toast({ title: 'Permission denied', description: check.reason, type: 'error' })
      return
    }
    const manager = users.find((user) => user.role === 'manager' && user.departmentId === ticket.departmentId && user.status === 'Active')
    const scopedAdmin = users.find((user) => user.role === 'admin' && (user.scopeDepartmentIds || [user.departmentId]).includes(ticket.departmentId) && user.status === 'Active')
    const escalationTarget = manager || scopedAdmin || users.find((user) => user.role === 'superadmin')
    const updated = updateTicket(ticket.id, { status: 'Escalated', escalatedTo: escalationTarget?.id || null })
    if (updated === false) {
      toast({ title: 'Permission denied', description: 'This ticket could not be escalated.', type: 'error' })
      return
    }
    addTicketUpdate(ticket.id, { type: 'public', message: `Ticket escalated to ${escalationTarget?.name ?? 'the organization administrator'}.`, createdAt: new Date().toISOString() })
    onTicketChange(ticket.id, `${currentUser.name} escalated ${ticket.title} to ${escalationTarget?.name ?? 'the organization administrator'}.`, 'ticket')
    if (escalationTarget) addNotification({ id: `n-${Date.now()}`, userId: escalationTarget.id, type: 'ticket', title: 'Ticket escalated', body: `${currentUser.name} escalated "${ticket.title}" for review.`, link: '/helpdesk', createdAt: new Date().toISOString(), read: false })
    toast({ title: 'Ticket escalated', description: `Routed to ${escalationTarget?.name ?? 'the organization administrator'}.`, type: 'success' })
  }

  const handleReply = (event) => {
    event.preventDefault()
    if (!selectedTicket || !replyText.trim()) return
    if (!canViewTicket(currentUser, selectedTicket).allowed || (replyType === 'internal' && !['superadmin', 'admin', 'support'].includes(currentUser.role))) {
      toast({ title: 'Permission denied', description: 'You cannot add this ticket update.', type: 'error' })
      return
    }
    const added = addTicketUpdate(selectedTicket.id, { type: replyType, message: replyText.trim(), createdAt: new Date().toISOString() })
    if (added === false) {
      toast({ title: 'Permission denied', description: 'You cannot add this ticket update.', type: 'error' })
      return
    }
    onTicketChange(selectedTicket.id, `${currentUser.name} added a ${replyType} update to ${selectedTicket.title}.`, 'comment')
    if (replyType === 'public' && selectedTicket.requesterId !== currentUser.id) {
      addNotification({ id: `n-${Date.now()}`, userId: selectedTicket.requesterId, type: 'ticket', title: 'Ticket update', body: `${currentUser.name} replied to "${selectedTicket.title}".`, link: '/helpdesk', createdAt: new Date().toISOString(), read: false })
    }
    setReplyText('')
  }

  const createFollowUpTask = (ticket) => {
    const permissionCheck = canCreateTask(currentUser, {
      taskType: 'support',
      departmentId: ticket.departmentId,
      isTicketFollowUp: true,
      sourceTicketAssignedTo: ticket.assigneeId,
    })
    if (!permissionCheck.allowed) {
      toast({ title: 'Permission denied', description: permissionCheck.reason, type: 'error' })
      return
    }
    const followUpTask = {
      title: ticket.title,
      description: ticket.description,
      status: 'To Do',
      priority: ticket.priority,
      assigneeId: ticket.assigneeId,
      reporterId: currentUser.id,
      departmentId: ticket.departmentId,
      projectId: 'p-it',
      taskType: 'support',
      sourceTicketId: ticket.id,
      dueDate: '',
      createdAt: new Date().toISOString(),
      comments: [],
      subtasks: [],
    }
    const taskId = createTask(followUpTask)
    if (!taskId) {
      toast({ title: 'Follow-up task not created', description: 'The linked ticket or assignee is no longer eligible.', type: 'error' })
      return
    }
    const linked = updateTicket(ticket.id, { relatedTaskId: taskId })
    if (linked === false) {
      toast({ title: 'Task created, ticket unchanged', description: 'The task exists, but the ticket could not be linked.', type: 'error' })
      return
    }
    onTicketChange(ticket.id, `${currentUser.name} created a follow-up task from ${ticket.title}.`, 'task')
    toast({ title: 'Follow-up task created', description: 'The task appears in the normal task list and dashboard.', type: 'success' })
  }

  return (
    <RoleGuard pageKey="helpdesk">
      <PageHeader title="Helpdesk" description="Internal IT, facilities and administrative support tickets." actions={<Button variant="primary" icon={Plus} onClick={() => setTicketModalOpen(true)}>New ticket</Button>} />

      <Card className="mb-4">
        <CardBody className="grid gap-3 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tickets or requester" className="h-9 w-full rounded-md border border-line bg-surface pl-9 text-[13px]" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All status</option>
            {['Open', 'Triaged', 'In Progress', 'Waiting for Requester', 'Escalated', 'Resolved', 'Closed'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All priority</option>
            {['Low', 'Medium', 'High', 'Critical'].map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All assignee</option>
            {users.filter((user) => visibleTickets.some((ticket) => ticket.assigneeId === user.id)).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Ticket queue" subtitle={`${visibleTickets.length} visible tickets`} />
          <CardBody className="space-y-3 p-0">
            {visibleTickets.length === 0 ? <div className="p-6 text-center text-[13px] text-muted">No tickets found.</div> : visibleTickets.map((ticket) => (
              <button key={ticket.id} type="button" onClick={() => setSelectedTicketId(ticket.id)} className={`flex w-full flex-col gap-2 border-b border-line-soft p-3 text-left ${selectedTicket?.id === ticket.id ? 'bg-brand-50/30' : 'bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-muted">{ticket.id}</span>
                  <Badge tone={ticket.priority === 'Critical' ? 'red' : ticket.priority === 'High' ? 'amber' : ticket.priority === 'Low' ? 'blue' : 'neutral'}>{ticket.priority}</Badge>
                </div>
                <p className="text-[13px] font-medium text-ink">{ticket.title}</p>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>{users.find((user) => user.id === ticket.assigneeId)?.name ?? 'Unassigned'}</span>
                  <span>{ticket.status}</span>
                </div>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          {selectedTicket ? (
            <>
              <CardHeader title={selectedTicket.title} subtitle={`${selectedTicket.id} • ${selectedTicket.status}`} action={canUpdateTicket(currentUser, selectedTicket).allowed && <div className="flex flex-wrap items-center justify-end gap-2"><select aria-label="Assign ticket" value={selectedTicket.assigneeId || ''} onChange={(e) => handleTicketReassign(selectedTicket, e.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-[11px]">{users.filter((user) => user.id === selectedTicket.assigneeId || canAssignTicket(currentUser, selectedTicket, user).allowed).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select><select aria-label="Ticket priority" value={selectedTicket.priority} onChange={(e) => updateTicket(selectedTicket.id, { priority: e.target.value })} className="h-8 rounded-md border border-line bg-white px-2 text-[11px]"><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option></select><select aria-label="Ticket status" value={selectedTicket.status} onChange={(e) => handleStatusUpdate(selectedTicket.id, e.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-[11px]">{['Open', 'Triaged', 'In Progress', 'Waiting for Requester', 'Escalated', 'Resolved', 'Closed'].map((status) => <option key={status} value={status}>{status}</option>)}</select></div>} />
              <CardBody className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Requester</p>
                    <p className="mt-2 text-[13px] font-medium text-ink">{users.find((u) => u.id === selectedTicket.requesterId)?.name ?? 'Unknown'}</p>
                  </div>
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Assignee</p>
                    <p className="mt-2 text-[13px] font-medium text-ink">{users.find((u) => u.id === selectedTicket.assigneeId)?.name ?? 'Unassigned'}</p>
                  </div>
                </div>

                <div className="rounded-md border border-line-soft bg-surface p-3 text-[13px] text-ink-2">{selectedTicket.description}</div>

                <div className="flex gap-2">
                  {canEscalateTicket(currentUser, selectedTicket).allowed && <Button variant="secondary" onClick={() => handleEscalate(selectedTicket)}>Escalate</Button>}
                  {canUpdateTicket(currentUser, selectedTicket).allowed && <Button variant="secondary" onClick={() => handleStatusUpdate(selectedTicket.id, 'Resolved')}>Resolve</Button>}
                  {canCreateTask(currentUser, { taskType: 'support', departmentId: selectedTicket.departmentId, isTicketFollowUp: true, sourceTicketAssignedTo: selectedTicket.assigneeId }).allowed && <Button variant="primary" onClick={() => createFollowUpTask(selectedTicket)}>Create follow-up task</Button>}
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-ink">Conversation</h3>
                  <div className="space-y-2">
                    {(selectedTicket.updates || []).map((update) => (
                      <div key={update.id} className={`rounded-md border px-3 py-2 text-[12px] ${update.type === 'internal' ? 'border-brand-100 bg-brand-50/40 text-ink' : 'border-line-soft bg-surface text-ink-2'}`}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-medium">{users.find((user) => user.id === update.authorId)?.name ?? 'Unknown'} {update.type === 'internal' ? '(Internal note)' : '(Public reply)'}</span>
                          <span className="text-[10px] text-muted">{timeAgo(update.createdAt)}</span>
                        </div>
                        {update.message}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleReply} className="mt-3 space-y-2">
                    <div className="flex gap-2">
                      <select value={replyType} onChange={(e) => setReplyType(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[12px]">
                        <option value="public">Public reply</option>
                        <option value="internal">Internal note</option>
                      </select>
                    </div>
                    <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder={replyType === 'public' ? 'Add a public reply' : 'Add an internal note'} className="w-full rounded-md border border-line bg-surface px-2.5 py-2 text-[13px]" />
                    <div className="flex justify-end"><Button type="submit" size="sm">Send update</Button></div>
                  </form>
                </div>
              </CardBody>
            </>
          ) : <CardBody className="flex min-h-[320px] items-center justify-center text-[13px] text-muted">Select a ticket to view the details.</CardBody>}
        </Card>
      </div>

      {ticketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4">
          <div className="w-full max-w-xl rounded-xl border border-line bg-white p-5 shadow-pop">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">Create ticket</h2>
                <p className="text-xs text-muted">Track the issue and assign it to the right support owner.</p>
              </div>
              <button type="button" onClick={() => setTicketModalOpen(false)} className="rounded p-1.5 text-muted hover:bg-surface-2">✕</button>
            </div>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label htmlFor="ticket-title" className="mb-1 block text-[12px] font-medium text-ink">Title</label>
                <input id="ticket-title" value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" />
              </div>
              <div>
                <label htmlFor="ticket-description" className="mb-1 block text-[12px] font-medium text-ink">Description</label>
                <textarea id="ticket-description" value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} rows={3} className="w-full rounded-md border border-line bg-surface px-2.5 py-2 text-[13px]" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="ticket-requester" className="mb-1 block text-[12px] font-medium text-ink">Requester</label>
                  {['superadmin', 'admin'].includes(currentUser.role) ? <select id="ticket-requester" value={ticketForm.requesterId} onChange={(e) => setTicketForm({ ...ticketForm, requesterId: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select> : <p className="h-10 pt-2 text-[13px] text-ink">{currentUser.name}</p>}
                </div>
                <div>
                  <label htmlFor="ticket-assignee" className="mb-1 block text-[12px] font-medium text-ink">Assignee</label>
                  <select id="ticket-assignee" value={ticketForm.assigneeId} onChange={(e) => setTicketForm({ ...ticketForm, assigneeId: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {eligibleAssignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ticket-department" className="mb-1 block text-[12px] font-medium text-ink">Department</label>
                  <select id="ticket-department" value={ticketForm.departmentId} onChange={(e) => setTicketForm({ ...ticketForm, departmentId: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="ticket-priority" className="mb-1 block text-[12px] font-medium text-ink">Priority</label>
                  <select id="ticket-priority" value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {['Low', 'Medium', 'High', 'Critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setTicketModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Create ticket</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RoleGuard>
  )
}
