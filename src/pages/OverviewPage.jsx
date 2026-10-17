import { useMemo } from 'react'
import { Check, Clock3, ListTodo, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react'
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { useApp } from '../store/useApp'
import { formatLongDate, getGreeting, isOverdue, timeAgo } from '../utils/dates'
import { describeScope } from '../utils/scope'
import { canViewTask, canViewTicket } from '../permissions/taskPermissions'

const STATUS_COLORS = {
  Backlog: '#94a3b8',
  'To Do': '#60a5fa',
  'In Progress': '#f59e0b',
  'In Review': '#8b5cf6',
  Blocked: '#ef4444',
  Completed: '#10b981',
}

export default function OverviewPage() {
  const { currentUser, roleInfo, department, departments, tasks, tickets, activity, users } = useApp()
  const firstName = currentUser?.name?.split(' ')[0] ?? 'there'
  const scopedTasks = useMemo(() => tasks.filter((task) => canViewTask(currentUser, task).allowed), [tasks, currentUser])
  const scopedTickets = useMemo(() => tickets.filter((ticket) => canViewTicket(currentUser, ticket).allowed), [tickets, currentUser])
  const visibleActivity = useMemo(() => activity.filter((entry) => {
    if (roleInfo.key === 'superadmin') return true
    const actor = users.find((user) => user.id === entry.userId)
    if (!actor) return entry.userId === currentUser.id
    if (roleInfo.key === 'admin') return (currentUser.scopeDepartmentIds || [currentUser.departmentId]).includes(actor.departmentId)
    if (roleInfo.key === 'manager') return actor.departmentId === currentUser.departmentId
    if (roleInfo.key === 'hr') return actor.departmentId === 'd-hr'
    if (roleInfo.key === 'support') return actor.departmentId === currentUser.departmentId
    return entry.userId === currentUser.id
  }), [activity, currentUser, roleInfo.key, users])

  const metrics = useMemo(() => {
    const total = scopedTasks.length
    const completed = scopedTasks.filter((task) => task.status === 'Completed').length
    const pending = scopedTasks.filter((task) => ['Backlog', 'To Do'].includes(task.status)).length
    const inProgress = scopedTasks.filter((task) => task.status === 'In Progress').length
    const overdue = scopedTasks.filter((task) => isOverdue(task.dueDate, task.status)).length
    const openTickets = scopedTickets.filter((ticket) => !['Resolved', 'Closed'].includes(ticket.status)).length
    const completion = total ? Math.round((completed / total) * 100) : 0
    const distribution = Object.entries(
      scopedTasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1
        return acc
      }, {}),
    ).map(([name, value]) => ({ name, value }))
    const upcoming = [...scopedTasks]
      .filter((task) => task.dueDate && !['Completed', 'Cancelled'].includes(task.status))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
      .slice(0, 5)
    const workload = Object.entries(
      scopedTasks.reduce((acc, task) => {
        acc[task.assigneeId] = (acc[task.assigneeId] || 0) + 1
        return acc
      }, {}),
    )
      .map(([userId, count]) => ({
        user: users.find((u) => u.id === userId),
        count,
      }))
      .filter((item) => item.user)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)

    const priorityTasks = [...scopedTasks]
      .sort((a, b) => (['Critical', 'High', 'Medium', 'Low'].indexOf(b.priority) - ['Critical', 'High', 'Medium', 'Low'].indexOf(a.priority)))
      .slice(0, 4)

    return { total, completed, pending, inProgress, overdue, openTickets, completion, distribution, upcoming, workload, priorityTasks }
  }, [scopedTasks, scopedTickets, users])

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate()}
        title={`${getGreeting()}, ${firstName}`}
        description={`${currentUser.title} · ${department?.name}`}
        actions={<Badge tone="red">{roleInfo.label}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total tasks', value: metrics.total, icon: ListTodo, tone: 'blue' },
          { label: 'Pending', value: metrics.pending, icon: Clock3, tone: 'amber' },
          { label: 'Completed', value: metrics.completed, icon: Check, tone: 'green' },
          { label: 'In progress', value: metrics.inProgress, icon: TrendingUp, tone: 'amber' },
          { label: 'Overdue', value: metrics.overdue, icon: AlertTriangle, tone: 'red' },
          { label: 'Open tickets', value: metrics.openTickets, icon: Clock3, tone: 'blue' },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{metric.label}</p>
                <p className="mt-2 text-2xl font-semibold text-ink">{metric.value}</p>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-md ${metric.tone === 'blue' ? 'bg-sky-50 text-sky-600' : metric.tone === 'green' ? 'bg-emerald-50 text-emerald-600' : metric.tone === 'amber' ? 'bg-amber-50 text-amber-600' : 'bg-red-50 text-red-600'}`}>
                <metric.icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="Task completion" subtitle={`${metrics.completion}% complete across visible work`} />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.distribution} margin={{ left: 8, right: 8, top: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {metrics.distribution.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Status mix" subtitle="Live distribution of team work" />
          <CardBody className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={metrics.distribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3}>
                  {metrics.distribution.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="Upcoming deadlines" subtitle="Next due dates across active tasks" />
          <CardBody>
            <ul className="space-y-3">
              {metrics.upcoming.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 rounded-md border border-line-soft bg-surface px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{task.title}</p>
                    <p className="text-xs text-muted">{task.id} • {users.find((u) => u.id === task.assigneeId)?.name ?? 'Unassigned'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-medium text-ink">{task.dueDate}</p>
                    <p className="text-[10px] text-muted">{task.priority}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Most recent changes in the demo" />
          <CardBody>
            <ul className="space-y-3">
              {visibleActivity.slice(0, 5).map((entry) => (
                <li key={entry.id} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-surface-2 text-muted">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink">{entry.text}</p>
                    <p className="text-[11px] text-muted">{timeAgo(entry.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Team workload" subtitle="Tasks assigned by teammate" />
          <CardBody>
            <ul className="space-y-3">
              {metrics.workload.map((entry) => (
                <li key={entry.user.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                      {entry.user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                    </span>
                    <div>
                      <p className="text-[13px] font-medium text-ink">{entry.user.name}</p>
                      <p className="text-[11px] text-muted">{entry.user.title}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink">{entry.count} tasks</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Priority tasks" subtitle="Most urgent work in the current sprint" />
          <CardBody>
            <ul className="space-y-3">
              {metrics.priorityTasks.map((task) => (
                <li key={task.id} className="flex items-start justify-between gap-3 rounded-md border border-line-soft bg-surface px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{task.title}</p>
                    <p className="text-[11px] text-muted">{task.id} • {task.status}</p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">{task.priority}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-faint" aria-hidden="true" />
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted">Scope: {describeScope(currentUser, departments)}</p>
    </>
  )
}
