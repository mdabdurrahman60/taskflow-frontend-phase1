import { useMemo, useState } from 'react'
import { AlertTriangle, Download, TrendingUp, CheckCircle2 } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import RoleGuard from '../components/layout/RoleGuard'
import { useApp } from '../store/useApp'
import { formatPercent, formatSignedPoints, getEmployeePerformance } from '../utils/performance'

const RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

function rangeLabel(days) {
  if (days === 7) return 'last 7 days'
  if (days === 30) return 'last 30 days'
  if (days === 90) return 'last 3 months'
  return 'custom range'
}

export default function EmployeePerformanceReportsPage() {
  const { currentUser, users, departments, tasks } = useApp()
  const [days, setDays] = useState(30)
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [employeeFilter, setEmployeeFilter] = useState('all')

  const scopeDepartmentIds = useMemo(() => {
    if (!currentUser) return []
    if (currentUser.role === 'superadmin') return departments.map((department) => department.id)
    if (currentUser.role === 'admin' && Array.isArray(currentUser.scopeDepartmentIds)) {
      return currentUser.scopeDepartmentIds
    }
    if (currentUser.role === 'manager' && currentUser.departmentId) return [currentUser.departmentId]
    return currentUser.departmentId ? [currentUser.departmentId] : []
  }, [currentUser, departments])

  const scopeUsers = useMemo(() => {
    if (!Array.isArray(users) || !currentUser) return []

    if (currentUser.role === 'superadmin') return users
    if (currentUser.role === 'admin') {
      return users.filter((user) => user.role !== 'superadmin' && (!user.departmentId || scopeDepartmentIds.includes(user.departmentId)))
    }
    if (currentUser.role === 'manager') {
      return users.filter((user) => user.departmentId === currentUser.departmentId)
    }
    return users.filter((user) => user.id === currentUser.id)
  }, [users, currentUser, scopeDepartmentIds])

  const rangeStart = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - days)
    return date
  }, [days])

  const rows = useMemo(() => {
    return scopeUsers.map((user) => {
      const summary = getEmployeePerformance(user.id, tasks, { startDate: rangeStart.toISOString(), endDate: new Date().toISOString() })
      const department = departments.find((item) => item.id === user.departmentId)
      return {
        ...user,
        departmentName: department?.name || 'Unassigned',
        summary,
      }
    })
  }, [scopeUsers, tasks, departments, rangeStart])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (departmentFilter !== 'all' && row.departmentId !== departmentFilter) return false
      if (employeeFilter !== 'all' && row.id !== employeeFilter) return false

      if (statusFilter === 'completed' && row.summary.completedTasks === 0) return false
      if (statusFilter === 'overdue' && row.summary.overdueTasks === 0) return false
      if (statusFilter === 'on-time' && row.summary.onTimeTasks === 0) return false

      return true
    })
  }, [rows, departmentFilter, employeeFilter, statusFilter])

  const currentUserSummary = useMemo(() => {
    if (!currentUser) return null
    return getEmployeePerformance(currentUser.id, tasks, { startDate: rangeStart.toISOString(), endDate: new Date().toISOString() })
  }, [currentUser, tasks, rangeStart])

  const trend = useMemo(() => {
    if (!currentUser) return 0
    const previousRangeEnd = new Date(rangeStart.getTime() - 1)
    const previousRangeStart = new Date(previousRangeEnd.getTime() - (days * 24 * 60 * 60 * 1000))
    const current = getEmployeePerformance(currentUser.id, tasks, { startDate: rangeStart.toISOString(), endDate: new Date().toISOString() })
    const previous = getEmployeePerformance(currentUser.id, tasks, {
      startDate: previousRangeStart.toISOString(),
      endDate: previousRangeEnd.toISOString(),
    })

    if (!previous.completedTasks) return current.completedTasks ? 100 : 0
    return ((current.completionRate - previous.completionRate) / previous.completionRate) * 100
  }, [currentUser, tasks, rangeStart, days])

  const cards = currentUserSummary ? [
    { label: 'Total Performance Points', value: formatSignedPoints(currentUserSummary.totalPoints), tone: 'blue' },
    { label: 'Completed tasks', value: String(currentUserSummary.completedTasks), tone: 'green' },
    { label: 'On-time completion', value: formatPercent(currentUserSummary.onTimeRate), tone: 'amber' },
    { label: 'Early completion', value: formatPercent(currentUserSummary.earlyRate), tone: 'violet' },
    { label: 'Quality score', value: currentUserSummary.qualityAverage === null ? 'N/A' : `${currentUserSummary.qualityAverage.toFixed(1)}/5`, tone: 'neutral' },
    { label: 'Overdue tasks', value: String(currentUserSummary.overdueTasks), tone: 'red' },
    { label: 'Current trend', value: `${trend >= 0 ? '+' : ''}${Number.isFinite(trend) ? trend.toFixed(1) : '0.0'}%`, tone: 'slate' },
  ] : []

  const exportRows = () => {
    const csvRows = [
      ['Employee ID', 'Employee', 'Department', 'Assigned tasks', 'Completed tasks', 'On-time rate', 'Early rate', 'Quality score', 'Performance points', 'Overdue tasks'],
      ...filteredRows.map((row) => [
        row.employeeId || '',
        row.name,
        row.departmentName,
        String(row.summary.assignedTasks),
        String(row.summary.completedTasks),
        formatPercent(row.summary.onTimeRate),
        formatPercent(row.summary.earlyRate),
        row.summary.qualityAverage === null ? 'N/A' : `${row.summary.qualityAverage.toFixed(1)}/5`,
        formatSignedPoints(row.summary.totalPoints),
        String(row.summary.overdueTasks),
      ]),
    ]

    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'taskflow-performance-kpi.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <RoleGuard pageKey="employee-performance-reports">
      <PageHeader
        title="Performance & KPI"
        description={`Task performance for ${rangeLabel(days)} based on active assignments and completion outcomes.`}
        actions={<Badge tone="green">Live metrics</Badge>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setDays(option.value)}
            className={`rounded-md border px-3 py-1.5 text-[12px] font-medium ${days === option.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-line bg-white text-ink'}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardBody>
              <p className="text-[11px] font-semibold uppercase text-faint">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{card.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader title="Recent point history" subtitle="Completion events and awarded points" />
          <CardBody className="divide-y divide-line-soft p-0">
            {currentUserSummary && currentUserSummary.recentPointHistory.length ? currentUserSummary.recentPointHistory.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-ink">{entry.title}</p>
                  <p className="mt-1 text-[11px] text-muted">{new Date(entry.date).toLocaleDateString()} · {entry.reason}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${entry.points >= 0 ? 'text-brand-600' : 'text-red-600'}`}>{formatSignedPoints(entry.points)}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted">points</p>
                </div>
              </div>
            )) : <p className="p-5 text-center text-[13px] text-muted">No completed tasks with recorded point history are available in this range.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Workload snapshot" subtitle="Current task position" />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-line-soft bg-surface p-3">
              <div>
                <p className="text-[11px] uppercase text-faint">Assigned</p>
                <p className="mt-1 text-xl font-semibold text-ink">{currentUserSummary?.assignedTasks ?? 0}</p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-brand-600" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-line-soft bg-surface p-3">
              <div>
                <p className="text-[11px] uppercase text-faint">Completed</p>
                <p className="mt-1 text-xl font-semibold text-ink">{currentUserSummary?.completedTasks ?? 0}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-line-soft bg-surface p-3">
              <div>
                <p className="text-[11px] uppercase text-faint">Overdue</p>
                <p className="mt-1 text-xl font-semibold text-ink">{currentUserSummary?.overdueTasks ?? 0}</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </CardBody>
        </Card>
      </div>

      {currentUser && ['superadmin', 'admin', 'manager'].includes(currentUser.role) && (
        <Card className="mt-5">
          <CardHeader
            title="Team overview"
            subtitle="Employee performance by department and individual workload"
            action={
              <Button variant="secondary" icon={Download} onClick={exportRows}>Export CSV</Button>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-md border border-line bg-white px-2.5 py-2 text-[12px] text-ink">
                <option value="all">All departments</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
              <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} className="rounded-md border border-line bg-white px-2.5 py-2 text-[12px] text-ink">
                <option value="all">All employees</option>
                {scopeUsers.map((worker) => (
                  <option key={worker.id} value={worker.id}>{worker.employeeId ? `${worker.employeeId} · ` : ''}{worker.name}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-line bg-white px-2.5 py-2 text-[12px] text-ink">
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
                <option value="on-time">On-time</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-line-soft text-faint">
                    <th className="py-2 pr-4">Employee ID</th>
                    <th className="py-2 pr-4">Employee</th>
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Assigned</th>
                    <th className="py-2 pr-4">Completed</th>
                    <th className="py-2 pr-4">On-time</th>
                    <th className="py-2 pr-4">Quality</th>
                    <th className="py-2 pr-4">Points</th>
                    <th className="py-2 pr-4">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length ? filteredRows.map((row) => (
                    <tr key={row.id} className="border-b border-line-soft last:border-0">
                      <td className="py-3 pr-4 font-medium">{row.employeeId || '—'}</td>
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-medium text-ink">{row.name}</p>
                          <p className="text-[11px] text-muted">{row.title}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4">{row.departmentName}</td>
                      <td className="py-3 pr-4">{row.summary.assignedTasks}</td>
                      <td className="py-3 pr-4">{row.summary.completedTasks}</td>
                      <td className="py-3 pr-4">{formatPercent(row.summary.onTimeRate)}</td>
                      <td className="py-3 pr-4">{row.summary.qualityAverage === null ? 'N/A' : `${row.summary.qualityAverage.toFixed(1)}/5`}</td>
                      <td className="py-3 pr-4">{formatSignedPoints(row.summary.totalPoints)}</td>
                      <td className="py-3 pr-4">{row.summary.overdueTasks}</td>
                    </tr>
                  )) : <tr><td colSpan="9" className="py-6 text-center text-[13px] text-muted">No employees match the selected filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {currentUser && !['superadmin', 'admin', 'manager'].includes(currentUser.role) && (
        <Card className="mt-5">
          <CardHeader title="Your task history" subtitle="Recent completion and quality signal" />
          <CardBody>
            <ul className="space-y-3 text-[13px] text-ink">
              {currentUserSummary && currentUserSummary.recentPointHistory.length ? currentUserSummary.recentPointHistory.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 rounded-md border border-line-soft bg-surface p-3">
                  <span>{entry.title}</span>
                  <span className={entry.points >= 0 ? 'font-semibold text-brand-700' : 'font-semibold text-red-600'}>{formatSignedPoints(entry.points)} pts</span>
                </li>
              )) : <li className="text-muted">No recent task completions have been scored for this period.</li>}
            </ul>
          </CardBody>
        </Card>
      )}
    </RoleGuard>
  )
}
