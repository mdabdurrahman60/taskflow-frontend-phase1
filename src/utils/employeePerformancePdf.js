import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { completionDisplay, formatReportDate } from './employeePerformance.js'

const RED = [220, 38, 38]
const DARK = [35, 39, 47]
const GRAY = [100, 116, 139]

function safeFilename(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70) || 'employee'
}

function reportTitle(doc, title, range, subtitle) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...RED)
  doc.text('Monarch IT TaskFlow', 14, 18)
  doc.setTextColor(...DARK)
  doc.setFontSize(14)
  doc.text(title, 14, 28)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Period: ${formatReportDate(range.startDate)} to ${formatReportDate(range.endDate)}`, 14, 35)
  doc.text(`Generated: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, 14, 41)
  if (subtitle) doc.text(subtitle, 14, 47)
  return subtitle ? 54 : 48
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text(`Page ${page} of ${pageCount}`, 196, 287, { align: 'right' })
  }
}

function metricRows(report) {
  return [
    ['Tasks created in period*', String(report.totalCreated)],
    ['Currently completed (created-in-period cohort)', String(report.completedCurrently)],
    ['Current cohort completion rate', completionDisplay(report.completionRate)],
    ['Currently in progress', String(report.inProgress)],
    ['Currently pending', String(report.pending)],
    ['Currently overdue', String(report.overdue)],
    ['Completed during period', report.completionDatesAvailable ? String(report.completedInPeriod) : 'Not available'],
    ['On time / late (dated completions)', report.completionDatesAvailable ? `${report.completedOnTime} / ${report.completedLate}` : 'Not available'],
    ['On-time completion rate', report.completionDatesAvailable ? completionDisplay(report.onTimeRate) : 'Not available'],
    ['Average completion time', report.averageCompletionDays === null ? 'Not available' : `${report.averageCompletionDays.toFixed(1)} days`],
    ['Pending at period end', 'Not available'],
  ]
}

function addEmployeeSection(doc, report, range, startY, { includeTasks = true } = {}) {
  const { employee } = report
  const departmentName = employee.departmentName || 'Department not recorded'
  let y = startY
  if (y > 255) {
    doc.addPage()
    y = 18
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...DARK)
  doc.text(`${employee.name} — ${employee.roleLabel}`, 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(departmentName, 14, y + 6)
  autoTable(doc, {
    startY: y + 10,
    head: [['Metric', 'Value']],
    body: metricRows(report),
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.2, textColor: DARK },
    headStyles: { fillColor: RED, textColor: 255 },
  })
  y = doc.lastAutoTable.finalY + 7

  if (includeTasks) {
    if (y > 265) {
      doc.addPage()
      y = 18
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...DARK)
    doc.text('Work items created or completed in period', 14, y)
    autoTable(doc, {
      startY: y + 4,
      head: [['Task / subtask', 'Period event', 'Status', 'Assigned', 'Created', 'Deadline', 'Completed']],
      body: report.reportItems.map((item) => [
        item.title,
        item.periodEvent,
        item.status || 'Not recorded',
        'Not tracked',
        formatReportDate(item.createdAt),
        formatReportDate(item.dueDate),
        item.completedAt ? formatReportDate(item.completedAt) : 'Not recorded',
      ]),
      theme: 'grid',
      margin: { left: 14, right: 14 },
      styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', textColor: DARK },
      headStyles: { fillColor: RED, textColor: 255 },
      showHead: 'everyPage',
    })
    y = doc.lastAutoTable.finalY + 8
  }
  return y
}

function addDataLimitations(doc, y) {
  const note = 'Data note: this app records task creation date and current status, but does not record assignment history, completion dates, or status history. Created-in-period work and current status are shown; assignment counts, historical completion rates, on-time/late results, and status at period end cannot be reliably inferred.'
  const lines = doc.splitTextToSize(note, 180)
  if (y + lines.length * 4 > 280) {
    doc.addPage()
    y = 18
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.text(lines, 14, y)
}

function addTopSummary(doc, report, startY) {
  const inProgress = report.employees.reduce((total, employee) => total + employee.inProgress, 0)
  const pending = report.employees.reduce((total, employee) => total + employee.pending, 0)
  autoTable(doc, {
    startY,
    head: [['Employees', 'Created work', 'Completed now', 'Completion', 'In progress', 'Pending', 'Overdue', 'Completed in period']],
    body: [[
      String(report.totalEmployees),
      String(report.totalCreated),
      String(report.completedCurrently),
      completionDisplay(report.completionRate),
      String(inProgress),
      String(pending),
      String(report.overdue),
      report.completionDatesAvailable ? String(report.completedInPeriod) : 'Not available',
    ]],
    theme: 'grid',
    margin: { left: 14, right: 14 },
    styles: { fontSize: 7, cellPadding: 2, textColor: DARK },
    headStyles: { fillColor: RED, textColor: 255 },
  })
  return doc.lastAutoTable.finalY + 8
}

export function createEmployeePerformancePdf({ report, range, employee }) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  let y = reportTitle(doc, 'Employee Performance Report', range, `${employee.name} · ${employee.roleLabel}`)
  const employeeReport = report.employees.find((item) => item.employee.id === employee.id)
  if (!employeeReport) throw new Error('The selected employee is not available in this report scope.')
  y = addTopSummary(doc, report, y)
  y = addEmployeeSection(doc, employeeReport, range, y)
  addDataLimitations(doc, y)
  addFooter(doc)
  return doc
}

export function downloadEmployeePerformancePdf(options) {
  const doc = createEmployeePerformancePdf(options)
  doc.save(`employee-performance-${safeFilename(options.employee.name)}-${options.range.startDate}-to-${options.range.endDate}.pdf`)
}

export function createTeamPerformancePdf({ report, range, statusLabel = 'All statuses' }) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  let y = reportTitle(doc, 'Team Performance Report', range, `Status filter: ${statusLabel}`)
  y = addTopSummary(doc, report, y)
  autoTable(doc, {
    startY: y,
    head: [['Employee', 'Role', 'Department', 'Created', 'Completed now', 'Completion', 'In progress', 'Pending', 'Overdue']],
    body: report.employees.map((item) => [
      item.employee.name,
      item.employee.roleLabel,
      item.employee.departmentName,
      String(item.totalCreated),
      String(item.completedCurrently),
      completionDisplay(item.completionRate),
      String(item.inProgress),
      String(item.pending),
      String(item.overdue),
    ]),
    theme: 'grid',
    margin: { left: 10, right: 10 },
    styles: { fontSize: 7, cellPadding: 1.8, overflow: 'linebreak', textColor: DARK },
    headStyles: { fillColor: RED, textColor: 255 },
    showHead: 'everyPage',
  })
  y = doc.lastAutoTable.finalY + 9

  for (const employeeReport of report.employees) {
    y = addEmployeeSection(doc, employeeReport, range, y)
  }
  addDataLimitations(doc, y)
  addFooter(doc)
  return doc
}

export function downloadTeamPerformancePdf(options) {
  const doc = createTeamPerformancePdf(options)
  doc.save(`team-performance-${options.range.startDate}-to-${options.range.endDate}.pdf`)
}
