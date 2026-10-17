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
    if (!window.confirm('Reset all demo data to the original sample state?')) return
    resetDemo()
    toast({ title: 'Demo data reset', description: 'The original mock dataset and demo role are back in place.', type: 'success' })
  }

  return (
    <RoleGuard pageKey="settings">
      <PageHeader title="Settings" description="Control the local demo configuration and reset all mock data when needed." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Demo session" subtitle="Simulation only" />
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone="red">Demo Mode</Badge>
              <span className="text-[13px] text-muted">{roleInfo.label}</span>
            </div>
            <p className="text-[13px] text-ink-2">Current user: {currentUser.name}</p>
            <p className="text-[13px] text-ink-2">Saved data persists in local storage so refreshes retain your demo state.</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Restore sample data" subtitle="Reset the demo state safely" />
          <CardBody>
            <p className="mb-4 text-[13px] text-muted">Resetting restores the original mock data for tasks, tickets, employees, notifications and activities.</p>
            <Button variant="danger" onClick={handleReset}>Reset demo data</Button>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Role permissions" subtitle="View the shared access matrix" />
          <CardBody className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[13px] text-muted">Use the centralized permission matrix to confirm which roles can create, assign and reassign work in the demo.</p>
            <Link to="/role-permissions">
              <Button variant="secondary">Open permissions matrix</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    </RoleGuard>
  )
}
