import { useMemo, useState } from 'react'
import { Download, FileText, Search } from 'lucide-react'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import RoleGuard from '../components/layout/RoleGuard'
import { useToast } from '../components/ui/useToast'
import { useApp } from '../store/useApp'
import { can } from '../utils/permissions'
import { toISODate } from '../utils/dates'
import {
  buildEmployeePerformanceReport,
  completionDisplay,
  formatReportDate,
  getAuthorizedDepartmentIds,
  getPerformanceDateRange,
} from '../utils/employeePerformance'

const TASK_STATUSES = ['Backlog', 'To Do', 'In Progress', 'In Review', 'Blocked', 'Completed', 'Cancelled']
const SORTS = [
  { key: 'completionRate', label: 'Completion rate' },
  { key: 'overdue', label: 'Overdue tasks' },
  { key: 'completedCurrently', label: 'Completed tasks' },
]

function dateInputValue(date) {
  return toISODate(date)
}

function MetricCard({ label, value, hint }) {
  return (
    <Card>
      <CardBody>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
        <p className="mt-1 text-[11px] text-muted">{hint}</p>
      </CardBody>
    </Card>
  )
}

function MetricLine({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line-soft py-2 last:border-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-right text-[12px] font-medium text-ink">{value}</dd>
    </div>
  )
}

