import { useCallback, useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, KeyRound, Plus, RefreshCw, Search, UserRound, UserRoundCheck, UserRoundX } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader.jsx'
import Badge from '../components/ui/Badge.jsx'
import Button from '../components/ui/Button.jsx'
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx'
import Avatar from '../components/ui/Avatar.jsx'
import RoleGuard from '../components/layout/RoleGuard.jsx'
import { useApp } from '../store/useApp.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { apiClient, ApiError } from '../api/apiClient.js'
import { useToast } from '../components/ui/useToast.js'

const ROLE_LABELS = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  HR: 'HR',
  SUPPORT: 'Support',
  EXECUTIVE: 'Executive',
}

const STATUS_LABELS = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On Leave',
}

const CREATE_ROLES = {
  SUPERADMIN: ['ADMIN', 'MANAGER', 'HR', 'SUPPORT', 'EXECUTIVE'],
  ADMIN: ['MANAGER', 'HR', 'SUPPORT', 'EXECUTIVE'],
}

function messageFor(error) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Sign in again to continue.'
    if (error.status === 403) return 'Your account is not permitted to perform this action in the selected scope.'
    if (error.status === 409 && error.code === 'EMAIL_ALREADY_EXISTS') return 'An employee with this email already exists.'
    if (error.status === 409 && error.code === 'EMPLOYEE_ID_ALREADY_EXISTS') return 'That Employee ID has already been issued. Choose a different ID.'
    if (error.status === 409 && error.code === 'EMPLOYEE_ID_RESERVATION_EXPIRED') return 'That generated Employee ID is no longer available. Request another ID.'
    if (error.status === 400 && error.code === 'INVALID_EMPLOYEE_ID') return 'Enter a valid Employee ID using the company prefix and at least three digits.'
    if (error.status === 400) return 'Some employee details are invalid. Review the required fields and try again.'
    return error.message
  }
  return 'The employee request failed. Please try again.'
}

function toEmployee(record) {
  return {
    ...record,
    role: String(record.role || '').toUpperCase(),
    status: String(record.status || '').toUpperCase(),
    department: record.department ?? null,
  }
}

