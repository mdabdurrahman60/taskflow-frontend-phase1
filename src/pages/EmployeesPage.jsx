import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import Avatar from '../components/ui/Avatar'
import RoleGuard from '../components/layout/RoleGuard'
import { useApp } from '../store/useApp'
import { useToast } from '../components/ui/useToast'
import { canManageUser } from '../permissions/taskPermissions'

const employeeDefault = (currentUser) => ({
  name: '',
  title: '',
  email: '',
  departmentId: currentUser.departmentId,
  managerId: currentUser.id,
  role: 'executive',
  status: 'Active',
})

export default function EmployeesPage() {
  const { currentUser, role, users, departments, tasks, createEmployee, updateEmployee } = useApp()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [employeeForm, setEmployeeForm] = useState(employeeDefault(currentUser))
  const managerOptions = users.filter((user) => user.status === 'Active' && ['superadmin', 'admin', 'manager', 'hr'].includes(user.role) && (user.departmentId === employeeForm.departmentId || ['superadmin', 'admin'].includes(user.role)) && (role !== 'admin' || (currentUser.scopeDepartmentIds || [currentUser.departmentId]).includes(user.departmentId)))

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const scopedUsers = role === 'superadmin' || role === 'hr'
      ? users
      : role === 'admin'
        ? users.filter((user) => (currentUser.scopeDepartmentIds || [currentUser.departmentId]).includes(user.departmentId))
        : users.filter((user) => user.departmentId === currentUser.departmentId)
    return scopedUsers.filter((user) => {
      const matchesSearch = !q || user.name.toLowerCase().includes(q) || user.title.toLowerCase().includes(q) || user.email.toLowerCase().includes(q)
      const matchesDepartment = departmentFilter === 'All' || user.departmentId === departmentFilter
      const matchesStatus = statusFilter === 'All' || user.status === statusFilter
      return matchesSearch && matchesDepartment && matchesStatus
    })
  }, [users, role, currentUser, search, departmentFilter, statusFilter])

  const selectedEmployee = users.find((user) => user.id === selectedId) ?? filteredUsers[0] ?? null
  const assigneeTasks = tasks.filter((task) => task.assigneeId === selectedEmployee?.id)
  const assigneeSubtasks = tasks.flatMap((task) => (task.subtasks || []).filter((subtask) => subtask.assigneeId === selectedEmployee?.id).map((subtask) => ({ ...subtask, parentTaskId: task.id, parentTaskTitle: task.title })))

  const openCreate = () => {
    setEditingId(null)
    setEmployeeForm(employeeDefault(currentUser))
    setModalOpen(true)
  }

  const openEdit = (user) => {
    if (!canManageUser(currentUser, user).allowed) return
    setEditingId(user.id)
    setEmployeeForm({
      name: user.name,
      title: user.title,
      email: user.email,
      departmentId: user.departmentId,
      managerId: user.managerId || '',
      role: user.role,
      status: user.status,
    })
    setModalOpen(true)
  }

  const handleSaveEmployee = (event) => {
    event.preventDefault()
    if (!employeeForm.name.trim() || !employeeForm.title.trim() || !employeeForm.email.trim()) {
      toast({ title: 'Need more employee details', description: 'Name, title and email are required.', type: 'error' })
      return
    }

    const existingEmployee = editingId ? users.find((user) => user.id === editingId) : null
    const permissionCheck = canManageUser(currentUser, existingEmployee, {
      role: employeeForm.role,
      departmentId: employeeForm.departmentId,
    })
    if (!permissionCheck.allowed) {
      toast({ title: 'Permission denied', description: permissionCheck.reason, type: 'error' })
      return
    }

    const payload = {
      ...employeeForm,
      id: editingId || `u-${Date.now().toString(36)}`,
      name: employeeForm.name.trim(),
      title: employeeForm.title.trim(),
      email: employeeForm.email.trim(),
      status: employeeForm.status,
    }

    if (editingId) {
      const updated = updateEmployee(editingId, payload)
      if (updated === false) {
        toast({ title: 'Employee not updated', description: 'The employee or reporting-line change is outside your permissions.', type: 'error' })
        return
      }
      toast({ title: 'Employee updated', description: 'The directory has been refreshed.', type: 'success' })
    } else {
      const created = createEmployee(payload)
      if (created === false) {
        toast({ title: 'Employee not created', description: 'The role, department, or reporting line is outside your permissions.', type: 'error' })
        return
      }
      setSelectedId(payload.id)
      toast({ title: 'Employee created', description: 'The new profile is available in the directory immediately.', type: 'success' })
    }

    setModalOpen(false)
  }

  return (
    <RoleGuard pageKey="employees">
      <PageHeader title="Employees" description="Directory of people, roles, departments and reporting lines." actions={canManageUser(currentUser, null, { role: 'executive', departmentId: currentUser.departmentId }).allowed && <Button variant="primary" icon={Plus} onClick={openCreate}>New employee</Button>} />

      <Card className="mb-4">
        <CardBody className="grid gap-3 lg:grid-cols-3">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, title, or email" className="h-9 w-full rounded-md border border-line bg-surface pl-9 text-[13px]" />
          </div>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All status</option>
            {['Active', 'Inactive', 'On Leave'].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Directory" subtitle={`${filteredUsers.length} people`} />
          <CardBody className="space-y-3 p-0">
            {filteredUsers.map((user) => (
              <button key={user.id} type="button" onClick={() => setSelectedId(user.id)} className={`flex w-full items-center justify-between gap-3 border-b border-line-soft p-3 text-left ${selectedEmployee?.id === user.id ? 'bg-brand-50/30' : ''}`}>
                <div className="flex items-center gap-3">
                  <Avatar user={user} size="md" />
                  <div>
                    <p className="text-[13px] font-medium text-ink">{user.name}</p>
                    <p className="text-[11px] text-muted">{user.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={user.status === 'Active' ? 'green' : user.status === 'Inactive' ? 'neutral' : 'amber'}>{user.status}</Badge>
                </div>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          {selectedEmployee ? (
            <>
              <CardHeader title={selectedEmployee.name} subtitle={selectedEmployee.title} action={canManageUser(currentUser, selectedEmployee).allowed && <Button size="sm" variant="secondary" onClick={() => openEdit(selectedEmployee)}>Edit profile</Button>} />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="neutral">{departments.find((department) => department.id === selectedEmployee.departmentId)?.name}</Badge>
                  <Badge tone="blue">{selectedEmployee.role}</Badge>
                  <Badge tone={selectedEmployee.status === 'Active' ? 'green' : 'amber'}>{selectedEmployee.status}</Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Email</p>
                    <p className="mt-2 text-[13px] font-medium text-ink">{selectedEmployee.email}</p>
                  </div>
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Manager</p>
                    <p className="mt-2 text-[13px] font-medium text-ink">{users.find((u) => u.id === selectedEmployee.managerId)?.name ?? 'No manager assigned'}</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-ink">Assigned tasks</h3>
                  {assigneeTasks.length ? <ul className="space-y-2">{assigneeTasks.map((task) => <li key={task.id} className="rounded-md border border-line-soft bg-surface px-3 py-2 text-[12px] text-ink-2">{task.title} • {task.status}</li>)}</ul> : <p className="text-[12px] text-muted">No active work assigned.</p>}
                </div>

                <div>
                  <h3 className="mb-2 text-[13px] font-semibold text-ink">Assigned subtasks</h3>
                  {assigneeSubtasks.length ? <ul className="space-y-2">{assigneeSubtasks.map((subtask) => <li key={subtask.id} className="rounded-md border border-line-soft bg-surface px-3 py-2 text-[12px] text-ink-2">{subtask.title} • {subtask.status} • {subtask.parentTaskTitle}</li>)}</ul> : <p className="text-[12px] text-muted">No subtasks assigned.</p>}
                </div>
              </CardBody>
            </>
          ) : <CardBody className="flex min-h-[320px] items-center justify-center text-[13px] text-muted">Select a person to view their details.</CardBody>}
        </Card>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-line bg-white p-5 shadow-pop">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{editingId ? 'Edit employee' : 'Create employee'}</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded p-1.5 text-muted hover:bg-surface-2">✕</button>
            </div>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink">Full name</label>
                  <input value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink">Title</label>
                  <input value={employeeForm.title} onChange={(e) => setEmployeeForm({ ...employeeForm, title: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink">Email</label>
                  <input value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink">Role</label>
                  <select value={employeeForm.role} disabled={!!editingId && role !== 'superadmin'} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {(role === 'admin' && !editingId ? ['manager', 'support', 'executive'] : ['superadmin', 'admin', 'manager', 'hr', 'support', 'executive']).map((roleOption) => <option key={roleOption} value={roleOption}>{roleOption}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink">Department</label>
                  <select value={employeeForm.departmentId} disabled={role === 'hr'} onChange={(e) => {
                    const departmentId = e.target.value
                    const scope = currentUser.scopeDepartmentIds || [currentUser.departmentId]
                    const eligibleManagers = users.filter((user) => user.status === 'Active' && ['superadmin', 'admin', 'manager', 'hr'].includes(user.role) && (user.departmentId === departmentId || ['superadmin', 'admin'].includes(user.role)) && (role !== 'admin' || scope.includes(user.departmentId)))
                    const nextManager = eligibleManagers.find((user) => user.id === employeeForm.managerId) || eligibleManagers[0]
                    setEmployeeForm({ ...employeeForm, departmentId, managerId: nextManager?.id || '' })
                  }} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {departments.filter((department) => role !== 'admin' || (currentUser.scopeDepartmentIds || [currentUser.departmentId]).includes(department.id)).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink">Manager</label>
                  <select value={employeeForm.managerId} onChange={(e) => setEmployeeForm({ ...employeeForm, managerId: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    <option value="">No manager assigned</option>
                    {managerOptions.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[12px] font-medium text-ink">Status</label>
                  <select value={employeeForm.status} onChange={(e) => setEmployeeForm({ ...employeeForm, status: e.target.value })} className="h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]">
                    {['Active', 'Inactive', 'On Leave'].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary">{editingId ? 'Save changes' : 'Create employee'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RoleGuard>
  )
}
