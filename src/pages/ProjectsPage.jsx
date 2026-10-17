import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import RoleGuard from '../components/layout/RoleGuard'
import Badge from '../components/ui/Badge'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { useApp } from '../store/useApp'
import { canViewTask } from '../permissions/taskPermissions'

export default function ProjectsPage() {
  const { currentUser, users, tasks, projects } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const visibleTasks = useMemo(() => tasks.filter((task) => canViewTask(currentUser, task).allowed), [tasks, currentUser])
  const visibleProjects = useMemo(() => projects.filter((project) => {
    const hasVisibleWork = visibleTasks.some((task) => task.projectId === project.id)
    return hasVisibleWork || project.ownerId === currentUser.id
  }).filter((project) => {
    const query = search.trim().toLowerCase()
    return (!query || project.name.toLowerCase().includes(query) || project.id.toLowerCase().includes(query)) && (statusFilter === 'All' || project.status === statusFilter)
  }), [projects, visibleTasks, currentUser, search, statusFilter])
  const selectedProject = visibleProjects.find((project) => project.id === selectedProjectId) || visibleProjects[0] || null
  const projectTasks = selectedProject ? visibleTasks.filter((task) => task.projectId === selectedProject.id) : []
  const completed = projectTasks.filter((task) => task.status === 'Completed').length
  const owner = users.find((user) => user.id === selectedProject?.ownerId)

  return (
    <RoleGuard pageKey="projects">
      <PageHeader title="Projects" description="Project ownership and delivery progress from tasks in your authorized scope." />
      <Card className="mb-4">
        <CardBody className="grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="relative block">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects" className="h-9 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[13px]" />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All project status</option>
            {['Active', 'Planning', 'Closed'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </CardBody>
      </Card>
      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader title="Project list" subtitle={`${visibleProjects.length} projects in scope`} />
          <CardBody className="space-y-2 p-2">
            {visibleProjects.length ? visibleProjects.map((project) => {
              const projectTaskCount = visibleTasks.filter((task) => task.projectId === project.id).length
              const isSelected = selectedProject?.id === project.id
              return <button key={project.id} type="button" onClick={() => setSelectedProjectId(project.id)} className={`w-full rounded-md border p-3 text-left ${isSelected ? 'border-brand-200 bg-brand-50/40' : 'border-line-soft bg-white hover:bg-surface'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-[13px] font-semibold text-ink">{project.name}</p><p className="mt-1 text-[11px] text-muted">{project.id} · {projectTaskCount} visible tasks</p></div>
                  <Badge tone={project.status === 'Active' ? 'green' : project.status === 'Planning' ? 'amber' : 'neutral'}>{project.status}</Badge>
                </div>
              </button>
            }) : <p className="p-5 text-center text-[13px] text-muted">No projects match your scope and filters.</p>}
          </CardBody>
        </Card>
        <Card>
          {selectedProject ? <>
            <CardHeader title={selectedProject.name} subtitle={`${selectedProject.id} · Owner: ${owner?.name ?? 'Unassigned'}`} action={<Badge tone={selectedProject.status === 'Active' ? 'green' : 'neutral'}>{selectedProject.status}</Badge>} />
            <CardBody>
              <div className="mb-4 flex items-center justify-between text-[12px] text-muted"><span>Task completion</span><span>{completed} of {projectTasks.length} complete</span></div>
              <div className="mb-5 h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-brand-600" style={{ width: `${projectTasks.length ? Math.round(completed / projectTasks.length * 100) : 0}%` }} /></div>
              <div className="divide-y divide-line-soft">
                {projectTasks.length ? projectTasks.map((task) => <div key={task.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><p className="truncate text-[13px] font-medium text-ink">{task.title}</p><p className="mt-1 text-[11px] text-muted">{task.id} · {users.find((user) => user.id === task.assigneeId)?.name ?? 'Unassigned'}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><Badge tone={task.priority === 'Critical' ? 'red' : task.priority === 'High' ? 'amber' : 'neutral'}>{task.priority}</Badge><Badge tone="neutral">{task.status}</Badge></div>
                </div>) : <p className="py-4 text-[13px] text-muted">No visible tasks are currently linked to this project.</p>}
              </div>
            </CardBody>
          </> : <CardBody className="flex min-h-64 items-center justify-center text-[13px] text-muted">Select a project to inspect its delivery progress.</CardBody>}
        </Card>
      </div>
    </RoleGuard>
  )
}