export default function EmployeesPage() {
  const { currentUser, role, departments: directoryDepartments, directoryLoading, directoryError, refreshDirectory } = useApp()
  const { permissions, updateAuthenticatedUser } = useAuth()
  const toast = useToast()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedId, setSelectedId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [employeeForm, setEmployeeForm] = useState(emptyForm(currentUser))
  const [employeeIdLoading, setEmployeeIdLoading] = useState(false)
  const [employeeIdError, setEmployeeIdError] = useState('')
  const [resetTarget, setResetTarget] = useState(null)
  const [resetStatus, setResetStatus] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false)
  const [resetStatusError, setResetStatusError] = useState('')
  const [resetSuccessPassword, setResetSuccessPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [idEditTarget, setIdEditTarget] = useState(null)
  const [newEmployeeId, setNewEmployeeId] = useState('')
  const [employeeIdReason, setEmployeeIdReason] = useState('')
  const [employeeIdEditError, setEmployeeIdEditError] = useState('')
  const [employeeIdSaving, setEmployeeIdSaving] = useState(false)

  const loadEmployees = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    setEmployees([])
    setSelectedId(null)
    try {
      const response = await apiClient.employees.list()
      if (!Array.isArray(response?.data)) throw new Error('The employee list response was invalid.')
      const nextEmployees = response.data.map(toEmployee)
      setEmployees(nextEmployees)
      setSelectedId((previous) => nextEmployees.some((employee) => employee.id === previous)
        ? previous
        : nextEmployees[0]?.id ?? null)
    } catch (error) {
      setLoadError(messageFor(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [loadEmployees])

  const departments = useMemo(() => directoryDepartments
    .filter((department) => department.isActive || (editingId && department.id === employeeForm.departmentId))
    .sort((a, b) => a.name.localeCompare(b.name)), [directoryDepartments, editingId, employeeForm.departmentId])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return employees.filter((employee) => {
      const matchesSearch = !query ||
        employee.employeeId?.toLowerCase().includes(query) ||
        employee.name.toLowerCase().includes(query) ||
        employee.email.toLowerCase().includes(query)
      const matchesDepartment = departmentFilter === 'All' || employee.departmentId === departmentFilter
      const matchesStatus = statusFilter === 'All' || employee.status === statusFilter
      return matchesSearch && matchesDepartment && matchesStatus
    })
  }, [employees, search, departmentFilter, statusFilter])

  const selectedEmployee = filteredUsers.find((employee) => employee.id === selectedId)
    ?? filteredUsers[0]
    ?? null
  const allowedCreateRoles = CREATE_ROLES[currentUser.role.toUpperCase()] ?? []
  const canCreate = permissions.some((permission) => permission.startsWith('employees:create-')) && allowedCreateRoles.length > 0
  const canEdit = ['SUPERADMIN', 'ADMIN', 'HR'].includes(currentUser.role.toUpperCase()) &&
    permissions.some((permission) => permission.startsWith('employees:update-'))
  const canChangeStatus = ['SUPERADMIN', 'ADMIN'].includes(currentUser.role.toUpperCase()) &&
    permissions.some((permission) => permission.startsWith('employees:change-status-'))
  const canChangeDepartment = ['SUPERADMIN', 'ADMIN'].includes(currentUser.role.toUpperCase())
  const canChangeEmployeeId = ['SUPERADMIN', 'ADMIN'].includes(currentUser.role.toUpperCase()) &&
    permissions.some((permission) => permission.startsWith('employees:update-'))
  const canResetPassword = currentUser.role.toUpperCase() === 'SUPERADMIN'

  const openEmployeeIdEditor = (employee) => {
    if (!canChangeEmployeeId || !employee.employeeId || employee.role === 'SUPERADMIN') return
    setIdEditTarget(employee)
    setNewEmployeeId(employee.employeeId)
    setEmployeeIdReason('')
    setEmployeeIdEditError('')
  }

  const closeEmployeeIdEditor = () => {
    if (employeeIdSaving) return
    setIdEditTarget(null)
    setNewEmployeeId('')
    setEmployeeIdReason('')
    setEmployeeIdEditError('')
  }

  const submitEmployeeIdChange = async (event) => {
    event.preventDefault()
    if (!idEditTarget || !canChangeEmployeeId) return
    const prefix = idEditTarget.employeeId.match(/^[A-Z]+/)?.[0] || 'MIT'
    const suffix = newEmployeeId.startsWith(prefix) ? newEmployeeId.slice(prefix.length) : ''
    const validSuffix = /^[0-9]{3,}$/.test(suffix) &&
      !(suffix.length > 3 && suffix.startsWith('0')) &&
      BigInt(suffix) > 0n &&
      BigInt(suffix) <= 9223372036854775807n
    if (!validSuffix) {
      setEmployeeIdEditError(`Use ${prefix} followed by at least three digits, for example ${prefix}045.`)
      return
    }
    if (employeeIdReason.trim().length < 5) {
      setEmployeeIdEditError('Enter a reason of at least five characters for the audit history.')
      return
    }
    if (!window.confirm(`Change ${idEditTarget.name}'s Employee ID from ${idEditTarget.employeeId} to ${newEmployeeId}?`)) return

    setEmployeeIdSaving(true)
    setEmployeeIdEditError('')
    try {
      const response = await apiClient.employees.changeId(idEditTarget.id, {
        employeeId: newEmployeeId.trim().toUpperCase(),
        reason: employeeIdReason.trim(),
      })
      const updatedEmployee = toEmployee(response.data)
      setEmployees((previous) => previous.map((employee) => employee.id === updatedEmployee.id ? updatedEmployee : employee))
      setSelectedId(updatedEmployee.id)
      if (updatedEmployee.id === currentUser.id) updateAuthenticatedUser(updatedEmployee)
      setIdEditTarget(null)
      setNewEmployeeId('')
      setEmployeeIdReason('')
      toast({ title: 'Employee ID updated', description: `${updatedEmployee.name}'s Employee ID is now ${updatedEmployee.employeeId}.`, type: 'success' })
      await loadEmployees()
      setSelectedId(updatedEmployee.id)
      try {
        await refreshDirectory()
      } catch (error) {
        toast({ title: 'Directory refresh failed', description: messageFor(error), type: 'error' })
      }
    } catch (error) {
      setEmployeeIdEditError(error instanceof ApiError && error.status === 409 && error.code === 'EMPLOYEE_ID_ALREADY_EXISTS'
        ? 'That Employee ID is already in use or was previously issued. Enter a different ID.'
        : messageFor(error))
    } finally {
      setEmployeeIdSaving(false)
    }
  }

  const openPasswordReset = async (employee) => {
    if (!canResetPassword) return
    setResetTarget(employee)
    setResetPassword('')
    setResetPasswordVisible(false)
    setResetSuccessPassword('')
    setResetStatus(null)
    setResetStatusError('')
    try {
      const response = await apiClient.employees.passwordResetStatus(employee.id)
      setResetStatus(response.data)
    } catch (error) {
      setResetStatusError(messageFor(error))
    }
  }

  const closePasswordReset = () => {
    if (resetSaving) return
    setResetTarget(null)
    setResetStatus(null)
    setResetPassword('')
    setResetPasswordVisible(false)
    setResetStatusError('')
    setResetSuccessPassword('')
  }

  const generateResetPassword = () => {
    try {
      setResetPassword(createSecureTemporaryPassword())
      setResetPasswordVisible(true)
    } catch (error) {
      toast({ title: 'Password generation unavailable', description: error.message, type: 'error' })
    }
  }

  const submitPasswordReset = async (event) => {
    event.preventDefault()
    if (!resetTarget || !canResetPassword) return
    if (resetPassword.length < 12 || new TextEncoder().encode(resetPassword).length > 72) {
      toast({ title: 'Invalid temporary password', description: 'Use at least 12 characters and no more than 72 UTF-8 bytes.', type: 'error' })
      return
    }
    if (!window.confirm('You are about to reset this employee’s password. Their existing sessions will be terminated, and they will need to use the new temporary password to sign in.')) return

    setResetSaving(true)
    try {
      await apiClient.employees.resetPassword(resetTarget.id, resetPassword)
      setResetSuccessPassword(resetPassword)
      setResetPassword('')
      setResetStatus({ employeeId: resetTarget.id, mustChangePassword: true })
      toast({ title: 'Password reset', description: 'Existing sessions were terminated and a password-reset notification was recorded.', type: 'success' })
    } catch (error) {
      toast({ title: 'Password reset failed', description: messageFor(error), type: 'error' })
    } finally {
      setResetSaving(false)
    }
  }

  function emptyForm(user) {
    return {
      name: '',
      title: '',
      email: '',
      password: '',
      employeeId: '',
      employeeIdMode: 'generated',
      employeeIdReservationToken: '',
      employeeIdPrefix: 'MIT',
      departmentId: user.departmentId || '',
      role: CREATE_ROLES[user.role.toUpperCase()]?.[0] ?? 'EXECUTIVE',
    }
  }

  const reserveEmployeeId = async () => {
    setEmployeeIdLoading(true)
    setEmployeeIdError('')
    try {
      const response = await apiClient.employees.reserveId()
      setEmployeeForm((previous) => ({
        ...previous,
        employeeId: response.data.employeeId,
        employeeIdReservationToken: response.data.reservationToken,
        employeeIdPrefix: response.data.prefix,
      }))
    } catch (error) {
      setEmployeeIdError(messageFor(error))
    } finally {
      setEmployeeIdLoading(false)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setEmployeeForm(emptyForm(currentUser))
    setModalOpen(true)
    reserveEmployeeId()
  }

  const openEdit = (employee) => {
    if (!canEdit) return
    setEditingId(employee.id)
    setEmployeeForm({
      name: employee.name,
      title: employee.title,
      email: employee.email,
      password: '',
      employeeId: employee.employeeId || '',
      employeeIdMode: 'generated',
      employeeIdReservationToken: '',
      employeeIdPrefix: 'MIT',
      departmentId: employee.departmentId || '',
      role: employee.role,
    })
    setModalOpen(true)
  }

  const handleSaveEmployee = async (event) => {
    event.preventDefault()
    if (!employeeForm.name.trim() || !employeeForm.title.trim()) {
      toast({ title: 'Need more employee details', description: 'Full name and title are required.', type: 'error' })
      return
    }
    if (!editingId && (!employeeForm.email.trim() || !employeeForm.password)) {
      toast({ title: 'Need more employee details', description: 'Email and an initial password are required for new accounts.', type: 'error' })
      return
    }
    if (!editingId && (!employeeForm.employeeId || (employeeForm.employeeIdMode === 'generated' && !employeeForm.employeeIdReservationToken))) {
      toast({ title: 'Employee ID unavailable', description: employeeIdError || 'Wait for a generated Employee ID or request a new one.', type: 'error' })
      return
    }
    if (!employeeForm.departmentId) {
      toast({ title: 'Department required', description: 'Choose an existing department in your authorized scope.', type: 'error' })
      return
    }

    setSaving(true)
    try {
      let response
      if (editingId) {
        const changes = {
          name: employeeForm.name.trim(),
          title: employeeForm.title.trim(),
          ...(canChangeDepartment ? { departmentId: employeeForm.departmentId } : {}),
        }
        response = await apiClient.employees.update(editingId, changes)
        toast({ title: 'Employee updated', description: 'The profile was saved to the backend.', type: 'success' })
      } else {
        response = await apiClient.employees.create({
          name: employeeForm.name.trim(),
          title: employeeForm.title.trim(),
          email: employeeForm.email.trim(),
          password: employeeForm.password,
          role: employeeForm.role,
          departmentId: employeeForm.departmentId,
          employeeId: employeeForm.employeeId,
          employeeIdMode: employeeForm.employeeIdMode,
          ...(employeeForm.employeeIdMode === 'generated'
            ? { employeeIdReservationToken: employeeForm.employeeIdReservationToken }
            : {}),
        })
        toast({ title: 'Employee created', description: `${response.data.employeeId} was assigned and saved to the backend.`, type: 'success' })
      }

      const employee = toEmployee(response.data)
      setEmployees((previous) => {
        const exists = previous.some((record) => record.id === employee.id)
        return exists
          ? previous.map((record) => record.id === employee.id ? employee : record)
          : [...previous, employee].sort((a, b) => a.name.localeCompare(b.name))
      })
      setSelectedId(employee.id)
      setModalOpen(false)
      try {
        await refreshDirectory()
      } catch (error) {
        toast({ title: 'Directory refresh failed', description: messageFor(error), type: 'error' })
      }
    } catch (error) {
      toast({ title: editingId ? 'Employee not updated' : 'Employee not created', description: messageFor(error), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const setEmployeeStatus = async (employee, status) => {
    setSaving(true)
    try {
      const response = await apiClient.employees.setStatus(employee.id, status)
      const updated = toEmployee(response.data)
      setEmployees((previous) => previous.map((record) => record.id === updated.id ? updated : record))
      try {
        await refreshDirectory()
      } catch (error) {
        toast({ title: 'Directory refresh failed', description: messageFor(error), type: 'error' })
      }
      toast({ title: 'Account status updated', description: `${updated.name} is now ${STATUS_LABELS[updated.status]}.`, type: 'success' })
    } catch (error) {
      toast({ title: 'Status not changed', description: messageFor(error), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const departmentName = (employee) => employee.department?.name || 'No department'

  return (
    <RoleGuard pageKey="employees">
      <PageHeader
        title="Employees"
        description="Live employee directory, roles, departments and account status."
        actions={canCreate && <Button variant="primary" icon={Plus} onClick={openCreate}>New employee</Button>}
      />

      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 text-[13px] text-brand-700" role="alert">
          <span>{loadError}</span>
          <Button size="sm" onClick={loadEmployees} disabled={loading}>Retry</Button>
        </div>
      )}

      <Card className="mb-4">
        <CardBody className="grid gap-3 lg:grid-cols-3">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by Employee ID, name, or email" className="h-9 w-full rounded-md border border-line bg-surface pl-9 text-[13px]" />
          </div>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All authorized departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="All">All status</option>
            {Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
          </select>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Directory" subtitle={loading ? 'Loading employees…' : `${filteredUsers.length} people`} />
          <CardBody className="space-y-3 p-0">
            {loading && <p className="p-4 text-[13px] text-muted" role="status">Loading employee directory…</p>}
            {!loading && !loadError && filteredUsers.length === 0 && (
              <p className="p-4 text-[13px] text-muted">{employees.length ? 'No employees match these filters.' : 'No employees are available in your authorized scope.'}</p>
            )}
            {!loading && filteredUsers.map((employee) => (
              <button key={employee.id} type="button" onClick={() => setSelectedId(employee.id)} className={`flex w-full items-center justify-between gap-3 border-b border-line-soft p-3 text-left ${selectedEmployee?.id === employee.id ? 'bg-brand-50/30' : ''}`}>
                <div className="flex items-center gap-3">
                  <Avatar user={{ ...employee, role: employee.role.toLowerCase() }} size="md" />
                  <div>
                    <p className="text-[13px] font-medium text-ink">{employee.name}</p>
                    <p className="text-[11px] font-semibold text-brand-700">{employee.employeeId || 'No Employee ID'}</p>
                    <p className="text-[11px] text-muted">{employee.title}</p>
                  </div>
                </div>
                <Badge tone={employee.status === 'ACTIVE' ? 'green' : employee.status === 'INACTIVE' ? 'neutral' : 'amber'}>
                  {STATUS_LABELS[employee.status] || employee.status}
                </Badge>
              </button>
            ))}
          </CardBody>
        </Card>

        <Card>
          {selectedEmployee ? (
            <>
              <CardHeader
                title={selectedEmployee.name}
                subtitle={selectedEmployee.title}
                action={
                  <div className="flex flex-wrap justify-end gap-2">
                    {canResetPassword && <Button size="sm" variant="secondary" icon={KeyRound} onClick={() => openPasswordReset(selectedEmployee)}>Reset password</Button>}
                    {canChangeEmployeeId && selectedEmployee.employeeId && selectedEmployee.role !== 'SUPERADMIN' && (
                      <Button size="sm" variant="secondary" onClick={() => openEmployeeIdEditor(selectedEmployee)}>Edit Employee ID</Button>
                    )}
                    {canEdit && <Button size="sm" variant="secondary" onClick={() => openEdit(selectedEmployee)}>Edit profile</Button>}
                  </div>
                }
              />
              <CardBody className="space-y-4">
                <div className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-brand-700">Employee ID</p>
                  <p className="mt-1 text-lg font-semibold text-brand-800">{selectedEmployee.employeeId || 'Not applicable'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone="neutral">{departmentName(selectedEmployee)}</Badge>
                  <Badge tone="blue">{ROLE_LABELS[selectedEmployee.role] || selectedEmployee.role}</Badge>
                  <Badge tone={selectedEmployee.status === 'ACTIVE' ? 'green' : selectedEmployee.status === 'INACTIVE' ? 'neutral' : 'amber'}>
                    {STATUS_LABELS[selectedEmployee.status] || selectedEmployee.status}
                  </Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Email</p>
                    <p className="mt-2 break-all text-[13px] font-medium text-ink">{selectedEmployee.email}</p>
                  </div>
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Account created</p>
                    <p className="mt-2 text-[13px] font-medium text-ink">{selectedEmployee.createdAt ? new Date(selectedEmployee.createdAt).toLocaleDateString() : '—'}</p>
                  </div>
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5 md:col-span-2">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Manager</p>
                    <p className="mt-2 text-[13px] font-medium text-ink">{employees.find((employee) => employee.id === selectedEmployee.managerId)?.name ?? (selectedEmployee.managerId ? 'Not visible in your scope' : 'No manager assigned')}</p>
                  </div>
                </div>

                {canResetPassword && resetTarget?.id === selectedEmployee.id && resetStatus && (
                  <div className="rounded-md border border-line-soft bg-surface px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wider text-faint">Password reset status</p>
                    <p className="mt-1 text-[13px] font-medium text-ink">
                      {resetStatus.mustChangePassword ? 'Temporary password change required' : 'No pending password change'}
                    </p>
                  </div>
                )}

                {canChangeStatus && (
                  <div className="border-t border-line-soft pt-4">
                    <h3 className="mb-2 text-[13px] font-semibold text-ink">Account status</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmployee.status !== 'ACTIVE' && (
                        <Button size="sm" icon={UserRoundCheck} disabled={saving} onClick={() => setEmployeeStatus(selectedEmployee, 'ACTIVE')}>Activate</Button>
                      )}
                      {selectedEmployee.status !== 'ON_LEAVE' && (
                        <Button size="sm" icon={UserRound} disabled={saving} onClick={() => setEmployeeStatus(selectedEmployee, 'ON_LEAVE')}>Mark on leave</Button>
                      )}
                      {selectedEmployee.status !== 'INACTIVE' && selectedEmployee.id !== currentUser.id && (
                        <Button size="sm" variant="danger" icon={UserRoundX} disabled={saving} onClick={() => setEmployeeStatus(selectedEmployee, 'INACTIVE')}>Deactivate</Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-dashed border-line bg-surface px-3 py-3">
                  <h3 className="text-[13px] font-semibold text-ink">Task assignments</h3>
                  <p className="mt-1 text-[12px] text-muted">Task APIs are not connected in this phase, so assignment details are not loaded from prototype task data.</p>
                </div>
              </CardBody>
            </>
          ) : (
            <CardBody className="flex min-h-[320px] items-center justify-center text-[13px] text-muted">
              {loading ? 'Loading employee details…' : 'Select a person to view their details.'}
            </CardBody>
          )}
        </Card>
      </div>

      {idEditTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/35 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-id-edit-title"
            className="w-full max-w-lg rounded-xl border border-line bg-white p-5 shadow-pop"
          >
            <div className="mb-4">
              <h2 id="employee-id-edit-title" className="text-lg font-semibold text-ink">Edit Employee ID</h2>
              <p className="mt-1 text-xs text-muted">{idEditTarget.name} · {idEditTarget.email}</p>
            </div>
            <form onSubmit={submitEmployeeIdChange} className="space-y-4">
              <FormField label="Current Employee ID">
                <input readOnly value={idEditTarget.employeeId} className={`${inputClass} bg-surface-2 font-semibold`} />
              </FormField>
              <FormField label="New Employee ID">
                <input
                  required
                  autoFocus
                  maxLength={32}
                  value={newEmployeeId}
                  onChange={(event) => {
                    setNewEmployeeId(event.target.value.toUpperCase())
                    setEmployeeIdEditError('')
                  }}
                  className={inputClass}
                  aria-describedby="employee-id-format-help"
                />
                <p id="employee-id-format-help" className="mt-1 text-[11px] text-muted">
                  Use the company prefix and at least three digits. Previously issued IDs cannot be reused.
                </p>
              </FormField>
              <FormField label="Reason for change">
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                  value={employeeIdReason}
                  onChange={(event) => {
                    setEmployeeIdReason(event.target.value)
                    setEmployeeIdEditError('')
                  }}
                  className={`${inputClass} h-auto py-2`}
                  placeholder="Explain why this Employee ID is changing"
                />
              </FormField>
              {employeeIdEditError && <p role="alert" className="rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-[12px] text-brand-700">{employeeIdEditError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" disabled={employeeIdSaving} onClick={closeEmployeeIdEditor}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={employeeIdSaving}>
                  {employeeIdSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-line bg-white p-5 shadow-pop">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">{editingId ? 'Edit employee' : 'Create employee'}</h2>
                <p className="mt-1 text-xs text-muted">{editingId ? 'Only supported profile fields can be changed.' : 'New accounts are created active. Passwords are never returned by the API.'}</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Close dialog">✕</button>
            </div>
            <form onSubmit={handleSaveEmployee} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Full name">
                  <input required minLength={2} maxLength={160} value={employeeForm.name} onChange={(event) => setEmployeeForm({ ...employeeForm, name: event.target.value })} className={inputClass} />
                </FormField>
                <FormField label="Title">
                  <input required maxLength={160} value={employeeForm.title} onChange={(event) => setEmployeeForm({ ...employeeForm, title: event.target.value })} className={inputClass} />
                </FormField>
                <FormField label="Email">
                  <input required type="email" disabled={!!editingId} value={employeeForm.email} onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })} className={`${inputClass} disabled:bg-surface-2 disabled:text-muted`} />
                </FormField>
                <FormField label="Employee ID">
                  {!editingId && employeeForm.employeeIdMode === 'custom' ? (
                    <input
                      required
                      value={employeeForm.employeeId}
                      maxLength={32}
                      pattern={`${employeeForm.employeeIdPrefix}[0-9]{3,}`}
                      onChange={(event) => setEmployeeForm({ ...employeeForm, employeeId: event.target.value.toUpperCase() })}
                      placeholder={`${employeeForm.employeeIdPrefix}031`}
                      className={inputClass}
                    />
                  ) : (
                    <input readOnly value={employeeForm.employeeId || (employeeIdLoading ? 'Reserving…' : '')} className={`${inputClass} bg-surface-2 font-semibold`} />
                  )}
                  {!editingId && (
                    <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-muted">
                        {employeeForm.employeeIdMode === 'custom'
                          ? `Use ${employeeForm.employeeIdPrefix} followed by at least three digits.`
                          : 'Generated by the server and reserved for this account.'}
                      </p>
                      {employeeForm.employeeIdMode === 'custom' ? (
                        <button type="button" className="text-[11px] font-medium text-brand-700 underline" onClick={reserveEmployeeId}>
                          Use a generated ID
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-[11px] font-medium text-brand-700 underline"
                          onClick={() => setEmployeeForm({ ...employeeForm, employeeId: '', employeeIdMode: 'custom', employeeIdReservationToken: '' })}
                        >
                          Assign a custom ID
                        </button>
                      )}
                    </div>
                  )}
                  {employeeIdError && !editingId && <p role="alert" className="mt-1 text-[11px] text-brand-700">{employeeIdError}</p>}
                </FormField>
                {!editingId && (
                  <FormField label="Initial password">
                    <input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={employeeForm.password} onChange={(event) => setEmployeeForm({ ...employeeForm, password: event.target.value })} className={inputClass} />
                    <p className="mt-1 text-[11px] text-muted">At least 12 characters. Maximum 72 UTF-8 bytes.</p>
                  </FormField>
                )}
                {!editingId && (
                  <FormField label="Role">
                    <select required value={employeeForm.role} onChange={(event) => setEmployeeForm({ ...employeeForm, role: event.target.value })} className={inputClass}>
                      {allowedCreateRoles.map((roleOption) => <option key={roleOption} value={roleOption}>{ROLE_LABELS[roleOption]}</option>)}
                    </select>
                  </FormField>
                )}
                {(!editingId || canChangeDepartment) && (
                  <FormField label="Department">
                    <select required disabled={directoryLoading} value={employeeForm.departmentId} onChange={(event) => setEmployeeForm({ ...employeeForm, departmentId: event.target.value })} className={`${inputClass} disabled:bg-surface-2`}>
                      <option value="" disabled>{directoryLoading ? 'Loading departments…' : departments.length ? 'Select a department' : 'No departments available'}</option>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}{department.isActive ? '' : ' (Inactive — current assignment)'}</option>)}
                    </select>
                    {directoryError ? (
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-brand-700">
                        <span>{directoryError}</span>
                        <button type="button" className="font-medium underline" onClick={() => refreshDirectory().catch(() => {})}>Retry</button>
                      </div>
                    ) : !directoryLoading && departments.length === 0 && (
                      <p className="mt-1 text-[11px] text-brand-700">There are no active departments available in your authorized scope.</p>
                    )}
                  </FormField>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={saving || (!editingId && !allowedCreateRoles.length)}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create employee'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/35 p-4" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="password-reset-title"
            className="w-full max-w-lg rounded-xl border border-line bg-white p-5 shadow-pop"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="password-reset-title" className="text-lg font-semibold text-ink">
                  {resetSuccessPassword ? 'Password reset complete' : 'Reset employee password'}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {resetTarget.name} · {resetTarget.email}
                </p>
              </div>
              <button type="button" onClick={closePasswordReset} className="rounded p-1.5 text-muted hover:bg-surface-2" aria-label="Close dialog">✕</button>
            </div>

            {resetSuccessPassword ? (
              <div className="space-y-4">
                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">
                  The temporary password is shown once. Share it securely with the employee. They must choose a new password before accessing TaskFlow.
                </p>
                <div>
                  <label htmlFor="reset-password-once" className="mb-1 block text-[12px] font-medium text-ink">Temporary password</label>
                  <input id="reset-password-once" readOnly value={resetSuccessPassword} className={`${inputClass} font-mono`} />
                </div>
                <div className="flex justify-end">
                  <Button variant="primary" onClick={closePasswordReset}>Done</Button>
                </div>
              </div>
            ) : (
              <>
                <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-900">
                  You are about to reset this employee’s password. Their existing sessions will be terminated, and they will need to use the new temporary password to sign in.
                </p>
                {resetStatusError && <p role="alert" className="mb-3 text-[12px] text-brand-700">{resetStatusError}</p>}
                {resetStatus && (
                  <p className="mb-3 text-[12px] text-muted">
                    Current status: {resetStatus.mustChangePassword ? 'temporary password change required' : 'no pending password change'}.
                  </p>
                )}
                <form onSubmit={submitPasswordReset} className="space-y-4">
                  <div>
                    <label htmlFor="temporary-password" className="mb-1 block text-[12px] font-medium text-ink">New temporary password</label>
                    <div className="flex gap-2">
                      <input
                        id="temporary-password"
                        type={resetPasswordVisible ? 'text' : 'password'}
                        autoComplete="new-password"
                        minLength={12}
                        maxLength={72}
                        required
                        value={resetPassword}
                        onChange={(event) => setResetPassword(event.target.value)}
                        className={`${inputClass} min-w-0 flex-1`}
                      />
                      <Button type="button" size="sm" icon={resetPasswordVisible ? EyeOff : Eye} aria-label={resetPasswordVisible ? 'Hide password' : 'Show password'} onClick={() => setResetPasswordVisible((visible) => !visible)} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted">At least 12 characters and no more than 72 UTF-8 bytes.</p>
                  </div>
                  <div className="flex flex-wrap justify-between gap-2">
                    <Button type="button" variant="secondary" size="sm" icon={RefreshCw} onClick={generateResetPassword}>Generate secure password</Button>
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" disabled={resetSaving} onClick={closePasswordReset}>Cancel</Button>
                      <Button type="submit" variant="primary" disabled={resetSaving || !resetPassword}>
                        {resetSaving ? 'Resetting…' : 'Confirm password reset'}
                      </Button>
                    </div>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </RoleGuard>
  )
}

function createSecureTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-_'
  const maximum = Math.floor(0x100000000 / alphabet.length) * alphabet.length
  let password = ''
  while (password.length < 24) {
    const values = new Uint32Array(24)
    globalThis.crypto.getRandomValues(values)
    for (const value of values) {
      if (value >= maximum) continue
      password += alphabet[value % alphabet.length]
      if (password.length === 24) break
    }
  }
  return password
}

const inputClass = 'h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]'

function FormField({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-medium text-ink">{label}</label>
      {children}
    </div>
  )
}
