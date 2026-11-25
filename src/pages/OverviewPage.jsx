import { Clock3 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import { useApp } from '../store/useApp'
import { formatLongDate, getGreeting, timeAgo } from '../utils/dates'
import { describeScope } from '../utils/scope'

const LIVE_METRICS = ['Tasks', 'Pending', 'Completed', 'In progress', 'Overdue', 'Open tickets']

export default function OverviewPage() {
  const { currentUser, roleInfo, department, departments, activity } = useApp()
  const firstName = currentUser?.name?.split(' ')[0] ?? 'there'

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate()}
        title={`${getGreeting()}, ${firstName}`}
        description={`${currentUser?.title || 'TaskFlow user'}${department?.name ? ` · ${department.name}` : ''}`}
        actions={<Badge tone="red">{roleInfo.label}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {LIVE_METRICS.map((label) => (
          <Card key={label}>
            <CardBody>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-ink">—</p>
              <p className="mt-1 text-[11px] text-muted">Unavailable until the task and ticket APIs are connected.</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="Work dashboard" subtitle="Live task and ticket metrics" />
          <CardBody className="flex min-h-56 items-center justify-center text-center">
            <p className="max-w-lg text-[13px] text-muted">
              Task and ticket APIs are not connected. Sample prototype records are not presented as live dashboard counts.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Local prototype activity" />
          <CardBody>
            {activity.length ? (
              <ul className="space-y-3">
                {activity.slice(0, 5).map((entry) => (
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
            ) : (
              <p className="py-6 text-center text-[13px] text-muted">No recent prototype activity.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted">Scope: {describeScope(currentUser, departments)}</p>
    </>
  )
}