export default function EmployeePerformanceReportsPage() {
  const { currentUser, users, departments, tasks } = useApp()
  const toast = useToast()
  const now = useMemo(() => new Date(), [])
  const today = dateInputValue(now)
  const currentMonth = today.slice(0, 7)
  const [period, setPeriod] = useState('monthly')
  const [date, setDate] = useState(today)
  const [month, setMonth] = useState(currentMonth)
  const [startDate, setStartDate] = useState(`${currentMonth}-01`)
  const [endDate, setEndDate] = useState(today)
  const [departmentId, setDepartmentId] = useState('all')
  const [employeeId, setEmployeeId] = useState('all')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('completionRate')
  const [detailEmployeeId, setDetailEmployeeId] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const permitted = can(currentUser.role, 'report.employeePerformance')
  const authorizedDepartmentIds = getAuthorizedDepartmentIds(currentUser, departments)
  const scopedDepartments = departments.filter((department) => authorizedDepartmentIds.includes(department.id))
  const effectiveDepartmentId = departmentId === 'all' || authorizedDepartmentIds.includes(departmentId) ? departmentId : 'all'
  const selectableEmployees = users.filter((user) =>
    authorizedDepartmentIds.includes(user.departmentId)
    && (effectiveDepartmentId === 'all' || user.departmentId === effectiveDepartmentId))
  const effectiveEmployeeId = employeeId === 'all' || selectableEmployees.some((user) => user.id === employeeId) ? employeeId : 'all'

  const range = useMemo(() => getPerformanceDateRange({ period, date, month, startDate, endDate }, now), [period, date, month, startDate, endDate, now])
  const report = useMemo(() => {
    if (!range || range.error || !permitted) return null
    return buildEmployeePerformanceReport({
      currentUser,
      users,
      departments,
      tasks,
      range,
      selectedDepartmentId: effectiveDepartmentId,
      selectedEmployeeId: effectiveEmployeeId,
      statusFilter,
      search: employeeSearch,
      now,
    })
  }, [range, permitted, currentUser, users, departments, tasks, effectiveDepartmentId, effectiveEmployeeId, statusFilter, employeeSearch, now])

  const sortedEmployees = useMemo(() => {
    if (!report) return []
    return [...report.employees].sort((left, right) =>
      right[sortBy] - left[sortBy] || left.employee.name.localeCompare(right.employee.name))
  }, [report, sortBy])
  const selectedEmployee = report?.employees.find((row) => row.employee.id === detailEmployeeId) ?? null
  const periodLabel = range && !range.error ? `${formatReportDate(range.startDate)} – ${formatReportDate(range.endDate)}` : ''

  const handleDownloadEmployee = async (employee) => {
    setPdfLoading(true)
    try {
      const { downloadEmployeePerformancePdf } = await import('../utils/employeePerformancePdf')
      downloadEmployeePerformancePdf({ report, range, employee })
      toast({ title: 'Employee report downloaded', description: `PDF generated for ${employee.name}.`, type: 'success' })
    } catch (error) {
      toast({ title: 'PDF download failed', description: error instanceof Error ? error.message : 'The employee report could not be generated.', type: 'error' })
    } finally {
      setPdfLoading(false)
    }
  }

  const handleDownloadTeam = async () => {
    setPdfLoading(true)
    try {
      const { downloadTeamPerformancePdf } = await import('../utils/employeePerformancePdf')
      downloadTeamPerformancePdf({ report, range, statusLabel: statusFilter === 'all' ? 'All statuses' : statusFilter })
      toast({ title: 'Team report downloaded', description: 'The filtered team performance PDF is ready.', type: 'success' })
    } catch (error) {
      toast({ title: 'PDF download failed', description: error instanceof Error ? error.message : 'The team report could not be generated.', type: 'error' })
    } finally {
      setPdfLoading(false)
    }
  }

  if (!permitted) {
    return <RoleGuard pageKey="employee-performance-reports"><p>Employee performance reporting is not available for this role.</p></RoleGuard>
  }

  return (
    <RoleGuard pageKey="employee-performance-reports">
      <PageHeader
        title="Employee Performance Reports"
        description="Review work created in a selected period and its current status within your authorized employee scope."
        actions={(
          <>
            <Button variant="secondary" icon={Download} onClick={handleDownloadTeam} disabled={!report || !report.totalEmployees || pdfLoading}>{pdfLoading ? 'Preparing PDF…' : 'Download Team PDF'}</Button>
            <Button variant="primary" icon={FileText} onClick={() => selectedEmployee && handleDownloadEmployee(selectedEmployee.employee)} disabled={!selectedEmployee || pdfLoading}>{pdfLoading ? 'Preparing PDF…' : 'Download PDF'}</Button>
          </>
        )}
      />

      <Card className="mb-4">
        <CardHeader title="Report filters" subtitle="Employee visibility is restricted to your authorized department scope." />
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <label className="text-[11px] font-medium text-muted">
            Date range
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Monday–Sunday)</option>
              <option value="monthly">Monthly</option>
              <option value="last3months">Last 3 complete months</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          {period === 'daily' && <label className="text-[11px] font-medium text-muted">Date<input type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink" /></label>}
          {period === 'weekly' && <label className="text-[11px] font-medium text-muted">Date in week<input type="date" max={today} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink" /></label>}
          {period === 'monthly' && <label className="text-[11px] font-medium text-muted">Month<input type="month" max={currentMonth} value={month} onChange={(event) => setMonth(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink" /></label>}
          {period === 'custom' && (
            <>
              <label className="text-[11px] font-medium text-muted">Start date<input type="date" max={today} value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink" /></label>
              <label className="text-[11px] font-medium text-muted">End date<input type="date" min={startDate} max={today} value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink" /></label>
            </>
          )}
          <label className="text-[11px] font-medium text-muted">
            Department
            <select value={effectiveDepartmentId} onChange={(event) => { setDepartmentId(event.target.value); setEmployeeId('all') }} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value="all">All authorized departments</option>
              {scopedDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-muted">
            Employee
            <select value={effectiveEmployeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value="all">All authorized employees</option>
              {selectableEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>
          <label className="relative text-[11px] font-medium text-muted">
            Search employees
            <Search className="pointer-events-none absolute left-2.5 top-[30px] h-4 w-4 text-faint" aria-hidden="true" />
            <input value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} placeholder="Search name" className="mt-1 h-9 w-full rounded-md border border-line bg-white pl-8 pr-2 text-[13px] text-ink" />
          </label>
          <label className="text-[11px] font-medium text-muted">
            Task status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 h-9 w-full rounded-md border border-line bg-white px-2 text-[13px] text-ink">
              <option value="all">All statuses</option>
              {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <div className="flex items-end text-[12px] font-medium text-ink sm:col-span-2 xl:col-span-2">
            {periodLabel ? `Selected period: ${periodLabel}` : 'Choose a valid date range'}
          </div>
          {range?.error && <p role="alert" className="text-[12px] text-red-700 sm:col-span-2 xl:col-span-6">{range.error}</p>}
        </CardBody>
      </Card>

      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
        <strong>Historical data limitation:</strong> this task store records creation dates and current status, but not assignment history, completion dates, or status history. Period totals therefore show items <strong>created</strong> in the selected period, not provable assignments. Completion rate compares currently completed items in that created-work cohort with all items in it. Historical completions, on-time/late performance, and pending status at the period end are shown as unavailable unless the underlying records contain reliable completion timestamps.
      </div>

      {report && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Employees" value={report.totalEmployees} hint="Within current authorized scope and filters" />
            <MetricCard label="Currently completed" value={report.completedCurrently} hint="In the period-created work cohort" />
            <MetricCard label="Current cohort completion" value={completionDisplay(report.completionRate)} hint="Currently completed ÷ created in period" />
            <MetricCard label="Currently overdue" value={report.overdue} hint="Open work past its due date today" />
          </div>

          <Card className="mb-4">
            <CardHeader
              title="Employee performance"
              subtitle={`${report.totalCreated} work items created in the selected period · current status snapshot`}
              action={(
                <label className="flex items-center gap-2 text-[11px] text-muted">
                  Sort by
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-8 rounded-md border border-line bg-white px-2 text-[12px] text-ink">
                    {SORTS.map((sort) => <option key={sort.key} value={sort.key}>{sort.label}</option>)}
                  </select>
                </label>
              )}
            />
            <CardBody className="overflow-x-auto p-0">
              {sortedEmployees.length === 0 ? (
                <p className="p-6 text-center text-[13px] text-muted">No employees match the selected filters in your authorized scope.</p>
              ) : (
                <table className="min-w-[900px] w-full text-left text-[12px]">
                  <thead className="bg-surface text-[10px] font-semibold uppercase tracking-wide text-muted">
                    <tr>{['Employee', 'Role / department', 'Created', 'Completed now', 'In progress', 'Pending', 'Overdue', 'Completion'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}<th className="px-4 py-3">Report</th></tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {sortedEmployees.map((row) => (
                      <tr key={row.employee.id} className={`hover:bg-surface/70 ${detailEmployeeId === row.employee.id ? 'bg-brand-50/50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-ink">{row.employee.name}</td>
                        <td className="px-4 py-3"><span className="block text-ink-2">{row.employee.roleLabel}</span><span className="text-[11px] text-muted">{row.employee.departmentName}</span></td>
                        <td className="px-4 py-3 text-ink-2">{row.totalCreated}</td>
                        <td className="px-4 py-3 text-ink-2">{row.completedCurrently}</td>
                        <td className="px-4 py-3 text-ink-2">{row.inProgress}</td>
                        <td className="px-4 py-3 text-ink-2">{row.pending}</td>
                        <td className="px-4 py-3"><Badge tone={row.overdue ? 'red' : 'neutral'}>{row.overdue}</Badge></td>
                        <td className="px-4 py-3 font-medium text-ink">{completionDisplay(row.completionRate)}</td>
                        <td className="px-4 py-3"><button type="button" onClick={() => setDetailEmployeeId(row.employee.id)} className="font-medium text-brand-700 hover:underline">View details</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>

          {selectedEmployee && (
            <Card>
              <CardHeader
                title={`${selectedEmployee.employee.name} — detailed report`}
                subtitle={`${selectedEmployee.employee.roleLabel} · ${selectedEmployee.employee.departmentName} · ${periodLabel}`}
                action={<Button size="sm" variant="secondary" icon={Download} disabled={pdfLoading} onClick={() => handleDownloadEmployee(selectedEmployee.employee)}>{pdfLoading ? 'Preparing PDF…' : 'Download employee PDF'}</Button>}
              />
              <CardBody>
                <dl className="mb-4 grid gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricLine label="Created during period (assignment date not tracked)" value={selectedEmployee.totalCreated} />
                  <MetricLine label="Currently completed in cohort" value={selectedEmployee.completedCurrently} />
                  <MetricLine label="Currently in progress" value={selectedEmployee.inProgress} />
                  <MetricLine label="Currently pending (Backlog, To Do, In Review, Blocked)" value={selectedEmployee.pending} />
                  <MetricLine label="Currently overdue" value={selectedEmployee.overdue} />
                  <MetricLine label="Current cohort completion rate" value={completionDisplay(selectedEmployee.completionRate)} />
                  <MetricLine label="Completed during selected period" value={report.completionDatesAvailable ? selectedEmployee.completedInPeriod : 'Not available'} />
                  <MetricLine label="Completed on time / late" value={report.completionDatesAvailable ? `${selectedEmployee.completedOnTime} / ${selectedEmployee.completedLate}` : 'Not available'} />
                  <MetricLine label="On-time completion rate" value={report.completionDatesAvailable ? completionDisplay(selectedEmployee.onTimeRate) : 'Not available'} />
                  <MetricLine label="Average completion time" value={selectedEmployee.averageCompletionDays === null ? 'Not available' : `${selectedEmployee.averageCompletionDays.toFixed(1)} days`} />
                  <MetricLine label="Pending at period end" value="Not available (no status history)" />
                </dl>
                <h3 className="mb-2 text-[13px] font-semibold text-ink">Work items created or completed during the period</h3>
                {selectedEmployee.reportItems.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-[680px] w-full text-left text-[12px]">
                      <thead className="bg-surface text-[10px] font-semibold uppercase text-muted"><tr>{['Task / subtask', 'Period event', 'Status now', 'Assigned date', 'Created', 'Deadline', 'Completed'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead>
                      <tbody className="divide-y divide-line-soft">
                        {selectedEmployee.reportItems.map((item) => <tr key={`${item.workItemType}-${item.id}`}><td className="px-3 py-2 font-medium text-ink">{item.title}</td><td className="px-3 py-2 text-ink-2">{item.periodEvent}</td><td className="px-3 py-2 text-ink-2">{item.status || 'Not recorded'}</td><td className="px-3 py-2 text-muted">Not tracked</td><td className="px-3 py-2 text-ink-2">{formatReportDate(item.createdAt)}</td><td className="px-3 py-2 text-ink-2">{formatReportDate(item.dueDate)}</td><td className="px-3 py-2 text-ink-2">{item.completedAt ? formatReportDate(item.completedAt) : 'Not recorded'}</td></tr>)}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="rounded-md bg-surface px-3 py-4 text-[12px] text-muted">No work items were created or completed for this employee during the selected period.</p>}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </RoleGuard>
  )
}
