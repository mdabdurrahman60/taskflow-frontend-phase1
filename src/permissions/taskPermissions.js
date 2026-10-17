export const ROLE_PERMISSION_MATRIX = {
  superadmin: {
    canCreateTopLevelTasks: 'All task types across the organization',
    eligibleTaskAssignees: 'Any active employee, including self',
    canCreatePeerSubtasks: 'Across the organization',
    canReassignTasks: 'Across departments',
    canManageDepartments: 'All departments',
    canManageEmployees: 'All employees and role governance',
    canAccessGlobalReports: true,
    canAccessEmployeePerformanceReports: true,
    canEscalateTickets: true,
    canViewRolePermissions: true,
  },
  admin: {
    canCreateTopLevelTasks: 'Authorized work in scoped departments',
    eligibleTaskAssignees: 'Managers, HR, Support Staff, Executives, and self within scope',
    canCreatePeerSubtasks: 'Within authorized department scope',
    canReassignTasks: 'Within authorized department scope',
    canManageDepartments: 'Authorized departments only',
    canManageEmployees: 'Users in scope; role changes restricted',
    canAccessGlobalReports: false,
    canAccessEmployeePerformanceReports: true,
    canEscalateTickets: true,
    canViewRolePermissions: true,
  },
  manager: {
    canCreateTopLevelTasks: 'Operational work in own department',
    eligibleTaskAssignees: 'Support Staff, Executives, or self in own department',
    canCreatePeerSubtasks: 'Within own department',
    canReassignTasks: 'Eligible employees in own department',
    canManageDepartments: false,
    canManageEmployees: false,
    canAccessGlobalReports: false,
    canAccessEmployeePerformanceReports: true,
    canEscalateTickets: true,
    canViewRolePermissions: true,
  },
  hr: {
    canCreateTopLevelTasks: 'HR workflows in the HR department only',
    eligibleTaskAssignees: 'Managers, Support Staff, and Executives for HR workflows',
    canCreatePeerSubtasks: 'Only within authorized HR workflows',
    canReassignTasks: 'HR workflows and eligible employees only',
    canManageDepartments: false,
    canManageEmployees: true,
    canAccessGlobalReports: false,
    canAccessEmployeePerformanceReports: false,
    canEscalateTickets: false,
    canViewRolePermissions: true,
  },
  support: {
    canCreateTopLevelTasks: 'Ticket-linked follow-up work only',
    eligibleTaskAssignees: 'Self for an assigned ticket follow-up',
    canCreatePeerSubtasks: 'Eligible subtasks for accessible support work',
    canReassignTasks: 'No top-level task reassignment',
    canManageDepartments: false,
    canManageEmployees: false,
    canAccessGlobalReports: false,
    canAccessEmployeePerformanceReports: false,
    canEscalateTickets: true,
    canViewRolePermissions: false,
  },
  executive: {
    canCreateTopLevelTasks: 'Personal work in own department; self only',
    eligibleTaskAssignees: 'Self for personal work; eligible peers for subtasks',
    canCreatePeerSubtasks: true,
    canReassignTasks: 'No top-level task reassignment',
    canManageDepartments: false,
    canManageEmployees: false,
    canAccessGlobalReports: false,
    canAccessEmployeePerformanceReports: false,
    canEscalateTickets: false,
    canViewRolePermissions: false,
  },
}

export function allow(message = 'Allowed.') {
  return { allowed: true, reason: message }
}

export function deny(reason) {
  return { allowed: false, reason }
}

export function normalizeTaskType(taskContext = {}) {
  const value = taskContext.taskType || taskContext.type || taskContext.category
  if (value) {
    const normalized = String(value).toLowerCase()
    if (['onboarding', 'offboarding', 'compliance', 'employee documentation', 'attendance follow-up', 'workplace request', 'people'].includes(normalized)) return 'hr'
    if (['ticket follow-up', 'support follow-up', 'it support'].includes(normalized)) return 'support'
    return normalized
  }
  if (taskContext.departmentId === 'd-hr' || taskContext.departmentId === 'd-people') return 'hr'
  if (taskContext.departmentId === 'd-it' || taskContext.projectId === 'p-it') return 'support'
  if (taskContext.isSubtask || taskContext.parentTaskId) return 'subtask'
  return 'operational'
}

