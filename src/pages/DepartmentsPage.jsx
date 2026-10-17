import { useMemo, useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { Card, CardBody, CardHeader } from '../components/ui/Card'
import RoleGuard from '../components/layout/RoleGuard'
import { useApp } from '../store/useApp'
import { useToast } from '../components/ui/useToast'
import { canCreateDepartment, canManageDepartment } from '../permissions/taskPermissions'

const emptyDepartment = () => ({ name: '', code: '', description: '', headId: '' })

export default function DepartmentsPage() {
  const { currentUser, role, departments, users, tasks, createDepartment, updateDepartment, addActivity } = useApp()
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDepartmentId, setEditingDepartmentId] = useState(null)
  const [form, setForm] = useState(emptyDepartment())

  const departmentSummary = useMemo(
    () =>
      departments.filter((department) => role === 'superadmin' || (currentUser.scopeDepartmentIds || [currentUser.departmentId]).includes(department.id)).map((department) => {
        const members = users.filter((user) => user.departmentId === department.id)
        const memberIds = members.map((user) => user.id)
        const activeTasks = tasks.filter((task) => !['Completed', 'Cancelled'].includes(task.status) && (memberIds.includes(task.assigneeId) || task.departmentId === department.id))
        return { ...department, members, activeTasks }
      }),
    [departments, users, tasks, role, currentUser],
  )

  const openCreate = () => {
    setEditingDepartmentId(null)
    setForm(emptyDepartment())
    setModalOpen(true)
  }

  const openEdit = (department) => {
    if (!canManageDepartment(currentUser, department).allowed) return
    setEditingDepartmentId(department.id)
    setForm({ name: department.name, code: department.code, description: department.description, headId: department.headId || '' })
    setModalOpen(true)
  }

  const handleSave = (event) => {
    event.preventDefault()
    const name = form.name.trim()
    const code = form.code.trim().toUpperCase()
    if (!name || !code) {
      toast({ title: 'Department details required', description: 'Enter a department name and code.', type: 'error' })
      return
    }
    if (departments.some((department) => department.id !== editingDepartmentId && department.code.toLowerCase() === code.toLowerCase())) {
      toast({ title: 'Department code already exists', description: 'Choose a unique department code.', type: 'error' })
      return
    }
    const payload = { name, code, description: form.description.trim(), headId: form.headId || null }
    if (editingDepartmentId) {
      const updated = updateDepartment(editingDepartmentId, payload)
      if (!updated) {
        toast({ title: 'Permission denied', description: 'You cannot manage this department or assign that department head.', type: 'error' })
        return
      }
      addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'department', text: `${currentUser.name} updated department ${name}.`, createdAt: new Date().toISOString() })
      toast({ title: 'Department updated', description: `${name} has been updated.`, type: 'success' })
    } else {
      const createdId = createDepartment(payload)
      if (!createdId) {
        toast({ title: 'Permission denied', description: 'Only Superadmin can create departments.', type: 'error' })
        return
      }
      addActivity({ id: `a-${Date.now()}`, userId: currentUser.id, type: 'department', text: `${currentUser.name} created department ${name}.`, createdAt: new Date().toISOString() })
      toast({ title: 'Department created', description: `${name} is now available.`, type: 'success' })
    }
    setModalOpen(false)
  }

  return (
    <RoleGuard pageKey="departments">
      <PageHeader title="Departments" description="Department roster, ownership and assigned work areas." actions={canCreateDepartment(currentUser).allowed && <Button variant="primary" icon={Plus} onClick={openCreate}>New department</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        {departmentSummary.map((department) => (
          <Card key={department.id}>
            <CardHeader title={department.name} subtitle={department.code} action={<div className="flex items-center gap-2"><Badge tone="neutral">{department.members.length} members</Badge>{canManageDepartment(currentUser, department).allowed && <button type="button" onClick={() => openEdit(department)} aria-label={`Edit ${department.name}`} className="rounded p-1.5 text-muted hover:bg-surface-2"><Pencil className="h-4 w-4" /></button>}</div>} />
            <CardBody className="space-y-3">
              <p className="text-[13px] text-ink-2">{department.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="blue">Head: {users.find((user) => user.id === department.headId)?.name ?? 'Unassigned'}</Badge>
                <Badge tone="amber">{department.activeTasks.length} tasks</Badge>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Team</p>
                <div className="flex flex-wrap gap-2">
                  {department.members.map((member) => (
                    <span key={member.id} className="rounded-full border border-line bg-surface px-2 py-1 text-[11px] text-ink-2">{member.name}</span>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-4">
        <div className="w-full max-w-xl rounded-lg border border-line bg-white p-5 shadow-pop">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-ink">{editingDepartmentId ? 'Edit department' : 'Create department'}</h2><button type="button" onClick={() => setModalOpen(false)} aria-label="Close dialog" className="rounded p-1.5 text-muted hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
          <form onSubmit={handleSave} className="space-y-3">
            <label className="block text-[12px] font-medium text-ink">Department name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-medium text-ink">Code<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]" /></label>
              <label className="block text-[12px] font-medium text-ink">Department head<select disabled={!editingDepartmentId} value={form.headId} onChange={(event) => setForm({ ...form, headId: event.target.value })} className="mt-1 h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[13px]"><option value="">No head assigned</option>{users.filter((user) => !editingDepartmentId || user.departmentId === editingDepartmentId).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
            </div>
            <label className="block text-[12px] font-medium text-ink">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="mt-1 w-full rounded-md border border-line bg-surface px-2.5 py-2 text-[13px]" /></label>
            <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button type="submit" variant="primary">{editingDepartmentId ? 'Save department' : 'Create department'}</Button></div>
          </form>
        </div>
      </div>}
    </RoleGuard>
  )
}
