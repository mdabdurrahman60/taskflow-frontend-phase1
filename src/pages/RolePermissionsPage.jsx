import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import RoleGuard from '../components/layout/RoleGuard'
import { ROLES } from '../data/roles'
import { getRolePermissionMatrix } from '../permissions/taskPermissions'

const permissionLabels = {
  canCreateTopLevelTasks: 'Create top-level tasks',
  eligibleTaskAssignees: 'Assignee scope',
  canCreatePeerSubtasks: 'Create peer subtasks',
  canReassignTasks: 'Reassign tasks',
  canManageDepartments: 'Manage departments',
  canManageEmployees: 'Manage employees',
  canAccessGlobalReports: 'Access global reports',
  canAccessEmployeePerformanceReports: 'Employee performance reports',
  canEscalateTickets: 'Escalate tickets',
  canViewRolePermissions: 'View permission matrix',
}

export default function RolePermissionsPage() {
  const matrix = getRolePermissionMatrix()

  return (
    <RoleGuard pageKey="role-permissions">
      <PageHeader title="Role Permissions" description="The task assignment rules are centralized and shared across the demo experience." />

      <Card>
        <CardHeader title="Permission matrix" subtitle="Simulation only" />
        <CardBody className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-left text-[12px]">
            <thead>
              <tr>
                <th className="px-3 py-2 font-semibold text-ink">Role</th>
                {Object.keys(permissionLabels).map((key) => (
                  <th key={key} className="px-3 py-2 font-semibold text-ink">{permissionLabels[key]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(matrix).map(([roleKey, permissions]) => (
                <tr key={roleKey} className="rounded-lg bg-surface">
                  <td className="rounded-l-lg px-3 py-3 font-medium text-ink">{ROLES[roleKey]?.label ?? roleKey}</td>
                  {Object.entries(permissionLabels).map(([key]) => {
                    const value = permissions[key]
                    const isBoolean = typeof value === 'boolean'
                    return (
                      <td key={`${roleKey}-${key}`} className="px-3 py-3 text-ink-2">
                        {isBoolean ? (
                          <Badge tone={value ? 'green' : 'neutral'}>{value ? 'Allowed' : 'Restricted'}</Badge>
                        ) : (
                          <span className="text-[11px] text-ink-2">{value}</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </RoleGuard>
  )
}
