export type Permission = 'none' | 'view' | 'edit'

export const ROLE_PERMISSIONS: Record<string, Record<string, Permission>> = {
  admin: {
    fleet: 'edit', drivers: 'edit', maintenance: 'edit',
    speed_events: 'edit', incidents: 'edit', driver_compliance: 'edit',
    compliance_report: 'edit', documents: 'edit', admin: 'edit',
  },
  operations_manager: {
    fleet: 'view', drivers: 'view', maintenance: 'view',
    speed_events: 'view', incidents: 'edit', driver_compliance: 'view',
    compliance_report: 'edit', documents: 'view', admin: 'none',
  },
  manager: {
    fleet: 'view', drivers: 'view', maintenance: 'view',
    speed_events: 'view', incidents: 'edit', driver_compliance: 'view',
    compliance_report: 'view', documents: 'view', admin: 'none',
  },
  safety: {
    fleet: 'none', drivers: 'edit', maintenance: 'none',
    speed_events: 'view', incidents: 'edit', driver_compliance: 'edit',
    compliance_report: 'view', documents: 'edit', admin: 'none',
  },
  workshop: {
    fleet: 'edit', drivers: 'view', maintenance: 'edit',
    speed_events: 'none', incidents: 'view', driver_compliance: 'none',
    compliance_report: 'none', documents: 'edit', admin: 'none',
  },
  tracker: {
    fleet: 'view', drivers: 'view', maintenance: 'none',
    speed_events: 'edit', incidents: 'none', driver_compliance: 'none',
    compliance_report: 'none', documents: 'none', admin: 'none',
  },
  upper_management: {
    fleet: 'view', drivers: 'view', maintenance: 'view',
    speed_events: 'view', incidents: 'view', driver_compliance: 'view',
    compliance_report: 'view', documents: 'view', admin: 'none',
  },
  supervisor: {
    fleet: 'view', drivers: 'view', maintenance: 'edit',
    speed_events: 'edit', incidents: 'edit', driver_compliance: 'view',
    compliance_report: 'view', documents: 'edit', admin: 'none',
  },
  viewer: {
    fleet: 'view', drivers: 'view', maintenance: 'view',
    speed_events: 'view', incidents: 'view', driver_compliance: 'view',
    compliance_report: 'view', documents: 'view', admin: 'none',
  },
}

export function getRole(): string {
  return localStorage.getItem('user_role') ?? 'viewer'
}

export function can(module: string, level: Permission = 'view'): boolean {
  const role  = getRole()
  const perms = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['viewer']
  const perm  = perms[module] ?? 'none'
  if (level === 'view') return perm === 'view' || perm === 'edit'
  if (level === 'edit') return perm === 'edit'
  return false
}

export function getPermission(module: string): Permission {
  const role  = getRole()
  const perms = ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS['viewer']
  return perms[module] ?? 'none'
}