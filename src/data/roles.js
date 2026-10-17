// Role definitions for the six TaskFlow roles.
// PROTOTYPE NOTE: permissions here only drive what the UI shows. In the real
// system the backend enforces every one of these rules on every request.

export const ROLE_KEYS = ['superadmin', 'admin', 'manager', 'hr', 'executive', 'support']

export const ROLES = {
  superadmin: {
    key: 'superadmin',
    label: 'Superadmin',
    summary: 'Full control of the organization',
    scopeLabel: 'Entire organization',
    capabilities: [
      'Global dashboard across every department',
      'Create and manage Admins, Managers, HR, Support Staff and Executives',
      'Manage departments, reporting lines and organization settings',
      'View all tasks, tickets and activity logs',
    ],
  },
  admin: {
    key: 'admin',
    label: 'Admin',
    summary: 'Operations oversight within an assigned scope',
    scopeLabel: 'Assigned departments',
    capabilities: [
      'Scoped operations dashboard and department overview',
      'Create Managers, Support Staff and Executives in scope',
      'Assign work and monitor department performance',
      'Cannot grant Superadmin privileges',
    ],
  },
  manager: {
    key: 'manager',
    label: 'Manager',
    summary: 'Leads a department and its team',
    scopeLabel: 'Own department',
    capabilities: [
      'Create projects, tasks and subtasks for the team',
      'Track workload, deadlines and overdue work',
      'Team Kanban board and task history',
      'Create Executives and Support Staff in the department',
    ],
  },
  hr: {
    key: 'hr',
    label: 'HR',
    summary: 'People operations and employee records',
    scopeLabel: 'Employee directory and HR tasks',
    capabilities: [
      'Maintain the employee directory',
      'Onboarding, offboarding, compliance and training tasks',
      'Track onboarding progress and required documents',
      'No automatic access to confidential department records',
    ],
  },
  executive: {
    key: 'executive',
    label: 'Executive',
    summary: 'Works on tasks and collaborates with peers',
    scopeLabel: 'Own and shared tasks',
    capabilities: [
      'Personal dashboard and My Tasks workspace',
      'Create subtasks and assign them to eligible colleagues',
      'Update status, comment and report blockers',
      'Submit and follow personal helpdesk tickets',
   
    ],
  },
  support: {
     key: 'support',
    label: 'Support Staff',
    summary: 'Handles internal helpdesk tickets',
    scopeLabel: 'Support ticket queue',
    capabilities: [
      'Triage, assign and resolve helpdesk tickets',
      'Internal notes visible only to support',
      'Escalate blocked tickets to the responsible Manager',
      'Create follow-up tasks from tickets',
    ],
  },
}

// Permission keys used by the UI to show or hide actions (simulation only).
export const ROLE_PERMISSIONS = {
  superadmin: ['task.create', 'task.assign', 'task.reassign', 'task.subtask.create', 'task.status.edit', 'ticket.create', 'ticket.escalate', 'employee.create', 'employee.edit', 'directory.view', 'department.manage', 'report.view', 'report.employeePerformance'],
  admin: ['task.create', 'task.assign', 'task.reassign', 'task.subtask.create', 'task.status.edit', 'ticket.create', 'ticket.escalate', 'employee.create', 'employee.edit', 'directory.view', 'department.manage', 'report.view', 'report.employeePerformance'],
  manager: ['task.create', 'task.assign', 'task.reassign', 'task.subtask.create', 'task.status.edit', 'ticket.create', 'ticket.escalate', 'directory.view', 'report.view', 'report.employeePerformance'],
  hr: ['task.create', 'task.assign', 'task.reassign', 'task.status.edit', 'ticket.create', 'employee.edit', 'directory.view', 'report.view'],
  executive: ['task.create', 'task.subtask.create', 'task.status.edit', 'ticket.create'],
  support: ['task.assign', 'task.status.edit', 'ticket.create', 'ticket.triage', 'report.view'],
  
}