export function isActiveUser(user) {
  return !!user && user.status === 'Active'
}

export function canViewTask(user, task) {
  if (!user || !task) return deny('Parent task does not exist.')
  if (user.role === 'superadmin') return allow('Allowed.')

  const isTaskOwner = task.assigneeId === user.id || task.reporterId === user.id || task.creatorId === user.id
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return scope.includes(task.departmentId)
      ? allow('Allowed.')
      : deny('You do not have permission to manage this task.')
  }

  if (user.role === 'manager') {
    if (isTaskOwner) return allow('Allowed.')
    return task.departmentId === user.departmentId ? allow('Allowed.') : deny('Target employee is outside your department.')
  }

  if (user.role === 'hr') {
    if (task.departmentId === 'd-hr' || isTaskOwner) return allow('Allowed.')
    return deny('You do not have permission to manage this task.')
  }

  if (user.role === 'support') {
    if (task.departmentId === user.departmentId || isTaskOwner) return allow('Allowed.')
    return deny('You do not have permission to manage this task.')
  }

  if (user.role === 'executive') {
    if (isTaskOwner) return allow('Allowed.')
    return deny('You do not have permission to manage this task.')
  }

  return deny('You do not have permission to manage this task.')
}

export function canCreateTask(user, taskContext = {}) {
  if (!user) return deny('User is not available.')
  if (!isActiveUser(user)) return deny('Inactive employees cannot create new tasks.')

  const taskType = normalizeTaskType(taskContext)

  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    if (taskContext.departmentId && !scope.includes(taskContext.departmentId)) {
      return deny('Task creation is outside your authorized department scope.')
    }
    if (taskType === 'support' && taskContext.departmentId !== 'd-it') {
      return deny('Admin task creation is limited to authorized departments and cross-team initiatives.')
    }
    return allow('Allowed.')
  }
  if (user.role === 'manager') {
    if (taskType !== 'operational') return deny('Manager task creation is limited to operational work within their department.')
    if (taskContext.departmentId && taskContext.departmentId !== user.departmentId) {
      return deny('Target employee is outside your department.')
    }
    return allow('Allowed.')
  }
  if (user.role === 'hr') {
    if (taskType !== 'hr' || taskContext.departmentId !== 'd-hr') return deny('HR can create only HR-related work in the HR department.')
    return allow('Allowed.')
  }
  if (user.role === 'support') {
    if (taskContext.isTicketFollowUp && taskType === 'support' && taskContext.departmentId === user.departmentId && taskContext.sourceTicketAssignedTo === user.id) return allow('Allowed.')
    return deny('Support Staff can create permitted follow-up subtasks, not top-level tasks.')
  }
  if (user.role === 'executive') {
    if (taskType !== 'personal' || taskContext.departmentId !== user.departmentId) return deny('Executive top-level tasks are limited to personal work in their department.')
    return allow('Allowed.')
  }

  return deny('You do not have permission to create this task.')
}

