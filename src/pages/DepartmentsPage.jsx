import { useCallback, useEffect, useMemo, useState } from 'react'
import { Building2, Pencil, Plus, Search, Users } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import RoleGuard from '../components/layout/RoleGuard'
import { useApp } from '../store/useApp'
import { apiClient, ApiError } from '../api/apiClient.js'
import { useToast } from '../components/ui/useToast.js'
import { canCreateDepartment, canManageDepartment } from '../permissions/taskPermissions.js'

const EMPTY_FORM = { name: '', code: '', description: '' }

function errorMessage(error) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Sign in again to continue.'
    if (error.status === 403) return 'Your account is not permitted to access this department.'
    if (error.status === 409 && error.code === 'DEPARTMENT_ALREADY_EXISTS') return 'A department with this name or code already exists.'
    if (error.status === 409 && error.code === 'DEPARTMENT_HAS_ACTIVE_EMPLOYEES') return 'This department still has active employees. Reassign or deactivate them before deactivating the department.'
    return error.message
  }
  return 'The department request failed. Please try again.'
}

function displayDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

export default function DepartmentsPage() {
  const { currentUser, refreshDirectory } = useApp()
  const toast = useToast()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDepartment, setSelectedDepartment] = useState(null)
  const [members, setMembers] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const loadDepartments = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const response = await apiClient.departments.list()
      if (!Array.isArray(response?.data)) throw new Error('The department response was invalid.')
      setDepartments(response.data)
      setSelectedId((previous) => response.data.some((department) => department.id === previous) ? previous : null)
    } catch (error) {
      setDepartments([])
      setSelectedId(null)
      setLoadError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  useEffect(() => {
    if (!selectedId) {
      setSelectedDepartment(null)
      setMembers([])
      setDetailError('')
      setDetailLoading(false)
      return undefined
    }

    let active = true
    setDetailLoading(true)
    setDetailError('')
    Promise.all([
      apiClient.departments.get(selectedId),
      apiClient.departments.employees(selectedId),
    ]).then(([departmentResponse, employeeResponse]) => {
      if (!active) return
      if (!departmentResponse?.data || !Array.isArray(employeeResponse?.data)) {
        throw new Error('The department details response was invalid.')
      }
      setSelectedDepartment(departmentResponse.data)
      setMembers(employeeResponse.data)
    }).catch((error) => {
      if (!active) return
      setSelectedDepartment(null)
      setMembers([])
      setDetailError(errorMessage(error))
    }).finally(() => {
      if (active) setDetailLoading(false)
    })
    return () => { active = false }
  }, [selectedId])

  const filteredDepartments = useMemo(() => {
    const query = search.trim().toLowerCase()
    return departments.filter((department) => {
      const matchesSearch = !query ||
        department.name.toLowerCase().includes(query) ||
        department.code.toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' ? department.isActive : !department.isActive)
      return matchesSearch && matchesStatus
    })
  }, [departments, search, statusFilter])

  const activeCount = departments.filter((department) => department.isActive).length
  const employeeCount = departments.reduce((total, department) => total + (department._count?.employees || 0), 0)
  const mayCreate = canCreateDepartment(currentUser).allowed
  const mayManageSelected = selectedDepartment && canManageDepartment(currentUser, selectedDepartment).allowed

  function openCreate() {
    if (!mayCreate) return
    setEditingId(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(department) {
    if (!canManageDepartment(currentUser, department).allowed) return
    setEditingId(department.id)
    setForm({
      name: department.name,
      code: department.code,
      description: department.description || '',
    })
    setModalOpen(true)
  }

  async function saveDepartment(event) {
    event.preventDefault()
    if (saving || (editingId ? !canManageSelected : !mayCreate)) return
    if (!form.name.trim() || !form.code.trim()) {
      toast({ title: 'Department details required', description: 'Enter a department name and code.', type: 'error' })
      return
    }
    setSaving(true)
    try {
      const input = {
        name: form.name.trim(),
        code: form.code.trim(),
        description: form.description.trim() || null,
      }
      const response = editingId
        ? await apiClient.departments.update(editingId, input)
        : await apiClient.departments.create(input)
      setModalOpen(false)
      setSelectedId(response.data.id)
      toast({
        title: editingId ? 'Department updated' : 'Department created',
        description: 'The department record was saved.',
        type: 'success',
      })
      await Promise.all([loadDepartments(), refreshDirectory().catch(() => {})])
    } catch (error) {
      toast({ title: 'Department was not saved', description: errorMessage(error), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(department) {
    if (!canManageDepartment(currentUser, department).allowed || saving) return
    const isActive = !department.isActive
    if (!isActive && !window.confirm(`Deactivate ${department.name}? Active employees must be reassigned or deactivated first.`)) return
    setSaving(true)
    try {
      const response = await apiClient.departments.setStatus(department.id, isActive)
      setSelectedDepartment(response.data)
      toast({ title: `Department ${isActive ? 'activated' : 'deactivated'}`, type: 'success' })
      await Promise.all([loadDepartments(), refreshDirectory().catch(() => {})])
    } catch (error) {
      toast({ title: 'Department status was not changed', description: errorMessage(error), type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <RoleGuard pageKey="departments">
      <PageHeader
        title="Departments"
        description="Manage department records and view employees within your authorized scope."
        actions={mayCreate && <Button variant="primary" icon={Plus} onClick={openCreate}>New department</Button>}
      />

      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-200 bg-brand-50 px-3 py-2.5 text-[13px] text-brand-700" role="alert">
          <span>{loadError}</span>
          <Button size="sm" onClick={loadDepartments} disabled={loading}>Retry</Button>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Building2} label="Departments" value={departments.length} />
        <SummaryCard icon={Building2} label="Active" value={activeCount} />
        <SummaryCard icon={Users} label="Employees assigned" value={employeeCount} />
      </div>

      <Card className="mb-4">
        <CardBody className="grid gap-3 sm:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <input aria-label="Search departments" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by department name or code" className="h-9 w-full rounded-md border border-line bg-surface pl-9 text-[13px]" />
          </div>
          <select aria-label="Filter department status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-md border border-line bg-white px-2 text-[13px]">
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="Department directory" subtitle={loading ? 'Loading departments…' : `${filteredDepartments.length} departments`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead className="bg-surface text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-3 py-3 font-medium">Employees</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td className="px-4 py-6 text-muted" colSpan="4">Loading department directory…</td></tr>}
                {!loading && !loadError && filteredDepartments.map((department) => (
                  <tr key={department.id} className={`cursor-pointer border-t border-line-soft hover:bg-surface ${selectedId === department.id ? 'bg-brand-50/40' : ''}`} onClick={() => setSelectedId(department.id)}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{department.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{department.code}</p>
                    </td>
                    <td className="px-3 py-3 text-ink-2">{department._count?.employees ?? 0}</td>
                    <td className="px-3 py-3"><Badge tone={department.isActive ? 'green' : 'neutral'}>{department.isActive ? 'Active' : 'Inactive'}</Badge></td>
                    <td className="px-3 py-3 text-muted">{displayDate(department.createdAt)}</td>
                  </tr>
                ))}
                {!loading && !loadError && filteredDepartments.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-muted" colSpan="4">{departments.length ? 'No departments match these filters.' : 'No departments available.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          {detailLoading ? (
            <CardBody><p className="text-[13px] text-muted" role="status">Loading department details…</p></CardBody>
          ) : detailError ? (
            <CardBody><p className="text-[13px] text-red-700" role="alert">{detailError}</p></CardBody>
          ) : selectedDepartment ? (
            <>
              <CardHeader
                title={selectedDepartment.name}
                subtitle={`Department code · ${selectedDepartment.code}`}
                action={mayManageSelected && <Button size="sm" icon={Pencil} onClick={() => openEdit(selectedDepartment)}>Edit</Button>}
              />
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={selectedDepartment.isActive ? 'green' : 'neutral'}>{selectedDepartment.isActive ? 'Active' : 'Inactive'}</Badge>
                  <Badge tone="blue">{selectedDepartment._count?.employees ?? members.length} employees</Badge>
                </div>
                <p className="text-[13px] leading-5 text-ink-2">{selectedDepartment.description || 'No department description has been added.'}</p>
                <div className="grid grid-cols-2 gap-3 border-y border-line-soft py-3 text-[12px]">
                  <Info label="Created" value={displayDate(selectedDepartment.createdAt)} />
                  <Info label="Last updated" value={displayDate(selectedDepartment.updatedAt)} />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold text-ink">Employees</h3>
                    <span className="text-[11px] text-muted">{members.length}</span>
                  </div>
                  {members.length ? (
                    <ul className="divide-y divide-line-soft">
                      {members.map((employee) => (
                        <li key={employee.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink">{employee.name}</p>
                            <p className="truncate text-[11px] text-muted">{employee.title} · {employee.email}</p>
                          </div>
                          <Badge tone={employee.status === 'ACTIVE' ? 'green' : employee.status === 'INACTIVE' ? 'neutral' : 'amber'}>{employee.status.replaceAll('_', ' ')}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-md border border-dashed border-line px-3 py-5 text-center text-[12px] text-muted">No employees are assigned to this department.</p>
                  )}
                </div>
                {mayManageSelected && (
                  <div className="border-t border-line-soft pt-3">
                    <Button size="sm" variant={selectedDepartment.isActive ? 'danger' : 'secondary'} disabled={saving} onClick={() => toggleStatus(selectedDepartment)}>
                      {selectedDepartment.isActive ? 'Deactivate department' : 'Activate department'}
                    </Button>
                  </div>
                )}
              </CardBody>
            </>
          ) : (
            <CardBody className="flex min-h-[260px] items-center justify-center text-center text-[13px] text-muted">
              {departments.length ? 'Select a department to view its details and employees.' : 'Department details will appear here when available.'}
            </CardBody>
          )}
        </Card>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="department-dialog-title" className="w-full max-w-xl rounded-xl border border-line bg-white p-5 shadow-pop">
            <div className="mb-4">
              <h2 id="department-dialog-title" className="text-lg font-semibold text-ink">{editingId ? 'Edit department' : 'Create department'}</h2>
              <p className="mt-1 text-[13px] text-muted">Department records are shared only within your authorized organization scope.</p>
            </div>
            <form onSubmit={saveDepartment} className="space-y-4">
              <FormField label="Department name">
                <input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))} className={inputClass} />
              </FormField>
              <FormField label="Department code">
                <input required minLength={2} maxLength={24} value={form.code} onChange={(event) => setForm((value) => ({ ...value, code: event.target.value }))} className={inputClass} />
              </FormField>
              <FormField label="Description">
                <textarea maxLength={5000} rows="4" value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} className="w-full rounded-md border border-line bg-surface px-2.5 py-2 text-[13px]" />
              </FormField>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" disabled={saving} onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create department'}</Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </RoleGuard>
  )
}

function SummaryCard({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-700"><Icon className="h-4 w-4" /></span>
        <div><p className="text-[11px] text-muted">{label}</p><p className="text-lg font-semibold text-ink">{value}</p></div>
      </CardBody>
    </Card>
  )
}

function Info({ label, value }) {
  return <div><p className="text-[10px] uppercase tracking-wide text-faint">{label}</p><p className="mt-1 font-medium text-ink-2">{value}</p></div>
}

function FormField({ label, children }) {
  return <label className="block text-[12px] font-medium text-ink">{label}<span className="mt-1 block">{children}</span></label>
}

const inputClass = 'h-10 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]'
