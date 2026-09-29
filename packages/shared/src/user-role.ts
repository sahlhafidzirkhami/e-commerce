export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  ADMIN: 'ADMIN',
  OWNER: 'OWNER',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const USER_ROLES = Object.values(UserRole) as readonly UserRole[];

/** Role yang boleh mengakses /admin dan endpoint admin. */
export const ADMIN_ROLES: readonly UserRole[] = [UserRole.ADMIN, UserRole.OWNER];

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}
