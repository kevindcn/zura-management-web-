// Centralized permissions and role-based access control (RBAC) for Zura

export const ROLES = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;

export type ProjectRole = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: ProjectRole[] = [ROLES.ADMIN, ROLES.MEMBER, ROLES.VIEWER];

export type Permission =
  | "project:view"
  | "project:settings"
  | "project:delete"
  | "issue:view"
  | "issue:create"
  | "issue:edit"
  | "issue:move"
  | "issue:delete:own"
  | "issue:delete:any"
  | "comment:view"
  | "comment:create"
  | "comment:delete:own"
  | "comment:delete:any"
  | "member:manage"
  | "sprint:view"
  | "sprint:manage"
  | "label:manage";

const ROLE_PERMISSIONS: Record<ProjectRole, Permission[]> = {
  VIEWER: [
    "project:view",
    "issue:view",
    "comment:view",
    "sprint:view",
  ],
  MEMBER: [
    "project:view",
    "issue:view",
    "comment:view",
    "sprint:view",
    "issue:create",
    "issue:edit",
    "issue:move",
    "comment:create",
    "comment:delete:own",
    "issue:delete:own",
    "label:manage",
  ],
  ADMIN: [
    "project:view",
    "issue:view",
    "comment:view",
    "sprint:view",
    "sprint:manage",
    "issue:create",
    "issue:edit",
    "issue:move",
    "comment:create",
    "comment:delete:own",
    "comment:delete:any",
    "issue:delete:own",
    "issue:delete:any",
    "member:manage",
    "project:settings",
    "label:manage",
  ],
};

/**
 * Check if a given role has a specific permission
 */
export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const normalizedRole = role.toUpperCase().trim() as ProjectRole;
  const permissions = ROLE_PERMISSIONS[normalizedRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export interface MemberValidationParams {
  projectLeadId: string;
  members: Array<{ userId: string; role: string }>;
  targetUserId: string;
  actorUserId?: string;
  newRole?: string;
  isDelete?: boolean;
}

/**
 * Validate that admin and project lead locks are preserved:
 * - Lead project cannot be removed or demoted from Admin
 * - The last remaining Admin in the project cannot be removed or demoted
 * - Non-admin actors cannot mutate members or escalate privileges
 */
export function validateMemberMutation(params: MemberValidationParams): {
  allowed: boolean;
  reason?: string;
} {
  const { projectLeadId, members, targetUserId, actorUserId, newRole, isDelete = false } = params;

  // 1. Project Lead Lock
  if (targetUserId === projectLeadId) {
    if (isDelete) {
      return {
        allowed: false,
        reason: "Pemilik project (lead) tidak dapat dikeluarkan dari project",
      };
    }
    if (newRole && newRole.toUpperCase() !== ROLES.ADMIN) {
      return {
        allowed: false,
        reason: "Pemilik project (lead) harus tetap memiliki peran ADMIN",
      };
    }
  }

  // 2. Last Admin Lock
  const targetMember = members.find((m) => m.userId === targetUserId);
  const isTargetAdmin = targetMember && targetMember.role.toUpperCase() === ROLES.ADMIN;

  if (isTargetAdmin) {
    const isDemoting = newRole && newRole.toUpperCase() !== ROLES.ADMIN;
    if (isDelete || isDemoting) {
      const adminCount = members.filter((m) => m.role.toUpperCase() === ROLES.ADMIN).length;
      if (adminCount <= 1) {
        return {
          allowed: false,
          reason: isDelete
            ? "Admin terakhir tidak dapat dikeluarkan dari project"
            : "Admin terakhir tidak dapat diturunkan perannya",
        };
      }
    }
  }

  // 3. Prevent Privilege Escalation (Actor Authority Check)
  if (actorUserId) {
    const isActorLead = actorUserId === projectLeadId;
    const actorMember = members.find((m) => m.userId === actorUserId);
    const actorRole = actorMember?.role.toUpperCase();

    if (!isActorLead && actorRole !== ROLES.ADMIN) {
      return {
        allowed: false,
        reason: "Hanya Admin atau Pemilik project yang berhak mengelola anggota",
      };
    }
  }

  return { allowed: true };
}

/**
 * Check if the authenticated user has a demo session based strictly on the JWT isDemo claim.
 */
export function isDemoUser(user?: { isDemo?: boolean } | null): boolean {
  return Boolean(user?.isDemo);
}

