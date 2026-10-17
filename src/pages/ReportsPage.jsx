import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import RoleGuard from '../components/layout/RoleGuard'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { useApp } from '../store/useApp'
import { canViewTask, canViewTicket } from '../permissions/taskPermissions'

const COLORS = ['#64748b', '#2563eb', '#d97706', '#dc2626', '#0891b2', '#059669']

export default function ReportsPage() {
  const { currentUser, users, departments, tasks, tickets } = useApp()
  const scopedTasks = useMemo(() => tasks.filter((task) => canViewTask(currentUser, task).allowed), [tasks, currentUser])
  const scopedTickets = useMemo(() => tickets.filter((ticket) => canViewTicket(currentUser, ticket).allowed), [tickets, currentUser])
  const statusData = useMemo(() => Object.entries(scopedTasks.reduce((counts, task) => ({ ...counts, [task.status]: (counts[task.status] || 0) + 1 }), {})).map(([name, value]) => ({ name, value })), [scopedTasks])
  const departmentData = useMemo(() => departments.map((department) => ({ name: department.code, tasks: scopedTasks.filter((task) => task.departmentId === department.id).length })).filter((row) => row.tasks), [departments, scopedTasks])
  const ticketOpen = scopedTickets.filter((ticket) => !['Resolved', 'Closed'].includes(ticket.status)).length

  const exportReport = () => {
    const rows = [['Task ID', 'Title', 'Department', 'Assignee', 'Status', 'Priority', 'Due date'], ...scopedTasks.map((task) => [task.id, task.title, departments.find((department) => department.id === task.departmentId)?.name ?? '', users.find((user) => user.id === task.assigneeId)?.name ?? '', task.status, task.priority, task.dueDate || ''])]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'taskflow-scope-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <RoleGuard pageKey="reports">
      <PageHeader title="Reports" description="Task delivery and ticket load within your authorized scope." actions={<Button variant="secondary" icon={Download} onClick={exportReport}>Export CSV</Button>} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[{ label: 'Visible tasks', value: scopedTasks.length }, { label: 'Completed', value: scopedTasks.filter((task) => task.status === 'Completed').length }, { label: 'Open tickets', value: ticketOpen }].map((metric) => <Card key={metric.label}><CardBody><p className="text-[11px] font-semibold uppercase text-faint">{metric.label}</p><p className="mt-2 text-2xl font-semibold text-ink">{metric.value}</p></CardBody></Card>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader title="Tasks by status" subtitle="Current workload in your scope" /><CardBody className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={statusData} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" radius={[4, 4, 0, 0]}>{statusData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer></CardBody></Card>
        <Card><CardHeader title="Tasks by department" subtitle="Only departments with visible tasks" /><CardBody className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={departmentData} margin={{ left: 4, right: 8, top: 8, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis allowDecimals={false} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="tasks" fill="#dc2626" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></CardBody></Card>
      </div>
      <Card className="mt-4"><CardHeader title="Ticket queue" subtitle={`${scopedTickets.length} visible tickets`} /><CardBody className="divide-y divide-line-soft p-0">{scopedTickets.length ? scopedTickets.map((ticket) => <div key={ticket.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-[13px] font-medium text-ink">{ticket.title}</p><p className="mt-1 text-[11px] text-muted">{ticket.id} · {users.find((user) => user.id === ticket.assigneeId)?.name ?? 'Unassigned'}</p></div><div className="flex shrink-0 items-center gap-2"><Badge tone={ticket.priority === 'Critical' ? 'red' : ticket.priority === 'High' ? 'amber' : 'neutral'}>{ticket.priority}</Badge><Badge tone="neutral">{ticket.status}</Badge></div></div>) : <p className="p-5 text-center text-[13px] text-muted">No tickets are available in your scope.</p>}</CardBody></Card>
    </RoleGuard>
  )
}
