import { useAuthStore } from "../store/auth";
import { useProjectStore } from "../store/project";
import { Project } from "../types";

export const ROLES = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
  VIEWER: "VIEWER",
} as const;

export type ProjectRole = (typeof ROLES)[keyof typeof ROLES];

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

export function can(role: string | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const normalized = role.toUpperCase().trim() as ProjectRole;
  const list = ROLE_PERMISSIONS[normalized];
  if (!list) return false;
  return list.includes(permission);
}

export function getUserRole(project: Project | null | undefined, userId?: string | null): ProjectRole | null {
  if (!project || !userId) return null;
  if (project.leadId === userId) return ROLES.ADMIN;
  const member = project.members?.find((m) => m.userId === userId);
  if (!member) return null;
  return (member.role?.toUpperCase() || ROLES.VIEWER) as ProjectRole;
}

/**
 * React hook to check permissions against the current user role in the active project.
 */
export function usePermission(permission: Permission, projectOverride?: Project | null) {
  const user = useAuthStore((s) => s.user);
  const currentProject = useProjectStore((s) => s.currentProject);

  const activeProject = projectOverride !== undefined ? projectOverride : currentProject;
  const role = getUserRole(activeProject, user?.id);
  const isAllowed = can(role, permission);

  return {
    isAllowed,
    role,
    isViewer: role === ROLES.VIEWER,
    isMember: role === ROLES.MEMBER,
    isAdmin: role === ROLES.ADMIN,
    check: (perm: Permission) => can(role, perm),
  };
}
