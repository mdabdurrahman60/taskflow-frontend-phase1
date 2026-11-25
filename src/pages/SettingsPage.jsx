import { Link } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import RoleGuard from '../components/layout/RoleGuard'
import { useApp } from '../store/useApp'
import { useToast } from '../components/ui/useToast'

export default function SettingsPage() {
  const { currentUser, roleInfo, resetDemo } = useApp()
  const toast = useToast()

  const handleReset = () => {
    if (!window.confirm('Reset local prototype tasks, projects and tickets? Employee and department data will not be changed.')) return
    resetDemo()
    toast({ title: 'Prototype work reset', description: 'Local tasks, projects and tickets were reset. Employee and department data were not changed.', type: 'success' })
  }

  return (
    <RoleGuard pageKey="settings">
      <PageHeader title="Settings" description="Review your account and the current data connections." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Signed-in account" subtitle="Authenticated by the TaskFlow backend" />
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone="green">Backend session</Badge>
              <span className="text-[13px] text-muted">{roleInfo.label}</span>
            </div>
            <p className="text-[13px] text-ink-2">Current user: {currentUser.name}</p>
            <p className="text-[13px] text-ink-2">Employee profiles are loaded from the employee API. Authentication credentials are kept in HttpOnly cookies.</p>
            <Link to="/change-password" className="inline-block">
              <Button variant="secondary">Change password</Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Prototype work data" subtitle="Tasks, projects and tickets are not backend-connected" />
          <CardBody>
            <p className="mb-4 text-[13px] text-muted">Reset only the local prototype work items. This does not change backend employees, departments or authentication.</p>
            <Button variant="danger" onClick={handleReset}>Reset prototype work data</Button>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Role permissions" subtitle="View the shared access matrix" />
          <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[13px] text-muted">Review the role-based interface permissions. The backend remains the source of truth for protected operations.</p>
            <Link to="/role-permissions">
              <Button variant="secondary">Open permissions matrix</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </RoleGuard>
  )
}
