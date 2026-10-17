/** Human-readable scope for the current user (used in the sidebar). */
export function describeScope(user, departments) {
  if (!user) return ''
  const name = (id) => departments.find((d) => d.id === id)?.name
  if (user.role === 'superadmin') return 'All departments'
  if (user.role === 'admin') {
    const names = (user.scopeDepartmentIds ?? []).map(name).filter(Boolean)
    return names.length ? names.join(', ') : 'Assigned departments'
  }
  if (user.role === 'hr') return 'People operations'
  if (user.role === 'support') return 'Support ticket queue'
  return name(user.departmentId) ?? ''
}