export function canAssignTask(user, targetUser, taskContext = {}) {
  if (!user) return deny('User is not available.')
  if (!targetUser) return deny('Task cannot be assigned to an employee who does not exist.')
  if (!isActiveUser(targetUser)) return deny('Inactive employees cannot receive new assignments.')

  const taskType = normalizeTaskType(taskContext)

  if (user.role === 'superadmin') {
    return allow('Allowed.')
  }

  if (user.role === 'admin') {
    if (targetUser.role === 'superadmin') return deny('Cannot assign tasks to Superadmin.')
    if (targetUser.role === 'admin' && targetUser.id !== user.id) return deny('Admins can assign work to themselves or eligible staff, not other Admins.')
    const scope = user.scopeDepartmentIds || [user.departmentId]
    if (!scope.includes(targetUser.departmentId)) return deny('Target employee is outside your authorized department scope.')
    return allow('Allowed.')
  }

  if (user.role === 'manager') {
    if (taskType === 'hr') return deny('Manager task assignment is limited to operational tasks in their department.')
    if (targetUser.id === user.id) return targetUser.departmentId === user.departmentId ? allow('Allowed.') : deny('Self-assignment must remain within your department.')
    if (targetUser.role === 'manager' || targetUser.role === 'admin' || targetUser.role === 'superadmin' || targetUser.role === 'hr') {
      return deny('Cannot assign to this role via the standard manager workflow.')
    }
    if (targetUser.departmentId !== user.departmentId) {
      return deny('Target employee is outside your department.')
    }
    return allow('Allowed.')
  }

  if (user.role === 'hr') {
    if (taskType !== 'hr') return deny('HR can assign only HR-related tasks.')
    if (['admin', 'superadmin'].includes(targetUser.role)) return deny('Cannot assign to this role.')
    if (!['manager', 'support', 'executive'].includes(targetUser.role)) {
      return deny('This assignment is outside the HR workflow.')
    }
    return allow('Allowed.')
  }

  if (user.role === 'support') {
    if (taskContext.isTicketFollowUp && taskType === 'support' && taskContext.departmentId === user.departmentId && targetUser.id === user.id && taskContext.sourceTicketAssignedTo === user.id) return allow('Allowed.')
    return deny('Support Staff can assign only ticket-linked follow-up work to themselves.')
  }

  if (user.role === 'executive') {
    if (taskContext.isSubtask || taskContext.parentTaskId) {
      return canAssignSubtask(user, targetUser, taskContext.parentTask)
    }
    if (targetUser.id !== user.id) {
      return deny('Peer assignment is allowed only for subtasks.')
    }
    return allow('Allowed.')
  }

  return deny('You do not have permission to assign this task.')
}

export function canCreateSubtask(user, parentTask) {
  if (!parentTask) return deny('Parent task does not exist.')
  if (!user) return deny('User is not available.')
  if (!isActiveUser(user)) return deny('Inactive employees cannot create subtasks.')
  const accessCheck = canViewTask(user, parentTask)
  if (!accessCheck.allowed) return accessCheck

  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin') return allow('Allowed.')
  if (user.role === 'manager') {
    if (parentTask.departmentId !== user.departmentId) return deny('Target employee is outside your department.')
    return allow('Allowed.')
  }
  if (user.role === 'hr') {
    if (parentTask.departmentId === 'd-hr' || parentTask.reporterId === user.id || parentTask.assigneeId === user.id) {
      return allow('Allowed.')
    }
    return deny('You do not have permission to manage this task.')
  }
  if (user.role === 'support') {
    if (parentTask.departmentId === user.departmentId || parentTask.assigneeId === user.id) return allow('Allowed.')
    return deny('Support Staff can only create subtasks for support work.')
  }
  if (user.role === 'executive') {
    if (parentTask.assigneeId === user.id || parentTask.reporterId === user.id || parentTask.creatorId === user.id) {
      return allow('Allowed.')
    }
    return deny('Executive peer subtasks are allowed only for tasks they own or manage.')
  }

  return deny('You do not have permission to create a subtask.')
}

