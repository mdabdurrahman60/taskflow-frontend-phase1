import { useMemo, useState } from 'react'
import { CalendarDays, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import RoleGuard from '../components/layout/RoleGuard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import TaskDescription from '../components/ui/TaskDescription'
import { useApp } from '../store/useApp'
import { useToast } from '../components/ui/useToast'
import { canViewTask } from '../permissions/taskPermissions'
import { getProjectProgress } from '../utils/projectProgress'
import {
  canManageProject,
  canViewProject,
  eligibleProjectManagers,
  eligibleProjectMembers,
  projectDepartmentScope,
} from '../permissions/projectPermissions'

const PROJECT_STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const PRIORITY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 }
const inputClass = 'h-10 w-full rounded-md border border-line bg-white px-2.5 text-[13px] text-ink'
const labelClass = 'mb-1 block text-[12px] font-medium text-ink'

function emptyProjectForm(id, departmentId) {
  return {
    id,
    name: '',
    description: '',
    projectManagerId: '',
    teamMemberIds: [],
    departmentId,
    priority: 'Medium',
    status: 'Planning',
    startDate: '',
    deadline: '',
    budget: '',
    color: '#DC2626',
  }
}

function displayDate(value) {
  if (!value) return 'Not set'
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function priorityTone(priority) {
  return priority === 'Critical' ? 'red' : priority === 'High' ? 'amber' : priority === 'Low' ? 'blue' : 'neutral'
}

export default function ProjectsPage() {
  const {
    currentUser, users, departments, tasks, projects, activity,
    generateProjectId, createProject, updateProject, deleteProject,
  } = useApp()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState('All')
  const [departmentFilter, setDepartmentFilter] = useState('All')
  const [sortBy, setSortBy] = useState('deadline')
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState(null)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})

  const visibleProjects = useMemo(
    () => projects.filter((project) => canViewProject(currentUser, project, tasks)),
    [projects, currentUser, tasks],
  )
  const visibleTasks = useMemo(
    () => tasks.filter((task) => canViewTask(currentUser, task).allowed),
    [tasks, currentUser],
  )
  const tasksByProject = useMemo(() => {
    const grouped = new Map()
    for (const project of visibleProjects) grouped.set(project.id, visibleTasks.filter((task) => task.projectId === project.id))
    return grouped
  }, [visibleProjects, visibleTasks])

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    return visibleProjects.filter((project) => {
      const matchesSearch = !query || project.name.toLowerCase().includes(query) || project.id.toLowerCase().includes(query)
      return matchesSearch
        && (statusFilter === 'All' || project.status === statusFilter)
        && (priorityFilter === 'All' || project.priority === priorityFilter)
        && (departmentFilter === 'All' || project.departmentId === departmentFilter)
    }).sort((left, right) => {
      if (sortBy === 'priority') return (PRIORITY_WEIGHT[right.priority] || 0) - (PRIORITY_WEIGHT[left.priority] || 0)
      if (sortBy === 'progress') return getProjectProgress(tasksByProject.get(right.id) || []).percent - getProjectProgress(tasksByProject.get(left.id) || []).percent
      return (left.deadline || '9999-12-31').localeCompare(right.deadline || '9999-12-31')
    })
  }, [visibleProjects, search, statusFilter, priorityFilter, departmentFilter, sortBy, tasksByProject])

  const selectedProject = visibleProjects.find((project) => project.id === selectedProjectId) || null
  const editableDepartments = useMemo(() => {
    const scope = projectDepartmentScope(currentUser)
    return departments.filter((department) => scope === null || scope.includes(department.id))
  }, [currentUser, departments])
  const departmentChoices = useMemo(() => {
    const availableIds = new Set(visibleProjects.map((project) => project.departmentId))
    return departments.filter((department) => availableIds.has(department.id))
  }, [departments, visibleProjects])

  const openCreateForm = () => {
    const firstDepartmentId = editableDepartments.some((department) => department.id === currentUser.departmentId)
      ? currentUser.departmentId
      : editableDepartments[0]?.id || ''
    setEditingProjectId(null)
    setForm(emptyProjectForm(generateProjectId(), firstDepartmentId))
    setErrors({})
    setFormOpen(true)
  }

  const openEditForm = (project) => {
    setEditingProjectId(project.id)
    setForm({
      id: project.id,
      name: project.name || '',
      description: project.description || '',
      projectManagerId: project.projectManagerId || project.ownerId || '',
      teamMemberIds: project.teamMemberIds || [],
      departmentId: project.departmentId,
      priority: project.priority || 'Medium',
      status: project.status === 'Closed' ? 'Completed' : (project.status || 'Planning'),
      startDate: project.startDate || '',
      deadline: project.deadline || '',
      budget: project.budget ?? '',
      color: project.color || '#DC2626',
    })
    setErrors({})
    setFormOpen(true)
    setSelectedProjectId(project.id)
  }

  const managers = form ? eligibleProjectManagers(currentUser, users, form.departmentId) : []
  const members = form ? eligibleProjectMembers(currentUser, users, form.departmentId) : []

  const saveProject = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.name.trim()) nextErrors.name = 'Project name is required.'
    if (!form.departmentId) nextErrors.departmentId = 'Choose a department.'
    if (form.startDate && form.deadline && form.deadline < form.startDate) nextErrors.deadline = 'Deadline cannot be earlier than the start date.'
    if (!editingProjectId && projects.some((project) => project.id.toLowerCase() === form.id.toLowerCase())) nextErrors.id = 'This project ID is already in use.'
    if (form.projectManagerId && !managers.some((user) => user.id === form.projectManagerId)) nextErrors.projectManagerId = 'Choose an eligible project manager.'
    if (form.teamMemberIds.some((id) => !members.some((user) => user.id === id))) nextErrors.teamMemberIds = 'One or more selected employees are outside your project scope.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    const result = editingProjectId
      ? updateProject(editingProjectId, form)
      : createProject(form)
    if (!result) {
      toast({ title: 'Project not saved', description: 'You do not have permission to manage this project, or its details are no longer valid.', type: 'error' })
      return
    }
    if (!editingProjectId) setSelectedProjectId(result)
    setFormOpen(false)
    toast({ title: editingProjectId ? 'Project updated' : 'Project created', description: `${form.name} is now available in the Projects workspace.`, type: 'success' })
  }

  const removeProject = (project) => {
    if (!window.confirm(`Delete "${project.name}"? Its tasks will be kept and unlinked from the project.`)) return
    if (!deleteProject(project.id)) {
      toast({ title: 'Project not deleted', description: 'You do not have permission to delete this project.', type: 'error' })
      return
    }
    setSelectedProjectId(null)
    toast({ title: 'Project deleted', description: 'Associated tasks were kept and have been unlinked.', type: 'success' })
  }

  const selectedTasks = selectedProject ? (tasksByProject.get(selectedProject.id) || []) : []
  const selectedStats = getProjectProgress(selectedTasks)
  const selectedManager = users.find((user) => user.id === (selectedProject?.projectManagerId || selectedProject?.ownerId))
  const selectedDepartment = departments.find((department) => department.id === selectedProject?.departmentId)
  const selectedActivity = selectedProject
    ? activity.filter((entry) => entry.projectId === selectedProject.id).slice(0, 5)
    : []

  return (
    <RoleGuard pageKey="projects">
      <PageHeader
        title="Projects"
        description="Plan initiatives, manage project teams and track delivery alongside authorized tasks."
        actions={canManageProject(currentUser) && <Button variant="primary" icon={Plus} onClick={openCreateForm}>Create Project</Button>}
      />

      <Card className="mb-4">
        <CardBody className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative block xl:col-span-2">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by project name or ID" className={`${inputClass} pl-9`} />
          </label>
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}>
            <option value="All">All statuses</option>
            {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className={inputClass}>
            <option value="All">All priorities</option>
            {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Filter by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className={inputClass}>
              <option value="All">All departments</option>
              {departmentChoices.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <select aria-label="Sort projects" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={inputClass}>
              <option value="deadline">Deadline</option>
              <option value="priority">Priority</option>
              <option value="progress">Progress</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {filteredProjects.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const projectTasks = tasksByProject.get(project.id) || []
            const stats = getProjectProgress(projectTasks)
            const manager = users.find((user) => user.id === (project.projectManagerId || project.ownerId))
            const department = departments.find((item) => item.id === project.departmentId)
            const mayManage = canManageProject(currentUser, project)
            return (
              <Card key={project.id} className="overflow-hidden">
                <div className="h-1" style={{ backgroundColor: project.color || '#DC2626' }} />
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <button type="button" onClick={() => setSelectedProjectId(project.id)} className="min-w-0 text-left">
                      <p className="truncate text-[15px] font-semibold text-ink hover:text-brand-700">{project.name}</p>
                      <p className="mt-1 text-[11px] text-muted">{project.id} · {department?.name || 'Department not set'}</p>
                    </button>
                    <Badge tone={project.status === 'Active' ? 'green' : project.status === 'Planning' ? 'amber' : project.status === 'On Hold' ? 'blue' : 'neutral'}>{project.status}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Badge tone={priorityTone(project.priority)}>{project.priority || 'Medium'} priority</Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted"><Users className="h-3.5 w-3.5" />{(project.teamMemberIds || []).length} team</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                    <div><p className="text-muted">Project manager</p><p className="mt-0.5 truncate font-medium text-ink">{manager?.name || 'Unassigned'}</p></div>
                    <div><p className="text-muted">Deadline</p><p className="mt-0.5 font-medium text-ink">{displayDate(project.deadline)}</p></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-muted">
                    <span>{stats.completed} completed</span><span>{stats.pending} pending</span><span>{stats.total} tasks</span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-surface-2" role="progressbar" aria-label={`${project.name} progress`} aria-valuenow={stats.percent} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-2 rounded-full bg-brand-600" style={{ width: `${stats.percent}%` }} />
                  </div>
                  <div className="mt-1 text-right text-[11px] font-medium text-ink">{stats.percent}%</div>
                  <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-3">
                    <Button size="sm" variant="secondary" onClick={() => setSelectedProjectId(project.id)}>View details</Button>
                    {mayManage && <div className="flex gap-1">
                      <button type="button" onClick={() => openEditForm(project)} aria-label={`Edit ${project.name}`} className="rounded-md p-2 text-muted hover:bg-surface"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => removeProject(project)} aria-label={`Delete ${project.name}`} className="rounded-md p-2 text-muted hover:bg-brand-50 hover:text-brand-700"><Trash2 className="h-4 w-4" /></button>
                    </div>}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card><CardBody className="py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface text-muted"><Search className="h-5 w-5" /></div>
          <h2 className="mt-3 text-[14px] font-semibold text-ink">{visibleProjects.length ? 'No matching projects' : 'No projects in your scope yet'}</h2>
          <p className="mt-1 text-[13px] text-muted">{visibleProjects.length ? 'Try adjusting your search or filters.' : 'Projects will appear here when you are assigned or a project is created for your department.'}</p>
          {!visibleProjects.length && canManageProject(currentUser) && <Button className="mt-4" variant="primary" icon={Plus} onClick={openCreateForm}>Create Project</Button>}
        </CardBody></Card>
      )}

      {selectedProject && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProjectId(null) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="project-details-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-line bg-white shadow-xl">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{selectedProject.id} · {selectedDepartment?.name}</p>
                <h2 id="project-details-title" className="mt-1 text-lg font-semibold text-ink">{selectedProject.name}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {canManageProject(currentUser, selectedProject) && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEditForm(selectedProject)}>Edit project</Button>}
                <button type="button" aria-label="Close project details" onClick={() => setSelectedProjectId(null)} className="rounded-md p-2 text-muted hover:bg-surface"><X className="h-4 w-4" /></button>
              </div>
            </header>
            <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-5">
                <section>
                  <h3 className="text-[13px] font-semibold text-ink">Project overview</h3>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-ink-2">{selectedProject.description || 'No project description provided.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone={priorityTone(selectedProject.priority)}>{selectedProject.priority || 'Medium'} priority</Badge>
                    <Badge tone={selectedProject.status === 'Active' ? 'green' : 'neutral'}>{selectedProject.status}</Badge>
                  </div>
                </section>
                <section>
                  <div className="mb-2 flex items-center justify-between"><h3 className="text-[13px] font-semibold text-ink">Project tasks</h3><span className="text-[11px] text-muted">{selectedStats.total} visible tasks</span></div>
                  <div className="divide-y divide-line-soft rounded-lg border border-line-soft">
                    {selectedTasks.length ? selectedTasks.map((task) => (
                      <article key={task.id} className="p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0"><p className="text-[13px] font-medium text-ink">{task.title}</p><p className="mt-1 text-[11px] text-muted">{users.find((user) => user.id === task.assigneeId)?.name || 'Unassigned'} · {task.dueDate ? `Due ${displayDate(task.dueDate)}` : 'No due date'}</p></div>
                          <div className="flex gap-1.5"><Badge tone={priorityTone(task.priority)}>{task.priority}</Badge><Badge tone={task.status === 'Completed' ? 'green' : 'neutral'}>{task.status}</Badge></div>
                        </div>
                        {task.description && <div className="mt-2 text-[12px] text-muted"><TaskDescription value={task.description} /></div>}
                      </article>
                    )) : <p className="p-4 text-center text-[12px] text-muted">No authorized tasks are linked to this project.</p>}
                  </div>
                </section>
              </div>
              <aside className="space-y-4">
                <Card>
                  <CardHeader title="Delivery progress" />
                  <CardBody>
                    <div className="flex items-center justify-between text-[12px]"><span className="text-muted">Progress</span><strong className="text-ink">{selectedStats.percent}%</strong></div>
                    <div className="mt-2 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${selectedStats.percent}%` }} /></div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-md bg-surface p-2"><p className="text-base font-semibold text-ink">{selectedStats.total}</p><p className="text-[10px] text-muted">Tasks</p></div>
                      <div className="rounded-md bg-surface p-2"><p className="text-base font-semibold text-emerald-700">{selectedStats.completed}</p><p className="text-[10px] text-muted">Completed</p></div>
                      <div className="rounded-md bg-surface p-2"><p className="text-base font-semibold text-ink">{selectedStats.pending}</p><p className="text-[10px] text-muted">Pending</p></div>
                    </div>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Project team" />
                  <CardBody className="space-y-3">
                    <div><p className="text-[11px] text-muted">Project manager</p><p className="mt-0.5 text-[13px] font-medium text-ink">{selectedManager?.name || 'Unassigned'}</p></div>
                    <div><p className="text-[11px] text-muted">Team members ({(selectedProject.teamMemberIds || []).length})</p><div className="mt-1 space-y-1">{(selectedProject.teamMemberIds || []).length ? selectedProject.teamMemberIds.map((id) => <p key={id} className="text-[12px] text-ink-2">{users.find((user) => user.id === id)?.name || 'Former employee'}</p>) : <p className="text-[12px] text-muted">No team members assigned.</p>}</div></div>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title="Schedule" />
                  <CardBody className="space-y-3">
                    <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-muted" /><div><p className="text-[11px] text-muted">Start date</p><p className="text-[12px] font-medium text-ink">{displayDate(selectedProject.startDate)}</p></div></div>
                    <div className="flex items-start gap-2"><CalendarDays className="mt-0.5 h-4 w-4 text-muted" /><div><p className="text-[11px] text-muted">Expected deadline</p><p className="text-[12px] font-medium text-ink">{displayDate(selectedProject.deadline)}</p></div></div>
                    {selectedProject.budget != null && <div><p className="text-[11px] text-muted">Budget</p><p className="text-[12px] font-medium text-ink">{Number(selectedProject.budget).toLocaleString()}</p></div>}
                  </CardBody>
                </Card>
                {selectedActivity.length > 0 && <Card><CardHeader title="Recent project activity" /><CardBody className="space-y-3">{selectedActivity.map((entry) => <div key={entry.id}><p className="text-[12px] text-ink-2">{entry.text}</p><p className="mt-0.5 text-[10px] text-muted">{new Date(entry.createdAt).toLocaleString()}</p></div>)}</CardBody></Card>}
              </aside>
            </div>
          </section>
        </div>
      )}

      {formOpen && form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false) }}>
          <section role="dialog" aria-modal="true" aria-labelledby="project-form-title" className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-line bg-white shadow-xl">
            <header className="flex items-center justify-between border-b border-line px-5 py-4">
              <div><h2 id="project-form-title" className="text-base font-semibold text-ink">{editingProjectId ? 'Edit project' : 'Create project'}</h2><p className="mt-0.5 text-[12px] text-muted">{editingProjectId ? 'Update project details and team assignments.' : 'Set up the project scope, team and schedule.'}</p></div>
              <button type="button" aria-label="Close project form" onClick={() => setFormOpen(false)} className="rounded-md p-2 text-muted hover:bg-surface"><X className="h-4 w-4" /></button>
            </header>
            <form onSubmit={saveProject} className="space-y-4 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="project-name">Project name <span className="text-brand-700">*</span></label><input id="project-name" autoFocus required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} />{errors.name && <p className="mt-1 text-[11px] text-brand-700">{errors.name}</p>}</div>
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="project-description">Description</label><textarea id="project-description" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-md border border-line bg-white px-2.5 py-2 text-[13px]" /></div>
                <div><label className={labelClass} htmlFor="project-id">Project ID</label><input id="project-id" readOnly value={form.id} className={`${inputClass} bg-surface text-muted`} />{errors.id && <p className="mt-1 text-[11px] text-brand-700">{errors.id}</p>}</div>
                <div><label className={labelClass} htmlFor="project-department">Department <span className="text-brand-700">*</span></label><select id="project-department" required disabled={currentUser.role === 'manager'} value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value, projectManagerId: '', teamMemberIds: [] })} className={inputClass}>{editableDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select>{errors.departmentId && <p className="mt-1 text-[11px] text-brand-700">{errors.departmentId}</p>}</div>
                <div><label className={labelClass} htmlFor="project-manager">Project manager</label><select id="project-manager" value={form.projectManagerId} onChange={(event) => setForm({ ...form, projectManagerId: event.target.value })} className={inputClass}><option value="">Unassigned</option>{managers.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.title}</option>)}</select>{errors.projectManagerId && <p className="mt-1 text-[11px] text-brand-700">{errors.projectManagerId}</p>}</div>
                <div><label className={labelClass} htmlFor="project-priority">Priority</label><select id="project-priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className={inputClass}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></div>
                <div><label className={labelClass} htmlFor="project-status">Status</label><select id="project-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className={inputClass}>{PROJECT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
                <div className="sm:col-span-2"><label className={labelClass} htmlFor="project-members">Team members</label><select id="project-members" multiple value={form.teamMemberIds} onChange={(event) => setForm({ ...form, teamMemberIds: [...event.target.selectedOptions].map((option) => option.value) })} className="min-h-28 w-full rounded-md border border-line bg-white px-2.5 py-2 text-[13px]">{members.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.title}</option>)}</select><p className="mt-1 text-[11px] text-muted">Use Ctrl or Command to select multiple team members.</p>{errors.teamMemberIds && <p className="mt-1 text-[11px] text-brand-700">{errors.teamMemberIds}</p>}</div>
                <div><label className={labelClass} htmlFor="project-start">Start date</label><input id="project-start" type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className={inputClass} /></div>
                <div><label className={labelClass} htmlFor="project-deadline">Expected deadline</label><input id="project-deadline" type="date" min={form.startDate || undefined} value={form.deadline} onChange={(event) => setForm({ ...form, deadline: event.target.value })} className={inputClass} />{errors.deadline && <p className="mt-1 text-[11px] text-brand-700">{errors.deadline}</p>}</div>
                <div><label className={labelClass} htmlFor="project-budget">Budget (optional)</label><input id="project-budget" type="number" min="0" step="0.01" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} className={inputClass} /></div>
                <div><label className={labelClass} htmlFor="project-color">Project color</label><div className="flex h-10 items-center gap-2 rounded-md border border-line px-2"><input id="project-color" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0" /><span className="text-[12px] text-muted">{form.color}</span></div></div>
              </div>
              <div className="flex justify-end gap-2 border-t border-line-soft pt-4"><Button variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" variant="primary">{editingProjectId ? 'Save changes' : 'Create project'}</Button></div>
            </form>
          </section>
        </div>
      )}
    </RoleGuard>
  )
}
