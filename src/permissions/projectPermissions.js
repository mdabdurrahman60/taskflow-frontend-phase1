import { canViewTask } from './taskPermissions.js'

export function projectDepartmentScope(user) {
  if (!user) return []
  if (user.role === 'superadmin') return null
  if (user.role === 'admin') return user.scopeDepartmentIds?.length ? user.scopeDepartmentIds : [user.departmentId].filter(Boolean)
  return [user.departmentId].filter(Boolean)
}

export function canViewProject(user, project, tasks = []) {
  if (!user || !project) return false
  if (user.role === 'superadmin') return true

  const scope = projectDepartmentScope(user)
  if (user.role === 'admin') return scope.includes(project.departmentId)
  if (user.role === 'manager' && scope.includes(project.departmentId)) return true

  if (project.projectManagerId === user.id || project.ownerId === user.id || (project.teamMemberIds || []).includes(user.id)) return true
  if (user.role === 'manager') return false
  return tasks.some((task) => task.projectId === project.id && canViewTask(user, task).allowed)
}

export function canManageProject(user, project) {
  if (!user || !['superadmin', 'admin', 'manager'].includes(user.role)) return false
  if (!project) return true
  if (user.role === 'superadmin') return true
  return projectDepartmentScope(user).includes(project.departmentId)
}

export function eligibleProjectManagers(user, users, departmentId) {
  if (!user || !['superadmin', 'admin', 'manager'].includes(user.role)) return []
  return users.filter((candidate) => {
    if (candidate.status !== 'Active') return false
    if (user.role === 'superadmin') return true
    const scope = projectDepartmentScope(user)
    if (!scope.includes(departmentId) || !scope.includes(candidate.departmentId)) return false
    if (user.role === 'manager' && candidate.departmentId !== user.departmentId) return false
    return ['manager', 'admin'].includes(candidate.role)
  })
}

export function eligibleProjectMembers(user, users, departmentId) {
  if (!user || !['superadmin', 'admin', 'manager'].includes(user.role)) return []
  return users.filter((candidate) => {
    if (candidate.status !== 'Active') return false
    if (user.role === 'superadmin') return true
    const scope = projectDepartmentScope(user)
    if (!scope.includes(departmentId) || !scope.includes(candidate.departmentId)) return false
    if (user.role === 'manager') return candidate.departmentId === user.departmentId && ['support', 'executive'].includes(candidate.role)
    return candidate.role !== 'superadmin'
  })
}

export function canAssociateTaskWithProject(user, project, taskDepartmentId) {
  if (!project || project.departmentId !== taskDepartmentId) return false
  if (canViewProject(user, project)) return true
  if (user?.role === 'admin') return projectDepartmentScope(user).includes(taskDepartmentId)
  return user?.role === 'superadmin' || user?.departmentId === taskDepartmentId
}