export function canAssignSubtask(user, targetUser, parentTask) {
  if (!parentTask) return deny('Parent task does not exist.')
  if (!user) return deny('User is not available.')
  if (!targetUser) return deny('Task cannot be assigned to an employee who does not exist.')
  if (!isActiveUser(targetUser)) return deny('Inactive employees cannot receive new assignments.')
  const parentAccess = canViewTask(user, parentTask)
  if (!parentAccess.allowed) return parentAccess

  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin') {
    if (targetUser.role === 'superadmin') return deny('Cannot assign tasks to Superadmin.')
    if (targetUser.role === 'admin' && targetUser.id !== user.id) return deny('Admins cannot assign subtasks to other Admins.')
    const scope = user.scopeDepartmentIds || [user.departmentId]
    if (!scope.includes(parentTask.departmentId) || !scope.includes(targetUser.departmentId)) {
      return deny('Subtask assignment is outside your authorized department scope.')
    }
    return allow('Allowed.')
  }
  if (user.role === 'manager') {
    if (parentTask.departmentId !== user.departmentId) return deny('Parent task is outside your department.')
    if (targetUser.id === user.id) return allow('Allowed.')
    if (targetUser.role === 'manager' || targetUser.role === 'admin' || targetUser.role === 'superadmin' || targetUser.role === 'hr') {
      return deny('Cannot assign a subtask to this role.')
    }
    if (targetUser.departmentId !== user.departmentId) {
      return deny('Target employee is outside your department.')
    }
    return allow('Allowed.')
  }
  if (user.role === 'hr') {
    if (parentTask.departmentId !== 'd-hr') return deny('HR subtasks must belong to an HR workflow.')
    if (!['manager', 'support', 'executive'].includes(targetUser.role)) {
      return deny('This subtask assignment is outside the HR workflow.')
    }
    return allow('Allowed.')
  }
  if (user.role === 'support') {
    if (parentTask.departmentId !== user.departmentId && parentTask.assigneeId !== user.id) return deny('Support Staff can only assign subtasks for support work they can access.')
    if (targetUser.departmentId !== parentTask.departmentId) return deny('Support subtasks must stay in the parent task department.')
    if (!['executive', 'support'].includes(targetUser.role)) {
      return deny('Support follow-up subtasks can only be assigned to eligible support or executive staff.')
    }
    return allow('Allowed.')
  }
  if (user.role === 'executive') {
    if (targetUser.role === 'manager' || targetUser.role === 'admin' || targetUser.role === 'superadmin') {
      return deny('Executive collaborative subtasks cannot be assigned to Managers, Admins, or Superadmin.')
    }
    if (targetUser.role !== 'executive' && targetUser.id !== user.id) {
      return deny('Peer assignment is allowed only for subtasks and eligible peers.')
    }
    if (targetUser.id !== user.id && targetUser.departmentId !== parentTask.departmentId) {
      return deny('Collaborative subtasks must stay within the parent task department.')
    }
    return allow('Allowed.')
  }

  return deny('You do not have permission to assign this subtask.')
}

export function canEditTask(user, task) {
  if (!task) return deny('Parent task does not exist.')
  if (!user) return deny('User is not available.')
  const manageCheck = canViewTask(user, task)
  if (!manageCheck.allowed) return manageCheck
  if (user.role === 'manager' && task.departmentId !== user.departmentId) return deny('Managers cannot manage unrelated departments.')
  if (user.role === 'hr' && task.departmentId !== 'd-hr' && task.assigneeId !== user.id && task.reporterId !== user.id) return deny('You do not have permission to manage this task.')
  if (user.role === 'support' && task.departmentId !== user.departmentId && task.assigneeId !== user.id) return deny('You do not have permission to manage this task.')
  if (user.role === 'executive') {
    return task.assigneeId === user.id || task.creatorId === user.id || task.reporterId === user.id
      ? allow('Allowed.')
      : deny('You do not have permission to manage this task.')
  }
  return allow('Allowed.')
}

export function canDeleteTask(user, task) {
  if (!task) return deny('Parent task does not exist.')
  if (!user) return deny('User is not available.')
  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return scope.includes(task.departmentId) ? allow('Allowed.') : deny('Task is outside your authorized scope.')
  }
  if (user.role === 'manager') {
    return task.departmentId === user.departmentId ? allow('Allowed.') : deny('You do not have permission to manage this task.')
  }
  if (user.role === 'hr' && task.departmentId === 'd-hr') return allow('Allowed.')
  return deny('You do not have permission to delete this task.')
}

export function canChangeTaskDepartment(user, task, departmentId) {
  if (!user) return deny('User is not available.')
  if (!task || !departmentId) return deny('Task and target department are required.')
  if (user.role === 'superadmin') return allow('Allowed.')
  if (!canViewTask(user, task).allowed) return deny('You do not have permission to manage this task.')
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return scope.includes(task.departmentId) && scope.includes(departmentId) ? allow('Allowed.') : deny('Department change is outside your authorized scope.')
  }
  if (user.role === 'manager' && task.departmentId === user.departmentId && departmentId === user.departmentId) return allow('Allowed.')
  if (user.role === 'hr' && task.departmentId === 'd-hr' && departmentId === 'd-hr') return allow('Allowed.')
  if (user.role === 'support' && task.departmentId === 'd-it' && departmentId === 'd-it') return allow('Allowed.')
  return deny('You do not have permission to change this task department.')
}

