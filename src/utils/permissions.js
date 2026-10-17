import { ROLE_PERMISSIONS } from '../data/roles.js'
import { ROLE_PERMISSION_MATRIX } from '../permissions/taskPermissions.js'

/** Simulated permission check. The real backend re-checks everything. */
export function can(role, permission) {
  const matrixPermissions = ROLE_PERMISSION_MATRIX[role] ?? {}
  if (typeof matrixPermissions[permission] === 'boolean') {
    return matrixPermissions[permission]
  }

  return (ROLE_PERMISSIONS[role] ?? []).includes(permission)
}