export function canChangeTaskStatus(user, task) {
  if (!task) return deny('Parent task does not exist.')
  if (!user) return deny('User is not available.')
  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin' && canViewTask(user, task).allowed) return allow('Allowed.')
  if (user.role === 'manager' && task.departmentId === user.departmentId) return allow('Allowed.')
  if (user.role === 'hr' && (task.departmentId === 'd-hr' || task.assigneeId === user.id || task.reporterId === user.id)) return allow('Allowed.')
  if (user.role === 'support' && (task.departmentId === user.departmentId || task.assigneeId === user.id)) return allow('Allowed.')
  if (user.role === 'executive' && task.assigneeId === user.id) return allow('Allowed.')
  return deny('You do not have permission to change this task status.')
}

export function canReassignTask(user, task, targetUser) {
  if (!task) return deny('Parent task does not exist.')
  if (!targetUser) return deny('Task cannot be assigned to an employee who does not exist.')
  const taskContext = { taskType: normalizeTaskType({ departmentId: task.departmentId, projectId: task.projectId }), departmentId: task.departmentId, projectId: task.projectId }
  const allowedTask = canEditTask(user, task)
  if (!allowedTask.allowed) return allowedTask
  return canAssignTask(user, targetUser, taskContext)
}

export function canEscalateTicket(user, ticket) {
  if (!ticket) return deny('Ticket does not exist.')
  if (!user) return deny('User is not available.')
  const updateCheck = canUpdateTicket(user, ticket)
  if (!updateCheck.allowed) return updateCheck
  if (['support', 'admin', 'superadmin', 'manager'].includes(user.role)) return allow('Allowed.')
  return deny('You do not have permission to escalate this ticket.')
}

export function canManageUser(user, targetUser, changes = {}) {
  if (!user) return deny('User is not available.')
  if (!targetUser) {
    if (!['superadmin', 'admin'].includes(user.role)) return deny('You do not have permission to create employees.')
    if (changes.role === 'superadmin' && user.role !== 'superadmin') return deny('Only Superadmin can grant Superadmin privileges.')
    if (user.role === 'admin') {
      const scope = user.scopeDepartmentIds || [user.departmentId]
      if (changes.departmentId && !scope.includes(changes.departmentId)) return deny('Employee would be outside your authorized department scope.')
      if (!['manager', 'support', 'executive'].includes(changes.role)) return deny('Admins may create only Managers, Support Staff, and Executives.')
    }
    return allow('Allowed.')
  }
  if (targetUser.role === 'superadmin' && user.role !== 'superadmin') return deny('Only Superadmin can manage a Superadmin account.')
  if (!['superadmin', 'admin', 'hr'].includes(user.role)) return deny('You do not have permission to manage employees.')
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    if (!scope.includes(targetUser.departmentId)) return deny('Employee is outside your authorized department scope.')
    if (changes.role !== undefined && changes.role !== targetUser.role) return deny('Only Superadmin may change employee roles.')
    if (changes.departmentId && !scope.includes(changes.departmentId)) return deny('Employee would be outside your authorized department scope.')
  }
  if (user.role === 'hr' && ((changes.role !== undefined && changes.role !== targetUser.role) || (changes.departmentId !== undefined && changes.departmentId !== targetUser.departmentId) || targetUser.role === 'superadmin' || targetUser.role === 'admin')) {
    return deny('HR may update employee records but cannot change roles or departments for Admins or Superadmin.')
  }
  if (changes.role === 'superadmin' && user.role !== 'superadmin') return deny('Only Superadmin can grant Superadmin privileges.')
  return allow('Allowed.')
}

export function canManageDepartment(user, department) {
  if (!user) return deny('User is not available.')
  if (!department) return deny('Department does not exist.')
  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return scope.includes(department.id) ? allow('Allowed.') : deny('Department is outside your authorized scope.')
  }
  return deny('You do not have permission to manage departments.')
}

export function canChangeTicketDepartment(user, ticket, departmentId) {
  if (!user || !ticket || !departmentId) return deny('User, ticket, and target department are required.')
  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return scope.includes(ticket.departmentId) && scope.includes(departmentId)
      ? allow('Allowed.')
      : deny('Ticket department change is outside your authorized scope.')
  }
  return deny('Only Superadmin or an in-scope Admin may change ticket departments.')
}

export function canCreateDepartment(user) {
  return user?.role === 'superadmin' ? allow('Allowed.') : deny('Only Superadmin can create departments.')
}

export function canViewTicket(user, ticket) {
  if (!user || !ticket) return deny('Ticket does not exist or user is unavailable.')
  if (user.role === 'superadmin') return allow('Allowed.')
  const isParty = ticket.requesterId === user.id || ticket.assigneeId === user.id
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return isParty || scope.includes(ticket.departmentId) ? allow('Allowed.') : deny('Ticket is outside your authorized scope.')
  }
  if (user.role === 'manager') return isParty || ticket.departmentId === user.departmentId ? allow('Allowed.') : deny('Ticket is outside your department.')
  if (user.role === 'hr') return isParty || ticket.departmentId === 'd-hr' ? allow('Allowed.') : deny('Ticket is outside the HR workflow.')
  if (user.role === 'support') return isParty || ticket.departmentId === user.departmentId ? allow('Allowed.') : deny('Ticket is outside your support scope.')
  return isParty ? allow('Allowed.') : deny('You do not have permission to view this ticket.')
}

export function canUpdateTicket(user, ticket) {
  const viewCheck = canViewTicket(user, ticket)
  if (!viewCheck.allowed) return viewCheck
  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return scope.includes(ticket.departmentId) ? allow('Allowed.') : deny('Ticket is outside your authorized department scope.')
  }
  if (user.role === 'manager') return ticket.departmentId === user.departmentId ? allow('Allowed.') : deny('Ticket is outside your department.')
  if (user.role === 'support' && (ticket.departmentId === user.departmentId || ticket.assigneeId === user.id)) return allow('Allowed.')
  if (user.role === 'hr' && (ticket.departmentId === 'd-hr' || ticket.assigneeId === user.id)) return allow('Allowed.')
  return deny('You do not have permission to update this ticket.')
}

export function canAssignTicket(user, ticket, targetUser) {
  if (!user) return deny('User is not available.')
  if (!ticket || !targetUser) return deny('Ticket and target employee are required.')
  if (!isActiveUser(targetUser)) return deny('Inactive employees cannot receive ticket assignments.')
  if (!canViewTicket(user, ticket).allowed) return deny('You do not have permission to manage this ticket.')
  if (user.role === 'superadmin') return allow('Allowed.')
  if (user.role === 'admin') {
    const scope = user.scopeDepartmentIds || [user.departmentId]
    return scope.includes(ticket.departmentId) && scope.includes(targetUser.departmentId) && targetUser.role !== 'superadmin'
      ? allow('Allowed.')
      : deny('Ticket assignment is outside your authorized scope.')
  }
  if (user.role === 'manager') {
    return ticket.departmentId === user.departmentId && targetUser.departmentId === user.departmentId && ['support', 'executive'].includes(targetUser.role)
      ? allow('Allowed.')
      : deny('Managers may assign tickets only to eligible staff in their department.')
  }
  if (user.role === 'support') {
    return ticket.departmentId === user.departmentId && targetUser.departmentId === user.departmentId && targetUser.role === 'support'
      ? allow('Allowed.')
      : deny('Support tickets may be assigned only to support colleagues in the same department.')
  }
  return deny('You do not have permission to assign this ticket.')
}

export function canCreateTicket(user, ticket) {
  if (!user || !isActiveUser(user)) return deny('An active user is required to create a ticket.')
  if (!ticket || !ticket.title?.trim()) return deny('Ticket title is required.')
  if (ticket.requesterId !== user.id && !['superadmin', 'admin'].includes(user.role)) return deny('You may create tickets only for yourself.')
  if (ticket.assigneeId === user.id) return allow('Allowed.')
  return canAssignTicket(user, ticket, ticket.assignee)
}

export function getEligibleTaskAssignees({ user, users, taskContext = {} }) {
  if (!user || !Array.isArray(users)) return []
  const activeUsers = users.filter(isActiveUser)
  return activeUsers.filter((targetUser) => canAssignTask(user, targetUser, taskContext).allowed)
}

export function getEligibleSubtaskAssignees({ user, users, parentTask }) {
  if (!user || !Array.isArray(users)) return []
  const activeUsers = users.filter(isActiveUser)
  return activeUsers.filter((targetUser) => canAssignSubtask(user, targetUser, parentTask).allowed)
}

export function getRolePermissionMatrix() {
  return ROLE_PERMISSION_MATRIX
}
